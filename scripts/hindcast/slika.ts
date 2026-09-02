/**
 * Slika perjanice iz snimke gustoće, bez preglednika.
 *
 * Provjera mora moći pokazati što je model nacrtao za neki sat, a vrti se u
 * Nodeu gdje nema ni platna ni karte. Zato se slika gradi ručno: gustoća se
 * oboji **istom ljestvicom i istim sidrom** kao na stranici
 * (`razina`, `ljestvicaBoja`, `SIDRO_SIMULATORA`), preko blijede podloge s
 * obrisom plohe i prijemnicima, i zapiše kao PNG vlastitim koderom (zlib je
 * u Nodeu, a PNG je oko njega samo omot).
 *
 * Slika nije karta: nema ulica ni reljefa. Služi da se sat po sat vidi kamo
 * je perjanica išla i gdje su prijemnici — dovoljno da kritičar uoči
 * promašaj smjera ili dometa, ne da netko traži svoju ulicu.
 */

import { deflateSync } from "node:zlib";

import { ljestvicaBoja, razina, TVARI, type Tvar } from "@/lib/dim";
import { SIDRO_SIMULATORA } from "@/lib/sim/ljestvica";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

import type { Prijemnik } from "./tipovi";

const CRC_TABLICA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bajtovi: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bajtovi.length; i += 1) {
    c = CRC_TABLICA[(c ^ bajtovi[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function komad(vrsta: string, podatci: Uint8Array): Uint8Array {
  const duljina = new Uint8Array(4);
  new DataView(duljina.buffer).setUint32(0, podatci.length);
  const tijelo = new Uint8Array(vrsta.length + podatci.length);
  tijelo.set(Buffer.from(vrsta, "ascii"), 0);
  tijelo.set(podatci, vrsta.length);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(tijelo));
  return Buffer.concat([duljina, tijelo, crc]);
}

/**
 * Zapisuje RGBA sliku kao PNG.
 *
 * Args:
 *   rgba: Pikseli, četiri bajta po pikselu, redak po redak.
 *   sirina: Širina u pikselima.
 *   visina: Visina u pikselima.
 *
 * Returns:
 *   Sadržaj PNG datoteke.
 */
export function uPng(rgba: Uint8Array, sirina: number, visina: number): Buffer {
  const zaglavlje = new Uint8Array(13);
  const dv = new DataView(zaglavlje.buffer);
  dv.setUint32(0, sirina);
  dv.setUint32(4, visina);
  zaglavlje[8] = 8; // bitova po kanalu
  zaglavlje[9] = 6; // RGBA
  const sirovo = new Uint8Array((sirina * 4 + 1) * visina);
  for (let y = 0; y < visina; y += 1) {
    sirovo[y * (sirina * 4 + 1)] = 0; // bez filtra
    sirovo.set(rgba.subarray(y * sirina * 4, (y + 1) * sirina * 4), y * (sirina * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    komad("IHDR", zaglavlje),
    komad("IDAT", deflateSync(sirovo)),
    komad("IEND", new Uint8Array(0)),
  ]);
}

export type OpcijeSlike = {
  readonly tvar?: Tvar;
  /** Sidro ljestvice; zadano ono simulatora. */
  readonly sidro?: number;
  /** Uvećanje po ćeliji; 3 daje 600 px za rešetku 200. */
  readonly uvecanje?: number;
  readonly prijemnici?: readonly Prijemnik[];
  /** Obris plohe u lon/lat; crta se kao tanka crta. */
  readonly ploha?: readonly (readonly [number, number])[];
};

function uPiksel(
  lon: number,
  lat: number,
  sirina: number,
  visina: number,
): [number, number] {
  const g = SIM_POLJE.granice;
  return [
    ((lon - g.zapad) / (g.istok - g.zapad)) * sirina,
    ((g.sjever - lat) / (g.sjever - g.jug)) * visina,
  ];
}

/**
 * Boji gustoću u RGBA sliku i crta prijemnike i obris plohe.
 *
 * Args:
 *   gustoca: Gustoća po ćeliji, redak po redak (sjever gore).
 *   sirina: Ćelija po širini.
 *   visina: Ćelija po visini.
 *   opcije: Tvar, sidro, uvećanje, oznake.
 *
 * Returns:
 *   RGBA pikseli i njihove dimenzije.
 */
export function naslikaj(
  gustoca: Float32Array,
  sirina: number,
  visina: number,
  opcije: OpcijeSlike = {},
): { rgba: Uint8Array; sirina: number; visina: number } {
  const tvar = opcije.tvar ?? "sumporovodik";
  const sidro = opcije.sidro ?? SIDRO_SIMULATORA;
  const u = opcije.uvecanje ?? 3;
  const W = sirina * u;
  const H = visina * u;
  const lut = ljestvicaBoja(TVARI[tvar].ljestvica);
  const rgba = new Uint8Array(W * H * 4);

  // Podloga: blijeda, s laganom mrežom svakih 1 km da se domet dade očitati.
  const kmPx = (1000 / SIM_POLJE.sirinaM) * W;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const k = (y * W + x) * 4;
      const mreza = x % Math.round(kmPx) === 0 || y % Math.round(kmPx) === 0;
      rgba[k] = mreza ? 228 : 246;
      rgba[k + 1] = mreza ? 228 : 245;
      rgba[k + 2] = mreza ? 226 : 242;
      rgba[k + 3] = 255;
    }
  }

  // Perjanica: alfa iz ljestvice, miješana preko podloge.
  for (let j = 0; j < visina; j += 1) {
    for (let i = 0; i < sirina; i += 1) {
      const v = razina(gustoca[j * sirina + i], tvar, sidro);
      const b = Math.round(v * 255) * 4;
      const a = lut[b + 3] / 255;
      if (a <= 0) continue;
      for (let dy = 0; dy < u; dy += 1) {
        for (let dx = 0; dx < u; dx += 1) {
          const k = ((j * u + dy) * W + i * u + dx) * 4;
          for (let c = 0; c < 3; c += 1) rgba[k + c] = Math.round(rgba[k + c] * (1 - a) + lut[b + c] * a);
        }
      }
    }
  }

  const tocka = (x: number, y: number, boja: [number, number, number], r: number) => {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const k = (py * W + px) * 4;
        rgba[k] = boja[0];
        rgba[k + 1] = boja[1];
        rgba[k + 2] = boja[2];
      }
    }
  };

  if (opcije.ploha) {
    const t = opcije.ploha.map(([lon, lat]) => uPiksel(lon, lat, W, H));
    for (let k = 0; k < t.length; k += 1) {
      const [x0, y0] = t[k];
      const [x1, y1] = t[(k + 1) % t.length];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let s = 0; s <= n; s += 1) tocka(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, [60, 60, 60], 0);
    }
  }
  for (const p of opcije.prijemnici ?? []) {
    const [x, y] = uPiksel(p.lon, p.lat, W, H);
    tocka(x, y, [255, 255, 255], 4);
    tocka(x, y, [20, 20, 20], 2);
  }
  return { rgba, sirina: W, visina: H };
}

/** Ista stvar, odmah kao PNG. */
export function slikaPng(
  gustoca: Float32Array,
  sirina: number,
  visina: number,
  opcije: OpcijeSlike = {},
): Buffer {
  const s = naslikaj(gustoca, sirina, visina, opcije);
  return uPng(s.rgba, s.sirina, s.visina);
}
