/**
 * GUP kao dokument: tekst odredbi po blokovima i kartografski prikazi po
 * pločicama. Podatke izvodi scripts/gup-grad/dokument.py u
 * data/gup-grad/dokument/; ovdje su samo oblici, zajednički pregledniku i
 * poslužitelju.
 */

export type DokumentId = "1-06" | "3-08" | "55-14" | "prijedlog-2025";

/**
 * Blok teksta: `n` naslov (razina `r`: 1 poglavlje … 4 odjeljak, 5 podnaslov),
 * `cl` članak (sidro `a`, broj `cl`), `p` odlomak, `li` stavka popisa, `tab`
 * tablica kao slika stranice (`t` je njezin tekst po redcima, za traženje).
 */
export interface Blok {
  id: string;
  /** Stranica izvornika (= stranica glasnika i stranica PDF-a). */
  s: number;
  v: "n" | "cl" | "p" | "li" | "tab";
  t: string;
  r?: number;
  a?: string;
  cl?: string;
  /** Nastavak odlomka s prethodnog stupca ili stranice. */
  nast?: boolean;
  src?: string;
  w?: number;
  h?: number;
}

export interface Dokument {
  id: DokumentId;
  naslov: string;
  /** Glasnik i datum, kako se navodi. */
  izvor: string;
  /** „Sl. gl. 55/14” */
  kratko: string;
  /** Izvorni PDF na split.hr. */
  url: string;
  stranica: number;
  blokovi: Blok[];
}

export interface List {
  id: string;
  naslov: string;
  izvor: string;
  url: string;
  /** Puna rezolucija (150 dpi) u pikselima; razina `maksZum` je puna, svaka niža upola. */
  sirina: number;
  visina: number;
  maksZum: number;
  slicica: { sirina: number; visina: number };
  /**
   * HTRS96/TM (E, N) → udio lista: x = a·E + b·N + c, y = d·E + e·N + f —
   * isto uklapanje kojim je izračun na /gup pročitao list. Samo listovi
   * kojima je uklapanje provjereno (scripts/gup-grad/dokument.py, UKLAPANJE).
   */
  uklapanje?: [number, number, number, number, number, number];
}

/** Veličina pločice lista u pikselima (scripts/gup-grad/dokument.py, PLOCICA). */
export const PLOCICA_LISTA = 512;

/** Okvir na listu kao udjeli širine i visine: [lijevo, gore, desno, dolje], 0–1. */
export type Okvir = [number, number, number, number];

/** Točka na listu kao udjeli širine i visine. */
export type Tocka = [number, number];

/**
 * Razriješen navod — ono što skočni prozor pokazuje i na što cijela
 * stranica skače. Tekst je doslovan iz dokumenta; `oznake` su rasponi
 * znakova u `t` koje navod citira.
 */
export interface Ulomak {
  id: string;
  /** „Sl. gl. 55/14 · čl. 53 · str. 37” */
  naslov: string;
  /** Kratak opis zašto se navodi (npr. „najmanja građevna čestica, urbano pravilo 1.4”). */
  opis?: string;
  /** Cijela stranica dokumenta, otvorena i pomaknuta na navod. */
  href: string;
  izdanje: string;
  dokument?: { id: DokumentId; naslov: string; izvor: string; url: string };
  blokovi?: (Pick<Blok, "id" | "s" | "v" | "t" | "src" | "w" | "h" | "nast"> & { oznake?: [number, number][] })[];
  list?: List & { okvir?: Okvir; tocka?: Tocka };
}
