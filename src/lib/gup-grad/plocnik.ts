import type * as LeafletNS from "leaflet";
import type { FeatureCollection, Geometry } from "geojson";

/** Pločica od 1 km u indeksu (cestice.py): id datoteke, broj oblika i granice [[j, z], [s, i]]. */
export interface Plocica {
  id: string;
  n: number;
  granice: [[number, number], [number, number]];
}

/**
 * Dohvaćač pločica jednog sloja: indeks se čita jednom, pločica jednom, a
 * ona koja nije stigla smije se tražiti ponovno.
 */
export function plocnik<P>(indeksUrl: string, mapa: string, dodaj: (fc: FeatureCollection<Geometry, P>) => void) {
  let indeks: Plocica[] | null = null;
  const ucitane = new Set<string>();
  return async (L: typeof LeafletNS, okno: LeafletNS.LatLngBounds, prije: () => void) => {
    indeks ??= ((await (await fetch(indeksUrl)).json()) as { plocice: Plocica[] }).plocice;
    const trebaju = indeks.filter((p) => !ucitane.has(p.id) && okno.intersects(L.latLngBounds(p.granice)));
    if (trebaju.length) prije();
    await Promise.all(
      trebaju.map(async (p) => {
        ucitane.add(p.id);
        const r = await fetch(`${mapa}/${p.id}.json`);
        if (!r.ok) {
          ucitane.delete(p.id);
          throw new Error(`pločica ${p.id}: ${r.status}`);
        }
        dodaj((await r.json()) as FeatureCollection<Geometry, P>);
      }),
    );
  };
}
