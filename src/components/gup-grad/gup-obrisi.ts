"use client";

/**
 * Obuhvati 34 plana užeg područja koje prijedlog GUP-a 2025. propisuje
 * (list 4.d, popis „za koje je propisana obveza izrade”), s imenom iz
 * legende. Poligone izvodi scripts/gup-grad/planski-obrisi.py.
 *
 * Crta se sam obuhvat, plavom crtom kao na listu, s natpisom od zuma
 * NATPISI_OD. Unutar obuhvata nova gradnja ne stoji svugdje: samo u
 * područjima sanacije, preobrazbe i neuređenog (čl. 103) — to pokazuju boje
 * čestica u načinu „Planski režim”. Bez klika: klik ide čestici ispod.
 */
import { useEffect } from "react";
import type * as LeafletNS from "leaflet";
import type { FeatureCollection, Point } from "geojson";

import type { GupPostavke } from "@/components/gup-grad/gup-provjera";

/** Plava obuhvata UPU-a s lista 4.d, malo tamnija da se vidi na snimci. */
export const BOJA_OBUHVATA = "#1d4ed8";
const NATPISI_OD = 15;
const URL = "/geo/gup-grad/planski-rezim-2025.geojson";

/** Vrijede li obuhvati za ove postavke: popis je iz prijedloga 2025. */
export function obrisiVrijede(p: GupPostavke): boolean {
  return p.obrisi && p.godina === 2025;
}

interface SvojstvaObuhvata {
  broj: number;
  naziv: string;
  ha: number;
  tocka: [number, number];
}

let ucitano: Promise<FeatureCollection> | null = null;

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function useObrisi(opts: {
  mapRef: { current: LeafletNS.Map | null };
  LRef: { current: typeof LeafletNS | null };
  spremno: boolean;
  postavke: GupPostavke;
}) {
  const { mapRef, LRef, spremno, postavke } = opts;
  const aktivno = obrisiVrijede(postavke);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno) return;
    let ziv = true;
    let skupina: LeafletNS.LayerGroup | null = null;
    let natpisi: LeafletNS.LayerGroup | null = null;
    if (!map.getPane("gup-obrisi")) {
      // iznad čestica (400) i zgrada (420), ispod skočnih prozora
      const okno = map.createPane("gup-obrisi");
      okno.style.zIndex = "430";
      okno.style.pointerEvents = "none";
    }
    const natpisiVidljivi = () => {
      if (!natpisi) return;
      if (map.getZoom() >= NATPISI_OD) natpisi.addTo(map);
      else natpisi.remove();
    };
    ucitano ??= fetch(URL).then((r) => {
      if (!r.ok) throw new Error(`${URL}: ${r.status}`);
      return r.json() as Promise<FeatureCollection>;
    });
    ucitano
      .then((fc) => {
        if (!ziv) return;
        const renderer = L.svg({ pane: "gup-obrisi" });
        // bijela podloga ispod plave crte, da se vidi i na satelitskoj snimci
        const podloga = L.geoJSON(fc, {
          renderer,
          interactive: false,
          style: () => ({ color: "#ffffff", weight: 5.5, opacity: 0.9, fill: false }),
        } as LeafletNS.GeoJSONOptions);
        const rub = L.geoJSON(fc, {
          renderer,
          interactive: false,
          style: () => ({ color: BOJA_OBUHVATA, weight: 2.5, opacity: 1, fill: false }),
        } as LeafletNS.GeoJSONOptions);
        skupina = L.layerGroup([podloga, rub]).addTo(map);
        natpisi = L.layerGroup(
          fc.features.map((f) => {
            const s = f.properties as SvojstvaObuhvata;
            const tocka = (s.tocka ?? (f.geometry as Point).coordinates) as [number, number];
            return L.marker([tocka[1], tocka[0]], {
              pane: "gup-obrisi",
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "",
                iconSize: undefined,
                html:
                  `<div style="transform:translate(-50%,-50%);white-space:nowrap;font:600 12px/1.2 system-ui,sans-serif;` +
                  `color:${BOJA_OBUHVATA};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">` +
                  `${esc(s.naziv)}</div>`,
              }),
            });
          }),
        );
        natpisiVidljivi();
        map.on("zoomend", natpisiVidljivi);
      })
      .catch(() => {
        ucitano = null; // idući put pokušaj ponovno
      });
    return () => {
      ziv = false;
      map.off("zoomend", natpisiVidljivi);
      skupina?.remove();
      natpisi?.remove();
    };
  }, [spremno, aktivno, mapRef, LRef]);
}
