---
target: /karta
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-07-31T12-13-29Z
slug: src-components-karta-map-client-tsx
---
Method: dual-agent (A: a3ac0196aecc1e0d0 · B: a8a49af08c52b69f4)

Baseline snapshot taken BEFORE the fix pass in the same session. Scores describe
the surface as it was at commit eb0c2d8.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | DOF tiles 5+ s, sometimes never; blank grey map, no spinner. |
| 2 | Match System / Real World | 2 | Dossier leaks `ROOF_NOT_FLAT`, `šifra`, `statistički krug`. |
| 3 | User Control and Freedom | 2 | No URL state; Escape closes nothing. |
| 4 | Consistency and Standards | 2 | Three "selected" chip colours, four collapse affordances, emerald headings. |
| 5 | Error Prevention | 2 | View switch wipes layers; census layer swallows taps. |
| 6 | Recognition Rather Than Recall | 2 | No on-map legend; colour key hidden when map is visible. |
| 7 | Flexibility and Efficiency | 1 | 113 layers, no search, no permalink, no geolocation. |
| 8 | Aesthetic and Minimalist Design | 2 | At 390 px two panels overlap and hide 100% of the map. |
| 9 | Error Recovery | 1 | Failed layers only console.warn; dead taps give no feedback. |
| 10 | Help and Documentation | 2 | Red/green key buried in clamped 12 px prose. |
| **Total** | | **17/40** | **Poor — primary usage scene is the failure** |

## Priority Issues (baseline)

- **[P0] Mobile: map hidden behind two overlapping panels.** Sidebar 320 of 390 px, Podloga open behind it; closing the sidebar removes all 12 view chips. FIXED in the follow-up pass (bottom sheets, view rail, mutual exclusion).
- **[P0] Dead taps; census layer swallows every click in the cadastre view.** FIXED (map-level click handler, statistical polygons non-interactive).
- **[P0] No URL state — nothing shareable.** FIXED (query params + deep-link hydration via useSyncExternalStore).
- **[P1] Accessibility floor missed: 144/145 targets under 44 px; selected chips white on #009767 at 3.65:1; 162 of 174 text instances at 12 px; focus undesigned.** FIXED (pointer-coarse 44 px targets, emerald-700 at 5.36:1, real type ramp, .fokus ring on 23 controls).
- **[P1] No loading or error states.** FIXED (ortofoto status pill with fallback to Ulična karta, per-layer loading/failed state).

## Remaining / not addressed

- The map still has no connection to the initiative's own record (no proposals layer, no "prijavi problem ovdje"). Planned in `.impeccable/plan-prijedlozi-na-karti.md`, not implemented.
- "Svi slojevi" as the landing view is a registry, not a view — left as-is because the by-source default was an explicit user decision.
- No layer search across 113 layers; no geolocation; no address lookup.
- Six view names duplicate group names with different contents (Infrastruktura view = 30 layers, group = 3).
- Klizač labels neither side of the divider.
- Attribution wraps to three lines with several layers active.

## Persona red flags (baseline)

**Casey (mobile)** — landed on a sidebar covering 82% of the screen with a clipped second panel behind it; escape hatch was a 12 px link in a 28 px target that also deleted her navigation.
**Sam (accessibility)** — 114 checkboxes at 13×13 px; footer 11 px at 2.61:1; Escape closed nothing; focus never entered the dossier; layer identity colour-only with unbordered swatches.
**Jordan (first-timer)** — no cue parcels are tappable; three "selected" chip colours with no key; red vs green never explained on screen.
