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
  dodajOkucnicu,
  procijeniKomad,
  sirokoKomada,
  slobodnoKomada,
  pokrivenost,
  POLJA_KOMADA,
  type Procjena,
  type RucnaVrsta,
  type UvjetiKomada,
} from "./izracun";
import { KLASA_PO_INDEKSU, type Godina, type Klasa } from "./model";
import type { Pravila, VrstaKoristenja } from "./pravila";
import { planskiRezim, type Rezim } from "./rezim";

/** Komad kako ga zapisuje cestice.py: POLJA_KOMADA bez `cestica` (klasa, n, zk, z25, kat, pr, pa, jv, os, inf, ze, gr, g, us). */
export type SirovKomad = number[];
/** `us` smije nedostajati (starije pločice): tada se uski pojasevi ne izdvajaju. */
const DULJINA_KOMADA = POLJA_KOMADA.length - 2;

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
  /** Bitovi planskog režima po godini (rezim.ts, listovi 4.c/4.d). */
  p?: Partial<Record<`${Godina}`, number>>;
}

/**
 * Sklad s planom: sudi se samo iskorišteni dio čestice (zgrade, okućnice,
 * parkirališta…). Neiskorištena čestica nema suda.
 */
export type Sklad = "nema" | "po-planu" | "djelomicno" | "protivno";

/**
 * Karta čestice razdvaja tri osi — namjenu, iskorištenost i sklad s planom —
 * i ne miješa ih u jedno „stanje”. Pragovi ispod samo imenuju sklad i
 * prepoznaju ulicu; ne ulaze u zbrojeve /gup (ondje se zbrajaju metri).
 */
export const PRAGOVI = {
  /** Manje od ovoga protivno planu je krhotina ruba, ne gradnja. */
  protivnoM2: 10,
  /** Od ovog udjela iskorištenog nadalje čestica je „protivna”, ne „djelomično”. */
  protivnoUdio: 0.5,
  /** Čestica kojoj je ulica barem ovoliki udio je ulica (namjena „Ulice”). */
  ulicaUdio: 0.95,
  /**
   * Slobodni dio je „nije za gradnju” kad je barem ovoliki udio čestice, a
   * od njega za gradnju ostaje najviše `zaGradnjuUdio`.
   */
  slobodnoUdio: 0.05,
  zaGradnjuUdio: 0.05,
  /**
   * Čestica kojoj je u zonama plana (s ulicom) manje od ovog udjela katastarske
   * površine crta se samo obrisom — more i lučko područje, npr. k.č. 15991
   * k.o. Split: 591 ha, od toga ~0,3 ha u zoni.
   */
  krhotinaZone: 0.05,
} as const;

/**
 * U zoni je tek krhotina čestice: boja zone preko cijele plohe lagala bi o
 * ostatku, koji plan ne boji (more, luka). `a` je površina iz katastra.
 */
export function uZoniKrhotina(s: Pick<SudCestice, "m2" | "ulica">, a: number): boolean {
  return a > 0 && s.m2 + s.ulica < PRAGOVI.krhotinaZone * a;
}

export interface KomadSuda {
  klasa: Klasa;
  /** Površina komada koja pripada zoni (bez izuzete ulice). */
  m2: number;
  /** Ulica izuzeta iz zone. */
  ulica: number;
  /** Slobodni dio koji je premali ostatak (0 = nije). */
  ostatak: number;
  /** Od ostatka: uski pojas (put, stube, rub uz među) u koji zgrada ne stane. */
  usko: number;
  /** Okućnica zgrade sa susjedne čestice kojoj na vlastitoj nedostaje građevne čestice. */
  vrtSusjeda: number;
  /** Slobodni dio na kojem odredbe ne dopuštaju novu gradnju ili je teren neizgradiv. */
  nijeZaGradnju: number;
  /** Slobodni dio koji čeka propisani plan užeg područja. */
  cekaPlan: number;
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
  /** Klasa s najviše površine — za bojanje po namjeni. */
  pretezita: Klasa | null;
  /** Os 1 — namjena: čestica je (gotovo) sva ulica, pa joj je namjena „Ulice”. */
  jeUlica: boolean;
  /** Os 2 — iskorištenost: iskorišteno / površina u zoni, 0–1; null bez zone. */
  iskoristenost: number | null;
  /** Neiskorišteno po razlogu, u m²: za gradnju i ono što nije za gradnju. */
  slobodno: { zaGradnju: number; usko: number; premalo: number; zabranjeno: number; neizgradivo: number; cekaPlan: number };
  /** Neiskorišteni dio je vrijedan spomena, a gotovo ništa od njega nije za gradnju. */
  slobodnoNijeZaGradnju: boolean;
  /** Os 3 — sklad s planom iskorištenog dijela. */
  sklad: Sklad;
  /**
   * Os 4 — planski režim: gradi li se po GUP-u, po planu užeg područja na
   * snazi, ili nova gradnja čeka propisani plan (rezim.ts). null za ulicu.
   */
  rezim: Rezim | null;
}

/**
 * `ostaci` su klase komada ove čestice koje je pravilo o ostacima proglasilo
 * premalima, a `posudjeno` okućnica koju komad klase daje zgradi na susjednoj
 * čestici, [pikseli, od toga protivno] (oboje se računa za cijeli grad
 * odjednom, vidi /api/gup-ostaci);
 * `uvjeti` su odredbe o gradnji za komad pojedine klase (Ppmin, kig, smije
 * li se ondje graditi novo) — iste koje /gup dobiva iz podaci.ts.
 */
export function sudCestice(
  s: Pick<SvojstvaCestice, "k" | "r" | "u" | "p">,
  godina: Godina,
  p: Pravila,
  pikselM2 = 4,
  ostaci: ReadonlySet<number> = new Set(),
  uvjeti?: (klasa: Klasa) => UvjetiKomada | undefined,
  posudjeno?: ReadonlyMap<number, readonly [number, number]>,
): SudCestice {
  const komadi: KomadSuda[] = [];
  const rezim = planskiRezim(s.p?.[`${godina}`] ?? 0, godina, s.u?.[`${godina}`] ?? null);
  // režim ide u uvjete komada kao na /gup (podaci.ts); bez odredbi vrijede zadane vrijednosti
  const uvjetiRezima = (kl: Klasa): UvjetiKomada => ({
    ...(uvjeti?.(kl) ?? { najmanjaPx: 0, kig: null, novaGradnja: true, pikselM2 }),
    rezim: rezim.rezim,
  });
  for (const sirov of s.k[`${godina}`] ?? []) {
    if (sirov.length < DULJINA_KOMADA) continue;
    const k = komadIzNiza(sirov, 0, true);
    if (s.r) k.rucno = s.r;
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    if (!kl) continue;
    const pro = procijeniKomad(k, kl.kod, p, uvjetiRezima(kl));
    const vrt = posudjeno?.get(k.klasa);
    if (vrt && vrt[0] > 0) dodajOkucnicu(pro, vrt[0], 1 - vrt[1] / vrt[0]);
    const m = (v: number) => v * pikselM2;
    komadi.push({
      klasa: kl,
      m2: m(pro.n),
      ulica: m(pro.ulica),
      // uski dio je ostatak uvijek, široki kad ga pravilo o ostacima proglasi premalim
      ostatak: m(ostaci.has(k.klasa) ? slobodnoKomada(pro) : slobodnoKomada(pro) - sirokoKomada(k, pro, p)),
      usko: m(slobodnoKomada(pro) - sirokoKomada(k, pro, p)),
      vrtSusjeda: m(vrt?.[0] ?? 0),
      nijeZaGradnju: m(pro.zabranjeno + pro.neizgradivo),
      cekaPlan: m(pro.cekaPlan ?? 0),
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
  const cekaPlan = zbroj((k) => k.cekaPlan);
  const iskoristeno = zbroj((k) => k.procjena.iskoristeno);
  const uSkladu = zbroj((k) => k.procjena.uSkladu);
  const uSuprotnosti = zbroj((k) => k.procjena.uSuprotnosti);
  const usko = zbroj((k) => k.usko);
  const neiskoristeno = Math.max(0, m2 - iskoristeno);
  const slobodno = {
    zaGradnju: Math.max(0, neiskoristeno - ostatak - nijeZaGradnju - cekaPlan),
    usko,
    premalo: Math.max(0, ostatak - usko),
    zabranjeno: zbroj((k) => k.procjena.zabranjeno),
    neizgradivo: zbroj((k) => k.procjena.neizgradivo),
    cekaPlan,
  };
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
    pretezita,
    jeUlica: ulica > 0 && m2 < (1 - PRAGOVI.ulicaUdio) * (m2 + ulica),
    iskoristenost: m2 > 0 ? Math.min(1, iskoristeno / m2) : null,
    slobodno,
    slobodnoNijeZaGradnju:
      m2 > 0 && neiskoristeno >= PRAGOVI.slobodnoUdio * m2 && slobodno.zaGradnju <= PRAGOVI.zaGradnjuUdio * neiskoristeno,
    sklad: sklad(iskoristeno, uSuprotnosti),
    rezim: m2 > 0 && !(ulica > 0 && m2 < (1 - PRAGOVI.ulicaUdio) * (m2 + ulica)) ? rezim : null,
  };
}

/** Sklad s planom iz iskorištenog i protivnog dijela čestice (m²). */
export function sklad(iskoristeno: number, uSuprotnosti: number): Sklad {
  if (uSuprotnosti >= PRAGOVI.protivnoM2) {
    return uSuprotnosti >= PRAGOVI.protivnoUdio * iskoristeno ? "protivno" : "djelomicno";
  }
  return iskoristeno > 0 ? "po-planu" : "nema";
}
