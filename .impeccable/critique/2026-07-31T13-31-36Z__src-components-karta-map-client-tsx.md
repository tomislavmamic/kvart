---
target: /karta
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-07-31T13-31-36Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: a3df2f963e8f6c282 · B: ae2c8b78ffebafc4c)

Third run on /karta after two fix passes. 17 -> 19 -> 22/40.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Active view chip at offsetLeft 1176 with scrollLeft 0; parcel highlight drawn entirely under the dossier; no aria-pressed on view chips. |
| 2 | Match System / Real World | 3 | The NAMJENA block speaks the resident's question; mojibake/units/decimals verified fixed. A free parcel still answers a tap with "M/K5". |
| 3 | User Control and Freedom | 2 | selectView still destroys every manually ticked layer; Escape drops focus to BODY. |
| 4 | Consistency and Standards | 2 | Three filled chip states against two documented; four focus-ring colours ship; five type sizes in the dossier. |
| 5 | Error Prevention | 2 | stambeno-slobodno is in neither SLOJEVI_DOSJEA nor NEINTERAKTIVNE_PLOHE, so it swallows the click. Green panel + "dopusta stanovanje" with no disqualifier. |
| 6 | Recognition Rather Than Recall | 2 | 113 layers, still no search; namjena still behind a button labelled "Podloga"; sidebar still explains its own IA in prose. |
| 7 | Flexibility and Efficiency | 2 | Deep links now complete and verified; zero tabindex on any map path, so no keyboard route to a dossier. |
| 8 | Aesthetic and Minimalist Design | 2 | Desktop dossier 544x701 over the map centre and the click target; mobile sheet 72% with ~80px of map surviving. |
| 9 | Error Recovery | 2 | Ortofoto fallback and per-layer failure remain good; the failed row still offers no retry while the comment claims it does. |
| 10 | Help and Documentation | 3 | Klizac ships the full GUP legend inline; the housing view ships its green/red key; the dossier carries a scope disclaimer. |
| **Total** | | **22/40** | Acceptable. +3, concentrated in one block; the shell around it did not move. |

## Design Specificity Verdict

Authored for the first time, but only in one block. The NamjenaOdgovor block is written for a person, in that person's words, with the initiative's own analysis folded in. Nothing else on the public web says that about a Dracevac parcel. The shell has not followed: the flagship layer blocks the flagship answer in the flagship view; the answer covers its own evidence; and the block asserts the permissive half while staying silent on the disqualifying half.

Deterministic scan: exit 2 both scopes. 8 findings in the target files, 55 across src. The 45 map-views.ts colours remain correct false positives under the Two Registers Rule. Genuine: 11px and 13px off-ramp steps in the dossier, and rgba(0,0,0,.5) on the slider handle at 10x the documented shadow alpha. Overlay ran on port 8400 and was stopped; its purple/violet flag is the protected GUP palette.

## What's Working

The NAMJENA block's information order: answer, then inventory; source and date on the same line; the 2024 draft only where it differs; and a closing disclaimer of its own authority.

Value normalisation as a design act: mojibake repair, unit de-duplication against IME_POLJA, decimal comma, and uppercase normalisation with an acronym allow-list. Verified rendering "napon (kV): 0,4" where run 2 measured "0.4 kV kV".

Contrast held checkably: the lowest ratio in the dossier or sidebar is 4.58:1, and every line of the new NAMJENA block passes in both variants.

## Priority Issues

### [P0] The free-parcel layer swallows the tap and answers "M/K5"
stambeno-slobodno is in neither SLOJEVI_DOSJEA nor NEINTERAKTIVNE_PLOHE. Its features carry properties.namjena so onEachFeature binds a bare popup, and its click handler sets pogodakSloja, which makes the map-level handler bail. In the view named "Gdje se moze graditi stan", tapping the green polygons is inert. The initiative's own analysis is the obstacle to reading the initiative's own analysis.

### [P0] The dossier occludes the parcel it describes
Highlight rect 826-1080 x 391-423; panel rect 678-1222 x 88-789 - full containment. On a ?kc= link there is no highlight at all, and B measured the map is not centred on kc: at z=18 the parcel is ~911 m outside the viewport. The dossier describes a parcel that is nowhere on screen.

### [P0] The green panel affirms without stating the disqualifier
The free-parcel line renders only when truthy, and the panel tint is keyed to `stanovanje` rather than to the outcome. A K5 parcel with four buildings and a 48 m2 K5 sliver both read as unqualified yes; a locked parcel shows a green panel while the text says "ovdje se ne gradi". Two DESIGN.md rules broken at once - One Green Rule and "absence stated, never filled".

### [P1] Touch and keyboard floors missed on named controls
The peek bar is 390x33 pinned to bottom:0 without .meta - the only door to 113 layers, in the iOS gesture band. The nav burger stays 32x32. Zero tabindex on any map path, so no keyboard route to a dossier exists and there is no k.c. or address search.

### [P1] Phase-2 layer labels still fail contrast
opacity-60 survives at map-client.tsx:1145, measured 2.31:1 for both the label and the "(jos nema podataka)" marker.

## Persona Red Flags

Casey (mobile): lands from WhatsApp with nothing on the rail looking selected; taps a green parcel and gets "M/K5"; reaches the dossier only by missing the polygon; the parcel it names is under the sheet; the 33px peek bar sits in the home-indicator zone.

Sam (accessibility): no keyboard path to a dossier (path[tabindex] = 0) and no search alternative; view chips announce no state while Podloga chips do; Escape drops focus to BODY; four focus-ring colours ship where one is documented.

Jordan (first-timer): default view is still 113 unlit checkboxes; the sidebar still writes a sentence explaining its own IA; tapping a view chip silently deletes everything ticked; the klizac labels neither side.

## Minor Observations

"Korisna povrsina zgrada" still lists roof pitch. "Bilice Ii" corruption is in the source file, not introduced by izVelikih - needs a data note. Unknown ?pogled= rewrites silently. Boundary stroke #059669 is not a token. bg-red-700 is an undocumented third chip state and brushes Rose-Not-Red. The dossier's free-parcel result sentence (14px) and caveat (12px) are prose below the Body step.

## Questions to Consider

1. The dossier's first block is an answer and everything below is an inventory. If the inventory collapsed behind one line, what would be lost?
2. You built a layer that computes which parcels are free, then made that layer the thing that stops a resident asking about a parcel. Which artefact was the map designed around - the data or the question?
3. The green panel is keyed to `stanovanje`, not the outcome. If a colour here can be wrong while the sentence beside it is right, what else is decorated rather than derived?
4. Thirteen views, and on a phone the one the link points at is 1176px off-screen. If the rail held three, which three?
