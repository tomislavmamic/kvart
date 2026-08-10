import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { area, bbox, featureCollection, intersect } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  canonicalParcelId,
  resolvePlannedRoadOwnership,
  validatePlannedRoadParcelProperties,
  type PlannedRoadParcelProperties,
} from "../src/lib/planned-road-parcels";
import {
  validatePublicParcelProperties,
  type PublicParcelProperties,
} from "../src/lib/public-parcels";
import {
  validateTargetedOwnershipProperties,
  type TargetedOwnershipProperties,
} from "../src/lib/targeted-ownership";

type PolygonGeometry = Polygon | MultiPolygon;
type PolygonFeature<P = Record<string, unknown>> = Feature<PolygonGeometry, P>;

const ROOT = path.join(import.meta.dirname, "..");
const PARCELS = path.join(ROOT, "public", "geo", "grad", "katastar.geojson");
const ROADS = path.join(ROOT, "public", "geo", "planovi", "gup-2024-promet.geojson");
const TARGETED = path.join(ROOT, "public", "geo", "analiza", "ciljana-provjera-vlasnistva.geojson");
const CITY_GIS = path.join(ROOT, "public", "geo", "analiza", "javne-cestice.geojson");
const OUTPUT = path.join(ROOT, "public", "geo", "analiza", "cestice-planiranih-cesta.geojson");
const MANIFEST = path.join(ROOT, "public", "geo", "analiza", "cestice-planiranih-cesta.manifest.json");
const MIN_ROAD_OVERLAP_M2 = 1;
const EXPECTED_ROAD_POLYGONS = 532;
const EXPECTED_PARCELS = 1_314;
const EXPECTED_SELECTED = 338;
const EXPECTED_WITH_EVIDENCE = 54;
const SOURCE_UPDATED_AT = "2025-10-03";

function validatePosition(value: unknown, context: string): void {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    throw new Error(`${context} must be a finite numeric coordinate pair`);
  }
}

function validateLinearRing(value: unknown, context: string): void {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  if (value.length < 4)
    throw new Error(`${context} must contain at least four positions`);
  for (const [positionIndex, position] of value.entries()) {
    validatePosition(position, `${context} position ${positionIndex}`);
  }
  const first = value[0] as [number, number];
  const last = value[value.length - 1] as [number, number];
  if (first[0] !== last[0] || first[1] !== last[1])
    throw new Error(`${context} must be closed`);
}

function validatePolygonCoordinates(value: unknown, context: string): void {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error(`${context} must contain at least one linear ring`);
  for (const [ringIndex, ring] of value.entries()) {
    validateLinearRing(ring, `${context} ring ${ringIndex}`);
  }
}

export function validatePolygonFeatureCollection(
  value: unknown,
  sourceLabel: string,
): asserts value is FeatureCollection<PolygonGeometry> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${sourceLabel}: source must be a FeatureCollection`);
  const collection = value as Partial<FeatureCollection>;
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features))
    throw new Error(`${sourceLabel}: source must be a FeatureCollection`);
  for (const [index, feature] of collection.features.entries()) {
    if (!feature || feature.type !== "Feature")
      throw new Error(`${sourceLabel}: feature ${index} must be a Feature`);
    if (
      feature.geometry?.type !== "Polygon" &&
      feature.geometry?.type !== "MultiPolygon"
    ) {
      throw new Error(
        `${sourceLabel}: feature ${index} geometry must be Polygon or MultiPolygon`,
      );
    }
    if (!feature.properties || typeof feature.properties !== "object")
      throw new Error(`${sourceLabel}: feature ${index} properties must be an object`);
    try {
      if (feature.geometry.type === "Polygon") {
        validatePolygonCoordinates(
          feature.geometry.coordinates,
          `${sourceLabel}: feature ${index} polygon 0`,
        );
      } else {
        if (
          !Array.isArray(feature.geometry.coordinates) ||
          feature.geometry.coordinates.length === 0
        ) {
          throw new Error(
            `${sourceLabel}: feature ${index} multipolygon must contain at least one polygon`,
          );
        }
        for (const [polygonIndex, polygon] of feature.geometry.coordinates.entries()) {
          validatePolygonCoordinates(
            polygon,
            `${sourceLabel}: feature ${index} polygon ${polygonIndex}`,
          );
        }
      }
      const measuredArea = area(feature);
      if (!Number.isFinite(measuredArea) || measuredArea <= 0)
        throw new Error("geometry area must be positive and finite");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith(`${sourceLabel}: feature ${index}`)
      ) {
        throw error;
      }
      throw new Error(
        `${sourceLabel}: feature ${index} has invalid polygon geometry`,
        { cause: error },
      );
    }
  }
}

async function readPolygons<P = Record<string, unknown>>(
  file: string,
  sourceLabel: string,
  validateProperties?: (value: unknown) => void,
): Promise<PolygonFeature<P>[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${sourceLabel}: source cannot be read as JSON`, {
      cause: error,
    });
  }
  validatePolygonFeatureCollection(parsed, sourceLabel);
  const features = parsed.features as PolygonFeature<P>[];
  if (validateProperties) {
    for (const [index, feature] of features.entries()) {
      try {
        validateProperties(feature.properties);
      } catch (error) {
        throw new Error(`${sourceLabel}: feature ${index} properties are invalid`, {
          cause: error,
        });
      }
    }
  }
  return features;
}

function boxesOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function overlapArea(
  parcel: PolygonFeature,
  road: PolygonFeature,
  parcelId: string,
  roadIndex: number,
): number {
  try {
    if (!boxesOverlap(bbox(parcel), bbox(road))) return 0;
    const cut = intersect(featureCollection([parcel, road]));
    if (!cut) return 0;
    const measuredArea = area(cut);
    if (!Number.isFinite(measuredArea) || measuredArea < 0)
      throw new Error("intersection area must be finite and non-negative");
    return measuredArea;
  } catch (error) {
    throw new Error(
      `Spatial intersection failed for parcel ${parcelId} and road feature ${roadIndex}`,
      { cause: error },
    );
  }
}

function ownershipIndex<
  P extends {
    parcel_id: string;
    parcel_number: string;
    cadastral_municipality: string;
  },
>(features: PolygonFeature<P>[], sourceLabel: string): Map<string, P> {
  const index = new Map<string, P>();
  for (const [featureIndex, feature] of features.entries()) {
    const properties = feature.properties;
    const expectedId = canonicalParcelId(
      properties.cadastral_municipality,
      properties.parcel_number,
    );
    if (expectedId !== properties.parcel_id) {
      throw new Error(
        `${sourceLabel}: feature ${featureIndex} parcel_id is not canonical`,
      );
    }
    if (index.has(properties.parcel_id)) {
      throw new Error(
        `${sourceLabel}: duplicate parcel_id ${properties.parcel_id}`,
      );
    }
    index.set(properties.parcel_id, properties);
  }
  return index;
}

export function derivePlannedRoadParcel(
  parcel: PolygonFeature,
  roads: PolygonFeature[],
  targetedById: Map<string, TargetedOwnershipProperties>,
  cityGisById: Map<string, PublicParcelProperties>,
  sourceUpdatedAt: string,
): PolygonFeature<PlannedRoadParcelProperties> | null {
  const source = parcel.properties ?? {};
  const id = canonicalParcelId(source.ko, source.cestica);
  const parcelArea = source.povrsina;
  if (!id)
    throw new Error("Parcel feature is missing a canonical parcel key");
  if (
    typeof parcelArea !== "number" ||
    !Number.isFinite(parcelArea) ||
    parcelArea <= 0
  )
    throw new Error(`Parcel ${id} has invalid povrsina`);
  let mappedArea: number;
  try {
    mappedArea = area(parcel);
  } catch (error) {
    throw new Error(`Spatial area failed for parcel ${id}`, { cause: error });
  }
  if (!Number.isFinite(mappedArea) || mappedArea <= 0)
    throw new Error(`Parcel ${id} has invalid mapped geometry area`);

  const roadOverlap = roads.reduce(
    (sum, road, roadIndex) =>
      sum + overlapArea(parcel, road, id, roadIndex),
    0,
  );
  if (roadOverlap < MIN_ROAD_OVERLAP_M2) return null;

  const [cadastralMunicipality, parcelNumber] = id.split(":");
  const ownership = resolvePlannedRoadOwnership(
    targetedById.get(id) ?? null,
    cityGisById.get(id) ?? null,
  );
  const properties: PlannedRoadParcelProperties = {
    parcel_id: id,
    parcel_number: parcelNumber,
    cadastral_municipality: cadastralMunicipality,
    parcel_area_m2: Math.round(parcelArea * 10) / 10,
    mapped_area_m2: Math.round(mappedArea * 10) / 10,
    road_overlap_m2: Math.round(roadOverlap * 10) / 10,
    road_overlap_percent: Math.round(Math.min(100, (roadOverlap / parcelArea) * 100) * 10) / 10,
    ...ownership,
    source_updated_at: sourceUpdatedAt,
  };
  validatePlannedRoadParcelProperties(properties);
  return { type: "Feature", geometry: parcel.geometry, properties };
}

export async function generatePlannedRoadParcels(
  allowScopeDrift = false,
): Promise<FeatureCollection<PolygonGeometry, PlannedRoadParcelProperties>> {
  const [parcels, roads, targeted, cityGis] = await Promise.all([
    readPolygons(PARCELS, "cadastral parcels"),
    readPolygons(ROADS, "planned roads"),
    readPolygons<TargetedOwnershipProperties>(
      TARGETED,
      "targeted ownership",
      validateTargetedOwnershipProperties,
    ),
    readPolygons<PublicParcelProperties>(
      CITY_GIS,
      "city GIS ownership",
      validatePublicParcelProperties,
    ),
  ]);
  const targetedById = ownershipIndex(targeted, "targeted ownership");
  const cityGisById = ownershipIndex(cityGis, "city GIS ownership");
  const features = parcels
    .map((parcel) => derivePlannedRoadParcel(
      parcel,
      roads,
      targetedById,
      cityGisById,
      SOURCE_UPDATED_AT,
    ))
    .filter((feature): feature is PolygonFeature<PlannedRoadParcelProperties> => feature !== null)
    .sort((a, b) => a.properties.parcel_id.localeCompare(b.properties.parcel_id, "hr"));
  const withEvidence = features.filter((feature) => feature.properties.ownership_status !== "no_data").length;

  if (!allowScopeDrift && (
    roads.length !== EXPECTED_ROAD_POLYGONS ||
    parcels.length !== EXPECTED_PARCELS ||
    features.length !== EXPECTED_SELECTED ||
    withEvidence !== EXPECTED_WITH_EVIDENCE
  )) {
    throw new Error(
      `Promijenjen skup planiranih cesta: promet ${roads.length}/${EXPECTED_ROAD_POLYGONS}, ` +
      `čestice ${parcels.length}/${EXPECTED_PARCELS}, odabrano ${features.length}/${EXPECTED_SELECTED}, ` +
      `s dokazom ${withEvidence}/${EXPECTED_WITH_EVIDENCE}.`,
    );
  }
  for (const feature of features) validatePlannedRoadParcelProperties(feature.properties);
  return { type: "FeatureCollection", features };
}

async function main(): Promise<void> {
  const allowScopeDrift = process.argv.slice(2).includes("--allow-scope-drift");
  const collection = await generatePlannedRoadParcels(allowScopeDrift);
  const [parcels, roads] = await Promise.all([
    readPolygons(PARCELS, "cadastral parcels"),
    readPolygons(ROADS, "planned roads"),
  ]);
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(collection)}\n`, "utf8");
  const counts = Object.fromEntries(
    ["confirmed_public", "mixed_public", "cadastre_public", "city_gis_public", "not_confirmed_public", "unresolved", "no_data"].map(
      (status) => [status, collection.features.filter((feature) => feature.properties.ownership_status === status).length],
    ),
  );
  const manifest = {
    source_updated_at: SOURCE_UPDATED_AT,
    minimum_road_overlap_m2: MIN_ROAD_OVERLAP_M2,
    input_counts: { road_polygons: roads.length, parcels: parcels.length },
    selected_count: collection.features.length,
    ownership_status_counts: counts,
    sources: {
      parcels: "/geo/grad/katastar.geojson",
      roads: "/geo/planovi/gup-2024-promet.geojson",
      targeted_ownership: "/geo/analiza/ciljana-provjera-vlasnistva.geojson",
      city_gis: "/geo/analiza/javne-cestice.geojson",
    },
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Zapisano ${collection.features.length} čestica u ${path.relative(ROOT, OUTPUT)}.`);
  console.log(`${counts.no_data} bez podataka · ${collection.features.length - counts.no_data} s vlasničkim zapisom`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
