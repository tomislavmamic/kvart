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
 * Stvarni kraj epizode: početak plus trajanje.
 *
 * Ne zaokružuje se ni na što. Koje sate epizoda pokriva odlučuje `satiDojave`
 * u `dojave.ts`, i to iz stvarnih trenutaka — jer epizoda od petnaest minuta
 * koja počne u 14.50 doista dotiče i sat 14 i sat 15, a ona koja počne u
 * 14.00 dotiče samo sat 14.
 *
 * @param pocetak Stvarni početak epizode, sa satom i minutom.
 * @param minuta Trajanje u minutama, ili `null` kad se ne zna.
 * @returns Kraj epizode ili `null` kad se trajanje ne zna.
 */
export function krajEpizode(pocetak: Date, minuta: number | null): Date | null {
  if (minuta === null || minuta <= 0) return null;
  return new Date(pocetak.getTime() + minuta * 60_000);
}
