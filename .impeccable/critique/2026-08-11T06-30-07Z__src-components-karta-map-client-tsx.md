---
target: map — broader sweep
total_score: 23
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
timestamp: 2026-08-11T06-30-07Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: /root/critique_design_broad_snapshot, source review; live pass stalled · B: /root/critique_evidence, detector/browser)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 2 | Layer and dossier states are announced, but duplicate loading and view changes do not produce one clear “answer ready” state. |
| 2 | Match System / Real World | 2 | Local Croatian terminology is authentic, but the default “Gdje se može graditi?” overstates a narrower screening result. |
| 3 | User Control and Freedom | 3 | Panels close, Escape works, URLs restore most state, and filters reset; Back cannot undo view changes and filter state is incomplete. |
| 4 | Consistency and Standards | 3 | The control system is cohesive, but specialized views introduce several parallel selection models. |
| 5 | Error Prevention | 2 | Evidence caveats are strong, but framing can invite a high-stakes property conclusion and search failure can masquerade as no result. |
| 6 | Recognition Rather Than Recall | 2 | Five questions, nine modes, fourteen groups, plan-year controls, legends and evidence grades require a learned mental model. |
| 7 | Flexibility and Efficiency | 3 | Deep links, parcel search, layer search, URL restoration and keyboard controls are strong expert paths. |
| 8 | Aesthetic and Minimalist Design | 2 | Two desktop panels and the complete 113-layer instrument compete with the resident’s immediate question. |
| 9 | Error Recovery | 2 | Basemap/layer retries exist, but search failure is not distinguished from an empty result and dossier focus restoration fails. |
| 10 | Help and Documentation | 2 | Methodology and sources are unusually thorough, but the help is dense and often arrives after the risky interpretation. |
| **Total** | | **23/40** | **Acceptable — the data is strong, but the operating model needs restructuring.** |

## Design Specificity Verdict

**Independent design assessment:** Strongly product-specific. Croatian cadastral language, exact GUP years, official map colors, privacy boundaries, evidence dates, partial-evidence warnings, licences, parcel dossiers and the `Prijavi problem ovdje` action make “zemljovid i zapisnik” real. The generic part is structural: the resident-facing questions are still squeezed into a familiar GIS console of panels, chips and layers rather than shaping the whole first-use composition.

**Deterministic scan:** Nine advisories across `src/app/karta` and `src/components/karta`: four undocumented shadow colors at `map-client.tsx:410`, `:586` twice, and `:954`; five off-ramp font sizes at `:3037`, `:3846`, `:3861`, `:3875`, and `:4123`. The shadow findings are likely intentional map-legibility effects. The font-size drift is real, including 11–13px dossier text, but it is not the map’s largest problem.

**Browser evidence:** Desktop inspection covered direct arrival, planned roads, public ownership, the 2015→2024 planning comparison, parcel search, dossier open/close, restored dossier URL, and an empty/error search probe. These states had no horizontal overflow or panel collisions. Mutable overlay injection succeeded only at the preflight stage: `detect.js` remained pending with no overlay DOM or console findings, so no user-visible overlay is claimed. The temporary server and browser task spaces were closed. Assessment A’s separate live pass stalled; its design judgment is source-based, while Assessment B supplies the isolated live evidence.

## Overall Impression

The underlying spatial product is exceptional: specific, sourced, privacy-aware, and technically ambitious. The interface’s biggest weakness is not visual polish. It is that a neighbour must operate a GIS workstation—and may encounter an overconfident label—before receiving a plain, safely framed answer.

## What's Working

- **Evidence discipline:** source dates, official attribution, partial-evidence language, privacy boundaries and explicit absence create unusual trust.
- **Parcel workflow:** Search `392/3` returned one announced result; opening it produced a focused dossier, encoded a stable parcel ID and coordinates in the URL, and a copied URL restored the same parcel.
- **Resilient interaction foundations:** representative views restored from URLs, loading and filter results use live regions, Escape closes the dossier, panels did not collide, and the map remained free of horizontal overflow.

## Priority Issues

### 1. [P1] The default “Gdje se može graditi?” promise overstates the evidence

**Why it matters:** The result actually identifies parcels where the GUP permits housing after a derived screening for zoning, buildings, roads, connected area and access. A green polygon can be read as a legal buildability determination even though ownership, detailed conditions, services and permits are not established. This is high-stakes property interpretation by framing, not a bad calculation.

**Fix:** Rename the view to `Gdje GUP dopušta stanovanje?`. Place a persistent sentence before the legend: `Informativni prostorni probir — nije potvrda mogućnosti gradnje.` Move thresholds and methodology under `Kako je izračunato`, while keeping source links visible.

**Suggested command:** `/impeccable clarify map`

### 2. [P1] The architecture begins with the instrument instead of the resident’s task

**Why it matters:** Desktop opens two panels; mobile exposes five question chips, `Više (9)`, `Podloga`, zoom and `Slojevi`. The resident must understand views, layers, plan years and map controls before finding parcel search or an answer. Six of eight cognitive-load checks fail.

**Fix:** Make arrival a compact task launcher: `Nađi svoju česticu`, `Provjeri što vrijedi`, `Pogledaj promjene`, `Planirane ceste`. Reveal only controls required by the selected task. Put the 113-layer catalogue behind an explicit `Svi slojevi — napredno` route.

**Suggested command:** `/impeccable distill map`

### 3. [P1] The loading model violates the phone/weak-connection product promise

**Why it matters:** Representative states completed in roughly 3,9–4,7 seconds on the test connection. Each requested 56 orthophoto tiles, with slow tiles taking about 2,4–3,2 seconds. The planning-change view decoded about 2,63 MB of GeoJSON, dominated by a 2,34 MB road file. Planned-road and targeted-ownership GeoJSON appeared twice in resource timing. On a weaker outdoor mobile connection, the answer can arrive materially later or fail.

**Fix:** Remove duplicate fetch paths, load only viewport-relevant/vector-tiled geometry for heavy layers, avoid requesting a full orthophoto tile set before the answer layer is useful, and show a data-light street-map fallback. Establish a measured mobile budget for initial answer readiness rather than full map completion.

**Suggested command:** `/impeccable optimize map`

### 4. [P1] The map remains the only operable result surface

**Why it matters:** Parcel search makes one known parcel keyboard-accessible, but browsing a filtered cohort or all parcels still depends on visual polygons. A screen-reader or keyboard user can hear a count without traversing the corresponding objects. This also makes bulk surveying slow for sighted users.

**Fix:** Add a synchronized results sheet/list for every parcel-producing view. Include parcel number, k.o., key finding/evidence, area or overlap, and `Otvori dosje`; selecting either map or list should focus the other.

**Suggested command:** `/impeccable audit map`

### 5. [P2] Failure and recovery semantics break trust at key exits

**Why it matters:** A simulated blocked parcel-search request produced the same presentation as a legitimate empty result. After closing a dossier with Escape, focus fell to `<body>` because the triggering search-result button had disappeared. Users can conclude their parcel does not exist, and keyboard users lose their place.

**Fix:** Model search as `loading | success | empty | error`, preserve the query, and offer `Pokušaj ponovno`. Keep a stable trigger/reference so closing the dossier restores focus to the search field or selected parcel row.

**Suggested command:** `/impeccable harden map`

## Cognitive Load

Six checks fail: **single focus, chunking, visual hierarchy, one thing at a time, minimal choices, and working-memory protection**. Grouping and progressive disclosure pass.

High-load decision points include five primary questions, nine additional modes, fourteen layer groups, twelve GUP legend categories and seven ownership statuses. Users may need to reconcile the map, explanation, legend, active layers, plan year and evidence caveat simultaneously.

## Emotional Journey

- **Arrival:** The map promises rare, locally specific evidence.
- **Immediate valley:** It feels like a professional GIS console before it feels like a neighbourly answer.
- **Risk point:** The short “Gdje se može graditi?” label and green polygons can outrun the detailed qualification.
- **Peak:** A successful parcel dossier is excellent—specific, sourced, restorable and actionable.
- **Weak ending:** Slow loading, empty/error ambiguity or canvas-only results can prevent users from reaching that peak.

## Persona Red Flags

**Jordan, first-timer:** A simple-sounding buildability question opens into K5, GUP years, evidence taxonomies and multiple control systems. Parcel search is not the first visible action.

**Sam, accessibility-dependent:** Live regions and dossier focus are strong, but visual polygon cohorts lack a navigable list. Closing a dossier can lose focus, and meaningful dossier metadata falls to 11–13px.

**Casey, distracted mobile user:** The surface assumes patience for orthophoto tiles and multiple GeoJSON loads. Important view/basemap controls are high on screen; many measured desktop controls are below the project’s 44px floor and mobile requires dedicated confirmation.

**Susjed koji prati:** The map is a strong research destination but does not immediately answer `što se promijenilo od zadnjeg puta?` or lead back into the proposal/status record. Participation appears mainly after a successful parcel dossier.

## Minor Observations

- Many controls measured 24–36px high on desktop, including zoom, view and plan controls; coarse-pointer rules need device verification.
- `replaceState` keeps history clean but prevents browser Back from undoing a mistaken view change.
- The default view loads directly into `pogled=gdje-se-moze-graditi`; this makes its framing especially consequential.
- The public-ownership view defaults to the 30-parcel targeted sample while the 81-parcel GIS export is an alternate dataset; the difference needs a clearer top-level explanation.
- The broader detector found design-system drift, but the major problems are meaning, architecture, accessibility and loading—not color polish.

## Questions to Consider

- Would the initiative stand behind a screenshot containing only `Gdje se može graditi?` and a green parcel when shown to a planner?
- Is `/karta` primarily for answering one known parcel question, surveying an entire cohort, or browsing datasets?
- What should become useful first on a slow phone: the answer, the parcel list, or the orthophoto?
- Should the map remain the evidence canvas while a synchronized list becomes the actual operating surface?
