"use client";

/**
 * Pločice karte /gup/gradnja (scripts/gup-grad/gradnja.ts) u pregledniku:
 * R = klasa namjene, G = regija (što na mjestu stoji), B = kategorija
 * (src/lib/gup-grad/gradnja.ts). Svaka se dohvati i pročita jednom; istu
 * sliku karta boji, a klik iz nje čita što je pod točkom i zbraja čestice.
 */
import type { Geometrija } from "@/lib/gup-grad/zabrana";

export interface PlocicaGradnje {
  url: string;
  /** [[jug, zapad], [sjever, istok]] */
  granice: [[number, number], [number, number]];
}

export interface IndeksGradnje {
  /** veličina piksela u metrima Web Mercatora */
  korak: number;
  plocice: PlocicaGradnje[];
}

let indeks: Promise<IndeksGradnje> | null = null;
export function ucitajIndeks(): Promise<IndeksGradnje> {
  indeks ??= fetch("/geo/gup-grad/gradnja.json")
    .then((r) => (r.ok ? (r.json() as Promise<IndeksGradnje>) : Promise.reject(new Error(String(r.status)))))
    .catch((e) => {
      indeks = null;
      throw e;
    });
  return indeks;
}

const slike = new Map<string, Promise<ImageData>>();
/** Brojevi pločice (ne boje): bez upravljanja bojama i premultipliciranja. */
export function procitaj(url: string): Promise<ImageData> {
  let p = slike.get(url);
  if (!p) {
    p = (async () => {
      const blob = await (await fetch(url)).blob();
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const platno = document.createElement("canvas");
      platno.width = bmp.width;
      platno.height = bmp.height;
      const ctx = platno.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height);
    })();
    p.catch(() => slike.delete(url));
    slike.set(url, p);
  }
  return p;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const izMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/** Piksel pločice pod točkom (stupac, red) ili null izvan nje. */
function pikselTocke(p: PlocicaGradnje, w: number, h: number, lng: number, lat: number): [number, number] | null {
  const [[jug, zapad], [sjever, istok]] = p.granice;
  if (lat < jug || lat > sjever || lng < zapad || lng > istok) return null;
  const c = Math.min(w - 1, Math.floor(((lng - zapad) / (istok - zapad)) * w));
  const r = Math.min(h - 1, Math.floor(((mercY(sjever) - mercY(lat)) / (mercY(sjever) - mercY(jug))) * h));
  return [c, r];
}

export interface Uzorak {
  klasa: number;
  regija: number;
  kategorija: number;
}

/** Što pločica kaže o točki; null izvan čestica u obuhvatu GUP-a. */
export async function uzorakUTocki(lng: number, lat: number): Promise<Uzorak | null> {
  const ind = await ucitajIndeks();
  for (const p of ind.plocice) {
    const [[jug, zapad], [sjever, istok]] = p.granice;
    if (lat < jug || lat > sjever || lng < zapad || lng > istok) continue;
    const slika = await procitaj(p.url);
    const px = pikselTocke(p, slika.width, slika.height, lng, lat);
    if (!px) continue;
    const i = (px[1] * slika.width + px[0]) * 4;
    const d = slika.data;
    if (d[i + 3] !== 255) return null;
    return { klasa: d[i], regija: d[i + 1], kategorija: d[i + 2] };
  }
  return null;
}

const poligoni = (g: Geometrija) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function uGeometriji(g: Geometrija, lng: number, lat: number): boolean {
  for (const p of poligoni(g)) {
    let unutra = false;
    for (const prsten of p)
      for (let a = 0, b = prsten.length - 1; a < prsten.length; b = a++) {
        const [xa, ya] = prsten[a];
        const [xb, yb] = prsten[b];
        if (ya > lat !== yb > lat && lng < ((xb - xa) * (lat - ya)) / (yb - ya) + xa) unutra = !unutra;
      }
    if (unutra) return true;
  }
  return false;
}

/**
 * Površina po kategoriji unutar oblika (čestice), u m²: pikseli pločica čije
 * je središte u obliku. Ključ 0 = dio oblika izvan obuhvata (more, izvan GUP-a).
 */
export async function kategorijeUObliku(g: Geometrija): Promise<Map<number, number>> {
  const ind = await ucitajIndeks();
  let z = Infinity, j = Infinity, i = -Infinity, s = -Infinity;
  for (const p of poligoni(g))
    for (const [x, y] of p[0]) {
      z = Math.min(z, x);
      i = Math.max(i, x);
      j = Math.min(j, y);
      s = Math.max(s, y);
    }
  const out = new Map<number, number>();
  for (const p of ind.plocice) {
    const [[jug, zapad], [sjever, istok]] = p.granice;
    if (s < jug || j > sjever || i < zapad || z > istok) continue;
    const slika = await procitaj(p.url);
    const { width: w, height: h, data: d } = slika;
    const y0 = mercY(sjever), y1 = mercY(jug);
    const c0 = Math.max(0, Math.floor(((z - zapad) / (istok - zapad)) * w));
    const c1 = Math.min(w - 1, Math.ceil(((i - zapad) / (istok - zapad)) * w));
    const r0 = Math.max(0, Math.floor(((y0 - mercY(s)) / (y0 - y1)) * h));
    const r1 = Math.min(h - 1, Math.ceil(((y0 - mercY(j)) / (y0 - y1)) * h));
    for (let r = r0; r <= r1; r++) {
      const lat = izMercY(y0 - ((r + 0.5) / h) * (y0 - y1));
      const m2 = (ind.korak * Math.cos((lat * Math.PI) / 180)) ** 2;
      for (let c = c0; c <= c1; c++) {
        const lng = zapad + ((c + 0.5) / w) * (istok - zapad);
        if (!uGeometriji(g, lng, lat)) continue;
        const k = d[(r * w + c) * 4 + 3] === 255 ? d[(r * w + c) * 4 + 2] : 0;
        out.set(k, (out.get(k) ?? 0) + m2);
      }
    }
  }
  return out;
}
