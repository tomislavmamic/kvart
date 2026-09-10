export const SIRINA_RUBA = 0.045;

export function alfaRuba(vodoravno: number, okomito: number): number {
  const udaljenost = Math.min(vodoravno, 1 - vodoravno, okomito, 1 - okomito);
  const udio = Math.max(0, Math.min(1, udaljenost / SIRINA_RUBA));
  return udio * udio * (3 - 2 * udio);
}
