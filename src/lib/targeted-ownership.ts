import type { Feature, Geometry } from "geojson";

export type OwnershipVerificationStatus =
  | "confirmed_public"
  | "mixed_public"
  | "cadastre_public"
  | "private_or_other"
  | "unresolved";

export type OwnershipEvidenceSource = "land_register" | "cadastre" | "none";
export type OwnershipCohort = "road_corridor" | "large_parcel";
export type PublicEntityCategory =
  | "city"
  | "state"
  | "county"
  | "municipal_company"
  | "public_institution"
  | "other_public";

export interface SanitizedPublicEntity {
  id: string;
  label: string;
  category: PublicEntityCategory;
}

export interface TargetedOwnershipProperties {
  parcel_id: string;
  parcel_number: string;
  cadastral_municipality: string;
  cohorts: OwnershipCohort[];
  verification_status: OwnershipVerificationStatus;
  evidence_source: OwnershipEvidenceSource;
  public_entities: SanitizedPublicEntity[];
  purpose_primary_code: string | null;
  purpose_primary_label: string | null;
  built: boolean;
  parcel_area_m2: number;
  mapped_area_m2: number;
  verified_at: string | null;
  source_updated_at: string;
}

export interface TargetedOwnershipFilters {
  statuses: OwnershipVerificationStatus[];
  entityCategories: PublicEntityCategory[];
  cohorts: OwnershipCohort[];
  purposes: string[];
  built: "all" | "with_footprint" | "without_footprint";
}

export interface TargetedOwnershipSummary {
  count: number;
  mapped_area_m2: number;
}

export const OWNERSHIP_STATUS_LABELS: Record<OwnershipVerificationStatus, string> = {
  confirmed_public: "Potvrđeno javno — ZK",
  mixed_public: "Mješovito vlasništvo",
  cadastre_public: "Javno prema katastru",
  private_or_other: "Nije potvrđeno javno",
  unresolved: "Neriješeno",
};

export const OWNERSHIP_EVIDENCE_LABELS: Record<OwnershipEvidenceSource, string> = {
  land_register: "zemljišna knjiga — list B",
  cadastre: "katastarski posjednik — slabiji dokaz",
  none: "nema razrješivog zapisa",
};

export const OWNERSHIP_COHORT_LABELS: Record<OwnershipCohort, string> = {
  road_corridor: "Koridor planirane ceste",
  large_parcel: "Velika čestica (≥10.000 m²)",
};

export const PUBLIC_ENTITY_CATEGORY_LABELS: Record<PublicEntityCategory, string> = {
  city: "Grad / JLS",
  state: "Republika Hrvatska",
  county: "Županija",
  municipal_company: "Gradsko društvo",
  public_institution: "Javna ustanova",
  other_public: "Drugi javni subjekt",
};

const ALLOWED_KEYS = new Set<keyof TargetedOwnershipProperties>([
  "parcel_id",
  "parcel_number",
  "cadastral_municipality",
  "cohorts",
  "verification_status",
  "evidence_source",
  "public_entities",
  "purpose_primary_code",
  "purpose_primary_label",
  "built",
  "parcel_area_m2",
  "mapped_area_m2",
  "verified_at",
  "source_updated_at",
]);
const ENTITY_KEYS = new Set<keyof SanitizedPublicEntity>(["id", "label", "category"]);
const STATUSES = new Set<OwnershipVerificationStatus>(Object.keys(OWNERSHIP_STATUS_LABELS) as OwnershipVerificationStatus[]);
const SOURCES = new Set<OwnershipEvidenceSource>(Object.keys(OWNERSHIP_EVIDENCE_LABELS) as OwnershipEvidenceSource[]);
const COHORTS = new Set<OwnershipCohort>(Object.keys(OWNERSHIP_COHORT_LABELS) as OwnershipCohort[]);
const CATEGORIES = new Set<PublicEntityCategory>(Object.keys(PUBLIC_ENTITY_CATEGORY_LABELS) as PublicEntityCategory[]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OIB_LIKE = /(?:^|\D)\d{11}(?:\D|$)/;

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0)
    throw new Error(`${key} mora biti neprazan string`);
  if (OIB_LIKE.test(value)) throw new Error(`${key} ne smije sadržavati OIB`);
  return value;
}

function requirePositiveNumber(record: Record<string, unknown>, key: string): void {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`${key} mora biti pozitivan broj`);
}

export function validateTargetedOwnershipProperties(
  value: unknown,
): asserts value is TargetedOwnershipProperties {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("svojstva ciljane provjere moraju biti objekt");
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record))
    if (!ALLOWED_KEYS.has(key as keyof TargetedOwnershipProperties))
      throw new Error(`nedopušteno polje: ${key}`);
  for (const key of ALLOWED_KEYS)
    if (!(key in record)) throw new Error(`nedostaje polje: ${key}`);

  requireString(record, "parcel_id");
  requireString(record, "parcel_number");
  requireString(record, "cadastral_municipality");
  if (!Array.isArray(record.cohorts) || record.cohorts.length === 0)
    throw new Error("cohorts mora sadržavati barem jednu skupinu");
  if (!record.cohorts.every((cohort) => COHORTS.has(cohort as OwnershipCohort)))
    throw new Error("cohorts sadrži nedopuštenu skupinu");
  if (!STATUSES.has(record.verification_status as OwnershipVerificationStatus))
    throw new Error("verification_status nije dopušten");
  if (!SOURCES.has(record.evidence_source as OwnershipEvidenceSource))
    throw new Error("evidence_source nije dopušten");

  if (!Array.isArray(record.public_entities))
    throw new Error("public_entities mora biti polje");
  for (const candidate of record.public_entities) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      throw new Error("javni subjekt mora biti objekt");
    const entity = candidate as Record<string, unknown>;
    if (Object.keys(entity).some((key) => !ENTITY_KEYS.has(key as keyof SanitizedPublicEntity)))
      throw new Error("javni subjekt sadrži nedopušteno polje");
    for (const key of ENTITY_KEYS)
      if (!(key in entity)) throw new Error(`javnom subjektu nedostaje ${key}`);
    requireString(entity, "id");
    requireString(entity, "label");
    if (!CATEGORIES.has(entity.category as PublicEntityCategory))
      throw new Error("kategorija javnog subjekta nije dopuštena");
  }

  if (record.purpose_primary_code !== null && typeof record.purpose_primary_code !== "string")
    throw new Error("purpose_primary_code mora biti string ili null");
  if (record.purpose_primary_label !== null && typeof record.purpose_primary_label !== "string")
    throw new Error("purpose_primary_label mora biti string ili null");
  if (typeof record.built !== "boolean") throw new Error("built mora biti boolean");
  requirePositiveNumber(record, "parcel_area_m2");
  requirePositiveNumber(record, "mapped_area_m2");
  if (record.verified_at !== null && (typeof record.verified_at !== "string" || !ISO_DATE.test(record.verified_at)))
    throw new Error("verified_at mora biti ISO datum ili null");
  if (typeof record.source_updated_at !== "string" || !ISO_DATE.test(record.source_updated_at))
    throw new Error("source_updated_at mora biti ISO datum");

  const hasPublic = record.public_entities.length > 0;
  if (["confirmed_public", "mixed_public", "cadastre_public"].includes(String(record.verification_status)) && !hasPublic)
    throw new Error("javni status mora imenovati barem jedan javni subjekt");
  if (["private_or_other", "unresolved"].includes(String(record.verification_status)) && hasPublic)
    throw new Error("nejavni ili neriješeni status ne smije imenovati javni subjekt");
}

export function matchesTargetedOwnership(
  properties: TargetedOwnershipProperties,
  filters: TargetedOwnershipFilters,
): boolean {
  if (filters.statuses.length > 0 && !filters.statuses.includes(properties.verification_status)) return false;
  if (
    filters.entityCategories.length > 0 &&
    !properties.public_entities.some((entity) => filters.entityCategories.includes(entity.category))
  ) return false;
  if (filters.cohorts.length > 0 && !properties.cohorts.some((cohort) => filters.cohorts.includes(cohort))) return false;
  const purpose = properties.purpose_primary_code ?? "unknown";
  if (filters.purposes.length > 0 && !filters.purposes.includes(purpose)) return false;
  if (filters.built === "with_footprint" && !properties.built) return false;
  if (filters.built === "without_footprint" && properties.built) return false;
  return true;
}

export function summarizeTargetedOwnership(
  features: ReadonlyArray<Feature<Geometry, TargetedOwnershipProperties>>,
  filters: TargetedOwnershipFilters,
): TargetedOwnershipSummary {
  let count = 0;
  let mapped_area_m2 = 0;
  for (const feature of features) {
    if (!matchesTargetedOwnership(feature.properties, filters)) continue;
    count += 1;
    mapped_area_m2 += feature.properties.mapped_area_m2;
  }
  return { count, mapped_area_m2: Math.round(mapped_area_m2) };
}

export function targetedOwnershipDossierFacts(
  properties: TargetedOwnershipProperties,
): string[] {
  const entities = properties.public_entities.map((entity) => entity.label).join(", ");
  const facts = [`Dokaz: ${OWNERSHIP_EVIDENCE_LABELS[properties.evidence_source]}`];
  if (entities) facts.push(`Javni subjekt: ${entities}`);
  facts.push(`Skup: ${properties.cohorts.map((cohort) => OWNERSHIP_COHORT_LABELS[cohort]).join(" · ")}`);
  return facts;
}
