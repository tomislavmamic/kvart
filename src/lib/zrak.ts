/**
 * Sve što karti treba da pokaže kako zrak stoji **sada**, na jednom mjestu.
 *
 * Kartice na `/karepovac` i uvod na `/karepovac/zrak` traže isto: očitanja,
 * polje složeno prema njima i riječi koje uz to smiju stajati. Da svaka od
 * njih to slaže sama, prvi bi se popravak zaustavio na jednoj stranici, a
 * dvije bi karte istoga kvarta pokazivale dva različita vjetra.
 */

import { sastaviPolje, type SlozenoPolje, type StanjeZraka } from "@/lib/polje-dima";
import { stanjeSata, vrhSata } from "@/lib/sim/vrijeme-satno";
import { satniVjetar, type SatniVjetarISlojevi } from "@/lib/vjetar-sat";
import { izvediStrujnice, type Strujnice } from "@/lib/strujnice";
import { dohvatiZrak, type ZrakSada } from "@/lib/vjetar";
import { opisiZrak, type OpisZraka } from "@/lib/zrak-rijeci";

/**
 * Polje jednog sata zaleta, ogoljeno za prijenos u preglednik.
 *
 * Maska plohe ista je za sve sate, pa je nosi samo glavno polje; brzina
 * ostaje uz polje jer se po njoj bira korak (`planSata`).
 */
export type ZaletnoPolje = Omit<SlozenoPolje, "maska" | "azimut" | "najveca"> & {
  readonly brzina: number;
};

export type ZrakZaKartu = {
  readonly zrak: ZrakSada;
  readonly polje: SlozenoPolje;
  readonly opis: OpisZraka;
  readonly strujnice: Strujnice;
  /**
   * Polja prethodnih sati, najstariji prvi; smiju izostati.
   *
   * Perjanica na kartici grije se kroz **stvarne** prethodne sate — isto
   * pravilo kao u simulatoru na `/karepovac/sim` — a ne izmišljenim
   * ponavljanjem trenutačnog vjetra. Zrak koji sada visi nad kvartom digao
   * se s plohe prije sat-dva, pod tadašnjim vjetrom.
   */
  readonly zalet?: readonly ZaletnoPolje[];
};

/** Koliko prethodnih sati kartica grije; pokriva vidljivo pamćenje prikaza. */
export const SATI_ZALETA_KARTICE = 2;

/**
 * Stanja prethodnih punih sati, po istom pravilu kao u simulatoru.
 *
 * Izmjereni AZO niz vodi gdje god pokriva sat; model (Open-Meteo) popunjava
 * ostatak i uvijek daje dubinu sloja. Time kartica i simulator za isti sat
 * nose isti vjetar — dvije karte istoga kvarta ne smiju pokazivati dva.
 *
 * Args:
 *   sada: Trenutak prikaza.
 *   koliko: Broj prethodnih sati.
 *
 * Returns:
 *   Stanja po satu, najstariji prvi; prazno kad izvor ne odgovori.
 */
export function stanjaZaleta(
  vjetar: SatniVjetarISlojevi,
  sada: Date,
  koliko: number = SATI_ZALETA_KARTICE,
): StanjeZraka[] {
  const vrh = vrhSata(sada).getTime();
  const stanja: StanjeZraka[] = [];
  for (let k = koliko; k >= 1; k -= 1) {
    const sat = new Date(vrh - k * 3600_000).toISOString();
    const stanje = stanjeSata(vjetar.vjetrovi.get(sat), vjetar.dubine.get(sat));
    if (stanje) stanja.push(stanje);
  }
  return stanja;
}

/** Skida masku i natpise s polja zaleta; brzina ide uz njega radi koraka. */
function ogoli(stanje: StanjeZraka): ZaletnoPolje {
  const { maska: _maska, azimut: _a, najveca: _n, ...ostalo } = sastaviPolje(stanje);
  return { ...ostalo, brzina: stanje.brzina };
}

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
export function slozi(
  zrak: ZrakSada,
  zaletnaStanja: readonly StanjeZraka[] = [],
): ZrakZaKartu {
  const polje = sastaviPolje(zrak.stanje);
  return {
    zrak,
    polje,
    opis: opisiZrak(zrak),
    // Strujnice se crtaju i pri tišini: tada nose smjer koji bi vjetar imao
    // kad bi ga bilo, a kartica uz njih piše da ga nema.
    strujnice: izvediStrujnice(polje, zrak.stanje.smjerOd),
    zalet: zaletnaStanja.map(ogoli),
  };
}

/**
 * Dohvaća trenutačno stanje zraka i slaže ga za prikaz.
 *
 * Perjanicu vodi `satniVjetar` — isto pravilo kao simulator: izmjereni sat
 * gdje ga ima, opažanje gdje ga nema, model za ostalo, a promjenjiv smjer
 * nikad ne vodi. `dohvatiZrak` ostaje izvor za natpise (tko je javio, kada,
 * je li promjenjiv) i pričuva kad satni niz ne stigne. Rok na izmjereni niz
 * je tri sekunde: hladna predmemorija ne smije držati stranicu, a pozivi u
 * pozadini griju sljedeći prolaz.
 *
 * Returns:
 *   Očitanja, polje za simulaciju i natpisi uz kartu.
 */
export async function pripremiZrak(): Promise<ZrakZaKartu> {
  const sada = new Date();
  const [zrak, vjetar] = await Promise.all([
    dohvatiZrak(sada),
    satniVjetar(sada, 1, 1, 3000).catch(() => null),
  ]);
  if (!vjetar) return slozi(zrak);
  const satni = vjetar.vjetrovi.get(vrhSata(sada).toISOString());
  const stanje: StanjeZraka = satni
    ? {
        smjerOd: satni.smjerOd,
        brzina: satni.brzina,
        dubina: vjetar.dubine.get(vrhSata(sada).toISOString()) ?? zrak.stanje.dubina,
      }
    : zrak.stanje;
  return slozi({ ...zrak, stanje }, stanjaZaleta(vjetar, sada));
}
