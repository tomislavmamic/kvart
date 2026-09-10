# Minimal simulator UI

Selected direction: A, map-first.

- Mercaptans and H₂S are both visible on a fresh visit. Existing shared URLs still override visibility, colors and source strengths.
- Each persistent legend toggles its own plume and uses the same palette as the renderer. Hidden layers remain available, with a minus and crossed-out name.
- The timeline is neutral: it selects time and shows frame availability, not a derived neighborhood odor level. Forecast, missing-data, loading, error and stale-data states remain explicit.
- Regional odor summaries, confidence/trend narratives and the selected-point prediction panel are removed from this page. Selecting a location still supports reporting an odor.
- Station markers are off initially; measurement and proposed-station layers remain in Settings. Direct proposal links still reveal their station.
- Palette and source-strength controls live under Advanced. Model limitations live under About the display, with a permanent short “not a measurement” label on the map.

The initial UI redesign leaves calibration and measured data unchanged. The subsequent domain extension below also changes particle retention beyond the old map boundary.

## Impeccable refinement

Applied the upstream Impeccable distill, polish and craft-floor guidance against this project's PRODUCT.md, DESIGN.md and the earlier simulator critique. The local Impeccable launcher is absent; context and design checks were performed directly, not via its detector.

- One control dock replaces the separate wind/status card. Source details expand from the wind control; loading progress is not repeated.
- Desktop legends sit in the header; phone legends remain directly over the map. Their gradients still come from the actual plume palettes.
- Shared, locally scoped styles use the project's Kamen/Maslina tokens, consistent SVG icons and 44 px primary interaction targets.
- Settings use progressive disclosure, solid surfaces and focus return on close/Escape. They remain non-modal so the map is still usable.
- The slider has one neutral availability track instead of a native track plus a duplicate row. Missing hours remain unavailable, keyboard navigation skips them, and errors remain visible.
- Mobile layout reserves room for attribution and safe-area insets. Motion respects reduced-motion preferences.

## Layer coverage

The simulator no longer overlays the neighborhood-only LiDAR tiles or a cropped building GeoJSON. Relief uses continuous Terrarium terrain tiles (Mapzen / Copernicus, USGS, NOAA); buildings use OpenFreeMap's OpenStreetMap building tiles, reusing the basemap source when available. The neighborhood's detailed LiDAR and municipal building data remain unchanged on other pages and in the model inputs.

Wind and plumes share an adaptive domain with a 4.5% geographic edge fade. Its conservative radius covers the strongest decoded terrain wind across the requested hours (including warm-up), maximum particle lifetime, bounded meander/vortex drift, and the implementation's bounded Box–Muller steps at the minimum timestep, plus a 30% buffer. It is a numerical containment bound, not a prediction of detectable odor distance.

The original 256 × 256 terrain wind field and source mask remain at their real coordinates. Beyond that field, wind blends over 1.6 km into the hourly background vector; there is no claim of terrain-resolved regional meteorology. Particles no longer die at the old 6.4 km box. Age, emission profiles and decay remain unchanged; particles can leave and return.

A 512 × 512 nonuniform density grid retains the original 200 × 200 cells (32 m) in the central 6.4 km, then grows cells exponentially outward. Density is corrected for cell area, so enlarging the domain does not inflate concentrations. The render mesh uses the same mapping. Frames carry their own domain metadata; a domain change replaces geometry without cross-fading incompatible coordinates. Refreshes calculate coverage from the new weather inputs.

Wind trails seed the visible viewport, using the same local/background field and domain fade, rather than wasting particles over the entire regional box. Mercator projection is evaluated at trail vertices. Initial zoom and the return-to-Karepovac view remain unchanged; zooming out now permits regional inspection. Distant results remain a coarse illustrative continuation, not a validated regional dispersion forecast.

Above zoom 12, wind trail counts halve per zoom level to compensate for longer on-screen trails. Counts scale with CSS viewport area and remain between 24 and 2400, keeping close-up and phone views sparse without changing wind speed or plume calculations.
