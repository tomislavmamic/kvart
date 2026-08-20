/**
 * Slaganje polja vjetra iz osnova, prema trenutačnom vremenu.
 *
 * `scripts/izvedi-polje-dima.py` ne sprema jedan slučaj vremena nego dva
 * jedinična polja po razini dubine miješanog sloja: vjetar prema istoku i
 * vjetar prema sjeveru. Račun mase dosljednog polja linearan je po vjetru na
 * otvorenom, pa se svaki smjer i svaka brzina dobiju njihovim zbrojem:
 *
 *     u = brzina · [cos(270° − smjer) · u_istok + sin(270° − smjer) · u_sjever]
 *
 * Time smjer i brzina prestaju biti zapečeni podatak i mogu doći iz mjerenja,
 * a težak dio računa (reljef, protok mase) ostaje u gradnji.
 *
 * Dubina sloja nije linearna jer u jednadžbi stoji kao koeficijent, pa se za
 * nju interpolira između susjednih razina — i to po logaritmu, jer je i sam
 * učinak takav: između 25 i 120 m polje se vidno prelomi, između 300 i 800 m
 * gotovo ništa.
 *
 * Modul ne dira mrežu ni DOM: prima osnove i vjetar, vraća polje.
 */

import type { PoljeDima } from "@/lib/dim";
import { OSNOVE_DIMA } from "@/generated/karepovac-polje";

/** Osnove kakve piše `npm run izvedi-polje-dima`. */
export type OsnoveDima = {
  readonly gw: number;
  readonly gh: number;
  readonly skala: number;
  readonly dubine: readonly number[];
  readonly osnove: readonly {
    readonly istokVx: string;
    readonly istokVy: string;
    readonly sjeverVx: string;
    readonly sjeverVy: string;
  }[];
  readonly maska: string;
};

export type StanjeZraka = {
  /** Meteorološki smjer iz kojega puše, u stupnjevima. */
  readonly smjerOd: number;
  /** Brzina na otvorenom, u m/s. */
  readonly brzina: number;
  /** Debljina sloja u kojem se zrak miješa, u metrima. */
  readonly dubina: number;
};

/** Polje s podatkom o tome kamo ga je vrijeme okrenulo. */
export type SlozenoPolje = PoljeDima & {
  /** Smjer prema kojem polje nosi, u stupnjevima; sredina po okviru. */
  readonly azimut: number;
  /** Najveća brzina u okviru, u m/s. */
  readonly najveca: number;
};

function raspakiraj(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function zapakiraj(a: Uint8Array): string {
  return Buffer.from(a).toString("base64");
}

/**
 * Bira dvije susjedne razine dubine i udio druge u smjesi.
 *
 * Args:
 *   dubine: Razine za koje osnove postoje, rastuće.
 *   dubina: Tražena dubina u metrima.
 *
 * Returns:
 *   Trojka (donji indeks, gornji indeks, udio gornje razine 0–1).
 */
export function razineDubine(
  dubine: readonly number[],
  dubina: number,
): [number, number, number] {
  const zadnji = dubine.length - 1;
  if (dubina <= dubine[0]) return [0, 0, 0];
  if (dubina >= dubine[zadnji]) return [zadnji, zadnji, 0];
  let g = 1;
  while (dubine[g] < dubina) g += 1;
  const d = dubine[g - 1];
  const udio = Math.log(dubina / d) / Math.log(dubine[g] / d);
  return [g - 1, g, udio];
}

/**
 * Slaže polje vjetra za zadano stanje zraka.
 *
 * Args:
 *   stanje: Smjer, brzina i dubina miješanog sloja.
 *   osnove: Osnove iz gradnje; zadano su one iz generiranog modula.
 *
 * Returns:
 *   Polje u obliku koji prima `stvoriDim`, s brzinama u m/s.
 */
export function sastaviPolje(
  stanje: StanjeZraka,
  osnove: OsnoveDima = OSNOVE_DIMA,
): SlozenoPolje {
  const [a, b, udio] = razineDubine(osnove.dubine, stanje.dubina);
  const donja = osnove.osnove[a];
  const gornja = osnove.osnove[b];

  const iX = [raspakiraj(donja.istokVx), raspakiraj(gornja.istokVx)];
  const iY = [raspakiraj(donja.istokVy), raspakiraj(gornja.istokVy)];
  const sX = [raspakiraj(donja.sjeverVx), raspakiraj(gornja.sjeverVx)];
  const sY = [raspakiraj(donja.sjeverVy), raspakiraj(gornja.sjeverVy)];

  const kut = ((270 - stanje.smjerOd) * Math.PI) / 180;
  const cx = Math.cos(kut) * stanje.brzina;
  const cy = Math.sin(kut) * stanje.brzina;
  const k = (osnove.skala * 2) / 255;

  const n = osnove.gw * osnove.gh;
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  let najveca = 0;
  let zbrojX = 0;
  let zbrojY = 0;
  for (let i = 0; i < n; i += 1) {
    // Bajt 128 je nula; ljestvica je zajednička svim razinama i objema
    // osnovama, pa se smiju miješati prije raspakiravanja u m/s.
    const ix = (iX[0][i] * (1 - udio) + iX[1][i] * udio) * k - osnove.skala;
    const iy = (iY[0][i] * (1 - udio) + iY[1][i] * udio) * k - osnove.skala;
    const sx = (sX[0][i] * (1 - udio) + sX[1][i] * udio) * k - osnove.skala;
    const sy = (sY[0][i] * (1 - udio) + sY[1][i] * udio) * k - osnove.skala;
    const x = cx * ix + cy * sx;
    const y = cx * iy + cy * sy;
    vx[i] = x;
    vy[i] = y;
    zbrojX += x;
    zbrojY += y;
    const j = Math.hypot(x, y);
    if (j > najveca) najveca = j;
  }

  // Ljestvica mora ostati veća od nule i kad je tišina, inače raspakiravanje
  // dijeli nulom; polje je tada ionako posvuda nula.
  const skala = Math.max(najveca * 1.02, 1e-6);
  const bx = new Uint8Array(n);
  const by = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    bx[i] = Math.round((vx[i] / skala) * 127.5 + 127.5);
    by[i] = Math.round((vy[i] / skala) * 127.5 + 127.5);
  }

  return {
    gw: osnove.gw,
    gh: osnove.gh,
    skala: Number(skala.toFixed(6)),
    vx: zapakiraj(bx),
    vy: zapakiraj(by),
    maska: osnove.maska,
    // y u okviru raste prema jugu, pa se za azimut vraća natrag.
    azimut: Math.round(
      ((Math.atan2(zbrojX, -zbrojY) * 180) / Math.PI + 360) % 360,
    ),
    najveca: Number(najveca.toFixed(3)),
  };
}
