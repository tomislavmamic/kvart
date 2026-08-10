import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  derivePlannedRoadParcel,
  generatePlannedRoadParcels,
  validatePolygonFeatureCollection,
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

test("invalid source geometry is rejected instead of being dropped", () => {
  assert.throws(
    () =>
      validatePolygonFeatureCollection(
        {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { tema: "promet" },
              geometry: { type: "Point", coordinates: [16.49, 43.52] },
            },
          ],
        },
        "planned roads",
      ),
    /planned roads.*feature 0.*Polygon/i,
  );
});

test("invalid parcel identity and area fail instead of looking below threshold", () => {
  const roads = [
    square(16.49, 43.52, 16.491, 43.521, {
      tema: "promet",
      godina: 2024,
    }),
  ];
  assert.throws(
    () =>
      derivePlannedRoadParcel(
        square(16.49, 43.52, 16.491, 43.521, {
          ko: "SPLIT",
          cestica: "",
          povrsina: 8_000,
        }),
        roads,
        new Map(),
        new Map(),
        "2025-10-03",
      ),
    /parcel feature.*canonical parcel key/i,
  );
  assert.throws(
    () =>
      derivePlannedRoadParcel(
        square(16.49, 43.52, 16.491, 43.521, {
          ko: "SPLIT",
          cestica: "1/1",
          povrsina: 0,
        }),
        roads,
        new Map(),
        new Map(),
        "2025-10-03",
      ),
    /parcel SPLIT:1\/1.*povrsina/i,
  );
  assert.throws(
    () =>
      derivePlannedRoadParcel(
        square(16.49, 43.52, 16.491, 43.521, {
          ko: "SPLIT",
          cestica: "1/1",
          povrsina: "8000",
        }),
        roads,
        new Map(),
        new Map(),
        "2025-10-03",
      ),
    /parcel SPLIT:1\/1.*povrsina/i,
  );
});

test("spatial failures include parcel and road context instead of becoming zero overlap", () => {
  const parcel = square(16.49, 43.52, 16.491, 43.521, {
    ko: "SPLIT",
    cestica: "1/1",
    povrsina: 8_000,
  });
  const malformedRoad = {
    type: "Feature",
    properties: { tema: "promet", godina: 2024 },
    geometry: {
      type: "Polygon",
      coordinates: [[[16.49, 43.52], [16.491], [16.49, 43.52]]],
    },
  } as unknown as Feature<Polygon, Record<string, unknown>>;
  assert.throws(
    () =>
      derivePlannedRoadParcel(
        parcel,
        [malformedRoad],
        new Map(),
        new Map(),
        "2025-10-03",
      ),
    /parcel SPLIT:1\/1.*road feature 0/i,
  );
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

test("the committed artifact exactly matches a fresh generation", async () => {
  const generated = await generatePlannedRoadParcels();
  const committedRaw = await readFile(
    "public/geo/analiza/cestice-planiranih-cesta.geojson",
    "utf8",
  );
  assert.equal(committedRaw, `${JSON.stringify(generated)}\n`);
});

test("the committed manifest declares the exact sources and derived counts", async () => {
  const artifact = JSON.parse(
    await readFile(
      "public/geo/analiza/cestice-planiranih-cesta.geojson",
      "utf8",
    ),
  ) as FeatureCollection<Polygon, { ownership_status: string }>;
  const manifest = JSON.parse(
    await readFile(
      "public/geo/analiza/cestice-planiranih-cesta.manifest.json",
      "utf8",
    ),
  ) as {
    minimum_road_overlap_m2: number;
    input_counts: { road_polygons: number; parcels: number };
    selected_count: number;
    ownership_status_counts: Record<string, number>;
    sources: Record<string, string>;
  };
  const roads = JSON.parse(
    await readFile("public/geo/planovi/gup-2024-promet.geojson", "utf8"),
  ) as FeatureCollection;
  const parcels = JSON.parse(
    await readFile("public/geo/grad/katastar.geojson", "utf8"),
  ) as FeatureCollection;
  const derivedStatusCounts = Object.fromEntries(
    [
      "confirmed_public",
      "mixed_public",
      "cadastre_public",
      "city_gis_public",
      "not_confirmed_public",
      "unresolved",
      "no_data",
    ].map((status) => [
      status,
      artifact.features.filter(
        (feature) => feature.properties.ownership_status === status,
      ).length,
    ]),
  );
  assert.deepEqual(manifest, {
    source_updated_at: "2025-10-03",
    minimum_road_overlap_m2: 1,
    input_counts: {
      road_polygons: roads.features.length,
      parcels: parcels.features.length,
    },
    selected_count: artifact.features.length,
    ownership_status_counts: derivedStatusCounts,
    sources: {
      parcels: "/geo/grad/katastar.geojson",
      roads: "/geo/planovi/gup-2024-promet.geojson",
      targeted_ownership:
        "/geo/analiza/ciljana-provjera-vlasnistva.geojson",
      city_gis: "/geo/analiza/javne-cestice.geojson",
    },
  });
});
