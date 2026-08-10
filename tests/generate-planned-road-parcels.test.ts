import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  derivePlannedRoadParcel,
  generatePlannedRoadParcels,
} from "../scripts/generate-planned-road-parcels";
import { validatePlannedRoadParcelProperties } from "../src/lib/planned-road-parcels";

const square = (west: number, south: number, east: number, north: number, properties: Record<string, unknown>): Feature<Polygon, Record<string, unknown>> => ({
  type: "Feature",
  properties,
  geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
});

test("a parcel enters only when planned-road overlap reaches one square metre", () => {
  const parcel = square(16.49, 43.52, 16.491, 43.521, { ko: "SPLIT", cestica: "1/1", povrsina: 8_000 });
  const noRoads: Feature<Polygon, Record<string, unknown>>[] = [];
  assert.equal(derivePlannedRoadParcel(parcel, noRoads, new Map(), new Map(), "2025-10-03"), null);
  const road = square(16.4905, 43.52, 16.491, 43.521, { tema: "promet", godina: 2024 });
  const result = derivePlannedRoadParcel(parcel, [road], new Map(), new Map(), "2025-10-03");
  assert.ok(result);
  assert.ok(result.properties.road_overlap_m2 >= 1);
  assert.equal(result.properties.ownership_status, "no_data");
});

test("the production generator yields the complete privacy-safe invariant", async () => {
  const collection = await generatePlannedRoadParcels();
  assert.equal(collection.features.length, 338);
  assert.equal(collection.features.filter((feature) => feature.properties.ownership_status === "no_data").length, 284);
  assert.equal(collection.features.filter((feature) => feature.properties.ownership_status !== "no_data").length, 54);
  for (const feature of collection.features) {
    assert.ok(feature.properties.road_overlap_m2 >= 1);
    validatePlannedRoadParcelProperties(feature.properties);
  }
});

test("the committed artifact contains no private ownership fields", async () => {
  const raw = await readFile("public/geo/analiza/cestice-planiranih-cesta.geojson", "utf8");
  const collection = JSON.parse(raw) as FeatureCollection;
  assert.equal(collection.features.length, 338);
  assert.doesNotMatch(raw, /"(?:owner|address|oib|taxNumber|zk_vlasnik|zk_teret|lrOwners|possessors|ownershipSheetB)"/i);
  assert.doesNotMatch(raw, /(?:^|\D)\d{11}(?:\D|$)/);
});
