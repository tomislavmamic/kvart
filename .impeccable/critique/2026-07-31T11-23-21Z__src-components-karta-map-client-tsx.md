---
target: /karta
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-07-31T11-23-21Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: a3ac0196aecc1e0d0 · B: a8a49af08c52b69f4)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | DOF base tiles take 5+ s and sometimes never arrive; the map shows a blank grey rectangle with no spinner, skeleton or message. Layer fetches have no progress either. |
| 2 | Match System / Real World | 2 | Domain vocabulary is excellent (k.č., k.o., namjena, GUP), but the dossier leaks raw GIS: `ROOF_NOT_FLAT` (untranslated English enum), `šifra: 0110701004`, `statistički krug: SK 0110701`. |
| 3 | User Control and Freedom | 2 | No URL state at all — view, layers, underlay, selected parcel all live in React state. No linking, no bookmarking, no Back. Escape closes neither panel nor the dossier. |
| 4 | Consistency and Standards | 2 | Three "selected" chip colours with no key (emerald/zinc-800/red). Four collapse affordances (`⟨ sakrij`, `sakrij ⟩`, `☰ Slojevi`, `Podloga ☰`). Layer swatches unbordered, legend swatches bordered. Dossier headings are emerald — violates the One Green Rule. |
| 5 | Error Prevention | 2 | Selecting a view silently wipes hand-picked layers. In "Katastar i adrese" the census layer draws over the cadastre and swallows every tap. |
| 6 | Recognition Rather Than Recall | 2 | No on-map legend for active overlays; colour meaning lives only in 12 px sidebar swatches, and on a phone the sidebar must be closed to see the map. Klizač labels neither side. |
| 7 | Flexibility and Efficiency | 1 | 113 layers and no search. No permalink, no geolocation, no address lookup — the two obvious accelerators for someone standing in the street are both absent. |
| 8 | Aesthetic and Minimalist Design | 2 | Competent at desktop; at 390 px both panels open on arrival, overlap each other, and hide 100 % of the map. |
| 9 | Error Recovery | 1 | Failed layers only `console.warn`; the checkbox stays ticked and nothing draws — indistinguishable from "nothing here". A tap that hits no geometry gives no feedback at all. |
| 10 | Help and Documentation | 2 | View descriptions are the best copy on the site, but the flagship view hides its own red/green key inside a 1 400-character paragraph clamped to four lines at 12 px. |
| **Total** | | **17/40** | **Poor — major UX work needed on the primary usage scene** |

All ten heuristics apply: this is an Operate surface.

## Design Specificity Verdict

**LLM assessment — split, and the split is the finding: the payload is unmistakably this product, the interface around it is category-interchangeable.**

Three things could not be lifted from another product. The **parcel dosje** inverts the GIS "identify" tool — instead of "which feature did I click in layer N", it asks "what does every one of 56 layers say about *this* parcel", grouped into civic themes with relationship badges (`NA ČESTICI`, `PROLAZI`, `PODRUČJE`). That is a dossier about a civic object, not a feature inspector, and it maps exactly onto the three questions a resident actually has: is it on my land, does it cross my land, does it govern my land. The **view descriptions** are arguments with their own caveats — thresholds stated, cluster-not-parcel stated, "slobodno ali zaključano" stated — which makes a derived layer falsifiable rather than something to trust. The **"U ovom pogledu" lift** solves a real layer-tree problem with real discipline.

Everything wrapping that is stock. A left tree with 14 groups and 114 checkboxes, a right base-map panel, a zoom stack top-right, an attribution bar: swap the Croatian strings and this is any municipal WebGIS of the last fifteen years. And the dossier body renders `krov: ROOF_NOT_FLAT · visina (m): 5` — which is precisely the "2009 municipal portal" DESIGN.md names as an anti-reference, with rounded corners on it.

The decisive tell: **the map has no relationship to the product it belongs to.** No proposals layer, no "prijavi problem ovdje", no marker for what was sent to the City. Proposals carry optional coordinates in the schema. Success is measured in neighbours getting involved. This is the biggest surface on the site and it offers the follower zero paths into the record or into acting.

**Deterministic scan** — `detect.mjs`, exit 2 both scopes. Narrow scope (4 target files): **13 advisory findings, all in `map-client.tsx`** — 8 `design-system-color`, 5 `design-system-font-size`. `site-header.tsx`, `site-chrome.tsx` and `karta/page.tsx` are clean. Wide scope (`src`): **60 findings**, 45 of them in `map-views.ts`.

**All 45 `map-views.ts` colour findings are false positives, and correctly so** — they are the GIS layer swatches, and DESIGN.md protects them by name under The Two Registers Rule ("colour that came from an official document is evidence, not decoration"). The detector cannot know that file is the inherited register. Two more (`rgba(0,0,0,.9/.7/.5)` at `:174`/`:316`) are the text-shadow scrim that keeps map labels legible over aerial imagery — also not palette. That leaves genuine drift: `#6b746d` ×4 and `#0f172a` ×1 are authored chrome that near-misses the documented Kamen ramp, plus five hard-coded font sizes.

**Browser overlay** — injection succeeded (mutation proven by both a title write and an executed script element; helper on port 8400, `detect.js` fetched 200, `onload` fired). Console reported **"[impeccable] 3 anti-patterns found"**: `cramped-padding` on the Leaflet container, `tiny-text` (11 px) on the sidebar footer note, `overused-font` (97 % one family — expected, the Zero-Byte Rule), and `ai-color-palette` flagging violet, which is the same protected GIS-swatch false positive surfacing at runtime. **No overlay is visible in your browser now** — the assessment removed its injected nodes and reloaded the tab clean, and the helper was stopped and verified (port free, pid gone).

## Overall Impression

At a desk this is a good instrument with an outstanding idea in the middle of it. On the phone it was designed for, it opens with the map completely hidden behind two overlapping panels — and the one control that navigates the whole product, the view chips, lives inside the panel you have to close to see anything.

The single biggest opportunity is not visual. It is that this map produces nothing shareable. The product's one live channel is a WhatsApp group; its stated principle is that the record outlasts the conversation; and its largest surface cannot emit a link to what it just showed you.

## What's Working

**The dosje's relationship grammar.** `NA ČESTICI` / `PROLAZI` / `PODRUČJE` collapses 56 layer hits into three themed sections with counts, and reframes the map from "layers" (the GIS model) to "the file on this parcel" (the civic model). Everything good on this surface flows from that one decision.

**The view→layer lift.** Promoting a view's layers into "U ovom pogledu" *and removing them from their source group* means every layer has exactly one checkbox. It avoids the classic bug where unticking in one place appears not to work in the other, and it answers "what is this view showing me?" without scrolling fourteen groups.

**Descriptions that argue with their own caveats.** Stating the thresholds, the cluster-not-parcel rule, and the "slobodno ali zaključano" distinction makes the analysis contestable rather than authoritative. That is "ništa bez izvora" applied to a derivation instead of a citation.

## Priority Issues

### [P0] On a phone, the surface opens with the map completely hidden
**Why it matters:** The sidebar is 320 px of a 390 px viewport, full height. The Podloga panel is *also* open by default, overlapping it — its clipped edges poke out on the right and read as a rendering bug. Two floating panels, zero map. Closing the sidebar reveals the map but removes all 12 view chips, because navigation lives inside the panel you must hide. The primary user arrives on a phone from a WhatsApp link, outdoors, with thirty seconds — and lands on a settings screen. DESIGN.md's own Bottom-Sheet Fallback Rule is written for exactly this and is implemented only for the dossier.
**Fix:** Below `sm`, both panels become bottom sheets collapsed to a peek row; the map opens visible with a default view already enabled. Lift the view chips out of the sidebar into a horizontally-scrolling rail pinned above the sheet so `pogled` is always reachable. Never allow two floating panels open simultaneously below `lg`.
**Suggested command:** `/impeccable adapt`

### [P0] Taps do nothing, and in the cadastre view the census layer eats every one
**Why it matters:** `popisni-krugovi` renders after `katastar` with a filled polygon over the whole kvart, so in "Katastar i adrese" every tap returns census-tract codes — including `kotar: Mejaši`, a different kotar, which actively misinforms. Two taps on clearly visible cadastral parcels returned nothing at all: no popup, no dossier, no error, no cursor change. The dosje is the one genuinely product-specific interaction on the site, and the view named for cadastre is where a resident will look for it.
**Fix:** Give the dossier a map-level click handler so any tap opens it — it already queries by lat/lng and does not need a polygon hit. Bring `SLOJEVI_DOSJEA` layers to front and make purely statistical polygons non-interactive. When the API returns nothing, say so: "Na ovoj točki nema podataka."
**Suggested command:** `/impeccable harden`

### [P0] No URL state: nothing here can be shared, linked, or returned to
**Why it matters:** View, layers, base map, underlay year, comparison, display mode and selected parcel are all React state; the URL never changes. A neighbour who discovers that their parcel sits under a 110 kV line, or that the 2024 draft rezones a specific plot, cannot send that to the group. The product's only live channel is a link-sharing channel. It also means `/plan`, `/prijedlozi` and documents can never deep-link into the map.
**Fix:** Serialise to query params (`?pogled=…&sloj=…&podloga=…&kc=…&z=…&c=lat,lng`) via `history.replaceState`, hydrate on load, and add "Kopiraj poveznicu" next to the GeoJSON download.
**Suggested command:** `/impeccable harden`

### [P1] The accessibility floor is missed everywhere it was measured — including in the design system itself
**Why it matters:** Measured in the running page: **144 of 145 interactive elements have a minimum dimension under 44 px** (the sole pass is the map canvas). 114 layer rows at 16 px effective height, both panel-collapse buttons at 28 px, the nav burger at 32 px, the dossier close at 20 px. **Five genuine contrast failures**, and the worst is structural: the selected state of the primary controls — the active view chip and the active base chip — is white on `#009767` at **3.65 : 1**, below the 4.5 : 1 floor. That colour is `maslina-zivo`, which DESIGN.md specifies as `button-primary`'s ground with a white label at 14 px: **the primary button fails AA on every page of the site, not just here.** The sidebar footer note fails twice at once — 11 px prose at 2.61 : 1. And there is no type ramp: **162 of 174 text instances are 12 px**, nothing on the page is prose at ≥16 px.
One correction to what DESIGN.md currently claims: focus is **undesigned, not suppressed**. There is no `outline-none` anywhere in `src/` and no rule suppresses outlines, so native controls still receive Chrome's default ring. The gap is that focus is unstyled on a dense 12 px panel — materially milder than "no focus indicator", and DESIGN.md should be corrected to say so.
**Fix:** Move `button-primary` to `#007956` (5.43 : 1) with `#005f46` hover, and re-check every white-on-colour pairing. Layer rows to 44 px min-height with the whole row as hit area. Sidebar body to 14 px, view descriptions to 16 px, footer to 12 px in `kamen-drugi`. Add the specified 2 px Maslina ring to `Cip`, `Kvacica` and the group summaries. Give the 4 px klizač handle a 44 px transparent grab zone.
**Suggested command:** `/impeccable audit`

### [P1] No loading and no error states anywhere
**Why it matters:** The DOF orthophoto took 5+ seconds on localhost and in one tab never resolved, presenting as a permanently blank grey map. Layer failures are swallowed by `console.warn` with the checkbox left ticked. "Slower connections are normal" is a stated commitment and the base layer is a heavy WMS orthophoto — on 3G in the street this is the *normal* path, not the edge case. A blank map with no message directly contradicts "absence stated, never filled".
**Fix:** Skeleton with "Učitavam ortofoto…"; a tile `error` handler that falls back to Ulična karta with a one-line notice; per-row layer state (loading / loaded / failed) with an inline retry.
**Suggested command:** `/impeccable harden`

## Persona Red Flags

**Casey (distracted mobile user)** — Lands on a sidebar covering 320 of 390 px with the map invisible; the Podloga panel is open behind it, clipped, reading as a bug. To see the map she must hit `⟨ sakrij`, a 12 px zinc-500 text link in a 28 px-tall target — and doing so removes all 12 view chips. Tapping the map does nothing. Nothing to send back to the group: no URL change, no share control. The attribution wraps to three lines across the bottom once several layers are on, eating the thumb zone.

**Sam (accessibility-dependent)** — 114 checkboxes at 13 × 13 px in 16 px rows. Footer at 11 px, 2.61 : 1. Phase-2 rows at `opacity-45`, marked by opacity alone plus a parenthetical. Escape closes nothing except the nav pill. Focus never moves into the dossier when it opens and never returns on close. Layer identity is colour-only — a 12 px unbordered swatch with no pattern or text, so `Pješački prijelazi` is white on white and literally invisible. Tab order to reach the base-map control runs through 12 chips, 14 summaries and up to 114 checkboxes. The klizač's 4 px separator has an aria-label but no keyboard operation and no `aria-valuenow`.

**Jordan (confused first-timer)** — No idea parcels are tappable; no hint, no cursor change. Three chip "selected" colours in one panel with no key. "Pogled" vs "Slojevi" vs "Podloga" is an undefined three-way split, and six view names duplicate group names with different contents — the Infrastruktura *view* turns on 30 layers, the Infrastruktura *group* holds 3. In "Gdje se može graditi stan", red vs green is never explained on screen and clicking either does nothing — a resident sees their plot in red, can't click it, can't find out why, and can't tell whether red is good or bad. The dossier answers `krov: ROOF_NOT_FLAT` and never answers the question he came with: what namjena applies here, and can something be built.

## Minor Observations

- The `DosjePlaca` comment claims it "ne pokriva kliknutu česticu". At 1470 px it does; the amber selected-parcel highlight ends up underneath the panel.
- `pretraženo 56 slojeva` in the dossier vs 113 working layers in the registry — unexplained discrepancy on a product whose whole asset is credibility.
- Dossier section headings are `text-emerald-700`, a direct violation of the One Green Rule.
- Layer swatches have no border; legend swatches have `border-black/10`. Same object, two rules.
- `MAP_VIEWS[0]` ("Svi slojevi") is a registry, not a view — the weakest possible landing state for a phone user with thirty seconds.
- "Podloga" is a poor label for a panel that also holds comparison and display mode.
- Five hard-coded font sizes and `#6b746d`/`#0f172a` in `map-client.tsx` are genuine token drift worth reconciling.
- Detector `cramped-padding` on the Leaflet container is a false positive — a full-bleed map is supposed to be flush.

## Questions to Consider

1. **Why is the initiative's own record absent from the initiative's biggest surface?** 113 layers of city, state and EU data, and not one showing what neighbours submitted or what came back from the City. If the map cannot show a *prijedlog*, in what sense is it this product's map rather than a WebGIS the project happens to host?
2. **Who is "Svi slojevi" for?** It is a registry with nothing enabled, shown first, to a phone-in-the-street follower. What would the landing view be if it were chosen by someone watching a neighbour open the link at a bus stop?
3. **If the map produces no links, has it opted out of the product's only distribution mechanism?**
4. **Should "Gdje se može graditi stan" be a view at all?** It is a specific question with a specific answer for a specific parcel, currently sitting as chip 11 of 12 with its key hidden in clamped prose and its output un-clickable. What would "upiši svoju adresu → evo što na njoj vrijedi" look like instead?
