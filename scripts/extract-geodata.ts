/**
 * Izvlači vektorske slojeve za kartu kvarta (/karta) u statične GeoJSON
 * datoteke u public/geo/. Pokreće se ručno ili u CI-ju:  npm run extract-geo
 *
 * Svaki izvor ima vlastiti try/catch — ako padne, upisuje se prazna
 * FeatureCollection kako karta uvijek radi (sloj pokaže "nema podataka").
 * Podaci se commitaju u repo: verzionirani su i ne ovise o dostupnosti
 * vanjskih servisa u trenutku posjeta.
 */
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection } from "geojson";
import { loadMask, clipToBoundary, type Mask } from "./clip-lib";

const OUT_DIR = path.join(process.cwd(), "public", "geo");

// Maska granice kvarta — svaki sloj se reže na nju prije spremanja.
// Popuni se na početku main(); dok nije spremna, sloj se sprema neodrezan.
let boundaryMask: Mask | null = null;

// bbox kvarta [zapad, jug, istok, sjever]
const [W, S, E, N] = [16.47, 43.51, 16.52, 43.54];
const OVERPASS_BBOX = `${S},${W},${N},${E}`; // Overpass traži jug,zapad,sjever,istok
const UA = "nas-kvart-split/1.0 (civic map; kontakt: inicijativa)";

type FC = { type: "FeatureCollection"; features: unknown[] };
const emptyFC = (): FC => ({ type: "FeatureCollection", features: [] });

async function save(name: string, fc: FC): Promise<void> {
  // Odreži na granicu kvarta (ako je maska spremna) — ne prikazujemo
  // podatke izvan Dračevca i Bilica. `granica` je sama maska; nju ne dira.
  const clipped =
    boundaryMask && name !== "granica"
      ? (clipToBoundary(
          fc as unknown as FeatureCollection,
          boundaryMask
        ) as unknown as FC)
      : fc;
  await writeFile(
    path.join(OUT_DIR, `${name}.geojson`),
    JSON.stringify(clipped),
    "utf-8"
  );
  console.log(`  ✓ ${name}.geojson — ${clipped.features.length} objekata`);
}

/** Overpass upit → GeoJSON (uz osmtogeojson). Retry na 429/504. */
async function overpass(query: string): Promise<FC> {
  // Svaki iskaz unutar grupe mora završiti točka-zarezom.
  const inner = query.trim().endsWith(";") ? query.trim() : `${query.trim()};`;
  const body = `[out:json][timeout:60];(${inner});out geom;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  for (let attempt = 0; attempt < 5; attempt++) {
    const endpoint = endpoints[attempt % endpoints.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": UA },
        body,
      });
      if (res.ok) {
        const json = await res.json();
        return osmtogeojson(json) as FC;
      }
      if (res.status !== 429 && res.status !== 504 && res.status !== 400) {
        throw new Error(`Overpass HTTP ${res.status}`);
      }
    } catch (e) {
      if (attempt === 4) throw e;
    }
    await new Promise((r) => setTimeout(r, 6000 * (attempt + 1)));
  }
  throw new Error("Overpass: iscrpljeni pokušaji");
}

/** Preskoči sloj koji već ima podatke (osim ako je EXTRACT_FORCE=1). */
async function alreadyPopulated(name: string): Promise<boolean> {
  if (process.env.EXTRACT_FORCE === "1") return false;
  try {
    const raw = await readFile(path.join(OUT_DIR, `${name}.geojson`), "utf-8");
    const fc = JSON.parse(raw) as FC;
    return fc.features.length > 0;
  } catch {
    return false;
  }
}

async function run<T extends FC>(
  name: string,
  fn: () => Promise<T>
): Promise<void> {
  if (await alreadyPopulated(name)) {
    console.log(`  · ${name}.geojson — preskočeno (već ima podatke)`);
    return;
  }
  try {
    await save(name, await fn());
  } catch (e) {
    console.warn(`  ✗ ${name}: ${e instanceof Error ? e.message : e} — prazan sloj`);
    await save(name, emptyFC());
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Izvlačim vektorske slojeve za kvart…");
  try {
    boundaryMask = await loadMask();
  } catch (e) {
    console.warn(
      `  ! maska granice nedostupna (${
        e instanceof Error ? e.message : e
      }) — slojevi se neće rezati`
    );
  }

  // ---- OSM teme (Overpass) ----
  await run("zgrade", () => overpass(`way["building"](${OVERPASS_BBOX})`));
  await run("pjesacke", () =>
    overpass(
      `way["highway"~"footway|path|steps|pedestrian"](${OVERPASS_BBOX})`
    )
  );
  await run("parkiralista", () =>
    overpass(
      `nwr["amenity"="parking"](${OVERPASS_BBOX})`
    )
  );
  await run("struja", () =>
    overpass(
      `way["power"~"line|minor_line"](${OVERPASS_BBOX});node["power"~"tower|substation|pole"](${OVERPASS_BBOX});way["power"="substation"](${OVERPASS_BBOX})`
    )
  );
  await run("sadrzaji", () =>
    overpass(
      `nwr["amenity"~"school|kindergarten|community_centre|library|place_of_worship|pharmacy|clinic|doctors"](${OVERPASS_BBOX});nwr["leisure"~"playground|pitch|sports_centre|park|garden"](${OVERPASS_BBOX});node["amenity"="drinking_water"](${OVERPASS_BBOX})`
    )
  );

  // ---- Promet Split (stajališta) ----
  await run("stajalista", async () => {
    const sess = await fetch(
      "https://api.promet-split.hr/Fleet/api/v1/bootstrap/session",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
    );
    const cookie = sess.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const res = await fetch(
      "https://api.promet-split.hr/Fleet/api/v1/stop/all",
      { headers: { cookie } }
    );
    const stops = (await res.json()) as Array<{
      name?: string;
      geography?: { coordinates?: [number, number] };
    }>;
    const features = stops
      .filter((s) => {
        const c = s.geography?.coordinates;
        return c && c[0] >= W && c[0] <= E && c[1] >= S && c[1] <= N;
      })
      .map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: s.geography!.coordinates },
        properties: { naziv: s.name ?? "Stajalište" },
      }));
    return { type: "FeatureCollection", features };
  });

  // ---- Zelene površine (OSM) ----
  // NIPP WFS "LandCoverUnit" nema pokrivenost za Dračevac/Bilice (svi objekti
  // padaju južno od kvarta), pa zelenilo uzimamo iz OSM-a: parkovi, travnjaci,
  // šuma, makija/šikara — stvarni zeleni pokrov našeg područja.
  await run("zelene-povrsine", () =>
    overpass(
      `way["leisure"~"park|garden|nature_reserve"](${OVERPASS_BBOX});` +
        `way["landuse"~"grass|forest|recreation_ground|meadow|village_green"](${OVERPASS_BBOX});` +
        `way["natural"~"wood|scrub|grassland"](${OVERPASS_BBOX})`
    )
  );

  // ---- Toponimi (RGI WFS) ----
  await run("toponimi", async () => {
    const url =
      "https://rgi.dgu.hr/geoserver/wfshr/wfs" +
      "?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&typeName=wfshr:nippimenovanomjesto" +
      "&outputFormat=application/json&srsName=EPSG:4326" +
      `&bbox=${S},${W},${N},${E},urn:ogc:def:crs:EPSG::4326`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`WFS HTTP ${res.status}`);
    return (await res.json()) as FC;
  });

  // ---- HAKOM dostupnost interneta 30–100 Mbit (ArcGIS query) ----
  await run("internet", async () => {
    const base =
      "https://ekarta.hakom.hr/server/rest/services/DOSTUPNOST_SPP/Dostupnost_SPP/MapServer/94/query";
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      geometry: `${W},${S},${E},${N}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "true",
    });
    const res = await fetch(`${base}?${params}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HAKOM HTTP ${res.status}`);
    const json = (await res.json()) as FC;
    if (!json.features) throw new Error("HAKOM: nema features");
    return json;
  });

  // ---- HAKOM plan telekom infrastrukture (Objedinjeni plan, Uredba 2025) ----
  // Layer 3 = planirane elektroničko-komunikacijske zone (pokretna mreža).
  await run("plan-optika", async () => {
    const base =
      "https://ekarta.hakom.hr/server/rest/services/OBJEDINJENI_PLAN/Uredba_2025/MapServer/3/query";
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      geometry: `${W},${S},${E},${N}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "true",
    });
    const res = await fetch(`${base}?${params}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HAKOM HTTP ${res.status}`);
    const json = (await res.json()) as FC;
    if (!json.features) throw new Error("HAKOM: nema features");
    return json;
  });

  console.log("Gotovo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
