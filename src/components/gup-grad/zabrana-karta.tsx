"use client";

/**
 * Karta na /gup/zabrana: crveno je zemljište gdje bi prijedlog GUP-a 2025.
 * zabranio novu gradnju do donošenja UPU-a (zabrana-2025.geojson), uz
 * planove na snazi, obuhvate propisanih UPU-a i granicu GUP-a. Od zuma
 * ČESTICE_OD_ZUMA vide se i čestice sa slobodnim zemljištem koje bi čekalo
 * UPU (zabrana-cestice-2025.geojson): neizgrađene punom bojom, djelomično
 * izgrađene samo iscrtkanim rubom (ispuna bi se na tamnoj snimci stopila s punom).
 *
 * Karta samo crta i javlja klik; što je na kojoj točki računa
 * ZabranaPrikaz (stanjeTocke u src/lib/gup-grad/zabrana.ts). Slojevi nisu
 * interaktivni, pa klik bilo gdje ide karti. Učitava se bez SSR-a.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection } from "geojson";

import { BASE_LAYERS, SIRI_OBUHVAT_KARTE } from "@/lib/map-views";
import { BOJE_ZABRANE, type Okvir } from "@/lib/gup-grad/zabrana";

export interface CiljKarte {
  /** Mijenja se pri svakom zahtjevu, da isti cilj dvaput opet pomakne kartu. */
  kljuc: number;
  okvir?: Okvir;
  tocka?: [number, number];
}

export interface OznakaKarte {
  lng: number;
  lat: number;
  crveno: boolean;
}

// Isto kao /gup: DGU-ov ortofoto je zadan. CARTO-ova ulična karta sad bez
// ključa vraća pločice s natpisom „API KEY REQUIRED”, pa je ovdje nema.
const PODLOGE = [
  { id: "dof-2025", naziv: "Ortofoto 2025." },
  { id: "satelit", naziv: "Satelitska snimka (2023.)" },
] as const;

function podloga(L: typeof LeafletNS, id: string): LeafletNS.TileLayer {
  const b = BASE_LAYERS.find((x) => x.id === id)!;
  const zajednicko = { attribution: b.attribution, maxZoom: 19, bounds: SIRI_OBUHVAT_KARTE };
  // WMS ide kroz naš posrednik (src/app/api/podloga), kao na /gup i /karta
  return b.type === "wms"
    ? L.tileLayer(`/api/podloga/${b.id}/{z}/{x}/{y}`, { ...zajednicko, tileSize: 512, zoomOffset: -1 })
    : L.tileLayer(b.url, { ...zajednicko, subdomains: "abcd", maxNativeZoom: b.maxNativeZoom });
}

const zbirka = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

/** Čestice su sitne; na pregledu cijelog grada samo bi zamutile crveno. */
export const CESTICE_OD_ZUMA = 14;

const uGranice = (o: Okvir): LeafletNS.LatLngBoundsExpression => [
  [o[1], o[0]],
  [o[3], o[2]],
];

export function ZabranaKarta(props: {
  zabrana: FeatureCollection;
  planovi: FeatureCollection;
  cestice: FeatureCollection;
  crveno: boolean;
  odabraniUpu: number | null;
  cilj: CiljKarte | null;
  oznaka: OznakaKarte | null;
  onKlik: (lng: number, lat: number) => void;
}) {
  const { zabrana, planovi, cestice, crveno, odabraniUpu, cilj, oznaka, onKlik } = props;
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const crveniSloj = useRef<LeafletNS.LayerGroup | null>(null);
  const slojCestica = useRef<LeafletNS.GeoJSON | null>(null);
  const isticanje = useRef<LeafletNS.GeoJSON | null>(null);
  const tocka = useRef<LeafletNS.CircleMarker | null>(null);
  const klik = useRef(onKlik);
  const crvenoVidljivo = useRef(crveno);
  const osvjeziCestice = useRef<() => void>(() => {});
  useEffect(() => {
    klik.current = onKlik;
  }, [onKlik]);

  useEffect(() => {
    let otkazano = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (otkazano || !div.current) return;
      LRef.current = L;
      const map = L.map(div.current, {
        minZoom: 12,
        maxZoom: 19,
        maxBounds: SIRI_OBUHVAT_KARTE,
        preferCanvas: true,
        // cijeli GUP stane tijesno i u uski prozor
        zoomSnap: 0.25,
        // karta je usred stranice: kotačić lista stranicu, zum je na gumbima i prstima
        scrollWheelZoom: false,
      });
      mapa.current = map;
      const podloge = Object.fromEntries(PODLOGE.map((p) => [p.naziv, podloga(L, p.id)]));
      podloge[PODLOGE[0].naziv].addTo(map);
      L.control.layers(podloge, undefined, { position: "topright" }).addTo(map);

      const gup = zabrana.features.filter((f) => f.properties?.vrsta === "gup");
      const komadi = zabrana.features.filter((f) => !["gup", "obris"].includes(f.properties?.vrsta));
      const obris = zabrana.features.filter((f) => f.properties?.vrsta === "obris");
      const netaknuto = { interactive: false } as const;

      L.geoJSON(zbirka(planovi.features.filter((f) => f.properties?.vrsta === "vazeci")), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.vazeci, weight: 1.2, dashArray: "4 3", fillColor: BOJE_ZABRANE.vazeci, fillOpacity: 0.12 },
      }).addTo(map);
      crveniSloj.current = L.layerGroup([
        L.geoJSON(zbirka(komadi), {
          ...netaknuto,
          style: { stroke: false, fillColor: BOJE_ZABRANE.crveno, fillOpacity: 0.45 },
        }),
        L.geoJSON(zbirka(obris), {
          ...netaknuto,
          style: { color: BOJE_ZABRANE.crvenoRub, weight: 1.5, fill: false },
        }),
      ]).addTo(map);
      slojCestica.current = L.geoJSON(cestice, {
        ...netaknuto,
        style: (f) =>
          f?.properties?.neizgradjena
            ? { color: BOJE_ZABRANE.cesticaRub, weight: 1, fillColor: BOJE_ZABRANE.cestica, fillOpacity: 0.6 }
            : { color: BOJE_ZABRANE.cesticaRub, weight: 1.4, dashArray: "4 3", fillColor: BOJE_ZABRANE.cestica, fillOpacity: 0.05 },
      });
      L.geoJSON(zbirka(planovi.features.filter((f) => f.properties?.vrsta === "propisan")), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.upu, weight: 1.2, fill: false },
      }).addTo(map);
      const granica = L.geoJSON(zbirka(gup), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.gup, weight: 1.5, dashArray: "7 5", fill: false },
      }).addTo(map);

      map.fitBounds(granica.getBounds(), { padding: [8, 8] });
      const cesticePoZumu = () => {
        const sloj = slojCestica.current;
        if (!sloj) return;
        const vidi = map.getZoom() >= CESTICE_OD_ZUMA && crvenoVidljivo.current;
        if (vidi && !map.hasLayer(sloj)) sloj.addTo(map);
        if (!vidi && map.hasLayer(sloj)) sloj.remove();
      };
      cesticePoZumu();
      map.on("zoomend", cesticePoZumu);
      osvjeziCestice.current = cesticePoZumu;
      map.on("click", (e: LeafletNS.LeafletMouseEvent) => klik.current(e.latlng.lng, e.latlng.lat));
    })();
    return () => {
      otkazano = true;
      mapa.current?.remove();
      mapa.current = null;
    };
    // podaci stižu jednom, prije prvog crtanja karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapa.current, sloj = crveniSloj.current;
    if (!map || !sloj) return;
    crvenoVidljivo.current = crveno;
    if (crveno && !map.hasLayer(sloj)) sloj.addTo(map);
    if (!crveno && map.hasLayer(sloj)) sloj.remove();
    osvjeziCestice.current();
  }, [crveno]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    isticanje.current?.remove();
    isticanje.current = null;
    if (odabraniUpu === null) return;
    const f = planovi.features.filter((x) => x.properties?.vrsta === "propisan" && x.properties?.broj === odabraniUpu);
    if (!f.length) return;
    isticanje.current = L.geoJSON(zbirka(f), {
      interactive: false,
      style: { color: BOJE_ZABRANE.upu, weight: 3.5, fill: false },
    }).addTo(map);
  }, [odabraniUpu, planovi]);

  useEffect(() => {
    const map = mapa.current;
    if (!map || !cilj) return;
    if (cilj.okvir) map.flyToBounds(uGranice(cilj.okvir), { padding: [24, 24], maxZoom: 17, duration: 0.6 });
    else if (cilj.tocka) map.flyTo([cilj.tocka[1], cilj.tocka[0]], Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [cilj]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    tocka.current?.remove();
    tocka.current = oznaka
      ? L.circleMarker([oznaka.lat, oznaka.lng], {
          radius: 7,
          weight: 2.5,
          color: "#18181b",
          fillColor: oznaka.crveno ? BOJE_ZABRANE.crveno : "#ffffff",
          fillOpacity: 1,
          interactive: false,
        }).addTo(map)
      : null;
  }, [oznaka]);

  return <div ref={div} className="h-full w-full" role="application" aria-label="Karta područja na kojima bi se nove zgrade smjele graditi tek nakon donošenja UPU-a" />;
}
