/**
 * Izračun površina po namjeni GUP-a: ukupno, iskorišteno, u skladu s
 * planom, u suprotnosti s njim i premali ostaci.
 *
 * Čiste funkcije bez I/O-a: ulaz su mjerenja iz data/gup-grad/cestice.json
 * (vidi podaci.ts) i pravila (pravila.ts). Sve odluke o tome što se broji
 * žive u pravilima; ovdje je samo aritmetika nad komadima čestica.
 */
import { KLASE, KLASA_PO_INDEKSU, type Godina, type KodKlase } from "./model";
import type { Pravila, VrstaKoristenja } from "./pravila";

/** Jedan komad čestice (dio čestice u jednoj klasi), u pikselima. */
export interface Komad {
  /** Indeks čestice u cestice.json; treba samo pravilu o ostacima. */
  cestica?: number;
  klasa: number;
  /** površina komada */
  n: number;
  /** pod zgradom iz katastra */
  zk: number;
  /** pod zgradom iz gradskog 3D modela (Objekti_Split_2025) */
  z25: number;
  /** pod ulicom ili nogostupom */
  pr: number;
  /** pod grobljem, športskim objektom ili parkiralištem */
  os: number;
  /** pod održavanim javnim zelenilom */
  ze: number;
  /** pretežita skupina katastarske zgrade (0 = nema) */
  g: number;
}

export interface Procjena {
  /** Površina komada koja pripada zoni (bez izuzete ulice). */
  n: number;
  /** Ulica izuzeta iz zone (pripisuje se P). */
  ulica: number;
  iskoristeno: number;
  uSkladu: number;
  uSuprotnosti: number;
  poVrsti: Partial<Record<VrstaKoristenja, number>>;
}

const VRSTA_ZGRADE: Record<number, VrstaKoristenja> = {
  1: "stambena",
  2: "gospodarska",
  3: "javna",
  4: "pomocna",
  5: "ostala",
};

/**
 * Koliko komada je ulica koja ne pripada zoni. U samoj P (ulice,
 * infrastruktura) ništa se ne izuzima — ondje je ulica upravo namjena.
 */
export function ulicaKomada(k: Komad, kod: KodKlase, p: Pravila): number {
  if (!p.ulice.izuzmi || kod === "P" || k.n <= 0) return 0;
  const u = Math.min(k.pr, k.n);
  return u >= p.ulice.pragUlicneCestice * k.n ? k.n : u;
}

/**
 * Što na komadu stoji, bez preklapanja: redom zgrade, promet, uređeno,
 * zelenilo. `ulica` je već izuzeta iz komada, pa se ne broji ni kao
 * promet.
 */
export function pokrivenost(k: Komad, p: Pravila, ulica = 0): [VrstaKoristenja, number][] {
  const dijelovi: [VrstaKoristenja, number][] = [];
  let slobodno = k.n - ulica;
  const dodaj = (vrsta: VrstaKoristenja, px: number) => {
    const v = Math.min(Math.max(px, 0), slobodno);
    if (v <= 0) return;
    slobodno -= v;
    const i = dijelovi.findIndex(([x]) => x === vrsta);
    if (i >= 0) dijelovi[i][1] += v;
    else dijelovi.push([vrsta, v]);
  };

  if (p.racunaj.zgrade) {
    // Katastar zna vrstu zgrade, 3D model zna koliko je stvarno sagrađeno.
    const upisano = p.zgrade === "model3d" ? Math.min(k.zk, k.z25) : k.zk;
    const neupisano = p.zgrade === "katastar" ? 0 : Math.max(0, k.z25 - k.zk);
    // Katastarska zgrada bez pretežite skupine ne postoji (g > 0 kad je
    // zk > 0), ali krhotina na rubu može imati zk > 0 i g = 0.
    dodaj(VRSTA_ZGRADE[k.g] ?? "ostala", upisano);
    dodaj("neevidentirana", neupisano);
  }
  if (p.racunaj.promet && ulica <= 0) dodaj("promet", k.pr);
  if (p.racunaj.uredjeno) dodaj("uredjeno", k.os);
  if (p.racunaj.zelenilo) dodaj("zelenilo", k.ze);
  return dijelovi;
}

export function procijeniKomad(k: Komad, kod: KodKlase, p: Pravila): Procjena {
  const ulica = ulicaKomada(k, kod, p);
  const n = k.n - ulica;
  const dijelovi = pokrivenost(k, p, ulica);
  const pokriveno = dijelovi.reduce((s, [, v]) => s + v, 0);
  const udio = n > 0 ? pokriveno / n : 0;

  let mnozitelj = 1;
  if (pokriveno > 0) {
    const cijeli =
      (p.nacin === "prag" && udio >= p.prag) ||
      (p.nacin === "cijela" && udio >= p.najmanjiTrag);
    if (cijeli) mnozitelj = n / pokriveno;
  }

  const dopusteno = p.dopusteno[kod];
  const out: Procjena = { n, ulica, iskoristeno: 0, uSkladu: 0, uSuprotnosti: 0, poVrsti: {} };
  for (const [vrsta, v] of dijelovi) {
    const px = v * mnozitelj;
    out.iskoristeno += px;
    out.poVrsti[vrsta] = (out.poVrsti[vrsta] ?? 0) + px;
    if (dopusteno.includes(vrsta)) out.uSkladu += px;
    else out.uSuprotnosti += px;
  }
  return out;
}

/** CSR popis susjednih čestica: susjedi i-te su lista[od[i]:od[i+1]]. */
export interface Susjedi {
  od: number[];
  lista: number[];
}

/**
 * Premali ostaci: komadi čiji slobodni dio ne može služiti namjeni.
 *
 * Slobodni dio komada manji od najmanje građevne čestice koju odredbe
 * propisuju za njegovo područje i namjenu (`najmanjaM2`, odredbe.ts) je ostatak,
 * osim ako se preko slobodne čestice iste namjene (iskorišteno ispod
 * `slobodnaUdio`) spaja s drugim slobodnim komadima i zajedno dosežu tu
 * površinu. Vrt uz kuću i vrt uz susjednu kuću se ne spajaju — obje su
 * čestice iskorištene — ali vrt uz praznu česticu se spaja s njom.
 *
 * Vraća indeks komada → slobodni pikseli koji su ostatak.
 */
export function ostaci(
  komadi: readonly Komad[],
  procjene: readonly Procjena[],
  susjedi: Susjedi,
  p: Pravila,
  pikselM2: number,
  /** Najmanja građevna čestica za komad, m²; 0 = odredbe je ne propisuju. */
  najmanjaM2: (k: Komad) => number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!p.ostaci.ukljuci) return out;
  const slobodno = procjene.map((r) => Math.max(0, r.n - r.iskoristeno));

  // iskorištenost po čestici, preko svih njezinih komada
  const poCestici = new Map<number, { n: number; isk: number }>();
  komadi.forEach((k, i) => {
    if (k.cestica === undefined) return;
    const c = poCestici.get(k.cestica) ?? { n: 0, isk: 0 };
    c.n += procjene[i].n;
    c.isk += procjene[i].iskoristeno;
    poCestici.set(k.cestica, c);
  });
  const slobodnaCestica = (c: number) => {
    const x = poCestici.get(c);
    return !!x && x.n > 0 && x.isk < p.ostaci.slobodnaUdio * x.n;
  };

  const komadPo = new Map<string, number>();
  komadi.forEach((k, i) => {
    if (k.cestica !== undefined) komadPo.set(`${k.cestica}:${k.klasa}`, i);
  });

  // union-find nad komadima sa slobodnim dijelom
  const roditelj = komadi.map((_, i) => i);
  const korijen = (i: number): number => {
    while (roditelj[i] !== i) {
      roditelj[i] = roditelj[roditelj[i]];
      i = roditelj[i];
    }
    return i;
  };
  komadi.forEach((k, i) => {
    if (k.cestica === undefined || slobodno[i] <= 0 || !slobodnaCestica(k.cestica)) return;
    for (let t = susjedi.od[k.cestica]; t < susjedi.od[k.cestica + 1]; t++) {
      const j = komadPo.get(`${susjedi.lista[t]}:${k.klasa}`);
      if (j !== undefined && slobodno[j] > 0) roditelj[korijen(i)] = korijen(j);
    }
  });
  const zbroj = new Map<number, number>();
  komadi.forEach((_, i) => {
    if (slobodno[i] > 0) zbroj.set(korijen(i), (zbroj.get(korijen(i)) ?? 0) + slobodno[i]);
  });

  komadi.forEach((k, i) => {
    if (slobodno[i] <= 0) return;
    const najmanje = najmanjaM2(k) / pikselM2;
    if (najmanje > 0 && (zbroj.get(korijen(i)) ?? 0) < najmanje) out.set(i, slobodno[i]);
  });
  return out;
}

export interface RezultatKlase {
  kod: KodKlase;
  ukupnoM2: number;
  iskoristenoM2: number;
  uSkladuM2: number;
  uSuprotnostiM2: number;
  /** Slobodno, ali premalo za namjenu i bez slobodnog susjeda. */
  ostatakM2: number;
  /** Za zonu: ulice izuzete iz nje. Za P: ulice pribrojene iz drugih zona. */
  uliceM2: number;
  /** Iskorišteno po vrsti — za opis u tooltipu. */
  poVrstiM2: Partial<Record<VrstaKoristenja, number>>;
  /** Samo dio u suprotnosti, po vrsti. */
  suprotnoPoVrstiM2: Partial<Record<VrstaKoristenja, number>>;
}

export interface UlazGodine {
  /** Površina svake klase u obuhvatu, u pikselima (i izvan čestica). */
  klasePx: Record<number, number>;
  komadi: readonly Komad[];
  pikselM2: number;
  /** Bez susjeda nema pravila o ostacima. */
  susjedi?: Susjedi;
  /** Najmanja građevna čestica za komad iz odredbi (m²); bez nje nema ostataka. */
  najmanjaM2?: (k: Komad) => number;
}

/** Procjene svih komada godine i ostaci među njima. */
export function procijeniGodinu(ulaz: UlazGodine, p: Pravila) {
  const procjene = ulaz.komadi.map((k) => {
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    return kl ? procijeniKomad(k, kl.kod, p) : null;
  });
  const ost = ulaz.susjedi && ulaz.najmanjaM2
    ? ostaci(
        ulaz.komadi,
        procjene.map((r) => r ?? { n: 0, ulica: 0, iskoristeno: 0, uSkladu: 0, uSuprotnosti: 0, poVrsti: {} }),
        ulaz.susjedi,
        p,
        ulaz.pikselM2,
        ulaz.najmanjaM2,
      )
    : new Map<number, number>();
  return { procjene, ostaci: ost };
}

export function izracunajGodinu(ulaz: UlazGodine, p: Pravila): RezultatKlase[] {
  const po = new Map<number, RezultatKlase>();
  for (const kl of KLASE) {
    po.set(kl.indeks, {
      kod: kl.kod,
      ukupnoM2: (ulaz.klasePx[kl.indeks] ?? 0) * ulaz.pikselM2,
      iskoristenoM2: 0,
      uSkladuM2: 0,
      uSuprotnostiM2: 0,
      ostatakM2: 0,
      uliceM2: 0,
      poVrstiM2: {},
      suprotnoPoVrstiM2: {},
    });
  }
  const ulice = po.get(KLASE.find((k) => k.kod === "P")!.indeks)!;
  const { procjene, ostaci: ost } = procijeniGodinu(ulaz, p);
  const m2 = ulaz.pikselM2;
  ulaz.komadi.forEach((k, i) => {
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    const r = po.get(k.klasa);
    const pr = procjene[i];
    if (!kl || !r || !pr) return;
    r.iskoristenoM2 += pr.iskoristeno * m2;
    r.uSkladuM2 += pr.uSkladu * m2;
    r.uSuprotnostiM2 += pr.uSuprotnosti * m2;
    r.ostatakM2 += (ost.get(i) ?? 0) * m2;
    for (const [vrsta, v] of Object.entries(pr.poVrsti) as [VrstaKoristenja, number][]) {
      r.poVrstiM2[vrsta] = (r.poVrstiM2[vrsta] ?? 0) + v * m2;
      if (!p.dopusteno[kl.kod].includes(vrsta)) {
        r.suprotnoPoVrstiM2[vrsta] = (r.suprotnoPoVrstiM2[vrsta] ?? 0) + v * m2;
      }
    }
    // Ulica izuzeta iz zone seli u P, gdje je iskorištena po planu.
    if (pr.ulica > 0) {
      const u = pr.ulica * m2;
      r.ukupnoM2 -= u;
      r.uliceM2 += u;
      ulice.ukupnoM2 += u;
      ulice.uliceM2 += u;
      ulice.iskoristenoM2 += u;
      ulice.uSkladuM2 += u;
      ulice.poVrstiM2.promet = (ulice.poVrstiM2.promet ?? 0) + u;
    }
  });
  // Komadi su izrezani čestičnom rešetkom, a ukupno klasom iz obuhvata;
  // na rubu obuhvata iskorišteno smije premašiti ukupno za piksel-dva.
  for (const r of po.values()) {
    r.ukupnoM2 = Math.max(0, r.ukupnoM2);
    if (r.iskoristenoM2 > r.ukupnoM2) {
      const f = r.ukupnoM2 / r.iskoristenoM2;
      r.iskoristenoM2 = r.ukupnoM2;
      r.uSkladuM2 *= f;
      r.uSuprotnostiM2 *= f;
    }
    r.ostatakM2 = Math.min(r.ostatakM2, r.ukupnoM2 - r.iskoristenoM2);
  }
  return [...po.values()].filter((r) => r.ukupnoM2 > 0);
}

/** Ostaci godine kao parovi [čestica, klasa] — za kartu provjere. */
export function ostaciGodine(ulaz: UlazGodine, p: Pravila): [number, number][] {
  const { ostaci: ost } = procijeniGodinu(ulaz, p);
  return [...ost.keys()]
    .map((i) => ulaz.komadi[i])
    .filter((k) => k.cestica !== undefined)
    .map((k) => [k.cestica!, k.klasa]);
}

export type RezultatiPoGodini = Record<Godina, RezultatKlase[]>;
