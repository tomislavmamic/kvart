"use client";

/**
 * Kartografski prikaz GUP-a u punoj veličini: piramida pločica lista
 * (scripts/gup-grad/dokument.py) u Leafletu s ravnim koordinatama (CRS.Simple).
 *
 * Koordinate: jedinica je piksel pune rezolucije podijeljen s 2^maksZum, pa
 * je Leafletov zum z točno razina pločica z (na razini z list je širok
 * sirina / 2^(maksZum − z) piksela). Y ide prema dolje kao −lat.
 *
 * Navod lista dolazi s okvirom u adresi (`?okvir=l,g,d,d` kao udjeli lista,
 * i `&tocka=x,y` kad je navod mjesto čestice);
 * preglednik se tada približi na nj i obrubi ga. Okvir se čita u pregledniku,
 * pa stranica ostaje statična.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";

import { PLOCICA_LISTA, type List, type Okvir } from "@/lib/gup-dokument/model";

function tockaIzAdrese(): [number, number] | null {
  const v = new URLSearchParams(window.location.search).get("tocka")?.split(",").map(Number);
  return v && v.length === 2 && v.every((x) => Number.isFinite(x) && x >= 0 && x <= 1) ? [v[0], v[1]] : null;
}

function okvirIzAdrese(): Okvir | null {
  const v = new URLSearchParams(window.location.search).get("okvir")?.split(",").map(Number);
  if (!v || v.length !== 4 || v.some((x) => !Number.isFinite(x) || x < 0 || x > 1) || v[2] <= v[0] || v[3] <= v[1]) return null;
  return v as Okvir;
}

export function PreglednikLista({ list }: { list: List }) {
  const div = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletNS.Map | null = null;
    let otkazano = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (otkazano || !div.current) return;
      const j = 2 ** list.maksZum;
      const u = (x: number, y: number): LeafletNS.LatLngTuple => [-(y * list.visina) / j, (x * list.sirina) / j];
      const granice = L.latLngBounds(u(0, 0), u(1, 1));
      map = L.map(div.current, {
        crs: L.CRS.Simple,
        minZoom: 0,
        maxZoom: list.maksZum + 2,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        maxBounds: granice.pad(0.15),
        maxBoundsViscosity: 0.8,
        attributionControl: false,
        zoomControl: false,
      });
      L.control.zoom({ position: "bottomleft", zoomInTitle: "Približi", zoomOutTitle: "Udalji" }).addTo(map);
      L.tileLayer(`/gup/listovi/${list.id}/{z}/{x}_{y}.avif`, {
        tileSize: PLOCICA_LISTA,
        minZoom: 0,
        maxNativeZoom: list.maksZum,
        maxZoom: list.maksZum + 2,
        bounds: granice,
        noWrap: true,
      }).addTo(map);
      const okvir = okvirIzAdrese();
      if (okvir) {
        const o = L.latLngBounds(u(okvir[0], okvir[1]), u(okvir[2], okvir[3]));
        const t = tockaIzAdrese();
        // Istaknuto je naš znak, ne boja plana — maslina živa, samo crta: krug
        // na mjestu čestice, ili obrub okvira kad navod pokazuje dio lista.
        if (t) L.circleMarker(u(t[0], t[1]), { radius: 12, color: "#009767", weight: 3, fill: false, interactive: false }).addTo(map);
        else L.rectangle(o, { color: "#009767", weight: 3, fill: false, interactive: false, dashArray: "8 6" }).addTo(map);
        map.fitBounds(o, { padding: [32, 32] });
      } else {
        map.fitBounds(granice);
      }
    })();
    return () => {
      otkazano = true;
      map?.remove();
    };
  }, [list]);

  return <div ref={div} className="h-full w-full bg-white" role="region" aria-label={`${list.naslov} — pregled lista`} />;
}
