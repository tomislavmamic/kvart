# Karepovac odour simulator — design specification

- **Status:** approved for implementation planning
- **Date:** 2026-08-21
- **Route:** `/karepovac/sim`
- **Primary surface:** full-screen geographic map
- **Default camera:** top-down, centred on Karepovac

## Summary

Build a full-screen, interactive Karepovac odour simulator at
`/karepovac/sim`. It covers the previous 24 hours, the current hour, and the
next three forecast hours. Users can inspect monitoring stations, wind, map
context, and simulated H₂S and mercaptan transport. They can enable both
substances at once, choose their colours, and vary their emission strengths
independently.

The existing `/karepovac/zrak` page remains unchanged. The simulator is a
separate, exploratory surface and does not replace the current explanatory
view.

MapLibre GL owns the geographic map and camera. A Three.js custom MapLibre
layer renders the WebGL dispersion fields, particles, and wind arrows. The
implementation reuses the WebGL lifecycle patterns from `/igra`, but not its
stylised scene coordinates or fixed orthographic camera.

## Goals

1. Let anyone living within several kilometres of Karepovac see whether a
   simulated plume reaches their area at a selected hour.
2. Make the last 24 hours, current conditions, and a three-hour forecast
   directly comparable on one timeline.
3. Show H₂S and mercaptans independently or simultaneously.
4. Let users run independent `0–5×` emission scenarios for both substances.
5. Keep relief, buildings, monitoring stations, wind arrows, animated wind,
   and base-map context independently selectable.
6. Keep timeline scrubbing and emission changes immediate after the initial
   simulation warm-up.
7. Preserve `/karepovac/zrak` and avoid coupling simulator state to the large
   Leaflet implementation at `/karta`.

## Non-goals

- Replacing `/karepovac/zrak`.
- Presenting an emission scenario as a regulatory concentration forecast.
- Simulating chemical reactions between H₂S and mercaptans in the first
  release.
- Providing more than three forecast hours in the first release.
- Loading the complete historical archive in the first release.
- Reusing the stylised geometry or screen coordinate system generated for
  `/igra`.
- Rewriting `/karta` from Leaflet to MapLibre.

## Route and page isolation

The simulator lives at `/karepovac/sim`, outside the existing
`src/app/karepovac/(projekt)` layout. A route group may be used to keep the URL
while avoiding the project header and content-width wrapper, for example:

```text
src/app/karepovac/(simulator)/sim/page.tsx
```

As with `/karta`, the simulator occupies the viewport and suppresses the
ordinary site chrome while mounted. It restores global document state during
cleanup. No simulator control or stylesheet changes the existing
`/karepovac/zrak` route.

## Geographic view

Karepovac is the initial camera centre. The default top-down overview shows
roughly 3–4 km in every direction, so nearby settlements can judge their
position relative to the plume. Users may pan and zoom within an approximately
6 km radius. A persistent **Centre on Karepovac** control restores the initial
camera.

The default camera has zero pitch. An optional **3D relief** toggle adds pitch,
terrain, and building extrusion. Returning the toggle to off restores the
top-down camera without changing the selected hour or simulation settings.

## Rendering architecture

### MapLibre map

MapLibre GL owns:

- geographic projection and camera;
- pan, zoom, bounds, attribution, and gestures;
- street-map and orthophoto base layers;
- shaded relief;
- building footprints and optional extrusion;
- monitoring-station markers and selection;
- layer ordering outside the simulation.

Existing source definitions and local assets from `src/lib/map-views.ts` are
reused through small simulator-specific adapters. Leaflet layer instances and
the `/karta` component state are not imported.

### Three.js custom layer

A Three.js custom MapLibre layer owns:

- concentration textures for H₂S and mercaptans;
- colour ramps and contour edges;
- blended display when both substances are enabled;
- animated wind particles;
- directional wind arrows;
- GPU scaling for independent emission strengths.

MapLibre supplies the camera matrix. Geographic coordinates are converted to
MapLibre Mercator coordinates at the custom-layer boundary. Three.js does not
create a second camera or independent pan/zoom controls.

### Reuse from `/igra`

Reuse and generalise these patterns from `/igra`:

- dynamic client-only loading of the WebGL runtime;
- one runtime object with explicit `resize`, pause, and `dispose` operations;
- `ResizeObserver` integration;
- `prefers-reduced-motion` handling;
- instanced repeated geometry;
- merged static geometry where appropriate;
- deterministic animation state;
- removal and disposal of buffers, geometries, textures, and materials;
- an explicit unsupported-WebGL state.

Do not reuse:

- `IGRA_SCENE` screen coordinates;
- the orthographic camera;
- `OrbitControls`;
- decorative roads, buildings, trees, or vehicle geometry;
- the fixed diorama extent.

The current uncommitted `/igra` work is user-owned and must not be overwritten.
Simulator extraction must preserve its behaviour and tests.

## Hourly frame contract

The server normalises all data into one contract. A response contains 28
hourly frames: 24 previous hours, the current hour, and three forecast hours.

```ts
type SimulationFrame = {
  validAt: string;
  kind: "observed" | "current" | "forecast";
  availability: "ready" | "partial" | "unavailable";
  wind: {
    directionFrom: number;
    speed: number;
    mixingHeight: number;
    sources: string[];
    observedAt: string | null;
  } | null;
  stations: Array<{
    id: "k1" | "k2";
    substance: "h2s" | "mercaptans";
    value: number | null;
    unit: string;
    quality: string | null;
    observedAt: string | null;
  }>;
};
```

The public contract carries inputs and provenance, not rendered map pixels.
The exact wire format may pack repeated numeric data compactly, but it must
preserve the semantics above and remain independently testable.

## Data sources

### Previous 24 hours

- Use observed wind from the existing ordered source chain where historical
  values are available.
- Use modelled mixing-layer depth for the corresponding hour.
- Use the official hourly H₂S value from Karepovac 1.
- Use the official combined methyl/ethyl mercaptan value from Karepovac 2.
- Preserve missing values. A station measurement is never invented or filled
  from the plume model.

### Current hour

Use the existing `dohvatiZrak` source selection and freshness rules, extended
behind the common frame contract. Current station values follow the same
quality and missing-data rules as historical values.

### Next three hours

Extend the existing weather request to include hourly forecast wind speed,
wind direction, and boundary-layer height. No new managed Marketplace
integration is required: the Vercel Marketplace currently has no weather
category, and the project already has a direct weather adapter.

Forecast frames contain no fabricated station readings. Station markers remain
visible and state that measurements do not yet exist for the selected hour.

## Dispersion computation

### Unit-emission simulation

After the hourly inputs load, WebGL computes one unit-emission transport state
per hour and carries concentration state from one hour to the next. Six hidden
hourly meteorological inputs warm up the first visible historical frame, so the
start of the visible 24-hour window is not treated as a clean atmosphere. These
warm-up hours are never exposed on the timeline or reported as part of the 28
visible frames.

The terrain-aware wind bases already generated by
`scripts/izvedi-polje-dima.py` remain the source for the local vector field.
They are uploaded as textures or converted to a compact browser-safe form. The
runtime advances a concentration texture using the selected hour's vector
field, diffusion, and decay configuration, then caches the resulting texture
for timeline playback.

The two substances share atmospheric transport in the first release but have
independent source strength, decay/configuration metadata, colour, visibility,
and display texture. The design must not invent unrelated plume paths merely
to make the colours look different.

### Emission controls

Each substance has an independent `0–5×` emission slider:

- `0×` emits none of that substance;
- `1×` H₂S uses the existing calibrated H₂S source strength;
- `1×` mercaptans uses a baseline obtained by running the existing inverse
  source-calibration method independently against valid combined
  methyl/ethyl-mercaptan hours from Karepovac 2;
- `5×` is the first-release upper scenario bound.

Changing a slider multiplies its unit concentration on the GPU and does not
rerun transport. Slider values are simulation controls, not opacity controls.
Opacity follows the colour ramp and concentration field.

## Interface

### Persistent chrome

A compact top bar contains:

- a back action;
- the title **Karepovac simulator**;
- selected local date and hour;
- observed, current, or forecast status;
- source freshness when relevant.

A bottom timeline spans `−24 h` through `+3 h`, snaps to whole hours, and
visually separates observed/current frames from forecast frames. It supports
pointer, touch, and keyboard input.

Desktop controls use a right-side panel. Mobile controls use a draggable bottom
sheet that leaves the selected area of the map visible.

### Substance controls

Each H₂S and mercaptan row contains:

- visibility toggle;
- colour control;
- emission-strength slider with numeric `×` output;
- compact legend for the selected colour ramp.

Both rows may be active simultaneously. Semitransparent concentration fills and
contour edges keep overlap readable. Where fields overlap, selected colours
blend; outlines and text labels preserve identity without relying on colour
alone.

### Wind controls

Wind particles and wind arrows are independent toggles. The panel also shows
the selected frame's direction, speed, mixing-layer depth, source, and age.
Reduced-motion preference disables continuous particle animation by default
without hiding static arrows.

### Map controls

Users can choose or toggle:

- street map;
- orthophoto;
- relief shading;
- buildings;
- 3D relief;
- monitoring stations;
- centre on Karepovac.

### Monitoring stations

Station markers render above concentration fields. Selecting a station shows:

- station name and measured substance;
- value and unit at the selected observed/current hour;
- measurement time;
- data-quality label;
- an explicit missing-measurement state.

For forecast frames the panel says that the measurement does not yet exist.

## URL state

The selected hour offset, enabled layers, visible substances, colours, emission
multipliers, and camera are represented in the query string so a scenario can
be shared. URL writes use `replaceState` during interaction. Invalid or
out-of-range values fall back to documented defaults.

The exact parameter names are chosen during implementation planning, but the
state round-trip is a required tested behaviour.

## Loading and error behaviour

- Show map context as soon as MapLibre is ready.
- Show a visible simulation warm-up state while concentration textures are
  prepared.
- A missing historical wind frame is unavailable and cannot be selected as a
  valid simulation frame.
- If forecast weather is unavailable, the timeline ends at the current hour.
- Missing station values leave the marker visible with **Nema mjerenja**.
- Stale inputs display their age and provenance.
- Base-tile failure retains the local simulation over a simplified local
  background.
- WebGL failure shows a concise explanation and links to
  `/karepovac/zrak`; the simulator does not pretend to be running.
- A failure in one optional visual layer does not take down the timeline or
  other layers.

## Accessibility and performance

- All controls have visible focus and work by keyboard.
- Timeline and sliders expose useful `aria-valuetext` in Croatian.
- Substance identity is not encoded by colour alone.
- Station and simulation status changes use restrained live-region updates.
- Touch targets are at least 44 px.
- Reduced-motion mode starts with particles paused.
- The WebGL runtime is dynamically imported and absent from unrelated routes.
- Concentration textures and repeated arrows/particles use GPU-friendly packed
  data and instancing.
- Cached hourly textures are bounded to the 28 visible frames plus hidden
  warm-up state.
- All resources are released when the route unmounts.

## Testing

### Pure and data tests

- normalisation of observed, current, forecast, partial, and unavailable
  frames;
- exactly 24 visible historical hours and at most three forecast hours;
- missing station measurements remain missing;
- source freshness and fallback ordering;
- concentration state carried between hours;
- warm-up does not expose extra timeline frames;
- independent H₂S and mercaptan scaling;
- `0×`, `1×`, and `5×` boundaries;
- colour parsing and blend configuration;
- URL state round-trip and invalid-value fallback;
- camera-centre and maximum-bound calculations.

### Component tests

- timeline pointer and keyboard behaviour;
- desktop panel and mobile bottom-sheet controls;
- independent substance visibility, colour, and strength controls;
- independent particle and arrow toggles;
- station observed, missing, and forecast states;
- reduced-motion defaults;
- simulator isolation from `/karepovac/zrak`.

### WebGL/runtime tests

- MapLibre camera matrix is the only geographic camera authority;
- renderer resize and pixel ratio limits;
- frame texture creation, switching, and bounded caching;
- deterministic unit-emission scaling;
- runtime disposal and route remount;
- unsupported-WebGL fallback.

### End-to-end verification

Run the simulator through the complete desktop and mobile flow with controlled
frame fixtures. Verify Karepovac-centred initial framing, timeline playback,
forecast boundary, dual-substance overlap, emission changes, station popovers,
wind toggles, 3D-relief round-trip, URL restoration, and fallback states.
Capture desktop and mobile screenshots for visual review.

## Implementation boundaries

Keep the following units independently understandable and testable:

1. **Frame adapter** — fetches and normalises weather and station inputs.
2. **Simulation model** — advances and caches unit-emission fields.
3. **Map runtime** — owns MapLibre and the Three.js custom layer lifecycle.
4. **Simulator state** — owns timeline, layers, substances, URL state, and
   defaults.
5. **Controls** — renders accessible desktop/mobile controls without knowing
   WebGL internals.
6. **Station presentation** — renders selected-frame measurements without
   affecting simulation state.

No single component should combine external-data fetching, simulation math,
MapLibre setup, and panel markup.

## Delivery outcome

The first release is the complete approved experience, not a current-only
prototype: `/karepovac/sim`, previous 24 hours, current conditions, three-hour
forecast, Karepovac-centred top-down map, optional 3D relief, selectable map
context, stations, wind particles and arrows, and independently coloured and
scaled H₂S and mercaptan simulations.
