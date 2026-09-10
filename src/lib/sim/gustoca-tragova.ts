export const NAJMANJE_TRAGOVA = 24;
export const NAJVISE_TRAGOVA = 2400;

export function brojTragova(povrsinaPx: number, zoom: number): number {
  const prorjedenje = 2 ** Math.max(0, zoom - 12);
  const cilj = povrsinaPx * 0.0007 / prorjedenje;
  return Math.min(NAJVISE_TRAGOVA, Math.max(NAJMANJE_TRAGOVA, Math.round(cilj / 12) * 12));
}
