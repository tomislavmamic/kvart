import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  area as turfArea,
  bbox as turfBbox,
  featureCollection,
  intersect,
} from "@turf/turf";
import type { Feature as GeoJsonFeature, Polygon } from "geojson";

type Position = [number, number];
type Geometry =
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] }
  | { type: "Polygon"; coordinates: Position[][] };
type Feature = {
  properties: Record<string, string | number | null>;
  geometry: Geometry;
};
type FeatureCollection = { features: Feature[] };

const root = path.resolve(import.meta.dirname, "..");
const sources = {
  terrain: "public/geo/granica.geojson",
  roads: "public/geo/ulice.geojson",
  buildings: "public/geo/grad/zgrade-2025.geojson",
  buildingHeights: "public/geo/grad/zgrade-visine.geojson",
  osmBuildings: "public/geo/zgrade.geojson",
  aqueduct: "public/geo/grad/kulturno-dobro.geojson",
} as const;

function readGeoJson(relativePath: string): FeatureCollection {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as FeatureCollection;
  } catch (error) {
    throw new Error(`Nedostaje ili nije valjan izvor za /igra: ${relativePath}`, {
      cause: error,
    });
  }
}

const terrainSource = readGeoJson(sources.terrain);
const roadSource = readGeoJson(sources.roads);
const buildingSource = readGeoJson(sources.buildings);
const buildingHeightSource = readGeoJson(sources.buildingHeights);
const osmBuildingSource = readGeoJson(sources.osmBuildings);
const aqueductSource = readGeoJson(sources.aqueduct);

function geometryPositions(feature: Feature): Position[] {
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates.flat();
  if (feature.geometry.type === "LineString") return feature.geometry.coordinates;
  return feature.geometry.coordinates.flat();
}

const scenePositions = [
  ...terrainSource.features,
  ...roadSource.features,
  ...buildingSource.features,
  ...aqueductSource.features,
].flatMap(geometryPositions);

const bounds = scenePositions.reduce(
  (box, [longitude, latitude]) => ({
    west: Math.min(box.west, longitude),
    south: Math.min(box.south, latitude),
    east: Math.max(box.east, longitude),
    north: Math.max(box.north, latitude),
  }),
  { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity },
);

function round(value: number) {
  return Math.round(value * 100) / 100;
}

const centerLatitude = (bounds.south + bounds.north) / 2;
const longitudeScale = Math.cos((centerLatitude * Math.PI) / 180);

function projectRaw([longitude, latitude]: Position): Position {
  const east = (longitude - bounds.west) * longitudeScale;
  const south = bounds.north - latitude;
  return [east - south, (east + south) / 2];
}

const projectedBounds = scenePositions.map(projectRaw).reduce(
  (box, [x, y]) => ({
    west: Math.min(box.west, x),
    north: Math.min(box.north, y),
    east: Math.max(box.east, x),
    south: Math.max(box.south, y),
  }),
  { west: Infinity, north: Infinity, east: -Infinity, south: -Infinity },
);
const sceneScale = Math.min(
  (1600 - 180) / (projectedBounds.east - projectedBounds.west),
  (820 - 110) / (projectedBounds.south - projectedBounds.north),
);
const sceneOffsetX =
  (1600 - (projectedBounds.east - projectedBounds.west) * sceneScale) / 2 -
  projectedBounds.west * sceneScale;
const sceneOffsetY =
  (820 - (projectedBounds.south - projectedBounds.north) * sceneScale) / 2 -
  projectedBounds.north * sceneScale;

function project(position: Position): Position {
  const [x, y] = projectRaw(position);
  return [round(sceneOffsetX + x * sceneScale), round(sceneOffsetY + y * sceneScale)];
}

function simplify(points: Position[], limit: number): Position[] {
  if (points.length <= limit) return points.map(project);
  const lastIndex = points.length - 1;
  const selected: Position[] = [];
  for (let index = 0; index < limit; index += 1) {
    selected.push(project(points[Math.round((index / (limit - 1)) * lastIndex)]));
  }
  return selected;
}

function polygonPoints(feature: Feature, limit = 8): Position[] {
  if (feature.geometry.type !== "Polygon") return [];
  return simplify(feature.geometry.coordinates[0], limit);
}

function completePolygonPoints(feature: Feature): Position[] {
  if (feature.geometry.type !== "Polygon") return [];
  return feature.geometry.coordinates[0].map(project);
}

const terrain = terrainSource.features
  .filter((feature) => feature.geometry.type === "Polygon")
  .map((feature) => ({
    name: String(feature.properties.naziv ?? "Kvart"),
    points: polygonPoints(feature, 48),
  }));

const land = [
  project([bounds.west, bounds.north]),
  project([bounds.east, bounds.north]),
  project([bounds.east, bounds.south]),
  project([bounds.west, bounds.south]),
];

const roads = roadSource.features.flatMap((feature) => {
  const lines =
    feature.geometry.type === "LineString"
      ? [feature.geometry.coordinates]
      : feature.geometry.type === "MultiLineString"
        ? feature.geometry.coordinates
        : [];
  return lines.map((line, index) => ({
    sourceId: String(feature.properties.id ?? `cesta-${index + 1}`),
    sourcePathIndex: index,
    name: String(feature.properties.name ?? feature.properties.ref ?? "Cesta"),
    kind: roadKind(String(feature.properties.highway ?? "service")),
    points: simplify(line, 48),
  }));
});

function roadKind(highway: string) {
  if (/^(motorway|trunk|primary|secondary)/.test(highway)) return "major";
  if (/^(tertiary|residential|unclassified|living_street)/.test(highway)) return "local";
  return "minor";
}

type Bbox = [number, number, number, number];
type BuildingFeature = Feature & { sourceIndex: number; footprintArea: number };
type HeightCandidate = {
  feature: Feature;
  bounds: Bbox;
  geometryArea: number;
  heightMeters: number;
  source: "city-gis" | "openstreetmap";
};

function polygonFeature(feature: Feature) {
  return feature as unknown as GeoJsonFeature<Polygon>;
}

function candidateBounds(feature: Feature) {
  return turfBbox(polygonFeature(feature)) as Bbox;
}

function boundsOverlap(left: Bbox, right: Bbox) {
  return !(
    left[2] < right[0] ||
    left[0] > right[2] ||
    left[3] < right[1] ||
    left[1] > right[3]
  );
}

function parseOsmHeight(properties: Feature["properties"]) {
  const explicit = Number.parseFloat(String(properties.height ?? ""));
  if (Number.isFinite(explicit) && explicit >= 2 && explicit <= 80) return explicit;
  const levels = Number.parseFloat(String(properties["building:levels"] ?? ""));
  if (Number.isFinite(levels) && levels >= 1 && levels <= 20) return levels * 3.2;
  return null;
}

const heightCandidates: HeightCandidate[] = [
  ...buildingHeightSource.features.flatMap((feature) => {
    if (feature.geometry.type !== "Polygon") return [];
    const heightMeters = Number(feature.properties.visina);
    if (!Number.isFinite(heightMeters) || heightMeters < 2 || heightMeters > 80) return [];
    return [{
      feature,
      bounds: candidateBounds(feature),
      geometryArea: turfArea(polygonFeature(feature)),
      heightMeters,
      source: "city-gis" as const,
    }];
  }),
  ...osmBuildingSource.features.flatMap((feature) => {
    if (feature.geometry.type !== "Polygon") return [];
    const heightMeters = parseOsmHeight(feature.properties);
    if (heightMeters === null) return [];
    return [{
      feature,
      bounds: candidateBounds(feature),
      geometryArea: turfArea(polygonFeature(feature)),
      heightMeters,
      source: "openstreetmap" as const,
    }];
  }),
];

function matchHeight(feature: Feature) {
  const source = polygonFeature(feature);
  const sourceBounds = candidateBounds(feature);
  const sourceArea = turfArea(source);
  let best: { score: number; heightMeters: number; source: HeightCandidate["source"] } | null = null;

  for (const candidate of heightCandidates) {
    if (!boundsOverlap(sourceBounds, candidate.bounds)) continue;
    const overlap = intersect(featureCollection([source, polygonFeature(candidate.feature)]));
    if (!overlap) continue;
    const score = turfArea(overlap) / Math.max(sourceArea, candidate.geometryArea);
    const minimumScore = candidate.source === "city-gis" ? 0.85 : 0.45;
    if (score < minimumScore || (best && best.score >= score)) continue;
    best = {
      score,
      heightMeters: candidate.heightMeters,
      source: candidate.source,
    };
  }

  return best;
}

function estimatedHeightMeters(area: number) {
  if (area >= 1200) return 8;
  if (area >= 400) return 7;
  return 6;
}

const polygonBuildings: BuildingFeature[] = buildingSource.features.flatMap(
  (feature, sourceIndex) => {
    if (feature.geometry.type !== "Polygon") return [];
    return [{
      ...feature,
      sourceIndex,
      footprintArea: Number(feature.properties.tlocrt ?? 0),
    }];
  },
);
const topDecileCount = Math.ceil(polygonBuildings.length * 0.1);
const topDecileIndices = new Set(
  [...polygonBuildings]
    .toSorted((left, right) => right.footprintArea - left.footprintArea)
    .slice(0, topDecileCount)
    .map((feature) => feature.sourceIndex),
);

const visibleBuildings = polygonBuildings.filter((feature) => feature.footprintArea >= 75);
const buildings = visibleBuildings.map((feature) => {
  const area = feature.footprintArea;
  const kind = area >= 400 ? "large" : "home";
  const height = kind === "large" ? 14 + Math.min(8, area / 250) : 5 + Math.min(6, area / 80);
  const topDecile = topDecileIndices.has(feature.sourceIndex);
  const heightMatch = topDecile ? matchHeight(feature) : null;
  const heightMeters = heightMatch?.heightMeters ?? estimatedHeightMeters(area);
  return {
    id: `zgrada-${feature.sourceIndex}`,
    kind,
    height: round(Math.max(5, Math.min(kind === "large" ? 26 : 15, height * 1.3))),
    heightMeters: round(heightMeters),
    heightSource: heightMatch?.source ?? "estimated",
    footprintArea: round(area),
    topDecile,
    sourceVertexCount: feature.geometry.coordinates[0].length,
    tone: feature.sourceIndex % 5,
    base: topDecile ? completePolygonPoints(feature) : polygonPoints(feature, 7),
  };
});

const aqueductFeature = aqueductSource.features
  .filter((feature) =>
    String(feature.properties.naziv).includes("Dioklecijanov vodovod u predjelu Mostine"),
  )
  .toSorted((left, right) => geometryPositions(right).length - geometryPositions(left).length)[0];

if (!aqueductFeature) {
  throw new Error(`Nedostaje Dioklecijanov vodovod u izvoru: ${sources.aqueduct}`);
}

const aqueductPositions = geometryPositions(aqueductFeature);
const aqueductBounds = aqueductPositions.reduce(
  (box, [longitude, latitude]) => ({
    west: Math.min(box.west, longitude),
    south: Math.min(box.south, latitude),
    east: Math.max(box.east, longitude),
    north: Math.max(box.north, latitude),
  }),
  { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity },
);

const aqueductStart: Position = [aqueductBounds.west, aqueductBounds.south];
const aqueductEnd: Position = [aqueductBounds.east, aqueductBounds.north];
const aqueductArches = Array.from({ length: 16 }, (_, index) => {
  const progress = index / 15;
  return project([
    aqueductStart[0] + (aqueductEnd[0] - aqueductStart[0]) * progress,
    aqueductStart[1] + (aqueductEnd[1] - aqueductStart[1]) * progress,
  ]);
});

const trafficRoadNames = new Set(["Dračevac", "PUT MOSTINA", "ULICA ZNG"]);
const vehiclePaths = roads
  .filter((road) => trafficRoadNames.has(road.name) && road.points.length >= 2)
  .slice(0, 3)
  .map((road, index) => ({ id: `promet-${index + 1}`, points: road.points }));

function centroid(points: Position[]): Position {
  const total = points.reduce(
    (sum, [x, y]) => [sum[0] + x, sum[1] + y] as Position,
    [0, 0] as Position,
  );
  return [round(total[0] / points.length), round(total[1] / points.length)];
}

const labels = [
  ...terrain.map((area) => ({ text: area.name, position: centroid(area.points) })),
  {
    text: "Akvadukt",
    position: centroid(aqueductArches),
  },
];

const scene = {
  viewBox: [0, 0, 1600, 820],
  land,
  terrain,
  roads,
  buildings,
  aqueduct: {
    arches: aqueductArches,
  },
  vehiclePaths,
  labels,
};

const outputArgumentIndex = process.argv.indexOf("--output");
const outputPath =
  outputArgumentIndex >= 0 && process.argv[outputArgumentIndex + 1]
    ? path.resolve(process.argv[outputArgumentIndex + 1])
    : path.join(root, "src", "generated", "igra-scene.ts");

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `export const IGRA_SCENE = ${JSON.stringify(scene)} as const;\n`,
  "utf8",
);

process.stdout.write(
  `Generirano: ${path.relative(root, outputPath)} (${roads.length} cesta, ${buildings.length} zgrada)\n`,
);
