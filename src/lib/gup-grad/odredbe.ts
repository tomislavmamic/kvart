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

/**
 * Što odredbe dopuštaju graditi u području urbanog pravila (izvadak s
 * citatima: data/gup-grad/odredbe/izvor/gradnja-<godina>.json, sažetak
 * data/gup-grad/odredbe/gradnja.json iz scripts/gup-grad/odredbe.py).
 */
export type NovaStambena =
  /** nove stambene zgrade dopuštene */
  | "da"
  /** samo nova čestica između dvije izgrađene */
  | "interpolacija"
  /** samo kroz propisani UPU/DPU — zemljište je planirano za gradnju */
  | "upu"
  /** samo rekonstrukcija i zamjena postojećih — nema nove stambene zgrade */
  | "rekonstrukcija"
  /** nikakva stambena gradnja (parkovi, plaže, zaštićeni krajolik) */
  | "ne"
  /** gradski projekt s ukupnom kvotom GBP-a */
  | "gp";

export interface PravilaGradnje {
  nova_stambena: NovaStambena;
  /** Najveći kig nove stambene gradnje po vrsti građevine; null = ne propisuje. */
  kig: Partial<Record<string, number>> | null;
  /** Najveći kis (nadzemni gdje ga odredbe razlikuju) po vrsti građevine; null = ne propisuje. */
  kis?: Partial<Record<string, number>> | null;
  izvor: string;
  citat: string;
  napomena: string;
}

export interface TablicaGradnje {
  godine: Record<string, Record<string, PravilaGradnje>>;
}

/** Vrste stambene gradnje koje ne dopuštaju novu zgradu na slobodnom zemljištu. */
const BEZ_NOVE: readonly NovaStambena[] = ["rekonstrukcija", "ne"];

/**
 * Dopuštaju li odredbe novu gradnju namjene komada na slobodnom zemljištu,
 * i najveći kig. Zabrana se odnosi samo na stambenu gradnju u stambenim i
 * mješovitim zonama — to je ono što urbana pravila razlikuju; za ostale
 * namjene gradnja se ne ograničava.
 *
 * Od više kig-ova i kis-ova (slobodnostojeća, dvojna…) uzima se NAJVEĆI uključeni:
 * postojeća zgrada tako zauzima najmanje zemljišta, pa se slobodno ne
 * precjenjuje kao iskorišteno.
 */
export function uvjetiGradnje(
  tab: TablicaGradnje,
  godina: Godina,
  kodPravila: string | null | undefined,
  klasa: KodKlase,
  p: Pravila,
): { novaGradnja: boolean; kig: number | null; kis: number | null; pravilo: PravilaGradnje | null } {
  if (VRSTA_ZA_KLASU[klasa] !== "stanovanje" || !kodPravila) return { novaGradnja: true, kig: null, kis: null, pravilo: null };
  const pr = tab.godine[String(godina)]?.[kodPravila];
  if (!pr) return { novaGradnja: true, kig: null, kis: null, pravilo: null };
  const najveci = (o: Partial<Record<string, number>> | null | undefined) => {
    const v = Object.entries(o ?? {})
      .filter(([tip, x]) =>
        typeof x === "number" &&
        (!(OSNOVNI_TIPOVI as readonly string[]).includes(tip) || p.ostaci.tipovi[tip as (typeof OSNOVNI_TIPOVI)[number]]),
      )
      .map(([, x]) => x as number);
    return v.length ? Math.max(...v) : null;
  };
  return {
    novaGradnja: !BEZ_NOVE.includes(pr.nova_stambena),
    kig: najveci(pr.kig),
    kis: najveci(pr.kis),
    pravilo: pr,
  };
}
