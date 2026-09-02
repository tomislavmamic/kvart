/**
 * Slaganje polja vjetra simulatora iz binarnih osnova.
 *
 * Isti račun kao `src/lib/polje-dima.ts` — jedinična polja za vjetar prema
 * istoku i prema sjeveru, zbrojena prema smjeru i brzini, uz interpolaciju po
 * logaritmu dubine sloja — ali nad drugim zapisom i s drugim izlazom.
 *
 * Dvije razlike, obje s razlogom:
 *
 * 1. **Ulaz je binarni, ne base64.** Osnove šireg obuhvata su 1,3 MB; u base64
 *    unutar JS modula narastu na 1,8 MB koje preglednik razlaže pri učitavanju
 *    svake stranice. Ovako ih skida samo simulator, i to kao `ArrayBuffer`.
 * 2. **Izlaz je sirov, ne base64.** Polje se mijenja svakoga sata i računa se u
 *    radniku, gdje `Buffer` ne postoji. Pakiranje u base64 pa natrag bilo bi i
 *    suvišan posao i nepotrebna ovisnost.
 *
 * Fizika ostaje jedna: `razineDubine` dolazi iz `polje-dima.ts` i ne
 * preslaguje se ovdje, da se dva prikaza istoga kvarta ne raziđu.
 */

import type { SirovoPolje } from "@/lib/dim";
import { razineDubine, type StanjeZraka } from "@/lib/polje-dima";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

/** Koliko polja nosi jedna razina dubine: istok-x, istok-y, sjever-x, sjever-y. */
const POLJA_PO_RAZINI = 4;

export type Osnove = {
  readonly gw: number;
  readonly gh: number;
  readonly skala: number;
  readonly dubine: readonly number[];
  /** Po razini, po polju: sirovi bajtovi, 128 je nula. */
  readonly razine: readonly (readonly Uint8Array[])[];
  readonly maska: Uint8Array;
  readonly granice: { zapad: number; jug: number; istok: number; sjever: number };
  readonly sirinaM: number;
  readonly visinaM: number;
  /** Polje otjecanja niz padinu, ako je izvedeno; vidi `SirovoPolje.drenaza`. */
  readonly drenaza?: { readonly x: Float32Array; readonly y: Float32Array };
};

/**
 * Razlaže preuzetu datoteku u osnove.
 *
 * Redoslijed u datoteci je onaj koji piše `scripts/izvedi-sim-polje.py`: za
 * svaku razinu redom četiri polja, pa maska plohe na kraju.
 *
 * Args:
 *   spremnik: Sadržaj `/karepovac/sim-polje.bin`.
 *   opis: Zaglavlje iz generiranog modula.
 *
 * Returns:
 *   Osnove spremne za `slozi`.
 *
 * Raises:
 *   Error: Ako datoteka nije one duljine koju zaglavlje najavljuje.
 */
export function razloziOsnove(
  spremnik: ArrayBuffer,
  opis: typeof SIM_POLJE = SIM_POLJE,
): Osnove {
  const celija = opis.gw * opis.gh;
  const trebalo = celija * (opis.dubine.length * POLJA_PO_RAZINI + 1);
  if (spremnik.byteLength !== trebalo) {
    // Tiho krivo razlaganje dalo bi polje pomaknuto za pola razine, što
    // izgleda kao vjetar — samo krivi. Bolje stati.
    throw new Error(
      `sim-polje.bin ima ${spremnik.byteLength} B, a očekuje se ${trebalo} B`,
    );
  }
  const sve = new Uint8Array(spremnik);
  const razine: Uint8Array[][] = [];
  let pomak = 0;
  for (let r = 0; r < opis.dubine.length; r += 1) {
    const polja: Uint8Array[] = [];
    for (let k = 0; k < POLJA_PO_RAZINI; k += 1) {
      polja.push(sve.subarray(pomak, pomak + celija));
      pomak += celija;
    }
    razine.push(polja);
  }
  return {
    gw: opis.gw,
    gh: opis.gh,
    skala: opis.skala,
    dubine: opis.dubine,
    razine,
    maska: sve.subarray(pomak, pomak + celija),
    granice: opis.granice,
    sirinaM: opis.sirinaM,
    visinaM: opis.visinaM,
  };
}

/**
 * Slaže polje vjetra za zadano stanje zraka.
 *
 * Args:
 *   stanje: Smjer, brzina i dubina miješanog sloja.
 *   osnove: Osnove iz `razloziOsnove`.
 *
 * Returns:
 *   Polje u obliku koji prima `stvoriDimSirovo`, s brzinama u m/s.
 */
export function slozi(stanje: StanjeZraka, osnove: Osnove): SirovoPolje {
  const [a, b, udio] = razineDubine(osnove.dubine, stanje.dubina);
  const [iX, iY, sX, sY] = [0, 1, 2, 3].map((k) => [
    osnove.razine[a][k],
    osnove.razine[b][k],
  ]);

  const kut = ((270 - stanje.smjerOd) * Math.PI) / 180;
  const cx = Math.cos(kut) * stanje.brzina;
  const cy = Math.sin(kut) * stanje.brzina;
  const k = (osnove.skala * 2) / 255;

  const n = osnove.gw * osnove.gh;
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  let najveca = 0;
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
    skala,
    vx: bx,
    vy: by,
    maska: osnove.maska,
    dubina: stanje.dubina,
    ...(osnove.drenaza ? { drenaza: osnove.drenaza } : {}),
  };
}
