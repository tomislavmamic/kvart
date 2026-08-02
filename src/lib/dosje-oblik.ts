/**
 * Oblik dosjea čestice — dijele ga poslužitelj i preglednik.
 *
 * Stoji odvojeno od src/lib/dosje.ts jer taj modul čita datoteke i time
 * povlači `fs`; preglednik treba samo oblik i natpise, a uvoz `fs`-a u
 * klijentski svežanj ne prolazi. Ovdje zato nema ničega osim tipova i
 * konstanti.
 */

/** Kako sloj dodiruje česticu. */
export type Odnos = "nad" | "na" | "kroz";

export const ODNOS_NATPIS: Record<Odnos, string> = {
  nad: "područje",
  na: "na čestici",
  kroz: "prolazi",
};

/**
 * Tema je nosiva podjela dosjea: stanar pita „što je ovdje s vodom”, a ne
 * „što ovu česticu presijeca”. Odnos ostaje kao dopuna uz pojedini redak.
 */
export type Tema =
  | "uprava"
  | "zemljiste"
  | "promet"
  | "voda"
  | "struja"
  | "veze"
  | "zelenilo";

/** Redoslijed je zadan da dosje svaki put izgleda isto. */
export const TEME: { id: Tema; naslov: string }[] = [
  { id: "uprava", naslov: "Uprava i planovi" },
  { id: "zemljiste", naslov: "Zemljište i zgrade" },
  { id: "promet", naslov: "Promet" },
  { id: "voda", naslov: "Voda i odvodnja" },
  { id: "struja", naslov: "Struja" },
  { id: "veze", naslov: "Telekom i rasvjeta" },
  { id: "zelenilo", naslov: "Zelenilo i javni prostor" },
];

export interface Stavka {
  sloj: string;
  broj: number;
  primjeri: string[];
  odnos: Odnos;
  /** Poveznica na dokument, ako je objekt nosi (obuhvati planova). */
  poveznica?: string;
}

export interface Skupina {
  naslov: string;
  stavke: Stavka[];
}

/**
 * Odgovor na pitanje s kojim se u dosje i dolazi: što ovdje smijem?
 *
 * Dosad ga nije bilo. Dosje je pretraživao 56 slojeva i nijedan od njih nije
 * bio namjena — susjed koji klikne vlastitu česticu doznao bi za trase DTK-a,
 * koševe za otpad i vježbalište, a ne bi doznao dopušta li plan stanovanje.
 * Pozicioniranje inicijative počiva na „gdje je stanovanje još moguće”, pa je
 * to jedini redak koji ne smije biti jedan među pedeset šest.
 *
 * Stoji odvojeno od `skupine` upravo zato: skupine su popis onoga što se
 * ovdje zateklo, ovo je odgovor.
 */
export interface Namjena {
  kod: string;
  opis: string;
  godina: number;
  /** Dopušta li ta namjena stanovanje — vidi STANOVANJE u dosje.ts. */
  stanovanje: boolean;
  /**
   * Je li ovo očitano s PRETHODNOG lista, jer onaj na snazi ovdje nema plohe.
   * Tri slobodne čestice u kvartu su takve; šutnja bi ondje bila gora.
   */
  saPrethodnog: boolean;
  /**
   * Namjena po PRETHODNOM planu, ako se ovdje razlikuje od one na snazi.
   *
   * Popunjeno tek kad razlika preživi nesigurnost precrtavanja listova
   * (±5 m) — vidi stabilnaRazlika() u dosje.ts. Bez toga je pomak ruba
   * plohe izgledao kao promjena plana.
   */
  prije: { kod: string; opis: string } | null;
  /** Popunjeno ako je čestica u izvedenom sloju slobodnih čestica. */
  slobodna: { slobodno_m2: number; bez_pristupa: boolean } | null;
  /**
   * Zašto čestica NIJE u tom sloju, kad namjena inače dopušta stanovanje.
   * Postoji da se odsutnost izriče: prešućena, čita se kao dopuštenje.
   */
  izvan: string | null;
  /**
   * Što fizički stoji na putu gradnji — dalekovod preko čestice, planirani
   * cestovni koridor. Prazan niz znači „nijedna od onih koje umijemo naći”,
   * a ne „nema nijedne”; zato se i ispisuje kao nalaz, ne kao jamstvo.
   *
   * Stoji uz presudu, a ne među temama: ondje je 110 kV izgledao isto kao
   * okno telekoma i čitao se kao podatak, ne kao ograda.
   */
  zapreke: { vrsta: string; opis: string; izvor: string }[];
}

export interface Dosje {
  cestica: Record<string, unknown> | null;
  /** Namjena po planu na snazi. `null` ako točka nije ni u jednoj plohi. */
  namjena: Namjena | null;
  skupine: Skupina[];
  /** Slojevi koji su pretraženi — da se vidi da prazno znači „nema”. */
  pretrazeno: number;
}
