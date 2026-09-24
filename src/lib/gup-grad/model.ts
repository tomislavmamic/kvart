/**
 * Klase namjene GUP-a kako ih razlikuje rasterizacija listova
 * (scripts/gup-grad/rasteriziraj.py) i skupine u kojima ih crta infografika.
 *
 * Klasa je ono što se na listu da razlikovati BOJOM. Plan neke namjene
 * crta istom bojom i razlikuje ih samo slovnom oznakom (M i K5; I i K), pa
 * ih ovdje pošteno vodimo spojene — to su ujedno kombinirane namjene koje
 * dopuštaju više vrsta gradnje (vidi pravila.ts).
 */

export type KodKlase =
  | "S"
  | "M/K5"
  | "D"
  | "I/K"
  | "T"
  | "L"
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "Z1"
  | "Z5"
  | "Z6"
  | "N"
  | "P";

export type KodSkupine =
  | "stanovanje"
  | "gospodarstvo"
  | "javno"
  | "sport"
  | "zelenilo"
  | "ostalo";

export interface Klasa {
  kod: KodKlase;
  /** Indeks klase u rešetki i u data/gup-grad/cestice.json. */
  indeks: number;
  skupina: KodSkupine;
  naziv: string;
  /** Kratko, za oznaku na ćeliji grafikona. */
  kratko: string;
  /**
   * Boja iz legende lista GUP-a (kako je razvrstava rasteriziraj.py). Samo
   * za kartu provjere, gdje se naše razvrstavanje uspoređuje sa službenim
   * listom po istim bojama; infografika boji skupine (SKUPINE).
   */
  bojaPlana: string;
  /** Kombinirana namjena — dopušta više vrsta gradnje. */
  kombinirana?: boolean;
}

export const KLASE: readonly Klasa[] = [
  { kod: "S", bojaPlana: "#ffff00", indeks: 1, skupina: "stanovanje", naziv: "Stambena namjena", kratko: "Stambena" },
  {
    kod: "M/K5",
    bojaPlana: "#e0a000",
    indeks: 2,
    skupina: "stanovanje",
    naziv: "Mješovita (M1–M3) i poslovna sa stanovanjem (K5)",
    kratko: "Mješovita: stanovanje + poslovanje",
    kombinirana: true,
  },
  { kod: "D", bojaPlana: "#f46040", indeks: 3, skupina: "javno", naziv: "Javna i društvena namjena (škole, vrtići, zdravstvo, kultura…)", kratko: "Javna i društvena" },
  {
    kod: "I/K",
    bojaPlana: "#a02080",
    indeks: 4,
    skupina: "gospodarstvo",
    naziv: "Gospodarska proizvodna (I) i poslovna (K1–K4)",
    kratko: "Gospodarska i poslovna",
    kombinirana: true,
  },
  { kod: "T", bojaPlana: "#c02000", indeks: 5, skupina: "gospodarstvo", naziv: "Ugostiteljsko-turistička (hoteli, kampovi)", kratko: "Turistička" },
  { kod: "L", bojaPlana: "#20a0c0", indeks: 6, skupina: "gospodarstvo", naziv: "Luke posebne namjene (nautička, športska)", kratko: "Luke" },
  { kod: "R1", bojaPlana: "#006000", indeks: 7, skupina: "sport", naziv: "Športski centar", kratko: "Športski centar" },
  { kod: "R2", bojaPlana: "#c0e080", indeks: 8, skupina: "sport", naziv: "Rekreacija", kratko: "Rekreacija" },
  { kod: "R3", bojaPlana: "#40c0c0", indeks: 9, skupina: "sport", naziv: "Uređena plaža, kupalište", kratko: "Kupalište" },
  { kod: "R4", bojaPlana: "#3ec09b", indeks: 13, skupina: "sport", naziv: "Prirodna plaža (novo 2025.)", kratko: "Prirodna plaža" },
  { kod: "R5", bojaPlana: "#7fff9f", indeks: 14, skupina: "sport", naziv: "Golf, izdvojeno građevinsko područje (novo 2025.)", kratko: "Golf" },
  { kod: "Z1", bojaPlana: "#40c040", indeks: 10, skupina: "zelenilo", naziv: "Javne zelene površine, park-šuma Marjan", kratko: "Parkovi i park-šuma" },
  { kod: "Z5", bojaPlana: "#80e000", indeks: 11, skupina: "zelenilo", naziv: "Zaštitno i pejsažno zelenilo", kratko: "Zaštitno zelenilo" },
  {
    kod: "Z6",
    // List crta Z6 istom bojom kao Z5 (odvaja se po natpisima 2025., z6.py);
    // za kartu provjere tamnija maslinasta, da se vidi razlika
    bojaPlana: "#a0b400",
    indeks: 16,
    skupina: "zelenilo",
    naziv: "Zaštitno i pejsažno zelenilo s postojećim građevinama (Meje, Bačvice)",
    kratko: "Zelenilo s postojećim kućama",
  },
  { kod: "N", bojaPlana: "#a000c0", indeks: 12, skupina: "ostalo", naziv: "Posebna namjena (vojska)", kratko: "Posebna" },
  {
    kod: "P",
    bojaPlana: "#c8c8c8",
    indeks: 15,
    skupina: "ostalo",
    naziv: "Ulice, pruga, groblja i infrastruktura — plan ih ne boji namjenom",
    kratko: "Ulice i infrastruktura",
  },
];

export const KLASA_PO_INDEKSU: ReadonlyMap<number, Klasa> = new Map(
  KLASE.map((k) => [k.indeks, k]),
);

/**
 * Boje skupina. Službene boje legende GUP-a ne prolaze provjeru
 * razlučivosti (tri zelene su za daltonista ista boja, žuta se na bijelom
 * ne vidi), pa graf boji SKUPINE nizom provjerenim za sve parove
 * (dataviz validator, svijetla podloga), a pojedinu klasu nosi natpis na
 * ćeliji. Tonovi su odabrani da podsjećaju na plan: žuto-narančasto
 * stanovanje, ljubičasto gospodarstvo, zeleno zelenilo.
 */
export const SKUPINE: readonly {
  kod: KodSkupine;
  naziv: string;
  boja: string;
  /** Svijetla inačica iste boje za neiskorišteni dio. */
  svijetla: string;
}[] = [
  { kod: "stanovanje", naziv: "Stanovanje i mješovito", boja: "#eda100", svijetla: "#fbe3ad" },
  { kod: "gospodarstvo", naziv: "Gospodarstvo i turizam", boja: "#4a3aa7", svijetla: "#cdc8ec" },
  { kod: "javno", naziv: "Javno i društveno", boja: "#e87ba4", svijetla: "#f8d8e4" },
  { kod: "sport", naziv: "Šport, rekreacija i plaže", boja: "#2a78d6", svijetla: "#c6dcf6" },
  { kod: "zelenilo", naziv: "Zelenilo", boja: "#008300", svijetla: "#bfe0bf" },
  { kod: "ostalo", naziv: "Ulice, infrastruktura i posebno", boja: "#71717b", svijetla: "#e4e4e7" },
];

export const GODINE = [2006, 2015, 2025] as const;
export type Godina = (typeof GODINE)[number];
