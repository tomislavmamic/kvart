export const LOKALNIH_CELIJA = 200;
export const SIRINA_PROSIRENOG = 512;

export function udioLokalnogPolja(vodoravno: number, okomito: number): number {
  const udaljenost = Math.max(0, -vodoravno, vodoravno - 1, -okomito, okomito - 1);
  const udio = Math.min(1, udaljenost / 0.25);
  return 1 - udio * udio * (3 - 2 * udio);
}

export function stvoriOs(mjerilo: number) {
  if (!Number.isFinite(mjerilo) || mjerilo < SIRINA_PROSIRENOG / LOKALNIH_CELIJA) {
    throw new Error("Neispravan obuhvat simulatora");
  }
  const krilo = (SIRINA_PROSIRENOG - LOKALNIH_CELIJA) / (2 * LOKALNIH_CELIJA);
  let donja = 0;
  let gornja = 32;
  for (let korak = 0; korak < 60; korak += 1) {
    const sredina = (donja + gornja) / 2;
    const doseg = 1 + 2 * krilo * Math.expm1(sredina) / sredina;
    if (doseg < mjerilo) donja = sredina;
    else gornja = sredina;
  }
  const rast = (donja + gornja) / 2;
  function polozaj(udio: number): number {
    const pomak = (udio - 0.5) * SIRINA_PROSIRENOG / LOKALNIH_CELIJA;
    const vani = Math.max(0, Math.abs(pomak) - 0.5);
    return 0.5 + Math.sign(pomak) * (Math.min(0.5, Math.abs(pomak)) + krilo * Math.expm1(rast * vani / krilo) / rast);
  }
  function tekstura(polozaj: number): number {
    const pomak = polozaj - 0.5;
    const vani = Math.max(0, Math.abs(pomak) - 0.5);
    const udaljenost = Math.min(0.5, Math.abs(pomak)) + krilo * Math.log1p(vani * rast / krilo) / rast;
    return 0.5 + Math.sign(pomak) * udaljenost * LOKALNIH_CELIJA / SIRINA_PROSIRENOG;
  }
  const tezine = Float64Array.from({ length: SIRINA_PROSIRENOG }, (_, indeks) => {
    const korak = polozaj((indeks + 1) / SIRINA_PROSIRENOG) - polozaj(indeks / SIRINA_PROSIRENOG);
    return 1 / (LOKALNIH_CELIJA * korak);
  });
  return { polozaj, tekstura, tezine };
}

export type Granice = { zapad: number; jug: number; istok: number; sjever: number };

export function prosiriGranice(granice: Granice, mjerilo: number): Granice {
  const sredinaLon = (granice.zapad + granice.istok) / 2;
  const sredinaLat = (granice.jug + granice.sjever) / 2;
  const polaLon = (granice.istok - granice.zapad) * mjerilo / 2;
  const polaLat = (granice.sjever - granice.jug) * mjerilo / 2;
  return { zapad: sredinaLon - polaLon, istok: sredinaLon + polaLon, jug: sredinaLat - polaLat, sjever: sredinaLat + polaLat };
}
