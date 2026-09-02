/**
 * Jedan komad vrtnje modela, u vlastitom procesu.
 *
 * Pokreće ga `pokreni.ts` s `node --import tsx`: čita komad ulaza iz
 * datoteke, vrti model i piše predikcije (i snimke) natrag na disk. Procesi,
 * a ne radne niti, jer je tako i tsx i put `@/` bez ikakve dodatne postave.
 *
 * Pokretanje (ne ručno): node --import tsx scripts/hindcast/model.komad.ts <ulaz.json> <izlaz.json>
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Postavke } from "@/lib/dim";

import { vrtiModel, type NacinLanca } from "./model";
import type { Prijemnik, SatUlaza } from "./tipovi";

type KomadUlaza = {
  sati: SatUlaza[];
  biljeziOd: string;
  prijemnici: Prijemnik[];
  postavke: Postavke;
  nacin: NacinLanca;
  uzoraka: number;
  /** Sati za koje se sprema slika; prazno znači nijedan. */
  snimke: string[];
  mapaSnimki: string;
};

const [ulazPut, izlazPut] = process.argv.slice(2);
const komad: KomadUlaza = JSON.parse(readFileSync(ulazPut, "utf8"));
const snimke = new Set(komad.snimke);
if (snimke.size) mkdirSync(komad.mapaSnimki, { recursive: true });

const pocetak = Date.now();
const predikcije = vrtiModel(komad.sati, komad.prijemnici, {
  postavke: komad.postavke,
  nacin: komad.nacin,
  uzoraka: komad.uzoraka,
  snimaj: (sat) => snimke.has(sat),
  naSnimku: (s) => {
    // Sirovi Float32 zapis; ime nosi sat, pa se snimka nađe bez kazala.
    const ime = s.sat.replace(/[:.]/g, "-");
    writeFileSync(join(komad.mapaSnimki, `${ime}.h2s.f32`), Buffer.from(s.gustoca.buffer));
    writeFileSync(join(komad.mapaSnimki, `${ime}.merk.f32`), Buffer.from(s.merkaptani.buffer));
  },
}).filter((p) => p.sat >= komad.biljeziOd);

mkdirSync(dirname(izlazPut), { recursive: true });
writeFileSync(izlazPut, JSON.stringify(predikcije));
process.stderr.write(
  `komad ${komad.biljeziOd}: ${komad.sati.length} sati u ${((Date.now() - pocetak) / 1000).toFixed(0)} s\n`,
);
