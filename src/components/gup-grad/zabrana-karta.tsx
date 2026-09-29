"use client";

/**
 * Karta na /gup/zabrana: gdje bi prijedlog GUP-a 2025. zabranio novu gradnju
 * do donošenja UPU-a (zabrana-2025.geojson). Tri oznake imaju svoje boje
 * (BOJE_ZABRANE; kao na listu 4.d, osim sanacije, koja je crvena jer i ona
 * priječi gradnju): urbanu sanaciju i preobrazbu određuje
 * GUP, a neuređeni dio PPUG, iz kojega ga GUP preuzima. Za snalaženje su tu
 * planovi na snazi (sivo), obuhvati propisanih UPU-a (plavi rub) i granica
 * GUP-a (jedina iscrtkana crta). Oznaka se boji samo u zonama za gradnju, i to u
 * dva tona: svjetliji je zona, a tamniji čestice s mjestom za novu zgradu, na
 * kojima zabrana stvarno priječi gradnju (zabrana-cestice-2025.geojson,
 * TAMNE_ZABRANE). Dio oznake na ulicama, javnoj, športskoj ili zelenoj namjeni
 * gotovo bijel („negradivo”), kao izbrisan: ondje se privatna zgrada ne gradi ni
 * bez zabrane. Plan na snazi ostaje srednje siv, da se to dvoje ne miješa. Od
 * zuma CESTICE_OD_ZUMA te čestice dobivaju i tanak rub, da se susjedne razlikuju.
 *
 * Ljubičasto je sporno (sporne-2025.geojson): tanke kose crte preko čestice
 * ili plohe kad oznaka ne odgovara kriteriju Grada ili zakonu, točke kad je
 * čestica uz cestu koje nema u registru ili joj širina nije izmjerena
 * (moguće sporno). Čestica je izdaleka premalena za uzorak, pa je do
 * SRAFURA_OD_ZUMA mrlja, puna za sporno i blijeda za moguće sporno; ploha je
 * dovoljno velika i ostaje precrtana. Crte i točke su SVG uzorci u pikselima
 * zaslona, jednako gusti na svakom zumu; platno (canvas) uzorke ne zna, pa ih
 * crta SVG. Od SPORNO_CESTE_OD_ZUMA vide se i
 * sve ceste kroz zabranu, cijelom duljinom: jednak tamni obrub, a sredina
 * kaže širinu čestice ceste (prazna od 4 m naviše, crvena uža, siva
 * neizmjerena). Sporno je u vlastitom sloju karte (pane), iznad oznaka.
 * Od ZGRADE_OD_ZUMA vide se i zgrade iz gradskog 3D modela (tlocrti onoga što
 * stoji na tlu, pločice iz cestice.py), iznad oznaka a ispod spornog.
 * Podloga je siva, da se boje oznaka čitaju.
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

const SRAFURA = "zabrana-sporno-srafura";
const TOCKE = "zabrana-sporno-tocke";

/** Uzorci kosih crta i točaka u SVG-u sloja spornog; pune se kao fillColor: url(#SRAFURA), url(#TOCKE). */
function dodajUzorke(svg: SVGSVGElement | null | undefined) {
  if (!svg || svg.querySelector(`#${SRAFURA}`)) return;
  const ns = "http://www.w3.org/2000/svg";
  const element = (ime: string, atributi: Record<string, string>) => {
    const e = document.createElementNS(ns, ime);
    for (const [k, v] of Object.entries(atributi)) e.setAttribute(k, v);
    return e;
  };
  const defs = element("defs", {});
  const srafura = element("pattern", { id: SRAFURA, patternUnits: "userSpaceOnUse", width: "7", height: "7", patternTransform: "rotate(45)" });
  // crta po sredini pločice, da je pločica ne odreže napola
  srafura.appendChild(element("line", { x1: "3.5", y1: "0", x2: "3.5", y2: "7", stroke: BOJE_ZABRANE.sporno, "stroke-width": "1.2" }));
  const tocke = element("pattern", { id: TOCKE, patternUnits: "userSpaceOnUse", width: "6", height: "6" });
  tocke.appendChild(element("circle", { cx: "3", cy: "3", r: "1.3", fill: BOJE_ZABRANE.sporno }));
  defs.append(srafura, tocke);
  svg.insertBefore(defs, svg.firstChild);
}

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
/** Sporno se vidi i na pregledu cijelog grada: odmah se vidi gdje ga ima. */
export const SPORNO_OD_ZUMA = 12;
/** Od ovog zuma sporna čestica ima dovoljno piksela za kose crte; prije je puna mrlja. */
export const SRAFURA_OD_ZUMA = 16;
/** Osi cesta po širini: gušće su od čestica, pa tek izbliza. */
export const SPORNO_CESTE_OD_ZUMA = 15;
/** Zgrade su gušće i od cesta, a pločica ima stotine kilobajta: tek izbliza. */
export const ZGRADE_OD_ZUMA = 16;

const uGranice = (o: Okvir): LeafletNS.LatLngBoundsExpression => [
  [o[1], o[0]],
  [o[3], o[2]],
];

export function ZabranaKarta(props: {
  zabrana: FeatureCollection;
  planovi: FeatureCollection;
  cestice: FeatureCollection;
  sporne: FeatureCollection | null;
  prikaziZabranu: boolean;
  sporno: boolean;
  odabraniUpu: number | null;
  cilj: CiljKarte | null;
  oznaka: OznakaKarte | null;
  /** karta preko cijelog zaslona: nema stranice ispod, pa kotačić zumira */
  punZaslon?: boolean;
  onKlik: (lng: number, lat: number) => void;
}) {
  const { zabrana, planovi, cestice, sporne, prikaziZabranu, sporno, odabraniUpu, cilj, oznaka, punZaslon = false, onKlik } = props;
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
  const spornoVidljivo = useRef(sporno);
  const slojeviSpornog = useRef<{
    cestice: LeafletNS.Layer;
    izbliza: LeafletNS.Layer;
    izdaleka: LeafletNS.Layer;
    ceste: LeafletNS.Layer;
  } | null>(null);
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
      const komadi = zabrana.features.filter((f) => !["gup", "obris"].includes(f.properties?.vrsta));
      const netaknuto = { interactive: false } as const;

      L.geoJSON(zbirka(planovi.features.filter((f) => f.properties?.vrsta === "vazeci")), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.vazeci, weight: 1, fillColor: BOJE_ZABRANE.vazeci, fillOpacity: 0.35 },
      }).addTo(map);
      slojZabrane.current = L.geoJSON(zbirka(komadi), {
        ...netaknuto,
        style: (f) =>
          f?.properties?.vrsta === "negradivo"
            ? { stroke: false, fillColor: BOJE_ZABRANE.negradivo, fillOpacity: 0.8 }
            : {
                stroke: false,
                fillColor: BOJE_ZABRANE[(f?.properties?.vrsta as Podrucje) ?? "neuredeno"],
                fillOpacity: PROZIRNOST_ZABRANE.podrucje,
              },
      }).addTo(map);
      // čestica bez oznake pod sobom (nekoliko rubnih) nije ni u jednom obojenom području
      slojCestica.current = L.geoJSON(zbirka(cestice.features.filter((f) => f.properties?.vrsta)), {
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
      // zgrade u vlastitom oknu: iznad oznaka i obuhvata, ispod spornog i cesta
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
      L.geoJSON(zbirka(planovi.features.filter((f) => f.properties?.vrsta === "propisan")), {
        ...netaknuto,
        style: { color: BOJE_ZABRANE.upu, weight: 1.5, fill: false },
      }).addTo(map);
      if (sporne) {
        map.createPane("sporno").style.zIndex = "450";
        // SVG ide u okno prije platna s cestama, pa su ceste iznad šrafure. Karta
        // dodaje sloj tek kad dobije pogled, pa se uzorak upisuje na „add”.
        const svg = L.svg({ pane: "sporno" });
        svg.on("add", () => dodajUzorke(map.getPane("sporno")?.querySelector("svg")));
        svg.addTo(map);
        const u = { ...netaknuto, pane: "sporno" } as const;
        const ceste = zbirka(sporne.features.filter((f) => f.properties?.vrsta === "cesta"));
        const jako = (f?: Feature) => f?.properties?.vrsta === "ploha" || !(f?.properties?.razlozi ?? []).every((r: string) => r === "cesta" || r === "izgradjena");
        const sporneCestice = sporne.features.filter((f) => f.properties?.vrsta === "cestica" || (f.properties?.vrsta === "ploha" && f.properties?.manjina));
        // čestica u spornoj plohi sanacije sporna je samo zbog plohe, a nju šrafura već pokriva
        const jake = sporneCestice.filter((f) => jako(f) && f.properties?.podrucje !== "sanacija");
        const jakeCestice = zbirka(jake.filter((f) => f.properties?.vrsta === "cestica"));
        const slabeCestice = zbirka(sporneCestice.filter((f) => !jako(f)));
        const uzorak = (fc: FeatureCollection, id: string) =>
          L.geoJSON(fc, { ...u, style: { renderer: svg, stroke: false, fillColor: `url(#${id})`, fillOpacity: 1 } });
        // rub od 2 px da ni čestica manja od piksela ne nestane
        const mrlja = (fc: FeatureCollection, neprozirnost: number) =>
          L.geoJSON(fc, {
            ...u,
            style: { color: BOJE_ZABRANE.sporno, weight: 2, opacity: neprozirnost, fillColor: BOJE_ZABRANE.sporno, fillOpacity: neprozirnost },
          });
        slojeviSpornog.current = {
          cestice: uzorak(zbirka(jake.filter((f) => f.properties?.vrsta === "ploha")), SRAFURA),
          izbliza: L.layerGroup([uzorak(jakeCestice, SRAFURA), uzorak(slabeCestice, TOCKE)]),
          izdaleka: L.layerGroup([mrlja(slabeCestice, 0.35), mrlja(jakeCestice, 0.85)]),
          // obrub pa sredina: grupa dodaje slojeve redom, pa se sredina crta preko obruba
          ceste: L.layerGroup([
            L.geoJSON(ceste, { ...u, style: { color: BOJE_ZABRANE.cesta, weight: 7, opacity: 0.9, lineCap: "butt" } }),
            L.geoJSON(ceste, {
              ...u,
              style: (f) => ({
                color:
                  f?.properties?.sirina === "4+"
                    ? BOJE_ZABRANE.cestaSiroka
                    : f?.properties?.sirina === "<4"
                      ? BOJE_ZABRANE.cestaUska
                      : BOJE_ZABRANE.cestaNepoznata,
                weight: 3.5,
                opacity: 1,
                lineCap: "butt",
              }),
            }),
          ]),
        };
      }
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
        const sp = slojeviSpornog.current;
        prikazi(sp?.cestice, z >= SPORNO_OD_ZUMA && spornoVidljivo.current);
        prikazi(sp?.izbliza, z >= SRAFURA_OD_ZUMA && spornoVidljivo.current);
        prikazi(sp?.izdaleka, z >= SPORNO_OD_ZUMA && z < SRAFURA_OD_ZUMA && spornoVidljivo.current);
        prikazi(sp?.ceste, z >= SPORNO_CESTE_OD_ZUMA && spornoVidljivo.current);
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
    spornoVidljivo.current = sporno;
    osvjeziCestice.current();
  }, [sporno]);

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
          // iznad šrafure spornog (okno 450)
          pane: "markerPane",
        }).addTo(map)
      : null;
  }, [oznaka]);

  return <div ref={div} className="h-full w-full" role="application" aria-label="Karta područja na kojima bi se nove zgrade smjele graditi tek nakon donošenja UPU-a" />;
}
