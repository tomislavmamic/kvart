/**
 * Mjere slaganja modela s mjerenjima za povijesnu provjeru (hindcast).
 *
 * Model daje bezdimenzionalnu gustoću perjanice po satu, a mjerenje je H₂S u
 * µg/m³ s jedne postaje — dvije godine, teški rep, pozadina oko 1,2 µg/m³.
 * Apsolutno mjerilo modela nije poznato, pa su ovdje najvažnije mjere koje
 * mjerilo ne vide: rangovi (Spearman, AUC) i pragovi (kontingencija). Pearson
 * i regresija ostaju radi bazdarenja i usporedbe sa starijim brojkama.
 *
 * Brojke moraju biti usporedive s onima iz `scripts/bazdari-izvor.py` i
 * `scripts/provjeri-izvore-vjetra.py`, pa se rangovi za izjednačene
 * vrijednosti prosječuju, kvantil se računa kao `np.quantile` (linearna
 * interpolacija), a „vrh” su sati **strogo iznad** kvantila. Gdje mjera nema
 * smisla (nema raspršenja, nema pozitivnih), vraća se `NaN`, kao i u Pythonu;
 * `JSON.stringify` to pretvara u `null`.
 *
 * Sve su funkcije čiste i rade nad običnim nizovima poravnatim po indeksu.
 * Parovi u kojima je jedna strana `null`, `undefined` ili `NaN` ispadaju
 * kroz `poravnaj`. Modul ne uvozi ništa osim tipova, da se može vrtjeti u
 * radnoj niti bez preglednika i bez Nexta.
 */

import type { DojavaSat, SatUlaza } from "./tipovi";

/** Niz brojeva u kojem rupa smije biti `null`, `undefined` ili `NaN`. */
export type Niz = readonly (number | null | undefined)[];

const SAT_MS = 3_600_000;
const DAN_MS = 24 * SAT_MS;

// ---------------------------------------------------------------- pomoćno

function jeBroj(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Zadržava samo parove u kojima su obje strane konačni brojevi.
 *
 * `indeksi` govore odakle je koji par došao, da se uz vrijednosti mogu
 * povući i sati, dani ili ulazi za isti podskup.
 */
export function poravnaj(
  x: Niz,
  y: Niz,
): { x: number[]; y: number[]; indeksi: number[] } {
  const n = Math.min(x.length, y.length);
  const px: number[] = [];
  const py: number[] = [];
  const indeksi: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = x[i];
    const b = y[i];
    if (jeBroj(a) && jeBroj(b)) {
      px.push(a);
      py.push(b);
      indeksi.push(i);
    }
  }
  return { x: px, y: py, indeksi };
}

/**
 * Rangovi od 1 s prosjekom za izjednačene vrijednosti — isto što i
 * `_rangovi` u `bazdari-izvor.py`. Prosjek je bitan: mjerenja stoje na
 * granici određivanja u stotinama sati, pa bi drugačije lomljenje veza
 * pomaknulo Spearmana za mjerljiv iznos.
 */
export function rangovi(x: readonly number[]): number[] {
  const poredak = x.map((_, i) => i).sort((a, b) => x[a] - x[b] || a - b);
  const r = new Array<number>(x.length);
  let i = 0;
  while (i < poredak.length) {
    let j = i;
    while (j + 1 < poredak.length && x[poredak[j + 1]] === x[poredak[i]]) j += 1;
    const prosjek = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) r[poredak[k]] = prosjek;
    i = j + 1;
  }
  return r;
}

/** Kvantil s linearnom interpolacijom, kao `np.quantile` sa zadanim načinom. */
export function kvantil(vrijednosti: readonly number[], q: number): number {
  const s = [...vrijednosti].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return NaN;
  const polozaj = (n - 1) * q;
  const d = Math.floor(polozaj);
  if (d + 1 >= n) return s[n - 1];
  return s[d] + (polozaj - d) * (s[d + 1] - s[d]);
}

/** Medijan; `NaN` za prazan niz. */
export function medijan(vrijednosti: readonly number[]): number {
  return kvantil(vrijednosti, 0.5);
}

function pearsonCistih(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += x[i];
    sy += y[i];
  }
  sx /= n;
  sy /= n;
  let gore = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - sx;
    const dy = y[i] - sy;
    gore += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const dolje = Math.sqrt(dx2 * dy2);
  return dolje ? gore / dolje : NaN;
}

/**
 * Mali determinirani generator (mulberry32). Ne treba nam kvaliteta za
 * kriptografiju nego ponovljivost: isti `sjeme` mora dati isti raspon.
 */
export function mulberry32(sjeme: number): () => number {
  let a = sjeme | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------- mjesno vrijeme

const OBLIK_MJESNI = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  month: "2-digit",
  hourCycle: "h23",
});

const mjesnoPamcenje = new Map<string, { sat: number; mjesec: number }>();

function mjesno(sat: string): { sat: number; mjesec: number } {
  const zapamceno = mjesnoPamcenje.get(sat);
  if (zapamceno) return zapamceno;
  let h = NaN;
  let m = NaN;
  for (const dio of OBLIK_MJESNI.formatToParts(new Date(sat))) {
    if (dio.type === "hour") h = Number(dio.value);
    else if (dio.type === "month") m = Number(dio.value);
  }
  const izlaz = { sat: h, mjesec: m };
  mjesnoPamcenje.set(sat, izlaz);
  return izlaz;
}

/**
 * Sat dana po zagrebačkom vremenu, 0–23. Dnevni hod plina i vjetra ide po
 * mjesnom suncu, ne po UTC-u; ljetno vrijeme se ovdje računa točno, a ne
 * paušalno kao `mjesni_sat` u `provjeri-izvore-vjetra.py`.
 */
export function mjesniSat(sat: string): number {
  return mjesno(sat).sat;
}

/** Mjesec po zagrebačkom vremenu, 1–12. */
export function mjesniMjesec(sat: string): number {
  return mjesno(sat).mjesec;
}

// ------------------------------------------------------------- korelacije

/** Spearmanov koeficijent rangova; `NaN` bez raspršenja ili s manje od 2 para. */
export function spearman(x: Niz, y: Niz): number {
  const p = poravnaj(x, y);
  return pearsonCistih(rangovi(p.x), rangovi(p.y));
}

/** Pearsonov koeficijent na sirovim vrijednostima. */
export function pearson(x: Niz, y: Niz): number {
  const p = poravnaj(x, y);
  return pearsonCistih(p.x, p.y);
}

/**
 * Pearson na logaritmima; parovi u kojima je bilo koja strana ≤ 0 ispadaju.
 * Teški rep mjerenja inače drži Pearsona na nekoliko najviših sati.
 */
export function pearsonLog(x: Niz, y: Niz): number {
  const p = poravnaj(x, y);
  const lx: number[] = [];
  const ly: number[] = [];
  for (let i = 0; i < p.x.length; i += 1) {
    if (p.x[i] > 0 && p.y[i] > 0) {
      lx.push(Math.log(p.x[i]));
      ly.push(Math.log(p.y[i]));
    }
  }
  return pearsonCistih(lx, ly);
}

/**
 * AUC vrha: vjerojatnost da model satu iz gornjeg `udio` mjerenja da veću
 * vrijednost nego običnom satu. Mann–Whitney preko prosječnih rangova,
 * doslovno kao `auc_vrha` u `bazdari-izvor.py`: prag je `np.quantile` na
 * `1 - udio`, vrh su sati strogo iznad njega. 0,5 znači da model o vrhu ne
 * zna ništa; `NaN` kad vrha nema ili je sve vrh.
 */
export function aucVrha(model: Niz, mjereno: Niz, udio = 0.1): number {
  const p = poravnaj(model, mjereno);
  const prag = kvantil(p.y, 1 - udio);
  return aucOznaka(
    p.x,
    p.y.map((v) => v > prag),
  );
}

/**
 * AUC za zadanu oznaku (istina = pozitivan sat). `NaN` ako je sve isto.
 * Ovo je `auc` iz `provjeri-izvore-vjetra.py`, osim što tamo prazna strana
 * vraća 0,5; ovdje `NaN`, da se ne pomiješa s pravom polovicom.
 */
export function aucOznaka(vrijednost: readonly number[], oznaka: readonly boolean[]): number {
  let poz = 0;
  for (const o of oznaka) if (o) poz += 1;
  const neg = oznaka.length - poz;
  if (!poz || !neg) return NaN;
  const r = rangovi(vrijednost);
  let zbroj = 0;
  for (let i = 0; i < r.length; i += 1) if (oznaka[i]) zbroj += r[i];
  return (zbroj - (poz * (poz + 1)) / 2) / (poz * neg);
}

// ----------------------------------------------------------- kontingencija

export type Kontingencija = {
  n: number;
  pogodci: number;
  promasaji: number;
  lazne: number;
  tocneNegative: number;
  /** Vjerojatnost otkrivanja: pogodci / (pogodci + promašaji). */
  POD: number;
  /** Udio lažnih uzbuna: lažne / (pogodci + lažne). */
  FAR: number;
  /** Kritični indeks uspjeha: pogodci / (pogodci + promašaji + lažne). */
  CSI: number;
  /** Pristranost: predviđeni pozitivni / izmjereni pozitivni. */
  pristranost: number;
  /** Udio točno razvrstanih sati. */
  tocnost: number;
};

/**
 * Tablica pogodaka za par pragova. Pozitivan sat je **strogo iznad** praga,
 * na obje strane, isto kao vrh u `aucVrha`.
 *
 * Gdje nazivnik nema ničega, mjera je `NaN`.
 */
export function kontingencija(
  model: Niz,
  mjereno: Niz,
  pragMjereno: number,
  pragModela: number,
): Kontingencija {
  const p = poravnaj(model, mjereno);
  let pogodci = 0;
  let promasaji = 0;
  let lazne = 0;
  let tocneNegative = 0;
  for (let i = 0; i < p.x.length; i += 1) {
    const izmjereno = p.y[i] > pragMjereno;
    const predvidjeno = p.x[i] > pragModela;
    if (izmjereno && predvidjeno) pogodci += 1;
    else if (izmjereno) promasaji += 1;
    else if (predvidjeno) lazne += 1;
    else tocneNegative += 1;
  }
  const omjer = (a: number, b: number): number => (b ? a / b : NaN);
  return {
    n: p.x.length,
    pogodci,
    promasaji,
    lazne,
    tocneNegative,
    POD: omjer(pogodci, pogodci + promasaji),
    FAR: omjer(lazne, pogodci + lazne),
    CSI: omjer(pogodci, pogodci + promasaji + lazne),
    pristranost: omjer(pogodci + lazne, pogodci + promasaji),
    tocnost: omjer(pogodci + tocneNegative, p.x.length),
  };
}

/**
 * Prag modela pri kojem model proglašava pozitivnim točno onoliki udio sati
 * koliki je `udio` — izjednačavanje kvantila.
 *
 * Time se iz kontingencije briše nepoznato mjerilo modela: pristranost je
 * po izgradnji ≈ 1 i **ne govori ništa**, a POD, FAR i CSI govore samo o
 * tome pogađa li model *koje* su sate, ne koliko su jaki. Vještina ostaje,
 * mjerilo nestaje. Vraća `(m+1)`-tu najveću vrijednost za `m = round(udio·n)`,
 * pa su strogo iznad nje točno `m` sati kad nema izjednačenih; s izjednačenima
 * ih može biti manje. `-Infinity` ako `udio` traži sve sate.
 */
export function pragKvantila(model: Niz, udio: number): number {
  const s = model.filter(jeBroj).sort((a, b) => a - b);
  const n = s.length;
  if (!n) return NaN;
  const m = Math.round(udio * n);
  if (m >= n) return -Infinity;
  if (m <= 0) return s[n - 1];
  return s[n - m - 1];
}

/** Udio vrijednosti strogo iznad praga; par za `pragKvantila`. */
export function udioIznad(vrijednosti: Niz, prag: number): number {
  const s = vrijednosti.filter(jeBroj);
  if (!s.length) return NaN;
  let k = 0;
  for (const v of s) if (v > prag) k += 1;
  return k / s.length;
}

// --------------------------------------------------------------- regresija

export type Regresija = {
  n: number;
  nagib: number;
  odsjecak: number;
  r2: number;
};

export type RegresijaPoDanima = Regresija & {
  /** 95-postotni raspon nagiba iz ponovnog uzorkovanja po danima. */
  nagib95: [number, number];
  dana: number;
  ponavljanja: number;
  sjeme: number;
};

/** Najmanji kvadrati `y = nagib·x + odsjecak`. */
export function regresija(x: Niz, y: Niz): Regresija {
  const p = poravnaj(x, y);
  const n = p.x.length;
  if (n < 2) return { n, nagib: NaN, odsjecak: NaN, r2: NaN };
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += p.x[i];
    sy += p.y[i];
  }
  sx /= n;
  sy /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = p.x[i] - sx;
    const dy = p.y[i] - sy;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (!sxx) return { n, nagib: NaN, odsjecak: NaN, r2: NaN };
  const nagib = sxy / sxx;
  const odsjecak = sy - nagib * sx;
  const r2 = syy ? 1 - (syy - nagib * sxy) / syy : NaN;
  return { n, nagib, odsjecak, r2 };
}

/**
 * Regresija s rasponom nagiba iz ponovnog uzorkovanja **po danima**, kao
 * `nagib_i_odsjecak` u `bazdari-izvor.py`. Sati unutar dana nisu nezavisni
 * — isti vjetar, ista inverzija — pa bi uzorkovanje po satima dalo lažno
 * uzak raspon. Dan se bira s vraćanjem onoliko puta koliko dana ima, i
 * nagib se računa nad svim satima izabranih dana.
 *
 * Generator je mulberry32 sa `sjeme`, pa je raspon ponovljiv, ali ne i
 * numerički jednak numpyjevu — usporediv je, ne istovjetan.
 */
export function regresijaPoDanima(
  x: Niz,
  y: Niz,
  dani: readonly string[],
  ponavljanja = 400,
  sjeme = 3,
): RegresijaPoDanima {
  const osnovno = regresija(x, y);
  const p = poravnaj(x, y);
  const n = p.x.length;
  const prazno: RegresijaPoDanima = {
    ...osnovno,
    nagib95: [NaN, NaN],
    dana: 0,
    ponavljanja,
    sjeme,
  };
  if (n < 2) return prazno;

  // Sve se središti globalno da zbrojevi po danima ne gube znamenke;
  // nagib je na pomak neosjetljiv.
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += p.x[i];
    sy += p.y[i];
  }
  sx /= n;
  sy /= n;

  type Zbroj = { n: number; sx: number; sy: number; sxx: number; sxy: number };
  const poDanu = new Map<string, Zbroj>();
  for (let k = 0; k < n; k += 1) {
    const d = dani[p.indeksi[k]];
    let z = poDanu.get(d);
    if (!z) {
      z = { n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0 };
      poDanu.set(d, z);
    }
    const dx = p.x[k] - sx;
    const dy = p.y[k] - sy;
    z.n += 1;
    z.sx += dx;
    z.sy += dy;
    z.sxx += dx * dx;
    z.sxy += dx * dy;
  }
  const jedinstveni = [...poDanu.keys()].sort();
  const zbrojevi = jedinstveni.map((d) => poDanu.get(d) as Zbroj);
  if (jedinstveni.length < 2) return { ...prazno, dana: jedinstveni.length };

  const slucajno = mulberry32(sjeme);
  const uzorci: number[] = [];
  for (let r = 0; r < ponavljanja; r += 1) {
    const u: Zbroj = { n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0 };
    for (let k = 0; k < zbrojevi.length; k += 1) {
      const z = zbrojevi[Math.floor(slucajno() * zbrojevi.length)];
      u.n += z.n;
      u.sx += z.sx;
      u.sy += z.sy;
      u.sxx += z.sxx;
      u.sxy += z.sxy;
    }
    const sxx = u.sxx - (u.sx * u.sx) / u.n;
    const sxy = u.sxy - (u.sx * u.sy) / u.n;
    if (sxx > 0) uzorci.push(sxy / sxx);
  }
  if (!uzorci.length) return { ...prazno, dana: jedinstveni.length };
  return {
    ...osnovno,
    nagib95: [kvantil(uzorci, 0.025), kvantil(uzorci, 0.975)],
    dana: jedinstveni.length,
    ponavljanja,
    sjeme,
  };
}

// ------------------------------------------------------------- dnevni hod

/**
 * Vadi dnevni hod: od svake vrijednosti oduzima medijan njezina mjesnog
 * sata dana. I plin i vjetar imaju jak dnevni hod, pa sirova korelacija
 * mjeri doba dana, a ne prijenos. Rupe ostaju `NaN`; medijan se računa iz
 * istog niza koji se čisti.
 */
export function bezDnevnogHoda(sati: readonly string[], vrijednosti: Niz): number[] {
  const poSatu = new Map<number, number[]>();
  for (let i = 0; i < sati.length; i += 1) {
    const v = vrijednosti[i];
    if (!jeBroj(v)) continue;
    const h = mjesniSat(sati[i]);
    const kos = poSatu.get(h);
    if (kos) kos.push(v);
    else poSatu.set(h, [v]);
  }
  const sredina = new Map<number, number>();
  for (const [h, vs] of poSatu) sredina.set(h, medijan(vs));
  const izlaz = new Array<number>(sati.length);
  for (let i = 0; i < sati.length; i += 1) {
    const v = vrijednosti[i];
    izlaz[i] = jeBroj(v) ? v - (sredina.get(mjesniSat(sati[i])) ?? NaN) : NaN;
  }
  return izlaz;
}

// ------------------------------------------------------------ nulti pojas

export type Raspon = { min: number; max: number; medijan: number };

export type NultiPojas = {
  pomaci: number[];
  spearman: Raspon;
  aucVrha: Raspon;
  uzorci: { pomak: number; n: number; spearman: number; aucVrha: number }[];
};

function raspon(vrijednosti: readonly number[]): Raspon {
  const s = vrijednosti.filter(jeBroj);
  if (!s.length) return { min: NaN, max: NaN, medijan: NaN };
  return { min: Math.min(...s), max: Math.max(...s), medijan: medijan(s) };
}

/**
 * Nulti pojas: iste mjere kad mjerenje s modelom nema nikakve veze.
 *
 * Mjerenje se pomakne za cijele dane — naprijed i natrag za svaki od
 * `pomaciDana` — pa mu dnevni hod ostane na mjestu; inače bi nulti model
 * bio prelagan i sve bi ispalo značajno. Ovo je „nulti model” iz
 * `provjeri-izvore-vjetra.py`, ali po stvarnom vremenu, ne po indeksu: sat
 * kojem pomaknuti par ne postoji (rupa u nizu, rub razdoblja) ispada.
 * Brojka modela koja stane u ovaj pojas ne znači ništa.
 */
export function nultiPojas(
  model: Niz,
  mjereno: Niz,
  sati: readonly string[],
  pomaciDana: readonly number[] = [1, 2, 3, 5, 7, 10, 14],
  udio = 0.1,
): NultiPojas {
  const poSatu = new Map<string, number>();
  for (let i = 0; i < sati.length; i += 1) {
    const v = mjereno[i];
    if (jeBroj(v)) poSatu.set(sati[i], v);
  }
  const vremena = sati.map((s) => Date.parse(s));
  const uzorci: NultiPojas["uzorci"] = [];
  for (const dana of pomaciDana) {
    for (const predznak of [1, -1]) {
      const x: number[] = [];
      const y: number[] = [];
      for (let i = 0; i < sati.length; i += 1) {
        const m = model[i];
        if (!jeBroj(m) || !Number.isFinite(vremena[i])) continue;
        const v = poSatu.get(new Date(vremena[i] + predznak * dana * DAN_MS).toISOString());
        if (v === undefined) continue;
        x.push(m);
        y.push(v);
      }
      uzorci.push({
        pomak: predznak * dana,
        n: x.length,
        spearman: spearman(x, y),
        aucVrha: aucVrha(x, y, udio),
      });
    }
  }
  return {
    pomaci: uzorci.map((u) => u.pomak),
    spearman: raspon(uzorci.map((u) => u.spearman)),
    aucVrha: raspon(uzorci.map((u) => u.aucVrha)),
    uzorci,
  };
}

// ---------------------------------------------------------------- režimi

export type OcjenaRezima = { n: number; spearman: number; aucVrha: number };

export type Rezimi = {
  dobaDana: Record<"noc" | "dan", OcjenaRezima>;
  brzina: Record<"<1" | "1-2" | "2-4" | ">=4", OcjenaRezima>;
  /** Samo ako je zadan `nizvjetar`. */
  smjer?: Record<"nizvjetar" | "ostalo", OcjenaRezima>;
  sezona: Record<"DJF" | "MAM" | "JJA" | "SON", OcjenaRezima>;
  dubina: Record<"<100" | "100-300" | ">=300", OcjenaRezima>;
};

function razredBrzine(b: number): keyof Rezimi["brzina"] {
  if (b < 1) return "<1";
  if (b < 2) return "1-2";
  if (b < 4) return "2-4";
  return ">=4";
}

function razredDubine(m: number): keyof Rezimi["dubina"] {
  if (m < 100) return "<100";
  if (m < 300) return "100-300";
  return ">=300";
}

function sezona(mjesec: number): keyof Rezimi["sezona"] {
  if (mjesec === 12 || mjesec <= 2) return "DJF";
  if (mjesec <= 5) return "MAM";
  if (mjesec <= 8) return "JJA";
  return "SON";
}

function ocijeniPodskup(
  model: readonly number[],
  mjereno: readonly number[],
  indeksi: readonly number[],
  udio: number,
): OcjenaRezima {
  const x = indeksi.map((i) => model[i]);
  const y = indeksi.map((i) => mjereno[i]);
  return { n: x.length, spearman: spearman(x, y), aucVrha: aucVrha(x, y, udio) };
}

/**
 * Mjere po režimima: model koji radi samo noću ili samo pri tišini nije
 * isti model kao onaj koji radi uvijek, a ukupna brojka to ne razlikuje.
 *
 * `ulazi` se traže po `sat`, ne po indeksu, pa smiju biti i dulji i u
 * drugom redoslijedu. Sat bez vjetra ne ulazi u razrede brzine i smjera,
 * bez dubine ne ulazi u razrede dubine. Geometrija „prema prijemniku” nije
 * ovdje: `nizvjetar` je predikat koji pozivatelj zna za svoj prijemnik.
 */
export function poRezimima(
  sati: readonly string[],
  model: Niz,
  mjereno: Niz,
  ulazi: readonly SatUlaza[],
  nizvjetar?: (sat: SatUlaza) => boolean,
  udio = 0.1,
): Rezimi {
  const p = poravnaj(model, mjereno);
  const poSatu = new Map<string, SatUlaza>();
  for (const u of ulazi) poSatu.set(u.sat, u);

  const kosevi = {
    dobaDana: { noc: [], dan: [] } as Record<string, number[]>,
    brzina: { "<1": [], "1-2": [], "2-4": [], ">=4": [] } as Record<string, number[]>,
    smjer: { nizvjetar: [], ostalo: [] } as Record<string, number[]>,
    sezona: { DJF: [], MAM: [], JJA: [], SON: [] } as Record<string, number[]>,
    dubina: { "<100": [], "100-300": [], ">=300": [] } as Record<string, number[]>,
  };

  for (let k = 0; k < p.x.length; k += 1) {
    const sat = sati[p.indeksi[k]];
    const h = mjesniSat(sat);
    kosevi.dobaDana[h >= 21 || h < 6 ? "noc" : "dan"].push(k);
    kosevi.sezona[sezona(mjesniMjesec(sat))].push(k);
    const u = poSatu.get(sat);
    if (!u) continue;
    if (u.vjetar) {
      kosevi.brzina[razredBrzine(u.vjetar.brzina)].push(k);
      if (nizvjetar) kosevi.smjer[nizvjetar(u) ? "nizvjetar" : "ostalo"].push(k);
    }
    if (u.dubina) kosevi.dubina[razredDubine(u.dubina.m)].push(k);
  }

  const ocijeni = <K extends string>(kos: Record<K, number[]>): Record<K, OcjenaRezima> => {
    const izlaz = {} as Record<K, OcjenaRezima>;
    for (const kljuc of Object.keys(kos) as K[]) {
      izlaz[kljuc] = ocijeniPodskup(p.x, p.y, kos[kljuc], udio);
    }
    return izlaz;
  };

  const rezimi: Rezimi = {
    dobaDana: ocijeni(kosevi.dobaDana) as Rezimi["dobaDana"],
    brzina: ocijeni(kosevi.brzina) as Rezimi["brzina"],
    sezona: ocijeni(kosevi.sezona) as Rezimi["sezona"],
    dubina: ocijeni(kosevi.dubina) as Rezimi["dubina"],
  };
  if (nizvjetar) rezimi.smjer = ocijeni(kosevi.smjer) as Rezimi["smjer"];
  return rezimi;
}

// ----------------------------------------------------------- nulti modeli

export type OpcijeNultih = {
  /**
   * Razdoblje na kojem se uči klimatologija. Mora biti odvojeno od
   * razdoblja koje se ocjenjuje: medijan naučen na istim satima koje
   * potom pogađa već „zna” odgovor.
   */
  ugadjanje: { sati: readonly string[]; vrijednosti: Niz };
  /**
   * Smjer **iz kojega** vjetar puše kad je prijemnik nizvjetar od izvora
   * (azimut od prijemnika prema izvoru). Bez njega sektorski model ostaje
   * `NaN`.
   */
  azimutUzvjetra?: number;
  /** Polovica širine sektora u stupnjevima; zadano 45. */
  sektor?: number;
  /** Najmanja brzina u nazivniku, m/s; zadano 0,3. */
  najmanjaBrzina?: number;
};

export type NulteVrijednosti = {
  klimatologija: number[];
  perzistencija: number[];
  sektorski: number[];
  zastoj: number[];
};

/** Najmanja kutna razlika dvaju azimuta, 0–180. */
export function kutnaRazlika(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Nulti modeli kao predviđeni nizovi, poravnati sa `sati`, da ih pokretač
 * ocijeni istim mjerama kao pravi model. Rupa je `NaN`.
 *
 * - `klimatologija`: medijan po mjesnom satu dana, naučen na
 *   `opcije.ugadjanje`, nikad na ocjenjivanom razdoblju.
 * - `perzistencija`: mjerenje prethodnog sata. Teško ga je pobijediti na
 *   satnoj razini i zato je pošten donji prag.
 * - `sektorski`: `1 / max(brzina, najmanjaBrzina)` kad vjetar puše iz
 *   sektora ±`sektor`° oko `azimutUzvjetra`, inače 0. **To je ono što bi
 *   „sam smjer vjetra” predvidio** — strelica na ruži, bez perjanice,
 *   bez miješanja, bez pamćenja. Pravila projekta kažu da to nije model
 *   raspršenja; ovdje stoji baš zato da se vidi koliko pravi model donosi
 *   povrh njega.
 * - `zastoj`: `1 / max(brzina, najmanjaBrzina)` bez obzira na smjer —
 *   samo „zrak stoji”, što H₂S na postaji uz plohu već dobro pogađa.
 */
export function nulteVrijednosti(
  sati: readonly string[],
  mjereno: Niz,
  ulazi: readonly SatUlaza[],
  opcije: OpcijeNultih,
): NulteVrijednosti {
  const sektor = opcije.sektor ?? 45;
  const najmanja = opcije.najmanjaBrzina ?? 0.3;

  const poSatuUgadjanja = new Map<number, number[]>();
  for (let i = 0; i < opcije.ugadjanje.sati.length; i += 1) {
    const v = opcije.ugadjanje.vrijednosti[i];
    if (!jeBroj(v)) continue;
    const h = mjesniSat(opcije.ugadjanje.sati[i]);
    const kos = poSatuUgadjanja.get(h);
    if (kos) kos.push(v);
    else poSatuUgadjanja.set(h, [v]);
  }
  const klima = new Map<number, number>();
  for (const [h, vs] of poSatuUgadjanja) klima.set(h, medijan(vs));

  const mjerenoPoSatu = new Map<string, number>();
  for (let i = 0; i < sati.length; i += 1) {
    const v = mjereno[i];
    if (jeBroj(v)) mjerenoPoSatu.set(sati[i], v);
  }
  const ulazPoSatu = new Map<string, SatUlaza>();
  for (const u of ulazi) ulazPoSatu.set(u.sat, u);

  const n = sati.length;
  const klimatologija = new Array<number>(n);
  const perzistencija = new Array<number>(n);
  const sektorski = new Array<number>(n);
  const zastoj = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const sat = sati[i];
    klimatologija[i] = klima.get(mjesniSat(sat)) ?? NaN;
    const t = Date.parse(sat);
    perzistencija[i] = Number.isFinite(t)
      ? (mjerenoPoSatu.get(new Date(t - SAT_MS).toISOString()) ?? NaN)
      : NaN;
    const v = ulazPoSatu.get(sat)?.vjetar;
    if (!v) {
      sektorski[i] = NaN;
      zastoj[i] = NaN;
      continue;
    }
    const zastojSata = 1 / Math.max(v.brzina, najmanja);
    zastoj[i] = zastojSata;
    if (opcije.azimutUzvjetra === undefined) sektorski[i] = NaN;
    else sektorski[i] = kutnaRazlika(v.smjerOd, opcije.azimutUzvjetra) <= sektor ? zastojSata : 0;
  }
  return { klimatologija, perzistencija, sektorski, zastoj };
}

// ------------------------------------------------------------------ dojave

export type DojaveMetrike = {
  /** Dojavljenih sati za koje model ima predikciju. */
  n: number;
  nSmrdi: number;
  pogodci: number;
  promasaji: number;
  lazne: number;
  tocneNegative: number;
  POD: number;
  FAR: number;
  CSI: number;
  /** AUC vrijednosti modela za sate u kojima je smrdjelo naspram onih u kojima nije. */
  aucDojava: number;
};

/** Ključ predikcije za dojavu: `prijemnik@sat`. */
export function kljucDojave(prijemnik: string, sat: string): string {
  return `${prijemnik}@${sat}`;
}

/**
 * Mjere na dojavama građana. Dojava je jedini prijemnik na strani na kojoj
 * ljudi žive, pa vrijedi i s malim `n` — ali baš zato uz brojke uvijek ide
 * i `n`. Dojavljeni sat bez predikcije ispada; „ne smrdi” sati su
 * negativni primjeri. Pozitivna predikcija je strogo iznad `prag`.
 */
export function dojaveMetrike(
  dojave: readonly DojavaSat[],
  predikcije: ReadonlyMap<string, number>,
  prag: number,
): DojaveMetrike {
  const vrijednosti: number[] = [];
  const oznake: boolean[] = [];
  for (const d of dojave) {
    const v = predikcije.get(kljucDojave(d.prijemnik, d.sat));
    if (!jeBroj(v)) continue;
    vrijednosti.push(v);
    oznake.push(d.smrdi);
  }
  let pogodci = 0;
  let promasaji = 0;
  let lazne = 0;
  let tocneNegative = 0;
  for (let i = 0; i < vrijednosti.length; i += 1) {
    const predvidjeno = vrijednosti[i] > prag;
    if (oznake[i] && predvidjeno) pogodci += 1;
    else if (oznake[i]) promasaji += 1;
    else if (predvidjeno) lazne += 1;
    else tocneNegative += 1;
  }
  const omjer = (a: number, b: number): number => (b ? a / b : NaN);
  return {
    n: vrijednosti.length,
    nSmrdi: pogodci + promasaji,
    pogodci,
    promasaji,
    lazne,
    tocneNegative,
    POD: omjer(pogodci, pogodci + promasaji),
    FAR: omjer(lazne, pogodci + lazne),
    CSI: omjer(pogodci, pogodci + promasaji + lazne),
    aucDojava: aucOznaka(vrijednosti, oznake),
  };
}

// ----------------------------------------------------------------- sažetak

export type UlazSazetka = {
  sati: readonly string[];
  model: Niz;
  mjereno: Niz;
  ulazi: readonly SatUlaza[];
  /** Prag mjerenja iznad kojega je sat „pozitivan”, µg/m³. */
  pragMjereno: number;
  /** Gornji udio sati koji je „vrh” za AUC; zadano 0,1. */
  udioVrha?: number;
  nizvjetar?: (sat: SatUlaza) => boolean;
  /** Za klimatološki nulti model; bez toga on izostaje. */
  ugadjanje?: { sati: readonly string[]; vrijednosti: Niz };
  /** Za sektorski nulti model; bez toga on izostaje. */
  azimutUzvjetra?: number;
  dojave?: readonly DojavaSat[];
  predikcije?: ReadonlyMap<string, number>;
  /** Prag modela za dojave; zadano `pragModela` iz izjednačavanja kvantila. */
  pragDojava?: number;
  pomaciDana?: readonly number[];
  ponavljanja?: number;
  sjeme?: number;
};

export type Ocjena = {
  n: number;
  pragMjereno: number;
  /** Prag modela iz `pragKvantila`, izjednačen s udjelom iznad `pragMjereno`. */
  pragModela: number;
  udioVrha: number;
  ukupno: {
    spearman: number;
    pearson: number;
    pearsonLog: number;
    aucVrha: number;
    /** Iste mjere nakon što se iz obiju serija izvadi dnevni hod. */
    spearmanBezHoda: number;
    aucVrhaBezHoda: number;
  };
  nultiPojas: NultiPojas;
  nultiModeli: Record<string, OcjenaRezima>;
  kontingencija: Kontingencija;
  regresija: RegresijaPoDanima;
  rezimi: Rezimi;
  dojave: DojaveMetrike | null;
};

/** Zaokružuje sve brojeve u strukturi na `decimala`; `NaN` ostaje `NaN`. */
export function zaokruzi<T>(vrijednost: T, decimala = 4): T {
  if (typeof vrijednost === "number") {
    if (!Number.isFinite(vrijednost)) return vrijednost;
    const f = 10 ** decimala;
    return (Math.round(vrijednost * f) / f) as T;
  }
  if (Array.isArray(vrijednost)) {
    return vrijednost.map((v) => zaokruzi(v, decimala)) as T;
  }
  if (vrijednost && typeof vrijednost === "object") {
    const izlaz: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vrijednost as Record<string, unknown>)) {
      izlaz[k] = zaokruzi(v, decimala);
    }
    return izlaz as T;
  }
  return vrijednost;
}

/**
 * Slaže sve mjere u jedan zapis koji se da spremiti kao JSON: ukupne mjere,
 * nulti pojas, nulte modele, kontingenciju s izjednačenim kvantilima,
 * regresiju s rasponom po danima, režime i dojave. Brojke su zaokružene na
 * četiri decimale; `NaN` u JSON-u postaje `null`.
 */
export function sazetak(ulaz: UlazSazetka): Ocjena {
  const udioVrha = ulaz.udioVrha ?? 0.1;
  const p = poravnaj(ulaz.model, ulaz.mjereno);
  const sati = p.indeksi.map((i) => ulaz.sati[i]);
  const dani = sati.map((s) => s.slice(0, 10));

  const modelBezHoda = bezDnevnogHoda(sati, p.x);
  const mjerenoBezHoda = bezDnevnogHoda(sati, p.y);

  const pragModela = pragKvantila(p.x, udioIznad(p.y, ulaz.pragMjereno));

  const nulti = nulteVrijednosti(sati, p.y, ulaz.ulazi, {
    ugadjanje: ulaz.ugadjanje ?? { sati: [], vrijednosti: [] },
    azimutUzvjetra: ulaz.azimutUzvjetra,
  });
  const nultiModeli: Record<string, OcjenaRezima> = {};
  for (const [ime, niz] of Object.entries(nulti)) {
    const q = poravnaj(niz, p.y);
    if (!q.x.length) continue;
    nultiModeli[ime] = {
      n: q.x.length,
      spearman: spearman(q.x, q.y),
      aucVrha: aucVrha(q.x, q.y, udioVrha),
    };
  }

  const ocjena: Ocjena = {
    n: p.x.length,
    pragMjereno: ulaz.pragMjereno,
    pragModela,
    udioVrha,
    ukupno: {
      spearman: spearman(p.x, p.y),
      pearson: pearson(p.x, p.y),
      pearsonLog: pearsonLog(p.x, p.y),
      aucVrha: aucVrha(p.x, p.y, udioVrha),
      spearmanBezHoda: spearman(modelBezHoda, mjerenoBezHoda),
      aucVrhaBezHoda: aucVrha(modelBezHoda, mjerenoBezHoda, udioVrha),
    },
    nultiPojas: nultiPojas(p.x, p.y, sati, ulaz.pomaciDana, udioVrha),
    nultiModeli,
    kontingencija: kontingencija(p.x, p.y, ulaz.pragMjereno, pragModela),
    regresija: regresijaPoDanima(p.x, p.y, dani, ulaz.ponavljanja, ulaz.sjeme),
    rezimi: poRezimima(sati, p.x, p.y, ulaz.ulazi, ulaz.nizvjetar, udioVrha),
    dojave:
      ulaz.dojave && ulaz.predikcije
        ? dojaveMetrike(ulaz.dojave, ulaz.predikcije, ulaz.pragDojava ?? pragModela)
        : null,
  };
  return zaokruzi(ocjena);
}
