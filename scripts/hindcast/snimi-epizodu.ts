/**
 * Slike perjanice za jednu epizodu, sat po sat, uz mjerenje i vjetar u imenu.
 *
 * Za izvješće i za kritiku: vrti model (proizvodne postavke + zadane) kroz
 * epizodu u lancu sa satnim prosjekom i piše PNG po satu u
 * `.cache/hindcast/epizode/<id>/`. Ime datoteke nosi mjesni sat, vjetar,
 * razred i izmjereni H₂S, pa se niz da pregledati bez otvaranja tablica.
 *
 * Pokretanje: npx tsx scripts/hindcast/snimi-epizodu.ts <od> <do> <ime> [postavke.json]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Postavke } from "@/lib/dim";
import { razredStabilnosti, RAZREDI } from "@/lib/sim/stabilnost";

import { vrtiModel } from "./model";
import { slikaPng } from "./slika";
import { PRIJEMNICI, sloziUlaze, ucitajDubine, ucitajOkolnosti, ucitajOpazanja, ucitajVjetar } from "./ulazi";

const [od, do_, ime, postavkePut] = process.argv.slice(2);
if (!ime) {
  console.error("snimi-epizodu.ts <od GGGG-MM-DD> <do GGGG-MM-DD> <ime> [postavke.json]");
  process.exit(1);
}
const postavke: Postavke = postavkePut ? JSON.parse(readFileSync(postavkePut, "utf8")) : {};
const mapa = join(process.cwd(), ".cache", "hindcast", "epizode", ime);
mkdirSync(mapa, { recursive: true });

async function glavno(): Promise<void> {
  const [vjetar, dubine, okolnosti, opazanja] = await Promise.all([ucitajVjetar(), ucitajDubine(), ucitajOkolnosti(), ucitajOpazanja()]);
  // Zalet: šest sati prije, da prvi sat epizode ne krene iz čistog zraka.
  const odMs = Date.parse(`${od}T00:00:00.000Z`) - 6 * 3600_000;
  const ulazi = sloziUlaze("proizvodnja", { od: new Date(odMs).toISOString(), do: `${do_}T00:00:00.000Z` }, { vjetar, dubine, okolnosti }, { azoKasni: true });
  const h2s = new Map(opazanja.h2s.filter((o) => o.izvor === "zavod-k1").map((o) => [o.sat, o.vrijednost]));
  const mjesno = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zagreb", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const ploha = (() => {
    const gj = JSON.parse(readFileSync(join(process.cwd(), "public", "geo", "karepovac.geojson"), "utf8"));
    return (gj.features[0].geometry.coordinates[0] as number[][]).map((p) => [p[0], p[1]] as [number, number]);
  })();
  let n = 0;
  vrtiModel(ulazi, PRIJEMNICI, {
    nacin: "lanac",
    uzoraka: 6,
    postavke,
    snimaj: (sat) => sat >= `${od}T00:00:00.000Z`,
    naSnimku: (s) => {
      const u = ulazi.find((x) => x.sat === s.sat)!;
      const v = u.vjetar!;
      const r = u.okolnosti && u.okolnosti.sunce !== null && u.okolnosti.oblaci !== null ? RAZREDI[razredStabilnosti(v.brzina, u.okolnosti.sunce, u.okolnosti.oblaci)] : "?";
      const o = h2s.get(s.sat);
      const oznaka = `${mjesno.format(new Date(s.sat)).replace(/[^0-9]/g, "-")}_v${v.smjerOd.toFixed(0)}-${v.brzina.toFixed(1)}_d${u.dubina?.m ?? "?"}_${r}_h2s-${o === undefined ? "na" : o.toFixed(2)}`;
      writeFileSync(join(mapa, `${oznaka}.png`), slikaPng(s.gustoca, s.sirina, s.visina, { prijemnici: PRIJEMNICI, ploha, uvecanje: 2 }));
      n += 1;
    },
  });
  console.error(`${n} slika → ${mapa}`);
}
void glavno();
