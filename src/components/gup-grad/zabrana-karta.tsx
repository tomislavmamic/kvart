"use client";

/**
 * Karta na /gup/zabrana: privatno zemljište na kojem bi se po prijedlogu
 * GUP-a 2025. nova zgrada smjela graditi tek nakon donošenja UPU-a
 * (zabrana-2025.geojson, komadi s „fokus”): urbana sanacija (crveno; list 4.d
 * je crta zeleno) i urbana preobrazba stambenih i mješovitih zona izvan
 * gradskih projekata (narančasto). Neuređeni dio (uz postojeću cestu gradi se
 * i prije UPU-a), preobrazba gospodarskih zona i gradskih projekata te dijelovi
 * oznaka na ulicama, javnoj, športskoj i zelenoj namjeni nisu obojeni; ostaju u
 * podacima, da klik ondje kaže što vrijedi. Oznaka se boji u dva tona:
 * svjetliji je zona, a tamniji čestice s mjestom za novu zgradu, na kojima
 * zabrana stvarno priječi gradnju (zabrana-cestice-2025.geojson,
 * TAMNE_ZABRANE). Od zuma CESTICE_OD_ZUMA te čestice dobivaju i tanak rub, da
 * se susjedne razlikuju. Za snalaženje su tu planovi na snazi (sivo), obuhvati
 * propisanih UPU-a u kojima su te čestice (plavi rub; upuNaKarti), granica
 * GUP-a (jedina iscrtkana crta) i, od
 * ZGRADE_OD_ZUMA, zgrade iz gradskog 3D modela (tlocrti onoga što stoji na
 * tlu, pločice iz cestice.py), iznad oznaka. Podloga je siva, da se boje
 * oznaka čitaju.
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
import { plocnik } from "@/lib/gup-grad/plocnik";
import { BOJE_ZABRANE, PROZIRNOST_ZABRANE, TAMNE_ZABRANE, type Okvir, type Podrucje } from "@/lib/gup-grad/zabrana";

export interface CiljKarte {
  /** Mijenja se pri svakom zahtjevu, da isti cilj dvaput opet pomakne kartu. */
  kljuc: number;
  okvir?: Okvir;
  tocka?: [number, number];
}

export interface OznakaKarte {
  lng: number;
  lat: number;
  uZabrani: boolean;
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
    ? L.tileLayer(`/api/podloga/${b.id}/{z}/{x}/{y}`, { ...zajednicko, tileSize: 512, zoomOffset: -1, className: "podloga-siva" })
    : L.tileLayer(b.url, { ...zajednicko, subdomains: "abcd", maxNativeZoom: b.maxNativeZoom, className: "podloga-siva" });
}

const zbirka = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

/** Od ovog zuma čestice s mjestom za zgradu imaju rub; izdaleka bi rubovi zamutili ton. */
export const CESTICE_OD_ZUMA = 15;
/** Zgrade su gušće od čestica, a pločica ima stotine kilobajta: tek izbliza. */
export const ZGRADE_OD_ZUMA = 16;

const uGranice = (o: Okvir): LeafletNS.LatLngBoundsExpression => [
  [o[1], o[0]],
  [o[3], o[2]],
];

export function ZabranaKarta(props: {
  zabrana: FeatureCollection;
  planovi: FeatureCollection;
  cestice: FeatureCollection;
  /** brojevi UPU-a čiji se obuhvat crta: oni u kojima su obojene čestice */
  upuNaKarti: number[];
  prikaziZabranu: boolean;
  odabraniUpu: number | null;
  cilj: CiljKarte | null;
  oznaka: OznakaKarte | null;
  /** karta preko cijelog zaslona: nema stranice ispod, pa kotačić zumira */
  punZaslon?: boolean;
  onKlik: (lng: number, lat: number) => void;
}) {
  const { zabrana, planovi, cestice, upuNaKarti, prikaziZabranu, odabraniUpu, cilj, oznaka, punZaslon = false, onKlik } = props;
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const slojZabrane = useRef<LeafletNS.Layer | null>(null);
  const slojCestica = useRef<LeafletNS.GeoJSON | null>(null);
  const slojZgrada = useRef<LeafletNS.GeoJSON | null>(null);
  const isticanje = useRef<LeafletNS.GeoJSON | null>(null);
  const tocka = useRef<LeafletNS.CircleMarker | null>(null);
  const klik = useRef(onKlik);
  const zabranaVidljiva = useRef(prikaziZabranu);
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
      // okvir mijenja veličinu (cijeli zaslon, okretanje mobitela), a Leaflet to sam ne primijeti
      const promatrac = new ResizeObserver(() => map.invalidateSize());
      promatrac.observe(div.current);
      map.on("unload", () => promatrac.disconnect());
      const podloge = Object.fromEntries(PODLOGE.map((p) => [p.naziv, podloga(L, p.id)]));
      podloge[PODLOGE[0].naziv].addTo(map);
      L.control.layers(podloge, undefined, { position: "topright" }).addTo(map);

      const gup = zabrana.features.filter((f) => f.properties?.vrsta === "gup");
      const komadi = zabrana.features.filter((f) => f.properties?.fokus === true);
      const netaknuto = { interactive: false } as const;

      L.geoJSON(zbirka(planovi.features.filter((f) => f.properties?.vrsta === "vazeci")), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.vazeci, weight: 1, fillColor: BOJE_ZABRANE.vazeci, fillOpacity: 0.35 },
      }).addTo(map);
      slojZabrane.current = L.geoJSON(zbirka(komadi), {
        ...netaknuto,
        style: (f) => ({
          stroke: false,
          fillColor: BOJE_ZABRANE[f?.properties?.vrsta as Podrucje],
          fillOpacity: PROZIRNOST_ZABRANE.podrucje,
        }),
      }).addTo(map);
      slojCestica.current = L.geoJSON(zbirka(cestice.features.filter((f) => f.properties?.fokus === true && f.properties?.vrsta)), {
        ...netaknuto,
        style: (f) => ({
          stroke: false,
          color: BOJE_ZABRANE.cestica,
          weight: 0.6,
          opacity: 0.5,
          fillColor: TAMNE_ZABRANE[f?.properties?.vrsta as Podrucje],
          fillOpacity: PROZIRNOST_ZABRANE.cestica,
        }),
      }).addTo(map);
      // zgrade u vlastitom oknu: iznad oznaka i obuhvata
      const oknoZgrada = map.createPane("zgrade");
      oknoZgrada.style.zIndex = "420";
      oknoZgrada.style.pointerEvents = "none";
      const zgrade = L.geoJSON(undefined, {
        ...netaknuto,
        pane: "zgrade",
        // pločice nose i katastarske zgrade (s: k); na tlu je ono što je snimio 3D model (s: m)
        filter: (f) => f.properties?.s === "m",
        style: { stroke: false, fillColor: BOJE_ZABRANE.zgrada, fillOpacity: 0.6 },
      });
      slojZgrada.current = zgrade;
      const ucitajZgrade = plocnik<{ s: string }>("/geo/gup-grad/zgrade-indeks.json", "/geo/gup-grad/zgrade", (fc) => {
        if (!otkazano) zgrade.addData(fc);
      });
      map.on("moveend", () => {
        if (map.getZoom() >= ZGRADE_OD_ZUMA) ucitajZgrade(L, map.getBounds().pad(0.2), () => {}).catch(() => {});
      });
      L.geoJSON(zbirka(planovi.features.filter((f) => f.properties?.vrsta === "propisan" && upuNaKarti.includes(f.properties?.broj))), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.upu, weight: 1.5, fill: false },
      }).addTo(map);
      const granica = L.geoJSON(zbirka(gup), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.gup, weight: 1.5, dashArray: "7 5", fill: false },
      }).addTo(map);

      map.fitBounds(granica.getBounds(), { padding: [8, 8] });
      const prikazi = (sloj: LeafletNS.Layer | null | undefined, vidi: boolean) => {
        if (!sloj) return;
        if (vidi && !map.hasLayer(sloj)) sloj.addTo(map);
        if (!vidi && map.hasLayer(sloj)) sloj.remove();
      };
      const cesticePoZumu = () => {
        const z = map.getZoom();
        prikazi(slojZabrane.current, zabranaVidljiva.current);
        prikazi(slojCestica.current, zabranaVidljiva.current);
        prikazi(slojZgrada.current, z >= ZGRADE_OD_ZUMA);
        slojCestica.current?.setStyle({ stroke: z >= CESTICE_OD_ZUMA });
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
    zabranaVidljiva.current = prikaziZabranu;
    osvjeziCestice.current();
  }, [prikaziZabranu]);

  useEffect(() => {
    const kotacic = mapa.current?.scrollWheelZoom;
    if (punZaslon) kotacic?.enable();
    else kotacic?.disable();
  }, [punZaslon]);

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
          fillColor: oznaka.uZabrani ? "#18181b" : "#ffffff",
          fillOpacity: 1,
          interactive: false,
          // iznad zgrada (okno 420)
          pane: "markerPane",
        }).addTo(map)
      : null;
  }, [oznaka]);

  return <div ref={div} className="h-full w-full" role="application" aria-label="Karta područja na kojima bi se nove zgrade smjele graditi tek nakon donošenja UPU-a" />;
}
