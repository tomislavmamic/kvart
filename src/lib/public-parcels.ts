import type { Feature, Geometry } from "geojson";

export type PublicLevel = "city" | "state" | "county";
export type OwnershipForm = "ownership" | "coownership" | "unknown";
export type BuiltFilter = "all" | "with_footprint" | "without_footprint";

export interface PublicParcelProperties {
  parcel_id: string;
  parcel_number: string;
  cadastral_municipality: string;
  public_level: PublicLevel;
  ownership_form: OwnershipForm;
  purpose_primary_code: string | null;
  purpose_primary_label: string | null;
  built: boolean;
  area_m2: number;
  source_updated_at: string;
  generated_at: string;
}

export interface PublicParcelFilters {
  /** Prazno znači sve javne razine. */
  levels: PublicLevel[];
  /** Prazno znači sve namjene; `unknown` je izričita nepoznata namjena. */
  purposes: string[];
  built: BuiltFilter;
}

export interface PublicParcelSummary {
  count: number;
  area_m2: number;
}

export const PUBLIC_LEVEL_LABELS: Record<PublicLevel, string> = {
  city: "Grad / JLS",
  state: "Republika Hrvatska",
  county: "Županija",
};

export const OWNERSHIP_FORM_LABELS: Record<OwnershipForm, string> = {
  ownership: "Vlasništvo",
  coownership: "Suvlasništvo",
  unknown: "Oblik upisa nije naveden",
};

const ALLOWED_KEYS = new Set<keyof PublicParcelProperties>([
  "parcel_id",
  "parcel_number",
  "cadastral_municipality",
  "public_level",
  "ownership_form",
  "purpose_primary_code",
  "purpose_primary_label",
  "built",
  "area_m2",
  "source_updated_at",
  "generated_at",
]);

const LEVELS = new Set<PublicLevel>(["city", "state", "county"]);
const FORMS = new Set<OwnershipForm>(["ownership", "coownership", "unknown"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Javni artefakt ima zatvorenu shemu: novo izvorno polje ne prolazi
 * slučajno, nego generator mora izrijekom odlučiti je li ga sigurno objaviti.
 */
export function validatePublicParcelProperties(
  value: unknown,
): asserts value is PublicParcelProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("svojstva javne čestice moraju biti objekt");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key as keyof PublicParcelProperties)) {
      throw new Error(`nedopušteno polje: ${key}`);
    }
  }
  for (const key of ALLOWED_KEYS) {
    if (!(key in record)) throw new Error(`nedostaje polje: ${key}`);
  }
  if (typeof record.parcel_id !== "string" || record.parcel_id.length === 0)
    throw new Error("parcel_id mora biti neprazan string");
  if (typeof record.parcel_number !== "string" || record.parcel_number.length === 0)
    throw new Error("parcel_number mora biti neprazan string");
  if (
    typeof record.cadastral_municipality !== "string" ||
    record.cadastral_municipality.length === 0
  )
    throw new Error("cadastral_municipality mora biti neprazan string");
  if (!LEVELS.has(record.public_level as PublicLevel))
    throw new Error("public_level nije dopušten");
  if (!FORMS.has(record.ownership_form as OwnershipForm))
    throw new Error("ownership_form nije dopušten");
  if (
    record.purpose_primary_code !== null &&
    typeof record.purpose_primary_code !== "string"
  )
    throw new Error("purpose_primary_code mora biti string ili null");
  if (
    record.purpose_primary_label !== null &&
    typeof record.purpose_primary_label !== "string"
  )
    throw new Error("purpose_primary_label mora biti string ili null");
  if (typeof record.built !== "boolean") throw new Error("built mora biti boolean");
  if (
    typeof record.area_m2 !== "number" ||
    !Number.isFinite(record.area_m2) ||
    record.area_m2 <= 0
  )
    throw new Error("area_m2 mora biti pozitivan broj");
  if (typeof record.source_updated_at !== "string" || !ISO_DATE.test(record.source_updated_at))
    throw new Error("source_updated_at mora biti ISO datum");
  if (typeof record.generated_at !== "string" || !ISO_DATE.test(record.generated_at))
    throw new Error("generated_at mora biti ISO datum");
}

export function matchesPublicParcel(
  properties: PublicParcelProperties,
  filters: PublicParcelFilters,
): boolean {
  if (filters.levels.length > 0 && !filters.levels.includes(properties.public_level)) {
    return false;
  }
  const purpose = properties.purpose_primary_code ?? "unknown";
  if (filters.purposes.length > 0 && !filters.purposes.includes(purpose)) {
    return false;
  }
  if (filters.built === "with_footprint" && !properties.built) return false;
  if (filters.built === "without_footprint" && properties.built) return false;
  return true;
}

export function summarizePublicParcels(
  features: ReadonlyArray<Feature<Geometry, PublicParcelProperties>>,
  filters: PublicParcelFilters,
): PublicParcelSummary {
  let count = 0;
  let area_m2 = 0;
  for (const feature of features) {
    if (!matchesPublicParcel(feature.properties, filters)) continue;
    count += 1;
    area_m2 += feature.properties.area_m2;
  }
  return { count, area_m2: Math.round(area_m2) };
}

/** Tri kratke dokazne rečenice koje dijele vidljivi dosje i njegovi testovi. */
export function publicParcelDossierFacts(
  properties: PublicParcelProperties,
): [string, string, string] {
  const purpose = properties.purpose_primary_code
    ? `Pretežita namjena čestice: ${properties.purpose_primary_code} — ${properties.purpose_primary_label ?? properties.purpose_primary_code} · GUP 2024. (nacrt)`
    : "Pretežita namjena čestice nije određena · GUP 2024. (nacrt)";
  return [
    `Javni status: ${PUBLIC_LEVEL_LABELS[properties.public_level]} · ${OWNERSHIP_FORM_LABELS[properties.ownership_form]}`,
    purpose,
    properties.built
      ? "Tlocrt: evidentiran preklop ≥1 m² u korištenim slojevima"
      : "Tlocrt: nije evidentiran preklop ≥1 m² u korištenim slojevima",
  ];
}
