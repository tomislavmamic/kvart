import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

type GeneratedScene = {
  land: Array<[number, number]>;
  terrain: Array<{ name: string; points: Array<[number, number]> }>;
  roads: Array<{
    sourceId: string;
    sourcePathIndex: number;
    points: Array<[number, number]>;
  }>;
  buildings: Array<{
    id: string;
    kind: "home" | "large";
    base: Array<[number, number]>;
    topDecile: boolean;
    sourceVertexCount: number;
    footprintArea: number;
    heightMeters: number;
    heightSource: "city-gis" | "openstreetmap" | "neighbourhood-median";
    baseMetres: number | null;
    ridgeMetres: number | null;
    roof: "flat" | "pitched" | null;
    roofShape: "gabled" | "hipped" | null;
    roofSource: "city-gis" | "openstreetmap" | null;
    roofFrame: { x: number; z: number; angle: number; length: number; width: number } | null;
  }>;
  aqueduct: { arches: Array<[number, number]> };
  vehiclePaths: Array<{ points: Array<[number, number]> }>;
  trees: Array<{ point: [number, number]; kind: string; size: number }>;
  relief: {
    cover: { file: string; classes: readonly string[] };
    file: string;
    cols: number;
    rows: number;
    stepMetres: number;
    lowestMetres: number;
    highestMetres: number;
    world: { west: number; north: number; east: number; south: number };
    unitsPerMetre: number;
    source: string;
  };
  labels: Array<{ text: string }>;
};

const projectRoot = path.resolve(import.meta.dirname, "..");
const tsxBin = path.join(projectRoot, "node_modules", ".bin", "tsx");
const generator = path.join(projectRoot, "scripts", "generate-igra-scene.ts");

function generate(outputPath: string) {
  return spawnSync(tsxBin, [generator, "--output", outputPath], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function parseGeneratedModule(source: string): GeneratedScene {
  const prefix = "export const IGRA_SCENE = ";
  const suffix = " as const;";
  assert.ok(source.startsWith(prefix), "generator should emit the scene export");
  assert.ok(source.trimEnd().endsWith(suffix), "scene export should be immutable");
  return JSON.parse(source.slice(prefix.length, source.lastIndexOf(suffix)));
}

test("local GIS sources generate a deterministic recognizable Kvart scene", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kvart-igra-"));
  const firstPath = path.join(directory, "first.ts");
  const secondPath = path.join(directory, "second.ts");

  try {
    const first = generate(firstPath);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const second = generate(secondPath);
    assert.equal(second.status, 0, second.stderr || second.stdout);

    const firstSource = readFileSync(firstPath, "utf8");
    const secondSource = readFileSync(secondPath, "utf8");
    assert.equal(secondSource, firstSource, "same inputs should produce identical output");

    const scene = parseGeneratedModule(firstSource);
    assert.equal(scene.terrain.length, 2, "Dračevac and Bilice should shape the terrain");
    assert.equal(scene.land.length, 4, "every road should sit on one continuous inland base");
    assert.ok(scene.roads.length >= 200, "the complete local street network should remain legible");
    assert.ok(scene.buildings.length >= 300, "home clusters should remain recognizable");
    assert.ok(
      scene.buildings.filter((building) => building.kind === "large").length >= 40,
      "large buildings should keep their stronger massing",
    );
    const largestDecile = scene.buildings.filter((building) => building.topDecile);
    assert.equal(largestDecile.length, 151, "the largest 10% should be explicit in the scene");
    assert.ok(
      largestDecile.every(
        (building) => building.base.length === building.sourceVertexCount,
      ),
      "top-decile buildings should retain every source footprint vertex",
    );
    assert.ok(
      largestDecile.filter((building) => building.heightSource === "city-gis").length >= 65,
      "reliable City GIS heights should replace area-based guesses",
    );
    const largestBuilding = scene.buildings.find((building) => building.id === "zgrada-45");
    assert.ok(largestBuilding, "the largest source building should remain identifiable");
    assert.equal(largestBuilding.base.length, 15);
    assert.equal(largestBuilding.heightMeters, 9.45);
    assert.equal(largestBuilding.heightSource, "city-gis");
    assert.ok(largestBuilding.footprintArea > 6700);
    assert.ok(scene.aqueduct.arches.length >= 12, "the aqueduct should read as a landmark");
    assert.ok(scene.vehiclePaths.length >= 2, "ambient traffic needs real road paths");
    assert.ok(scene.trees.length >= 200, "trees should come from real green surfaces");
    assert.ok(
      scene.trees.some((tree) => tree.kind === "wood") &&
        scene.trees.some((tree) => tree.kind === "scrub"),
      "wood and scrub should be told apart, they do not look the same from above",
    );
    assert.deepEqual(
      scene.labels.map((label) => label.text).toSorted(),
      ["Akvadukt", "Bilice", "Dračevac"],
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("measured city heights reach every building that has one, not just the largest", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kvart-igra-zgrade-"));
  const outputPath = path.join(directory, "scene.ts");

  try {
    const generated = generate(outputPath);
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const scene = parseGeneratedModule(readFileSync(outputPath, "utf8"));

    const measured = scene.buildings.filter((b) => b.heightSource === "city-gis");
    assert.ok(
      measured.length >= 170,
      `matching was limited to the top decile before; every building is tried now (${measured.length})`,
    );
    assert.ok(
      measured.filter((b) => !b.topDecile).length >= 100,
      "most of the newly measured buildings are ordinary homes, not the large ones",
    );

    // Kota dna i kota vrha idu zajedno ili nikako — pola para ne postavlja
    // zgradu ni na što.
    assert.ok(
      measured.every((b) => b.baseMetres !== null && b.ridgeMetres !== null),
      "a measured building must carry both its floor and its ridge elevation",
    );
    assert.ok(
      measured.every((b) => b.ridgeMetres! > b.baseMetres!),
      "the ridge must stand above the floor",
    );
    assert.ok(
      measured.every(
        (b) => Math.abs(b.ridgeMetres! - b.baseMetres! - b.heightMeters) < 0.02,
      ),
      "height must be the difference of the two measured elevations, not a separate claim",
    );

    // Nemjerene zgrade ne smiju se predstavljati kao mjerene.
    const guessed = scene.buildings.filter((b) => b.heightSource === "neighbourhood-median");
    assert.ok(guessed.length > 0);
    assert.ok(
      guessed.every((b) => b.baseMetres === null && b.ridgeMetres === null),
      "a guessed building must not carry an absolute elevation",
    );
    // Krov smije: oblik dolazi iz OSM-a i ne pretvara procijenjenu visinu u
    // izmjerenu — izvor svakog od to dvoje stoji zasebno.
    assert.ok(
      guessed.every((b) => b.roofSource !== "city-gis"),
      "a guessed building must not borrow the city layer's authority for its roof",
    );

    const pitched = scene.buildings.filter((b) => b.roof === "pitched");
    assert.ok(pitched.length >= 120, "most measured buildings here are ROOF_NOT_FLAT");
    assert.ok(
      scene.buildings.every((b) => b.roofFrame === null || b.roof === "pitched"),
      "only a pitched roof gets a frame to be built on",
    );
    assert.ok(
      pitched.filter((b) => b.roofFrame).length < pitched.length,
      "footprints too ragged for a hip roof must fall back to plain massing",
    );
    assert.ok(
      pitched.every((b) => !b.roofFrame || b.roofFrame.length >= b.roofFrame.width),
      "the ridge always runs along the longer axis",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("OSM names the roof shape but never overrules a measured flat roof", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kvart-igra-krov-"));
  const outputPath = path.join(directory, "scene.ts");

  try {
    const generated = generate(outputPath);
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const scene = parseGeneratedModule(readFileSync(outputPath, "utf8"));

    // Gdje grad govori, grad odlučuje ima li krov nagib. Provjera nad oba
    // izvora pokazala je da svih 22 neslaganja idu na istu stranu — grad je
    // izmjerio ravan krov, OSM tvrdi kosi — pa bi OSM-ov glas ovdje samo
    // pretvorio mjerenje u pretpostavku.
    const measured = scene.buildings.filter((b) => b.heightSource === "city-gis");
    assert.ok(
      measured.every((b) => b.roofSource === "city-gis"),
      "a measured building must take its roof from the layer that measured it",
    );

    const fromOsm = scene.buildings.filter((b) => b.roofSource === "openstreetmap");
    assert.ok(fromOsm.length >= 100, "OSM should speak where the city layer is silent");
    assert.ok(
      fromOsm.every((b) => b.heightSource !== "city-gis"),
      "OSM may only fill silence, never overwrite",
    );

    // Oblik zna samo OSM; bez njegove riječi kosi krov ostaje četverostrešan.
    assert.ok(
      scene.buildings.every((b) => (b.roofShape === null) === (b.roof !== "pitched")),
      "a shape belongs to a pitched roof and to nothing else",
    );
    const gabled = scene.buildings.filter((b) => b.roofShape === "gabled");
    const hipped = scene.buildings.filter((b) => b.roofShape === "hipped");
    assert.ok(gabled.length > 0 && hipped.length > 0);
    assert.ok(
      hipped.every((b) => b.roofSource === "city-gis"),
      "hipped is the fallback for a pitched roof no one described, not a claim",
    );
    assert.ok(
      scene.buildings.every((b) => b.roof !== "flat" || b.roofShape === null),
      "a flat roof has no ridge to run anywhere",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("land cover is rasterised into the same grid the heights use", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kvart-igra-pokrov-"));
  const outputPath = path.join(directory, "scene.ts");

  try {
    const generated = generate(outputPath);
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const scene = parseGeneratedModule(readFileSync(outputPath, "utf8"));
    const { relief } = scene;

    const cover = readFileSync(path.join(directory, path.basename(relief.cover.file)));
    assert.equal(
      cover.byteLength,
      relief.cols * relief.rows,
      "one cover byte per height cell, or the two grids cannot be read together",
    );
    assert.ok(
      cover.every((value) => value < relief.cover.classes.length),
      "no cell may name a class that does not exist",
    );

    const tally = relief.cover.classes.map(
      (_, value) => cover.reduce((n, cell) => (cell === value ? n + 1 : n), 0),
    );
    // Nerazvrstano ostaje najveći razred: OSM ne pokriva kvart do kraja, a
    // prešutno proglašavanje ostatka kamenjarom bila bi tvrdnja bez izvora.
    assert.equal(relief.cover.classes[0], "golo");
    assert.ok(tally[0] > cover.byteLength * 0.4, "unclassified ground must stay unclassified");
    assert.ok(
      relief.cover.classes.slice(1).every((_, index) => tally[index + 1] > 0),
      "every declared class must actually appear somewhere on the grid",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the LiDAR relief is cropped to the model and aligned with its geometry", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kvart-igra-relief-"));
  const outputPath = path.join(directory, "scene.ts");

  try {
    const generated = generate(outputPath);
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const scene = parseGeneratedModule(readFileSync(outputPath, "utf8"));
    const { relief } = scene;

    assert.equal(relief.stepMetres, 3, "the grid must stay at its LiDAR step, not be resampled");
    assert.match(relief.source, /DGU/, "the relief source must travel with the data");
    assert.ok(relief.lowestMetres < 15 && relief.highestMetres > 100, "the kvart climbs ~105 m");

    const grid = readFileSync(path.join(directory, path.basename(relief.file)));
    assert.equal(
      grid.byteLength,
      relief.cols * relief.rows * 2,
      "the binary must hold exactly one int16 per declared cell",
    );

    // Mreža mora prekriti svaku točku koja se crta, inače cesta na rubu
    // makete visi nad ničim.
    const drawn = [
      ...scene.land,
      ...scene.roads.flatMap((road) => road.points),
      ...scene.buildings.flatMap((building) => building.base),
    ];
    const worldX = ([x, y]: [number, number]) => (x - 800 + 2 * (y - 410)) / 2 / 8;
    const worldZ = ([x, y]: [number, number]) => (2 * (y - 410) - (x - 800)) / 2 / 8;
    assert.ok(
      drawn.every(
        (point) =>
          worldX(point) >= relief.world.west &&
          worldX(point) <= relief.world.east &&
          worldZ(point) >= relief.world.north &&
          worldZ(point) <= relief.world.south,
      ),
      "every drawn point must stand on the cropped grid",
    );

    // Okomita mjera se izvodi iz iste projekcije: 1 m mora biti onoliko
    // jedinica koliko je i vodoravni metar, inače zgrada i brdo nisu na istoj
    // skali i preuveličanje laže.
    const spanUnits = relief.world.east - relief.world.west;
    const spanMetres = (relief.cols - 1) * relief.stepMetres;
    assert.ok(
      Math.abs(spanUnits / spanMetres - relief.unitsPerMetre) / relief.unitsPerMetre < 0.02,
      "the declared vertical scale must match the grid's own horizontal scale",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("road directions preserve one uniform metric isometric projection", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kvart-igra-roads-"));
  const outputPath = path.join(directory, "scene.ts");

  try {
    const generated = generate(outputPath);
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const scene = parseGeneratedModule(readFileSync(outputPath, "utf8"));
    const source = JSON.parse(
      readFileSync(path.join(projectRoot, "public/geo/ulice.geojson"), "utf8"),
    ) as {
      features: Array<{
        properties: { id: string };
        geometry: { type: "LineString"; coordinates: Array<[number, number]> };
      }>;
    };

    const sourceRoad = source.features.find(
      (feature) => feature.properties.id === "way/25551618",
    );
    const projectedRoad = scene.roads.find(
      (road) => road.sourceId === "way/25551618" && road.sourcePathIndex === 0,
    );
    assert.ok(sourceRoad, "known OSM road fixture should exist");
    assert.ok(projectedRoad, "known OSM road should survive scene generation");

    const [[lonA, latA], [lonB, latB]] = sourceRoad.geometry.coordinates;
    const [[xA, yA], [xB, yB]] = projectedRoad.points;
    const east = (lonB - lonA) * Math.cos((43.525 * Math.PI) / 180);
    const south = latA - latB;
    const expectedX = east - south;
    const expectedY = (east + south) / 2;
    const actualX = xB - xA;
    const actualY = yB - yA;
    const normalizedCross =
      Math.abs(actualX * expectedY - actualY * expectedX) /
      Math.hypot(actualX, actualY) /
      Math.hypot(expectedX, expectedY);

    assert.ok(
      normalizedCross < 0.001,
      `road direction was stretched instead of projected uniformly (${normalizedCross})`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
