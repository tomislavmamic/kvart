# Evidentirane javne čestice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe `/karta` question that maps and filters the 81 parcels explicitly marked JLS, RH, or DNŽ in the local City GIS export.

**Architecture:** A local TypeScript generator reads the ignored ownership GeoJSON derived from `SHP.zip`, intersects eligible geometries with the existing 2024 draft-purpose and building-footprint layers, validates a strict allowlisted schema, and writes one deployable GeoJSON. Browser-safe pure helpers own filtering and summaries; the existing Leaflet client recreates the small 81-feature layer from its cache when filters change. The server-side parcel dossier reads the same sanitized layer and returns a typed public-evidence section.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Leaflet 1.9, Turf 7, Node's built-in test runner through `tsx`.

## Global Constraints

- Read relevant installed guides in `node_modules/next/dist/docs/` before changing Next.js code.
- Ship only statuses `JLS`, `RH`, and `DNŽ`; unknown status never means private.
- Never emit source owner, burden, OIB, right, share, or note fields.
- Every planning-purpose label says `GUP 2024. (nacrt)` or equivalent.
- `built: false` is presented as `Nema evidentirani tlocrt`, not a legal conclusion.
- Preserve the established `/karta` visual world and one-panel mobile behavior.

---

### Task 1: Browser-safe public-parcel contract

**Files:**
- Create: `src/lib/public-parcels.ts`
- Create: `tests/public-parcels.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `PublicParcelProperties`, `PublicParcelFilters`, `matchesPublicParcel(properties, filters): boolean`, `summarizePublicParcels(features, filters): PublicParcelSummary`, `validatePublicParcelProperties(value): asserts value is PublicParcelProperties`.

- [ ] **Step 1: Write failing tests** for status allowlisting, forbidden keys, filter conjunction, unknown purpose, and literal count/area summaries.
- [ ] **Step 2: Run** `npm test -- tests/public-parcels.test.ts` and verify module-not-found failure.
- [ ] **Step 3: Implement the minimal pure module** with exact enums `city|state|county`, `ownership|coownership|unknown`, filter arrays, strict property-key equality, and Croatian labels.
- [ ] **Step 4: Run** `npm test -- tests/public-parcels.test.ts` and verify all cases pass.

### Task 2: Sanitized GIS generator

**Files:**
- Create: `scripts/generate-public-parcels.ts`
- Create: `tests/generate-public-parcels.test.ts`
- Create: `public/geo/analiza/javne-cestice.geojson`
- Modify: `package.json`

**Interfaces:**
- Consumes: strict properties and validation from Task 1.
- Produces: `derivePublicParcel(rawFeature, purposes, buildings, generatedAt): Feature<Polygon|MultiPolygon, PublicParcelProperties> | null` and command `npm run generate-public-parcels`.

- [ ] **Step 1: Write failing tests** using invented polygons: non-public source status is excluded, a 25% purpose overlap becomes primary, a sub-1% overlap stays unknown, a 1 m² building overlap sets `built`, and output keys exclude invented `zk_vlasnik`/`zk_teret` input.
- [ ] **Step 2: Run** `npm test -- tests/generate-public-parcels.test.ts` and verify export-not-found failure.
- [ ] **Step 3: Implement derivation** with Turf `intersect`/`area`, combined overlap by purpose code, four building inputs, deterministic sort by `parcel_id`, source date `2025-10-03`, and a final strict validation pass before `writeFile`.
- [ ] **Step 4: Run tests**, then `npm run generate-public-parcels`; verify 81 output features and print city/state/county, ownership/coownership, built/unbuilt, unknown-purpose counts.
- [ ] **Step 5: Scan the artifact** for forbidden keys and private-source values; fail if the strict schema or 81-feature source invariant is violated.

### Task 3: Map registration and focused filters

**Files:**
- Modify: `src/lib/map-views.ts`
- Modify: `src/components/karta/map-client.tsx`

**Interfaces:**
- Consumes: `/geo/analiza/javne-cestice.geojson`, pure filter/summary helpers.
- Produces: overlay `javne-cestice`, question view `javno-evidentirano`, and accessible `JavneCesticeFilteri` props `{features, filters, onFilters}`.

- [ ] **Step 1: Add a failing registry assertion** to `tests/public-parcels.test.ts` that finds the production overlay/view and checks the URL and question level.
- [ ] **Step 2: Run the focused test** and verify it fails because the registry entry is absent.
- [ ] **Step 3: Register the overlay and view** and add it to explicit question ordering after the buildability question.
- [ ] **Step 4: Add React state and lazy data loading** only while the view/layer is active; pass a stable filter key into overlay synchronization so a cached 81-feature `L.geoJSON` is rebuilt with Leaflet's `filter` option.
- [ ] **Step 5: Add focused controls** above parcel search: partial-evidence notice, polite live summary, public-level chips, purpose checkboxes, built-state segmented buttons, empty/reset states, and source/disclaimer copy. Use native controls, 44 px targets, visible focus, and established colors/spacing.
- [ ] **Step 6: Apply layer-specific style** by public level and dashed coownership outline; bind an informative popup and retain existing parcel-dossier click behavior.
- [ ] **Step 7: Run focused tests and lint** and fix only errors introduced by this task.

### Task 4: Public evidence in the parcel dossier

**Files:**
- Modify: `src/lib/dosje-oblik.ts`
- Modify: `src/lib/dosje.ts`
- Modify: `src/components/karta/map-client.tsx`
- Modify: `tests/public-parcels.test.ts`

**Interfaces:**
- Produces: `Dosje.javnaCestica: PublicParcelProperties | null` resolved by point-in-polygon against the sanitized layer.

- [ ] **Step 1: Add a failing pure formatting/shape test** showing that the dossier's public section distinguishes level, coownership, draft purpose, and missing building footprint without owner names.
- [ ] **Step 2: Run the test** and verify the missing dossier contract fails.
- [ ] **Step 3: Extend the dossier server contract** and load the sanitized layer through the existing cached GeoJSON path.
- [ ] **Step 4: Render `Javno vlasništvo — djelomična evidencija`** immediately after the primary purpose answer, including parcel/status/form, purpose, footprint evidence, source date, and concise official-verification disclaimer.
- [ ] **Step 5: Run tests and lint**.

### Task 5: Verification and visual review

**Files:**
- Modify if required by findings: files from Tasks 1–4

**Interfaces:**
- Produces: a verified desktop/mobile result the user can inspect locally.

- [ ] **Step 1: Run** `npm test`, `npm run lint`, `npm run check-layers`, and `npm run build`.
- [ ] **Step 2: Start** `npm run dev` and use Ego Browser at desktop width to activate the question, operate every filter, open a parcel dossier, reset, and inspect loading/empty/error behavior where reproducible.
- [ ] **Step 3: Repeat at 390 × 844**, checking one-panel composition, scroll, 44 px targets, copy overflow, map visibility, and focus order.
- [ ] **Step 4: Run the Impeccable finish review workflow** against the built result and apply only findings consistent with the approved visual world.
- [ ] **Step 5: Re-run the full verification suite**, capture the final browser URL/screenshot path, inspect `git diff --check` and `git status`, and report exact coverage and limitations.

## Self-review

- Spec coverage: data minimization, 81-feature invariant, three filters, live summary, map styling, dossier, states, accessibility, attribution, and desktop/mobile verification each map to Tasks 1–5.
- Placeholder scan: no TBD/TODO or deferred implementation step remains.
- Type consistency: `PublicParcelProperties` and `PublicParcelFilters` are the single shared contracts across generator, client, tests, and dossier.
