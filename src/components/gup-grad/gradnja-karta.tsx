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
import { KATEGORIJA_PO_ID, KATEGORIJA_PO_KODU, razlozi, type IdKategorije } from "@/lib/gup-grad/gradnja";
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
    {
      rgb: hex(k.boja),
      a: Math.round(k.alfa * 255),
      id: k.id,
      pruge: k.pruge ? hex(k.pruge) : null,
      prugeA: Math.round((k.prugeAlfa ?? 0.9) * 255),
      mreza: !!k.mreza,
    },
  ]),
);
/** Strana pločice u pikselima (scripts/gup-grad/regije.py, PLOCICA). */
const PLOCICA = 512;

/**
 * Razmak i debljina pruga u pikselima pločice (~1,8 m) za zum. Pruge od 6 px
 * izdaleka su uže od piksela zaslona i preglednik ih zagladi u jednoličnu
 * boju, pa se šrafirano ne bi razlikovalo od punog. Zato razmak raste s
 * udaljenošću, da pruge na zaslonu ostanu ~6 px jedna od druge.
 */
export function prugeZaZum(zum: number): { razmak: number; debljina: number; debljinaMreze: number; razina: number } {
  const razina = Math.min(16, Math.max(13, Math.round(zum)));
  const razmak = 6 * 2 ** (16 - razina);
  return { razmak, debljina: Math.max(2, Math.round(razmak / 3)), debljinaMreze: Math.max(2, Math.round(razmak / 4)), razina };
}

/** Red i stupac pločice iz njezina imena (`…/<red>_<stupac>.png`): pruge se crtaju u koordinatama cijele mreže, bez šava. */
function polozaj(url: string): [number, number] {
  const m = /(\d+)_(\d+)\.png$/.exec(url);
  return m ? [Number(m[1]) * PLOCICA, Number(m[2]) * PLOCICA] : [0, 0];
}

const JAVNO = KATEGORIJA_PO_ID.javno.kod;

async function obojaj(url: string, kodovi: ImageData, skrivene: ReadonlySet<IdKategorije>, zum: number): Promise<string | null> {
  const { width: w, height: h, data: d } = kodovi;
  const { razmak, debljina, debljinaMreze } = prugeZaZum(zum);
  const [y0, x0] = polozaj(url);
  const out = new ImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] !== 255) continue;
      // javno zemljište boji se kao javno, a kad je ta stavka ugašena, nestane s karte: razlog
      // ispod njega nije prošao provjere širine i odmaka (javno se ne spaja u gradilište), pa
      // bi se ondje pokazale tanke „zelene” trake uz ceste
      const { kategorija, vlasnik } = razlozi(d[i + 2]);
      const b = BOJE.get(vlasnik > 0 ? JAVNO : kategorija);
      if (!b || skrivene.has(b.id)) continue;
      const gx = x0 + x, gy = y0 + y;
      const pruga =
        b.pruge &&
        (b.mreza
          ? (gx + gy) % razmak < debljinaMreze || (gx - gy + razmak * 1e4) % razmak < debljinaMreze
          : (gx + gy) % razmak < debljina);
      const [r, g, bl, a] = pruga ? [...b.pruge!, b.prugeA] : [...b.rgb, b.a];
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

/** Ponovno oboji sve učitane pločice; prekida se kad ga stigne novije bojenje (`jos` vrati false). */
async function prebojaj(ucitane: Map<string, Ucitana>, skrivene: ReadonlySet<IdKategorije>, zum: number, jos: () => boolean) {
  for (const [kljuc, u] of ucitane) {
    const url = await obojaj(kljuc, await procitaj(kljuc), skrivene, zum);
    if (!jos() || !url) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    if (u.url) URL.revokeObjectURL(u.url);
    u.url = url;
    u.sloj.setUrl(url);
  }
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
  /** kategorije ugašene u tumaču */
  skrivene: ReadonlySet<IdKategorije>;
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
  /** Razina pruga po kojoj su pločice obojane (prugeZaZum) i redni broj bojenja. */
  const razinaRef = useRef(0);
  const bojenje = useRef(0);
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
        // druga razina pruga: učitane pločice prebojaju se s novim razmakom
        const razina = prugeZaZum(map.getZoom()).razina;
        if (razina !== razinaRef.current) {
          const prva = razinaRef.current === 0;
          razinaRef.current = razina;
          if (!prva) {
            const n = ++bojenje.current;
            void prebojaj(mapaPlocica, skriveneRef.current, razina, () => !otkazano && n === bojenje.current);
          }
        }
        const vidi = map.getBounds().pad(0.25);
        const trebaju: PlocicaGradnje[] = ind.plocice.filter((p) => vidi.intersects(L.latLngBounds(p.granice)));
        for (const p of trebaju) {
          if (mapaPlocica.has(p.url)) continue;
          try {
            const kodovi = await procitaj(p.url);
            if (otkazano || mapaPlocica.has(p.url)) continue;
            const url = await obojaj(p.url, kodovi, skriveneRef.current, razinaRef.current);
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
    if (skriveneRef.current === skrivene) return;
    skriveneRef.current = skrivene;
    const n = ++bojenje.current;
    void prebojaj(ucitane.current, skrivene, razinaRef.current, () => n === bojenje.current);
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
