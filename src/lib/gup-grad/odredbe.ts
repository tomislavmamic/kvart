/**
 * Najmanja građevna čestica (Ppmin) iz odredbi za provođenje GUP-a.
 *
 * Odredbe Ppmin ne vežu uz namjenu nego uz PODRUČJE URBANOG PRAVILA
 * (1.1 … 3.6, GP) i vrstu građevine. Tablicu po godini plana i kodu
 * pravila izvodi scripts/gup-grad/odredbe.py iz izvadaka s citatima u
 * data/gup-grad/odredbe/izvor/; područje svake čestice dolazi s lista
 * „Urbana pravila” (scripts/gup-grad/urbana-pravila.py).
 *
 * Ovdje nema brojeva — samo izbor: koju vrijednost iz odredbi uzeti za
 * komad određene namjene, prema postavkama u pravila.ts.
 */
import type { Godina, KodKlase } from "./model";
import type { Pravila } from "./pravila";

export interface VrijednostPpmin {
  /** Vrsta građevine ili opis iz odredbi (slobodnostojeca, dvojna, interpolacija, „poslovna” …). */
  tip: string;
  m2: number;
}

export interface PodrucjePravila {
  naziv: string;
  izvor: string;
  citat: string;
  napomena: string;
  stanovanje: VrijednostPpmin[];
  gospodarska: VrijednostPpmin[];
  javna: VrijednostPpmin[];
}

export interface TablicaPpmin {
  godine: Record<string, Record<string, PodrucjePravila>>;
}

export type VrstaOdredbe = "stanovanje" | "gospodarska" | "javna";

/**
 * Koja vrsta vrijednosti iz odredbi vrijedi za koju namjenu. Namjene bez
 * vrste (zelenilo, šport, plaže, luke, posebna, ulice) nemaju najmanju
 * česticu — ondje je i mala neizgrađena ploha ono što plan hoće.
 */
export const VRSTA_ZA_KLASU: Partial<Record<KodKlase, VrstaOdredbe>> = {
  S: "stanovanje",
  "M/K5": "stanovanje",
  "I/K": "gospodarska",
  D: "javna",
};

/** Osnovne vrste gradnje stanovanja koje odredbe navode po područjima. */
export const OSNOVNI_TIPOVI = ["slobodnostojeca", "dvojna", "interpolacija", "opcenito", "niz"] as const;

export interface NajmanjaCestica {
  m2: number;
  tip: string;
  kodPravila: string;
  izvor: string;
  citat: string;
}

/**
 * Najmanja čestica na kojoj odredbe dopuštaju gradnju za namjenu komada u
 * danom području urbanog pravila, ili null kad je odredbe ne propisuju.
 *
 * Za stanovanje se uzima najmanja od uključenih osnovnih vrsta
 * (slobodnostojeća, dvojna, interpolacija…); tek ako ih područje ne navodi,
 * najmanja od vrijednosti po namjeni (npr. „mješovita M2 1400 m²”).
 */
export function najmanjaCestica(
  tab: TablicaPpmin,
  godina: Godina,
  kodPravila: string | null | undefined,
  klasa: KodKlase,
  p: Pravila,
): NajmanjaCestica | null {
  const vrsta = VRSTA_ZA_KLASU[klasa];
  if (!vrsta || !kodPravila) return null;
  const pod = tab.godine[String(godina)]?.[kodPravila];
  if (!pod) return null;
  const vrijednosti = pod[vrsta];
  const ukljucene = (v: VrijednostPpmin) =>
    (OSNOVNI_TIPOVI as readonly string[]).includes(v.tip)
      ? p.ostaci.tipovi[v.tip as (typeof OSNOVNI_TIPOVI)[number]]
      : false;
  let izbor = vrijednosti.filter(ukljucene);
  if (!izbor.length) izbor = vrijednosti.filter((v) => !(OSNOVNI_TIPOVI as readonly string[]).includes(v.tip));
  if (!izbor.length) return null;
  const min = izbor.reduce((a, v) => (v.m2 < a.m2 ? v : a));
  return { m2: min.m2, tip: min.tip, kodPravila, izvor: pod.izvor, citat: pod.citat };
}
