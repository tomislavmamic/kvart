/**
 * Fresh, bounded ownership lookup for road-project parcels.
 * Run: npx tsx scripts/verify-bilice-ownership.ts --targets /path/targets.json
 * Input: { targets: [{ municipality: "SPLIT", parcelNumber: "...", point: [lon, lat] }] }
 * All output stays in ignored .cache/bilice-ownership, never in public/.
 * An equal cadastral / land-register number is deliberately NOT a linkage.
 */
import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import proj4 from "proj4";

type RecordValue = Record<string, unknown>;
interface Target {
  municipality: string;
  parcelNumber: string;
  point: [number, number];
}
interface RegistryEntity {
  id: string;
  label: string;
  aliases: string[];
  category: string;
}
interface Owner {
  name: string;
  share: string | null;
  publicEntity: { id: string; label: string; category: string } | null;
}
type Status = "owners_verified" | "shares_need_review" | "missing_land_register_link" |
  "land_register_needs_review" | "parcel_not_matched" | "request_failed";
interface ReviewRow {
  parcelNumber: string;
  municipality: string;
  status: Status;
  checkedAt: string;
  ownerEvidenceAt: string | null;
  reason: string;
  sources: { cadastre: string | null; landRegister: string | null };
  owners: Owner[];
}

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".cache", "bilice-ownership");
const ORIGIN = "https://oss.uredjenazemlja.hr";
const CONFIG = `${ORIGIN}/oss/public/gis/map-config`;
const API_PATH = "/oss/public/";
proj4.defs("EPSG:3765", "+proj=tmerc +lat_0=0 +lon_0=16.5 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs");

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : null;
}
function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}
function parcelNumber(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "");
}
function safeName(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || /\d{11}/.test(value)) return null;
  return value.trim();
}
function publicEntity(name: string, registry: RegistryEntity[]): Owner["publicEntity"] {
  const found = registry.find((entity) => [entity.label, ...entity.aliases]
    .some((candidate) => normalize(candidate) === normalize(name)));
  return found ? { id: found.id, label: found.label, category: found.category } : null;
}

/** Unknown share schemas remain unresolved; a missing share never becomes 1/1. */
export function readShare(value: RecordValue): string | null {
  for (const key of ["share", "shareAmount", "shareValue", "fraction", "shareDescription"]) {
    const candidate = value[key];
    if (typeof candidate !== "string") continue;
    const match = candidate.trim().match(/^(?:Suvlasnički dio:\s*)?(\d+)\s*\/\s*(\d+)$/i);
    if (match && Number(match[2]) > 0) return `${match[1]}/${match[2]}`;
  }
  return null;
}

export function extractOwners(body: unknown, registry: RegistryEntity[]): Owner[] | null {
  if (!Array.isArray(body) || body.length !== 1) return null;
  const unit = record(body[0]);
  const sheet = record(unit?.ownershipSheetB);
  if (!Array.isArray(sheet?.lrUnitShares) || sheet.lrUnitShares.length === 0) return null;
  const result: Owner[] = [];
  for (const candidate of sheet.lrUnitShares) {
    const share = record(candidate);
    if (!share || !Array.isArray(share.lrOwners) || share.lrOwners.length === 0) return null;
    // More than one person within a share does not imply equal person-level shares.
    const amount = share.lrOwners.length === 1 ? readShare(share) : null;
    for (const entry of share.lrOwners) {
      const name = safeName(record(entry)?.name);
      if (!name) return null;
      result.push({ name, share: amount, publicEntity: publicEntity(name, registry) });
    }
  }
  return result;
}

function validateTargets(value: unknown): Target[] {
  const targets = record(value)?.targets;
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 30)
    throw new Error("Expected 1–30 explicitly selected targets.");
  const seen = new Set<string>();
  return targets.map((candidate) => {
    const item = record(candidate);
    if (!item || typeof item.municipality !== "string" || typeof item.parcelNumber !== "string" ||
      !/^\d+(?:\/\d+)?$/.test(item.parcelNumber) || !Array.isArray(item.point) || item.point.length !== 2 ||
      !item.point.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)))
      throw new Error("Invalid target; expected municipality, parcelNumber, point [lon, lat].");
    const [lon, lat] = item.point as [number, number];
    if (normalize(item.municipality) !== "SPLIT" || lon < 16.47 || lon > 16.52 || lat < 43.51 || lat > 43.55)
      throw new Error("Target is outside the bounded Split / Bilice project area.");
    const key = `${normalize(item.municipality)}:${item.parcelNumber}`;
    if (seen.has(key)) throw new Error("Duplicate target.");
    seen.add(key);
    return { municipality: item.municipality, parcelNumber: item.parcelNumber, point: [lon, lat] };
  });
}

async function privateWrite(file: string, value: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(file), 0o700);
  await writeFile(file, value, { encoding: "utf8", mode: 0o600 });
  await chmod(file, 0o600);
}
async function jsonFile(file: string, value: unknown): Promise<void> {
  await privateWrite(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function fetchJson(url: URL | string): Promise<unknown> {
  const parsed = new URL(url);
  const permitted = (parsed.origin === ORIGIN && parsed.pathname.startsWith(API_PATH)) ||
    (parsed.hostname === "wms1-gs-oss.uredjenazemlja.hr" && parsed.pathname === "/ows2-m/wms");
  if (parsed.protocol !== "https:" || !permitted) throw new Error("Unapproved source origin.");
  const response = await fetch(parsed, { signal: AbortSignal.timeout(20_000), redirect: "error",
    headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Official service returned HTTP ${response.status}.`);
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("json"))
    throw new Error("Official service did not return JSON; manual public-site review required.");
  return response.json();
}

async function wmsUrl(): Promise<URL> {
  const config = record(await fetchJson(CONFIG));
  const layers = Array.isArray(config?.layers) ? config.layers : [];
  const layer = layers.map(record).find((candidate) => candidate?.name === "DKP_CESTICE");
  const url = record(layer?.wmsService)?.url;
  if (typeof url !== "string") throw new Error("Official map configuration lacks cadastral WMS.");
  return new URL(url); // The public map token is used privately and never printed.
}

async function retrieve(target: Target, wms: URL, rawDir: string, registry: RegistryEntity[]): Promise<ReviewRow> {
  const checkedAt = new Date().toISOString();
  const row: ReviewRow = { parcelNumber: target.parcelNumber, municipality: target.municipality,
    status: "parcel_not_matched", checkedAt, ownerEvidenceAt: null,
    reason: "Nije potvrđeno podudaranje ciljne čestice u živom katastru.",
    sources: { cadastre: null, landRegister: null }, owners: [] };
  const raw: RecordValue = { target, checkedAt };
  try {
    const [x, y] = proj4("EPSG:4326", "EPSG:3765", target.point);
    const gfiUrl = new URL(wms);
    const parameters = { SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetFeatureInfo",
      FORMAT: "image/png", TRANSPARENT: "true", QUERY_LAYERS: "oss:BZP_CESTICE",
      LAYERS: "oss:BZP_CESTICE", STYLES: "jis_cestice_kathr", INFO_FORMAT: "application/json",
      I: "50", J: "50", CRS: "EPSG:3765", WIDTH: "101", HEIGHT: "101",
      BBOX: [x - 15, y - 15, x + 15, y + 15].join(","), FEATURE_COUNT: "5" };
    Object.entries(parameters).forEach(([key, value]) => gfiUrl.searchParams.set(key, value));
    const gfi = record(await fetchJson(gfiUrl));
    raw.gfi = gfi;
    const matches = (Array.isArray(gfi?.features) ? gfi.features : []).map(record)
      .map((feature) => record(feature?.properties))
      .filter((properties) => properties?.CESTICA_ID &&
        parcelNumber(properties.BROJ_CESTICE ?? properties.BROJ) === target.parcelNumber);
    if (matches.length !== 1) return row;
    const cadastreUrl = new URL(`${ORIGIN}/oss/public/cad/parcel-info`);
    cadastreUrl.searchParams.set("parcelId", String(matches[0]!.CESTICA_ID));
    const parcel = record(await fetchJson(cadastreUrl));
    raw.parcelInfo = parcel;
    row.sources.cadastre = cadastreUrl.toString();
    if (!parcel || parcelNumber(parcel.parcelNumber) !== target.parcelNumber ||
      normalize(String(parcel.cadMunicipalityName ?? "")) !== normalize(target.municipality)) return row;
    // A direct reference is the official cadastre-to-register correspondence.
    // Never look up the cadastral number in a different numbering system as a fallback.
    const reference = record(parcel.lrUnit);
    if (!reference || reference.lrUnitNumber == null || reference.mainBookId == null) {
      row.status = "missing_land_register_link";
      row.reason = "Živi katastar potvrđuje česticu, ali nema izravnu vezu na ZK uložak. Posjednici nisu navedeni kao vlasnici. Potrebna je službena identifikacija katastarske i ZK čestice.";
      return row;
    }
    const lrUrl = new URL(`${ORIGIN}/oss/public/lr/lr-unit`);
    lrUrl.searchParams.set("lrUnitNumber", String(reference.lrUnitNumber));
    lrUrl.searchParams.set("mainBookId", String(reference.mainBookId));
    lrUrl.searchParams.set("historicalOverview", "false");
    const landRegister = await fetchJson(lrUrl);
    raw.landRegister = landRegister;
    row.sources.landRegister = lrUrl.toString();
    const unit = Array.isArray(landRegister) && landRegister.length === 1 ? record(landRegister[0]) : null;
    if (!unit || (unit.lrUnitNumber != null && String(unit.lrUnitNumber) !== String(reference.lrUnitNumber)) ||
      (unit.mainBookId != null && String(unit.mainBookId) !== String(reference.mainBookId))) {
      row.status = "land_register_needs_review";
      row.reason = "Odgovor zemljišne knjige nije jednoznačno podudaran sa službenom katastarskom vezom.";
      return row;
    }
    const owners = extractOwners(landRegister, registry);
    if (!owners?.length) {
      row.status = "land_register_needs_review";
      row.reason = "List B nije moguće sigurno protumačiti; potreban je pregled službenog izvatka.";
      return row;
    }
    row.owners = owners;
    row.ownerEvidenceAt = new Date().toISOString();
    row.status = owners.every((owner) => owner.share !== null) ? "owners_verified" : "shares_need_review";
    row.reason = row.status === "owners_verified"
      ? "Vlasnici i udjeli očitani iz aktualnog lista B, povezanog službenom katastarskom referencom."
      : "Vlasnici očitani iz aktualnog lista B; format ili zajednički udio zahtijeva ručni pregled. Udio nije pretpostavljen.";
    return row;
  } catch (error) {
    row.status = "request_failed";
    row.reason = error instanceof Error && /^(Official|Unapproved)/.test(error.message)
      ? error.message : "Dohvat službenog servisa nije uspio; detalji ostaju u lokalnom pregledu.";
    return row;
  } finally {
    const filename = `${normalize(target.municipality)}_${target.parcelNumber.replace(/\//g, "_")}.json`;
    await jsonFile(path.join(rawDir, filename), raw);
  }
}

export function sanitizeReview(row: ReviewRow) {
  return { parcelNumber: row.parcelNumber, municipality: row.municipality, status: row.status,
    checkedAt: row.checkedAt, ownerEvidenceAt: row.ownerEvidenceAt, reason: row.reason,
    sources: row.sources, ownerCount: row.ownerEvidenceAt ? row.owners.length : null,
    otherOwnerCount: row.ownerEvidenceAt ? row.owners.filter((owner) => !owner.publicEntity).length : null,
    publicOwners: row.owners.flatMap((owner) => owner.publicEntity
      ? [{ name: owner.publicEntity.label, category: owner.publicEntity.category, share: owner.share }] : []) };
}
function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
function reviewHtml(rows: ReviewRow[], generatedAt: string): string {
  const body = rows.map((row) => `<tr><td>${htmlEscape(row.municipality)} ${htmlEscape(row.parcelNumber)}</td>` +
    `<td>${row.owners.length ? row.owners.map((owner) => `${htmlEscape(owner.name)} — ${htmlEscape(owner.share ?? "udio za pregled")}`).join("<br>") : "Vlasnik nije utvrđen"}</td>` +
    `<td>${htmlEscape(row.reason)}</td><td>${Object.entries(row.sources).flatMap(([type, url]) => url ? [`<a href="${htmlEscape(url)}" target="_blank" rel="noreferrer">${type === "cadastre" ? "Katastar" : "List B"}</a>`] : []).join(" · ")}</td></tr>`).join("\n");
  return `<!doctype html><html lang="hr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bilice — lokalna provjera vlasnika</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:1250px;margin:3rem auto;padding:0 1.5rem;color:#1d282c}h1{font-size:2rem}table{border-collapse:collapse;width:100%}td,th{padding:1rem;text-align:left;border-bottom:1px solid #d3dedc;vertical-align:top}th{background:#eaf0ed}a{color:#0b6050}small{color:#596568}</style><h1>Bilice — provjera vlasnika</h1><p>Lokalni pregled ciljanih čestica. Imena su isključivo iz povezanog lista B; katastarski posjednici nisu predstavljeni kao vlasnici. Podaci nisu objavljeni na javnoj stranici.</p><p><small>Dohvat: ${htmlEscape(generatedAt)} · Informativni uvid, ne ovjereni izvadak.</small></p><table><thead><tr><th>Čestica</th><th>Upisani vlasnik i udio</th><th>Provjera</th><th>Službeni zapis</th></tr></thead><tbody>${body}</tbody></table></html>\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const input = args[args.indexOf("--targets") + 1];
  if (!args.includes("--targets") || !input) throw new Error("Usage: tsx scripts/verify-bilice-ownership.ts --targets input.json");
  try {
    execFileSync("git", ["check-ignore", "--quiet", ".cache/bilice-ownership/probe.json"], { cwd: ROOT });
  } catch { throw new Error("Refusing raw output: .cache/bilice-ownership must be git-ignored first."); }
  const targets = validateTargets(JSON.parse(await readFile(path.resolve(input), "utf8")));
  const registry = JSON.parse(await readFile(path.join(ROOT, "data/public-entities.json"), "utf8")) as RegistryEntity[];
  const generatedAt = new Date().toISOString();
  const runId = generatedAt.replace(/[:.]/g, "-");
  const rawDir = path.join(CACHE, "raw", runId);
  const wms = await wmsUrl();
  const rows: ReviewRow[] = [];
  for (const target of targets) {
    const row = await retrieve(target, wms, rawDir, registry);
    rows.push(row);
    console.log(`${row.municipality}:${row.parcelNumber} — ${row.status}`);
  }
  await jsonFile(path.join(CACHE, "targets.json"), { targets });
  await jsonFile(path.join(CACHE, "owners-review.json"), { generatedAt, targetCount: rows.length, parcels: rows });
  await jsonFile(path.join(CACHE, "public-summary.json"), { generatedAt, targetCount: rows.length, parcels: rows.map(sanitizeReview) });
  await privateWrite(path.join(CACHE, "owners-review.html"), reviewHtml(rows, generatedAt));
  console.log(`Local review: .cache/bilice-ownership/owners-review.html (${rows.length} targeted parcels).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Ownership lookup failed.");
    process.exitCode = 1;
  });
}
