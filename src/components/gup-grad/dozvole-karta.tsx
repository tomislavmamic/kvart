"use client";

/**
 * Karta na /planovi/dozvole: plohe urbane sanacije prijedloga GUP-a 2025.
 * (zeleni rub, kao na listu 4.d), čestice u njima pod predmetima za
 * građevinsku ili lokacijsku dozvolu, obojene po ishodu (boje iz
 * BOJE_ISHODA; boju i vidljivost određuje DozvolePrikaz), i obuhvati
 * zahvata iz akata (bijela iscrtkana crta). Klik na česticu javlja se
 * prikazu, koji pokaže njezine predmete. Učitava se bez SSR-a.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { FeatureCollection } from "geojson";

import { BASE_LAYERS, SIRI_OBUHVAT_KARTE } from "@/lib/map-views";
import type { PodaciDozvola, ZnacajkaCestice, ZnacajkaPredmeta } from "@/lib/gup-grad/dozvole";

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

const SANACIJA = "#16a34a";

export interface CiljDozvola {
  /** Mijenja se pri svakom zahtjevu, da isti cilj dvaput opet pomakne kartu. */
  kljuc: number;
  /** [[jug, zapad], [sjever, istok]] */
  granice: [[number, number], [number, number]];
}

export function DozvoleKarta(props: {
  podaci: PodaciDozvola;
  cestice: ZnacajkaCestice[];
  predmeti: ZnacajkaPredmeta[];
  /** boja svake čestice (po indeksu u `cestice`), null = skrivena */
  boje: (string | null)[];
  odabrana: number | null;
  prikaziObuhvate: boolean;
  cilj: CiljDozvola | null;
  onOdaberi: (indeks: number) => void;
}) {
  const { podaci, cestice, predmeti, boje, odabrana, prikaziObuhvate, cilj, onOdaberi } = props;
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const slojevi = useRef<LeafletNS.Path[]>([]);
  const obuhvati = useRef<LeafletNS.GeoJSON | null>(null);
  const odaberi = useRef(onOdaberi);
  const stanje = useRef({ boje, odabrana, prikaziObuhvate });
  const osvjezi = useRef<() => void>(() => {});
  useEffect(() => {
    odaberi.current = onOdaberi;
  }, [onOdaberi]);

  useEffect(() => {
    let otkazano = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (otkazano || !div.current) return;
      const map = L.map(div.current, {
        minZoom: 12,
        maxZoom: 19,
        maxBounds: SIRI_OBUHVAT_KARTE,
        zoomSnap: 0.25,
      });
      mapa.current = map;
      const promatrac = new ResizeObserver(() => map.invalidateSize());
      promatrac.observe(div.current);
      map.on("unload", () => promatrac.disconnect());
      const podloge = Object.fromEntries(PODLOGE.map((p) => [p.naziv, podloga(L, p.id)]));
      podloge[PODLOGE[0].naziv].addTo(map);
      L.control.layers(podloge, undefined, { position: "topright" }).addTo(map);

      const sanacija = L.geoJSON(podaci.sanacija, {
        interactive: false,
        style: { color: SANACIJA, weight: 1.6, fillColor: SANACIJA, fillOpacity: 0.12 },
      }).addTo(map);

      const sloj = L.featureGroup().addTo(map);
      slojevi.current = cestice.map((f, i) => {
        const l = L.geoJSON(f, { style: { color: "#ffffff", weight: 1.2, fillOpacity: 0.65 } }).getLayers()[0] as LeafletNS.Path;
        l.on("click", () => odaberi.current(i));
        return l;
      });
      obuhvati.current = L.geoJSON(
        { type: "FeatureCollection", features: predmeti } as FeatureCollection,
        { interactive: false, style: { color: "#ffffff", weight: 1, dashArray: "3 3", fill: false } },
      );

      osvjezi.current = () => {
        const { boje: b, odabrana: o, prikaziObuhvate: po } = stanje.current;
        slojevi.current.forEach((l, i) => {
          const boja = b[i];
          if (!boja) {
            if (sloj.hasLayer(l)) sloj.removeLayer(l);
            return;
          }
          l.setStyle({
            fillColor: boja,
            color: i === o ? "#18181b" : "#ffffff",
            weight: i === o ? 3 : 1.2,
          });
          if (!sloj.hasLayer(l)) sloj.addLayer(l);
          if (i === o) l.bringToFront();
        });
        if (po && obuhvati.current && !map.hasLayer(obuhvati.current)) obuhvati.current.addTo(map);
        if (!po && obuhvati.current) obuhvati.current.remove();
      };
      osvjezi.current();
      map.fitBounds(sanacija.getBounds(), { padding: [8, 8] });
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
    stanje.current = { boje, odabrana, prikaziObuhvate };
    osvjezi.current();
  }, [boje, odabrana, prikaziObuhvate]);

  useEffect(() => {
    if (cilj) mapa.current?.flyToBounds(cilj.granice, { padding: [32, 32], maxZoom: 18, duration: 0.6 });
  }, [cilj]);

  return (
    <div
      ref={div}
      className="h-full w-full"
      role="application"
      aria-label="Karta čestica u urbanoj sanaciji sa zahtjevima za dozvolu"
    />
  );
}
