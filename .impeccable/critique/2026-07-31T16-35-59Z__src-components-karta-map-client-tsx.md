---
target: /karta
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-07-31T16-35-59Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: ae6dac08ce3aa3282 · B: a991523895d6d4761)

Fourth run on /karta, after the structural pass. 17 -> 19 -> 22 -> 27/40.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Active chip auto-scrolls, layer states carry retry, parcel panned clear and marked. A ?kc= link draws only a dot, no outline; view switch changes the layer set with no notice. |
| 2 | Match System / Real World | 3 | Chips are the resident's questions; the dossier answers with source and year. "Korisna povrsina zgrada" still lists roof pitch; namjena still filed under "Podloga". |
| 3 | User Control and Freedom | 2 | Verified live: ticking a layer then switching view silently deletes it. Escape drops focus to BODY. |
| 4 | Consistency and Standards | 2 | Two chip radii, three filled states against two documented, a grey panel nested in a white one, two clear-X buttons in the search field. |
| 5 | Error Prevention | 3 | The three run-3 P0s are genuinely closed. New: one layer renders two checkboxes when both raised and matched by search. |
| 6 | Recognition Rather Than Recall | 3 | Search works and folds diacritics, but silently omits the layers most asked for - "namjena" and "gup" never return the GUP namjena layer. |
| 7 | Flexibility and Efficiency | 2 | Deep links verified complete. 61 map paths, zero with tabindex - no keyboard route to a dossier. |
| 8 | Aesthetic and Minimalist Design | 3 | Landing carries one layer, not 113 checkboxes. The landing description is a 1500-character methods appendix clipped mid-word. |
| 9 | Error Recovery | 3 | Retry exists, ortofoto falls back, absence stated honestly. The no-hits state is a dead end with the group list gone. |
| 10 | Help and Documentation | 3 | Legend beside the description, source and year on every claim, licence link. The klizac labels neither year. |
| **Total** | | **27/40** | Solid. First pass that improved the shell rather than one block. |

## Design Specificity Verdict

Moved, but along one axis. Authored: the landing question with its key beside the description, and the dossier NAMJENA block, which derives its own colour and its own refusal - four distinct outcomes verified, none liftable to another city without redoing the analysis. Rearranged: everything else. Three question chips sit on the same horizontal scroller; the 113 checkboxes are the same tree with a search box on top.

And the restructure's own load-bearing claim - that three questions fit one phone screen without scrolling - is measurably false. At 390 px the rail is 515 px wide, the third chip is clipped by 29 px, and "Vise (10)" begins at x=425, entirely off-screen behind a hidden scrollbar. The premise was never measured on the device the plan was written for.

Deterministic scan: exit 2 both scopes, 9 findings in the target files, 56 across src. The 45 map-views.ts colours and 4 rgba() shadows are correct false positives; 11px and 13px remain genuine off-ramp steps. Overlay ran on port 8400, stopped and verified free.

## What's Working

The namjena block is derived, not decorated: povoljno = stanovanje && slobodna !== null && !slobodna.bez_pristupa. Colour follows outcome, not land-use code, on the one screen where a resident's money is at stake.

The dossier stopped hiding its own evidence: desktop pans the parcel to ~28% from the left, mobile to ~17% from the top above a 72% sheet, with a marker in every case. The panel became a caption on the answer instead of a modal over it.

The sidebar has an authored reading order: PITANJA -> description -> legend -> U OVOM POGLEDU -> OSTALI SLOJEVI + search. Three eyebrows tell you what kind of thing each block is.

## Priority Issues

### [P0] The rail does not fit the phone it was restructured for
nav[aria-label="Pogled"] at 386 px measures scrollWidth 515 / clientWidth 386. "Sto vrijedi ovdje?" clipped by 29 px; "Vise (10)" starts at x=425, fully off-screen; scrollbar hidden, no fade, no arrow. Ten of thirteen views, including the whole registry, are reachable only by an undiscoverable horizontal swipe. This is run 3's finding reappearing at smaller magnitude.

### [P0] No keyboard or screen-reader route to the dossier
61 path elements in .leaflet-container, zero with tabindex. The klizac handle is a div with cursor:ew-resize - no role, no aria-valuenow, no key handling. Escape leaves focus on BODY. No k.c. or address lookup. A keyboard user can operate every chip and never see one parcel dossier.

### [P1] The new search cannot find the layers people search for
nadeni filters out UPRAVLJANI_SLOJEVI with no message. Verified: "namjena" returns UPU and DPU sheets but never "GUP - namjena povrsina"; "gup" returns four plan-* layers but never the namjena or change layers. The search was introduced to end the fourteen-group hunt and fails on the most-wanted layer, while the only explanation of where namjena lives is the sentence in a view description the user will never open.

### [P1] A view switch silently destroys manually ticked layers
Verified live. selectView calls setActiveIds(new Set(phase1(view.layerIds))) unconditionally. More damaging now: the rail is the primary navigation, so the three chips users are steered toward are the three buttons that erase their work.

### [P1] Translucent panels fail contrast over dark imagery
Measured: text-zinc-500 on bg-white/90 composites to 3.85:1 over a black tile (4.83 over white); bg-white/95 gives 4.32. Every zinc-500 role - group captions, placeholder, clear X, "po GUP-u", "Uputa", both attribution lines - sits on one of these surfaces. backdrop-blur blurs the map but does not lighten it. zinc-700 and darker are safe at every alpha.

### [P2] One layer, two checkboxes
The group path excludes podignuti; the search path does not. Verified: with the housing view active, searching "slobodne" renders two checked checkboxes for the same layer. The file's own comment says a duplicate means unticking in one place appears not to work in the other. Also: the query survives a view switch, leaving a stale empty state.

## Persona Red Flags

Casey (mobile): "Vise (10)" at x=425 in a 386 px viewport, third chip clipped mid-word - ten views invisible. Green/red polygons have no key on the first screen; legend and the "56 cestica" count are both inside the closed sheet. In "Sto se mijenja?" the comparison controls live inside the sheet that covers 72% of the map - you set the comparison blind.

Sam (accessibility): 61 map paths, 0 focusable, no textual alternative. Escape -> activeElement BODY. Klizac is a bare div. Sidebar and control panel are unlabelled divs, not landmarks. The search field ships the browser's native clear X beside the authored one.

Jordan (first-timer): landing description clipped mid-word at "5,0 ha katastars...". Nothing says the parcels are tappable - the secondary view says it, the flagship one does not. Three chip fills visible at once with no inferable rule.

## Minor Observations

Search clear button is 19x20 px on every device - the only sidebar control with neither .meta nor a min size. The "Uputa gdje gledati" disclaimer is 12px attached to a 16px legal claim. Grey panel nested inside the white sidebar (Climbing-Ramp). Cip uses the 0.25rem Tag radius on pressables while the rail uses rounded-full. Deep-linked parcels get a marker but never the amber outline. Three dismiss verbs on one page: sakrij / zatvori / Manje. The API couples namjena and slobodna: when the point falls outside every GUP polygon it returns namjena null and silently drops the free-parcel fact, even for a parcel that IS in the layer.

## Questions to Consider

1. The plan said three questions fit one phone screen. The rail measures 515 px in 386. Was that ever measured on the device the product is designed for?
2. The search was built to end the fourteen-group hunt and cannot return the GUP namjena layer. Which registry does it index - the layers, or the subset that stayed in the checkbox model?
3. A neighbour sees green and red shapes and no key. What would make the legend the thing that never hides, and the 113-layer list the thing that always does?
4. Three chip fills and two radii inside one 200 px panel. If a resident cannot infer the rule, is the rose chip carrying meaning or just heat?
