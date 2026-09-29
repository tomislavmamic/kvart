import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { footprintAppearance, inboundArrows, inboundRoadArrows, isBiliceRoadSceneData, pointInRoadRings, roadColors, roadFrame, wideningFrame, wideningParcelAt, type BiliceRoadSegment, type BiliceRoadWidening } from "./bilice-road-scene-types";

const payload: unknown = JSON.parse(readFileSync(new URL("../../../public/geo/prijedlozi/bilice-cesta-3d.json", import.meta.url), "utf8"));

test("the generated Bilice scene is finite, continuous and fully inside the shared map frame", () => {
  assert.ok(isBiliceRoadSceneData(payload), "the generated asset must satisfy the runtime contract");
  const frame = roadFrame(payload);
  for (const [index, segment] of payload.segments.entries()) {
    for (const [x, , z] of segment.points) {
      assert.ok(x >= frame.minX && x <= frame.maxX);
      assert.ok(z >= frame.minZ && z <= frame.maxZ);
    }
    if (index) {
      const previous = payload.segments[index - 1].points.at(-1)!;
      assert.ok(Math.hypot(...segment.points[0].map((coordinate, axis) => coordinate - previous[axis])) < .15, `${segment.id} must join the previous segment`);
    }
  }
  assert.equal(payload.segments.find((segment) => segment.id === "existing-slip")?.onewayInbound, true, "the D1 slip road cannot be represented as an outbound connection");
});

test("invalid elevations and coordinate arrays fail before creating either renderer", () => {
  assert.ok(isBiliceRoadSceneData(payload));
  const invalidHeight = structuredClone(payload);
  invalidHeight.terrain.heights[0] = Number.POSITIVE_INFINITY;
  assert.equal(isBiliceRoadSceneData(invalidHeight), false);
  const missingHeight = structuredClone(payload);
  missingHeight.terrain.heights.pop();
  assert.equal(isBiliceRoadSceneData(missingHeight), false);
  const invalidCoordinate = structuredClone(payload);
  invalidCoordinate.segments[0].points[0][0] = Number.NaN;
  assert.equal(isBiliceRoadSceneData(invalidCoordinate), false);
  assert.equal(isBiliceRoadSceneData({ ...payload, labels: [{ label: "D1", position: [0, 1] }] }), false);
});

test("inbound arrows reverse the outward-stored route instead of implying an exit onto D1", () => {
  const segment: BiliceRoadSegment = { id: "slip", label: "D1 → Dračevac", kind: "existing", widthM: 6, points: [[0, 0, 0], [100, 0, 0]], onewayInbound: true };
  const arrows = inboundArrows(segment);
  assert.ok(arrows.length > 1);
  for (const [tip, left, right] of arrows) {
    assert.ok(tip[0] < left[0] && tip[0] < right[0], "every arrow points back toward the neighbourhood");
    assert.ok(Math.abs(left[2]) < segment.widthM / 2 && Math.abs(right[2]) < segment.widthM / 2);
  }
  assert.deepEqual(inboundArrows({ ...segment, onewayInbound: false }), []);
});

const widening: BiliceRoadWidening = {
  id: "bilice-75m", label: "Radno proširenje prvih 75 m", lengthM: 75, widthM: 9,
  points: [[0, 10, 0], [75, 12, 0]],
  rings: [[[0, 10, -4.5], [75, 12, -4.5], [75, 12, 4.5], [0, 10, 4.5], [0, 10, -4.5]]],
  parcels: [{ id: "parcel-1", label: "k.č. 1", ownershipLabel: "Vlasništvo nije potvrđeno", overlapM2: 90, rings: [[[-400, 10, -20], [40, 10, -20], [40, 10, 20], [-400, 10, 20], [-400, 10, -20]]] }],
};

test("optional widening preserves old scene compatibility and rejects ambiguous parcel data", () => {
  assert.ok(isBiliceRoadSceneData(payload));
  const { widening: removed, ...legacy } = payload;
  void removed;
  assert.ok(isBiliceRoadSceneData(legacy));
  assert.ok(isBiliceRoadSceneData({ ...legacy, widening }));
  for (const invalid of [null, { ...widening, widthM: 0 }, { ...widening, lengthM: Number.NaN }, { ...widening, adjustedLengthM: Number.POSITIVE_INFINITY }, { ...widening, note: 75 }, { ...widening, rings: [] }, { ...widening, parcels: [{ ...widening.parcels[0], overlapM2: -1 }] }, { ...widening, parcels: [{ ...widening.parcels[0], ownershipLabel: undefined }] }, { ...widening, parcels: [widening.parcels[0], widening.parcels[0]] }]) {
    assert.equal(isBiliceRoadSceneData({ ...legacy, widening: invalid }), false);
  }
});

test("widening focus contains the complete study strip without fitting the whole cadastral estate", () => {
  const frame = wideningFrame(widening);
  for (const [x, , z] of [...widening.points, ...widening.rings.flat()]) {
    assert.ok(x > frame.minX && x < frame.maxX);
    assert.ok(z > frame.minZ && z < frame.maxZ);
  }
  assert.ok(frame.minX > -100, "the long parcel should remain selectable without making the 75 m study strip unreadable");
  assert.ok(frame.maxX - frame.minX < 150);
});

test("parcel selection follows the footprint, includes its edge, and excludes polygon holes", () => {
  assert.equal(wideningParcelAt(widening, 10, 0)?.id, "parcel-1");
  assert.equal(wideningParcelAt(widening, 40, 0)?.id, "parcel-1");
  assert.equal(wideningParcelAt(widening, 50, 0), null);
  const withHole = structuredClone(widening);
  withHole.parcels[0].rings.push([[0, 10, -2], [20, 10, -2], [20, 10, 2], [0, 10, 2], [0, 10, -2]]);
  assert.equal(wideningParcelAt(withHole, 10, 0), null);
  assert.equal(wideningParcelAt(withHole, 10, 10)?.id, "parcel-1");
});

test("the published widening keeps 75 m of chainage distinct from its adjusted alignment", () => {
  assert.ok(isBiliceRoadSceneData(payload));
  assert.ok(payload.widening);
  assert.equal(payload.widening.lengthM, 75);
  assert.equal(payload.widening.widthM, 5);
  const axisLength = payload.widening.points.reduce((total, point, index, points) => index ? total + Math.hypot(point[0] - points[index - 1][0], point[2] - points[index - 1][2]) : total, 0);
  assert.ok(Math.abs(axisLength - payload.widening.adjustedLengthM!) < .1);
  assert.equal(payload.widening.parcels.length, 8);
  const frame = roadFrame(payload);
  for (const [x, , z] of payload.widening.rings.flat()) {
    assert.ok(x >= frame.minX && x <= frame.maxX);
    assert.ok(z >= frame.minZ && z <= frame.maxZ);
    assert.ok(Math.abs(x) <= payload.width / 2 && Math.abs(z) <= payload.depth / 2, "the widening remains over the rendered terrain");
  }
});

test("the selected existing roads keep their geometry and color inside the DPU", () => {
  assert.ok(isBiliceRoadSceneData(payload));
  assert.ok(payload.proposalFootprints?.length);
  for (const segment of payload.segments.filter((segment) => segment.kind === "existing")) {
    const footprints = payload.proposalFootprints.filter((footprint) => footprint.segmentId === segment.id);
    assert.ok(footprints.length > 0);
    assert.ok(footprints.every((footprint) => footprint.source === "existing"), `${segment.id} must not be replaced by a DPU polygon`);
  }
  for (const footprint of payload.proposalFootprints) {
    assert.equal(footprintAppearance(footprint).color, footprint.source === "existing" ? roadColors.existing : roadColors.new);
    if (footprint.source === "dpu") assert.equal(payload.segments.find((segment) => segment.id === footprint.segmentId)?.kind, "new");
  }
  const footprint = payload.proposalFootprints[0];
  assert.equal(isBiliceRoadSceneData({ ...payload, proposalFootprints: [{ ...footprint, source: "unknown" }] }), false);
  assert.equal(isBiliceRoadSceneData({ ...payload, proposalFootprints: [{ ...footprint, widthM: -6 }] }), false);
});

test("inbound arrows stay within selected existing-road footprints in every view", () => {
  assert.ok(isBiliceRoadSceneData(payload));
  const arrows = inboundRoadArrows(payload);
  assert.ok(arrows.length > 0);
  for (const { segmentId, ring } of arrows) {
    assert.equal(segmentId, "existing-slip");
    assert.ok(ring.every(([x, , z]) => payload.proposalFootprints!.some((footprint) => footprint.source === "existing" && footprint.segmentId === segmentId && pointInRoadRings(footprint.rings, x, z))));
  }
  assert.deepEqual(inboundRoadArrows({ ...payload, proposalFootprints: payload.proposalFootprints?.filter((footprint) => footprint.source !== "existing") }), []);
});
