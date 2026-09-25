/**
 * Sadržaj cijelog teksta GUP-a za navigaciju po /gup/dokument: naslovi do
 * razine 4 sa stranicom glasnika, članci i prijelazi stranica — sve sa
 * sidrima kakva iscrtava TekstDokumenta.
 *
 * Razine naslova dolaze iz PDF-a (scripts/gup-grad/dokument.py) i nisu uvijek
 * razine sadržaja: „ZONA „A“” ili „PRASTARA” otisnuti su slovima poglavlja, a
 * stoje usred odjeljka. Nenumerirani naslov između dvaju numeriranih zato je
 * ovdje podnaslov, ne poglavlje. Oni na početku („GRAD SPLIT GRADSKO VIJEĆE”,
 * uvod s prvim člancima odluke) i na kraju („PRIJELAZNE I ZAVRŠNE ODREDBE”)
 * ostaju kakvi jesu.
 *
 * Bez datoteka — koristi se i u pregledniku.
 */
import { sidro, type Izdanje } from "./izdanja";
import type { Blok, Dokument, DokumentId } from "./model";

/** Najdublja razina u sadržaju; razina 5 su podnaslovi unutar članaka. */
export const NAJDUBLJA_RAZINA = 4;

export interface StavkaSadrzaja {
  /** Sidro naslova u tekstu. */
  id: string;
  t: string;
  /** 1 poglavlje … 4 odjeljak, nakon ispravka nenumeriranih. */
  r: number;
  /** Stranica glasnika. */
  s: number;
}

export interface SadrzajDokumenta {
  id: DokumentId;
  /** „Sl. gl. 55/14” */
  kratko: string;
  /** Sidro naslova dokumenta na stranici izdanja. */
  sidro: string;
  naslovi: StavkaSadrzaja[];
  clanci: { id: string; cl: string; s: number }[];
  /** Prijelazi stranica, redom kojim stoje u tekstu. */
  stranice: { id: string; s: number }[];
}

export const sidroDokumenta = (dok: DokumentId) => `dok-${dok}`;

/** Sidro naslova kartografskih prikaza na stranici izdanja. */
export const SIDRO_KARATA = "karte";

const NUMERIRAN = /^[„“"]?\d+(\.\d+)*\.?\s/;

/**
 * Razina svakog naslova za sadržaj (vidi gore: nenumerirani usred numeriranih).
 * Broje se samo naslovi sadržaja: iza prijelaznih odredbi stoji numerirani
 * popis kartografskih prikaza, ali na razini 5.
 */
export function razineNaslova(naslovi: Pick<Blok, "t" | "r">[]): number[] {
  const numeriran = naslovi.map((n) => (n.r ?? 5) <= NAJDUBLJA_RAZINA && NUMERIRAN.test(n.t));
  const prvi = numeriran.indexOf(true);
  const zadnji = numeriran.lastIndexOf(true);
  return naslovi.map((n, i) => {
    const r = n.r ?? 5;
    return !numeriran[i] && prvi < i && i < zadnji ? Math.max(r, NAJDUBLJA_RAZINA) : r;
  });
}

export function sadrzajDokumenta(izd: Izdanje, dok: Dokument): SadrzajDokumenta {
  const s = (lokalno: string) => sidro(izd, dok.id, lokalno);
  const naslovi = dok.blokovi.filter((b) => b.v === "n");
  const razine = razineNaslova(naslovi);
  const stranice: SadrzajDokumenta["stranice"] = [];
  for (const b of dok.blokovi) {
    if (b.s !== stranice.at(-1)?.s) stranice.push({ id: s(`str-${b.s}`), s: b.s });
  }
  return {
    id: dok.id,
    kratko: dok.kratko,
    sidro: sidroDokumenta(dok.id),
    naslovi: naslovi.flatMap((b, i) =>
      razine[i] <= NAJDUBLJA_RAZINA ? [{ id: s(b.id), t: b.t, r: razine[i], s: b.s }] : [],
    ),
    clanci: dok.blokovi.filter((b) => b.v === "cl").map((b) => ({ id: s(b.a!), cl: b.cl!, s: b.s })),
    stranice,
  };
}
