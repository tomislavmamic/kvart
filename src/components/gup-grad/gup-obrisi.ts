"use client";

/**
 * Obrisi područja iz prijedloga GUP-a 2025. u kojima nova gradnja čeka UPU:
 * urbana sanacija, urbana preobrazba i neuređeni dio neizgrađenog
 * građevinskog područja (čl. 103, list 4.d). Poligone izvodi
 * scripts/gup-grad/planski-obrisi.py.
 *
 * Crtaju se samo rubom, iznad čestica i zgrada, bez klika — klik ide
 * čestici ispod, čiji skočni prozor kaže planski režim.
 */
import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { FeatureCollection } from "geojson";

import type { GupPostavke } from "@/components/gup-grad/gup-provjera";

export type VrstaObrisa = "sanacija" | "preobrazba" | "neuredeno";

export const OBRISI: Record<VrstaObrisa, { naziv: string; boja: string }> = {
  sanacija: { naziv: "područje urbane sanacije", boja: "#15803d" },
  preobrazba: { naziv: "područje urbane preobrazbe", boja: "#be185d" },
  neuredeno: { naziv: "neuređeni dio neizgrađenog građevinskog područja", boja: "#a16207" },
};

const URL = "/geo/gup-grad/planski-rezim-2025.geojson";

/** Vrijede li obrisi za ove postavke: samo prijedlog 2025. ih propisuje. */
export function obrisiVrijede(p: GupPostavke): boolean {
  return p.obrisi && p.godina === 2025;
}

let ucitano: Promise<FeatureCollection> | null = null;

export function useObrisi(opts: {
  mapRef: { current: LeafletNS.Map | null };
  LRef: { current: typeof LeafletNS | null };
  spremno: boolean;
  postavke: GupPostavke;
}) {
  const { mapRef, LRef, spremno, postavke } = opts;
  const aktivno = obrisiVrijede(postavke);
  const sloj = useRef<LeafletNS.LayerGroup | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno) return;
    let ziv = true;
    if (!map.getPane("gup-obrisi")) {
      // iznad čestica (400) i zgrada (420), ispod skočnih prozora
      const okno = map.createPane("gup-obrisi");
      okno.style.zIndex = "430";
      okno.style.pointerEvents = "none";
    }
    ucitano ??= fetch(URL).then((r) => {
      if (!r.ok) throw new Error(`${URL}: ${r.status}`);
      return r.json() as Promise<FeatureCollection>;
    });
    ucitano
      .then((fc) => {
        if (!ziv) return;
        const renderer = L.svg({ pane: "gup-obrisi" });
        const boja = (f?: GeoJSON.Feature) => OBRISI[(f?.properties?.vrsta as VrstaObrisa) ?? "sanacija"].boja;
        // bijela podloga ispod crtkanog ruba, da se vidi i na satelitskoj snimci
        const podloga = L.geoJSON(fc, {
          renderer,
          interactive: false,
          style: () => ({ color: "#ffffff", weight: 5, opacity: 0.85, fill: false }),
        } as LeafletNS.GeoJSONOptions);
        const rub = L.geoJSON(fc, {
          renderer,
          interactive: false,
          style: (f) => ({ color: boja(f), weight: 2.5, opacity: 1, dashArray: "9 6", fill: false }),
        } as LeafletNS.GeoJSONOptions);
        sloj.current = L.layerGroup([podloga, rub]).addTo(map);
      })
      .catch(() => {
        ucitano = null; // idući put pokušaj ponovno
      });
    return () => {
      ziv = false;
      sloj.current?.remove();
      sloj.current = null;
    };
  }, [spremno, aktivno, mapRef, LRef]);
}
