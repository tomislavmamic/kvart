import assert from "node:assert/strict";
import test from "node:test";

test("the SVG isometric projection is inverted before Three.js positions the camera", async () => {
  const model = await import("./three-scene-model").catch(() => null);
  assert.ok(model, "the Three.js scene model should exist");

  assert.deepEqual(model.scenePointToWorld([800, 410]), { x: 0, z: 0 });
  assert.deepEqual(model.scenePointToWorld([808, 414]), { x: 1, z: 0 });
  assert.deepEqual(model.scenePointToWorld([792, 414]), { x: 0, z: 1 });
});

test("road ribbons remain flat, centered strips with indexed triangles", async () => {
  const model = await import("./three-scene-model").catch(() => null);
  assert.ok(model, "the Three.js scene model should exist");

  const ribbon = model.buildRoadRibbon(
    [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    ],
    2,
    0.15,
  );

  assert.deepEqual(ribbon.positions, [0, 0.15, 1, 0, 0.15, -1, 10, 0.15, 1, 10, 0.15, -1]);
  assert.deepEqual(ribbon.indices, [0, 2, 1, 2, 3, 1]);
});

test("animated vehicles follow the whole real road polyline", async () => {
  const model = await import("./three-scene-model").catch(() => null);
  assert.ok(model, "the Three.js scene model should exist");

  const path = [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 6 },
  ];

  assert.deepEqual(model.samplePolyline(path, 0), { x: 0, z: 0, angle: 0 });
  assert.deepEqual(model.samplePolyline(path, 0.5), {
    x: 4,
    z: 1,
    angle: Math.PI / 2,
  });
  assert.deepEqual(model.samplePolyline(path, 1), {
    x: 4,
    z: 6,
    angle: Math.PI / 2,
  });
});

test("framing leaves room for the block to turn without clipping its corners", async () => {
  const model = await import("./three-scene-model");

  const landscape = model.sceneFrustumHeight(1450, 828);
  assert.ok(
    (landscape * 1450) / 828 >= 140,
    "a rotating 113 × 69 block spans 132 units on its diagonal and must still fit",
  );
  assert.ok(
    model.sceneFrustumHeight(390, 772) < 260,
    "portrait framing should crop the board slightly instead of shrinking traffic into a thumbnail",
  );
});

test("building extrusion uses measured metres on the same vertical scale as the terrain", async () => {
  const model = await import("./three-scene-model");
  const unitsPerMetre = 0.056187;

  assert.ok(Math.abs(model.buildingWorldHeight(9.45, unitsPerMetre) - 9.45 * unitsPerMetre) < 1e-9);
  assert.ok(
    Math.abs(model.buildingWorldHeight(18.58, unitsPerMetre) - 18.58 * unitsPerMetre) < 1e-9,
  );
  assert.equal(model.buildingWorldHeight(3, unitsPerMetre), 4.5 * unitsPerMetre);
  assert.equal(model.buildingWorldHeight(120, unitsPerMetre), 27 * unitsPerMetre);
});

test("ground height reads the same surface the terrain mesh draws", async () => {
  const model = await import("./three-scene-model");
  // Dvije ćelije: sjeverni rub na 10 m, južni na 20 m, istočni stupac +4 m.
  const grid = {
    cols: 2,
    rows: 2,
    world: { west: 0, north: 0, east: 10, south: 10 },
    heights: Float32Array.from([10, 14, 20, 24]),
    cover: Uint8Array.from([0, 0, 0, 0]),
  };

  assert.equal(model.groundHeight(grid, 0, 0), 10);
  assert.equal(model.groundHeight(grid, 10, 0), 14);
  assert.equal(model.groundHeight(grid, 0, 10), 20);
  assert.equal(model.groundHeight(grid, 10, 10), 24);
  // Sredina pada na dijagonalu sjeveroistok–jugozapad; obje je strane dijele.
  assert.ok(Math.abs(model.groundHeight(grid, 5, 5) - 17) < 1e-6);
  // Izvan mreže se rub produžuje umjesto da nastane rupa u tlu.
  assert.equal(model.groundHeight(grid, -40, -40), 10);
  assert.equal(model.groundHeight(grid, 40, 40), 24);
});

test("roads are resampled before they are draped, so they follow the slope", async () => {
  const model = await import("./three-scene-model");

  const dense = model.resamplePolyline([{ x: 0, z: 0 }, { x: 9, z: 0 }], 2);
  assert.equal(dense.length, 6);
  assert.deepEqual(dense[0], { x: 0, z: 0 });
  assert.deepEqual(dense.at(-1), { x: 9, z: 0 });
  assert.ok(
    dense.every((point, index) =>
      index === 0 || Math.hypot(point.x - dense[index - 1].x, point.z - dense[index - 1].z) <= 2 + 1e-9,
    ),
    "no gap between samples may exceed the requested step",
  );
});

test("draped ribbons carry a height per vertex instead of one flat elevation", async () => {
  const model = await import("./three-scene-model");

  const ribbon = model.buildDrapedRibbon(
    [
      { x: 0, y: 1, z: 0 },
      { x: 10, y: 3, z: 0 },
    ],
    2,
  );

  assert.deepEqual(ribbon.positions, [0, 1, 1, 0, 1, -1, 10, 3, 1, 10, 3, -1]);
  assert.deepEqual(ribbon.indices, [0, 2, 1, 2, 3, 1]);
});

test("hip roofs face outward and shrink to a pyramid on a square footprint", async () => {
  const model = await import("./three-scene-model");

  // Front-facing is clockwise in (x, z), the same winding the terrain mesh
  // uses; a flipped roof would simply not be drawn.
  function facesUp(roof: { positions: number[]; indices: number[] }) {
    const at = (i: number) => [roof.positions[i * 3], roof.positions[i * 3 + 2]];
    for (let t = 0; t < roof.indices.length; t += 3) {
      const [ax, az] = at(roof.indices[t]);
      const [bx, bz] = at(roof.indices[t + 1]);
      const [cx, cz] = at(roof.indices[t + 2]);
      const determinant = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      if (determinant > 1e-9) return false;
    }
    return true;
  }

  const long = model.buildHipRoof(
    { x: 0, z: 0, angle: 0, length: 10, width: 4 },
    1,
    3,
  );
  assert.equal(long.positions.length / 3, 6, "four eaves and a two-point ridge");
  assert.ok(facesUp(long), "every roof triangle must be wound outward");
  const ridgeY = long.positions.filter((_, i) => i % 3 === 1).filter((y) => y === 3);
  assert.equal(ridgeY.length, 2, "a long footprint keeps a ridge, not an apex");

  const square = model.buildHipRoof(
    { x: 0, z: 0, angle: 0, length: 6, width: 6 },
    1,
    3,
  );
  assert.ok(facesUp(square));
  const apex = [0, 1, 2, 3, 4, 5]
    .map((i) => [square.positions[i * 3], square.positions[i * 3 + 2]])
    .filter((_, i) => i >= 4);
  assert.deepEqual(apex[0], apex[1], "a square footprint collapses the ridge to one apex");

  // Kut zaokreće cijeli krov, a ne samo sljeme.
  const turned = model.buildHipRoof(
    { x: 0, z: 0, angle: Math.PI / 2, length: 10, width: 4 },
    1,
    3,
  );
  assert.ok(facesUp(turned), "rotating the frame must not flip the winding");
  // Zaokret za pravi kut zamijeni osi: duljina od 10 m sad ide po z, širina
  // od 4 m po x. Prva streha stoji na (2, −5), a ne na (−5, −2).
  assert.ok(Math.abs(turned.positions[0] - 2) < 1e-6);
  assert.ok(Math.abs(turned.positions[2] + 5) < 1e-6);
});

test("roof rise follows the building's width until the building is too low for it", async () => {
  const model = await import("./three-scene-model");

  // 8 m wide under a 22° pitch is about 1,6 m of ridge.
  assert.ok(Math.abs(model.roofRiseMetres(8, 9) - 4 * Math.tan((22 * Math.PI) / 180)) < 1e-9);
  // A wide, low shed would otherwise grow a tent for a roof.
  assert.equal(model.roofRiseMetres(40, 4), 4 * 0.45);
});

test("the exaggeration control cycles through a true scale and back", async () => {
  const model = await import("./three-scene-model");

  assert.equal(model.EXAGGERATION_STEPS[0], 1, "one step must show the real proportion");
  assert.ok(model.EXAGGERATION_STEPS.includes(model.DEFAULT_EXAGGERATION));
  const visited = [model.DEFAULT_EXAGGERATION];
  for (let step = 0; step < model.EXAGGERATION_STEPS.length; step += 1) {
    visited.push(model.nextExaggeration(visited.at(-1)!));
  }
  assert.equal(visited.at(-1), model.DEFAULT_EXAGGERATION, "the cycle must return home");
  assert.equal(new Set(visited).size, model.EXAGGERATION_STEPS.length);
});

test("camera zoom buttons respect the inspection range", async () => {
  const model = await import("./three-scene-model");

  assert.equal(model.nextCameraZoom(1, "in"), 1.4);
  assert.equal(model.nextCameraZoom(4.9, "in"), 5);
  assert.equal(model.nextCameraZoom(1.1, "out"), 1);
  assert.equal(model.nextCameraZoom(3, "reset"), 1);
});
