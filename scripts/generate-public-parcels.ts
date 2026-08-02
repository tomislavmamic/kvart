/**
 * Iz lokalnog, ignoriranog sloja vlasništva izrađuje mali javni sloj.
 *
 * Ulaz `katastar-vlasnistvo.geojson` nastaje iz SHP izvoza Grada Splita i
 * sadrži osobne podatke. Ova skripta zato radi sa zatvorenom izlaznom shemom:
 * preuzima samo izričiti javni status i geometriju, a validator ruši izradu
 * ako bi se u izlazu pojavilo bilo koje drugo svojstvo.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  area,
  bbox,
  featureCollection,
  intersect,
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from "geojson";
import {
  validatePublicParcelProperties,
  type OwnershipForm,
  type PublicLevel,
  type PublicParcelProperties,
} from "../src/lib/public-parcels";

type PolygonFeature<P = Record<string, unknown>> = Feature<
  Polygon | MultiPolygon,
  P
>;

const ROOT = path.join(import.meta.dirname, "..");
const OUTPUT = path.join(ROOT, "public", "geo", "analiza", "javne-cestice.geojson");
const PURPOSES = path.join(ROOT, "public", "geo", "planovi", "gup-2024-namjena.geojson");
const BUILDINGS = [
  path.join(ROOT, "public", "geo", "grad", "zgrade-2025.geojson"),
  path.join(ROOT, "public", "geo", "grad", "zgrade-visine.geojson"),
  path.join(ROOT, "public", "geo", "grad", "katastar-objekti.geojson"),
  path.join(ROOT, "public", "geo", "zgrade.geojson"),
];
const SOURCE_UPDATED_AT = "2025-10-03";

const LEVEL_BY_STATUS: Record<string, PublicLevel> = {
  JLS: "city",
  RH: "state",
  "DNŽ": "county",
};

function ownershipForm(value: unknown): OwnershipForm {
  if (value === "Vlasništvo") return "ownership";
  if (value === "Suvlasništvo") return "coownership";
  return "unknown";
}

function boxesOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function overlapArea(a: PolygonFeature, b: PolygonFeature): number {
  if (!boxesOverlap(bbox(a), bbox(b))) return 0;
  try {
    const cut = intersect(featureCollection([a, b]));
    return cut ? area(cut) : 0;
  } catch {
    // Neispravna izvorna geometrija ne smije zaustaviti cijeli osvježaj.
    // Njezin preklop ostaje nepoznat i vidljiv je u završnim brojkama.
    return 0;
  }
}

export function derivePublicParcel(
  raw: PolygonFeature,
  purposes: PolygonFeature[],
  buildings: PolygonFeature[],
  generatedAt: string,
): PolygonFeature<PublicParcelProperties> | null {
  const source = raw.properties ?? {};
  const publicLevel = LEVEL_BY_STATUS[String(source.zk_status ?? "")];
  if (!publicLevel) return null;

  const parcelNumber = String(source.cestica ?? "").trim();
  const municipality = String(source.ko ?? "").trim();
  if (!parcelNumber || !municipality) return null;

  const parcelArea = area(raw);
  if (!Number.isFinite(parcelArea) || parcelArea <= 0) return null;

  const purposeTotals = new Map<string, { label: string; area_m2: number }>();
  for (const purpose of purposes) {
    const code = String(purpose.properties?.kod ?? "").trim();
    if (!code) continue;
    const covered = overlapArea(raw, purpose);
    if (covered <= 0) continue;
    const current = purposeTotals.get(code) ?? {
      label: String(purpose.properties?.namjena ?? code).trim(),
      area_m2: 0,
    };
    current.area_m2 += covered;
    purposeTotals.set(code, current);
  }
  const primary = [...purposeTotals.entries()]
    .filter(([, value]) => value.area_m2 / parcelArea >= 0.01)
    .sort((a, b) => b[1].area_m2 - a[1].area_m2 || a[0].localeCompare(b[0]))[0];

  const properties: PublicParcelProperties = {
    parcel_id: `${municipality}:${parcelNumber}`,
    parcel_number: parcelNumber,
    cadastral_municipality: municipality,
    public_level: publicLevel,
    ownership_form: ownershipForm(source.zk_oblik),
    purpose_primary_code: primary?.[0] ?? null,
    purpose_primary_label: primary?.[1].label ?? null,
    built: buildings.some((building) => overlapArea(raw, building) >= 1),
    area_m2: Math.round(parcelArea * 10) / 10,
    source_updated_at: SOURCE_UPDATED_AT,
    generated_at: generatedAt,
  };
  validatePublicParcelProperties(properties);
  return { type: "Feature", geometry: raw.geometry, properties };
}

async function readPolygons(file: string): Promise<PolygonFeature[]> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
  return parsed.features.filter(
    (feature): feature is PolygonFeature =>
      feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon",
  );
}

function ownershipInput(): string {
  if (process.env.PUBLIC_PARCELS_OWNERSHIP_INPUT) {
    return path.resolve(process.cwd(), process.env.PUBLIC_PARCELS_OWNERSHIP_INPUT);
  }
  const local = path.join(ROOT, "public", "geo", "grad", "katastar-vlasnistvo.geojson");
  if (existsSync(local)) return local;
  throw new Error(
    "Nema lokalnog katastar-vlasnistvo.geojson. Pokreni import-grad-geo ili " +
      "postavi PUBLIC_PARCELS_OWNERSHIP_INPUT.",
  );
}

export async function generatePublicParcels(
  generatedAt = new Date().toISOString().slice(0, 10),
): Promise<FeatureCollection<Polygon | MultiPolygon, PublicParcelProperties>> {
  const [raw, purposes, ...buildingSets] = await Promise.all([
    readPolygons(ownershipInput()),
    readPolygons(PURPOSES),
    ...BUILDINGS.map(readPolygons),
  ]);
  const buildings = buildingSets.flat();
  const features = raw
    .map((feature) => derivePublicParcel(feature, purposes, buildings, generatedAt))
    .filter((feature): feature is PolygonFeature<PublicParcelProperties> => feature !== null)
    .sort((a, b) => a.properties.parcel_id.localeCompare(b.properties.parcel_id, "hr"));

  if (features.length !== 81) {
    throw new Error(
      `Očekivana je 81 javno označena čestica iz ovog izvoza, dobiveno ${features.length}.`,
    );
  }
  for (const feature of features) validatePublicParcelProperties(feature.properties);
  return { type: "FeatureCollection", features };
}

async function main(): Promise<void> {
  const collection = await generatePublicParcels();
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(collection)}\n`, "utf8");

  const count = (key: keyof PublicParcelProperties, value: unknown) =>
    collection.features.filter((feature) => feature.properties[key] === value).length;
  console.log(`Zapisano ${collection.features.length} čestica u ${path.relative(ROOT, OUTPUT)}`);
  console.log(
    [
      `Grad/JLS ${count("public_level", "city")}`,
      `RH ${count("public_level", "state")}`,
      `Županija ${count("public_level", "county")}`,
      `vlasništvo ${count("ownership_form", "ownership")}`,
      `suvlasništvo ${count("ownership_form", "coownership")}`,
      `ima tlocrt ${count("built", true)}`,
      `nema evidentirani tlocrt ${count("built", false)}`,
      `bez namjene ${count("purpose_primary_code", null)}`,
    ].join(" · "),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
