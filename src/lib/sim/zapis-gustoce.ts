/**
 * Zapis gustoće za grafičku karticu, i zašto je logaritamski.
 *
 * Perjanica se u pregledniku računa kao gustoća po ćeliji — obična brojka s
 * pomičnim zarezom. Da bi je kartica mogla obojiti, mora doći kao tekstura.
 *
 * Prva zamisao bila je poslati brojke kakve jesu (`R32F`) i sav račun ostaviti
 * sjenčaru. Radilo bi, ali bi za svaku promjenu jačine izvora trebalo iznova
 * proći kroz 40 000 ćelija.
 *
 * Ljestvica je ionako logaritamska, a to daje nešto bolje. U logaritmu je
 * množenje zbrajanje:
 *
 *     razina(g · m) = razina(g) + log₁₀(m) / raspon
 *
 * Dakle jačina izvora ne mijenja teksturu nego je **pomiče**. Isto vrijedi i
 * za razliku među tvarima: merkaptani se osjete pri manjoj količini, pa je i
 * to samo drugi pomak iste ljestvice.
 *
 * Zato ovdje ide jedna jedina tekstura po satu, bez pojma o tvari i jačini, a
 * kartica na nju dodaje dva broja. Promjena klizača tada ne košta ništa.
 *
 * Prozor zapisa je šest redova veličine oko sidra. Uži bi odrezao rub
 * perjanice koji se pri jačem izvoru mora moći podići natrag u vidljivo;
 * širi bi trošio korake bajta na zrak kojega nema.
 */

/** Koliko redova veličine ispod i iznad sidra zapis pokriva. */
export const PROZOR = { od: -3, do: 3 } as const;

const SIRINA_PROZORA = PROZOR.do - PROZOR.od;

/**
 * Pretvara gustoću u bajt.
 *
 * Args:
 *   g: Gustoća iz `Simulacija.crtaj`.
 *   sidro: Gustoća koja odgovara medijanu izmjerenom uz plohu.
 *
 * Returns:
 *   Bajt 0–255; nula znači „ispod prozora”, dakle ništa.
 */
export function uBajt(g: number, sidro: number): number {
  if (!(g > 0)) return 0;
  const red = Math.log10(g / sidro);
  const v = (red - PROZOR.od) / SIRINA_PROZORA;
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  return Math.round(v * 255);
}

/**
 * Zapisuje cijelu sliku gustoće u bajtove.
 *
 * Args:
 *   gustoca: Gustoća po ćeliji.
 *   sidro: Gustoća koja odgovara medijanu izmjerenom uz plohu.
 *
 * Returns:
 *   Bajtovi iste duljine, spremni za teksturu.
 */
export function zapisiGustocu(
  gustoca: Float32Array,
  sidro: number,
): Uint8Array {
  const izlaz = new Uint8Array(gustoca.length);
  for (let i = 0; i < gustoca.length; i += 1) izlaz[i] = uBajt(gustoca[i], sidro);
  return izlaz;
}

/**
 * Vraća bajt natrag u gustoću; za provjeru i za čitanje vrijednosti pod mišem.
 *
 * Args:
 *   b: Bajt iz `uBajt`.
 *   sidro: Isto sidro kojim je zapisano.
 *
 * Returns:
 *   Gustoća; nula za bajt nula.
 */
export function izBajta(b: number, sidro: number): number {
  if (b <= 0) return 0;
  return sidro * 10 ** ((b / 255) * SIRINA_PROZORA + PROZOR.od);
}
