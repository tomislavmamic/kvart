/**
 * Provjerava da svaki sloj karte doista nešto crta:  npm run check-layers
 *
 * Postoji zato što ovu vrstu kvara ni gradnja ni tipovi ni lint ne vide.
 * Registar slojeva je običan objekt — sintaksno ispravan i kad pokazuje na
 * datoteku koje nema ili na WMS bez imena sloja. Sve što je ovdje
 * provjereno bilo je stvarno slomljeno na karti:
 *
 *  - `krosnje` i `nepropusnost` nisu imali `wmsLayers`, pa je Leaflet slao
 *    `layers=undefined`; početni pogled je dočekivao posjetitelja s 40
 *    slomljenih pločica;
 *  - `stanovnistvo` je bio phase 1, a datoteke nikad nije ni bilo — kvačica
 *    upaljena, karta prazna, greška progutana;
 *  - `promet`, `bujica` i `zgrade-postojece` cjevovod je izrađivao, a nijedan
 *    ih sloj nije prikazivao.
 *
 * Izlazni kod 1 ako išta padne, da se može objesiti na CI.
 */
import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { OVERLAY_LAYERS, BASE_LAYERS } from "../src/lib/map-views";

const ROOT = path.join(import.meta.dirname, "..");
const JAVNO = path.join(ROOT, "public");
const ISTEK = 30_000;

interface Nalaz {
  razina: "greška" | "upozorenje";
  sloj: string;
  poruka: string;
}

const nalazi: Nalaz[] = [];
const grijeska = (sloj: string, poruka: string) =>
  nalazi.push({ razina: "greška", sloj, poruka });
const upozorenje = (sloj: string, poruka: string) =>
  nalazi.push({ razina: "upozorenje", sloj, poruka });

/** GetMap za jednu pločicu nad kvartom — vraća opis problema ili null. */
async function provjeriWms(
  url: string,
  slojevi: string | undefined,
  crs: string | undefined
): Promise<string | null> {
  if (!slojevi) return "nema `wmsLayers` — Leaflet bi slao layers=undefined";
  const geografski = crs === "EPSG:4326";
  const p = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: slojevi,
    styles: "",
    format: "image/png",
    transparent: "true",
    width: "128",
    height: "128",
    srs: geografski ? "EPSG:4326" : "EPSG:3857",
    bbox: geografski
      ? "16.488,43.520,16.510,43.529"
      : "1835800,5391000,1837500,5393000",
  });
  let r: Response;
  try {
    r = await fetch(`${url}?${p}`, { signal: AbortSignal.timeout(ISTEK) });
  } catch (e) {
    return `nedostupno (${e instanceof Error ? e.message : e})`;
  }
  if (!r.ok) return `HTTP ${r.status}`;
  const tip = r.headers.get("content-type") ?? "";
  // Poslužitelji WMS-a greške vraćaju kao XML sa statusom 200 — bez ove
  // provjere "radi" i sloj koji zapravo vraća ServiceException.
  if (!tip.startsWith("image/")) {
    const t = (await r.text()).slice(0, 160).replace(/\s+/g, " ");
    return `nije slika nego ${tip}: ${t}`;
  }
  const n = (await r.arrayBuffer()).byteLength;
  if (n < 100) return `slika od ${n} B — praktički prazna`;
  return null;
}

async function provjeriGeojson(url: string): Promise<string | null> {
  const put = path.join(JAVNO, url.replace(/^\//, ""));
  try {
    await stat(put);
  } catch {
    return `nema datoteke ${url}`;
  }
  try {
    const fc = JSON.parse(await readFile(put, "utf-8"));
    const n = fc?.features?.length ?? 0;
    if (n === 0) return `${url} nema nijedan objekt`;
  } catch (e) {
    return `${url} nije valjan JSON (${e instanceof Error ? e.message : e})`;
  }
  return null;
}

/** Sve .geojson datoteke pod public/geo, kao putanje oblika /geo/…  */
async function sveGeojson(dir: string, os: string[] = []): Promise<string[]> {
  for (const u of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, u.name);
    if (u.isDirectory()) await sveGeojson(p, os);
    else if (u.name.endsWith(".geojson"))
      os.push("/" + path.relative(JAVNO, p).split(path.sep).join("/"));
  }
  return os;
}

async function main(): Promise<number> {
  const wms = [
    ...BASE_LAYERS.filter((b) => b.type === "wms").map((b) => ({
      id: b.id,
      url: b.url,
      slojevi: b.wmsLayers,
      crs: "EPSG:4326",
      faza: 1 as const,
    })),
    ...OVERLAY_LAYERS.filter((l) => l.type === "wms").map((l) => ({
      id: l.id,
      url: l.url,
      slojevi: l.wmsLayers,
      crs: l.wmsCrs,
      faza: l.phase,
    })),
  ];
  console.log(`Provjeravam ${wms.length} WMS slojeva …`);
  const rezultati = await Promise.all(
    wms.map(async (w) => ({ w, greska: await provjeriWms(w.url, w.slojevi, w.crs) }))
  );
  for (const { w, greska } of rezultati) {
    if (!greska) continue;
    // Vanjski servis može biti privremeno dolje; to nije kvar našeg
    // registra, pa ruši build samo ono što je u registru krivo napisano.
    const nase = greska.startsWith("nema `wmsLayers`");
    (nase || w.faza === 1 ? (nase ? grijeska : upozorenje) : upozorenje)(
      w.id,
      greska
    );
  }

  const geo = OVERLAY_LAYERS.filter((l) => l.type === "geojson");
  console.log(`Provjeravam ${geo.length} GeoJSON slojeva …`);
  for (const l of geo) {
    const greska = await provjeriGeojson(l.url);
    if (!greska) continue;
    // phase 2 je izrijekom "još nema podataka" i tako se i prikazuje.
    (l.phase === 1 ? grijeska : upozorenje)(l.id, greska);
  }

  // Nije svaka neprikazana datoteka propust: neke su ulaz u spojeni sloj,
  // a neke su izrijekom zadržane. Popis mora biti iscrpan da bi upozorenje
  // ostalo vrijedno čitanja — provjera koja stalno viče prestane se gledati.
  const namjerno = new Map<string, string>([
    ["/geo/ulice.geojson", "ulaz u ceste-sve.geojson"],
    ["/geo/pjesacke.geojson", "ulaz u ceste-sve.geojson"],
    ["/geo/ceste.geojson", "ulaz u ceste-sve.geojson"],
    ["/geo/planovi/promet.geojson", "ulaz u ceste-sve.geojson"],
    ["/geo/planovi/gup-2024-promet.geojson", "ulaz u ceste-sve.geojson"],
    ["/geo/planovi/gup-2015-promet.geojson", "ulaz u ceste-sve.geojson"],
    ["/geo/planovi/gup-2008-promet.geojson", "list 2008. nije na karti"],
    ["/geo/planovi/gup-2008-namjena.geojson", "list 2008. nije na karti"],
    ["/geo/planovi/gup-promjene-2008-2015.geojson", "list 2008. nije na karti"],
    ["/geo/granica.geojson", "čita ga karta izravno, ne kroz registar"],
  ]);
  const koristeno = new Set(OVERLAY_LAYERS.map((l) => l.url));
  for (const u of await sveGeojson(path.join(JAVNO, "geo"))) {
    if (koristeno.has(u) || namjerno.has(u)) continue;
    upozorenje("—", `izrađeno, ali nije ni na jednom sloju: ${u}`);
  }
  // I obrnuto: ako je nešto na popisu namjerno neprikazanih, a u međuvremenu
  // je dobilo sloj, popis je zastario i treba ga skratiti.
  for (const [u, zasto] of namjerno)
    if (koristeno.has(u))
      upozorenje("—", `${u} je sad na sloju — makni ga s popisa („${zasto}”)`);

  console.log("");
  for (const n of nalazi) {
    const znak = n.razina === "greška" ? "✗" : "·";
    console.log(`  ${znak} ${n.sloj}: ${n.poruka}`);
  }
  const greske = nalazi.filter((n) => n.razina === "greška").length;
  const upozorenja = nalazi.length - greske;
  console.log(
    `\n${greske} grešaka, ${upozorenja} upozorenja ` +
      `(${wms.length} WMS + ${geo.length} GeoJSON slojeva)`
  );
  return greske > 0 ? 1 : 0;
}

main().then((k) => process.exit(k));
