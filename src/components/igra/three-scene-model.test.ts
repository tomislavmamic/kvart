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

test("portrait framing prioritizes readable streets while desktop keeps the full board", async () => {
  const model = await import("./three-scene-model");

  assert.equal(model.sceneFrustumHeight(1450, 828), 104);
  assert.ok(
    model.sceneFrustumHeight(390, 772) < 220,
    "portrait framing should crop the board slightly instead of shrinking traffic into a thumbnail",
  );
});

test("building extrusion uses measured metres instead of footprint area", async () => {
  const model = await import("./three-scene-model");

  assert.ok(Math.abs(model.buildingWorldHeight(9.45) - 1.063125) < 1e-9);
  assert.ok(Math.abs(model.buildingWorldHeight(18.58) - 2.09025) < 1e-9);
  assert.equal(model.buildingWorldHeight(3), 0.48);
});

test("camera zoom buttons respect the inspection range", async () => {
  const model = await import("./three-scene-model");

  assert.equal(model.nextCameraZoom(1, "in"), 1.4);
  assert.equal(model.nextCameraZoom(4.9, "in"), 5);
  assert.equal(model.nextCameraZoom(1.1, "out"), 1);
  assert.equal(model.nextCameraZoom(3, "reset"), 1);
});
