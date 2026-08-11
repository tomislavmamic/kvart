/**
 * Lokalna, ciljana provjera vlasništva po istom javnom toku koji koristi
 * Katica: WMS GetFeatureInfo → katastarska čestica → ZK uložak ili posjednik.
 *
 * Sirovi odgovori mogu sadržavati osobne podatke i ostaju isključivo u
 * ignoriranom `.cache/targeted-ownership`. U `public/` se zapisuje zatvorena,
 * sanitizirana shema koja nikada ne sadrži neprepoznatog vlasnika.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  area,
  bbox,
  booleanPointInPolygon,
  centroid,
  featureCollection,
  intersect,
  pointOnFeature,
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import proj4 from "proj4";
import {
  validateTargetedOwnershipProperties,
  type OwnershipCohort,
  type OwnershipEvidenceSource,
  type OwnershipVerificationStatus,
  type PublicEntityCategory,
  type SanitizedPublicEntity,
  type TargetedOwnershipProperties,
} from "../src/lib/targeted-ownership";

type PolygonGeometry = Polygon | MultiPolygon;
type PolygonFeature<P = Record<string, unknown>> = Feature<PolygonGeometry, P>;

interface RegistryEntity extends SanitizedPublicEntity {
  aliases: string[];
  taxNumbers: string[];
  source: string;
  verifiedAt: string;
}

interface OwnerIdentity {
  name: string;
  taxNumber: string | null;
}

interface TargetParcel {
  feature: PolygonFeature<Record<string, unknown>>;
  parcelId: string;
  parcelNumber: string;
  municipality: string;
  cohorts: OwnershipCohort[];
  parcelAreaM2: number;
  mappedAreaM2: number;
}

interface OwnershipResolution {
  verificationStatus: OwnershipVerificationStatus;
  evidenceSource: OwnershipEvidenceSource;
  publicEntities: SanitizedPublicEntity[];
  verifiedAt: string | null;
  reviewReason: string | null;
}

interface CachedOssResponse {
  gfi: Record<string, unknown> | null;
  parcelInfo: Record<string, unknown> | null;
  landRegister: unknown;
}

interface SpatialEvidence {
  purposeCode: string | null;
  purposeLabel: string | null;
  built: boolean;
}

const ROOT = path.join(import.meta.dirname, "..");
const PARCELS = path.join(ROOT, "public", "geo", "grad", "katastar.geojson");
const CORRIDOR = path.join(ROOT, "data", "public-ownership-corridor.geojson");
const REGISTRY = path.join(ROOT, "data", "public-entities.json");
const PURPOSES = path.join(ROOT, "public", "geo", "planovi", "gup-2024-namjena.geojson");
const BUILDINGS = [
  path.join(ROOT, "public", "geo", "grad", "zgrade-2025.geojson"),
  path.join(ROOT, "public", "geo", "grad", "zgrade-visine.geojson"),
  path.join(ROOT, "public", "geo", "grad", "katastar-objekti.geojson"),
  path.join(ROOT, "public", "geo", "zgrade.geojson"),
];
const OUTPUT = path.join(ROOT, "public", "geo", "analiza", "ciljana-provjera-vlasnistva.geojson");
const MANIFEST = path.join(ROOT, "public", "geo", "analiza", "ciljana-provjera-vlasnistva.manifest.json");
const CACHE = path.join(ROOT, ".cache", "targeted-ownership");
const MAP_CONFIG = "https://oss.uredjenazemlja.hr/oss/public/gis/map-config";
const OSS_ORIGIN = "https://oss.uredjenazemlja.hr";
const SOURCE_UPDATED_AT = "2025-10-03";
const MIN_CORRIDOR_OVERLAP_M2 = 1;
const LARGE_PARCEL_M2 = 10_000;
const EXPECTED_CORRIDOR = 18;
const EXPECTED_LARGE = 14;
const EXPECTED_UNION = 30;

proj4.defs(
  "EPSG:3765",
  "+proj=tmerc +lat_0=0 +lon_0=16.5 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs",
);

function isPolygonFeature(feature: Feature): feature is PolygonFeature {
  return feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
}

async function readPolygons(file: string): Promise<PolygonFeature[]> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
  return parsed.features.filter(isPolygonFeature);
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
    return 0;
  }
}

export function normalizeEntityName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeParcelNumber(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function toSanitizedEntity(entity: RegistryEntity): SanitizedPublicEntity {
  return { id: entity.id, label: entity.label, category: entity.category };
}

export function matchPublicEntity(
  owner: OwnerIdentity,
  registry: RegistryEntity[],
): RegistryEntity | null {
  const taxNumber = owner.taxNumber?.replace(/\D/g, "") ?? "";
  if (taxNumber) {
    const byTax = registry.find((entity) => entity.taxNumbers.includes(taxNumber));
    if (byTax) return byTax;
  }
  const normalized = normalizeEntityName(owner.name);
  if (!normalized) return null;
  return (
    registry.find((entity) =>
      [entity.label, ...entity.aliases].some(
        (alias) => normalizeEntityName(alias) === normalized,
      ),
    ) ?? null
  );
}

export function classifyIdentities(
  owners: OwnerIdentity[],
  evidenceSource: OwnershipEvidenceSource,
  registry: RegistryEntity[],
  verifiedAt: string,
): OwnershipResolution {
  if (owners.length === 0) {
    return {
      verificationStatus: "unresolved",
      evidenceSource: "none",
      publicEntities: [],
      verifiedAt: null,
      reviewReason: "OSS zapis nema vlasnika ni posjednika",
    };
  }
  const matched = owners.map((owner) => matchPublicEntity(owner, registry));
  const publicEntities = [
    ...new Map(
      matched
        .filter((entity): entity is RegistryEntity => entity !== null)
        .map((entity) => [entity.id, toSanitizedEntity(entity)]),
    ).values(),
  ];
  const publicCount = matched.filter(Boolean).length;

  if (evidenceSource === "land_register") {
    if (publicCount === owners.length) {
      return {
        verificationStatus: "confirmed_public",
        evidenceSource,
        publicEntities,
        verifiedAt,
        reviewReason: null,
      };
    }
    if (publicCount > 0) {
      return {
        verificationStatus: "mixed_public",
        evidenceSource,
        publicEntities,
        verifiedAt,
        reviewReason: "ZK uložak ima javnog i drugog ili neprepoznatog nositelja",
      };
    }
    return {
      verificationStatus: "private_or_other",
      evidenceSource,
      publicEntities: [],
      verifiedAt,
      reviewReason: null,
    };
  }

  if (evidenceSource === "cadastre" && publicCount === owners.length) {
    return {
      verificationStatus: "cadastre_public",
      evidenceSource,
      publicEntities,
      verifiedAt,
      reviewReason: "Nema ZK veze; klasifikacija se oslanja na katastarskog posjednika",
    };
  }
  return {
    verificationStatus: "unresolved",
    evidenceSource,
    publicEntities: [],
    verifiedAt: null,
    reviewReason:
      evidenceSource === "cadastre"
        ? "Katastarski posjednici nisu svi prepoznati javni subjekti"
        : "Nema razrješivog dokaza vlasništva",
  };
}

async function loadRegistry(): Promise<RegistryEntity[]> {
  const parsed = JSON.parse(await readFile(REGISTRY, "utf8")) as RegistryEntity[];
  const categories = new Set<PublicEntityCategory>([
    "city",
    "state",
    "county",
    "municipal_company",
    "public_institution",
    "other_public",
  ]);
  for (const entity of parsed) {
    if (!entity.id || !entity.label || !categories.has(entity.category))
      throw new Error(`Neispravan javni subjekt: ${entity.id || "bez id-a"}`);
    if (!Array.isArray(entity.aliases) || entity.aliases.length === 0)
      throw new Error(`Javni subjekt ${entity.id} nema dopušteni naziv`);
    if (!Array.isArray(entity.taxNumbers) || !entity.taxNumbers.every((value) => /^\d{11}$/.test(value)))
      throw new Error(`Javni subjekt ${entity.id} ima neispravan OIB`);
  }
  return parsed;
}

export function selectTargetParcels(
  parcels: PolygonFeature[],
  corridor: PolygonFeature[],
  allowScopeDrift = false,
): TargetParcel[] {
  const selected: TargetParcel[] = [];
  let corridorCount = 0;
  let largeCount = 0;
  for (const feature of parcels) {
    const properties = feature.properties ?? {};
    const parcelNumber = normalizeParcelNumber(properties.cestica);
    const municipality = String(properties.ko ?? "").trim().toUpperCase();
    const parcelAreaM2 = Number(properties.povrsina);
    const mappedAreaM2 = area(feature);
    if (!parcelNumber || !municipality || !Number.isFinite(parcelAreaM2) || parcelAreaM2 <= 0 || mappedAreaM2 <= 0)
      continue;

    const corridorOverlap = corridor.reduce(
      (sum, segment) => sum + overlapArea(feature, segment),
      0,
    );
    const inCorridor = corridorOverlap >= MIN_CORRIDOR_OVERLAP_M2;
    const isLarge = parcelAreaM2 >= LARGE_PARCEL_M2;
    if (!inCorridor && !isLarge) continue;
    if (inCorridor) corridorCount += 1;
    if (isLarge) largeCount += 1;
    const cohorts: OwnershipCohort[] = [];
    if (inCorridor) cohorts.push("road_corridor");
    if (isLarge) cohorts.push("large_parcel");
    selected.push({
      feature,
      parcelId: `${municipality}:${parcelNumber}`,
      parcelNumber,
      municipality,
      cohorts,
      parcelAreaM2,
      mappedAreaM2,
    });
  }
  selected.sort((a, b) => a.parcelId.localeCompare(b.parcelId, "hr"));
  if (
    !allowScopeDrift &&
    (corridorCount !== EXPECTED_CORRIDOR || largeCount !== EXPECTED_LARGE || selected.length !== EXPECTED_UNION)
  ) {
    throw new Error(
      `Promijenjen ciljni skup: koridor ${corridorCount}/${EXPECTED_CORRIDOR}, ` +
        `velike ${largeCount}/${EXPECTED_LARGE}, ukupno ${selected.length}/${EXPECTED_UNION}.`,
    );
  }
  return selected;
}

async function fetchJson<T>(url: string, timeoutMs: number, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("json"))
        throw new Error(`očekivan JSON, dobiven ${contentType || "nepoznat tip"}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function resolveWmsUrl(): Promise<URL> {
  const config = await fetchJson<{ layers?: Array<{ name?: string; wmsService?: { url?: string } }> }>(
    MAP_CONFIG,
    10_000,
  );
  const source = config.layers?.find((layer) => layer.name === "DKP_CESTICE")?.wmsService?.url;
  if (!source) throw new Error("OSS map-config nema WMS uslugu katastarskih čestica");
  const configured = new URL(source);
  configured.hostname = "wms1-gs-oss.uredjenazemlja.hr";
  configured.pathname = "/ows2-m/wms";
  return configured;
}

function representativePoints(feature: PolygonFeature): Array<[number, number]> {
  const candidates: Feature<Point>[] = [pointOnFeature(feature)];
  const center = centroid(feature);
  try {
    if (booleanPointInPolygon(center, feature)) candidates.push(center);
  } catch {
    // pointOnFeature ostaje deterministička sigurna točka.
  }
  const seen = new Set<string>();
  const points: Array<[number, number]> = [];
  for (const candidate of candidates) {
    const coordinates = candidate.geometry.coordinates as [number, number];
    const key = coordinates.map((value) => value.toFixed(7)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(coordinates);
  }
  return points;
}

async function findOssParcel(
  target: TargetParcel,
  wmsUrl: URL,
): Promise<Record<string, unknown> | null> {
  for (const point of representativePoints(target.feature)) {
    const [easting, northing] = proj4("EPSG:4326", "EPSG:3765", point);
    const url = new URL(wmsUrl);
    const params: Record<string, string> = {
      SERVICE: "WMS",
      VERSION: "1.3.0",
      REQUEST: "GetFeatureInfo",
      FORMAT: "image/png",
      TRANSPARENT: "true",
      QUERY_LAYERS: "oss:BZP_CESTICE",
      LAYERS: "oss:BZP_CESTICE",
      STYLES: "jis_cestice_kathr",
      INFO_FORMAT: "application/json",
      I: "50",
      J: "50",
      CRS: "EPSG:3765",
      WIDTH: "101",
      HEIGHT: "101",
      BBOX: [easting - 15, northing - 15, easting + 15, northing + 15].join(","),
      FEATURE_COUNT: "1",
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetchJson<{ features?: Array<{ properties?: Record<string, unknown> }> }>(
      url.toString(),
      10_000,
    );
    const properties = response.features?.[0]?.properties;
    if (!properties) continue;
    const number = normalizeParcelNumber(properties.BROJ_CESTICE ?? properties.BROJ);
    if (number !== target.parcelNumber) continue;
    if (!properties.CESTICA_ID) continue;
    return properties;
  }
  return null;
}

function ownerIdentity(value: unknown): OwnerIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = String(record.name ?? "").trim();
  if (!name) return null;
  const taxNumberValue = record.taxNumber ?? record.oib;
  const taxNumber = taxNumberValue == null ? null : String(taxNumberValue).replace(/\D/g, "");
  return { name, taxNumber: taxNumber || null };
}

function readPossessors(parcelInfo: Record<string, unknown> | null): OwnerIdentity[] {
  const sheets = Array.isArray(parcelInfo?.possessionSheets) ? parcelInfo.possessionSheets : [];
  const owners: OwnerIdentity[] = [];
  for (const sheet of sheets) {
    if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) continue;
    const possessors = Array.isArray((sheet as Record<string, unknown>).possessors)
      ? ((sheet as Record<string, unknown>).possessors as unknown[])
      : [];
    for (const possessor of possessors) {
      const owner = ownerIdentity(possessor);
      if (owner) owners.push(owner);
    }
  }
  return owners;
}

function readLandRegisterOwners(body: unknown): OwnerIdentity[] {
  const unit = Array.isArray(body) ? body[0] : null;
  if (!unit || typeof unit !== "object" || Array.isArray(unit)) return [];
  const sheet = (unit as Record<string, unknown>).ownershipSheetB;
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) return [];
  const shares = Array.isArray((sheet as Record<string, unknown>).lrUnitShares)
    ? ((sheet as Record<string, unknown>).lrUnitShares as unknown[])
    : [];
  const owners: OwnerIdentity[] = [];
  for (const share of shares) {
    if (!share || typeof share !== "object" || Array.isArray(share)) continue;
    const candidates = Array.isArray((share as Record<string, unknown>).lrOwners)
      ? ((share as Record<string, unknown>).lrOwners as unknown[])
      : [];
    for (const candidate of candidates) {
      const owner = ownerIdentity(candidate);
      if (owner) owners.push(owner);
    }
  }
  return owners;
}

function landRegisterReference(parcelInfo: Record<string, unknown> | null): {
  lrUnitNumber: string;
  mainBookId: string;
} | null {
  const direct = parcelInfo?.lrUnit;
  if (!direct || typeof direct !== "object" || Array.isArray(direct)) return null;
  const record = direct as Record<string, unknown>;
  if (record.lrUnitNumber == null || record.mainBookId == null) return null;
  return { lrUnitNumber: String(record.lrUnitNumber), mainBookId: String(record.mainBookId) };
}

interface CodebookItem {
  key1?: string | number | null;
  value1?: string | null;
  key2?: string | number | null;
  value2?: string | null;
  displayValue1?: string | null;
}

async function findLandRegisterByExactNumber(
  municipality: string,
  parcelNumber: string,
): Promise<unknown> {
  const offices = await fetchJson<CodebookItem[]>(
    `${OSS_ORIGIN}/oss/public/codebooks/search-lr-offices`,
    7_500,
  );
  const splitOffice = offices.find(
    (office) => normalizeEntityName(String(office.value1 ?? "")) === "ZEMLJISNOKNJIZNI ODJEL SPLIT",
  );
  if (!splitOffice?.key1) return null;

  const mainBooksUrl = new URL(`${OSS_ORIGIN}/oss/public/search-lr-parcels/main-books`);
  mainBooksUrl.searchParams.set("search", municipality);
  mainBooksUrl.searchParams.set("officeId", String(splitOffice.key1));
  mainBooksUrl.searchParams.set("institutionName", "");
  const mainBooks = await fetchJson<CodebookItem[]>(mainBooksUrl.toString(), 7_500);
  const exactBooks = mainBooks.filter((book) =>
    [book.value1, book.value2, book.displayValue1].some(
      (value) => normalizeEntityName(String(value ?? "")) === normalizeEntityName(municipality),
    ),
  );
  if (exactBooks.length !== 1 || !exactBooks[0].key1) return null;
  const mainBookId = String(exactBooks[0].key1);

  const numbersUrl = new URL(`${OSS_ORIGIN}/oss/public/search-lr-parcels/parcel-numbers`);
  numbersUrl.searchParams.set("search", parcelNumber);
  numbersUrl.searchParams.set("mainBookId", mainBookId);
  const numbers = await fetchJson<CodebookItem[]>(numbersUrl.toString(), 7_500);
  const normalizedNumber = normalizeParcelNumber(parcelNumber);
  const exactNumbers = numbers.filter((candidate) => {
    const displayed = String(candidate.displayValue1 ?? candidate.value1 ?? "");
    const match = displayed.match(/(?:ZEM\s+)?(\d+(?:\/\d+)?)/i);
    return normalizeParcelNumber(match?.[1]) === normalizedNumber;
  });
  if (exactNumbers.length !== 1) return null;

  const unitsUrl = new URL(`${OSS_ORIGIN}/oss/public/lr-units/by-parcel-number`);
  unitsUrl.searchParams.set("mainBookId", mainBookId);
  unitsUrl.searchParams.set("parcelNumber", parcelNumber);
  unitsUrl.searchParams.set("lrUnitNumber", "");
  const units = await fetchJson<Array<Record<string, unknown>>>(unitsUrl.toString(), 7_500);
  if (units.length !== 1 || units[0].lrUnitNumber == null) return null;
  const unitMainBookId = String(units[0].mainBookId ?? mainBookId);
  if (unitMainBookId !== mainBookId) return null;

  const unitUrl = new URL(`${OSS_ORIGIN}/oss/public/lr/lr-unit`);
  unitUrl.searchParams.set("lrUnitNumber", String(units[0].lrUnitNumber));
  unitUrl.searchParams.set("mainBookId", mainBookId);
  unitUrl.searchParams.set("historicalOverview", "false");
  return fetchJson<unknown>(unitUrl.toString(), 7_500);
}

function cacheFile(parcelId: string): string {
  return path.join(CACHE, `${parcelId.replace(/[^A-Z0-9_-]+/gi, "_")}.json`);
}

async function readCache(parcelId: string): Promise<CachedOssResponse | null> {
  const file = cacheFile(parcelId);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as CachedOssResponse;
}

async function writeCache(parcelId: string, value: CachedOssResponse): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  await writeFile(cacheFile(parcelId), `${JSON.stringify(value)}\n`, "utf8");
}

async function fetchOssEvidence(
  target: TargetParcel,
  wmsUrl: URL,
  refresh: boolean,
): Promise<CachedOssResponse> {
  if (!refresh) {
    const cached = await readCache(target.parcelId);
    if (cached) return cached;
  }
  const gfi = await findOssParcel(target, wmsUrl);
  if (!gfi) {
    const empty: CachedOssResponse = { gfi: null, parcelInfo: null, landRegister: null };
    await writeCache(target.parcelId, empty);
    return empty;
  }
  const parcelInfo = await fetchJson<Record<string, unknown>>(
    `${OSS_ORIGIN}/oss/public/cad/parcel-info?parcelId=${encodeURIComponent(String(gfi.CESTICA_ID))}`,
    7_500,
  );
  if (
    normalizeParcelNumber(parcelInfo.parcelNumber) !== target.parcelNumber ||
    normalizeEntityName(String(parcelInfo.cadMunicipalityName ?? "")) !== normalizeEntityName(target.municipality)
  ) {
    throw new Error("OSS katastarski zapis ne odgovara ciljnoj čestici");
  }
  const reference = landRegisterReference(parcelInfo);
  let landRegister: unknown = null;
  if (reference) {
    const url = new URL(`${OSS_ORIGIN}/oss/public/lr/lr-unit`);
    url.searchParams.set("lrUnitNumber", reference.lrUnitNumber);
    url.searchParams.set("mainBookId", reference.mainBookId);
    url.searchParams.set("historicalOverview", "false");
    landRegister = await fetchJson<unknown>(url.toString(), 7_500);
  } else {
    landRegister = await findLandRegisterByExactNumber(
      String(parcelInfo.cadMunicipalityName ?? target.municipality),
      target.parcelNumber,
    );
  }
  const value = { gfi, parcelInfo, landRegister };
  await writeCache(target.parcelId, value);
  return value;
}

async function resolveTarget(
  target: TargetParcel,
  wmsUrl: URL,
  registry: RegistryEntity[],
  verifiedAt: string,
  refresh: boolean,
): Promise<OwnershipResolution> {
  try {
    const evidence = await fetchOssEvidence(target, wmsUrl, refresh);
    if (!evidence.gfi || !evidence.parcelInfo) {
      return {
        verificationStatus: "unresolved",
        evidenceSource: "none",
        publicEntities: [],
        verifiedAt: null,
        reviewReason: "OSS nije vratio odgovarajuću česticu",
      };
    }
    const landRegisterOwners = readLandRegisterOwners(evidence.landRegister);
    if (landRegisterOwners.length > 0)
      return classifyIdentities(landRegisterOwners, "land_register", registry, verifiedAt);
    const possessors = readPossessors(evidence.parcelInfo);
    return classifyIdentities(
      possessors,
      possessors.length > 0 ? "cadastre" : "none",
      registry,
      verifiedAt,
    );
  } catch (error) {
    return {
      verificationStatus: "unresolved",
      evidenceSource: "none",
      publicEntities: [],
      verifiedAt: null,
      reviewReason: error instanceof Error ? error.message : "nepoznata pogreška",
    };
  }
}

function spatialEvidence(
  target: TargetParcel,
  purposes: PolygonFeature[],
  buildings: PolygonFeature[],
): SpatialEvidence {
  const totals = new Map<string, { label: string; areaM2: number }>();
  for (const purpose of purposes) {
    const code = String(purpose.properties?.kod ?? "").trim();
    if (!code) continue;
    const covered = overlapArea(target.feature, purpose);
    if (covered <= 0) continue;
    const current = totals.get(code) ?? {
      label: String(purpose.properties?.namjena ?? code).trim(),
      areaM2: 0,
    };
    current.areaM2 += covered;
    totals.set(code, current);
  }
  const primary = [...totals.entries()]
    .filter(([, value]) => value.areaM2 / target.mappedAreaM2 >= 0.01)
    .sort((a, b) => b[1].areaM2 - a[1].areaM2 || a[0].localeCompare(b[0], "hr"))[0];
  return {
    purposeCode: primary?.[0] ?? null,
    purposeLabel: primary?.[1].label ?? null,
    built: buildings.some((building) => overlapArea(target.feature, building) >= 1),
  };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export async function generateTargetedOwnership(options: {
  refresh?: boolean;
  allowScopeDrift?: boolean;
  verifiedAt?: string;
} = {}): Promise<FeatureCollection<PolygonGeometry, TargetedOwnershipProperties>> {
  const verifiedAt = options.verifiedAt ?? new Date().toISOString().slice(0, 10);
  const [parcels, corridor, purposes, registry, ...buildingSets] = await Promise.all([
    readPolygons(PARCELS),
    readPolygons(CORRIDOR),
    readPolygons(PURPOSES),
    loadRegistry(),
    ...BUILDINGS.map(readPolygons),
  ]);
  const targets = selectTargetParcels(parcels, corridor, options.allowScopeDrift);
  const buildings = buildingSets.flat();
  const wmsUrl = await resolveWmsUrl();
  const features = await mapConcurrent(targets, 3, async (target, index) => {
    const resolution = await resolveTarget(
      target,
      wmsUrl,
      registry,
      verifiedAt,
      options.refresh ?? false,
    );
    const spatial = spatialEvidence(target, purposes, buildings);
    const properties: TargetedOwnershipProperties = {
      parcel_id: target.parcelId,
      parcel_number: target.parcelNumber,
      cadastral_municipality: target.municipality,
      cohorts: target.cohorts,
      verification_status: resolution.verificationStatus,
      evidence_source: resolution.evidenceSource,
      public_entities: resolution.publicEntities,
      purpose_primary_code: spatial.purposeCode,
      purpose_primary_label: spatial.purposeLabel,
      built: spatial.built,
      parcel_area_m2: Math.round(target.parcelAreaM2 * 10) / 10,
      mapped_area_m2: Math.round(target.mappedAreaM2 * 10) / 10,
      verified_at: resolution.verifiedAt,
      source_updated_at: SOURCE_UPDATED_AT,
    };
    validateTargetedOwnershipProperties(properties);
    const reason = resolution.reviewReason ? ` · pregled: ${resolution.reviewReason}` : "";
    console.log(
      `[${index + 1}/${targets.length}] ${target.parcelId} → ${resolution.verificationStatus}` +
        ` (${resolution.evidenceSource})${reason}`,
    );
    return { type: "Feature" as const, geometry: target.feature.geometry, properties };
  });
  return { type: "FeatureCollection", features };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const collection = await generateTargetedOwnership({
    refresh: args.has("--refresh"),
    allowScopeDrift: args.has("--allow-scope-drift"),
  });
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(collection)}\n`, "utf8");
  const counts = Object.fromEntries(
    ["confirmed_public", "mixed_public", "cadastre_public", "private_or_other", "unresolved"].map(
      (status) => [status, collection.features.filter((feature) => feature.properties.verification_status === status).length],
    ),
  );
  const verifiedDates = collection.features
    .map((feature) => feature.properties.verified_at)
    .filter((value): value is string => value !== null)
    .sort();
  const manifest = {
    generated_at: new Date().toISOString().slice(0, 10),
    verified_at: verifiedDates.at(-1) ?? null,
    target_count: collection.features.length,
    corridor_overlap_m2: MIN_CORRIDOR_OVERLAP_M2,
    large_parcel_m2: LARGE_PARCEL_M2,
    counts,
    sources: {
      cadastral_geometry: "/geo/grad/katastar.geojson",
      corridor: "data/public-ownership-corridor.geojson",
      ownership: "https://oss.uredjenazemlja.hr/",
      public_registry: "data/public-entities.json",
    },
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Zapisano ${collection.features.length} ciljanih čestica u ${path.relative(ROOT, OUTPUT)}.`);
  console.log(Object.entries(counts).map(([status, count]) => `${status} ${count}`).join(" · "));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
