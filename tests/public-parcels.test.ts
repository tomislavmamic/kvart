import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pointOnFeature } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import {
  matchesPublicParcel,
  publicParcelDossierFacts,
  summarizePublicParcels,
  validatePublicParcelProperties,
  type PublicParcelFilters,
  type PublicParcelProperties,
} from "../src/lib/public-parcels";
import { MAP_VIEWS, OVERLAY_LAYERS } from "../src/lib/map-views";
import { dosjeZaTocku } from "../src/lib/dosje";

const base: PublicParcelProperties = {
  parcel_id: "SPLIT:100/1",
  parcel_number: "100/1",
  cadastral_municipality: "SPLIT",
  public_level: "city",
  ownership_form: "ownership",
  purpose_primary_code: "K5",
  purpose_primary_label: "Poslovna namjena i stanovanje",
  built: false,
  area_m2: 1_250,
  source_updated_at: "2025-10-03",
  generated_at: "2026-08-02",
};

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [[[16.49, 43.52], [16.5, 43.52], [16.5, 43.53], [16.49, 43.52]]],
};

const feature = (properties: PublicParcelProperties): Feature<Polygon, PublicParcelProperties> => ({
  type: "Feature",
  geometry: polygon,
  properties,
});

test("validator rejects a non-public status and any source-only owner field", () => {
  assert.throws(
    () => validatePublicParcelProperties({ ...base, public_level: "private" }),
    /public_level/,
  );
  assert.throws(
    () => validatePublicParcelProperties({ ...base, zk_vlasnik: "Privatna osoba" }),
    /nedopušteno polje: zk_vlasnik/,
  );
});

test("filters combine level, purpose, and footprint evidence", () => {
  const filters: PublicParcelFilters = {
    levels: ["city"],
    purposes: ["K5"],
    built: "without_footprint",
  };
  assert.equal(matchesPublicParcel(base, filters), true);
  assert.equal(matchesPublicParcel({ ...base, public_level: "state" }, filters), false);
  assert.equal(matchesPublicParcel({ ...base, purpose_primary_code: "Z5" }, filters), false);
  assert.equal(matchesPublicParcel({ ...base, built: true }, filters), false);
});

test("unknown purpose is independently filterable", () => {
  const unknown = { ...base, purpose_primary_code: null, purpose_primary_label: null };
  assert.equal(
    matchesPublicParcel(unknown, { levels: [], purposes: ["unknown"], built: "all" }),
    true,
  );
  assert.equal(
    matchesPublicParcel(base, { levels: [], purposes: ["unknown"], built: "all" }),
    false,
  );
});

test("summary counts only matching features and rounds their literal area", () => {
  const features = [
    feature(base),
    feature({ ...base, parcel_id: "SPLIT:100/2", parcel_number: "100/2", area_m2: 750, built: true }),
    feature({ ...base, parcel_id: "SPLIT:100/3", parcel_number: "100/3", area_m2: 500, public_level: "state" }),
  ];
  assert.deepEqual(
    summarizePublicParcels(features, { levels: ["city"], purposes: [], built: "all" }),
    { count: 2, area_m2: 2_000 },
  );
});

test("public parcel evidence is a production layer and a resident question", () => {
  const layer = OVERLAY_LAYERS.find((candidate) => candidate.id === "javne-cestice");
  assert.deepEqual(
    layer && { url: layer.url, phase: layer.phase },
    { url: "/geo/analiza/javne-cestice.geojson", phase: 1 },
  );
  const view = MAP_VIEWS.find((candidate) => candidate.id === "javno-evidentirano");
  assert.equal(view?.razina, "pitanje");
  assert.deepEqual(view?.layerIds, ["javne-cestice"]);
});

test("dossier facts name coownership, draft purpose, and missing footprint evidence", () => {
  assert.deepEqual(
    publicParcelDossierFacts({
      ...base,
      public_level: "county",
      ownership_form: "coownership",
      built: false,
    }),
    [
      "Županija · Suvlasništvo",
      "K5 — Poslovna namjena i stanovanje · GUP 2024. (nacrt)",
      "Nema evidentirani tlocrt ≥1 m² u korištenim slojevima",
    ],
  );
});

test("real parcel dossier returns the same sanitized public evidence", async () => {
  const collection = JSON.parse(
    await readFile("public/geo/analiza/javne-cestice.geojson", "utf8"),
  ) as { features: Feature<Polygon, PublicParcelProperties>[] };
  const selected = collection.features[0];
  const point = pointOnFeature(selected);
  const [lng, lat] = point.geometry.coordinates;
  const dossier = await dosjeZaTocku(lng, lat);
  assert.equal(dossier.javnaCestica?.parcel_id, selected.properties.parcel_id);
  assert.equal("zk_vlasnik" in (dossier.javnaCestica ?? {}), false);
});
