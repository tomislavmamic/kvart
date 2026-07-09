/**
 * Rezanje vektorskih slojeva na granicu kvarta.
 *
 * Izvori (OSM/WFS/HAKOM) vraćaju podatke za širi obuhvat prikupljanja
 * (KVART_BBOX, ~4×3 km). Karta prikazuje samo Dračevac i Bilice, pa sve
 * izvan granice treba maknuti — inače posjetitelj panom vidi susjedne
 * kvartove i dalekovode koji sijeku pola Splita.
 *
 * Maska = unija službenih poligona (granica.geojson) + mali "courtesy"
 * pojas (BUFFER_KM) da ne režemo baš po međama i da se vidi rubna ulica.
 *
 * Pravila po geometriji:
 *  - točke i mali poligoni (zgrade, parkirališta): zadrži cijeli objekt ako
 *    dodiruje masku (bez rezanja — polovične zgrade izgledaju kao greška);
 *  - linije (dalekovodi, staze): odreži na bbox maske da ne "strše" kroz
 *    cijelu regiju;
 *  - veliki poligoni (zone dostupnosti, planske zone): odreži točno na oblik
 *    maske jer bi inače prikazali područje daleko izvan kvarta.
 */
import { readFile } from "fs/promises";
import path from "path";
import {
  union,
  buffer,
  booleanIntersects,
  bboxClip,
  intersect,
  bbox as turfBbox,
  featureCollection,
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from "geojson";

const GRANICA = path.join(process.cwd(), "public", "geo", "granica.geojson");
const BUFFER_KM = 0.12; // ~120 m rezerve oko granice
// Poligoni veći od ~300 m po stranici (dostupnost interneta, planske zone)
// režu se točno na masku; manji (zgrade, parcele) ostaju cijeli.
const BIG_POLY_DEG = 0.003;

export interface Mask {
  poly: Feature<Polygon | MultiPolygon>;
  bbox: [number, number, number, number];
}

/** Učitaj granicu i pripremi masku (unija poligona + pojas). */
export async function loadMask(): Promise<Mask> {
  const fc = JSON.parse(await readFile(GRANICA, "utf-8")) as FeatureCollection;
  const polys = fc.features.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
  );
  if (polys.length === 0) throw new Error("granica.geojson: nema poligona");

  let merged: Feature<Polygon | MultiPolygon> = polys[0];
  for (let i = 1; i < polys.length; i++) {
    const u = union(featureCollection([merged, polys[i]]));
    if (u) merged = u;
  }
  const buffered =
    buffer(merged, BUFFER_KM, { units: "kilometers" }) ?? merged;
  return {
    poly: buffered,
    bbox: turfBbox(buffered) as [number, number, number, number],
  };
}

/** Poligon je "velik" ako mu je bilo koja stranica bbox-a preko praga. */
function isBigPolygon(f: Feature): boolean {
  const [x0, y0, x1, y1] = turfBbox(f);
  return x1 - x0 > BIG_POLY_DEG || y1 - y0 > BIG_POLY_DEG;
}

function isEmptyGeometry(g: Geometry | null | undefined): boolean {
  if (!g || !("coordinates" in g)) return true;
  const c = g.coordinates as unknown[];
  if (!Array.isArray(c) || c.length === 0) return true;
  // MultiLineString: [[...],[...]] — prazno ako su sve pod-linije prazne.
  if (Array.isArray(c[0]) && c.every((line) => (line as unknown[]).length === 0))
    return true;
  return false;
}

/** Vrati novi FeatureCollection sa samo onim što pripada kvartu. */
export function clipToBoundary<T extends FeatureCollection>(
  fc: T,
  mask: Mask
): T {
  const kept: Feature[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    let touches = false;
    try {
      touches = booleanIntersects(f, mask.poly);
    } catch {
      touches = false;
    }
    if (!touches) continue;

    const type = f.geometry.type;
    if (type === "LineString" || type === "MultiLineString") {
      try {
        const clipped = bboxClip(
          f as Feature<Geometry>,
          mask.bbox
        ) as Feature<Geometry>;
        if (isEmptyGeometry(clipped.geometry)) continue;
        clipped.properties = f.properties;
        kept.push(clipped);
      } catch {
        kept.push(f); // ako rezanje padne, radije zadrži nego izgubi
      }
    } else if (
      (type === "Polygon" || type === "MultiPolygon") &&
      isBigPolygon(f)
    ) {
      try {
        const clipped = intersect(
          featureCollection([
            f as Feature<Polygon | MultiPolygon>,
            mask.poly,
          ])
        );
        if (clipped && !isEmptyGeometry(clipped.geometry)) {
          clipped.properties = f.properties;
          kept.push(clipped);
        } else {
          kept.push(f); // presjek pao/prazan → radije zadrži cijeli
        }
      } catch {
        kept.push(f);
      }
    } else {
      kept.push(f); // točke i male parcele/zgrade ostaju cijele
    }
  }
  return { ...fc, features: kept };
}
