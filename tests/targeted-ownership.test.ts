import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pointOnFeature } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  classifyIdentities,
  selectTargetParcels,
} from "../scripts/verify-targeted-ownership";
import { dosjeZaTocku } from "../src/lib/dosje";
import { MAP_VIEWS, OVERLAY_LAYERS } from "../src/lib/map-views";
import {
  matchesTargetedOwnership,
  validateTargetedOwnershipProperties,
  type TargetedOwnershipFilters,
  type TargetedOwnershipProperties,
} from "../src/lib/targeted-ownership";

type TargetFeature = Feature<Polygon | MultiPolygon, TargetedOwnershipProperties>;
type Registry = Parameters<typeof classifyIdentities>[2];

const registry: Registry = [{
  id: "grad-split",
  label: "Grad Split",
  category: "city",
  aliases: ["GRAD SPLIT"],
  taxNumbers: [],
  source: "https://split.hr/",
  verifiedAt: "2026-08-02",
}];

const base: TargetedOwnershipProperties = {
  parcel_id: "SPLIT:273/1",
  parcel_number: "273/1",
  cadastral_municipality: "SPLIT",
  cohorts: ["road_corridor"],
  verification_status: "confirmed_public",
  evidence_source: "land_register",
  public_entities: [{ id: "grad-split", label: "Grad Split", category: "city" }],
  purpose_primary_code: "IS",
  purpose_primary_label: "Površine infrastrukturnih sustava",
  built: false,
  parcel_area_m2: 1_250,
  mapped_area_m2: 1_248,
  verified_at: "2026-08-02",
  source_updated_at: "2025-10-03",
};

test("sanitized ownership schema rejects private fields and OIB-like values", () => {
  assert.doesNotThrow(() => validateTargetedOwnershipProperties(base));
  assert.throws(
    () => validateTargetedOwnershipProperties({ ...base, owner: "Privatna osoba" }),
    /nedopušteno polje: owner/,
  );
  assert.throws(
    () => validateTargetedOwnershipProperties({
      ...base,
      public_entities: [{ ...base.public_entities[0], label: "Grad 12345678901" }],
    }),
    /OIB/,
  );
});

test("filters combine verification, entity type, cohort, purpose, and footprint", () => {
  const filters: TargetedOwnershipFilters = {
    statuses: ["confirmed_public"],
    entityCategories: ["city"],
    cohorts: ["road_corridor"],
    purposes: ["IS"],
    built: "without_footprint",
  };
  assert.equal(matchesTargetedOwnership(base, filters), true);
  assert.equal(matchesTargetedOwnership({ ...base, built: true }, filters), false);
  assert.equal(matchesTargetedOwnership({ ...base, cohorts: ["large_parcel"] }, filters), false);
  assert.equal(matchesTargetedOwnership({ ...base, purpose_primary_code: "Z5" }, filters), false);
});

test("classification distinguishes confirmed, mixed, cadastral, non-public, and unresolved evidence", () => {
  const publicOwner = { name: "Grad Split", taxNumber: null };
  const otherOwner = { name: "Drugi nositelj", taxNumber: null };
  assert.equal(
    classifyIdentities([publicOwner], "land_register", registry, "2026-08-02").verificationStatus,
    "confirmed_public",
  );
  assert.equal(
    classifyIdentities([publicOwner, otherOwner], "land_register", registry, "2026-08-02").verificationStatus,
    "mixed_public",
  );
  assert.equal(
    classifyIdentities([publicOwner], "cadastre", registry, "2026-08-02").verificationStatus,
    "cadastre_public",
  );
  assert.equal(
    classifyIdentities([otherOwner], "land_register", registry, "2026-08-02").verificationStatus,
    "private_or_other",
  );
  assert.equal(
    classifyIdentities([otherOwner], "cadastre", registry, "2026-08-02").verificationStatus,
    "unresolved",
  );
});

test("scope is exactly every road-corridor parcel plus every source parcel of at least 10,000 m²", async () => {
  const parcels = JSON.parse(await readFile("public/geo/grad/katastar.geojson", "utf8")) as FeatureCollection;
  const corridor = JSON.parse(await readFile("data/public-ownership-corridor.geojson", "utf8")) as FeatureCollection;
  const selected = selectTargetParcels(
    parcels.features as Parameters<typeof selectTargetParcels>[0],
    corridor.features as Parameters<typeof selectTargetParcels>[1],
  );
  assert.equal(selected.length, 30);
  assert.equal(selected.filter((parcel) => parcel.cohorts.includes("road_corridor")).length, 18);
  assert.equal(selected.filter((parcel) => parcel.cohorts.includes("large_parcel")).length, 14);
  assert.equal(selected.some((parcel) => parcel.parcelId === "SPLIT:280/4"), false);
});

test("published artifact is valid, privacy-safe, and records the verified pilot outcomes", async () => {
  const raw = await readFile("public/geo/analiza/ciljana-provjera-vlasnistva.geojson", "utf8");
  const collection = JSON.parse(raw) as FeatureCollection<Polygon | MultiPolygon, TargetedOwnershipProperties>;
  assert.equal(collection.features.length, 30);
  for (const feature of collection.features) validateTargetedOwnershipProperties(feature.properties);

  const counts = new Map<string, number>();
  for (const feature of collection.features) {
    const status = feature.properties.verification_status;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(counts), {
    cadastre_public: 4,
    unresolved: 10,
    private_or_other: 10,
    confirmed_public: 6,
  });
  for (const parcelId of ["SPLIT:273/1", "SPLIT:281/1"]) {
    const selected = collection.features.find((feature) => feature.properties.parcel_id === parcelId);
    assert.equal(selected?.properties.verification_status, "confirmed_public");
    assert.equal(selected?.properties.public_entities[0]?.label, "Grad Split");
  }

  assert.doesNotMatch(raw, /"(?:owner|address|oib|taxNumber|zk_vlasnik|zk_teret|lrOwners|possessors|ownershipSheetB)"/i);
  assert.doesNotMatch(raw, /(?:^|\D)\d{11}(?:\D|$)/);
});

test("targeted verification is a production layer in the public-parcel map view", () => {
  const layer = OVERLAY_LAYERS.find((candidate) => candidate.id === "ciljana-provjera-vlasnistva");
  assert.deepEqual(
    layer && { url: layer.url, phase: layer.phase },
    { url: "/geo/analiza/ciljana-provjera-vlasnistva.geojson", phase: 1 },
  );
  const view = MAP_VIEWS.find((candidate) => candidate.id === "javno-evidentirano");
  assert.equal(view?.layerIds.includes("ciljana-provjera-vlasnistva"), true);
});

test("real parcel dossier returns the same sanitized targeted ownership evidence", async () => {
  const collection = JSON.parse(
    await readFile("public/geo/analiza/ciljana-provjera-vlasnistva.geojson", "utf8"),
  ) as { features: TargetFeature[] };
  const selected = collection.features.find(
    (feature) => feature.properties.parcel_id === "SPLIT:273/1",
  );
  assert.ok(selected);
  const [lng, lat] = pointOnFeature(selected).geometry.coordinates;
  const dossier = await dosjeZaTocku(lng, lat);
  assert.equal(dossier.ciljanaProvjeraVlasnistva?.parcel_id, "SPLIT:273/1");
  assert.deepEqual(dossier.ciljanaProvjeraVlasnistva?.public_entities, base.public_entities);
});
