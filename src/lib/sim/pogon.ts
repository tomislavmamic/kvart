/**
 * Pogon koji drži radnike i skuplja izračunate satove.
 *
 * Posao je podijeljen na onoliko radnika koliko preglednik prijavi jezgara,
 * najviše četiri. Više od toga ne ubrzava jer je svaki radnik ionako zauzet
 * cijelo vrijeme, a svaki nosi svoju kopiju osnova (1,4 MB).
 *
 * Podjela nije po redu nego naizmjence po **važnosti**: satovi se najprije
 * poredaju od onoga koji gledatelj gleda prema van, pa se tako poredani dijele
 * radnicima. Time prvi sat koji stigne uvijek bude onaj koji netko čeka, a ne
 * onaj koji je slučajno prvi u nizu.
 *
 * Pogon ne zna ništa o karti ni o bojama: prima satove, vraća gustoće.
 */

import type {
  OdgovorRacunala,
  ZadatakRacunala,
} from "@/lib/sim/racunalo.worker";
import { redoslijed, type SatSimulacije } from "@/lib/sim/simulacija";

/** Više od ovoga ne ubrzava, a svaki radnik nosi svoju kopiju osnova. */
const NAJVISE_RADNIKA = 4;

export type Kadrovi = ReadonlyMap<string, Float32Array>;

export type StanjePogona = {
  /** Koliko je satova izračunato. */
  readonly gotovo: number;
  /** Koliko ih se ukupno traži. */
  readonly ukupno: number;
  readonly greska: string | null;
};

export type Pogon = {
  /** Traži satove; već izračunati se ne računaju ponovno. */
  trazi(odabrani: string): void;
  ugasi(): void;
};

export type PogonPostavke = {
  readonly osnove: ArrayBuffer;
  readonly svi: readonly SatSimulacije[];
  /** Satovi koje crta prikazuje; zalet nije među njima. */
  readonly crta: readonly string[];
  onKadar(sat: string, sirina: number, visina: number, gustoca: Float32Array): void;
  onStanje(stanje: StanjePogona): void;
};

/**
 * Pokreće radnike i dijeli im posao.
 *
 * Args:
 *   postavke: Osnove, satovi i povratni pozivi.
 *
 * Returns:
 *   Pogon koji se dade pretražiti i ugasiti.
 */
export function pokreniPogon(postavke: PogonPostavke): Pogon {
  const koliko = Math.max(
    1,
    Math.min(NAJVISE_RADNIKA, (navigator.hardwareConcurrency || 2) - 1),
  );
  const radnici: Worker[] = [];
  const izracunati = new Set<string>();
  // Zatraženo, ne izračunato: radnik posao obrađuje redom, pa bi ponovni
  // zahtjev za satom koji mu već stoji u redu značio da ga računa dvaput.
  const zatrazeni = new Set<string>();
  let ugasen = false;
  let greska: string | null = null;

  function javiStanje(): void {
    postavke.onStanje({
      gotovo: izracunati.size,
      ukupno: postavke.crta.length,
      greska,
    });
  }

  for (let i = 0; i < koliko; i += 1) {
    const radnik = new Worker(new URL("./racunalo.worker.ts", import.meta.url), {
      type: "module",
      name: `karepovac-sim-${i}`,
    });
    radnik.onmessage = (dogadaj: MessageEvent<OdgovorRacunala>) => {
      if (ugasen) return;
      const poruka = dogadaj.data;
      if (poruka.vrsta === "kadar") {
        izracunati.add(poruka.sat);
        postavke.onKadar(poruka.sat, poruka.sirina, poruka.visina, poruka.gustoca);
        javiStanje();
      } else if (poruka.vrsta === "greska") {
        greska = poruka.poruka;
        javiStanje();
      }
    };
    radnik.onerror = () => {
      if (ugasen) return;
      greska = "Račun perjanice nije uspio";
      javiStanje();
    };
    radnici.push(radnik);
  }

  /** Osnove se šalju svakom radniku jednom; poslije ih on pamti. */
  const poslano = new Set<Worker>();

  function trazi(odabrani: string): void {
    if (ugasen) return;
    const preostali = redoslijed(postavke.crta, odabrani).filter(
      (sat) => !zatrazeni.has(sat),
    );
    if (!preostali.length) {
      javiStanje();
      return;
    }

    // Naizmjenična podjela čuva poredak po važnosti: prvi radnik dobiva
    // najvažniji sat, drugi sljedeći, i tako redom.
    const hrpe: string[][] = radnici.map(() => []);
    preostali.forEach((sat, i) => hrpe[i % radnici.length].push(sat));

    radnici.forEach((radnik, i) => {
      if (!hrpe[i].length) return;
      const prvi = !poslano.has(radnik);
      const zadatak: ZadatakRacunala = {
        vrsta: "racunaj",
        // Osnove se šalju kao kopija: prijenos bi ih oduzeo ostalim radnicima.
        osnove: prvi ? postavke.osnove.slice(0) : null,
        svi: postavke.svi,
        moji: hrpe[i],
      };
      poslano.add(radnik);
      for (const sat of hrpe[i]) zatrazeni.add(sat);
      radnik.postMessage(zadatak);
    });
    javiStanje();
  }

  return {
    trazi,
    ugasi: () => {
      ugasen = true;
      for (const radnik of radnici) radnik.terminate();
      radnici.length = 0;
    },
  };
}
