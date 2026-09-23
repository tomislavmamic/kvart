/**
 * Geometrija „punjenja” ćelije grafikona: koliko visoko treba nasuti boju
 * u nepravilan poligon da obojeni dio ima zadani udio njegove površine.
 *
 * Samo zbrajanje i množenje (bez sin/cos), pa poslužitelj i preglednik
 * dobiju isti broj do zadnje znamenke.
 */
export type Tocka = readonly [number, number];

/** Površina poligona (bez predznaka), shoelace. */
export function povrsina(p: readonly Tocka[]): number {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  }
  return Math.abs(s) / 2;
}

/** Dio poligona ispod crte y (u SVG-u „ispod” znači veći y). */
export function ispod(p: readonly Tocka[], y: number): Tocka[] {
  const out: Tocka[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const aIn = a[1] >= y;
    const bIn = b[1] >= y;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (y - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), y]);
    }
  }
  return out;
}

/**
 * Visina crte (y) ispod koje leži `udio` površine poligona.
 * udio 0 → dno poligona, udio 1 → vrh.
 */
export function razinaZaUdio(p: readonly Tocka[], udio: number): number {
  let vrh = Infinity;
  let dno = -Infinity;
  for (const [, y] of p) {
    vrh = Math.min(vrh, y);
    dno = Math.max(dno, y);
  }
  if (udio <= 0) return dno;
  if (udio >= 1) return vrh;
  const cilj = povrsina(p) * udio;
  let lo = vrh;
  let hi = dno;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (povrsina(ispod(p, mid)) > cilj) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Širina poligona na vodoravnoj crti y (zbroj presjeka, za konveksne jedan). */
export function sirinaNaVisini(p: readonly Tocka[], y: number): number {
  const xs: number[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
      xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
  }
  xs.sort((m, n) => m - n);
  let s = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) s += xs[i + 1] - xs[i];
  return s;
}

/** Visina poligona na okomitoj crti x. */
export function visinaNaSirini(p: readonly Tocka[], x: number): number {
  return sirinaNaVisini(
    p.map(([a, b]) => [b, a] as const),
    x,
  );
}
