/**
 * Sud o jednoj katastarskoj čestici, onako kako ga donosi /gup.
 *
 * Karta provjere (/karta, pogled „Provjera GUP-a”) mora pokazati ISTU
 * odluku koja je ušla u zbrojeve infografike, inače ništa ne provjerava.
 * Zato ovdje nema vlastite logike: komadi čestice prolaze kroz
 * `procijeniKomad` iz izracun.ts s pravilima iz pravila.ts, a ovaj modul
 * samo zbroji komade i imenuje stanje za bojanje.
 */
import { procijeniKomad, pokrivenost, type Komad, type Procjena } from "./izracun";
import { KLASA_PO_INDEKSU, type Godina, type Klasa } from "./model";
import type { Pravila, VrstaKoristenja } from "./pravila";

/** Komad kako ga zapisuje cestice.py: [klasa, n, zk, z25, pr, os, ze, g]. */
export type SirovKomad = [number, number, number, number, number, number, number, number];

/** Svojstva čestice u pločicama public/geo/gup-grad/cestice/*.json. */
export interface SvojstvaCestice {
  /** Indeks u data/gup-grad/cestice.json. */
  i: number;
  ko: string;
  kc: string;
  /** Površina iz geometrije katastra, m². */
  a: number;
  k: Partial<Record<`${Godina}`, SirovKomad[]>>;
}

export type StanjeCestice = "slobodna" | "u-skladu" | "djelomicno-protivno" | "protivno";

/**
 * Pragovi za imenovanje stanja na karti. Ne ulaze u zbrojeve /gup (ondje se
 * zbrajaju metri, ne stanja) — samo odlučuju kojom bojom obojiti česticu.
 */
export const PRAGOVI_STANJA = {
  /**
   * Ispod ovog udjela iskorištenosti čestica je „slobodna”. Samo udio, bez
   * praga u m²: maslinik od 5 000 m² s rubom ceste od 100 m² je slobodan.
   */
  slobodnaUdio: 0.05,
  /** Manje od ovoga protivno planu je krhotina ruba, ne gradnja. */
  protivnoM2: 10,
  /** Od ovog udjela iskorištenog nadalje čestica je „protivna”, ne „djelomično”. */
  protivnoUdio: 0.5,
} as const;

export interface KomadSuda {
  klasa: Klasa;
  m2: number;
  /** Izmjereno, u m²: zgrade iz katastra i iz 3D modela, promet, uređeno, zelenilo. */
  mjereno: { zk: number; z25: number; pr: number; os: number; ze: number };
  /** Pretežita skupina katastarske zgrade (0 = nema). */
  g: number;
  /** Što je od izmjerenog ušlo u račun, bez preklapanja, u m². */
  pokriveno: [VrstaKoristenja, number][];
  /** Sud u m². */
  procjena: Procjena;
  /** Vrste koje ta namjena ne dopušta, a na komadu ih ima. */
  protivneVrste: VrstaKoristenja[];
}

export interface SudCestice {
  komadi: KomadSuda[];
  m2: number;
  iskoristeno: number;
  uSkladu: number;
  uSuprotnosti: number;
  stanje: StanjeCestice;
  /** Klasa s najviše površine — za bojanje po namjeni. */
  pretezita: Klasa | null;
}

export function sudCestice(
  s: Pick<SvojstvaCestice, "k">,
  godina: Godina,
  p: Pravila,
  pikselM2 = 4,
): SudCestice {
  const komadi: KomadSuda[] = [];
  for (const [klasa, n, zk, z25, pr, os, ze, g] of s.k[`${godina}`] ?? []) {
    const kl = KLASA_PO_INDEKSU.get(klasa);
    if (!kl) continue;
    const k: Komad = { klasa, n, zk, z25, pr, os, ze, g };
    const pro = procijeniKomad(k, kl.kod, p);
    const m = (v: number) => v * pikselM2;
    komadi.push({
      klasa: kl,
      m2: m(n),
      mjereno: { zk: m(zk), z25: m(z25), pr: m(pr), os: m(os), ze: m(ze) },
      g,
      pokriveno: pokrivenost(k, p).map(([v, px]) => [v, m(px)]),
      procjena: {
        n: m(pro.n),
        iskoristeno: m(pro.iskoristeno),
        uSkladu: m(pro.uSkladu),
        uSuprotnosti: m(pro.uSuprotnosti),
        poVrsti: Object.fromEntries(Object.entries(pro.poVrsti).map(([v, px]) => [v, m(px ?? 0)])),
      },
      protivneVrste: (Object.keys(pro.poVrsti) as VrstaKoristenja[]).filter(
        (v) => !p.dopusteno[kl.kod].includes(v),
      ),
    });
  }
  const zbroj = (f: (k: KomadSuda) => number) => komadi.reduce((a, k) => a + f(k), 0);
  const m2 = zbroj((k) => k.m2);
  const iskoristeno = zbroj((k) => k.procjena.iskoristeno);
  const uSkladu = zbroj((k) => k.procjena.uSkladu);
  const uSuprotnosti = zbroj((k) => k.procjena.uSuprotnosti);
  const pretezita = komadi.reduce<KomadSuda | null>((a, k) => (!a || k.m2 > a.m2 ? k : a), null)?.klasa ?? null;
  return { komadi, m2, iskoristeno, uSkladu, uSuprotnosti, stanje: stanje(m2, iskoristeno, uSuprotnosti), pretezita };
}

export function stanje(m2: number, iskoristeno: number, uSuprotnosti: number): StanjeCestice {
  const P = PRAGOVI_STANJA;
  if (uSuprotnosti >= P.protivnoM2) {
    return uSuprotnosti >= P.protivnoUdio * iskoristeno ? "protivno" : "djelomicno-protivno";
  }
  if (m2 <= 0 || iskoristeno < P.slobodnaUdio * m2) return "slobodna";
  return "u-skladu";
}
