/**
 * WGS84 (ETRS89) → HTRS96/TM (EPSG:3765), službena projekcija Hrvatske, u
 * kojoj je uklopljen svaki list GUP-a (scripts/gup-grad/rasteriziraj.py).
 *
 * Poprečni Mercator na elipsoidu GRS80, srednji meridijan 16,5° I, mjerilo
 * 0,9999, lažni istok 500 000 m; Krügerov red do n⁴ (točnost ispod
 * milimetra u Hrvatskoj). Ovdje, a ne proj4, jer ga treba skočni prozor
 * čestice na karti — proj4 bi karti dodao ~80 kB za jednu formulu.
 */

const A = 6378137;
const F = 1 / 298.257222101;
const K0 = 0.9999;
const LON0 = (16.5 * Math.PI) / 180;
const FE = 500000;

const n = F / (2 - F);
const n2 = n * n;
const n3 = n2 * n;
const n4 = n3 * n;
const AA = (A / (1 + n)) * (1 + n2 / 4 + n4 / 64);
const ALFA = [
  n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180,
  (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440,
  (61 * n3) / 240 - (103 * n4) / 140,
  (49561 * n4) / 161280,
];
const E2N = (2 * Math.sqrt(n)) / (1 + n);

/** [istok, sjever] u metrima za zemljopisnu širinu i dužinu u stupnjevima. */
export function uHtrs(lat: number, lng: number): [number, number] {
  const phi = (lat * Math.PI) / 180;
  const dl = (lng * Math.PI) / 180 - LON0;
  const sin = Math.sin(phi);
  const t = Math.sinh(Math.atanh(sin) - E2N * Math.atanh(E2N * sin));
  const xi = Math.atan2(t, Math.cos(dl));
  const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let x = eta;
  let y = xi;
  ALFA.forEach((a, i) => {
    const j = 2 * (i + 1);
    x += a * Math.cos(j * xi) * Math.sinh(j * eta);
    y += a * Math.sin(j * xi) * Math.cosh(j * eta);
  });
  return [FE + K0 * AA * x, K0 * AA * y];
}
