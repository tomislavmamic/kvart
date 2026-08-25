/**
 * Koliko je epizoda mirisa trajala — i zašto se to pita zasebno.
 *
 * Epizode su često kratke: petnaestak minuta, dok vjetar ne okrene. Sat je
 * ipak najsitnija jedinica s kojom se dojava može spojiti s vjetrom, jer se
 * vjetar mjeri po satu. Iz toga slijedi podjela koju obrazac mora održati:
 *
 * - **Sat s mirisom ostaje sat s mirisom**, ma koliko epizoda kratko trajala.
 *   To je jedinica koju ruža broji i po kojoj je usporediva s terenskom
 *   metodom; skraćivati je razmjerno trajanju značilo bi izmisliti mjeru.
 * - **Trajanje se pamti uz to.** Bez njega bi petnaest minuta i puni sat bili
 *   isti zapis, a upravo tu razliku ljudi osjete.
 *
 * Ponuđeni izbori su grubi namjerno: nitko ne zna je li smrdjelo 12 ili 18
 * minuta, a lažna preciznost bila bi gora od grube istine.
 */

/** Vrijednost koju obrazac šalje kad miris u trenutku javljanja još traje. */
export const JOS_TRAJE = "traje";

export type IzborTrajanja = {
  /** Vrijednost u obrascu; minute kao broj ili `traje`. */
  vrijednost: number | typeof JOS_TRAJE | "";
  natpis: string;
};

/**
 * Ponuđena trajanja, od „ne znam” prema duljem.
 *
 * Minute su predstavnici razreda, ne mjerenja: „oko pola sata” sprema 30.
 */
export const TRAJANJA: readonly IzborTrajanja[] = [
  { vrijednost: "", natpis: "Ne znam" },
  { vrijednost: 15, natpis: "Do 15 minuta" },
  { vrijednost: 30, natpis: "Oko pola sata" },
  { vrijednost: 60, natpis: "Oko sat vremena" },
  { vrijednost: 180, natpis: "Nekoliko sati" },
  { vrijednost: JOS_TRAJE, natpis: "Još traje" },
];

/** Minute koje obrazac smije poslati; sve ostalo poslužitelj odbacuje. */
export const DOPUSTENE_MINUTE = TRAJANJA.map((t) => t.vrijednost).filter(
  (v): v is number => typeof v === "number",
);

/**
 * Kraj epizode za zadano trajanje, zaokružen na puni sat.
 *
 * Epizoda kraća od sata ne dobiva kraj: ona je jedan sat s mirisom, i taj
 * jedan sat već nosi `occurredAt`. Dulja se razlije na onoliko sati koliko
 * doista pokriva, jer se vjetar u međuvremenu mogao okrenuti.
 *
 * @param pocetak Početak epizode, zaokružen na puni sat.
 * @param minuta Trajanje u minutama, ili `null` kad se ne zna.
 * @returns Kraj epizode ili `null` kad dojava pokriva jedan sat.
 */
export function krajEpizode(pocetak: Date, minuta: number | null): Date | null {
  if (minuta === null || minuta <= 60) return null;
  const sati = Math.floor((minuta - 1) / 60);
  return new Date(pocetak.getTime() + sati * 3_600_000);
}
