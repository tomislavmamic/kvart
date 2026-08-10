import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { area, bbox, featureCollection, intersect } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  resolvePlannedRoadOwnership,
  validatePlannedRoadParcelProperties,
  type PlannedRoadParcelProperties,
} from "../src/lib/planned-road-parcels";
import type { PublicParcelProperties } from "../src/lib/public-parcels";
import type { TargetedOwnershipProperties } from "../src/lib/targeted-ownership";

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

function isPolygonFeature(feature: Feature): feature is PolygonFeature {
  return feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
}

async function readPolygons<P = Record<string, unknown>>(file: string): Promise<PolygonFeature<P>[]> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
  return parsed.features.filter(isPolygonFeature) as PolygonFeature<P>[];
}

function normalizeParcelNumber(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function parcelId(municipality: unknown, parcelNumber: unknown): string | null {
  const normalizedMunicipality = String(municipality ?? "").trim().toUpperCase();
  const normalizedNumber = normalizeParcelNumber(parcelNumber);
  return normalizedMunicipality && normalizedNumber ? `${normalizedMunicipality}:${normalizedNumber}` : null;
}

function boxesOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function overlapArea(parcel: PolygonFeature, road: PolygonFeature): number {
  if (!boxesOverlap(bbox(parcel), bbox(road))) return 0;
  try {
    const cut = intersect(featureCollection([parcel, road]));
    return cut ? area(cut) : 0;
  } catch {
    return 0;
  }
}

function ownershipIndex<P extends { parcel_id: string }>(features: PolygonFeature<P>[]): Map<string, P> {
  return new Map(features.map((feature) => [feature.properties.parcel_id, feature.properties]));
}

export function derivePlannedRoadParcel(
  parcel: PolygonFeature,
  roads: PolygonFeature[],
  targetedById: Map<string, TargetedOwnershipProperties>,
  cityGisById: Map<string, PublicParcelProperties>,
  sourceUpdatedAt: string,
): PolygonFeature<PlannedRoadParcelProperties> | null {
  const source = parcel.properties ?? {};
  const id = parcelId(source.ko, source.cestica);
  const parcelArea = Number(source.povrsina);
  const mappedArea = area(parcel);
  if (!id || !Number.isFinite(parcelArea) || parcelArea <= 0 || !Number.isFinite(mappedArea) || mappedArea <= 0)
    return null;

  const roadOverlap = roads.reduce((sum, road) => sum + overlapArea(parcel, road), 0);
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
    readPolygons(PARCELS),
    readPolygons(ROADS),
    readPolygons<TargetedOwnershipProperties>(TARGETED),
    readPolygons<PublicParcelProperties>(CITY_GIS),
  ]);
  const targetedById = ownershipIndex(targeted);
  const cityGisById = ownershipIndex(cityGis);
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
  const [parcels, roads] = await Promise.all([readPolygons(PARCELS), readPolygons(ROADS)]);
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
