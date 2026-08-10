import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pointOnFeature } from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  matchesPlannedRoadParcel,
  plannedRoadParcelDossierFacts,
  plannedRoadOwnershipStatusTone,
  resolvePlannedRoadOwnership,
  summarizePlannedRoadParcels,
  validatePlannedRoadParcelProperties,
  type PlannedRoadParcelFilters,
  type PlannedRoadParcelProperties,
} from "../src/lib/planned-road-parcels";
import type { PublicParcelProperties } from "../src/lib/public-parcels";
import type { TargetedOwnershipProperties } from "../src/lib/targeted-ownership";
import { dossierMapBounds, MAP_VIEWS, OVERLAY_LAYERS } from "../src/lib/map-views";
import { dosjeZaTocku } from "../src/lib/dosje";

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

test("a narrow dossier releases map bounds so its parcel can remain visible", () => {
  assert.equal(dossierMapBounds(true), undefined);
  assert.deepEqual(dossierMapBounds(false), [
    [43.514, 16.481],
    [43.536, 16.518],
  ]);
});

test("missing planned-road ownership uses a neutral visual tone", () => {
  assert.equal(plannedRoadOwnershipStatusTone("no_data"), "neutral");
  assert.equal(plannedRoadOwnershipStatusTone("confirmed_public"), "evidence");
});

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

test("inconsistent targeted status and evidence source never invent land-register evidence", () => {
  for (const inconsistent of [
    { ...targeted, evidence_source: "cadastre" as const },
    { ...targeted, verification_status: "mixed_public" as const, evidence_source: "none" as const },
    { ...targeted, verification_status: "private_or_other" as const, evidence_source: "cadastre" as const, public_entities: [] },
  ]) {
    const result = resolvePlannedRoadOwnership(inconsistent, null);
    assert.equal(result.ownership_status, "unresolved");
    assert.equal(result.ownership_evidence, "none");
    assert.deepEqual(result.public_entities, []);
  }
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

test("dossier facts retain recognized sanitized public entity labels", () => {
  assert.deepEqual(
    plannedRoadParcelDossierFacts({
      ...base,
      ownership_status: "confirmed_public",
      ownership_evidence: "land_register",
      public_entities: [
        { id: "grad-split", label: "Grad Split", category: "city" },
      ],
      ownership_checked_at: "2026-08-02",
    }),
    [
      "Planirana cesta zahvaća 315 m² · 25,2 % čestice",
      "Vlasništvo: potvrđeno javno — zk",
      "Javni subjekt: Grad Split",
    ],
  );
});

test("all planned-road parcels are a resident question with the road footprint beneath them", () => {
  const view = MAP_VIEWS.find((candidate) => candidate.id === "cestice-planiranih-cesta");
  assert.deepEqual(
    view && { razina: view.razina, layerIds: view.layerIds },
    {
      razina: "pitanje",
      layerIds: ["gup-2024-planirane-ceste", "cestice-planiranih-cesta"],
    },
  );
  const parcels = OVERLAY_LAYERS.find((candidate) => candidate.id === "cestice-planiranih-cesta");
  assert.equal(parcels?.url, "/geo/analiza/cestice-planiranih-cesta.geojson");
  const roads = OVERLAY_LAYERS.find((candidate) => candidate.id === "gup-2024-planirane-ceste");
  assert.equal(roads?.url, "/geo/planovi/gup-2024-promet.geojson");
  const pane = (layer: typeof roads) => ({
    pane: layer?.pane,
    paneZIndex: layer?.paneZIndex,
  });
  assert.deepEqual(pane(roads), {
    pane: "planirane-ceste-podloga",
    paneZIndex: 410,
  });
  assert.deepEqual(pane(parcels), {
    pane: "planirane-ceste-cestice",
    paneZIndex: 420,
  });
});

test("parcel dossier returns the same planned-road impact and ownership evidence", async () => {
  const collection = JSON.parse(
    await readFile("public/geo/analiza/cestice-planiranih-cesta.geojson", "utf8"),
  ) as FeatureCollection<Polygon, PlannedRoadParcelProperties>;
  const selected = collection.features.find(
    (feature) => feature.properties.parcel_id === "SPLIT:273/1",
  );
  assert.ok(selected);
  const [lng, lat] = pointOnFeature(selected).geometry.coordinates;
  const dossier = await dosjeZaTocku(lng, lat);
  assert.equal(dossier.planiranaCestaCestica?.parcel_id, "SPLIT:273/1");
  assert.equal(
    dossier.planiranaCestaCestica?.road_overlap_m2,
    selected.properties.road_overlap_m2,
  );
  assert.equal("owner" in (dossier.planiranaCestaCestica ?? {}), false);
});
