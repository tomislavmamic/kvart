export type ScenePoint = readonly [number, number];
export type WorldPoint = Readonly<{ x: number; z: number }>;

export type RoadRibbon = Readonly<{
  positions: number[];
  indices: number[];
}>;

const VIEW_CENTER_X = 800;
const VIEW_CENTER_Y = 410;
const WORLD_SCALE = 8;

function clean(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

export function scenePointToWorld([screenX, screenY]: ScenePoint): WorldPoint {
  const isometricX = screenX - VIEW_CENTER_X;
  const isometricY = screenY - VIEW_CENTER_Y;
  const east = (isometricX + 2 * isometricY) / 2;
  const south = (2 * isometricY - isometricX) / 2;

  return {
    x: clean(east / WORLD_SCALE),
    z: clean(south / WORLD_SCALE),
  };
}

export function buildRoadRibbon(
  points: readonly WorldPoint[],
  width: number,
  elevation: number,
): RoadRibbon {
  if (points.length < 2) return { positions: [], indices: [] };

  const positions: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const directionX = next.x - previous.x;
    const directionZ = next.z - previous.z;
    const length = Math.hypot(directionX, directionZ) || 1;
    const normalX = (-directionZ / length) * halfWidth;
    const normalZ = (directionX / length) * halfWidth;

    positions.push(point.x + normalX, elevation, point.z + normalZ);
    positions.push(point.x - normalX, elevation, point.z - normalZ);

    if (index < points.length - 1) {
      const left = index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, nextLeft, right, nextLeft, nextRight, right);
    }
  });

  return { positions, indices };
}

export function samplePolyline(
  points: readonly WorldPoint[],
  progress: number,
): WorldPoint & { angle: number } {
  if (points.length < 2) {
    const point = points[0] ?? { x: 0, z: 0 };
    return { ...point, angle: 0 };
  }

  const lengths = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index].x, point.z - points[index].z),
  );
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * totalLength;

  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (remaining <= segmentLength || index === lengths.length - 1) {
      const start = points[index];
      const end = points[index + 1];
      const localProgress = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * localProgress,
        z: start.z + (end.z - start.z) * localProgress,
        angle: Math.atan2(end.z - start.z, end.x - start.x),
      };
    }
    remaining -= segmentLength;
  }

  return { ...points.at(-1)!, angle: 0 };
}

export function sceneFrustumHeight(width: number, height: number) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const sceneWidth = aspect < 0.8 ? 108 : 142;
  return Math.max(104, sceneWidth / aspect);
}

export function buildingWorldHeight(heightMeters: number) {
  return Math.max(0.48, Math.min(3, heightMeters * 0.1125));
}

export type CameraZoomAction = "in" | "out" | "reset";

export function nextCameraZoom(current: number, action: CameraZoomAction) {
  if (action === "reset") return 1;
  const next = action === "in" ? current * 1.4 : current / 1.4;
  return Math.max(1, Math.min(5, Math.round(next * 100) / 100));
}
