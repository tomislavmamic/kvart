/**
 * Razmak svjetlećih poteza po strujnicama.
 *
 * Potez putuje po **vremenu putovanja zraka**, pa mu je brzina uvijek brzina
 * vjetra — pri buri juri, pri tišini se jedva miče. To je jedino što ta
 * animacija tvrdi i ne dira se.
 *
 * Razmak je druga stvar. Zadan vremenom, on se pri slabom vjetru stisne: na
 * 0,5 m/s zrak u 110 s prijeđe 67 m, dakle jedanaest piksela, pa se potezi
 * slijepe u točkastu crtu koja titra umjesto da teče — i to baš pri tišini,
 * kad se najviše i namiriše. Zato se razmak zadaje putem, a vrijeme se za
 * njega izračuna iz brzine.
 *
 * Odvojeno od `sim-scena.ts` jer se ondje uvoze Three i MapLibre, pa se ta
 * datoteka ne dade učitati u provjeri.
 */

/** Koliko metara razmaka između poteza; na okviru od 6,4 km to je ~97 px. */
export const RAZMAK_POTEZA_M = 620;

/** Granice razmaka u sekundama; drže uzorak čitljiv i pri buri i pri tišini. */
export const RAZMAK_S = { najmanji: 45, najveci: 1400 } as const;

/**
 * Razmak između poteza, u sekundama putovanja, za zadanu srednju brzinu.
 *
 * Args:
 *   srednjaBrzina: Srednja brzina polja u m/s.
 *
 * Returns:
 *   Razmak u sekundama; pri tišini se zaustavlja na gornjoj granici, jer bi
 *   inače narastao u beskonačno i na karti ne bi ostao nijedan potez.
 */
export function razmakPoteza(srednjaBrzina: number): number {
  const v = Math.max(0.05, srednjaBrzina);
  return Math.min(RAZMAK_S.najveci, Math.max(RAZMAK_S.najmanji, RAZMAK_POTEZA_M / v));
}
