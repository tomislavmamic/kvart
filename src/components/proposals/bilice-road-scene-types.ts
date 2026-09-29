export type RoadXYZ = [number, number, number];

export type BiliceRoadSegment = {
  id: string;
  label: string;
  kind: "existing" | "new";
  widthM: number;
  points: RoadXYZ[];
  /** Points run from Bilice toward D1; traffic on this segment runs in reverse. */
  onewayInbound?: boolean;
};

export type BiliceRoadFootprint = {
  source: "existing" | "dpu" | "candidate";
  segmentId: string;
  rings: RoadXYZ[][];
  level?: string;
  sheet?: string;
  sourceLayer?: string;
  widthM?: number;
  widthBasis?: string;
  sourcePath?: string;
};

export type BiliceWideningParcel = {
  id: string;
  label: string;
  rings: RoadXYZ[][];
  overlapM2: number;
  ownershipLabel: string;
};

export type BiliceRoadWidening = {
  id: string;
  label: string;
  lengthM: number;
  widthM: number;
  points: RoadXYZ[];
  rings: RoadXYZ[][];
  parcels: BiliceWideningParcel[];
  adjustedLengthM?: number;
  note?: string;
};

export type BiliceRoadSceneData = {
  version: number;
  projection: string;
  origin: [number, number, number];
  width: number;
  depth: number;
  bounds: [number, number, number, number];
  terrain: { cols: number; rows: number; heights: number[]; source: string };
  surfaces: { role: string; label: string; rings: RoadXYZ[][] }[];
  segments: BiliceRoadSegment[];
  proposalFootprints?: BiliceRoadFootprint[];
  buildings: { id: string; rings: RoadXYZ[][]; height: number; source: string }[];
  labels: { label: string; position: RoadXYZ }[];
  note: string;
  widening?: BiliceRoadWidening;
};

export const roadColors = {
  new: "#c66b28",
  existing: "#007e75",
  plan: "#74688c",
  road: "#afb2ad",
  building: "#eee9db",
  widening: "#ad4777",
  parcel: "#685244",
};

export function footprintAppearance(footprint: BiliceRoadFootprint) {
  if (footprint.source === "existing") return { color: roadColors.existing, label: "Postojeća cesta za korištenje" };
  if (footprint.source === "dpu") return { color: roadColors.new, label: "Nedostajući spoj prema DPU-u" };
  return { color: roadColors.new, label: "Radni spoj za provjeru" };
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const xyz = (value: unknown): value is RoadXYZ => Array.isArray(value) && value.length === 3 && value.every(finite);
const rings = (value: unknown): value is RoadXYZ[][] => Array.isArray(value) && value.length > 0 && value.every((ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(xyz));

function validWidening(value: unknown): value is BiliceRoadWidening {
  if (!record(value) || typeof value.id !== "string" || !value.id || typeof value.label !== "string" || !value.label || !finite(value.lengthM) || value.lengthM <= 0 || !finite(value.widthM) || value.widthM <= 0 || !Array.isArray(value.points) || value.points.length < 2 || !value.points.every(xyz) || !rings(value.rings)) return false;
  if (!Array.isArray(value.parcels) || !value.parcels.every((parcel) => record(parcel) && typeof parcel.id === "string" && parcel.id.length > 0 && typeof parcel.label === "string" && parcel.label.length > 0 && rings(parcel.rings) && finite(parcel.overlapM2) && parcel.overlapM2 >= 0 && typeof parcel.ownershipLabel === "string" && parcel.ownershipLabel.length > 0)) return false;
  if (value.adjustedLengthM !== undefined && (!finite(value.adjustedLengthM) || value.adjustedLengthM <= 0)) return false;
  if (value.note !== undefined && typeof value.note !== "string") return false;
  return new Set(value.parcels.map((parcel) => parcel.id)).size === value.parcels.length;
}

/** Reject malformed downloaded geometry before it reaches WebGL or the SVG fallback. */
export function isBiliceRoadSceneData(value: unknown): value is BiliceRoadSceneData {
  if (!record(value) || value.version !== 1 || value.projection !== "EPSG:3765" || !xyz(value.origin) || !finite(value.width) || value.width <= 0 || !finite(value.depth) || value.depth <= 0) return false;
  if (!Array.isArray(value.bounds) || value.bounds.length !== 4 || !value.bounds.every(finite)) return false;
  const terrain = value.terrain;
  if (!record(terrain) || !finite(terrain.cols) || !Number.isInteger(terrain.cols) || terrain.cols < 2 || !finite(terrain.rows) || !Number.isInteger(terrain.rows) || terrain.rows < 2 || !Array.isArray(terrain.heights) || terrain.heights.length !== terrain.cols * terrain.rows || !terrain.heights.every(finite) || typeof terrain.source !== "string") return false;
  if (!Array.isArray(value.surfaces) || !value.surfaces.every((surface) => record(surface) && typeof surface.role === "string" && typeof surface.label === "string" && rings(surface.rings))) return false;
  if (!Array.isArray(value.segments) || !value.segments.length || !value.segments.every((segment) => record(segment) && typeof segment.id === "string" && typeof segment.label === "string" && (segment.kind === "new" || segment.kind === "existing") && finite(segment.widthM) && segment.widthM > 0 && Array.isArray(segment.points) && segment.points.length >= 2 && segment.points.every(xyz) && (segment.onewayInbound === undefined || typeof segment.onewayInbound === "boolean"))) return false;
  const segmentIds = new Set(value.segments.map((segment) => segment.id));
  if (value.proposalFootprints !== undefined && (!Array.isArray(value.proposalFootprints) || !value.proposalFootprints.every((footprint) => record(footprint) && (footprint.source === "existing" || footprint.source === "dpu" || footprint.source === "candidate") && segmentIds.has(footprint.segmentId) && rings(footprint.rings) && (footprint.widthM === undefined || finite(footprint.widthM) && footprint.widthM > 0) && (footprint.widthBasis === undefined || typeof footprint.widthBasis === "string") && (footprint.sourcePath === undefined || typeof footprint.sourcePath === "string") && (footprint.source !== "dpu" || typeof footprint.level === "string" && typeof footprint.sheet === "string" && typeof footprint.sourceLayer === "string")))) return false;
  if (!Array.isArray(value.buildings) || !value.buildings.every((building) => record(building) && typeof building.id === "string" && rings(building.rings) && finite(building.height) && building.height > 0 && typeof building.source === "string")) return false;
  if (value.widening !== undefined && !validWidening(value.widening)) return false;
  return Array.isArray(value.labels) && value.labels.every((label) => record(label) && typeof label.label === "string" && xyz(label.position)) && typeof value.note === "string";
}

/** White arrows follow the permitted inbound direction, opposite the route's stored order. */
export function inboundArrows(segment: BiliceRoadSegment): RoadXYZ[][] {
  if (!segment.onewayInbound) return [];
  const points = [...segment.points].reverse(), result: RoadXYZ[][] = [];
  let distance = 0, nextArrow = 18;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1], after = points[i];
    const dx = after[0] - before[0], dz = after[2] - before[2], length = Math.hypot(dx, dz);
    if (!length) continue;
    while (nextArrow < distance + length) {
      const fraction = (nextArrow - distance) / length;
      const x = before[0] + dx * fraction, y = before[1] + (after[1] - before[1]) * fraction + 1.2, z = before[2] + dz * fraction;
      const forwardX = dx / length, forwardZ = dz / length;
      const halfWidth = Math.min(2.5, segment.widthM * .38);
      result.push([
        [x + forwardX * 3.8, y, z + forwardZ * 3.8],
        [x - forwardX * 3 - forwardZ * halfWidth, y, z - forwardZ * 3 + forwardX * halfWidth],
        [x - forwardX * 3 + forwardZ * halfWidth, y, z - forwardZ * 3 - forwardX * halfWidth],
      ]);
      nextArrow += 35;
    }
    distance += length;
  }
  return result;
}

/** Direction marks stay on selected existing pavement, not on a replacement DPU polygon. */
export function inboundRoadArrows(data: BiliceRoadSceneData) {
  return data.segments.flatMap((segment) => {
    const footprints = data.proposalFootprints?.filter((footprint) => footprint.source === "existing" && footprint.segmentId === segment.id) ?? [];
    return inboundArrows(segment).filter((ring) => ring.every(([x, , z]) => footprints.some((footprint) => pointInRoadRings(footprint.rings, x, z)))).map((ring) => ({ segmentId: segment.id, ring }));
  });
}

/** A shared frame keeps the complete connection visible in both 2D and 3D. */
export function roadFrame(data: BiliceRoadSceneData) {
  const points = [...data.segments.flatMap((segment) => segment.points), ...(data.proposalFootprints?.flatMap((footprint) => footprint.rings.flat()) ?? []), ...(data.widening?.points ?? []), ...(data.widening?.rings.flat() ?? [])];
  if (!points.length) return { minX: -data.width / 2, maxX: data.width / 2, minZ: -data.depth / 2, maxZ: data.depth / 2 };
  const xs = points.map(([x]) => x), zs = points.map(([, , z]) => z);
  const margin = Math.max(45, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * .1);
  return {
    minX: Math.max(-data.width / 2, Math.min(...xs) - margin),
    maxX: Math.min(data.width / 2, Math.max(...xs) + margin),
    minZ: Math.max(-data.depth / 2, Math.min(...zs) - margin),
    maxZ: Math.min(data.depth / 2, Math.max(...zs) + margin),
  };
}

/** Focus the study strip; whole cadastral parcels may continue far beyond this view. */
export function wideningFrame(widening: BiliceRoadWidening) {
  const points = [...widening.points, ...widening.rings.flat()];
  const xs = points.map(([x]) => x), zs = points.map(([, , z]) => z);
  const margin = Math.max(18, widening.widthM * 1.5);
  return { minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin, minZ: Math.min(...zs) - margin, maxZ: Math.max(...zs) + margin };
}

/** Pick by cadastral footprint, including holes, after a ray hits the real terrain. */
export function pointInRoadRings(rings: RoadXYZ[][], x: number, z: number) {
  function contains(ring: RoadXYZ[]) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
      if (length > 0 && Math.abs((x - a[0]) * dz - (z - a[2]) * dx) <= 1e-6 * length && x >= Math.min(a[0], b[0]) - 1e-6 && x <= Math.max(a[0], b[0]) + 1e-6 && z >= Math.min(a[2], b[2]) - 1e-6 && z <= Math.max(a[2], b[2]) + 1e-6) return true;
      if ((a[2] > z) !== (b[2] > z) && x < (b[0] - a[0]) * (z - a[2]) / (b[2] - a[2]) + a[0]) inside = !inside;
    }
    return inside;
  }
  return contains(rings[0]) && !rings.slice(1).some(contains);
}

export function wideningParcelAt(widening: BiliceRoadWidening, x: number, z: number): BiliceWideningParcel | null {
  return widening.parcels.find((parcel) => pointInRoadRings(parcel.rings, x, z)) ?? null;
}
