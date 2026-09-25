/**
 * Traženje citata u tekstu dokumenta.
 *
 * Citati u izvadcima (data/gup-grad/odredbe/izvor/) prepisani su doslovno,
 * ali ne i znak po znak: prijelom retka, crtica, navodnici, „m2” umjesto
 * „m²”, izostavljeni dio kao „…”, stari „ñ” umjesto „đ”. Zato se i tekst i
 * citat svode na slova i brojke malim slovima, a nađeno se preslikava natrag
 * na raspone znakova u izvornim blokovima — to su oznake koje se ističu.
 *
 * Čisto, bez datoteka: radi jednako na poslužitelju i u testu.
 */
import type { Blok } from "./model";

const ZAMJENE: Record<string, string> = { ñ: "đ", "²": "2", "³": "3", "ﬁ": "fi", "ﬂ": "fl", "Ɵ": "ti" };
const ZNAK = /[\p{L}\p{N}]/u;

/** Normaliziran tekst i, za svaki njegov znak, indeks izvornog znaka. */
export function normaliziraj(t: string): { n: string; izvor: number[] } {
  let n = "";
  const izvor: number[] = [];
  let i = 0;
  for (const z of t) {
    // zamjena prije malih slova: „Ɵ” bi se inače spustio u „ɵ”, kojeg u popisu nema
    const zam = ZAMJENE[z] ?? ZAMJENE[z.toLowerCase()] ?? z.toLowerCase();
    for (const c of zam) {
      if (ZNAK.test(c)) {
        n += c;
        izvor.push(i);
      }
    }
    i += z.length;
  }
  return { n, izvor };
}

export interface IndeksDokumenta {
  n: string;
  /** Za svaki znak u `n`: indeks bloka i znaka u njegovu tekstu. */
  blok: Int32Array;
  znak: Int32Array;
  blokovi: Blok[];
}

export function indeksiraj(blokovi: Blok[]): IndeksDokumenta {
  const dijelovi: string[] = [];
  const b: number[] = [];
  const z: number[] = [];
  blokovi.forEach((bl, i) => {
    const { n, izvor } = normaliziraj(bl.t);
    dijelovi.push(n);
    for (const x of izvor) {
      b.push(i);
      z.push(x);
    }
  });
  return { n: dijelovi.join(""), blok: Int32Array.from(b), znak: Int32Array.from(z), blokovi };
}

/** Raspon znakova [od, do) u tekstu jednog bloka. */
export interface Oznaka {
  blok: number;
  od: number;
  do: number;
}

/** Dijelovi citata između izostavljanja („…”, „...”, „[…]”). */
export function dijeloviCitata(citat: string): string[] {
  return citat
    .split(/\[?(?:…|\.\.\.)\]?/)
    .map((d) => normaliziraj(d).n)
    .filter((d) => d.length >= 3);
}

/** Najviše normaliziranih znakova između dvaju dijelova citata s izostavljanjem. */
const PROZOR = 6000;

/**
 * Nađi citat u dokumentu. Dijelovi moraju ići redom, svaki unutar prozora
 * iza prethodnog. Od više pogodaka uzima se onaj na navedenoj stranici ili
 * najbliži njoj.
 *
 * Isti se tekst u odredbama ponavlja (urbana pravila 1.3 i 1.5 imaju istu
 * rečenicu), a izvadak ponekad spoji dijelove koji zajedno stoje tek na
 * drugom mjestu. Zato pogodak na navedenoj stranici (±1) kojemu nedostaje
 * dio citata, ali pokriva barem pola njegovih znakova, ima prednost pred
 * potpunim pogotkom na drugoj stranici — navod pokazuje ono mjesto na koje
 * se izvadak poziva. Vraća oznake po blokovima ili null.
 */
export function nadjiCitat(ind: IndeksDokumenta, citat: string, stranica?: number): Oznaka[] | null {
  const dijelovi = dijeloviCitata(citat);
  if (!dijelovi.length) return null;
  const ukupno = dijelovi.reduce((s, d) => s + d.length, 0);
  let potpun: { rasponi: [number, number][]; udaljenost: number } | null = null;
  let djelomican: { rasponi: [number, number][]; pokriveno: number } | null = null;
  let pocetak = ind.n.indexOf(dijelovi[0]);
  while (pocetak !== -1) {
    const rasponi: [number, number][] = [[pocetak, pocetak + dijelovi[0].length]];
    let kraj = pocetak + dijelovi[0].length;
    let svi = true;
    for (const d of dijelovi.slice(1)) {
      const j = ind.n.indexOf(d, kraj);
      if (j === -1 || j - kraj > PROZOR) {
        svi = false;
        continue;
      }
      rasponi.push([j, j + d.length]);
      kraj = j + d.length;
    }
    const s = ind.blokovi[ind.blok[pocetak]].s;
    const udaljenost = stranica === undefined ? 0 : Math.abs(s - stranica);
    if (svi) {
      if (!potpun || udaljenost < potpun.udaljenost) potpun = { rasponi, udaljenost };
      if (udaljenost === 0) break;
    } else if (udaljenost <= 1) {
      const pokriveno = rasponi.reduce((x, [a, b]) => x + b - a, 0);
      if (pokriveno * 2 >= ukupno && (!djelomican || pokriveno > djelomican.pokriveno)) djelomican = { rasponi, pokriveno };
    }
    pocetak = ind.n.indexOf(dijelovi[0], pocetak + 1);
  }
  const izbor = potpun && (potpun.udaljenost <= 1 || !djelomican) ? potpun.rasponi : djelomican?.rasponi;
  if (!izbor) return null;
  return izbor.flatMap(([a, b]) => uBlokove(ind, a, b));
}

/** Normalizirani raspon [a, b) → oznake po blokovima (izvorni znakovi, cijele riječi na rubovima). */
function uBlokove(ind: IndeksDokumenta, a: number, b: number): Oznaka[] {
  const out: Oznaka[] = [];
  const prvi = ind.blok[a];
  const zadnji = ind.blok[b - 1];
  for (let i = prvi; i <= zadnji; i++) {
    const t = ind.blokovi[i].t;
    let od = i === prvi ? ind.znak[a] : 0;
    let dokle = i === zadnji ? ind.znak[b - 1] + 1 : t.length;
    // do kraja riječi: citat „Ppmin=800 m2” mora obuhvatiti i „²”
    while (dokle < t.length && ZNAK.test(t[dokle])) dokle++;
    if (i !== prvi) while (od < dokle && /\s/.test(t[od])) od++;
    if (dokle > od) out.push({ blok: i, od, do: dokle });
  }
  return out;
}

/** Oznake istog bloka spojene i poredane. */
export function spojiOznake(oznake: Oznaka[]): Map<number, [number, number][]> {
  const m = new Map<number, [number, number][]>();
  for (const o of oznake) {
    const l = m.get(o.blok) ?? [];
    l.push([o.od, o.do]);
    m.set(o.blok, l);
  }
  for (const [k, l] of m) {
    l.sort((x, y) => x[0] - y[0]);
    const spojeno: [number, number][] = [];
    for (const r of l) {
      const z = spojeno[spojeno.length - 1];
      if (z && r[0] <= z[1] + 1) z[1] = Math.max(z[1], r[1]);
      else spojeno.push([r[0], r[1]]);
    }
    m.set(k, spojeno);
  }
  return m;
}
