/**
 * Sve što karti treba da pokaže kako zrak stoji **sada**, na jednom mjestu.
 *
 * Kartice na `/karepovac` i uvod na `/karepovac/zrak` traže isto: očitanja,
 * polje složeno prema njima i riječi koje uz to smiju stajati. Da svaka od
 * njih to slaže sama, prvi bi se popravak zaustavio na jednoj stranici, a
 * dvije bi karte istoga kvarta pokazivale dva različita vjetra.
 */

import { sastaviPolje, type SlozenoPolje } from "@/lib/polje-dima";
import { izvediStrujnice, type Strujnice } from "@/lib/strujnice";
import { dohvatiZrak, type ZrakSada } from "@/lib/vjetar";
import { opisiZrak, type OpisZraka } from "@/lib/zrak-rijeci";

export type ZrakZaKartu = {
  readonly zrak: ZrakSada;
  readonly polje: SlozenoPolje;
  readonly opis: OpisZraka;
  readonly strujnice: Strujnice;
};

/**
 * Slaže polje i natpise za već poznato stanje zraka.
 *
 * Odvojeno od dohvata da se svako stanje — tišina, promjenjiv vjetar, izvor
 * koji šuti — dade nacrtati u provjeri, bez mreže.
 *
 * Args:
 *   zrak: Očitanja iz `dohvatiZrak`.
 *
 * Returns:
 *   Očitanja, polje za simulaciju i natpisi uz kartu.
 */
export function slozi(zrak: ZrakSada): ZrakZaKartu {
  const polje = sastaviPolje(zrak.stanje);
  return {
    zrak,
    polje,
    opis: opisiZrak(zrak),
    // Strujnice se crtaju i pri tišini: tada nose smjer koji bi vjetar imao
    // kad bi ga bilo, a kartica uz njih piše da ga nema.
    strujnice: izvediStrujnice(polje, zrak.stanje.smjerOd),
  };
}

/**
 * Dohvaća trenutačno stanje zraka i slaže ga za prikaz.
 *
 * Returns:
 *   Očitanja, polje za simulaciju i natpisi uz kartu.
 */
export async function pripremiZrak(): Promise<ZrakZaKartu> {
  return slozi(await dohvatiZrak());
}
