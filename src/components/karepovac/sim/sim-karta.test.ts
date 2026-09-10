import assert from "node:assert/strict";
import test from "node:test";
import type { Map as MapaLibre, LayerSpecification, SourceSpecification } from "maplibre-gl";

import { dodajSlojeveSimulatora, dodajZgrade } from "./sim-karta";

function kartaZaTest(vektorska = true) {
  const izvori = new Map<string, SourceSpecification>();
  const slojevi = new Map<string, LayerSpecification>();
  if (vektorska) izvori.set("openmaptiles", { type: "vector", url: "https://tiles.openfreemap.org/planet" });
  const karta = {
    getSource: (naziv: string) => izvori.get(naziv),
    getLayer: (naziv: string) => slojevi.get(naziv),
    addSource: (naziv: string, izvor: SourceSpecification) => izvori.set(naziv, izvor),
    addLayer: (sloj: LayerSpecification) => slojevi.set(sloj.id, sloj),
  } as unknown as MapaLibre;
  return { karta, izvori, slojevi };
}

test("reljef koristi kontinuirani DEM, ne odrezane lokalne pločice", () => {
  const { karta, izvori, slojevi } = kartaZaTest();
  dodajSlojeveSimulatora(karta);
  const reljef = izvori.get("reljef");
  assert.equal(reljef?.type, "raster-dem");
  if (reljef?.type !== "raster-dem") return;
  assert.equal(reljef.encoding, "terrarium");
  assert.match(reljef.tiles?.[0] ?? "", /elevation-tiles-prod/);
  assert.equal(reljef.bounds, undefined);
  assert.equal(slojevi.get("reljef")?.type, "hillshade");
  assert.match(reljef.attribution ?? "", /Copernicus/);
});

test("zgrade dijele izvor s podlogom i nemaju lokalni pravokutni izrez", () => {
  const { karta, izvori, slojevi } = kartaZaTest();
  dodajZgrade(karta);
  dodajZgrade(karta);
  assert.equal(izvori.size, 1);
  assert.equal(slojevi.size, 1);
  const zgrade = slojevi.get("zgrade");
  assert.equal(zgrade?.type, "fill");
  if (zgrade?.type !== "fill") return;
  assert.equal(zgrade.source, "openmaptiles");
  assert.equal(zgrade["source-layer"], "building");
});

test("zgrade i uz rezervnu rastersku podlogu dobivaju kontinuirani izvor", () => {
  const { karta, izvori, slojevi } = kartaZaTest(false);
  dodajZgrade(karta);
  assert.equal(izvori.get("zgrade")?.type, "vector");
  assert.equal(slojevi.get("zgrade")?.type, "fill");
});
