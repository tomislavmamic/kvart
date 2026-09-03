import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PRIMARY_NAV_ITEMS } from "@/lib/site-navigation";

/**
 * Simulator je zaslon bez zaglavlja (BEZ_OKVIRA u `site-chrome.tsx`), a
 * „Karepovac” u glavnoj navigaciji vodi upravo na njega. Zato poveznica natrag
 * na pregled mora stajati na samoj karti — bez nje se sa simulatora ne može
 * nikamo osim natragom preglednika.
 */

const izvor = readFileSync(
  join(process.cwd(), "src/components/karepovac/sim/simulator.tsx"),
  "utf8",
);

test("sa simulatora se uvijek može na pregled Karepovca", () => {
  for (const ulomak of ['href="/karepovac"', "Karepovac — sve što pratimo"]) {
    assert.ok(izvor.includes(ulomak), ulomak);
  }
  // I kad karta ne radi: preglednik bez WebGL-a dobiva isti izlaz.
  const bezWebgl = izvor.slice(izvor.indexOf('stanjeKarte === "bezWebgl"'));
  assert.ok(bezWebgl.slice(0, 1600).includes('href="/karepovac"'));
});

test("„Karepovac” u navigaciji otvara simulator", () => {
  const stavka = PRIMARY_NAV_ITEMS.find((s) => s.id === "karepovac");
  assert.ok(stavka);
  assert.equal(stavka.href, "/karepovac/sim");
  // Pregled i podstranice projekta i dalje označavaju istu stavku.
  assert.ok(stavka.activePrefixes.includes("/karepovac"));
});
