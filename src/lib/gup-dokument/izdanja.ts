/**
 * Izdanja GUP-a na /gup/dokument: koji tekst i koji listovi čine svako.
 *
 * Tri izdanja su ista tri koja /gup uspoređuje. Plan na snazi je pročišćeni
 * tekst iz 2014. i on je zadana stranica. Grafički dio nije u svakom izdanju
 * ponovo objavljen: pročišćeni popis kartografskih prikaza (Sl. gl. 55/14,
 * str. 83) za listove 2., 3.a–3.e i 4.c upućuje na listove iz 2006. i 2008.,
 * pa ih izdanja dijele. Za izdanje 2006. izvorni listovi 4.a i 4.b iz 2008.
 * nisu objavljeni zasebno; tu stoje listovi iz ciljanih izmjena 2012., kao i
 * u izračunu na /gup (scripts/gup-grad/urbana-pravila.py).
 *
 * Bez datoteka — koristi se i u pregledniku.
 */
import type { DokumentId } from "./model";

export type IzdanjeId = "2006" | "2015" | "2025";

export interface ListIzdanja {
  id: string;
  /** Kad list nije iz samog izdanja, zašto je tu. */
  napomena?: string;
}

export interface Izdanje {
  id: IzdanjeId;
  /** Put do stranice izdanja. */
  put: string;
  naziv: string;
  podnaslov: string;
  /** Jedna rečenica o tome što je ovo izdanje danas. */
  status: string;
  dokumenti: DokumentId[];
  listovi: ListIzdanja[];
}

const IZ_2008 = "List iz izmjena 2008. (Sl. gl. 3/08) — na snazi i u pročišćenom planu.";
const IZ_2006 = "List iz osnovnog plana 2006. (Sl. gl. 1/06) — na snazi i u pročišćenom planu.";

export const IZDANJA: readonly Izdanje[] = [
  {
    id: "2006",
    put: "/gup/dokument/2006",
    naziv: "GUP 2006.",
    podnaslov: "Sl. gl. 1/06, s izmjenama 3/08",
    status: "Izvorni plan iz 2006. i njegove izmjene iz 2008., kako su objavljeni u Službenom glasniku.",
    dokumenti: ["1-06", "3-08"],
    listovi: [
      { id: "namjena-2008", napomena: "Izvorni list iz 2006. nije objavljen zasebno; ovo je list iz izmjena 2008." },
      { id: "djelatnosti-2008" },
      { id: "promet-2008" },
      { id: "telekomunikacije-2006" },
      { id: "energetika-2008" },
      { id: "vodoopskrba-2006" },
      { id: "odvodnja-2006" },
      { id: "uvjeti-koristenja-2012", napomena: "List iz 2008. nije objavljen zasebno; ovo je list iz ciljanih izmjena 2012." },
      { id: "urbana-pravila-2012", napomena: "List iz 2008. nije objavljen zasebno; ovo je list iz ciljanih izmjena 2012." },
      { id: "detaljniji-planovi-2008" },
      { id: "vazeci-planovi-2008" },
    ],
  },
  {
    id: "2015",
    put: "/gup/dokument",
    naziv: "GUP na snazi",
    podnaslov: "pročišćeni tekst, Sl. gl. 55/14",
    status: "Plan koji danas vrijedi: odredbe iz 2006. sa svim izmjenama do 2014., u jednom tekstu.",
    dokumenti: ["55-14"],
    listovi: [
      { id: "namjena-2014", napomena: "Neslužbeni pročišćeni kartografski prikaz Grada." },
      { id: "djelatnosti-2008", napomena: IZ_2008 },
      { id: "promet-2008", napomena: IZ_2008 },
      { id: "telekomunikacije-2006", napomena: IZ_2006 },
      { id: "energetika-2008", napomena: IZ_2008 },
      { id: "vodoopskrba-2006", napomena: IZ_2006 },
      { id: "odvodnja-2006", napomena: IZ_2006 },
      { id: "uvjeti-koristenja-2012", napomena: "List iz ciljanih izmjena 2012. (Sl. gl. 3/12)." },
      { id: "urbana-pravila-2014", napomena: "Neslužbeni pročišćeni kartografski prikaz Grada." },
      { id: "detaljniji-planovi-2008", napomena: `${IZ_2008} Izmjena 2014. za Trsteničku uvalu na njemu nije ucrtana.` },
      { id: "vazeci-planovi-2014", napomena: "Neslužbeni pročišćeni kartografski prikaz, stanje 28. 11. 2014." },
    ],
  },
  {
    id: "2025",
    put: "/gup/dokument/2025",
    naziv: "Prijedlog 2025.",
    podnaslov: "izmjene i dopune za ponovnu javnu raspravu, travanj 2025.",
    status:
      "Prijedlog izmjena koji do rujna 2026. nije donesen. Tekst je odluka o izmjenama: navodi samo ono što se mijenja i dodaje („Članak 53. mijenja se i glasi: …”).",
    dokumenti: ["prijedlog-2025"],
    listovi: [
      { id: "namjena-2025" },
      { id: "djelatnosti-2025" },
      { id: "promet-2025" },
      { id: "energetika-2025" },
      { id: "urbana-pravila-2025" },
      { id: "planske-mjere-2025" },
    ],
  },
];

export const ZADANO_IZDANJE: IzdanjeId = "2015";

export function izdanje(id: string): Izdanje | undefined {
  return IZDANJA.find((i) => i.id === id);
}

/** Izdanje kojemu dokument pripada (za povratak s navoda na cijeli tekst). */
export function izdanjeDokumenta(dok: DokumentId): Izdanje {
  return IZDANJA.find((i) => i.dokumenti.includes(dok))!;
}

/** Izdanja u kojima je list — prvo zadano, pa po redu. */
export function izdanjaLista(list: string): Izdanje[] {
  return [...IZDANJA]
    .filter((i) => i.listovi.some((l) => l.id === list))
    .sort((a, b) => Number(b.id === ZADANO_IZDANJE) - Number(a.id === ZADANO_IZDANJE));
}

/** Put do stranice lista. */
export const putLista = (list: string) => `/gup/dokument/list/${list}`;

/**
 * Sidro u tekstu izdanja: blok (s37-5), članak (cl-53) ili stranica (str-37).
 * Prvi dokument izdanja ima kratka sidra; ostali (izmjene 3/08 uz 1/06) dobivaju
 * predmetak, jer im se brojevi članaka i stranica ponavljaju: 3-08-cl-37.
 */
export function sidro(izd: Izdanje, dok: DokumentId, lokalno: string): string {
  return izd.dokumenti[0] === dok ? lokalno : `${dok}-${lokalno}`;
}
