/**
 * Radnik koji računa perjanicu, da glavna nit ostane na raspolaganju karti.
 *
 * Jedan sat traži oko sekundu i pol računa. Kad bi to išlo u glavnoj niti,
 * karta se ne bi dala pomaknuti dok se crta puni — a puni se desetak sekundi.
 *
 * Satovi su međusobno neovisni (vidi `simulacija.ts`: zalet pokriva vijek
 * čestice), pa ih se dade podijeliti na više radnika i računati bilo kojim
 * redom. Ovaj radnik dobije popis satova koji su njegovi, već poredan po
 * blizini onome što gledatelj gleda, i šalje svaku sliku čim je gotova.
 *
 * Gustoća se šalje prijenosom, ne kopiranjem: 200 × 200 brojeva po satu puta
 * 28 sati je 4,5 MB, a kopija bi značila da isto toliko stoji i u radniku i u
 * stranici.
 */

import { razloziOsnove, type Osnove } from "@/lib/sim/polje";
import { odradiSatove, zaSat, type SatSimulacije } from "@/lib/sim/simulacija";

export type ZadatakRacunala = {
  readonly vrsta: "racunaj";
  /** Osnove polja vjetra; šalju se jednom, pri prvom zadatku. */
  readonly osnove: ArrayBuffer | null;
  /** Svi satovi kojima raspolažemo, redom, uključujući zalet crte. */
  readonly svi: readonly SatSimulacije[];
  /** Satovi koje baš ovaj radnik treba izračunati, poredani po važnosti. */
  readonly moji: readonly string[];
};

export type OdgovorRacunala =
  | {
      readonly vrsta: "kadar";
      readonly sat: string;
      readonly sirina: number;
      readonly visina: number;
      readonly gustoca: Float32Array;
    }
  | { readonly vrsta: "gotovo" }
  | { readonly vrsta: "greska"; readonly poruka: string };

/** Osnove se pamte između zadataka; 1,4 MB ne treba slati za svaki pomak crte. */
let osnove: Osnove | null = null;

self.onmessage = (dogadaj: MessageEvent<ZadatakRacunala>) => {
  const zadatak = dogadaj.data;
  if (zadatak.vrsta !== "racunaj") return;

  try {
    if (zadatak.osnove) osnove = razloziOsnove(zadatak.osnove);
    if (!osnove) throw new Error("Osnove polja nisu stigle");

    for (const sat of zadatak.moji) {
      const satovi = zaSat(zadatak.svi, sat);
      if (!satovi.length) continue;
      const slika = odradiSatove(satovi, osnove);
      const odgovor: OdgovorRacunala = {
        vrsta: "kadar",
        sat: slika.sat,
        sirina: slika.sirina,
        visina: slika.visina,
        gustoca: slika.gustoca,
      };
      // Prijenos, ne kopija: spremnik nakon ovoga pripada stranici.
      self.postMessage(odgovor, { transfer: [slika.gustoca.buffer] });
    }
    self.postMessage({ vrsta: "gotovo" } satisfies OdgovorRacunala);
  } catch (greska) {
    self.postMessage({
      vrsta: "greska",
      poruka: greska instanceof Error ? greska.message : String(greska),
    } satisfies OdgovorRacunala);
  }
};
