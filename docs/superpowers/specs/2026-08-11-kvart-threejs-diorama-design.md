# Kvart Three.js Diorama — Design Specification

- **Status:** approved for implementation
- **Date:** 2026-08-11
- **Route:** `/igra`
- **Fallback:** `/svg`
- **Primary device:** mobile web browser

## Purpose

Replace the rejected flat SVG presentation with a genuinely spatial, low-poly
model while keeping the road network, buildings and aqueduct recognizable from
the checked-in GIS data. The result is a calm diorama to observe, not a game or
an interactive map.

## Spatial model

The build-time GIS generator remains the single geometry source. The generated
SVG coordinates are a uniform isometric projection, so the WebGL renderer must
invert that projection into east/south ground coordinates before Three.js
applies its own camera. Applying the camera directly to the projected
coordinates would distort the neighborhood twice and is not acceptable.

Roads render as flat ribbon meshes with three visible hierarchy levels. The
largest 10% of the 1,501 source building footprints retain every polygon vertex
and their common projection scale, rather than the seven-vertex simplification
used for background buildings. Reliable City-GIS height matches require at
least 85% geometric overlap; OSM height or floor count is used only when no
reliable City match exists, and every remaining height is marked as estimated.
Building footprints become conservative extrusions grouped by material to keep
draw calls bounded. The aqueduct is a repeated limestone pier-and-beam landmark
following its generated alignment. Broad terrain fills are visual facets only;
they do not claim measured elevation.

## Camera and interaction

Use an orthographic camera whose isometric angle cannot rotate. The initial
view keeps the full neighborhood in frame; wheel and pinch zoom toward the
pointer, drag pans within bounded scene limits, and visible plus, minus and
reset controls provide keyboard and touch equivalents. Zoom is limited from
1× to 5×. Mobile may use a tighter initial board fit but keeps the same camera direction. DOM place labels are
projected from Three.js world anchors so Dračevac, Bilice and Akvadukt remain
legible without adding a text-rendering dependency.

The only control pauses or resumes ambient traffic. It is keyboard accessible,
at least 44 px high and exposes state through `aria-pressed`. Reduced-motion
preference starts the scene paused.

## Loading, fallback and performance

The server route renders the title, source attribution, canvas, loading state
and fallback link without a database or network request. Three.js and the scene
engine load only after `/igra` hydrates. The renderer caps device pixel ratio at
1.75, merges road and building geometry by material, reuses instanced trees and
stops requesting animation frames while paused.

If WebGL construction fails, the route states that the 3D view is unavailable
and links to the preserved `/svg` model. The source and simplified-model
disclaimer remain visible in every state.

## Verification

Automated checks cover inverse projection, road ribbon topology, full-vertex
top-decile footprints, reliable height sources, metre-to-world height scaling,
real-polyline vehicle sampling and the accessible route/fallback contract. Browser checks
cover WebGL2 readiness, zero horizontal overflow, visible labels, pause/resume,
reduced-motion startup and phone/desktop screenshots. A production build must
retain the `kvart-threejs-rct-20260811` direction contract in emitted markup.
