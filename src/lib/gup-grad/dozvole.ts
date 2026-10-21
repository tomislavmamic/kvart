/**
 * /planovi/dozvole: zahtjevi za građevinsku i lokacijsku dozvolu po važećem
 * GUP-u na zemljištu koje prijedlog GUP-a 2025. stavlja u urbanu sanaciju.
 * Podaci su iz scripts/gup-grad/dozvole-sanacija.py
 * (public/geo/gup-grad/dozvole-sanacija-2025.geojson): predmeti (sloj „akt”,
 * s obuhvatom zahvata) i čestice u sanaciji pod njima (sloj „cestica”).
 */
import type { Feature, FeatureCollection, Geometry } from "geojson";

export const ISHODI = ["izdana", "u obradi", "odbijena", "obustavljena", "proslijeđena", "bez zabilježenog ishoda"] as const;
export type Ishod = (typeof ISHODI)[number];
export const POSTUPCI = ["građevinska", "lokacijska"] as const;
export type Postupak = (typeof POSTUPCI)[number];

export const BOJE_ISHODA: Record<Ishod, string> = {
  izdana: "#d9480f",
  "u obradi": "#2563eb",
  odbijena: "#a21caf",
  obustavljena: "#71717b",
  proslijeđena: "#ca8a04",
  "bez zabilježenog ishoda": "#a1a1aa",
};

/** Kako se ishod piše u brojkama na vrhu stranice. */
export const NAZIV_ISHODA: Record<Ishod, string> = {
  izdana: "izdana dozvola",
  "u obradi": "u obradi",
  odbijena: "zahtjev odbijen",
  obustavljena: "postupak obustavljen",
  proslijeđena: "proslijeđen drugom tijelu",
  "bez zabilježenog ishoda": "bez zabilježenog ishoda",
};

export interface Predmet {
  klasa: string;
  postupak: Postupak;
  vrsta: string;
  ishod: Ishod;
  status: string | null;
  zaprimljeno: string | null;
  datum: string | null;
  kc: string;
  ko: string;
  adresa: string;
  izvor: string;
  namjena: string;
  zahvat: string;
  zahvat_vrsta: string;
  izmjena: boolean;
  upu: string;
}

export interface CesticaDozvola {
  kc: string;
  ko: string;
  izgradjena: boolean;
  klase: string[];
}

export interface ZbrojDozvola {
  predmeti: number;
  bez_izmjena: number;
  po_ishodu: Record<Postupak, Record<Ishod, number>>;
  cestice: number;
  zadnji_u_edozvoli: string;
  po_upu: Record<string, number>;
}

export interface PodaciDozvola extends FeatureCollection {
  izradjeno: string;
  zbroj: ZbrojDozvola;
  sanacija: Geometry;
}

export type ZnacajkaPredmeta = Feature<Geometry, Predmet & { sloj: "akt" }>;
export type ZnacajkaCestice = Feature<Geometry, CesticaDozvola & { sloj: "cestica" }>;

/** Datum predmeta za redoslijed: rješenje, a za neriješene zaprimanje. */
export const kad = (p: Predmet) => p.datum ?? p.zaprimljeno ?? "";

export const datum = (s: string | null | undefined) =>
  s ? `${Number(s.slice(8, 10))}. ${Number(s.slice(5, 7))}. ${s.slice(0, 4)}.` : "—";

/** eDozvola je stala s krajem 2025., pa je ondje „u obradi” stanje iz tog vremena. */
export const ishodTekst = (p: Predmet) =>
  p.ishod === "u obradi" && p.izvor === "eDozvola" ? "u obradi (stanje iz prosinca 2025.)" : p.ishod;

/** Boja čestice: prvi ishod po redu ISHODI među predmetima koji se vide. */
export function ishodCestice(predmeti: Predmet[]): Ishod | null {
  for (const i of ISHODI) if (predmeti.some((p) => p.ishod === i)) return i;
  return null;
}
