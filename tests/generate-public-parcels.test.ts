import assert from "node:assert/strict";
import test from "node:test";
import type { Feature, Polygon } from "geojson";
import { derivePublicParcel } from "../scripts/generate-public-parcels";

const polygon = (west: number, south: number, east: number, north: number): Polygon => ({
  type: "Polygon",
  coordinates: [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]],
});

const raw = (
  properties: Record<string, unknown>,
  geometry = polygon(16, 43, 16.001, 43.001),
): Feature<Polygon> => ({ type: "Feature", geometry, properties });

test("non-public source status is excluded", () => {
  const result = derivePublicParcel(
    raw({ cestica: "1", ko: "SPLIT", zk_status: "Fizička osoba" }),
    [],
    [],
    "2026-08-02",
  );
  assert.equal(result, null);
});

test("largest purpose covering at least one percent becomes primary", () => {
  const purposes = [
    raw({ kod: "K5", namjena: "Poslovna namjena i stanovanje" }, polygon(16, 43, 16.0005, 43.0005)),
    raw({ kod: "Z5", namjena: "Zaštitno zelenilo" }, polygon(16.0008, 43.0008, 16.001, 43.001)),
  ];
  const result = derivePublicParcel(
    raw({ cestica: "100/1", ko: "SPLIT", zk_status: "JLS", zk_oblik: "Vlasništvo", zk_vlasnik: "must never ship", zk_teret: "must never ship" }),
    purposes,
    [],
    "2026-08-02",
  );
  assert.ok(result);
  assert.equal(result.properties.purpose_primary_code, "K5");
  assert.equal(result.properties.purpose_primary_label, "Poslovna namjena i stanovanje");
  assert.deepEqual(Object.keys(result.properties).sort(), [
    "area_m2", "built", "cadastral_municipality", "generated_at",
    "ownership_form", "parcel_id", "parcel_number", "public_level",
    "purpose_primary_code", "purpose_primary_label", "source_updated_at",
  ]);
});

test("purpose below one percent remains unknown", () => {
  const result = derivePublicParcel(
    raw({ cestica: "2", ko: "SPLIT", zk_status: "RH" }),
    [raw({ kod: "Z5", namjena: "Zaštitno zelenilo" }, polygon(16, 43, 16.000005, 43.001))],
    [],
    "2026-08-02",
  );
  assert.ok(result);
  assert.equal(result.properties.purpose_primary_code, null);
});

test("a building overlap of at least one square metre marks footprint evidence", () => {
  const result = derivePublicParcel(
    raw({ cestica: "3", ko: "KAMEN", zk_status: "DNŽ", zk_oblik: "Suvlasništvo" }),
    [],
    [raw({}, polygon(16, 43, 16.00002, 43.00002))],
    "2026-08-02",
  );
  assert.ok(result);
  assert.equal(result.properties.public_level, "county");
  assert.equal(result.properties.ownership_form, "coownership");
  assert.equal(result.properties.built, true);
});
