# Publicly Owned Parcels — Design Specification

- **Status:** Approved design
- **Date:** 2026-08-02
- **Product:** Naš kvart — Dračevac i Bilice
- **Primary surface:** `/karta`

## Decision summary

Add a focused map question, **“Što je javno?”**, that makes every parcel with any public ownership easy to identify and filter by:

- purpose under the newer 2024 draft plan; and
- a simple built/unbuilt state.

Ownership acquisition happens only in a local refresh workflow based on Katica’s open-source request flow. The deployed product receives a sanitized, precomputed GeoJSON layer. Raw ownership records, private owner names, OIBs, ownership burdens, and similar private data are never committed or deployed.

## Context and evidence

The existing map already organizes high-value tasks as citizen questions, including “Gdje se može graditi?”, “Što se promijenilo?”, and “Što vrijedi ovdje?”. It also already contains:

- parcel geometry and cadastral identifiers;
- the newer 2024 draft-plan purpose geometry;
- several building-footprint datasets; and
- a local-only ownership import with an initial public-owner classifier.

The current map was inspected with Ego Browser at desktop and 390 × 844 mobile widths. On mobile, the left map panel already behaves as the primary task surface and occupies nearly the full width. The public-parcels experience should therefore reuse the existing question-mode panel instead of adding another floating panel or a separate page.

The installed Chrome extension was identified as **Katica — zna čija je to zemlja**, version 0.14.1. Katica keeps owner data only in memory and does not provide an export path. It fetches visible parcels and registered owners through the same public application flow a person triggers on Uređena zemlja. Ego Browser can see the user’s Chrome extension profile, but Katica did not inject into the isolated Ego task-space tab. The reliable integration boundary is therefore Katica’s open-source acquisition method, not its browser UI.

## Goals

1. Make publicly owned parcels visually obvious without requiring knowledge of GIS layer names.
2. Include all forms of public ownership:
   - the Republic of Croatia;
   - the City of Split and other cities or municipalities;
   - counties and other government bodies;
   - public-good and general-use land;
   - public institutions;
   - publicly owned companies; and
   - mixed public/private ownership.
3. Let residents filter the result by newer-plan purpose and built/unbuilt state with minimal controls.
4. Preserve a clear distinction between fully public and mixed public/private parcels.
5. Keep private ownership data out of the public repository, browser payload, and deployment.
6. Keep the feature fast and useful on phones and slower connections.
7. Make the data’s source, date, plan status, and informational nature explicit.

## Non-goals

- Publishing or searching private owner names.
- Publishing OIBs, mortgages, liens, easements, burdens, addresses of owners, or private ownership shares.
- Providing a legally authoritative land-registry extract.
- Querying Uređena zemlja from an end user’s browser at runtime.
- Keeping ownership synchronized in real time.
- Rebuilding Katica as a browser extension.
- Comparing the 2024 draft with the currently effective 2015 plan in this mode.
- Introducing a three-level built-state model; the user explicitly selected a binary model.

## Primary user flow

1. The resident opens `/karta`.
2. They choose **“Što je javno?”** in the existing **PITANJA** group.
3. The public-parcels layer turns on and unrelated analytical layers are visually de-emphasized.
4. The panel shows the total matching parcel count and area.
5. The resident optionally filters by plan purpose and/or built state.
6. Map results and totals update immediately.
7. The resident selects a parcel.
8. The existing parcel dossier opens with ownership classification, purpose, built state, source, and verification link.
9. The resident can reset filters or leave the question mode using the established map controls.

## Interaction design

### Entry point

Add **“Što je javno?”** as the fourth question chip. It has equal visual weight to the existing three questions and uses the same active/inactive behavior.

Activating the question establishes a focused view rather than merely toggling another checkbox in the 113-layer catalogue. The mode should restore its own intended layers and copy when selected, consistent with the existing question modes.

### Focused panel

The question-mode content is ordered as follows:

1. a one-sentence explanation;
2. a live summary, for example **“128 javnih čestica · 31,4 ha”**;
3. purpose filter;
4. built-state segmented control;
5. compact ownership legend;
6. **“Poništi filtre”**, visible only when a filter is active;
7. the active public-parcels layer row; and
8. the existing parcel search.

The full generic layer catalogue remains reachable through the existing “Načini gledanja”/layer affordances but must not sit between the question and its filters.

### Purpose filter

Label: **“Namjena prema planu 2024. (nacrt)”**.

The control lists purpose categories present in the public-parcel dataset, in Croatian, with the official plan code retained alongside the understandable label. Each option includes its current parcel count. Only categories that occur in the current data are shown.

Behavior:

- default is all purposes;
- multiple purposes may be selected;
- a parcel matches if any of its meaningful purpose overlaps is selected;
- a parcel without a matched purpose is available under **“Namjena nije određena”**;
- changing the filter updates the map, count, and total area without an explicit apply button.

### Built-state filter

Label: **“Izgrađenost”**.

Use a three-option segmented control:

- **Sve**
- **Izgrađeno**
- **Neizgrađeno**

The underlying data remains boolean. “Sve” means the filter is not applied.

### Map presentation

The map should answer “which land is public?” before it explains ownership subtypes.

- **Fully public:** solid olive fill with a clear dark outline.
- **Mixed public/private:** lighter olive fill plus a dashed outline or pattern.
- **Selected parcel:** the established selected-feature treatment, strengthened enough to remain visible over both public styles.
- **Non-matching public parcels after filtering:** hidden rather than shown as faint results.
- **Non-public parcels:** not included in this layer or browser payload.

Olive is appropriate here because the product system reserves it for action/affiliation and the fill communicates public affiliation. Full and mixed ownership must also differ through pattern or outline, not color alone.

At low zoom, avoid owner labels and dense parcel numbers. Geometry and the summary carry the overview. Detailed labels appear only through selection/dossier or the map’s existing zoom-dependent parcel labeling.

### Parcel dossier

Extend the existing parcel dossier with a **“Javno vlasništvo”** section containing:

- parcel number;
- cadastral municipality;
- **“Potpuno javno”** or **“Mješovito javno/privatno”**;
- public owner names only;
- public-owner categories when helpful;
- predominant 2024 draft-plan purpose and official code;
- other meaningful purpose overlaps, when present;
- **“Izgrađeno”** or **“Neizgrađeno”**;
- ownership-data check date;
- generated-layer date;
- source attribution; and
- **“Provjeri na Uređenoj zemlji”** link.

For mixed parcels, show only **“Postoje i privatni suvlasnici”**. Do not publish their names, counts, shares, OIBs, or other identifying details.

### Mobile behavior

The existing map panel is the primary mobile surface. The public filters should fit within that same scrollable panel:

- summary and built-state control remain near the top;
- purpose options use full-width, at least 44 px touch targets;
- filter labels do not rely on hover help;
- selecting a parcel opens the existing mobile dossier behavior;
- closing/collapsing the panel exposes the map without losing filter state.

Do not introduce a second bottom sheet over the existing panel.

### States and feedback

**Loading:** show a concise layer-loading status in the focused panel; keep controls disabled until data is available.

**No matches:** show **“Nema javnih čestica za odabrane filtre.”** and a single **“Poništi filtre”** action. Keep the map context visible.

**Layer load failure:** show a retry action and retain the rest of the map. Do not silently fall back to raw ownership data or live OSS calls.

**Missing purpose:** retain the parcel under “Namjena nije određena” and explain the missing overlay in the dossier.

**Ambiguous ownership:** do not publish the parcel until the local review process classifies it.

## Data design

### Private raw input

Raw ownership data is local-only input. Existing protections for `public/geo/grad/katastar-vlasnistvo.geojson` remain in `.gitignore` and `.vercelignore`. A refresh implementation must also write any new raw responses, caches, and review files into explicitly ignored local paths.

Raw records may be used transiently to classify public ownership but must never be copied wholesale into tests, fixtures, logs, snapshots, build artefacts, or error messages.

### Public-owner classification

A parcel qualifies when at least one registered owner or authoritative ownership status maps to a public entity/category.

Evidence is evaluated in this order:

1. registered land-registry owners;
2. an authoritative public/public-good ownership status; and
3. cadastral possessors only as a review lead, never as proof of ownership.

Katica falls back to cadastral possessors when it cannot retrieve registered land-registry owners. The refresh workflow must preserve that distinction. A public cadastral possessor without corroborating ownership evidence goes to the ignored review report and is not published as a publicly owned parcel.

Classification combines:

1. explicit source status such as JLS/public-good status;
2. normalized-name rules for government levels and public-good terms;
3. a versioned allowlist of public institutions and publicly owned companies, with category, verification source, and review date; and
4. a local ambiguity report for unmatched organization-like owners.

Names are normalized for case, whitespace, punctuation, Croatian diacritics, and common legal-form suffixes before comparison. Rules should be deterministic and covered by fixtures containing invented or public-entity-only names.

Ownership scope:

- `full_public`: every resolved owner is public, or the authoritative source status declares the parcel public with no contradictory owner record;
- `mixed_public_private`: at least one owner is public and at least one other owner is private, unresolved, or non-public.

An unresolved co-owner therefore makes the public parcel mixed, never fully public. Names of verified public legal entities may be published; non-public names may not.

### Purpose join

Use the newer 2024 draft-plan purpose geometry selected by the user, but reuse the repository’s corrected reconstruction from `scripts/slobodne-parcele.py` rather than intersecting parcels directly with the raw georeferenced 2024 sheet. The existing `namjena_po_kodu(2024)` path starts from the effective 2015 purpose geometry and applies only the verified polygons in `gup-promjene-2015-2024.geojson`; this removes known sheet-alignment slivers while preserving actual draft changes.

For each qualifying parcel:

1. intersect it with plan-purpose polygons;
2. calculate overlap area and percentage;
3. retain overlaps covering at least 1% of parcel area;
4. choose the largest retained overlap as the predominant purpose; and
5. preserve all retained purpose codes/labels for filtering and dossier disclosure.

If no overlap reaches 1%, mark purpose as unknown rather than guessing from a centroid. If multiple polygons carry the same purpose, combine their overlap before applying the threshold.

Every user-facing reference must say **“2024. nacrt”** or equivalent. It must not say or imply that the draft is in force.

### Built-state join

Reuse the existing combined building evidence used by `scripts/slobodne-parcele.py`:

- City buildings (2025);
- buildings with height data;
- cadastral objects; and
- the existing public building layer.

A parcel is `built: true` when a building footprint overlaps it by at least 1 m². Boundary-only contact and sub-square-metre geometry noise do not count. Otherwise it is `built: false`.

This is an informational map classification, not a legal statement about development status, building legality, or construction rights.

### Sanitized public GeoJSON

Generate one deployable feature collection, expected at:

`public/geo/analiza/javne-cestice.geojson`

Each feature may contain only:

| Field | Type | Meaning |
| --- | --- | --- |
| `parcel_id` | string | Stable join identifier without owner identity |
| `parcel_number` | string | Display parcel number |
| `cadastral_municipality` | string | Katastarska općina |
| `ownership_scope` | enum | `full_public` or `mixed_public_private` |
| `public_owner_names` | string[] | Public entities only |
| `public_owner_categories` | string[] | Government/public-good/institution/company categories |
| `ownership_evidence` | enum | `land_registry` or `authoritative_status` |
| `purpose_primary_code` | string or null | Predominant 2024 draft-plan code |
| `purpose_primary_label` | string or null | Predominant Croatian purpose label |
| `purposes` | object[] | Retained public code/label/overlap-percentage records |
| `built` | boolean | Binary building-footprint result |
| `ownership_checked_at` | ISO date | Source check date |
| `generated_at` | ISO date | Sanitized-layer generation date |

Geometry is the parcel geometry already suitable for public map display. Do not add raw owner objects, OIBs, private names, private-owner counts, ownership shares, burdens, addresses, API response bodies, or opaque source fields that may contain them.

The generator must fail closed when a forbidden key is present or when any non-public owner string would be emitted.

### Refresh workflow

The refresh command should be explicit and operator-run, not part of `next build` or deployment.

Expected phases:

1. acquire or read raw ownership locally using the Katica-compatible flow;
2. separate land-registry owners, authoritative statuses, and cadastral possessors;
3. normalize and classify eligible ownership evidence;
4. write an ignored ambiguity/review report, including possessor-only public leads;
5. stop if ambiguous classifications need a decision;
6. join approved public parcels with purpose and building data;
7. validate the public schema and forbidden-field rules;
8. write the sanitized GeoJSON; and
9. print counts for full public, mixed, built, unbuilt, unknown purpose, possessor-only exclusions, and classification changes since the prior generated layer.

The workflow must use conservative request concurrency and clear operator feedback. It should reuse Katica’s safeguards rather than turning the official site into a runtime dependency.

## Accessibility and visual quality

- All filters are keyboard operable and have programmatic labels.
- Touch targets are at least 44 × 44 px.
- Full versus mixed ownership is conveyed through text and line/pattern treatment, not color alone.
- Focus states meet WCAG AA contrast.
- Live count updates use a polite status region and do not steal focus.
- The selected parcel remains distinguishable in forced-colors/high-contrast contexts.
- Croatian copy uses plain resident-facing language; official codes are secondary evidence.
- Loading and empty states avoid spinner-only communication.
- Reduced-motion preferences are respected.

## Performance expectations

- The ownership layer is lazy-loaded only when “Što je javno?” or its layer is activated.
- Filtering happens client-side against the sanitized dataset and feels immediate after load.
- Geometry should use the repository’s existing map optimization approach without visibly changing parcel boundaries at normal interaction zooms.
- No request to Uređena zemlja occurs from deployed client code.
- Mobile verification includes a slower-network profile and the project’s target neighborhood extent.

## Attribution and disclaimer

The focused panel and dossier should identify ownership data as originating from **Uređena zemlja (One Stop Shop), Državna geodetska uprava and the competent justice/public-administration ministry**, with a checked date.

The dossier includes concise copy equivalent to:

> Informativni prikaz. Vlasništvo i namjena mogu se promijeniti; za službeni podatak provjerite Uređenu zemlju i važeću plansku dokumentaciju. Prikazana namjena je iz nacrta plana za 2024., koji nije plan na snazi.

Use a direct verification link when a stable official parcel URL can be formed. Otherwise link to the official cadastral map and display the parcel identifiers needed for verification.

## Acceptance criteria

1. “Što je javno?” is available with the existing map questions on desktop and mobile.
2. Activating it shows only sanitized public parcels and an updating count/area summary.
3. Fully public and mixed parcels are distinguishable without relying on color alone.
4. Every supported public-owner category qualifies, including public companies/institutions and mixed parcels.
5. Cadastral possession alone is never presented as ownership.
6. Purpose filtering uses retained overlaps from the 2024 draft and visibly labels the plan as a draft.
7. Built filtering supports exactly `Sve`, `Izgrađeno`, and `Neizgrađeno`.
8. A selected parcel dossier shows public names, ownership scope, plan purpose, built state, dates, attribution, and verification guidance.
9. No private owner name, OIB, burden, private-owner count/share, or raw ownership response is present in tracked files, browser network payloads, rendered HTML, source maps, logs, or build output.
10. The generator stops on ambiguous owner classifications or forbidden public-output keys.
11. Filtering and parcel selection work at a 390 × 844 viewport with accessible touch targets.
12. Existing map questions, general layer browsing, parcel search, and dossier behavior continue to work.
13. Automated tests cover classification, evidence precedence, possessor-only exclusion, sanitization, purpose overlap, built-state threshold, filter logic, and full/mixed presentation semantics.

## Verification strategy

- Unit fixtures for public-name normalization and every public-owner category.
- Negative fixtures with invented private names to prove sanitization and fail-closed behavior.
- Geometry fixtures for single purpose, multiple purposes, sub-1% slivers, unknown purpose, building overlap, and boundary-only building contact.
- A regression fixture proving raw 2024 sheet-alignment noise does not create a purpose change outside the verified change polygons.
- Schema validation of the generated GeoJSON.
- Repository/build scan for forbidden keys and representative private fixture strings.
- Component tests for filter combinations, counts, reset, loading, empty, and error states.
- Ego Browser verification of the complete question → filter → select → dossier flow at desktop and mobile widths.
- Visual check over ortho and street basemaps, including full, mixed, selected, and no-result states.

## Risks and mitigations

### Public-entity naming is inconsistent

Use normalized deterministic rules, a reviewed allowlist, and a blocking ambiguity report. Never classify unresolved organizations as fully public.

### Official endpoints or page behavior change

Keep acquisition local and separable from the product. A refresh failure leaves the last reviewed sanitized layer intact and cannot break the deployed map.

### Draft-plan status is misunderstood

Repeat “2024. nacrt” in the filter, dossier, attribution, and disclaimer. Do not use “na snazi” styling or language for this dataset.

### Mixed ownership is mistaken for fully available public land

Use a distinct pattern/outline, explicit “Mješovito javno/privatno” copy, and never imply that public ownership makes land freely usable or buildable.

### Public layer accidentally leaks private data

Use an allowlisted output schema, forbidden-key checks, fail-closed owner classification, build/repository scans, and private-name negative fixtures that never contain real people.

## Implementation boundary

This document approves the experience and data contract only. Implementation begins after user review of this committed specification and a separate implementation plan. Before editing Next.js or React code, the implementation session must read the relevant installed Next.js 16.2.10 guides under `node_modules/next/dist/docs/`, as required by `AGENTS.md`.
