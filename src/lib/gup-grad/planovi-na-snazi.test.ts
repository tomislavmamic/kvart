import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { FeatureCollection } from "geojson";

import type { SvojstvaObuhvata } from "@/lib/gup-grad/obuhvati";
import { PLANOVI_NA_SNAZI, stabala } from "@/lib/gup-grad/planovi-na-snazi";

const geo = (ime: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), "public", "geo", "gup-grad", ime), "utf8")) as FeatureCollection;

test("svaki plan na snazi s lista 4.d ima obuhvat s ISPU-a", () => {
  const vazeci = geo("planski-rezim-2025.geojson")
    .features.map((f) => f.properties as SvojstvaObuhvata)
    .filter((s) => s.vrsta === "vazeci");
  assert.equal(vazeci.length, 46);
  assert.deepEqual(
    vazeci.map((s) => s.broj).sort((a, b) => a - b),
    Array.from({ length: 46 }, (_, i) => i + 1),
  );
  for (const s of vazeci) assert.match(s.ispu ?? "", /^(DPU|UPU|PUP)\d+$/, s.naziv);
  // DPU dijela područja Dračevac je jedna čestica od 4 597 m², a ne 1,5 ha sa sheme lista
  const dracevac = vazeci.find((s) => s.ispu === "DPU5");
  assert.ok(dracevac && dracevac.ha > 0.4 && dracevac.ha < 0.55);
});

test("odredbe na karti vode na poznati plan i odredbu, s onoliko stabala koliko ih plan crta", () => {
  const planovi = new Set(
    geo("planski-rezim-2025.geojson").features.map((f) => (f.properties as SvojstvaObuhvata).ispu),
  );
  const elementi = geo("elementi-planova.geojson").features;
  assert.ok(elementi.length > 0);
  for (const f of elementi) {
    const { ispu, odredba } = f.properties as { ispu: string; odredba: string };
    assert.ok(planovi.has(ispu), ispu);
    const o = PLANOVI_NA_SNAZI[ispu]?.odredbe[odredba];
    assert.ok(o, `${ispu}/${odredba}`);
    assert.equal(f.geometry.type, "MultiPoint");
    if (f.geometry.type === "MultiPoint") assert.equal(f.geometry.coordinates.length, o.stabala, `${ispu}/${odredba}`);
  }
  // DPU dijela područja Dračevac, listovi 2. i 3.: 11 u drvoredu uz južnu granicu, 8 uz građevinu 2
  const dpu5 = PLANOVI_NA_SNAZI.DPU5.odredbe;
  assert.equal(dpu5.drvored.stabala + dpu5["stabla-gradevina-2"].stabala, 19);
});

test("stabala: hrvatska množina", () => {
  assert.deepEqual([1, 3, 8, 11, 12, 19, 21, 22].map(stabala), [
    "1 stablo", "3 stabla", "8 stabala", "11 stabala", "12 stabala", "19 stabala", "21 stablo", "22 stabla",
  ]);
});
