import assert from "node:assert/strict";
import test from "node:test";
import type { Feature, Polygon } from "geojson";
import {
  matchesPlannedRoadParcel,
  plannedRoadParcelDossierFacts,
  resolvePlannedRoadOwnership,
  summarizePlannedRoadParcels,
  validatePlannedRoadParcelProperties,
  type PlannedRoadParcelFilters,
  type PlannedRoadParcelProperties,
} from "../src/lib/planned-road-parcels";
import type { PublicParcelProperties } from "../src/lib/public-parcels";
import type { TargetedOwnershipProperties } from "../src/lib/targeted-ownership";

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [[[16.49, 43.52], [16.50, 43.52], [16.50, 43.53], [16.49, 43.52]]],
};

const base: PlannedRoadParcelProperties = {
  parcel_id: "SPLIT:273/1",
  parcel_number: "273/1",
  cadastral_municipality: "SPLIT",
  parcel_area_m2: 1_250,
  mapped_area_m2: 1_248,
  road_overlap_m2: 315,
  road_overlap_percent: 25.2,
  ownership_status: "no_data",
  ownership_evidence: "none",
  public_entities: [],
  has_evidence_conflict: false,
  secondary_evidence_labels: [],
  source_updated_at: "2025-10-03",
  ownership_checked_at: null,
};

const targeted: TargetedOwnershipProperties = {
  parcel_id: base.parcel_id,
  parcel_number: base.parcel_number,
  cadastral_municipality: base.cadastral_municipality,
  cohorts: ["road_corridor"],
  verification_status: "confirmed_public",
  evidence_source: "land_register",
  public_entities: [{ id: "grad-split", label: "Grad Split", category: "city" }],
  purpose_primary_code: "IS",
  purpose_primary_label: "Površine infrastrukturnih sustava",
  built: false,
  parcel_area_m2: base.parcel_area_m2,
  mapped_area_m2: base.mapped_area_m2,
  verified_at: "2026-08-02",
  source_updated_at: base.source_updated_at,
};

const cityGis: PublicParcelProperties = {
  parcel_id: base.parcel_id,
  parcel_number: base.parcel_number,
  cadastral_municipality: base.cadastral_municipality,
  public_level: "state",
  ownership_form: "ownership",
  purpose_primary_code: "IS",
  purpose_primary_label: "Površine infrastrukturnih sustava",
  built: false,
  area_m2: base.mapped_area_m2,
  source_updated_at: base.source_updated_at,
  generated_at: "2026-08-02",
};

test("land-register evidence wins and a conflicting GIS level remains visible", () => {
  assert.deepEqual(resolvePlannedRoadOwnership(targeted, cityGis), {
    ownership_status: "confirmed_public",
    ownership_evidence: "land_register",
    public_entities: targeted.public_entities,
    has_evidence_conflict: true,
    secondary_evidence_labels: ["GIS Grada: Republika Hrvatska · vlasništvo"],
    ownership_checked_at: "2026-08-02",
  });
});

test("unresolved targeted lookup does not erase explicit City GIS evidence", () => {
  const unresolved = {
    ...targeted,
    verification_status: "unresolved" as const,
    evidence_source: "none" as const,
    public_entities: [],
    verified_at: null,
  };
  const result = resolvePlannedRoadOwnership(unresolved, cityGis);
  assert.equal(result.ownership_status, "city_gis_public");
  assert.equal(result.ownership_evidence, "city_gis");
  assert.equal(result.has_evidence_conflict, false);
  assert.deepEqual(result.secondary_evidence_labels, ["Ciljana provjera nije razriješena"]);
});

test("mixed ZK evidence remains mixed", () => {
  const result = resolvePlannedRoadOwnership(
    { ...targeted, verification_status: "mixed_public" },
    null,
  );
  assert.equal(result.ownership_status, "mixed_public");
});

test("missing evidence is explicit and remains visible under the default filter", () => {
  const filters: PlannedRoadParcelFilters = { statuses: [] };
  assert.equal(matchesPlannedRoadParcel(base, filters), true);
  assert.equal(matchesPlannedRoadParcel(base, { statuses: ["confirmed_public"] }), false);
});

test("validator rejects source-only private fields and OIB-like values", () => {
  assert.doesNotThrow(() => validatePlannedRoadParcelProperties(base));
  assert.throws(
    () => validatePlannedRoadParcelProperties({ ...base, owner: "Privatna osoba" }),
    /nedopušteno polje: owner/,
  );
  assert.throws(
    () => validatePlannedRoadParcelProperties({
      ...base,
      secondary_evidence_labels: ["Nositelj 12345678901"],
    }),
    /OIB/,
  );
});

test("summary follows the same status filter as the map", () => {
  const feature = (properties: PlannedRoadParcelProperties): Feature<Polygon, PlannedRoadParcelProperties> => ({
    type: "Feature",
    geometry: polygon,
    properties,
  });
  const records = [
    feature(base),
    feature({ ...base, parcel_id: "SPLIT:273/2", parcel_number: "273/2", ownership_status: "confirmed_public", ownership_evidence: "land_register", road_overlap_m2: 100 }),
  ];
  assert.deepEqual(
    summarizePlannedRoadParcels(records, { statuses: ["confirmed_public"] }),
    { count: 1, road_overlap_m2: 100 },
  );
});

test("dossier facts state the road impact and absence of ownership data", () => {
  assert.deepEqual(plannedRoadParcelDossierFacts(base), [
    "Planirana cesta zahvaća 315 m² · 25,2 % čestice",
    "Vlasništvo: nema raspoloživog podatka",
  ]);
});
