import status from "../../../../docs/STATUS.json";

/**
 * Brojke iz zadnje provjere modela na dojavama — za rečenicu koja
 * dojavitelju kaže čemu dojava služi.
 *
 * Čitaju se iz `docs/STATUS.json` pri gradnji, nikad iz koda: brojka koja
 * bi stajala u kodu prestala bi biti istinita prvom sljedećom provjerom,
 * a nitko je ne bi primijetio. Kad datoteka nema ocjenu proizvodnog modela
 * na dojavama, rečenice nema — ne izmišlja se.
 */

export type BrojkeProvjere = {
  /** Koliko je satnih opažanja iz dojava ušlo u provjeru. */
  n: number;
  /** Koliko je dojava „smrdi” model pogodio (0–1). */
  pod: number;
  /** Koliko je sati u kojima je model tvrdio miris ostalo bez dojave (0–1). */
  far: number;
  /** Kad je provjera napravljena, ISO 8601. */
  azurirano: string;
};

type Pokus = {
  id?: string;
  nacin?: string;
  ocjene?: { uloga?: string; h2s?: { dojave?: unknown } }[];
};

function jeBroj(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Vadi ocjenu proizvodnog modela („polazno”, uloga „sve”) na dojavama.
 *
 * @param izvor Sadržaj `STATUS.json`; zadano stvarna datoteka.
 * @returns Brojke, ili `null` kad ih u datoteci nema u očekivanom obliku.
 */
export function brojkeProvjere(izvor: unknown = status): BrojkeProvjere | null {
  if (!izvor || typeof izvor !== "object") return null;
  const s = izvor as { azurirano?: unknown; pokusi?: unknown };
  const pokusi = Array.isArray(s.pokusi) ? (s.pokusi as Pokus[]) : [];
  const polazno =
    pokusi.find((p) => p.id === "polazno" && p.nacin === "proizvodnja") ?? null;
  const sve = polazno?.ocjene?.find((o) => o.uloga === "sve");
  const dojave = sve?.h2s?.dojave;
  if (!dojave || typeof dojave !== "object") return null;
  const d = dojave as { n?: unknown; POD?: unknown; FAR?: unknown };
  if (!jeBroj(d.n) || !jeBroj(d.POD) || !jeBroj(d.FAR) || d.n <= 0) return null;
  if (typeof s.azurirano !== "string") return null;
  return { n: d.n, pod: d.POD, far: d.FAR, azurirano: s.azurirano };
}

/** Postotak kao hrvatski zapis, npr. 0,556 → „56 %”. */
export function postotak(udio: number): string {
  return `${Math.round(udio * 100)} %`;
}
