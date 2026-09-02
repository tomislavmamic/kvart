/**
 * Boje razina za karticu, legendu i traku — uzete iz iste ljestvice kao karta.
 *
 * Kartica kaže „osjetno”, karta pokaže narančasto; da to dvoje ne ode svako
 * svojim putem, boja riječi ne piše se rukom nego se **uzorkuje iz ljestvice**
 * na položaju koji riječ pokriva (`polozajGranice` u `situacija.ts`). Promijeni
 * li gledatelj ljestvicu (jantar → modra), promijene se i pločice uz riječi.
 *
 * Ljestvica je prozirna, a pločica stoji na bijelom, pa se boja složi preko
 * bijele — ista računica koju preglednik radi kad perjanicu crta preko
 * svijetle karte.
 */

import { ljestvicaBoja, type Ljestvica } from "@/lib/dim";
import { polozajGranice, type Razina } from "@/lib/sim/situacija";

/** Boja kojom se označava „nema”: neutralna, da ne liči ni na jednu razinu. */
const BOJA_NEMA = "rgb(212 212 216)";

/**
 * Predstavni položaj razine na ljestvici: sredina njezina pojasa.
 *
 * Args:
 *   razina: Razina u riječima.
 *
 * Returns:
 *   Položaj 0–1; `nema` daje 0.
 */
export function polozajRazine(razina: Razina): number {
  switch (razina) {
    case "nema":
      return 0;
    case "moguce":
      return (polozajGranice("moguce") + polozajGranice("slabo")) / 2;
    case "slabo":
      return (polozajGranice("slabo") + polozajGranice("osjetno")) / 2;
    case "osjetno":
      return (polozajGranice("osjetno") + polozajGranice("jako")) / 2;
    case "jako":
      return Math.min(1, polozajGranice("jako") + (polozajGranice("jako") - polozajGranice("osjetno")) / 2);
  }
}

/**
 * CSS boja pločice za razinu, složena preko bijele.
 *
 * Args:
 *   razina: Razina u riječima.
 *   ljestvica: Ljestvica boja tvari koja se gleda.
 *
 * Returns:
 *   `rgb(r g b)`.
 */
export function bojaRazine(razina: Razina, ljestvica: Ljestvica): string {
  if (razina === "nema") return BOJA_NEMA;
  const lut = ljestvicaBoja(ljestvica);
  const i = Math.round(polozajRazine(razina) * 255) * 4;
  const a = lut[i + 3] / 255;
  const preko = (k: number) => Math.round(lut[i + k] * a + 255 * (1 - a));
  return `rgb(${preko(0)} ${preko(1)} ${preko(2)})`;
}
