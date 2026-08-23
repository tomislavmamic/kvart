import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  area as turfArea,
  bbox as turfBbox,
  booleanPointInPolygon,
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
  green: "public/geo/zelene-povrsine.geojson",
  landfill: "public/geo/karepovac.geojson",
  heightHeader: "public/geo/reljef/visine.json",
  heightGrid: "public/geo/reljef/visine.bin.gz",
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
const greenSource = readGeoJson(sources.green);
const landfillSource = readGeoJson(sources.landfill);

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

/**
 * Isti položaj u koordinatama koje Three.js zove svijetom.
 *
 * `project()` vraća točke SVG-ove izometrije; `/igra` ih vraća natrag na tlo
 * inverzom u `three-scene-model.ts`. Reljef ne prolazi kroz taj put — mreža
 * visina se ne crta po točkama nego se razapinje preko pravokutnika — pa
 * generator ovdje jednom izračuna isti inverz. Konstante moraju ostati
 * jednake onima u `three-scene-model.ts`, inače teren i ceste kliznu jedno
 * po drugom, a to se na makete vidi kao cesta koja lebdi iznad brda.
 */
const VIEW_CENTER_X = 800;
const VIEW_CENTER_Y = 410;
const WORLD_SCALE = 8;

function projectWorld(position: Position): { x: number; z: number } {
  const [rawX, rawY] = projectRaw(position);
  const sceneX = sceneOffsetX + rawX * sceneScale - VIEW_CENTER_X;
  const sceneY = sceneOffsetY + rawY * sceneScale - VIEW_CENTER_Y;
  return {
    x: (sceneX + 2 * sceneY) / 2 / WORLD_SCALE,
    z: (2 * sceneY - sceneX) / 2 / WORLD_SCALE,
  };
}

function round6(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Koliko svjetskih jedinica stane u jedan vodoravni metar.
 *
 * Broj je potreban jer visina dolazi u metrima, a sve ostalo u jedinicama
 * makete. Mjeri se po obje osi i uzima sredina: projekcija je stupanjska, pa
 * se istok i sjever razlikuju za onih 0,7 % koliko se razlikuju metar
 * geografske dužine i širine na 43,5°.
 */
const unitsPerMetre = (() => {
  const northWest = projectWorld([bounds.west, bounds.north]);
  const northEast = projectWorld([bounds.east, bounds.north]);
  const southWest = projectWorld([bounds.west, bounds.south]);
  const eastMetres = (bounds.east - bounds.west) * longitudeScale * 111_320;
  const southMetres = (bounds.north - bounds.south) * 110_540;
  return round6(
    ((northEast.x - northWest.x) / eastMetres + (southWest.z - northWest.z) / southMetres) / 2,
  );
})();

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
  /** Kota dna i vrha su apsolutne, u metrima nad morem — samo gradski GIS ih ima. */
  baseMetres: number | null;
  ridgeMetres: number | null;
  roof: "flat" | "pitched" | null;
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
    const baseMetres = Number(feature.properties.kota_dna);
    const ridgeMetres = Number(feature.properties.kota_vrha);
    const krov = String(feature.properties.krov ?? "");
    return [{
      feature,
      bounds: candidateBounds(feature),
      geometryArea: turfArea(polygonFeature(feature)),
      heightMeters,
      baseMetres: Number.isFinite(baseMetres) ? baseMetres : null,
      ridgeMetres: Number.isFinite(ridgeMetres) ? ridgeMetres : null,
      roof:
        krov === "ROOF_NOT_FLAT" ? ("pitched" as const)
        : krov === "ROOF_FLAT" ? ("flat" as const)
        : null,
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
      baseMetres: null,
      ridgeMetres: null,
      roof: null,
      source: "openstreetmap" as const,
    }];
  }),
];

/**
 * Traži istu zgradu u sloju s izmjerenim visinama.
 *
 * Prag preklapanja je 85 % i to nije fino ugođena brojka: raspodjela je
 * dvojna — zgrada se ili poklapa gotovo cijela, ili je u drugom sloju nema.
 * Spuštanje praga na 70 % dobiva tri zgrade od 415, pa se prag drži visok
 * jer krivo spojena visina nije manja greška od nepoznate visine, nego veća:
 * izgleda kao mjerenje.
 *
 * Prije se tražilo samo za najveći decil, jer je tada visina služila samo
 * velikoj masi. Sad je traženje za svaku zgradu: 181 od 415 vidljivih ima
 * izmjerenu visinu umjesto dosadašnjih 69.
 */
function matchBuilding(feature: Feature) {
  const source = polygonFeature(feature);
  const sourceBounds = candidateBounds(feature);
  const sourceArea = turfArea(source);
  let best: (HeightCandidate & { score: number }) | null = null;

  for (const candidate of heightCandidates) {
    if (!boundsOverlap(sourceBounds, candidate.bounds)) continue;
    const overlap = intersect(featureCollection([source, polygonFeature(candidate.feature)]));
    if (!overlap) continue;
    const score = turfArea(overlap) / Math.max(sourceArea, candidate.geometryArea);
    const minimumScore = candidate.source === "city-gis" ? 0.85 : 0.45;
    if (score < minimumScore || (best && best.score >= score)) continue;
    best = { ...candidate, score };
  }

  return best;
}

/**
 * Oblik krova iz OpenStreetMapa, jedini izvor koji uopće imenuje oblik.
 *
 * Gradski GIS razlikuje samo ravno i neravno; OSM ima `roof:shape`. Ali na
 * 528 zgrada taj je ključ 405 puta „gabled” i 2 puta „flat” — to nije 405
 * opažanja nego jedna zadana vrijednost razmazana preko sloja. Provjera to i
 * pokazuje: ondje gdje oba izvora govore (97 zgrada) slažu se u 77 %, a svih
 * 22 neslaganja idu na istu stranu — grad je izmjerio ravan krov, OSM tvrdi
 * dvostrešni. Nikad obrnuto.
 *
 * Zato OSM ovdje ne smije nadglasati grad o tome ima li krov nagib. Smije
 * samo dvoje: reći kojeg je oblika nagib koji je grad već potvrdio, i
 * govoriti ondje gdje grad šuti. To drugo nije popuštanje kriterija nego
 * ispravak: tih 134 zgrada sad stoje kao ravne kutije, a ravna kutija u selu
 * pod kupom kanalicom je tvrdnja koja je pogrešna češće (77 %) nego OSM-ova.
 */
type RoofCandidate = {
  feature: Feature;
  bounds: Bbox;
  geometryArea: number;
  pitched: boolean;
  shape: "gabled" | "hipped";
};

const roofCandidates: RoofCandidate[] = osmBuildingSource.features.flatMap((feature) => {
  if (feature.geometry.type !== "Polygon") return [];
  const tag = String(feature.properties["roof:shape"] ?? "");
  if (!tag) return [];
  return [{
    feature,
    bounds: candidateBounds(feature),
    geometryArea: turfArea(polygonFeature(feature)),
    pitched: tag !== "flat",
    shape: tag === "gabled" ? ("gabled" as const) : ("hipped" as const),
  }];
});

function matchRoof(feature: Feature) {
  const source = polygonFeature(feature);
  const sourceBounds = candidateBounds(feature);
  const sourceArea = turfArea(source);
  let best: (RoofCandidate & { score: number }) | null = null;

  for (const candidate of roofCandidates) {
    if (!boundsOverlap(sourceBounds, candidate.bounds)) continue;
    const overlap = intersect(featureCollection([source, polygonFeature(candidate.feature)]));
    if (!overlap) continue;
    const score = turfArea(overlap) / Math.max(sourceArea, candidate.geometryArea);
    if (score < 0.45 || (best && best.score >= score)) continue;
    best = { ...candidate, score };
  }

  return best;
}

/**
 * Najmanji pravokutnik oko tlocrta, u koordinatama makete.
 *
 * Kosi krov treba sljeme, a sljeme treba dužu os zgrade. Pravokutnik se traži
 * po poznatom svojstvu: najmanji opisani pravokutnik ima stranicu položenu uz
 * jedan brid samog tlocrta, pa se isproba svaki brid i uzme najmanja površina.
 *
 * Računa se u svjetskim koordinatama, ne u SVG-ovim: projekcija scene je
 * smicanje, pa bi kut izmjeren nad njezinim točkama pao krivo na tlo.
 */
function orientedBox(points: readonly Position[]) {
  const world = points.map(projectWorld);
  let best: { x: number; z: number; angle: number; length: number; width: number } | null = null;

  for (let index = 1; index < world.length; index += 1) {
    const from = world[index - 1];
    const to = world[index];
    const edgeAngle = Math.atan2(to.z - from.z, to.x - from.x);
    const cos = Math.cos(edgeAngle);
    const sin = Math.sin(edgeAngle);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const point of world) {
      const u = point.x * cos + point.z * sin;
      const v = -point.x * sin + point.z * cos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const spanU = maxU - minU;
    const spanV = maxV - minV;
    if (best && best.length * best.width <= spanU * spanV) continue;
    const centreU = (minU + maxU) / 2;
    const centreV = (minV + maxV) / 2;
    best = {
      x: centreU * cos - centreV * sin,
      z: centreU * sin + centreV * cos,
      angle: edgeAngle,
      length: spanU,
      width: spanV,
    };
  }

  if (!best) return null;
  // Sljeme uvijek ide po dužoj osi; ako je brid dao kraću, okreni okvir.
  const box =
    best.length >= best.width
      ? best
      : { ...best, angle: best.angle + Math.PI / 2, length: best.width, width: best.length };
  return {
    x: round6(box.x),
    z: round6(box.z),
    angle: round6(box.angle),
    length: round6(box.length),
    width: round6(box.width),
  };
}

/**
 * Kosi krov se diže samo nad tlocrtom koji je dovoljno pravokutan.
 *
 * Krov se gradi nad opisanim pravokutnikom, pa nad razvedenim tlocrtom —
 * slovom L, dvorišnim krilom — pokrije i ono čega nema i ispadne stol na
 * stupovima. Prag je udio tlocrta u tom pravokutniku: 78 %. Većina zgrada je
 * ionako pravokutna (medijan popunjenosti je 0,99), pa prag odbaci 18 od 141
 * — i za njih ostaje ravna masa do kote vrha, što je i dalje izmjerena
 * visina, samo bez izmišljenog oblika krova.
 */
const MIN_ROOF_FILL = 0.78;

function fittedRoofFrame(
  frame: ReturnType<typeof orientedBox>,
  footprintArea: number,
) {
  if (!frame) return null;
  const boxArea = (frame.length / unitsPerMetre) * (frame.width / unitsPerMetre);
  if (boxArea <= 0 || footprintArea / boxArea < MIN_ROOF_FILL) return null;
  return frame;
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
const buildingMatches = visibleBuildings.map((feature) => matchBuilding(feature));
const roofMatches = visibleBuildings.map((feature) => matchRoof(feature));

/**
 * Zamjenska visina je medijan izmjerenih zgrada iste veličine u ovom kvartu.
 *
 * Dosad su to bile tri izmišljene brojke (6, 7 i 8 m po površini tlocrta) i
 * sve tri su bile prenizak pogodak: izmjereni medijani istih razreda su 7,9,
 * 8,9 i 9,8 m. Površina uz to slabo predviđa visinu — medijan se preko
 * dvadeserostruke razlike u tlocrtu pomakne za tri metra, a rasap unutar
 * jednog razreda je dvostruko veći od toga. Zato ovdje stoji medijan razreda
 * i ništa pametnije: to je tvrdnja o kvartu, ne o toj zgradi, i tako se i
 * imenuje u sceni.
 */
const AREA_BANDS = [150, 300, 600, 1500, Infinity] as const;

function areaBand(area: number) {
  return AREA_BANDS.findIndex((limit) => area < limit);
}

const bandMedians = AREA_BANDS.map((_, band) => {
  const measured = visibleBuildings
    .flatMap((feature, index) => {
      const match = buildingMatches[index];
      if (!match || match.source !== "city-gis") return [];
      return areaBand(feature.footprintArea) === band ? [match.heightMeters] : [];
    })
    .toSorted((left, right) => left - right);
  return measured.length === 0 ? null : measured[Math.floor(measured.length / 2)];
});

/** Kad ni jedan razred nema mjerenja, ostaje medijan svih izmjerenih zgrada. */
const overallMedian = (() => {
  const measured = buildingMatches
    .flatMap((match) => (match && match.source === "city-gis" ? [match.heightMeters] : []))
    .toSorted((left, right) => left - right);
  return measured.length === 0 ? 8 : measured[Math.floor(measured.length / 2)];
})();

function fallbackHeightMetres(area: number) {
  return bandMedians[areaBand(area)] ?? overallMedian;
}

const buildings = visibleBuildings.map((feature, index) => {
  const area = feature.footprintArea;
  const kind = area >= 400 ? "large" : "home";
  const height = kind === "large" ? 14 + Math.min(8, area / 250) : 5 + Math.min(6, area / 80);
  const topDecile = topDecileIndices.has(feature.sourceIndex);
  const match = buildingMatches[index];
  const heightMeters = match?.heightMeters ?? fallbackHeightMetres(area);
  const osmRoof = roofMatches[index];

  // Grad odlučuje ima li krov nagib; OSM govori samo ondje gdje grad šuti.
  const roof = match?.roof ?? (osmRoof ? (osmRoof.pitched ? "pitched" : "flat") : null);
  const roofSource = match?.roof ? "city-gis" : osmRoof ? "openstreetmap" : null;
  // Oblik zna samo OSM. Bez njega kosi krov ostaje četverostrešan, jer je to
  // oblik koji ni na jednom tlocrtu ne ispadne besmislen.
  const roofShape = roof === "pitched" ? (osmRoof?.shape ?? "hipped") : null;
  return {
    id: `zgrada-${feature.sourceIndex}`,
    kind,
    height: round(Math.max(5, Math.min(kind === "large" ? 26 : 15, height * 1.3))),
    heightMeters: round(heightMeters),
    heightSource: match?.source ?? "neighbourhood-median",
    baseMetres: match?.baseMetres === null || match?.baseMetres === undefined
      ? null
      : round(match.baseMetres),
    ridgeMetres: match?.ridgeMetres === null || match?.ridgeMetres === undefined
      ? null
      : round(match.ridgeMetres),
    roof,
    roofShape,
    roofSource,
    roofFrame:
      roof === "pitched" && feature.geometry.type === "Polygon"
        ? fittedRoofFrame(orientedBox(feature.geometry.coordinates[0]), area)
        : null,
    footprintArea: round(area),
    topDecile,
    sourceVertexCount: feature.geometry.coordinates[0].length,
    tone: feature.sourceIndex % 5,
    base: completePolygonPoints(feature),
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

/**
 * Reljef: izrezak DGU-ove LiDAR mreže visina pod maketom.
 *
 * Mrežu izrađuje `scripts/izvedi-reljef.py` za cijeli obuhvat karte (1641 ×
 * 1225 ćelija). Maketa treba samo prozor oko kvarta, pa se ovdje izrezuje i
 * zapisuje kao sirovi `int16` — bez ponovnog uzorkovanja, jer bi svako
 * međuuzorkovanje zagladilo upravo ono zbog čega se reljef i crta: usjeke
 * cesta, terase i rubove kamenoloma.
 *
 * Korak ostaje izvornih 3 m. Na 1990 × 1208 m to je oko 270.000 ćelija i pola
 * megabajta, što je cijena koju ova stranica plaća za oštar teren; ostatak
 * mreže ne ide klijentu.
 */
type HeightHeader = Readonly<{
  zapad: number;
  jug: number;
  istok: number;
  sjever: number;
  stupaca: number;
  redaka: number;
  prviRedakJe: "sjever";
  jedinica: "dm";
  prazno: number;
  korakM: number;
  izvor: string;
}>;

/** Koliko se ćelija uzima izvan okvira makete, da rub terena ne bude i rub podatka. */
const RELIEF_PADDING_CELLS = 3;
/** Javna adresa izrezane mreže; put mora biti isti u svakom pokretanju. */
const RELIEF_FILE = "/igra/teren.bin";

function readHeightGrid() {
  const header = JSON.parse(
    readFileSync(path.join(root, sources.heightHeader), "utf8"),
  ) as HeightHeader;
  const decompressed = gunzipSync(readFileSync(path.join(root, sources.heightGrid)));
  const data = new Int16Array(
    decompressed.buffer,
    decompressed.byteOffset,
    decompressed.byteLength / 2,
  );
  if (data.length !== header.stupaca * header.redaka) {
    throw new Error(
      `Mreža visina ne odgovara zaglavlju: ${data.length} ≠ ` +
        `${header.stupaca} × ${header.redaka}`,
    );
  }
  return { header, data };
}

/**
 * Popunjava ćelije bez izmjere prosjekom susjeda.
 *
 * DMR nad kvartom nema rupa, ali prozor je širi od kvarta i rub mreže ih
 * može zahvatiti. Rupa u mreži bi u Three.js-u bila vrh na −3276 m, dakle
 * rupa kroz cijelu maketu — vidljivija od svake pogreške koju bi popuna
 * unijela.
 */
function fillHoles(cells: Int16Array, cols: number, rows: number, empty: number) {
  let remaining = cells.reduce((count, value) => (value === empty ? count + 1 : count), 0);
  if (remaining === 0) return 0;
  const filled = remaining;
  for (let pass = 0; pass < 12 && remaining > 0; pass += 1) {
    const previous = Int16Array.from(cells);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        if (previous[index] !== empty) continue;
        let sum = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            const neighbour = previous[r * cols + c];
            if (neighbour === empty) continue;
            sum += neighbour;
            count += 1;
          }
        }
        if (count === 0) continue;
        cells[index] = Math.round(sum / count);
        remaining -= 1;
      }
    }
  }
  return filled;
}

const heightGrid = readHeightGrid();
const relief = (() => {
  const { header, data } = heightGrid;
  const stepLon = (header.istok - header.zapad) / header.stupaca;
  const stepLat = (header.sjever - header.jug) / header.redaka;
  const columnLongitude = (col: number) => header.zapad + (col + 0.5) * stepLon;
  const rowLatitude = (row: number) => header.sjever - (row + 0.5) * stepLat;

  const clampCol = (value: number) => Math.max(0, Math.min(header.stupaca - 1, value));
  const clampRow = (value: number) => Math.max(0, Math.min(header.redaka - 1, value));
  const firstCol = clampCol(
    Math.floor((bounds.west - header.zapad) / stepLon - 0.5) - RELIEF_PADDING_CELLS,
  );
  const lastCol = clampCol(
    Math.ceil((bounds.east - header.zapad) / stepLon - 0.5) + RELIEF_PADDING_CELLS,
  );
  const firstRow = clampRow(
    Math.floor((header.sjever - bounds.north) / stepLat - 0.5) - RELIEF_PADDING_CELLS,
  );
  const lastRow = clampRow(
    Math.ceil((header.sjever - bounds.south) / stepLat - 0.5) + RELIEF_PADDING_CELLS,
  );

  const cols = lastCol - firstCol + 1;
  const rows = lastRow - firstRow + 1;
  const cells = new Int16Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    const sourceOffset = (firstRow + row) * header.stupaca + firstCol;
    cells.set(data.subarray(sourceOffset, sourceOffset + cols), row * cols);
  }
  const holes = fillHoles(cells, cols, rows, header.prazno);

  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of cells) {
    if (value === header.prazno) continue;
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }

  const northWest = projectWorld([columnLongitude(firstCol), rowLatitude(firstRow)]);
  const southEast = projectWorld([columnLongitude(lastCol), rowLatitude(lastRow)]);

  return {
    cells,
    holes,
    grid: { cols, rows, columnLongitude, rowLatitude, firstCol, firstRow },
    scene: {
      file: RELIEF_FILE,
      cols,
      rows,
      stepMetres: header.korakM,
      lowestMetres: round(lowest / 10),
      highestMetres: round(highest / 10),
      world: {
        west: round6(northWest.x),
        north: round6(northWest.z),
        east: round6(southEast.x),
        south: round6(southEast.z),
      },
      unitsPerMetre,
      source: header.izvor,
    },
  };
})();

/**
 * Pokrov tla, upisan u istu mrežu u kojoj stoje i visine.
 *
 * Bez njega je tlo bilo isključivo funkcija visine i nagiba — dakle graf, ne
 * mjesto: gola vrtača i sred sela izgledale su jednako jer su na istoj koti.
 * Ovdje se u svaku ćeliju upiše ono što na njoj stvarno raste ili stoji, pa
 * boja tla postaje podatak kao i sve ostalo na maketi.
 *
 * Redoslijed slaganja ide od općeg prema određenom: travnjak, makija, šuma,
 * izgrađeno, odlagalište. Zadnji upis pobjeđuje jer tvrdi više — odlagalište
 * na travnjaku je odlagalište.
 *
 * Rezultat je `uint8` po ćeliji, ista širina i visina kao mreža visina, u
 * zasebnoj datoteci: 278 kB sirovo, ali blokovito, pa preko žice ostane malo.
 */
const COVER_CLASSES = [
  "golo",
  "travnjak",
  "makija",
  "suma",
  "izgradjeno",
  "odlagaliste",
] as const;
const COVER_FILE = "/igra/pokrov.bin";
/** Koliko se ćelija izgrađenog širi oko tlocrta — dvorište, prilaz, ograda. */
const BUILT_UP_SPREAD_CELLS = 3;

const COVER_BY_GREEN: Record<string, number> = {
  grass: 1,
  grassland: 1,
  meadow: 1,
  garden: 1,
  scrub: 2,
  wood: 3,
};

function pointInRing(ring: readonly Position[], lon: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(rings: readonly Position[][], lon: number, lat: number) {
  if (rings.length === 0 || !pointInRing(rings[0], lon, lat)) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(rings[index], lon, lat)) return false;
  }
  return true;
}

const cover = (() => {
  const { cols, rows, columnLongitude, rowLatitude, firstCol, firstRow } = relief.grid;
  const cells = new Uint8Array(cols * rows);
  const longitudes = Array.from({ length: cols }, (_, col) => columnLongitude(firstCol + col));
  const latitudes = Array.from({ length: rows }, (_, row) => rowLatitude(firstRow + row));

  function paint(feature: Feature, value: number, target: Uint8Array) {
    if (feature.geometry.type !== "Polygon") return;
    const rings = feature.geometry.coordinates;
    const [west, south, east, north] = candidateBounds(feature);
    // Binarno bi bilo brže, ali mreža ima 671 stupac — linearno traženje ruba
    // je ovdje jeftinije od složenosti koja bi ga zamijenila.
    for (let row = 0; row < rows; row += 1) {
      const lat = latitudes[row];
      if (lat < south || lat > north) continue;
      for (let col = 0; col < cols; col += 1) {
        const lon = longitudes[col];
        if (lon < west || lon > east) continue;
        if (pointInPolygon(rings, lon, lat)) target[row * cols + col] = value;
      }
    }
  }

  greenSource.features.forEach((feature) => {
    const kind = String(
      feature.properties.natural ?? feature.properties.landuse ?? feature.properties.leisure ?? "",
    );
    const value = COVER_BY_GREEN[kind];
    if (value) paint(feature, value, cells);
  });

  // Izgrađeno se slika u svoju mrežu pa proširi: tlocrt sam po sebi nestane
  // pod zgradom koja na njemu stoji, a ono što se vidi je dvorište oko nje.
  const built = new Uint8Array(cols * rows);
  buildingSource.features.forEach((feature) => paint(feature, 1, built));
  for (let pass = 0; pass < BUILT_UP_SPREAD_CELLS; pass += 1) {
    const previous = Uint8Array.from(built);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (previous[row * cols + col]) continue;
        const up = row > 0 && previous[(row - 1) * cols + col];
        const down = row < rows - 1 && previous[(row + 1) * cols + col];
        const left = col > 0 && previous[row * cols + col - 1];
        const right = col < cols - 1 && previous[row * cols + col + 1];
        if (up || down || left || right) built[row * cols + col] = 1;
      }
    }
  }
  for (let index = 0; index < cells.length; index += 1) {
    if (built[index]) cells[index] = 4;
  }

  landfillSource.features.forEach((feature) => paint(feature, 5, cells));

  const tally = COVER_CLASSES.map(
    (_, value) => cells.reduce((count, cell) => (cell === value ? count + 1 : count), 0),
  );
  return { cells, tally };
})();

/**
 * Stabla po stvarnim zelenim površinama umjesto ručno upisanog niza.
 *
 * Gustoća se razlikuje po vrsti pokrova jer je razlika vidljiva iz zraka:
 * šuma je sklopljena, makija rijetka, travnjak ima pokoju maslinu na međi.
 * Raspored je nasumičan, ali iz sjemena — dvije gradnje iste maketa moraju
 * dati istu datoteku, inače test determinizma pada, a i git bi svaki build
 * vidio kao promjenu.
 */
const TREE_DENSITY: Record<string, number> = {
  wood: 190,
  scrub: 620,
  grassland: 2400,
  meadow: 2600,
  grass: 3200,
  garden: 1400,
};
const TREE_LIMIT = 1100;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const trees = (() => {
  const random = seededRandom(20260821);
  const placed: Array<{ point: Position; kind: string; size: number }> = [];

  const candidates = greenSource.features
    .flatMap((feature) => {
      if (feature.geometry.type !== "Polygon") return [];
      const cover = String(
        feature.properties.natural ?? feature.properties.landuse ?? feature.properties.leisure ?? "",
      );
      const density = TREE_DENSITY[cover];
      if (!density) return [];
      return [{ feature, cover, density, id: String(feature.properties.id ?? "") }];
    })
    .toSorted((left, right) => left.id.localeCompare(right.id));

  for (const candidate of candidates) {
    const polygon = polygonFeature(candidate.feature);
    const [west, south, east, north] = candidateBounds(candidate.feature);
    const wanted = Math.min(120, Math.floor(turfArea(polygon) / candidate.density));
    let attempts = 0;
    let accepted = 0;
    while (accepted < wanted && attempts < wanted * 30 + 40) {
      attempts += 1;
      const point: Position = [
        west + (east - west) * random(),
        south + (north - south) * random(),
      ];
      if (!booleanPointInPolygon(point, polygon)) continue;
      accepted += 1;
      placed.push({
        point: project(point),
        kind: candidate.cover === "wood" ? "wood" : candidate.cover === "scrub" ? "scrub" : "grove",
        size: Math.round(random() * 3),
      });
    }
    if (placed.length >= TREE_LIMIT) break;
  }

  return placed.slice(0, TREE_LIMIT);
})();

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
  trees,
  relief: { ...relief.scene, cover: { file: COVER_FILE, classes: COVER_CLASSES } },
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

// Mreža visina putuje uz modul, a ne u njemu: pola megabajta int16 u
// JavaScriptu bi se parsiralo kao pola milijuna brojevnih literala. Kad je
// zadan `--output` (ispitivanje), ide u isti direktorij, pa provjera
// determinizma ne dira repozitorij.
const reliefDirectory =
  outputArgumentIndex >= 0 ? path.dirname(outputPath) : path.join(root, "public", "igra");
mkdirSync(reliefDirectory, { recursive: true });
writeFileSync(
  path.join(reliefDirectory, path.basename(RELIEF_FILE)),
  Buffer.from(relief.cells.buffer, relief.cells.byteOffset, relief.cells.byteLength),
);
writeFileSync(
  path.join(reliefDirectory, path.basename(COVER_FILE)),
  Buffer.from(cover.cells.buffer, cover.cells.byteOffset, cover.cells.byteLength),
);

process.stdout.write(
  `Generirano: ${path.relative(root, outputPath)} (${roads.length} cesta, ` +
    `${buildings.length} zgrada, ${trees.length} stabala, reljef ` +
    `${relief.scene.cols} × ${relief.scene.rows} ćelija, ` +
    `${relief.scene.lowestMetres}–${relief.scene.highestMetres} m, pokrov ` +
    `${COVER_CLASSES.map((name, value) => `${name} ${cover.tally[value]}`).join(", ")}` +
    `${relief.holes ? `, popunjeno ${relief.holes} praznih ćelija` : ""})\n`,
);
