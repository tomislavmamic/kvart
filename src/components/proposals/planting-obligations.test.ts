import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { FEATURED_PROPOSALS } from "../../lib/featured-proposals";

type Feature = { geometry: { type: string; coordinates: number[] }; properties: Record<string, unknown> };
type Obligation = { id: string; vrsta: string; uvjetno?: boolean; akti: { klasa: string }[]; izvori: { navod?: string }[]; izracun: { stabala?: number; na_karti?: number; ostatak_na_cestici?: number; zamjenjuje?: string[] } };
type Figure = { src: string; width: number; height: number; marks: { xy: number[] }[] };

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const summary: { dugovano_stabala: number; obveze: Obligation[] } = read("../../generated/sidewalk-obligations.json");
const layer: { features: Feature[] } = read("../../../public/geo/prijedlozi/nogostupi-obveze.geojson");
const proposal: { features: Feature[] } = read("../../../public/geo/prijedlozi/nogostupi.geojson");
const figures: Record<string, Figure> = read("../../generated/sidewalk-figures.json");
const anchors = (file: string) => new Set((read(`../../../data/gup-grad/dokument/${file}.json`).blokovi as { a?: string }[]).map((b) => b.a));
const byRole = (role: string, id?: string) => layer.features.filter((f) => f.properties.role === role && (!id || f.properties.obligation === id));

test("the owed total counts only obligations that are due, and every owed tree is on the map or said to be elsewhere", () => {
  const due = summary.obveze.filter((o) => o.vrsta !== "ulica" && !o.uvjetno);
  assert.equal(summary.dugovano_stabala, due.reduce((sum, o) => sum + (o.izracun.stabala ?? 0), 0));
  for (const o of due) {
    assert.equal(byRole("obligation-tree", o.id).length, o.izracun.na_karti, `${o.id}: map positions`);
    assert.equal((o.izracun.na_karti ?? 0) + (o.izracun.ostatak_na_cestici ?? 0), o.izracun.stabala, `${o.id}: nothing lost`);
  }
});

test("a conditional obligation shows its plot but no tree positions", () => {
  for (const o of summary.obveze.filter((o) => o.uvjetno)) {
    assert.equal(byRole("obligation-tree", o.id).length, 0);
    assert.equal(byRole("obligation-plot", o.id).length, 1);
  }
});

test("only street spots that clash with a utility line are given up for an owed tree", () => {
  const clash = new Map(proposal.features.filter((f) => f.properties.role === "proposed-tree").map((f) => [f.properties.candidate_id, f.properties.screen_result === "conflict"]));
  for (const f of byRole("street-tree-replaceable")) assert.equal(clash.get(f.properties.candidate_id), true, String(f.properties.candidate_id));
  for (const o of summary.obveze) {
    const marked = byRole("street-tree-replaceable", o.id).map((f) => f.properties.candidate_id).sort();
    assert.deepEqual(marked, [...(o.izracun.zamjenjuje ?? [])].sort(), `${o.id}: page and map name the same spots`);
  }
});

test("the olive row replaces the proposal's keep marker of the same group", () => {
  const olives = byRole("olive-row");
  assert.ok(olives.length > 0);
  const retained = new Set(proposal.features.filter((f) => f.properties.role === "retained-trees").map((f) => f.properties.retention_id));
  for (const f of olives) assert.ok(retained.has(f.properties.overrides), `${f.properties.overrides} must be a retained group`);
});

test("every obligation names its act and cites GUP articles that exist in the reader", () => {
  const reader: Record<string, Set<string | undefined>> = { "/gup/dokument": anchors("55-14"), "/gup/dokument/2006": anchors("1-06"), "/gup/dokument/2025": anchors("prijedlog-2025") };
  for (const o of summary.obveze) {
    assert.ok(o.akti.length > 0 && o.akti.every((a) => a.klasa), `${o.id}: permit reference`);
    for (const { navod } of o.izvori) {
      if (!navod) continue;
      const [path, anchor] = navod.split("#");
      assert.ok(reader[path]?.has(anchor), `${o.id}: ${navod} must point to an article`);
    }
  }
});

test("every figure has its image, and its marks fall on it", () => {
  for (const [id, f] of Object.entries(figures)) {
    assert.ok(existsSync(new URL(`../../../public${f.src}`, import.meta.url)), `${id}: image`);
    for (const m of f.marks) assert.ok(m.xy[0] >= 0 && m.xy[0] <= f.width && m.xy[1] >= 0 && m.xy[1] <= f.height, `${id}: mark ${m.xy}`);
  }
});

test("the proposal card quotes the same owed total as the page", () => {
  const card = FEATURED_PROPOSALS.find((p) => p.slug === "uredenje-nogostupa")!;
  assert.match(card.detail, new RegExp(`${summary.dugovano_stabala} dugovanih stabala`));
});
