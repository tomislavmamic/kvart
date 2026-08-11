# Kvart Low-Poly Diorama — Design Specification

- **Status:** approved prototype design
- **Date:** 2026-08-11
- **Route:** `/igra`
- **Primary device:** mobile and desktop web browsers

## Purpose

Create a recognizable, animated miniature of Dračevac and Bilice that people
can watch like a living model. The visual language combines RollerCoaster
Tycoon’s fixed isometric camera and tiny ambient activity, Dorfromantik’s calm
terrain clarity, and ISLANDERS’ modern low-poly buildings.

The prototype is a diorama, not a game. Visitors do not build, score, rotate,
pan, or zoom the scene.

## Scene composition

`/igra` uses the existing site header followed by a full-width diorama. The
scene is framed by one fixed isometric camera and fits within the viewport
without horizontal page overflow.

The geography is derived from the repository’s existing GIS exports rather
than drawn as a fictional generic neighborhood. It must preserve enough of the
real spatial pattern to make the following unmistakable:

- the main Dračevac–Bilice road skeleton;
- the largest building footprints and their relative massing;
- the aqueduct as a prominent linear landmark; and
- recognizable clusters of homes.

The prototype generalizes small buildings and secondary roads. It is a visual
interpretation, not a cadastral or surveying product. Terrain is represented
with restrained green and stone facets; it does not claim measured elevation.

## Visual direction

Use an original low-poly civic miniature, not copied game art or assets.
Buildings have simple top and side faces, readable silhouettes, soft fixed
shadows, and a muted Mediterranean palette. Main roads remain legible at phone
size. Large buildings and the aqueduct receive stronger silhouettes than the
homes around them.

The page carries a small title, `Kvart u pokretu`, and a short statement that
the scene is a stylized model based on available neighborhood data. Labels are
limited to Dračevac, Bilice, and Akvadukt so the diorama remains the primary
content.

## Ambient animation

The scene uses quiet, continuously looping motion:

- small cars and one bus follow selected real road paths;
- a few pedestrian figures move near homes and large buildings;
- trees sway slightly;
- chimney smoke drifts;
- birds cross the scene; and
- fixed shadows shift only subtly.

Loops must not visibly jump at their boundaries. Motion uses CSS transforms and
opacity where possible. There is no audio.

Visitors can pause or resume all non-essential motion with a control labelled
`Pauziraj animaciju` / `Pokreni animaciju`. The control is at least 44 px high,
is keyboard accessible, and exposes its current state. With
`prefers-reduced-motion: reduce`, the initial state is a composed still scene
and no automatic movement starts.

## Technical approach

Use a lightweight SVG implementation. Do not add Canvas, WebGL, Three.js, a
mapping library, or another runtime dependency for the prototype.

The geometry generator reads these checked-in sources:

- `public/geo/grad/ulice-osi.geojson` for the principal street skeleton;
- `public/geo/grad/zgrade-visine.geojson` for building footprints and relative
  massing; and
- `public/geo/grad/kulturno-dobro.geojson` for the protected
  `Dioklecijanov vodovod` geometry used to place the aqueduct.

It clips all inputs to the existing neighborhood boundary and writes the
deterministic result to `src/generated/igra-scene.ts`.

The implementation has four boundaries:

1. a deterministic build-time script reads and simplifies the selected local
   GeoJSON road and building sources;
2. a generated, typed scene-data module contains only the geometry needed by
   `/igra`;
3. a server component renders the complete accessible SVG scene; and
4. a small client controller owns pause state and the reduced-motion default.

The route has no database dependency, external network request, browser
geolocation, analytics event, or persistent user state.

If required source geometry is missing during generation, the script exits
with a clear error naming the missing source. The application must not silently
substitute a fictional neighborhood.

## Responsive behavior

- On wide screens, the entire diorama is visible at once beneath the header.
- On phones, the same fixed composition scales down to fit the viewport; the
  camera does not change and the page does not introduce horizontal scrolling.
- Critical silhouettes and the three labels remain legible at 390 px.
- Decorative detail may be hidden below 640 px if it would obscure the road
  structure or landmark labels.

## Accessibility

- The SVG has a concise accessible name and description.
- Important meaning is not encoded only through color or animation.
- The three place labels are real text, not paths.
- The pause control has a visible focus state.
- Reduced-motion mode removes all non-essential animation.
- The static composition remains complete when CSS animation is unavailable.

## Verification

Automated checks cover:

- deterministic geometry generation from the checked-in sources;
- presence of the road, large-building, aqueduct, and home scene groups;
- route rendering without a database;
- fixed-camera markup with no pan, zoom, or pointer manipulation handlers;
- accessible pause/resume state; and
- reduced-motion CSS that disables every ambient animation group.

Browser verification covers 390 px, 768 px, 1280 px, and 1450 px widths. Each
width must have zero horizontal overflow, legible labels, a visible pause
control, and a stable composed scene. Desktop performance should remain smooth
under normal conditions, while reduced-motion mode must show no automatic
movement.

## Prototype non-goals

- Building or editing the neighborhood.
- Camera movement or direct scene manipulation.
- Game rules, scoring, objectives, or simulation state.
- Photorealistic buildings or precise terrain elevation.
- Displaying every road, structure, address, parcel, or GIS attribute.
- A day/night cycle, weather system, soundscape, or live traffic data.
- Adding `/igra` to the primary navigation before the prototype is reviewed.
