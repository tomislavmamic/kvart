/**
 * Vrti simulator (isti pogon kao `/karepovac/sim`) kroz povijesne sate i
 * bilježi gustoću na mjestu postaje Karepovac 1.
 *
 * Zapis izlazi kao JSON niz {sat: gustoća}, koji se zatim uspoređuje s
 * izmjerenim H₂S-om (`scripts/ocijeni-sim.py`). Jedinice gustoće su
 * proizvoljne (one iz `Simulacija.crtaj`), ali Spearman i AUC rangiraju,
 * pa mjerilo ne ulazi u ocjenu.
 *
 * Lanac je isti kao na stranici: polje se mijenja svaki sat
 * (`postaviPolje`), čestice ostaju gdje jesu. Rupa u nizu dulja od zaleta
 * znači hladan start: sati poslije nje se odrade, ali se prva tri ne
 * bilježe — kao ni zalet na stranici.
 *
 * Pokretanje:
 *   npx tsx scripts/ocijeni-sim.ts <sati.json> <od> <do> <izlaz.json> [postavke.json]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  raspakirajPolje,
  stvoriDimSirovo,
  type Postavke,
  type Simulacija,
  type SirovoPolje,
} from "@/lib/dim";
import { sastaviPolje, type StanjeZraka } from "@/lib/polje-dima";
import { razloziOsnove, slozi } from "@/lib/sim/polje";
import { OKVIR } from "@/generated/karepovac-karta";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import { SIM_POSTAJE } from "@/lib/sim/postaje-satno";
import {
  korakZaBrzinu,
  POSTAVKE_SIMULATORA,
  SEKUNDI_PO_SATU,
  ZALET_SATI,
} from "@/lib/sim/simulacija";

const [satiPut, od, dodan, izlazPut, postavkePut] = process.argv.slice(2);
if (!izlazPut) {
  console.error("ocijeni-sim.ts <sati.json> <od> <do> <izlaz.json> [postavke.json]");
  process.exit(1);
}

const sviSati: Record<string, StanjeZraka> = JSON.parse(
  readFileSync(satiPut, "utf8"),
);
const dodatne: Postavke = postavkePut
  ? JSON.parse(readFileSync(postavkePut, "utf8"))
  : {};

// OKVIR=zrak vrti isti lanac na užem okviru kartice (`OSNOVE_DIMA`), gdje
// postaja ne stane u okvir — ondje se bilježi samo gustoća nad plohom, za
// prijenos sidra ljestvice između okvira.
const uski = process.env.OKVIR === "zrak";

const bin = readFileSync(join(process.cwd(), "public", SIM_POLJE.bajtovi));
const osnove = razloziOsnove(
  bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
);

function sloziPolje(stanje: StanjeZraka): SirovoPolje {
  return uski ? raspakirajPolje(sastaviPolje(stanje)) : slozi(stanje, osnove);
}

const sati = Object.keys(sviSati)
  .filter((t) => t >= od && t <= dodan)
  .sort();

// Postaja k1 u ćeliji rešetke gustoće; gustoća se čita kao prosjek 3×3.
const k1 = SIM_POSTAJE[0];
const granice = uski ? OKVIR.granice : osnove.granice;
const sirinaM = uski ? OKVIR.sirina / OKVIR.pxPoMetru : osnove.sirinaM;
const gwPolja = uski ? sastaviPolje({ smjerOd: 0, brzina: 1, dubina: 100 }).gw : osnove.gw;

const visinaM = uski
  ? (OKVIR.visina / OKVIR.sirina) * sirinaM
  : osnove.visinaM;
const par: Postavke = {
  ...POSTAVKE_SIMULATORA,
  ...dodatne,
  metaraX: sirinaM,
  metaraY: visinaM,
};

let maskaCelija: number[] | null = null;

function ocitaj(sim: Simulacija, polje: SirovoPolje): { postaja: number; ploha: number } {
  const g = sim.crtaj();
  const i0 = Math.round(
    ((k1.lon - granice.zapad) / (granice.istok - granice.zapad)) * sim.sirina,
  );
  const j0 = Math.round(
    ((granice.sjever - k1.lat) / (granice.sjever - granice.jug)) * sim.visina,
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
  if (maskaCelija === null) {
    // Ćelije rešetke gustoće koje leže nad plohom; 99. postotak nad njima je
    // ista mjera kojom su sidra ljestvice i dosad mjerena.
    maskaCelija = [];
    const gh = polje.gh;
    for (let j = 0; j < sim.visina; j += 1) {
      for (let i = 0; i < sim.sirina; i += 1) {
        const mi = Math.min(gwPolja - 1, Math.round((i / sim.sirina) * gwPolja));
        const mj = Math.min(gh - 1, Math.round((j / sim.visina) * gh));
        if (polje.maska[mj * gwPolja + mi] > 128) maskaCelija.push(j * sim.sirina + i);
      }
    }
  }
  const naPlohi = maskaCelija.map((k) => g[k]).sort((a, b) => a - b);
  const p99 = naPlohi.length
    ? naPlohi[Math.min(naPlohi.length - 1, Math.floor(naPlohi.length * 0.99))]
    : 0;
  return { postaja: n ? zbroj / n : 0, ploha: p99 };
}

const celijaM = sirinaM / gwPolja;
const niz: Record<string, number> = {};
const nizPlohe: Record<string, number> = {};
let sim: Simulacija | null = null;
let prosli = "";
let zagrijano = 0;
const pocetak = Date.now();

function satPlusJedan(t: string): string {
  return new Date(Date.parse(t) + 3600_000).toISOString().replace(/:\d\d\.\d+Z$/, "Z").replace(/T(\d\d):00Z/, "T$1:00Z");
}

for (const t of sati) {
  const stanje = sviSati[t];
  const polje = sloziPolje(stanje);
  const hladno = sim === null || prosli === "" || satPlusJedan(prosli) !== t;
  if (sim === null) sim = stvoriDimSirovo(polje, par);
  else sim.postaviPolje(polje);
  if (hladno) zagrijano = 0;

  const dt = korakZaBrzinu(stanje.brzina, celijaM);
  const koraka = Math.max(1, Math.round(SEKUNDI_PO_SATU / dt));
  const stvarni = SEKUNDI_PO_SATU / koraka;
  for (let i = 0; i < koraka; i += 1) sim.korak(stvarni);

  zagrijano += 1;
  if (zagrijano > ZALET_SATI) {
    const o = ocitaj(sim, polje);
    niz[t] = o.postaja;
    nizPlohe[t] = o.ploha;
  }
  prosli = t;
}

writeFileSync(izlazPut, JSON.stringify(niz));
writeFileSync(izlazPut.replace(/\.json$/, ".ploha.json"), JSON.stringify(nizPlohe));
console.error(
  `${Object.keys(niz).length} sati u ${((Date.now() - pocetak) / 1000).toFixed(0)} s`,
);
