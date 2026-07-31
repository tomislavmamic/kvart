---
target: /karta
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-07-31T12-36-35Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: aad78e7e1533139a3 · B: aae793fb288bc6194)

Second run on `/karta`, after the fix pass at 0afd1f2. Baseline was 17/40.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Active view chip sits at offsetLeft 1176 in a 500px rail and is never scrolled into view; `?kc=` opens a dossier without panning or marking the parcel; klizač labels neither side. |
| 2 | Match System / Real World | 2 | The dossier answers "what pipes run here" to the question "may I build". Plus `ÄŒetvrtasti` mojibake, `napon (kV): 0.4 kV`, raw `PUT MOSTINA` casing. |
| 3 | User Control and Freedom | 2 | Escape and closes work; but under klizač the two year chips are live buttons that do nothing, and switching view silently wipes every ticked checkbox. |
| 4 | Consistency and Standards | 2 | `<summary className="flex">` kills the disclosure triangle on all 14 groups; six type sizes where DESIGN.md defines four; three filled chip states, one undocumented. |
| 5 | Error Prevention | 2 | On mobile, tapping the comparison chip hits the ☰ Slojevi bar instead and swaps the whole panel. |
| 6 | Recognition Rather Than Recall | 1 | 113 layers, no search anywhere; 14 groups with no expand affordance; namjena behind a button labelled "Podloga"; the flagship view off-screen. |
| 7 | Flexibility and Efficiency | 2 | Deep links and klizač are real power, but the link doesn't carry the map to the parcel and there is no keyboard path to a dossier at all. |
| 8 | Aesthetic and Minimalist Design | 2 | A 544×800 desktop dossier holding 65px of content, over the parcel just clicked. |
| 9 | Error Recovery | 2 | Croatian error copy, per-layer failure state and the ortofoto fallback are genuinely good; the failed row still offers no retry despite a comment claiming it does. |
| 10 | Help and Documentation | 2 | The view descriptions are excellent documentation, but they and the green/red legend live inside a sheet closed by default on a phone. |
| **Total** | | **19/40** | **Poor→Acceptable boundary. Real fixes landed; new P0s landed with them.** |

## Design Specificity Verdict

The neighbourhood-specific dataset now sits behind a category-generic instrument, and where the two meet the shell wins. Three specifics prove it: the parcel dossier is ordered by the utility companies' data model rather than the resident's question; the flagship view is chip 11 of 13 in a rail whose end nobody can see; and the sidebar has to write a sentence explaining its own information architecture ("Namjena iz GUP-a nije među kvačicama nego je podloga — bira se desno"). When copy has to route around layout, the layout is generic.

**Deterministic scan:** exit 2 both scopes — 7 findings in the four target files (down from 13), 54 across `src`. The 45 `map-views.ts` colours remain correct false positives under The Two Registers Rule; the three `rgba(0,0,0,.x)` are text/box shadows. Genuine: six off-ramp font sizes (13/11/10px) that exist only in the dossier and two page footers, plus an inline `font: 800 15px/1` on the map place labels.

**Overlay:** injection succeeded (port 8400, mutation proven twice), console reported 2 anti-patterns — `cramped-padding` on the Leaflet container (false positive; a full-bleed map is meant to be flush) and `overused-font` at 83% (the documented Zero-Byte Rule). Helper stopped, port verified free, overlay nodes removed before measurement.

## What's Working

**The analysis and its willingness to show its work.** The housing view states its thresholds, admits a half-K5 parcel counts only by its half, and names eight parcels as "slobodno, ali zaključano". It is the only part of the surface that discharges *ništa bez izvora*, and it is unavailable anywhere else for this kvart.

**Two Registers held cleanly.** GUP fills come from the plan's own tumač znakova and are never harmonised; the brand green never touches a namjena polygon; the klizač is hand-rolled so the comparison is real pixel evidence.

**Honest state engineering.** Loading distinguished from failure, three failed tiles before crying wolf, a working fallback, per-layer state so a lit checkbox over an empty map is labelled rather than ambiguous, and a request counter guarding against stale responses.

## Priority Issues

### [P0] The dossier omits the only thing the dossier is for
`U_DOSJEU` registers 56 layers and **not one is a namjena layer** — no GUP 2015 or 2024, no UPU, no DPU, no `stambeno-slobodno` — and `BEZ_U_DOSJEU` explicitly drops the `namjena` field. Verified on two parcels and on a deep link into the housing view. A resident who taps their own land is told about telecom ducts, litter bins and outdoor gym equipment, and never what the plan says. The product's positioning rests on "gdje je stanovanje još moguće"; the one personal surface answers a question nobody asked.
**Fix:** register the namjena and hazard layers, stop dropping the field, and pin a block above everything else — *"Namjena: K5 — dopušta i stanovanje (GUP 2015., na snazi) · nacrt 2024. ne mijenja · ova čestica JE/NIJE u sloju slobodnih"* — with source and date per line.
**Suggested command:** `/impeccable shape`

### [P0] Licence attribution is fully occluded on mobile, in every state
`.leaflet-control-attribution` sits at y 770–787. Sheet closed, the ☰ Slojevi bar covers it; sheet open, the sheet covers it. Desktop is fine — this is a regression introduced by the bottom-sheet pass. DOF 2023 is used under Otvorena dozvola and PRODUCT.md records attribution as a condition of use, not a courtesy.
**Fix:** an "izvori" pill in the floating chrome, or a reserved strip above the bottom bar.
**Suggested command:** `/impeccable harden`

### [P0] The comparison control is unreachable on mobile
The "Istakni promjene" chips render at y 755–779; the ☰ Slojevi bar occupies 742–787. Both are `z-[1100]` and `Sidebar` renders after `Kontrole`, so the bar hit-tests on top — `elementsFromPoint` returns the bar. The sheet cannot be scrolled clear (`scrollHeight === clientHeight`). Tapping the flagship comparison closes the panel and opens the layer list.
**Fix:** raise the sheets above the bar and hide the closed-state bar while a sheet is open, or reserve bottom padding inside every sheet.
**Suggested command:** `/impeccable adapt`

### [P1] The deep link destroys its own centre and zoom
`?c=43.518,16.515&z=18` is replaced by `KVART_CENTER` at zoom 15 within ~1.2 s, reproduced at z=16, 17 and 18. Mechanism: the map is constructed at the defaults, its `moveend` fires, `uAdresu()` writes those defaults to the URL, and only then — after two awaits — does `izAdrese()` re-read a URL the app has already overwritten. The parsing is correct; the value is gone before it is read. This directly contradicts the comment two lines above it.
**Fix:** snapshot the query once at mount and read the snapshot, not `window.location`; suppress the URL writer until the address has been applied.
**Suggested command:** `/impeccable harden`

### [P1] Remaining contrast and reach failures
Measured: `×N` counts and the dossier footer at **2.62 : 1**, relation badges (PODRUČJE / NA ČESTICI / PROLAZI) at **4.39 : 1** at 10px, "(uskoro)" at **2.31 : 1** under `opacity-60`. No keyboard path to a parcel dossier exists at all — cadastral features are SVG paths with no tabindex and there is no address or k.č. search (WCAG 2.1.1). The nav burger stays 32×32 on touch (no `.meta`), and `min-height` grows only the height axis, so the dossier close stays 36.2px wide.
**Suggested command:** `/impeccable audit`

## Persona Red Flags

**Casey (mobile)** — the comparison chip is swallowed by the Slojevi bar; attribution invisible in every state; the active view chip never scrolls into view; the green/red legend is **not in the DOM at all** when the sheet is closed, which is the default; the dossier stacks on top of an open layer sheet rather than replacing it; both sheets are 72% tall with no drag handle, swipe-to-dismiss or backdrop.

**Sam (accessibility)** — no keyboard route to the product's primary action; 114 checkbox tab stops with no skip link; three different focus-ring greens ship (`#007956`, emerald-600, emerald-700); `aria-modal="true"` on the dossier while the sheet behind it stays interactive and in the a11y tree; 14 expandable groups with no marker and no `aria-expanded`.

**Jordan (first-timer)** — the default view is 113 unlit checkboxes described as "ništa upaljeno unaprijed"; "Podloga" gives no hint that it holds namjena and the GUP years; switching view silently discards every checkbox ticked; under klizač two chips look like controls and do nothing; "×11", "PODRUČJE", "PROLAZI" appear with no key.

## Minor Observations

`ÄŒetvrtasti` mojibake; `napon (kV): 0.4 kV` (decimal point plus doubled unit); raw `PUT MOSTINA` casing; three near-duplicate address layers giving two different house numbers for the same point; "Korisna površina zgrada" listing roof pitch instead of usable area; boundary stroke `#059669` is not a DESIGN.md token; `bg-red-700` is an undocumented third filled-chip state; the failed-layer row offers no retry despite the comment claiming it does; description line-height 1.5 where the Body role specifies 1.6. Also: the shipped `bg-emerald-700` resolves to `rgb(0,122,85)` = 5.36:1, not the documented `#007956` = 5.43:1 — both pass, but the token and the code have drifted.

## Questions to Consider

1. If the dossier were allowed exactly one line, what would it say — and why is that line not the panel, with everything else behind "svi slojevi na ovoj čestici"?
2. "Svi slojevi" is the default and shows nothing. What does the map look like if the default is the answer to the most-asked question rather than the inventory?
3. Thirteen views in a rail whose end nobody can see: which three would survive if it had to fit one phone screen?
4. The sidebar has to explain its own IA in prose. What would have to change for that sentence to become unnecessary — and what else here is held together by copy?
5. Only one thing here survives being screenshotted into the WhatsApp group. Is it the map or the dossier, and is the one that survives the one you designed to?
