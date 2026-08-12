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
    heightSource: "city-gis" | "openstreetmap" | "estimated";
  }>;
  aqueduct: { arches: Array<[number, number]> };
  vehiclePaths: Array<{ points: Array<[number, number]> }>;
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
    assert.deepEqual(
      scene.labels.map((label) => label.text).toSorted(),
      ["Akvadukt", "Bilice", "Dračevac"],
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
