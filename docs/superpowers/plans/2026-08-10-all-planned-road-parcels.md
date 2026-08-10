# All Planned-Road Parcels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/karta` question that displays all 338 parcels intersecting any GUP 2024 planned-road polygon and marks only the ownership evidence already available in sanitized local artifacts.

**Architecture:** A local TypeScript generator intersects the committed cadastral and GUP geometries, then joins the two existing sanitized ownership layers by canonical parcel ID without making network requests. A browser-safe domain module owns the closed schema, evidence precedence, conflict detection, filtering, summaries, and dossier copy; the existing Leaflet client renders the generated layer and the original road footprint, while the server-side dossier reads the same artifact.

**Tech Stack:** Next.js 16.2 App Router, React 19 client components, TypeScript, Leaflet, Turf 7, Node test runner through `tsx --test`.

## Global Constraints

- Work only in `/Users/tomo/projects/kvart/.worktrees/all-planned-road-parcels` on `feature/all-planned-road-parcels`.
- Include every cadastral parcel whose summed polygon intersection with `public/geo/planovi/gup-2024-promet.geojson` is at least `1 m²`; current invariant: `338` parcels from `532` road polygons and `1,314` cadastral geometries.
- Do not include GUP 2015, DPU, or existing-road geometry in this view.
- Do not make any ownership network request during generation, build, or map use.
- Reuse only `ciljana-provjera-vlasnistva.geojson` and `javne-cestice.geojson`; current invariant: `54` parcels with at least one record and `284` with `no_data`.
- Preserve land-register precedence, retain mixed ownership as `mixed_public`, and expose sanitized source conflicts instead of silently choosing the City GIS record.
- Never publish private names, addresses, OIBs, shares, encumbrances, or raw OSS responses.
- Keep all 338 parcels visible by default; only an explicit filter may hide `no_data`.
- Add no new runtime dependency.
- Follow `DESIGN.md` tokens and Croatian numeral forms.
- Before editing the client component, honor `AGENTS.md`; the installed Next.js 16 guidance has been read from `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`. Keep filesystem work out of the client dependency graph and pass only serializable data.

---

### Task 1: Ownership contract, precedence, filters, and privacy validation

**Files:**
- Create: `src/lib/planned-road-parcels.ts`
- Create: `tests/planned-road-parcels.test.ts`

**Interfaces:**
- Consumes: `TargetedOwnershipProperties` and `SanitizedPublicEntity` from `src/lib/targeted-ownership.ts`; `PublicParcelProperties` from `src/lib/public-parcels.ts`.
- Produces: `PlannedRoadParcelProperties`, `PlannedRoadParcelFilters`, `resolvePlannedRoadOwnership(targeted, cityGis)`, `validatePlannedRoadParcelProperties(value)`, `matchesPlannedRoadParcel(properties, filters)`, `summarizePlannedRoadParcels(features, filters)`, and `plannedRoadParcelDossierFacts(properties)`.

- [ ] **Step 1: Write failing contract and precedence tests**

Create `tests/planned-road-parcels.test.ts` with a valid base record and focused cases:

```ts
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
```

- [ ] **Step 2: Run the new test and verify the module-not-found failure**

Run: `npm test -- tests/planned-road-parcels.test.ts`

Expected: FAIL because `src/lib/planned-road-parcels.ts` does not exist.

- [ ] **Step 3: Implement the closed browser-safe domain module**

Create `src/lib/planned-road-parcels.ts` with these exact public types:

```ts
export type PlannedRoadOwnershipStatus =
  | "confirmed_public"
  | "mixed_public"
  | "cadastre_public"
  | "city_gis_public"
  | "not_confirmed_public"
  | "unresolved"
  | "no_data";

export type PlannedRoadOwnershipEvidence =
  | "land_register"
  | "cadastre"
  | "city_gis"
  | "none";

export interface PlannedRoadParcelProperties {
  parcel_id: string;
  parcel_number: string;
  cadastral_municipality: string;
  parcel_area_m2: number;
  mapped_area_m2: number;
  road_overlap_m2: number;
  road_overlap_percent: number;
  ownership_status: PlannedRoadOwnershipStatus;
  ownership_evidence: PlannedRoadOwnershipEvidence;
  public_entities: SanitizedPublicEntity[];
  has_evidence_conflict: boolean;
  secondary_evidence_labels: string[];
  source_updated_at: string;
  ownership_checked_at: string | null;
}

export interface PlannedRoadParcelFilters {
  statuses: PlannedRoadOwnershipStatus[];
}

export interface PlannedRoadOwnershipResult {
  ownership_status: PlannedRoadOwnershipStatus;
  ownership_evidence: PlannedRoadOwnershipEvidence;
  public_entities: SanitizedPublicEntity[];
  has_evidence_conflict: boolean;
  secondary_evidence_labels: string[];
  ownership_checked_at: string | null;
}

export function resolvePlannedRoadOwnership(
  targeted: TargetedOwnershipProperties | null,
  cityGis: PublicParcelProperties | null,
): PlannedRoadOwnershipResult;
```

Add label tables for all seven statuses and four evidence sources. Implement `resolvePlannedRoadOwnership` as a total decision table:

- land-register `confirmed_public`, `mixed_public`, or `private_or_other` maps to `confirmed_public`, `mixed_public`, or `not_confirmed_public` and always outranks GIS;
- `cadastre_public` maps to `cadastre_public` and outranks GIS;
- targeted `unresolved` plus GIS maps to `city_gis_public`, retains `"Ciljana provjera nije razriješena"`, and is not itself a conflict;
- GIS without stronger resolved evidence maps to `city_gis_public` and creates a sanitized public-entity label from `public_level`;
- targeted `unresolved` without GIS maps to `unresolved`;
- no input maps to `no_data`.

Set `has_evidence_conflict` only when resolved targeted evidence disagrees with an explicit GIS-public conclusion or when their public levels differ. Format GIS labels through existing `PUBLIC_LEVEL_LABELS` and the ownership-form labels. Validate exact property keys, finite non-negative overlap values, percentage `0..100`, ISO dates, enum membership, public-entity keys, and OIB-like values in every emitted string. Reuse pure matching and summary loops from the existing parcel modules; do not import `fs`, `path`, or any server-only module.

- [ ] **Step 4: Run focused tests until all contract cases pass**

Run: `npm test -- tests/planned-road-parcels.test.ts`

Expected: all seven tests PASS.

- [ ] **Step 5: Commit the domain contract**

```bash
git add src/lib/planned-road-parcels.ts tests/planned-road-parcels.test.ts
git commit -m "feat: model planned road parcel evidence"
```

---

### Task 2: Offline intersection generator and production artifact

**Files:**
- Create: `scripts/generate-planned-road-parcels.ts`
- Create: `tests/generate-planned-road-parcels.test.ts`
- Create: `public/geo/analiza/cestice-planiranih-cesta.geojson`
- Create: `public/geo/analiza/cestice-planiranih-cesta.manifest.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `resolvePlannedRoadOwnership` and `validatePlannedRoadParcelProperties` from Task 1; the four committed GeoJSON inputs named in Global Constraints.
- Produces: `derivePlannedRoadParcel(parcel, roads, targetedById, cityGisById, sourceUpdatedAt)`, `generatePlannedRoadParcels(allowScopeDrift?)`, the `generate-planned-road-parcels` npm script, and two committed public artifacts.

- [ ] **Step 1: Write failing spatial-selection tests with invented polygons**

Create `tests/generate-planned-road-parcels.test.ts`. Use small Turf-compatible squares and assert:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  derivePlannedRoadParcel,
  generatePlannedRoadParcels,
} from "../scripts/generate-planned-road-parcels";
import { validatePlannedRoadParcelProperties } from "../src/lib/planned-road-parcels";

const square = (west: number, south: number, east: number, north: number, properties: Record<string, unknown>): Feature<Polygon> => ({
  type: "Feature",
  properties,
  geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
});

test("a parcel enters only when planned-road overlap reaches one square metre", () => {
  const parcel = square(16.49, 43.52, 16.491, 43.521, { ko: "SPLIT", cestica: "1/1", povrsina: 8_000 });
  const noRoads: Feature<Polygon>[] = [];
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
```

- [ ] **Step 2: Run the generator test and verify the missing-module failure**

Run: `npm test -- tests/generate-planned-road-parcels.test.ts`

Expected: FAIL because `scripts/generate-planned-road-parcels.ts` does not exist.

- [ ] **Step 3: Implement the local-only generator**

Create `scripts/generate-planned-road-parcels.ts` following the existing generators, with constants:

```ts
const PARCELS = path.join(ROOT, "public", "geo", "grad", "katastar.geojson");
const ROADS = path.join(ROOT, "public", "geo", "planovi", "gup-2024-promet.geojson");
const TARGETED = path.join(ROOT, "public", "geo", "analiza", "ciljana-provjera-vlasnistva.geojson");
const CITY_GIS = path.join(ROOT, "public", "geo", "analiza", "javne-cestice.geojson");
const OUTPUT = path.join(ROOT, "public", "geo", "analiza", "cestice-planiranih-cesta.geojson");
const MANIFEST = path.join(ROOT, "public", "geo", "analiza", "cestice-planiranih-cesta.manifest.json");
const MIN_ROAD_OVERLAP_M2 = 1;
const EXPECTED_ROAD_POLYGONS = 532;
const EXPECTED_PARCELS = 1_314;
const EXPECTED_SELECTED = 338;
const EXPECTED_WITH_EVIDENCE = 54;
const SOURCE_UPDATED_AT = "2025-10-03";
```

Read polygon inputs with strict geometry filtering. Build `Map<string, properties>` indexes for both ownership inputs. Use bbox rejection before Turf `intersect(featureCollection([parcel, road]))`; sum each positive intersection, round square metres to one decimal, and calculate `road_overlap_percent` against the full `povrsina` attribute, capped at `100` and rounded to one decimal. Return `null` below 1 m². Normalize IDs exactly as the targeted generator does: uppercase municipality, whitespace-free parcel number.

`generatePlannedRoadParcels(false)` must reject any change to `532`, `1_314`, `338`, or `54`. The exported boolean `allowScopeDrift` bypasses only count checks, never validation. The module must contain no `fetch`, URL, OSS host, or browser automation. `main()` writes compact newline-terminated GeoJSON and a formatted manifest with source paths, thresholds, input counts, selected count, and counts for all ownership statuses.

Add to `package.json`:

```json
"generate-planned-road-parcels": "tsx scripts/generate-planned-road-parcels.ts"
```

- [ ] **Step 4: Generate the production artifact and inspect the reported counts**

Run: `npm run generate-planned-road-parcels`

Expected output includes `338 čestica`, `54 s vlasničkim zapisom`, and `284 bez podataka`.

- [ ] **Step 5: Run focused tests and privacy scans**

Run: `npm test -- tests/planned-road-parcels.test.ts tests/generate-planned-road-parcels.test.ts`

Run: `rg -n 'owner|address|oib|taxNumber|zk_vlasnik|zk_teret|lrOwners|possessors|ownershipSheetB|[0-9]{11}' public/geo/analiza/cestice-planiranih-cesta.geojson`

Expected: tests PASS; `rg` prints nothing.

- [ ] **Step 6: Commit generator and artifacts**

```bash
git add package.json scripts/generate-planned-road-parcels.ts tests/generate-planned-road-parcels.test.ts public/geo/analiza/cestice-planiranih-cesta.geojson public/geo/analiza/cestice-planiranih-cesta.manifest.json
git commit -m "feat: generate all planned road parcels"
```

---

### Task 3: Dedicated map question, road footprint, status styles, and filters

**Files:**
- Modify: `src/lib/map-views.ts`
- Modify: `src/components/karta/map-client.tsx`
- Modify: `scripts/check-layers.ts`
- Modify: `tests/planned-road-parcels.test.ts`

**Interfaces:**
- Consumes: `PlannedRoadParcelProperties`, `PlannedRoadParcelFilters`, validators, label tables, matcher, and summarizer from Task 1; `/geo/analiza/cestice-planiranih-cesta.geojson` from Task 2.
- Produces: overlay IDs `gup-2024-planirane-ceste` and `cestice-planiranih-cesta`, view ID `cestice-planiranih-cesta`, and `PlaniraneCesteFilteri` inside the existing client component.

- [ ] **Step 1: Add failing registry assertions**

Extend `tests/planned-road-parcels.test.ts`:

```ts
import { MAP_VIEWS, OVERLAY_LAYERS } from "../src/lib/map-views";

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
});
```

- [ ] **Step 2: Run the registry test and verify it fails**

Run: `npm test -- tests/planned-road-parcels.test.ts`

Expected: FAIL because the new view and layers are absent.

- [ ] **Step 3: Register the two layers and resident question**

In `src/lib/map-views.ts`, register the GUP 2024 road footprint as a phase-1 GeoJSON layer and the generated parcels as a phase-1 GeoJSON layer. Add the question after `javno-evidentirano`:

```ts
{
  id: "cestice-planiranih-cesta",
  label: "Čestice na planiranim cestama",
  razina: "pitanje",
  description:
    "Svih 338 čestica koje planirani prometni koridori nacrta GUP-a 2024. " +
    "zahvaćaju za najmanje 1 m². Vlasništvo je označeno samo za 54 čestice " +
    "s već raspoloživim sanitiziranim zapisom; za ostale se izričito kaže " +
    "da podataka nema.",
  layerIds: ["gup-2024-planirane-ceste", "cestice-planiranih-cesta"],
},
```

Insert `"cestice-planiranih-cesta"` immediately after
`"javno-evidentirano"` in `REDOSLIJED_PITANJA`; otherwise its missing index
would sort it ahead of the intended first question.

Remove `/geo/planovi/gup-2024-promet.geojson` from the `namjerno` map in `scripts/check-layers.ts`, because it is now a registered production overlay rather than only an input.

- [ ] **Step 4: Add client data state and cached loading**

In `map-client.tsx`, import the Task 1 browser-safe module. Add:

```ts
const PLANIRANE_CESTE_CESTICE_URL = "/geo/analiza/cestice-planiranih-cesta.geojson";
const POCETNI_FILTRI_PLANIRANIH_CESTA: PlannedRoadParcelFilters = { statuses: [] };
```

Add state for filters and validated features, a sorted JSON filter key, and a cache-sharing `useEffect` matching the existing public-parcel effects. Thread `features`, `filters`, setter, and retry callback through both Sidebar call sites and its prop type. Recreate only `cestice-planiranih-cesta` when this filter key changes.

- [ ] **Step 5: Filter and style the Leaflet layer without making color the only cue**

Extend `dodajSloj` with a third optional filter type and use `validatePlannedRoadParcelProperties` plus `matchesPlannedRoadParcel` in the GeoJSON filter.

For `gup-2024-planirane-ceste`, mark the layer noninteractive and use a restrained road footprint: dark outline, pale neutral fill, and an obviously dashed line. For parcel statuses use exact `DESIGN.md` status tokens already present in the application:

- `confirmed_public`: strong green fill, solid 3px outline;
- `mixed_public`: purple fill, `8 5` dash;
- `cadastre_public`: blue fill, `6 4` dash;
- `city_gis_public`: lighter green fill, `10 5` dash;
- `not_confirmed_public`: neutral gray fill and solid outline;
- `unresolved`: amber outline, `2 5` dash;
- `no_data`: very light neutral fill and thin gray outline.

When `has_evidence_conflict` is true, override the primary dash with a high-contrast `3 3` conflict outline while retaining the text label in the panel and dossier. Keep the original full parcel geometry; do not draw only the intersection cut.

- [ ] **Step 6: Add the visible 338-parcel summary and simple status filter**

Render `PlaniraneCesteFilteri` only for view `cestice-planiranih-cesta`. It must show:

- heading `Čestice na planiranim cestama`;
- badge `338 čestica`;
- live summary from `summarizePlannedRoadParcels` with count and road-overlap hectares;
- seven checkbox rows with Croatian labels and unfiltered counts;
- retry state using the established red error panel;
- empty-filter result copy;
- reset button only when statuses are selected;
- footer: `Vlasništvo je označeno samo iz postojećih sanitiziranih zapisa. Nova provjera nije provedena.`

Do not hide `no_data` initially. Use 44px minimum targets and existing `fokus`, `meta`, status-ground, border, and typography patterns.

- [ ] **Step 7: Run unit tests, layer validation, lint, and type checking**

Run: `npm test -- tests/planned-road-parcels.test.ts tests/generate-planned-road-parcels.test.ts`

Run: `npm run check-layers`

Run: `npm run lint`

Run: `npx tsc --noEmit`

Expected: all commands exit 0; layer validation reports both new GeoJSON overlays as valid.

- [ ] **Step 8: Commit the map view**

```bash
git add src/lib/map-views.ts src/components/karta/map-client.tsx scripts/check-layers.ts tests/planned-road-parcels.test.ts
git commit -m "feat: map every planned road parcel"
```

---

### Task 4: Consolidated parcel dossier answer

**Files:**
- Modify: `src/lib/dosje-oblik.ts`
- Modify: `src/lib/dosje.ts`
- Modify: `src/components/karta/map-client.tsx`
- Modify: `tests/planned-road-parcels.test.ts`

**Interfaces:**
- Consumes: generated planned-road properties and `plannedRoadParcelDossierFacts` from Tasks 1–2.
- Produces: `Dosje.planiranaCestaCestica: PlannedRoadParcelProperties | null` and a single consolidated planned-road dossier card.

- [ ] **Step 1: Write a failing real-artifact dossier test**

Append:

```ts
import { readFile } from "node:fs/promises";
import { pointOnFeature } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import { dosjeZaTocku } from "../src/lib/dosje";

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
```

- [ ] **Step 2: Run the dossier test and verify the missing-field failure**

Run: `npm test -- tests/planned-road-parcels.test.ts`

Expected: FAIL because `Dosje` has no `planiranaCestaCestica` property.

- [ ] **Step 3: Add server lookup and the shared serializable field**

Import `PlannedRoadParcelProperties` into `dosje-oblik.ts` and add:

```ts
/** Sanitizirani zahvat planirane ceste i već raspoloživi vlasnički dokaz. */
planiranaCestaCestica: PlannedRoadParcelProperties | null;
```

In `dosje.ts`, load `/geo/analiza/cestice-planiranih-cesta.geojson`, use its cached bboxes and `booleanPointInPolygon`, validate the selected properties, and return the field. A malformed record must be ignored, matching the safety behavior of both existing ownership layers.

- [ ] **Step 4: Render one consolidated dossier card**

Add `PlaniranaCestaCesticaOdgovor`. Its heading is `Planirana cesta i vlasništvo`; its badge uses the Task 1 ownership label; its body uses `plannedRoadParcelDossierFacts`. If `has_evidence_conflict`, add a visible amber sentence `Dostupni izvori nisu međusobno usklađeni.` followed by the sanitized secondary evidence labels.

The footer must say:

```text
Informativni prikaz nacrta GUP-a 2024. Vlasništvo nije ponovno provjeravano; službeni zapis provjeri na Uređenoj zemlji.
```

When `dosje.planiranaCestaCestica` exists, render this consolidated card instead of the older separate targeted/GIS cards, preventing duplicate and possibly contradictory ownership summaries. Retain the old cards for parcels outside the generated road layer.

- [ ] **Step 5: Run dossier and full tests**

Run: `npm test -- tests/planned-road-parcels.test.ts`

Run: `npm test`

Expected: focused and full suites PASS.

- [ ] **Step 6: Commit dossier integration**

```bash
git add src/lib/dosje-oblik.ts src/lib/dosje.ts src/components/karta/map-client.tsx tests/planned-road-parcels.test.ts
git commit -m "feat: explain planned road impact in parcel dossier"
```

---

### Task 5: Production and browser verification

**Files:**
- Modify only if verification reveals an in-scope defect: files from Tasks 1–4

**Interfaces:**
- Consumes: the complete feature.
- Produces: verified desktop/mobile behavior and a clean, reviewable branch.

- [ ] **Step 1: Run the complete automated verification from a clean process**

Run:

```bash
npm run generate-planned-road-parcels
npm test
npm run lint
npx tsc --noEmit
npm run check-layers
npm run build
git diff --check
```

Expected: every command exits 0; tests report at least the original 20 plus all new cases; the build completes without requiring Postgres.

- [ ] **Step 2: Start the isolated local server**

Run: `npm run dev -- --port 3002`

Open: `http://localhost:3002/karta?pogled=cestice-planiranih-cesta`

- [ ] **Step 3: Verify the desktop flow in Ego Browser**

At `1440×1000`, confirm:

- the dedicated question is directly selectable;
- all-status summary is `338 čestica` and the road footprint sits beneath parcels;
- ownership counts total 338 and include `284` for no data;
- selecting one status changes both drawn feature count and live summary;
- resetting restores 338;
- a known public parcel opens a card with source and road impact;
- a `no_data` parcel explicitly says ownership data is unavailable;
- a conflicting parcel shows the conflict warning and both sanitized conclusions;
- no horizontal overflow or hidden primary controls.

- [ ] **Step 4: Verify the mobile flow in Ego Browser**

At `390×844`, confirm the question, summary, status controls, map, dossier, focus behavior, and 44px targets remain usable without the panel covering the selected parcel after opening its dossier.

- [ ] **Step 5: Run an Impeccable finish audit on the changed UI**

Audit the new view against `DESIGN.md`: typography hierarchy, status-token usage, neutral `no_data` treatment, visible conflict state, mobile density, focus rings, and Croatian copy. Fix only issues in this feature; preserve intentional pre-existing map styles.

- [ ] **Step 6: Re-run affected checks after any visual fix and commit**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build && git diff --check`

If verification caused changes:

```bash
git add src/lib/planned-road-parcels.ts scripts/generate-planned-road-parcels.ts src/lib/map-views.ts src/lib/dosje-oblik.ts src/lib/dosje.ts src/components/karta/map-client.tsx tests/planned-road-parcels.test.ts tests/generate-planned-road-parcels.test.ts public/geo/analiza/cestice-planiranih-cesta.geojson public/geo/analiza/cestice-planiranih-cesta.manifest.json
git commit -m "fix: polish planned road parcel view"
```

- [ ] **Step 7: Confirm branch hygiene**

Run: `git status --short --branch`

Expected: clean worktree on `feature/all-planned-road-parcels`; no untracked cache, raw ownership response, private GIS source, or unrelated file.
