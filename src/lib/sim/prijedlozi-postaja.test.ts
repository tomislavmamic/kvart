import assert from "node:assert/strict";
import test from "node:test";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

import { cijenaFaze, PRIJEDLOZI_POSTAJA } from "./prijedlozi-postaja";

test("svi prijedlozi leže u okviru simulatora i imaju jedinstvene oznake", () => {
  const g = SIM_POLJE.granice;
  const ids = new Set<string>();
  for (const p of PRIJEDLOZI_POSTAJA) {
    assert.ok(p.lat > g.jug && p.lat < g.sjever && p.lon > g.zapad && p.lon < g.istok, p.id);
    assert.ok(!ids.has(p.id), `dvostruki id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.cijena[0] <= p.cijena[1] && p.oprema.length > 0 && p.velicine.length > 0);
  }
});

test("faza A je jeftina i sadrži jarbol na plohi i H₂S u naselju", () => {
  const [od, do_] = cijenaFaze("A");
  assert.ok(od >= 3000 && do_ <= 12000, `${od}–${do_}`);
  const a = PRIJEDLOZI_POSTAJA.filter((p) => p.faza === "A").map((p) => p.id);
  assert.ok(a.includes("ploha-jarbol") && a.includes("dracevac-7b"));
});
