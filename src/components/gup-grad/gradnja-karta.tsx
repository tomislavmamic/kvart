"use client";

/**
 * Karta na /gup/gradnja: svaki piksel od ~2 m u obuhvatu GUP-a obojen
 * razlogom zbog kojeg se ondje po novom GUP-u ne može graditi ništa novo ili
 * ništa stambeno (src/lib/gup-grad/gradnja.ts), iz pločica
 * public/geo/gup-grad/gradnja (gradnja-plocice.ts). Pločice nose brojeve,
 * pa ih preglednik boji sam i prebojava kad se skupina u tumaču ugasi.
 *
 * Uz to granica GUP-a (iscrtkano), obrisi stambenih i mješovitih zona
 * (scripts/gup-grad/gradnja-zone.py) — gdje je plan uopće predvidio
 * stanovanje — i obris čestice pod zadnjim klikom. Slojevi nisu
 * interaktivni: klik bilo gdje ide karti, a što je ondje kaže GradnjaPrikaz.
 * Podloga je siva, da se boje čitaju. Učitava se bez SSR-a.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection } from "geojson";

import { SIRI_OBUHVAT_KARTE } from "@/lib/map-views";
import { KATEGORIJA_PO_KODU, type Skupina } from "@/lib/gup-grad/gradnja";
import type { Geometrija, Okvir } from "@/lib/gup-grad/zabrana";
import { PODLOGE, podloga, type CiljKarte } from "@/components/gup-grad/zabrana-karta";
import { procitaj, ucitajIndeks, type PlocicaGradnje } from "@/components/gup-grad/gradnja-plocice";

/** Ispod ovog zuma piksel rešetke manji je od piksela zaslona: slika se gladi (globals.css). */
const ZUM_OSTRIH_PIKSELA = 15;
/**
 * Obris stambenih i mješovitih zona: tanka tamna crta, ne zelena — zelena je
 * odgovor „stambeno moguće”, a 244 obrisa preko grada čitala bi se kao on.
 */
export const BOJA_STAMBENE_ZONE = "#27272a";
/** Izdaleka bi obrisi blokova prekrili boje; vide se tek od ovog zuma. */
export const OBRISI_OD_ZUMA = 15;

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BOJE = new Map(
  [...KATEGORIJA_PO_KODU].map(([kod, k]) => [
    kod,
    { rgb: hex(k.boja), a: Math.round(k.alfa * 255), skupina: k.skupina, pruge: k.pruge ? hex(k.pruge) : null },
  ]),
);
/** Razmak i debljina kosih pruga uvjetne gradnje, u pikselima pločice (~1,8 m). */
const PRUGE = { razmak: 6, debljina: 2 };

async function obojaj(kodovi: ImageData, skrivene: ReadonlySet<Skupina>): Promise<string | null> {
  const { width: w, height: h, data: d } = kodovi;
  const out = new ImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] !== 255) continue;
      const b = BOJE.get(d[i + 2]);
      if (!b || skrivene.has(b.skupina)) continue;
      const [r, g, bl, a] = b.pruge && (x + y) % PRUGE.razmak < PRUGE.debljina ? [...b.pruge, 230] : [...b.rgb, b.a];
      o[i] = r;
      o[i + 1] = g;
      o[i + 2] = bl;
      o[i + 3] = a;
    }
  }
  const platno = document.createElement("canvas");
  platno.width = w;
  platno.height = h;
  platno.getContext("2d")!.putImageData(out, 0, 0);
  const blob = await new Promise<Blob | null>((r) => platno.toBlob(r));
  return blob ? URL.createObjectURL(blob) : null;
}

interface Ucitana {
  sloj: LeafletNS.ImageOverlay;
  url: string | null;
}

const uGranice = (o: Okvir): LeafletNS.LatLngBoundsExpression => [
  [o[1], o[0]],
  [o[3], o[2]],
];

export function GradnjaKarta(props: {
  /** granica GUP-a */
  gup: Feature | null;
  /** stambene i mješovite zone (S, M1–M3, K5) */
  zone: FeatureCollection;
  skrivene: ReadonlySet<Skupina>;
  cilj: CiljKarte | null;
  oznaka: { lng: number; lat: number } | null;
  /** čestica pod zadnjim klikom */
  cestica: Geometrija | null;
  punZaslon?: boolean;
  onKlik: (lng: number, lat: number) => void;
}) {
  const { gup, zone, skrivene, cilj, oznaka, cestica, punZaslon = false, onKlik } = props;
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const tocka = useRef<LeafletNS.CircleMarker | null>(null);
  const obris = useRef<LeafletNS.LayerGroup | null>(null);
  const ucitane = useRef(new Map<string, Ucitana>());
  const skriveneRef = useRef(skrivene);
  const klik = useRef(onKlik);
  useEffect(() => {
    klik.current = onKlik;
  }, [onKlik]);

  useEffect(() => {
    let otkazano = false;
    const mapaPlocica = ucitane.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (otkazano || !div.current) return;
      LRef.current = L;
      const map = L.map(div.current, {
        minZoom: 12,
        maxZoom: 19,
        maxBounds: SIRI_OBUHVAT_KARTE,
        preferCanvas: true,
        zoomSnap: 0.25,
        // karta je usred stranice: kotačić lista stranicu, zum je na gumbima i prstima
        scrollWheelZoom: false,
      });
      mapa.current = map;
      const promatrac = new ResizeObserver(() => map.invalidateSize());
      promatrac.observe(div.current);
      map.on("unload", () => promatrac.disconnect());
      const podloge = Object.fromEntries(PODLOGE.map((p) => [p.naziv, podloga(L, p.id)]));
      podloge[PODLOGE[0].naziv].addTo(map);
      L.control.layers(podloge, undefined, { position: "topright" }).addTo(map);

      // kategorije ispod obrisa, iznad podloge
      const okno = map.createPane("gradnja");
      okno.style.zIndex = "390";
      okno.style.pointerEvents = "none";

      const netaknuto = { interactive: false } as const;
      // tanak bijeli rub ispod tamne crte, da se vidi i na tamnoj snimci
      const obrisiZona = L.layerGroup([
        L.geoJSON(zone, { ...netaknuto, style: { color: "#ffffff", weight: 2, opacity: 0.5, fill: false } }),
        L.geoJSON(zone, { ...netaknuto, style: { color: BOJA_STAMBENE_ZONE, weight: 1, opacity: 0.7, fill: false } }),
      ]);
      const obrisiPoZumu = () => {
        if (map.getZoom() >= OBRISI_OD_ZUMA) obrisiZona.addTo(map);
        else obrisiZona.remove();
      };
      map.on("zoomend", obrisiPoZumu);
      const granica = gup
        ? L.geoJSON(gup, { ...netaknuto, style: { color: "#18181b", weight: 1.5, dashArray: "7 5", fill: false } }).addTo(map)
        : null;
      if (granica) map.fitBounds(granica.getBounds(), { padding: [8, 8] });
      else map.setView([43.515, 16.47], 13);
      obrisiPoZumu();

      const ind = await ucitajIndeks().catch(() => null);
      if (otkazano || !ind) return;
      const osvjezi = async () => {
        if (otkazano) return;
        okno.classList.toggle("gup-regije-daleko", map.getZoom() < ZUM_OSTRIH_PIKSELA);
        const vidi = map.getBounds().pad(0.25);
        const trebaju: PlocicaGradnje[] = ind.plocice.filter((p) => vidi.intersects(L.latLngBounds(p.granice)));
        for (const p of trebaju) {
          if (mapaPlocica.has(p.url)) continue;
          try {
            const kodovi = await procitaj(p.url);
            if (otkazano || mapaPlocica.has(p.url)) continue;
            const url = await obojaj(kodovi, skriveneRef.current);
            if (otkazano || !url) continue;
            const sloj = L.imageOverlay(url, p.granice, { pane: "gradnja", interactive: false, className: "gup-regije" }).addTo(map);
            mapaPlocica.set(p.url, { sloj, url });
          } catch {
            // pločica se nije učitala; pokušat će se pri sljedećem pomaku karte
          }
        }
      };
      map.on("moveend", osvjezi);
      void osvjezi();
      map.on("click", (e: LeafletNS.LeafletMouseEvent) => klik.current(e.latlng.lng, e.latlng.lat));
    })();
    return () => {
      otkazano = true;
      for (const u of mapaPlocica.values()) if (u.url) URL.revokeObjectURL(u.url);
      mapaPlocica.clear();
      mapa.current?.remove();
      mapa.current = null;
    };
    // podaci stižu jednom, prije prvog crtanja karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // skupina ugašena ili upaljena u tumaču: učitane pločice samo se prebojaju
  useEffect(() => {
    skriveneRef.current = skrivene;
    let ziv = true;
    void (async () => {
      for (const [kljuc, u] of ucitane.current) {
        const url = await obojaj(await procitaj(kljuc), skrivene);
        if (!ziv || !url) return;
        if (u.url) URL.revokeObjectURL(u.url);
        u.url = url;
        u.sloj.setUrl(url);
      }
    })();
    return () => {
      ziv = false;
    };
  }, [skrivene]);

  useEffect(() => {
    const kotacic = mapa.current?.scrollWheelZoom;
    if (punZaslon) kotacic?.enable();
    else kotacic?.disable();
  }, [punZaslon]);

  useEffect(() => {
    const map = mapa.current;
    if (!map || !cilj) return;
    if (cilj.okvir) map.flyToBounds(uGranice(cilj.okvir), { padding: [24, 24], maxZoom: 17, duration: 0.6 });
    else if (cilj.tocka) map.flyTo([cilj.tocka[1], cilj.tocka[0]], Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [cilj]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    obris.current?.remove();
    if (!cestica) {
      obris.current = null;
      return;
    }
    // bijela crta ispod iscrtkane crne: vidi se i na tamnoj zgradi i na svijetloj ulici
    const f = { type: "Feature", properties: {}, geometry: cestica } as Feature;
    obris.current = L.layerGroup([
      L.geoJSON(f, { interactive: false, style: { color: "#ffffff", weight: 3.5, fill: false } }),
      L.geoJSON(f, { interactive: false, style: { color: "#18181b", weight: 1.5, fill: false, dashArray: "4 3" } }),
    ]).addTo(map);
  }, [cestica]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    tocka.current?.remove();
    tocka.current = oznaka
      ? L.circleMarker([oznaka.lat, oznaka.lng], {
          radius: 7,
          weight: 2.5,
          color: "#ffffff",
          fillColor: "#18181b",
          fillOpacity: 1,
          interactive: false,
          pane: "markerPane",
        }).addTo(map)
      : null;
  }, [oznaka]);

  return (
    <div
      ref={div}
      className="h-full w-full"
      role="application"
      aria-label="Karta područja u kojima se po novom GUP-u ne može graditi ništa novo ili ništa stambeno"
    />
  );
}
