/**
 * Polje otjecanja niz padinu na rešetci simulatora, iz LiDAR mreže visina.
 *
 * Reljef se gladi jako (dolinska skala, ne humak), pa se uzme smjer
 * najvećeg pada i oslabi na ravnome: puna težina od nagiba 5 % naviše, nula
 * na ravnom. Isti recept kao `_polje_drenaze` u `scripts/oblacici.py`.
 *
 * Mreža visina (`public/geo/reljef/visine.json`) pokriva zapadnih 60 % okvira
 * simulatora (do 16,518° i.d.) i sjeverno od 43,514°: plohu, Dračevac,
 * Bilice, Solin. Istočni rub (Kamen, Mravince) i jug (Sirobuja) ostaju bez
 * otjecanja — tako i piše u `pokrivenost`, da se nedostatak ne zamijeni s
 * ravnim terenom.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

type Zaglavlje = {
  zapad: number;
  jug: number;
  istok: number;
  sjever: number;
  stupaca: number;
  redaka: number;
  prazno: number;
  korakM: number;
};

export type PoljeDrenaze = {
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Udio ćelija rešetke koje mreža visina pokriva. */
  readonly pokrivenost: number;
};

/** Nagib pri kojem otjecanje dobiva punu težinu. */
const PUNI_NAGIB = 0.05;

/** Prolaza glađenja na rešetci simulatora (25 m): dolinska skala ~300 m. */
const GLADENJA = 12;

function gladi(z: Float32Array, w: number, h: number, prolaza: number): Float32Array {
  let a = z;
  for (let p = 0; p < prolaza; p += 1) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        const g = a[Math.max(0, j - 1) * w + i];
        const d = a[Math.min(h - 1, j + 1) * w + i];
        const l = a[j * w + Math.max(0, i - 1)];
        const r = a[j * w + Math.min(w - 1, i + 1)];
        b[j * w + i] = (a[j * w + i] * 4 + g + d + l + r) / 8;
      }
    }
    a = b;
  }
  return a;
}

/**
 * Izvodi polje otjecanja za rešetku simulatora.
 *
 * Args:
 *   korijen: Korijen projekta (gdje je `public/`).
 *
 * Returns:
 *   Jedinični vektori niz pad, oslabljeni na ravnome; `y` raste prema jugu.
 */
export function izvediDrenazu(korijen: string = process.cwd()): PoljeDrenaze {
  const mapa = join(korijen, "public", "geo", "reljef");
  const z: Zaglavlje = JSON.parse(readFileSync(join(mapa, "visine.json"), "utf8"));
  const sirovo = gunzipSync(readFileSync(join(mapa, "visine.bin.gz")));
  const visine = new Int16Array(sirovo.buffer, sirovo.byteOffset, sirovo.byteLength / 2);

  const { gw, gh, granice, sirinaM, visinaM } = SIM_POLJE;
  const teren = new Float32Array(gw * gh);
  const ima = new Uint8Array(gw * gh);
  let pokriveno = 0;
  for (let j = 0; j < gh; j += 1) {
    const lat = granice.sjever - ((j + 0.5) / gh) * (granice.sjever - granice.jug);
    const red = Math.floor(((z.sjever - lat) / (z.sjever - z.jug)) * z.redaka);
    for (let i = 0; i < gw; i += 1) {
      const lon = granice.zapad + ((i + 0.5) / gw) * (granice.istok - granice.zapad);
      const stupac = Math.floor(((lon - z.zapad) / (z.istok - z.zapad)) * z.stupaca);
      if (red < 0 || red >= z.redaka || stupac < 0 || stupac >= z.stupaca) continue;
      const v = visine[red * z.stupaca + stupac];
      if (v === z.prazno) continue;
      teren[j * gw + i] = v / 10;
      ima[j * gw + i] = 1;
      pokriveno += 1;
    }
  }
  // Rupe (izvan mreže) dobivaju medijan pokrivenoga, da glađenje ne vuče
  // prema nuli; nagib se ondje ionako poništi maskom.
  const poznate = Array.from(teren).filter((_, k) => ima[k]).sort((a, b) => a - b);
  const medijan = poznate.length ? poznate[Math.floor(poznate.length / 2)] : 0;
  for (let k = 0; k < teren.length; k += 1) if (!ima[k]) teren[k] = medijan;

  const glatko = gladi(teren, gw, gh, GLADENJA);
  const dxM = sirinaM / gw;
  const dyM = visinaM / gh;
  const x = new Float32Array(gw * gh);
  const y = new Float32Array(gw * gh);
  for (let j = 1; j < gh - 1; j += 1) {
    for (let i = 1; i < gw - 1; i += 1) {
      const k = j * gw + i;
      if (!ima[k] || !ima[k - 1] || !ima[k + 1] || !ima[k - gw] || !ima[k + gw]) continue;
      // Pad po x prema istoku, po y prema jugu (redak raste prema jugu).
      const gx = (glatko[k + 1] - glatko[k - 1]) / (2 * dxM);
      const gy = (glatko[k + gw] - glatko[k - gw]) / (2 * dyM);
      const nagib = Math.hypot(gx, gy);
      if (nagib < 1e-6) continue;
      const tezina = Math.min(1, nagib / PUNI_NAGIB);
      x[k] = (-gx / nagib) * tezina;
      y[k] = (-gy / nagib) * tezina;
    }
  }
  return { x, y, pokrivenost: pokriveno / (gw * gh) };
}
