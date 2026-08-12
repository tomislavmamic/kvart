---
target: map
total_score: 26
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-08-11T05-57-37Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: /root/critique_design_review_unanchored · B: /root/critique_evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 3 | Loading, retry, active-view state, and live counts work, but the static total and filtered result look contradictory. |
| 2 | Match System / Real World | 3 | Croatian cadastral language is authentic, but the seven evidence grades need plain-language interpretation. |
| 3 | User Control and Freedom | 3 | Panels close, Escape works, filters reset, and dossiers exit cleanly; filtered state cannot be restored or shared. |
| 4 | Consistency and Standards | 3 | The visual system is cohesive, but filter labels do not teach the map's color and dash vocabulary. |
| 5 | Error Prevention | 3 | Explicit evidence limits and “no data” states prevent false conclusions; subtle status distinctions still invite misreading. |
| 6 | Recognition Rather Than Recall | 2 | Residents must remember or infer which polygon treatment represents each ownership status. |
| 7 | Flexibility and Efficiency | 2 | Search and deep-linked map state help experts, but there is no traversable result list or URL-backed filter state. |
| 8 | Aesthetic and Minimalist Design | 2 | The design is restrained, but the focused parcel task competes with the full 113-layer GIS workstation. |
| 9 | Error Recovery | 3 | Layer retry and imagery fallback are strong; map-level recovery and filtered-state restoration are incomplete. |
| 10 | Help and Documentation | 2 | Source caveats are excellent, but the decision point lacks a compact legend, evidence-strength explanation, and interaction hint. |
| **Total** | | **26/40** | **Acceptable — substantial task-clarity improvements needed.** |

## Design Specificity Verdict

**LLM assessment:** Strongly product-specific. The question-led views, Croatian cadastral vocabulary, GUP chronology, evidence limits, official sources, parcel dossier, and location-preserving “Prijavi problem ovdje” action embody *Naš kvart*'s “zemljovid i zapisnik” concept. This is not interchangeable mapping SaaS. The specificity gap is at the filter-to-map seam: the product has nuanced knowledge, but does not yet teach residents how to read it.

**Deterministic scan:** Nine advisories in `src/components/karta/map-client.tsx`: four undocumented shadow colors at lines 410, 586 (two values), and 954; five off-ramp font sizes at lines 3037, 3846, 3861, 3875, and 4123. The four shadow-color findings are likely intentional map-legibility effects rather than palette drift. The type findings are valid system drift, although four occur only in dossier/subviews outside the initial planned-road state. The directly visible base-map attribution at line 3037 is 11px and merits correction.

**Visual overlays:** Mutable injection succeeded, but `detect.js` remained pending and emitted no Impeccable console messages or overlay DOM. No reliable user-visible overlay was produced. The temporary detection server was stopped and the isolated browser space was closed.

## Overall Impression

The map earns trust unusually well: it admits uncertainty, preserves official evidence, and turns a parcel click into a useful civic dossier. Its biggest opportunity is to make the public-ownership question feel like a guided answer rather than one mode inside a GIS workstation.

## What's Working

- **Evidence humility:** “Nova provjera nije provedena,” explicit no-data states, evidence-source labels, and the Uređena zemlja verification path prevent manufactured certainty.
- **Parcel dossier:** A clicked parcel becomes a sourced, parcel-specific explanation with area, planning constraints, searched-layer count, official links, and a location-preserving report action.
- **Responsive foundations:** The mobile bottom sheet genuinely scrolls, ownership rows are 44px high, active view state is semantic, filters update an `aria-live` result, and desktop/mobile layouts avoid horizontal overflow.

## Priority Issues

### 1. [P1] Seven expert ownership states lack a map key and resident-facing hierarchy

**Why it matters:** The main decision exceeds working-memory limits. “Potvrđeno javno — ZK,” “Javno prema katastru,” “Javno prema GIS-u Grada,” and “Neriješeno” are evidence grades, not intuitive peer categories. The map uses different colors and dashes, but the filter panel provides no matching swatches or explanations.

**Fix:** Lead with three or four resident-facing groups: “Potvrđeno javno,” “Moguće javno,” “Nije javno potvrđeno,” and “Nema podatka.” Put the seven source-specific states under “Detaljni filtri,” each with its exact map swatch/dash and a one-line evidence-strength explanation.

**Suggested command:** `/impeccable distill map`

### 2. [P1] Filtered parcels remain canvas-only results

**Why it matters:** A screen-reader or keyboard user can hear “6 čestica” but cannot traverse those six parcels. Sighted users must visually hunt the remaining polygons. The result is a count without an operable result set.

**Fix:** Add a compact “Prikaži N čestica” sheet/list with parcel number, cadastral municipality, road overlap, ownership evidence, and “Otvori dosje.” Synchronize list selection with the map.

**Suggested command:** `/impeccable audit map`

### 3. [P1] Total and filtered counts look contradictory

**Why it matters:** Filtering to one status leaves the amber “338 čestica” badge beside an updated “6 čestica · 1,3 ha” summary. Residents must infer which number answers their question.

**Fix:** Use a single sentence: “6 od 338 čestica · 1,3 ha.” In the unfiltered state, say “338 čestica ukupno · 14,1 ha.”

**Suggested command:** `/impeccable clarify map`

### 4. [P2] Several mobile controls miss the project's 44px touch floor

**Why it matters:** The primary audience uses a phone one-handed, often outdoors. Measured targets include 30×30px zoom controls, a 44×32px nav/menu control, 30px-high view chips, a 38px-high “Podloga” control, and a 36px-high sheet close control.

**Fix:** Give every mobile pressable a minimum 44×44px hit area without visually bloating the control; keep the existing 44px ownership rows as the model.

**Suggested command:** `/impeccable adapt map`

### 5. [P2] The resident's filtered conclusion is not shareable

**Why it matters:** The URL preserves the view and map state but not ownership filters. In a WhatsApp-first product, sharing “the 32 parcels marked public by City GIS” reloads as all 338.

**Fix:** Serialize selected statuses into the URL, restore them on load, and show “Kopiraj poveznicu” after filtering or opening a dossier.

**Suggested command:** `/impeccable harden map`

## Cognitive Load

Five of eight checks fail: **single focus, chunking, one thing at a time, minimal choices, and working memory**. Grouping, progressive disclosure, and the basic visual hierarchy are comparatively strong.

Decision points above four visible choices include five primary questions, seven ownership statuses, ten expanded viewing modes, and fourteen layer groups. The seven ownership statuses are the most consequential because they are adjacent, domain-specific, and directly change the answer.

## Emotional Journey

- **Arrival:** The aerial map, neighbourhood labels, and selected local question immediately establish relevance.
- **Orientation valley:** The focused task quickly exposes the full instrument—views, plan controls, filters, search, layers, and sources.
- **Reassurance:** The explicit disclosure that only 54 of 338 parcels have ownership evidence builds trust.
- **Filter valley:** Agency rises, then the simultaneous total and result counts create doubt.
- **Peak:** A parcel click produces a rich, source-backed dossier and a direct civic action.
- **End:** “Prijavi problem ovdje” closes the loop well, but the exact filtered conclusion cannot be shared into the product's real conversation channel.

## Persona Red Flags

**Sam, accessibility-dependent:** Fieldsets, focus styling, live status, and keyboard-dismissible dossier are strengths. The canvas-only result set is the blocking gap: filtered polygons have no equivalent keyboard/screen-reader list, and the visual status language lacks a textual legend.

**Casey, distracted mobile user:** The bottom sheet and 44px filter rows work, but several global controls are too small. The first sheet viewport is dominated by explanation and seven filters, and reloads lose the selected status.

**Alex, power user:** Search helps when the parcel number is known, but there is no preset, sortable filtered list, or shareable filter URL for inspecting and sending a cohort efficiently.

**Susjed koji prati:** Local evidence and honest missing-data language build trust. The WhatsApp handoff fails at the final metre: the resident can share the broad view or an opened parcel, but not the filtered finding that motivated the message.

## Minor Observations

- The amber total badge visually implies warning/status even though it is only a count.
- The 11px base-map attribution is below the documented type ramp.
- Map shadow-color detector findings look intentional, but should be documented as map-legibility effects to prevent future churn.
- The live desktop/mobile inspection found no horizontal overflow, and the seven filter rows each measured 44px.
- Screenshot capture timed out, so visual evidence came from the live semantic tree, interactions, geometry, and computed styles rather than reliable bitmap screenshots.

## Questions to Consider

- Is this view primarily for discovering public parcels, checking one known parcel, or surveying all 338?
- What if every filter result read as a sentence: “6 of 338 are confirmed public in the land register”?
- If WhatsApp is the conversation layer, should every meaningful map conclusion have an explicit share action?
- Should the universal 113-layer catalogue remain inside every question-led view, or require a deliberate move into “Napredni slojevi”?
- Could the map remain the evidence surface while a synchronized list becomes the operable surface?
