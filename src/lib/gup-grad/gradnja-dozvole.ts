/**
 * Dozvole na zelenim česticama karte /gup/gradnja i slobodnim česticama pod
 * planom na snazi (scripts/gup-grad/gradnja-dozvole.py, s geoportala ISPU):
 * gdje se na zemljištu za stambenu zgradu već gradi ili se dozvola traži.
 *
 * Akt može zahvatiti više čestica (građevna čestica od nekoliko katastarskih,
 * s prilazom): na karti se vidi svaka, a klik na bilo koju istakne sve čestice
 * akta kao skupinu.
 */
import { oblik, uObliku, type Geometrija } from "./zabrana";

export type IshodDozvole = "izdana" | "u obradi";

export interface AktGradnje {
  klasa: string;
  postupak: "lokacijska" | "građevinska";
  ishod: IshodDozvole;
  /** naziv akta, ili „Zahtjev za …” dok je u obradi */
  akt: string;
  zaprimljeno: string | null;
  rijeseno: string | null;
  namjena: string;
  zahvat: string;
  adresa: string;
  /** katastarske čestice kako ih akt navodi */
  kc: string;
  /** predmet u eDozvoli */
  poveznica: string;
  /** indeksi čestica (CesticaDozvole) koje akt zahvaća */
  cestice: number[];
}

export interface CesticaDozvole {
  ko: string;
  kc: string;
  /** zeleno na karti (m²); 0 za čestice akta koje nisu zelene (prilaz, ostatak građevne čestice) */
  zeleno_m2: number;
  /** slobodno pod planom na snazi (m²) */
  plan_m2: number;
  akti: number[];
  oblik: Geometrija;
  /** točka unutar čestice [dužina, širina] */
  tocka: [number, number];
}

export interface PodaciDozvola {
  izradjeno: string;
  od_datuma: string;
  akti: AktGradnje[];
  cestice: CesticaDozvole[];
}

/** Izdana dozvola jače od zahtjeva u obradi, građevinska jače od lokacijske. */
export function najjaciAkt(p: PodaciDozvola, akti: readonly number[]): AktGradnje | undefined {
  const tezina = (a: AktGradnje) => (a.ishod === "izdana" ? 2 : 0) + (a.postupak === "građevinska" ? 1 : 0);
  return akti.map((i) => p.akti[i]).sort((a, b) => tezina(b) - tezina(a))[0];
}

/** Čestice s dozvolom na kojima je točka. */
export function cesticeUTocki(p: PodaciDozvola, lng: number, lat: number): number[] {
  const out: number[] = [];
  p.cestice.forEach((c, i) => {
    if (c.akti.length && uObliku(oblik(c.oblik), lng, lat)) out.push(i);
  });
  return out;
}

/** „2024-02-28” → „28. 2. 2024.” */
export const datumHr = (iso: string | null) => {
  if (!iso) return "";
  const [g, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${g}.`;
};
