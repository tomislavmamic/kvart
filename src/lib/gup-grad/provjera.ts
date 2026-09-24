/**
 * Sud o jednoj katastarskoj čestici, onako kako ga donosi /gup.
 *
 * Karta provjere (/karta, pogled „Provjera GUP-a”) mora pokazati ISTU
 * odluku koja je ušla u zbrojeve infografike, inače ništa ne provjerava.
 * Zato ovdje nema vlastite logike: komadi čestice prolaze kroz
 * `procijeniKomad` iz izracun.ts s pravilima iz pravila.ts, a ovaj modul
 * samo zbroji komade i imenuje stanje za bojanje.
 */
import {
  komadIzNiza,
  procijeniKomad,
  pokrivenost,
  POLJA_KOMADA,
  type Procjena,
  type RucnaVrsta,
  type UvjetiKomada,
} from "./izracun";
import { KLASA_PO_INDEKSU, type Godina, type Klasa } from "./model";
import type { Pravila, VrstaKoristenja } from "./pravila";

/** Komad kako ga zapisuje cestice.py: POLJA_KOMADA bez `cestica` (klasa, n, zk, z25, kat, pr, pa, jv, os, inf, ze, gr, g). */
export type SirovKomad = number[];
const DULJINA_KOMADA = POLJA_KOMADA.length - 1;

/** Svojstva čestice u pločicama public/geo/gup-grad/cestice/*.json. */
export interface SvojstvaCestice {
  /** Indeks u data/gup-grad/cestice.json. */
  i: number;
  ko: string;
  kc: string;
  /** Površina iz geometrije katastra, m². */
  a: number;
  k: Partial<Record<`${Godina}`, SirovKomad[]>>;
  /** Područje urbanog pravila po godini (list „Urbana pravila”). */
  u?: Partial<Record<`${Godina}`, string>>;
  /** Ispravak iz ručnog pregleda ortofotom. */
  r?: RucnaVrsta;
}

export type StanjeCestice =
  | "slobodna"
  | "u-skladu"
  | "djelomicno-protivno"
  | "protivno"
  /** iskorištena, ali s velikim slobodnim dijelom na koji stane nova čestica */
  | "djelomicno-slobodna"
  /**
   * neiskorištena, ali nije za gradnju: premala za namjenu i bez slobodnog
   * susjeda, ili odredbe ondje ne dopuštaju novu gradnju, ili je teren
   * neizgradiv
   */
  | "ostatak"
  /** ulica unutar zone, izuzeta iz nje (pravila.ulice) */
  | "ulica";

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
  /** Iskorištena čestica s barem ovolikim udjelom slobodnog (za gradnju) je „djelomično slobodna”. */
  djelomicnoSlobodnaUdio: 0.25,
} as const;

export interface KomadSuda {
  klasa: Klasa;
  /** Površina komada koja pripada zoni (bez izuzete ulice). */
  m2: number;
  /** Ulica izuzeta iz zone. */
  ulica: number;
  /** Slobodni dio koji je premali ostatak (0 = nije). */
  ostatak: number;
  /** Slobodni dio na kojem odredbe ne dopuštaju novu gradnju ili je teren neizgradiv. */
  nijeZaGradnju: number;
  /** Izmjereno, u m²: zgrade iz katastra i iz 3D modela, promet, parkirališta, javne ustanove, uređeno, infrastruktura, zelenilo, gradilište. */
  mjereno: { zk: number; z25: number; pr: number; pa: number; jv: number; os: number; inf: number; ze: number; gr: number };
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
  ulica: number;
  ostatak: number;
  nijeZaGradnju: number;
  iskoristeno: number;
  uSkladu: number;
  uSuprotnosti: number;
  stanje: StanjeCestice;
  /** Klasa s najviše površine — za bojanje po namjeni. */
  pretezita: Klasa | null;
}

/**
 * `ostaci` su klase komada ove čestice koje je pravilo o ostacima proglasilo
 * premalima (računa se za cijeli grad odjednom, vidi /api/gup-ostaci);
 * `uvjeti` su odredbe o gradnji za komad pojedine klase (Ppmin, kig, smije
 * li se ondje graditi novo) — iste koje /gup dobiva iz podaci.ts.
 */
export function sudCestice(
  s: Pick<SvojstvaCestice, "k" | "r">,
  godina: Godina,
  p: Pravila,
  pikselM2 = 4,
  ostaci: ReadonlySet<number> = new Set(),
  uvjeti?: (klasa: Klasa) => UvjetiKomada | undefined,
): SudCestice {
  const komadi: KomadSuda[] = [];
  for (const sirov of s.k[`${godina}`] ?? []) {
    if (sirov.length < DULJINA_KOMADA) continue;
    const k = komadIzNiza(sirov, 0, true);
    if (s.r) k.rucno = s.r;
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    if (!kl) continue;
    const pro = procijeniKomad(k, kl.kod, p, uvjeti?.(kl));
    const m = (v: number) => v * pikselM2;
    komadi.push({
      klasa: kl,
      m2: m(pro.n),
      ulica: m(pro.ulica),
      ostatak: ostaci.has(k.klasa) ? m(Math.max(0, pro.n - pro.iskoristeno - pro.zabranjeno - pro.neizgradivo)) : 0,
      nijeZaGradnju: m(pro.zabranjeno + pro.neizgradivo),
      mjereno: {
        zk: m(k.zk),
        z25: m(k.z25),
        pr: m(k.pr),
        pa: m(k.pa ?? 0),
        jv: m(k.jv ?? 0),
        os: m(k.os),
        inf: m(k.inf ?? 0),
        ze: m(k.ze),
        gr: m(k.gr ?? 0),
      },
      g: k.g,
      pokriveno: pokrivenost(k, p, pro.ulica).map(([v, px]) => [v, m(px)]),
      procjena: {
        n: m(pro.n),
        ulica: m(pro.ulica),
        iskoristeno: m(pro.iskoristeno),
        uSkladu: m(pro.uSkladu),
        uSuprotnosti: m(pro.uSuprotnosti),
        zabranjeno: m(pro.zabranjeno),
        neizgradivo: m(pro.neizgradivo),
        poVrsti: Object.fromEntries(Object.entries(pro.poVrsti).map(([v, px]) => [v, m(px ?? 0)])),
      },
      // okućnica nije vrsta s vlastitim sudom: protivna je kad je protivna zgrada uz nju
      protivneVrste: (Object.keys(pro.poVrsti) as VrstaKoristenja[]).filter((v) =>
        v === "okucnica" ? pro.uSuprotnosti > 0 : !p.dopusteno[kl.kod].includes(v),
      ),
    });
  }
  const zbroj = (f: (k: KomadSuda) => number) => komadi.reduce((a, k) => a + f(k), 0);
  const m2 = zbroj((k) => k.m2);
  const ulica = zbroj((k) => k.ulica);
  const ostatak = zbroj((k) => k.ostatak);
  const nijeZaGradnju = zbroj((k) => k.nijeZaGradnju);
  const iskoristeno = zbroj((k) => k.procjena.iskoristeno);
  const uSkladu = zbroj((k) => k.procjena.uSkladu);
  const uSuprotnosti = zbroj((k) => k.procjena.uSuprotnosti);
  const pretezita =
    komadi.reduce<KomadSuda | null>((a, k) => (!a || k.m2 + k.ulica > a.m2 + a.ulica ? k : a), null)?.klasa ?? null;
  return {
    komadi,
    m2,
    ulica,
    ostatak,
    nijeZaGradnju,
    iskoristeno,
    uSkladu,
    uSuprotnosti,
    stanje: stanje(m2, iskoristeno, uSuprotnosti, ulica, ostatak, nijeZaGradnju),
    pretezita,
  };
}

export function stanje(
  m2: number,
  iskoristeno: number,
  uSuprotnosti: number,
  ulica = 0,
  ostatak = 0,
  nijeZaGradnju = 0,
): StanjeCestice {
  const P = PRAGOVI_STANJA;
  if (uSuprotnosti >= P.protivnoM2) {
    return uSuprotnosti >= P.protivnoUdio * iskoristeno ? "protivno" : "djelomicno-protivno";
  }
  // Čestica koja je gotovo cijela ulica nije ni slobodna ni iskorištena zona.
  if (ulica > 0 && m2 < P.slobodnaUdio * (m2 + ulica)) return "ulica";
  if (m2 <= 0) return "slobodna";
  const neiskoristeno = m2 - iskoristeno;
  const zaGradnju = neiskoristeno - ostatak - nijeZaGradnju;
  if (iskoristeno < P.slobodnaUdio * m2) {
    // slobodni dio koji je (gotovo) sav ostatak ili zabrana ne prikazuje se kao slobodan
    if (zaGradnju <= 0.05 * neiskoristeno) return "ostatak";
    return "slobodna";
  }
  return zaGradnju >= P.djelomicnoSlobodnaUdio * m2 ? "djelomicno-slobodna" : "u-skladu";
}
