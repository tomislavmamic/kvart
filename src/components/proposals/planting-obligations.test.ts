import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Feature = { geometry: { type: string }; properties: Record<string, unknown> };
type Obligation = { id: string; vrsta: string; uvjetno?: boolean; akti: { klasa: string }[]; zasto: { navod?: string }[]; izracun: { stabala?: number }; polozaja_na_karti: number };

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const summary: { dugovano_stabala: number; obveze: Obligation[] } = read("../../generated/sidewalk-obligations.json");
const layer: { features: Feature[] } = read("../../../public/geo/prijedlozi/nogostupi-obveze.geojson");
const document55: { blokovi: { a?: string }[] } = read("../../../data/gup-grad/dokument/55-14.json");
const document106: { blokovi: { a?: string }[] } = read("../../../data/gup-grad/dokument/1-06.json");

test("the owed total counts only obligations that are due, and each has its trees on the map", () => {
  const due = summary.obveze.filter((o) => o.vrsta !== "ulica" && !o.uvjetno);
  assert.equal(summary.dugovano_stabala, due.reduce((sum, o) => sum + (o.izracun.stabala ?? 0), 0));
  for (const o of due) {
    const trees = layer.features.filter((f) => f.properties.role === "obligation-tree" && f.properties.obligation === o.id);
    assert.equal(trees.length, o.izracun.stabala, `${o.id}: one map position per owed tree`);
    assert.equal(o.polozaja_na_karti, trees.length);
    assert.ok(trees.every((f) => f.geometry.type === "Point"));
  }
});

test("a conditional obligation shows its plot but no tree positions", () => {
  for (const o of summary.obveze.filter((o) => o.uvjetno)) {
    assert.equal(layer.features.filter((f) => f.properties.obligation === o.id && f.properties.role === "obligation-tree").length, 0);
    assert.equal(layer.features.filter((f) => f.properties.obligation === o.id && f.properties.role === "obligation-plot").length, 1);
  }
});

test("every obligation names its act and cites GUP articles that exist in the reader", () => {
  const anchors = { "/gup/dokument": new Set(document55.blokovi.map((b) => b.a)), "/gup/dokument/2006": new Set(document106.blokovi.map((b) => b.a)) };
  for (const o of summary.obveze) {
    assert.ok(o.akti.length > 0 && o.akti.every((a) => a.klasa), `${o.id}: permit reference`);
    for (const { navod } of o.zasto) {
      if (!navod) continue;
      const [path, anchor] = navod.split("#");
      assert.ok(anchors[path as keyof typeof anchors]?.has(anchor), `${o.id}: ${navod} must point to an article`);
    }
  }
});
