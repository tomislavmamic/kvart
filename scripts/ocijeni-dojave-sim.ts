/**
 * Vrti simulator (isti pogon kao `/karepovac/sim` i `ocijeni-sim.ts`) kroz
 * sate oko dojava i bilježi gustoću na mjestima s kojih su ljudi javljali.
 *
 * Za razliku od bazdarenja, koje ima jedan prijemnik s krive strane plohe,
 * ovdje prijemnici stoje ondje gdje ljudi žive — pa se prvi put vidi
 * što model tvrdi za sate u kojima je netko rekao „smrdi” ili „ne smrdi”.
 *
 * Pokretanje: npx tsx scripts/ocijeni-dojave-sim.ts <sati.json> <izlaz.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { stvoriDimSirovo, type Postavke, type SirovoPolje } from "@/lib/dim";
import type { StanjeZraka } from "@/lib/polje-dima";
import { razloziOsnove, slozi } from "@/lib/sim/polje";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import {
  korakZaBrzinu,
  POSTAVKE_SIMULATORA,
  SEKUNDI_PO_SATU,
  ZALET_SATI,
} from "@/lib/sim/simulacija";

const [satiPut, izlazPut] = process.argv.slice(2);

const PRIJEMNICI = [
  { ime: "dracevac7b", lat: 43.527789, lon: 16.50401 },
  { ime: "matoseva", lat: 43.5312, lon: 16.4995 },
  { ime: "zvonimirova", lat: 43.536, lon: 16.49 },
] as const;

const sviSati: Record<string, StanjeZraka> = JSON.parse(
  readFileSync(satiPut, "utf8"),
);

const bin = readFileSync(join(process.cwd(), "public", SIM_POLJE.bajtovi));
const osnove = razloziOsnove(
  bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
);

const sati = Object.keys(sviSati).sort();
const granice = osnove.granice;
const par: Postavke = {
  ...POSTAVKE_SIMULATORA,
  metaraX: osnove.sirinaM,
  metaraY: osnove.visinaM,
};

/** Prosjek gustoće 3×3 oko prijemnika, kao `ocijeni-sim.ts` za k1. */
function ocitaj(sim: { crtaj(): Float32Array | number[]; sirina: number; visina: number }) {
  const g = sim.crtaj();
  const izlaz: Record<string, number> = {};
  for (const p of PRIJEMNICI) {
    const i0 = Math.round(
      ((p.lon - granice.zapad) / (granice.istok - granice.zapad)) * sim.sirina,
    );
    const j0 = Math.round(
      ((granice.sjever - p.lat) / (granice.sjever - granice.jug)) * sim.visina,
    );
    let zbroj = 0;
    let n = 0;
    for (let dj = -1; dj <= 1; dj += 1) {
      for (let di = -1; di <= 1; di += 1) {
        const i = i0 + di;
        const j = j0 + dj;
        if (i < 0 || i >= sim.sirina || j < 0 || j >= sim.visina) continue;
        zbroj += g[j * sim.sirina + i];
        n += 1;
      }
    }
    izlaz[p.ime] = n ? zbroj / n : 0;
  }
  return izlaz;
}

const celijaM = osnove.sirinaM / osnove.gw;
const niz: Record<string, Record<string, number>> = {};
let sim: ReturnType<typeof stvoriDimSirovo> | null = null;
let prosli = "";
let zagrijano = 0;
const pocetak = Date.now();

function satPlusJedan(t: string): string {
  return new Date(Date.parse(t) + 3600_000)
    .toISOString()
    .replace(/:00:00\.000Z$/, ":00Z");
}

for (const t of sati) {
  const stanje = sviSati[t];
  const polje: SirovoPolje = slozi(stanje, osnove);
  const hladno = sim === null || prosli === "" || satPlusJedan(prosli) !== t;
  if (sim === null) {
    sim = stvoriDimSirovo(polje, { ...par, pocetakMs: Date.parse(t) });
  } else sim.postaviPolje(polje);
  sim.postavi("krajMs", Date.parse(t) + 3600_000);
  if (hladno) zagrijano = 0;

  const dt = korakZaBrzinu(stanje.brzina, celijaM);
  const koraka = Math.max(1, Math.round(SEKUNDI_PO_SATU / dt));
  const stvarni = SEKUNDI_PO_SATU / koraka;
  for (let i = 0; i < koraka; i += 1) sim.korak(stvarni);

  zagrijano += 1;
  if (zagrijano > ZALET_SATI) niz[t] = ocitaj(sim);
  prosli = t;
}

writeFileSync(izlazPut, JSON.stringify(niz, null, 1));
console.error(
  `${Object.keys(niz).length} sati u ${((Date.now() - pocetak) / 1000).toFixed(0)} s`,
);
