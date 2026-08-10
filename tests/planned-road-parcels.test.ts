import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pointOnFeature } from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  matchesPlannedRoadParcel,
  plannedRoadPanelToneClasses,
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
import {
  dossierMapBounds,
  MAP_VIEWS,
  OVERLAY_LAYERS,
  shouldIsolateMapBackground,
  syncDossierMapLayout,
} from "../src/lib/map-views";
import { dosjeZaTocku, nadiCestice } from "../src/lib/dosje";
import { GET as getParcelDossier } from "../src/app/api/cestica/route";

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

test("dossier map lifecycle reapplies layout across breakpoints and close", () => {
  type Bounds = [[number, number], [number, number]];
  const bounds: (Bounds | undefined)[] = [];
  const invalidations: { animate: boolean; pan: boolean }[] = [];
  const pans: {
    offset: [number, number];
    options: { animate: boolean; duration: number };
  }[] = [];
  const map = {
    invalidateSize: (options: { animate: boolean; pan: boolean }) =>
      invalidations.push(options),
    setMaxBounds: (next?: Bounds) => bounds.push(next),
    getSize: () => ({ x: 1_000, y: 800 }),
    latLngToContainerPoint: () => ({ x: 700, y: 600 }),
    panBy: (
      offset: [number, number],
      options: { animate: boolean; duration: number },
    ) => pans.push({ offset, options }),
  };

  syncDossierMapLayout(map, false, [43.522229, 16.505847], false);
  syncDossierMapLayout(map, true, [43.522229, 16.505847], false);
  syncDossierMapLayout(map, false, [43.522229, 16.505847], true);
  syncDossierMapLayout(map, false, null, false);

  assert.deepEqual(invalidations, [
    { animate: false, pan: false },
    { animate: false, pan: false },
    { animate: false, pan: false },
    { animate: false, pan: false },
  ]);
  assert.deepEqual(bounds, [
    [[43.514, 16.481], [43.536, 16.518]],
    undefined,
    [[43.514, 16.481], [43.536, 16.518]],
    [[43.514, 16.481], [43.536, 16.518]],
  ]);
  assert.deepEqual(pans, [
    { offset: [420, 200], options: { animate: false, duration: 0.4 } },
    { offset: [200, 464], options: { animate: false, duration: 0.4 } },
    { offset: [420, 200], options: { animate: true, duration: 0.4 } },
  ]);
});

test("mobile background isolation follows the presented dossier, not hydrated coordinates", () => {
  assert.equal(
    shouldIsolateMapBackground(true, {
      selected: true,
      presentation: "closed",
    }),
    false,
  );
  for (const presentation of ["loading", "resolved", "error"] as const) {
    assert.equal(
      shouldIsolateMapBackground(true, { selected: true, presentation }),
      true,
    );
    assert.equal(
      shouldIsolateMapBackground(false, { selected: true, presentation }),
      false,
    );
  }
});

test("missing planned-road ownership uses a neutral visual tone", () => {
  assert.equal(plannedRoadOwnershipStatusTone("no_data"), "neutral");
  assert.equal(plannedRoadOwnershipStatusTone("confirmed_public"), "evidence");
});

test("planned-road panel count and error tones use compiled utilities", () => {
  assert.equal(
    plannedRoadPanelToneClasses("count"),
    "bg-amber-100 text-amber-800",
  );
  assert.equal(
    plannedRoadPanelToneClasses("error"),
    "bg-rose-100 text-rose-800",
  );
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

test("validator accepts every coherent ownership decision", () => {
  const cases: PlannedRoadParcelProperties[] = [
    base,
    {
      ...base,
      ownership_status: "unresolved",
      secondary_evidence_labels: [],
    },
    {
      ...base,
      ownership_status: "confirmed_public",
      ownership_evidence: "land_register",
      public_entities: targeted.public_entities,
      ownership_checked_at: "2026-08-02",
    },
    {
      ...base,
      ownership_status: "mixed_public",
      ownership_evidence: "land_register",
      public_entities: targeted.public_entities,
      has_evidence_conflict: true,
      secondary_evidence_labels: [
        "GIS Grada: Republika Hrvatska · vlasništvo",
      ],
      ownership_checked_at: "2026-08-02",
    },
    {
      ...base,
      ownership_status: "cadastre_public",
      ownership_evidence: "cadastre",
      public_entities: targeted.public_entities,
      ownership_checked_at: "2026-08-02",
    },
    {
      ...base,
      ownership_status: "city_gis_public",
      ownership_evidence: "city_gis",
      public_entities: [
        {
          id: "city-gis-state",
          label: "Republika Hrvatska",
          category: "state",
        },
      ],
      secondary_evidence_labels: [
        "Ciljana provjera nije razriješena",
      ],
    },
    {
      ...base,
      ownership_status: "not_confirmed_public",
      ownership_evidence: "land_register",
      ownership_checked_at: "2026-08-02",
    },
  ];
  for (const record of cases) {
    assert.doesNotThrow(() => validatePlannedRoadParcelProperties(record));
  }
});

test("validator rejects contradictory status, evidence, and public entities", () => {
  const contradictory = [
    {
      ...base,
      ownership_status: "confirmed_public" as const,
    },
    {
      ...base,
      ownership_status: "no_data" as const,
      ownership_evidence: "city_gis" as const,
      public_entities: [
        {
          id: "city-gis-city",
          label: "Grad / JLS",
          category: "city" as const,
        },
      ],
    },
    {
      ...base,
      ownership_status: "not_confirmed_public" as const,
      ownership_evidence: "land_register" as const,
      public_entities: targeted.public_entities,
    },
  ];
  for (const record of contradictory) {
    assert.throws(
      () => validatePlannedRoadParcelProperties(record),
      /ownership|public_entities/i,
    );
  }
});

test("validator enforces canonical parcel identity and conflict coherence", () => {
  assert.throws(
    () =>
      validatePlannedRoadParcelProperties({
        ...base,
        parcel_id: "SPLIT:273/2",
      }),
    /parcel_id.*parcel_number/i,
  );
  assert.throws(
    () =>
      validatePlannedRoadParcelProperties({
        ...base,
        has_evidence_conflict: true,
      }),
    /conflict.*secondary/i,
  );
  assert.throws(
    () =>
      validatePlannedRoadParcelProperties({
        ...base,
        ownership_status: "city_gis_public",
        ownership_evidence: "city_gis",
        public_entities: [
          {
            id: "city-gis-city",
            label: "Grad / JLS",
            category: "city",
          },
        ],
        has_evidence_conflict: true,
        secondary_evidence_labels: ["Neprovjereni slobodni tekst"],
      }),
    /conflict|secondary/i,
  );
  for (const ownershipStatus of [
    "mixed_public",
    "not_confirmed_public",
  ] as const) {
    assert.throws(
      () =>
        validatePlannedRoadParcelProperties({
          ...base,
          ownership_status: ownershipStatus,
          ownership_evidence: "land_register",
          public_entities:
            ownershipStatus === "mixed_public"
              ? targeted.public_entities
              : [],
          has_evidence_conflict: false,
          secondary_evidence_labels: [
            "GIS Grada: Republika Hrvatska · vlasništvo",
          ],
          ownership_checked_at: "2026-08-02",
        }),
      /conflict|secondary/i,
    );
  }
});

test("validator derives resolved public-level conflicts from sanitized GIS evidence", () => {
  const cityEntity = [
    { id: "grad-split", label: "Grad Split", category: "city" as const },
  ];
  for (const ownershipStatus of [
    "confirmed_public",
    "cadastre_public",
  ] as const) {
    const evidence =
      ownershipStatus === "confirmed_public" ? "land_register" : "cadastre";
    const differing = {
      ...base,
      ownership_status: ownershipStatus,
      ownership_evidence: evidence,
      public_entities: cityEntity,
      secondary_evidence_labels: [
        "GIS Grada: Republika Hrvatska · vlasništvo",
      ],
      ownership_checked_at: "2026-08-02",
    };
    assert.throws(
      () =>
        validatePlannedRoadParcelProperties({
          ...differing,
          has_evidence_conflict: false,
        }),
      /has_evidence_conflict.*true/i,
    );
    assert.doesNotThrow(() =>
      validatePlannedRoadParcelProperties({
        ...differing,
        has_evidence_conflict: true,
      }),
    );

    const matching = {
      ...differing,
      secondary_evidence_labels: ["GIS Grada: Grad / JLS · vlasništvo"],
    };
    assert.doesNotThrow(() =>
      validatePlannedRoadParcelProperties({
        ...matching,
        has_evidence_conflict: false,
      }),
    );
    assert.throws(
      () =>
        validatePlannedRoadParcelProperties({
          ...matching,
          has_evidence_conflict: true,
        }),
      /has_evidence_conflict.*false/i,
    );
  }
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
  const dossier = await dosjeZaTocku(lng, lat, "SPLIT:273/1");
  assert.equal(dossier.planiranaCestaCestica?.parcel_id, "SPLIT:273/1");
  assert.equal(
    dossier.planiranaCestaCestica?.road_overlap_m2,
    selected.properties.road_overlap_m2,
  );
  assert.equal("owner" in (dossier.planiranaCestaCestica ?? {}), false);
});

test("exact parcel identity keeps dossier header and planned-road record aligned", async () => {
  const collection = JSON.parse(
    await readFile(
      "public/geo/analiza/cestice-planiranih-cesta.geojson",
      "utf8",
    ),
  ) as FeatureCollection<Polygon, PlannedRoadParcelProperties>;
  for (const parcelId of ["SPLIT:273/1", "SPLIT:276/1"]) {
    const selected = collection.features.find(
      (feature) => feature.properties.parcel_id === parcelId,
    );
    assert.ok(selected);
    const [lng, lat] = pointOnFeature(selected).geometry.coordinates;
    const dossier = await dosjeZaTocku(lng, lat, parcelId);
    assert.equal(
      `${String(dossier.cestica?.ko)}:${String(dossier.cestica?.cestica)}`,
      parcelId,
    );
    assert.equal(dossier.planiranaCestaCestica?.parcel_id, parcelId);
  }
});

test("coordinate-only dossier lookups remain supported and never mix parcel identities", async () => {
  const collection = JSON.parse(
    await readFile(
      "public/geo/analiza/cestice-planiranih-cesta.geojson",
      "utf8",
    ),
  ) as FeatureCollection<Polygon, PlannedRoadParcelProperties>;
  const selected = collection.features.find(
    (feature) => feature.properties.parcel_id === "SPLIT:273/1",
  );
  assert.ok(selected);
  const [lng, lat] = pointOnFeature(selected).geometry.coordinates;
  const dossier = await dosjeZaTocku(lng, lat);
  const headerId = dossier.cestica
    ? `${String(dossier.cestica.ko)}:${String(dossier.cestica.cestica)}`
    : null;
  assert.ok(
    dossier.planiranaCestaCestica === null ||
      dossier.planiranaCestaCestica.parcel_id === headerId,
  );
});

test("parcel search and API carry canonical identity into exact lookup", async () => {
  const hit = (await nadiCestice("273/1")).find(
    (candidate) => candidate.parcel_id === "SPLIT:273/1",
  );
  assert.ok(hit);
  assert.ok(hit.parcel_id);
  const response = await getParcelDossier(
    new Request(
      `http://localhost/api/cestica?lat=${hit.lat}&lng=${hit.lng}&parcel_id=${encodeURIComponent(hit.parcel_id)}`,
    ),
  );
  assert.equal(response.status, 200);
  const dossier = (await response.json()) as Awaited<
    ReturnType<typeof dosjeZaTocku>
  >;
  assert.equal(
    `${String(dossier.cestica?.ko)}:${String(dossier.cestica?.cestica)}`,
    "SPLIT:273/1",
  );
  assert.equal(dossier.planiranaCestaCestica?.parcel_id, "SPLIT:273/1");
});
