import type { Feature, Geometry } from "geojson";
import {
  OWNERSHIP_FORM_LABELS,
  PUBLIC_LEVEL_LABELS,
  type PublicLevel,
  type PublicParcelProperties,
} from "./public-parcels";
import type {
  SanitizedPublicEntity,
  TargetedOwnershipProperties,
} from "./targeted-ownership";

export type PlannedRoadOwnershipStatus =
  | "confirmed_public"
  | "mixed_public"
  | "cadastre_public"
  | "city_gis_public"
  | "not_confirmed_public"
  | "unresolved"
  | "no_data";

export type PlannedRoadOwnershipEvidence =
  | "land_register"
  | "cadastre"
  | "city_gis"
  | "none";

export interface PlannedRoadParcelProperties {
  parcel_id: string;
  parcel_number: string;
  cadastral_municipality: string;
  parcel_area_m2: number;
  mapped_area_m2: number;
  road_overlap_m2: number;
  road_overlap_percent: number;
  ownership_status: PlannedRoadOwnershipStatus;
  ownership_evidence: PlannedRoadOwnershipEvidence;
  public_entities: SanitizedPublicEntity[];
  has_evidence_conflict: boolean;
  secondary_evidence_labels: string[];
  source_updated_at: string;
  ownership_checked_at: string | null;
}

export interface PlannedRoadParcelFilters {
  statuses: PlannedRoadOwnershipStatus[];
}

export interface PlannedRoadOwnershipResult {
  ownership_status: PlannedRoadOwnershipStatus;
  ownership_evidence: PlannedRoadOwnershipEvidence;
  public_entities: SanitizedPublicEntity[];
  has_evidence_conflict: boolean;
  secondary_evidence_labels: string[];
  ownership_checked_at: string | null;
}

export interface PlannedRoadParcelSummary {
  count: number;
  road_overlap_m2: number;
}

export const PLANNED_ROAD_OWNERSHIP_STATUS_LABELS: Record<PlannedRoadOwnershipStatus, string> = {
  confirmed_public: "Potvrđeno javno — ZK",
  mixed_public: "Mješovito vlasništvo",
  cadastre_public: "Javno prema katastru",
  city_gis_public: "Javno prema GIS-u Grada",
  not_confirmed_public: "Nije potvrđeno javno",
  unresolved: "Neriješeno",
  no_data: "Nema raspoloživog podatka",
};

export const PLANNED_ROAD_OWNERSHIP_EVIDENCE_LABELS: Record<PlannedRoadOwnershipEvidence, string> = {
  land_register: "zemljišna knjiga — list B",
  cadastre: "katastarski posjednik — slabiji dokaz",
  city_gis: "GIS Grada",
  none: "nema razrješivog zapisa",
};

export function plannedRoadOwnershipStatusTone(
  status: PlannedRoadOwnershipStatus,
): "neutral" | "evidence" {
  return status === "no_data" ? "neutral" : "evidence";
}

const ALLOWED_KEYS = new Set<keyof PlannedRoadParcelProperties>([
  "parcel_id",
  "parcel_number",
  "cadastral_municipality",
  "parcel_area_m2",
  "mapped_area_m2",
  "road_overlap_m2",
  "road_overlap_percent",
  "ownership_status",
  "ownership_evidence",
  "public_entities",
  "has_evidence_conflict",
  "secondary_evidence_labels",
  "source_updated_at",
  "ownership_checked_at",
]);
const ENTITY_KEYS = new Set<keyof SanitizedPublicEntity>(["id", "label", "category"]);
const STATUS_SET = new Set<PlannedRoadOwnershipStatus>(Object.keys(PLANNED_ROAD_OWNERSHIP_STATUS_LABELS) as PlannedRoadOwnershipStatus[]);
const EVIDENCE_SET = new Set<PlannedRoadOwnershipEvidence>(Object.keys(PLANNED_ROAD_OWNERSHIP_EVIDENCE_LABELS) as PlannedRoadOwnershipEvidence[]);
const ENTITY_CATEGORY_SET = new Set<SanitizedPublicEntity["category"]>([
  "city",
  "state",
  "county",
  "municipal_company",
  "public_institution",
  "other_public",
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OIB_LIKE = /(?:^|\D)\d{11}(?:\D|$)/;

function requireSafeString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0)
    throw new Error(`${key} mora biti neprazan string`);
  if (OIB_LIKE.test(value)) throw new Error(`${key} ne smije sadržavati OIB`);
  return value;
}

function requireNonNegativeNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`${key} mora biti konačan nenegativan broj`);
  return value;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function requireIsoDate(record: Record<string, unknown>, key: string, nullable = false): void {
  const value = record[key];
  if (nullable && value === null) return;
  if (typeof value !== "string" || !isIsoDate(value))
    throw new Error(`${key} mora biti ISO datum${nullable ? " ili null" : ""}`);
}

function validatePublicEntity(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("javni subjekt mora biti objekt");
  const entity = value as Record<string, unknown>;
  for (const key of Object.keys(entity))
    if (!ENTITY_KEYS.has(key as keyof SanitizedPublicEntity))
      throw new Error("javni subjekt sadrži nedopušteno polje");
  for (const key of ENTITY_KEYS)
    if (!(key in entity)) throw new Error(`javnom subjektu nedostaje ${key}`);
  requireSafeString(entity, "id");
  requireSafeString(entity, "label");
  if (!ENTITY_CATEGORY_SET.has(entity.category as SanitizedPublicEntity["category"]))
    throw new Error("kategorija javnog subjekta nije dopuštena");
}

/** Validates the closed, privacy-safe browser payload for planned-road parcels. */
export function validatePlannedRoadParcelProperties(
  value: unknown,
): asserts value is PlannedRoadParcelProperties {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("svojstva čestice planirane ceste moraju biti objekt");
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record))
    if (!ALLOWED_KEYS.has(key as keyof PlannedRoadParcelProperties))
      throw new Error(`nedopušteno polje: ${key}`);
  for (const key of ALLOWED_KEYS)
    if (!(key in record)) throw new Error(`nedostaje polje: ${key}`);

  requireSafeString(record, "parcel_id");
  requireSafeString(record, "parcel_number");
  requireSafeString(record, "cadastral_municipality");
  requireNonNegativeNumber(record, "parcel_area_m2");
  requireNonNegativeNumber(record, "mapped_area_m2");
  requireNonNegativeNumber(record, "road_overlap_m2");
  const overlapPercent = requireNonNegativeNumber(record, "road_overlap_percent");
  if (overlapPercent > 100) throw new Error("road_overlap_percent mora biti između 0 i 100");
  if (!STATUS_SET.has(record.ownership_status as PlannedRoadOwnershipStatus))
    throw new Error("ownership_status nije dopušten");
  if (!EVIDENCE_SET.has(record.ownership_evidence as PlannedRoadOwnershipEvidence))
    throw new Error("ownership_evidence nije dopušten");
  if (!Array.isArray(record.public_entities)) throw new Error("public_entities mora biti polje");
  for (const entity of record.public_entities) validatePublicEntity(entity);
  if (typeof record.has_evidence_conflict !== "boolean")
    throw new Error("has_evidence_conflict mora biti boolean");
  if (!Array.isArray(record.secondary_evidence_labels))
    throw new Error("secondary_evidence_labels mora biti polje");
  for (const label of record.secondary_evidence_labels) {
    if (typeof label !== "string" || label.trim().length === 0)
      throw new Error("secondary_evidence_labels mora sadržavati neprazne stringove");
    if (OIB_LIKE.test(label)) throw new Error("secondary_evidence_labels ne smije sadržavati OIB");
  }
  requireIsoDate(record, "source_updated_at");
  requireIsoDate(record, "ownership_checked_at", true);
}

function gisEntity(cityGis: PublicParcelProperties): SanitizedPublicEntity {
  return {
    id: `city-gis-${cityGis.public_level}`,
    label: PUBLIC_LEVEL_LABELS[cityGis.public_level],
    category: cityGis.public_level,
  };
}

function gisLabel(cityGis: PublicParcelProperties): string {
  const ownershipForm = OWNERSHIP_FORM_LABELS[cityGis.ownership_form];
  return `GIS Grada: ${PUBLIC_LEVEL_LABELS[cityGis.public_level]} · ${ownershipForm.charAt(0).toLowerCase()}${ownershipForm.slice(1)}`;
}

function targetedPublicLevels(targeted: TargetedOwnershipProperties): PublicLevel[] {
  return targeted.public_entities
    .map((entity) => entity.category)
    .filter((category): category is PublicLevel => category === "city" || category === "state" || category === "county");
}

function conflictsWithGis(targeted: TargetedOwnershipProperties, cityGis: PublicParcelProperties): boolean {
  if (targeted.verification_status === "private_or_other") return true;
  if (targeted.verification_status === "mixed_public") return true;
  const levels = targetedPublicLevels(targeted);
  return levels.length > 0 && !levels.includes(cityGis.public_level);
}

function hasLandRegisterEvidence(targeted: TargetedOwnershipProperties): boolean {
  return targeted.evidence_source === "land_register" && (
    targeted.verification_status === "confirmed_public" ||
    targeted.verification_status === "mixed_public" ||
    targeted.verification_status === "private_or_other"
  );
}

function hasCadastreEvidence(targeted: TargetedOwnershipProperties): boolean {
  return targeted.evidence_source === "cadastre" && targeted.verification_status === "cadastre_public";
}

/** Resolves targeted evidence first, retaining lower-ranked GIS evidence as a visible secondary fact. */
export function resolvePlannedRoadOwnership(
  targeted: TargetedOwnershipProperties | null,
  cityGis: PublicParcelProperties | null,
): PlannedRoadOwnershipResult {
  if (targeted && hasLandRegisterEvidence(targeted)) {
    const status: PlannedRoadOwnershipStatus = targeted.verification_status === "private_or_other"
      ? "not_confirmed_public"
      : targeted.verification_status;
    return {
      ownership_status: status,
      ownership_evidence: "land_register",
      public_entities: targeted.public_entities,
      has_evidence_conflict: cityGis ? conflictsWithGis(targeted, cityGis) : false,
      secondary_evidence_labels: cityGis ? [gisLabel(cityGis)] : [],
      ownership_checked_at: targeted.verified_at,
    };
  }

  if (targeted && hasCadastreEvidence(targeted)) {
    return {
      ownership_status: "cadastre_public",
      ownership_evidence: "cadastre",
      public_entities: targeted.public_entities,
      has_evidence_conflict: cityGis ? conflictsWithGis(targeted, cityGis) : false,
      secondary_evidence_labels: cityGis ? [gisLabel(cityGis)] : [],
      ownership_checked_at: targeted.verified_at,
    };
  }

  if (cityGis) {
    return {
      ownership_status: "city_gis_public",
      ownership_evidence: "city_gis",
      public_entities: [gisEntity(cityGis)],
      has_evidence_conflict: false,
      secondary_evidence_labels: targeted && !hasLandRegisterEvidence(targeted) && !hasCadastreEvidence(targeted)
        ? ["Ciljana provjera nije razriješena"]
        : [],
      ownership_checked_at: targeted?.verified_at ?? null,
    };
  }

  if (targeted) {
    return {
      ownership_status: "unresolved",
      ownership_evidence: "none",
      public_entities: [],
      has_evidence_conflict: false,
      secondary_evidence_labels: [],
      ownership_checked_at: targeted.verified_at,
    };
  }

  return {
    ownership_status: "no_data",
    ownership_evidence: "none",
    public_entities: [],
    has_evidence_conflict: false,
    secondary_evidence_labels: [],
    ownership_checked_at: null,
  };
}

export function matchesPlannedRoadParcel(
  properties: PlannedRoadParcelProperties,
  filters: PlannedRoadParcelFilters,
): boolean {
  return filters.statuses.length === 0 || filters.statuses.includes(properties.ownership_status);
}

export function summarizePlannedRoadParcels(
  features: ReadonlyArray<Feature<Geometry, PlannedRoadParcelProperties>>,
  filters: PlannedRoadParcelFilters,
): PlannedRoadParcelSummary {
  let count = 0;
  let road_overlap_m2 = 0;
  for (const feature of features) {
    if (!matchesPlannedRoadParcel(feature.properties, filters)) continue;
    count += 1;
    road_overlap_m2 += feature.properties.road_overlap_m2;
  }
  return { count, road_overlap_m2: Math.round(road_overlap_m2) };
}

export function plannedRoadParcelDossierFacts(
  properties: PlannedRoadParcelProperties,
): string[] {
  const percentage = properties.road_overlap_percent.toFixed(1).replace(".", ",");
  const facts = [
    `Planirana cesta zahvaća ${Math.round(properties.road_overlap_m2)} m² · ${percentage} % čestice`,
    `Vlasništvo: ${PLANNED_ROAD_OWNERSHIP_STATUS_LABELS[properties.ownership_status].toLowerCase()}`,
  ];
  const entities = properties.public_entities.map((entity) => entity.label).join(", ");
  if (entities) facts.push(`Javni subjekt: ${entities}`);
  return facts;
}
