/**
 * Računanje perjanice sat po sat, za vremensku crtu simulatora.
 *
 * Model je isti onaj koji `/karepovac/zrak` crta uživo (`src/lib/dim.ts`):
 * čestice s plohe nosi polje vjetra, izvor curi neprekidno, težina im pada
 * prorjeđivanjem. Ovdje se samo vrti brže od stvarnog vremena i zaustavlja na
 * svakom punom satu, da se gustoća uhvati kao slika.
 *
 * ## Zašto svaki sat stoji sam za sebe
 *
 * Prva zamisao bila je jedan neprekinut lanac: odraditi zalet, pa 24 sata
 * unatrag, pa sadašnji, pa prognozu — jer zrak s plohe doista pamti gdje je
 * bio. Lanac je točan, ali ima lošu osobinu: sat koji gledatelj traži prvi
 * (sadašnji) računa se posljednji, pa bi karta stajala prazna dok ne prođe
 * cijela crta.
 *
 * Ispalo je da lanac nije ni potreban. Čestica u modelu živi najviše `vijek`
 * sekundi prikaza, a to je pri zadanom ubrzanju oko 2,7 stvarnih sati. Zrak
 * koji je s plohe otišao prije toga u modelu više ne postoji ni u kakvu
 * obliku. Zato zalet od **tri sata** nije približak nego dovoljno: sve što bi
 * dulji lanac donio već je odumrlo.
 *
 * Posljedica je da se satovi mogu računati bilo kojim redom, pa se računaju
 * onim koji gledatelju treba: prvo odabrani, pa oko njega. I da je račun
 * ponovljiv — isti sat daje istu sliku, bez obzira na to kada je zatražen.
 *
 * ## Zašto korak nije stalan
 *
 * Pri slabom vjetru čestica u jednom koraku prijeđe metar-dva, pri buri
 * stotine metara. Sa stalnim korakom bi jak vjetar preskakao ćelije polja i
 * zrak bi išao ravno kroz padinu umjesto oko nje — skretanje oko reljefa je
 * jedino zbog čega ovaj model uopće postoji. Zato se korak veže uz brzinu:
 * čestica po koraku ne smije prijeći više od nekoliko ćelija polja.
 */

import {
  stvoriDimSirovo,
  UBRZANJE,
  type Postavke,
  type Simulacija,
} from "@/lib/dim";
import type { StanjeZraka } from "@/lib/polje-dima";
import { slozi, type Osnove } from "@/lib/sim/polje";

/**
 * Koliko sati prije traženoga simulacija odradi da polje bude puno.
 *
 * Mora biti veće od `vijek` u sekundama prikaza pretvorenog u stvarne sate
 * (160 s prikaza ÷ 60 = 2,7 h). Tri sata su prvi cijeli broj iznad toga;
 * `zaletPokrivaVijek` u provjeri pazi da ta veza ostane.
 */
export const ZALET_SATI = 3;

/** Sekundi prikaza u jednom stvarnom satu, pri zadanom ubrzanju. */
export const SEKUNDI_PO_SATU = 3600 / UBRZANJE;

/**
 * Najviše ćelija polja koliko čestica smije prijeći u jednom koraku.
 *
 * Jedna ćelija bila bi vjernija, ali udvostručuje račun bez razlike koja se na
 * karti vidi: polje se između susjednih ćelija mijenja glatko, jer izlazi iz
 * rješenja jednadžbe kontinuiteta, a ne iz mjerenja po točkama.
 */
const CELIJA_PO_KORAKU = 2;

/** Granice koraka: gore da prizor ne postane skokovit, dolje da račun stane. */
const KORAK = { najmanji: 0.1, najveci: 0.5 } as const;

/** Postavke prikaza koje simulator mijenja u odnosu na zadane. */
export const POSTAVKE_SIMULATORA: Postavke = {
  /**
   * Manje čestica nego uživo: ovdje ih treba izračunati 28 puta, ne jednom.
   *
   * Čestica nosi masu obrnuto razmjernu njihovu broju, pa je perjanica jednako
   * tamna — samo zrnatija. Zamućenje na kraju taj trag pokupi.
   */
  cestica: 10_000,
  /** Rešetka gustoće; na okviru od 6,4 km to je ćelija od 32 m. */
  sirina: 200,
};

/**
 * Korak simulacije za zadanu brzinu vjetra.
 *
 * Args:
 *   brzina: Brzina vjetra na otvorenom, u m/s.
 *   celijaM: Veličina ćelije polja u metrima.
 *
 * Returns:
 *   Korak u sekundama prikaza.
 */
export function korakZaBrzinu(brzina: number, celijaM: number): number {
  if (!(brzina > 0)) return KORAK.najveci;
  const dopusteno = (CELIJA_PO_KORAKU * celijaM) / (brzina * UBRZANJE);
  return Math.min(KORAK.najveci, Math.max(KORAK.najmanji, dopusteno));
}

/** Jedan sat crte, sveden na ono što simulacija treba. */
export type SatSimulacije = {
  readonly sat: string;
  readonly stanje: StanjeZraka;
};

export type Slika = {
  readonly sat: string;
  readonly sirina: number;
  readonly visina: number;
  /** Gustoća po ćeliji, u jedinicama `Simulacija.crtaj`. */
  readonly gustoca: Float32Array;
};

/**
 * Vrti simulaciju kroz zadane satove i vraća gustoću na kraju posljednjega.
 *
 * Args:
 *   satovi: Satovi redom; posljednji je onaj koji se traži, prije njega je zalet.
 *   osnove: Osnove polja vjetra.
 *   postavke: Postavke prikaza; zadano su one simulatora.
 *
 * Returns:
 *   Slika gustoće za posljednji sat.
 *
 * Raises:
 *   Error: Ako niz satova nema nijedan član.
 */
export function odradiSatove(
  satovi: readonly SatSimulacije[],
  osnove: Osnove,
  postavke: Postavke = POSTAVKE_SIMULATORA,
): Slika {
  if (!satovi.length) throw new Error("Nema sata za računanje");
  const celijaM = osnove.sirinaM / osnove.gw;
  const par: Postavke = {
    ...postavke,
    metaraX: osnove.sirinaM,
    metaraY: osnove.visinaM,
  };

  let sim: Simulacija | null = null;
  for (const { stanje } of satovi) {
    const polje = slozi(stanje, osnove);
    if (sim === null) sim = stvoriDimSirovo(polje, par);
    // Čestice ostaju gdje jesu; mijenja se samo vjetar koji ih nosi. To je
    // ono zbog čega zrak s prošlog sata još visi nad kvartom u ovome.
    else sim.postaviPolje(polje);

    const dt = korakZaBrzinu(stanje.brzina, celijaM);
    const koraka = Math.max(1, Math.round(SEKUNDI_PO_SATU / dt));
    // Korak se poravnava na cijeli broj koraka po satu, da sat traje točno sat.
    const stvarni = SEKUNDI_PO_SATU / koraka;
    for (let i = 0; i < koraka; i += 1) sim.korak(stvarni);
  }

  const gotov = sim as Simulacija;
  return {
    sat: satovi[satovi.length - 1].sat,
    sirina: gotov.sirina,
    visina: gotov.visina,
    // `crtaj` vraća svoj unutarnji spremnik, koji sljedeći poziv prepisuje.
    // Slika mora preživjeti idući sat, pa se kopira.
    gustoca: Float32Array.from(gotov.crtaj()),
  };
}

/**
 * Bira satove koje treba odraditi da bi zadani sat bio točan.
 *
 * Args:
 *   svi: Svi satovi kojima raspolažemo, redom; uključuje i zalet crte.
 *   kojiSat: Sat koji se traži.
 *
 * Returns:
 *   Zalet i traženi sat, redom; prazno ako sata nema ili nema stanja.
 */
export function zaSat(
  svi: readonly SatSimulacije[],
  kojiSat: string,
): SatSimulacije[] {
  const kraj = svi.findIndex((s) => s.sat === kojiSat);
  if (kraj < 0) return [];
  return svi.slice(Math.max(0, kraj - ZALET_SATI), kraj + 1);
}

/**
 * Redoslijed računanja: od odabranog sata prema van.
 *
 * Gledatelj čeka onaj sat koji je odabrao, a zatim najvjerojatnije pomiče
 * klizač za jedan-dva u stranu. Računati crtu od kraja prema početku značilo bi
 * da prvo stiže ono što nitko ne gleda.
 *
 * Args:
 *   satovi: Satovi crte, redom.
 *   odabrani: Sat od kojega se kreće.
 *
 * Returns:
 *   Satovi poredani po tome koliko su blizu odabranome.
 */
export function redoslijed(
  satovi: readonly string[],
  odabrani: string,
): string[] {
  const sredina = satovi.indexOf(odabrani);
  if (sredina < 0) return [...satovi];
  return [...satovi].sort(
    (a, b) =>
      Math.abs(satovi.indexOf(a) - sredina) - Math.abs(satovi.indexOf(b) - sredina),
  );
}
