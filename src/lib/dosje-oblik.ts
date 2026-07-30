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

export interface Dosje {
  cestica: Record<string, unknown> | null;
  skupine: Skupina[];
  /** Slojevi koji su pretraženi — da se vidi da prazno znači „nema”. */
  pretrazeno: number;
}
