/**
 * Karta simulatora: podloge, reljef, zgrade i postaje.
 *
 * Odvojeno od `/karta`, iako se podloge preklapaju. Ta karta stoji na Leafletu
 * i nosi tri tisuće redaka planerskog alata — čestice, planovi, vremeplov,
 * vlasništvo. Ovdje treba drugo: jedan okvir oko plohe, nekoliko podloga i
 * WebGL sloj koji crta zrak. Uplesti to u postojeću komponentu značilo bi da
 * svaka promjena simulatora dira i planersku kartu.
 *
 * Zajedničko im ostaje ono što i treba: iste adrese podloga i isti navodi
 * izvora (`src/lib/map-views.ts`), pa se dvije karte istoga kvarta ne mogu
 * razići u tome što pokazuju.
 */

import type { StyleSpecification } from "maplibre-gl";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import { SIM_POSTAJE } from "@/lib/sim/postaje-satno";

/** Ploha je u sredini; okvir je onaj za koji je polje vjetra izračunato. */
export const SREDISTE: [number, number] = [SIM_POLJE.izvor.lon, SIM_POLJE.izvor.lat];

/**
 * Dokle se karta smije odmaknuti.
 *
 * Šire od polja vjetra namjerno: gledatelj smije pogledati gdje je Split, ali
 * perjanica se ondje više ne crta i to se vidi jer prestaje na rubu okvira.
 * Bez granice bi se karta dala odvući na Jadran, pa bi „vrati na Karepovac”
 * bio jedini put natrag.
 */
export const NAJVECI_OBUHVAT: [number, number, number, number] = [
  // Dovoljno široko da se odzumiranjem vide i postaje vjetra: najdalja je
  // zračna luka, 16 km zapadno. Perjanica se ondje više ne crta i to se vidi
  // jer prestaje na rubu okvira — ali barem je vidljivo odakle vjetar dolazi.
  16.24,
  43.44,
  SIM_POLJE.granice.istok + 0.05,
  SIM_POLJE.granice.sjever + 0.04,
];

/** Početni pogled: cijeli okvir polja, s plohom u sredini. */
export const POCETNI_OBUHVAT: [[number, number], [number, number]] = [
  [SIM_POLJE.granice.zapad, SIM_POLJE.granice.jug],
  [SIM_POLJE.granice.istok, SIM_POLJE.granice.sjever],
];

export type Podloga = "karta" | "ortofoto";

const NAVODI = {
  carto: "© OpenStreetMap contributors © CARTO",
  dof: "DOF 2024 © Državna geodetska uprava (Otvorena dozvola)",
  dmr: "DMR iz LiDAR-a © Državna geodetska uprava (Otvorena dozvola)",
  grad: "Objekti © Grad Split (GIS izvoz)",
} as const;

/** Sjenčani reljef postoji do z17; dalje se rasteže isti podatak. */
const RELJEF_NAJVECI_Z = 17;

/**
 * Slaže MapLibreov opis karte.
 *
 * Svi slojevi postoje od početka; pale se i gase vidljivošću, a ne dodavanjem.
 * Tako poredak ostaje isti bez obzira na to kojim ih redom netko uključi —
 * inače zgrade znaju završiti iznad perjanice, a postaje ispod nje.
 *
 * Returns:
 *   Opis spreman za `new maplibregl.Map({ style })`.
 */
export function stiloviKarte(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      karta: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution: NAVODI.carto,
      },
      ortofoto: {
        type: "raster",
        tiles: [
          "https://geoportal.dgu.hr/services/dof/wms?service=WMS&version=1.1.1" +
            "&request=GetMap&layers=DOF05_VPI_2024&styles=&format=image/jpeg" +
            "&transparent=false&srs=EPSG:3857&width=512&height=512&bbox={bbox-epsg-3857}",
        ],
        tileSize: 512,
        attribution: NAVODI.dof,
      },
      reljef: {
        type: "raster",
        tiles: ["/geo/reljef/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: RELJEF_NAJVECI_Z,
        attribution: NAVODI.dmr,
      },
      postaje: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: SIM_POSTAJE.map((p) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
            properties: { oznaka: p.oznaka, naziv: p.naziv, tvar: p.tvar },
          })),
        },
      },
      ploha: {
        type: "geojson",
        data: "/geo/karepovac.geojson",
      },
    },
    layers: [
      { id: "pozadina", type: "background", paint: { "background-color": "#eceae5" } },
      { id: "karta", type: "raster", source: "karta", paint: { "raster-opacity": 1 } },
      {
        id: "ortofoto",
        type: "raster",
        source: "ortofoto",
        layout: { visibility: "none" },
      },
      {
        id: "reljef",
        type: "raster",
        source: "reljef",
        layout: { visibility: "none" },
        // Reljef ide preko podloge kao sjena, da se ispod njega i dalje vide
        // ulice; pun bi ih prekrio i karta bi ostala bez imena.
        paint: { "raster-opacity": 0.55 },
      },
      {
        id: "ploha-obris",
        type: "line",
        source: "ploha",
        paint: {
          "line-color": "#7c182c",
          "line-width": 1.6,
          "line-dasharray": [3, 2],
          "line-opacity": 0.9,
        },
      },
    ],
  };
}

/** Slojevi postaja; dodaju se nakon perjanice da ostanu iznad nje. */
export const SLOJEVI_POSTAJA = [
  {
    id: "postaje-krug",
    type: "circle" as const,
    source: "postaje",
    paint: {
      "circle-radius": 7,
      "circle-color": "#ffffff",
      "circle-stroke-color": "#1c2733",
      "circle-stroke-width": 2.5,
    },
  },
];

/**
 * Zgrade se dodaju tek kad ih netko zatraži.
 *
 * Sloj je 2,3 MB obrisa za cijeli okvir. Dok je stajao u početnom stilu,
 * karta ga je čekala prije nego što javi da je spremna — a to znači da su i
 * perjanica i postaje čekale megabajte koje većina posjetitelja nikad ne
 * upali. Ovako se skidaju samo ako se traže, i ništa ne drže.
 *
 * Args:
 *   karta: Karta na koju se sloj dodaje.
 *
 * Returns:
 *   Ništa; ako sloj već postoji, ne radi se ništa.
 */
export function dodajZgrade(karta: import("maplibre-gl").Map): void {
  if (karta.getSource("zgrade")) return;
  karta.addSource("zgrade", {
    type: "geojson",
    data: "/karepovac/sim-zgrade.geojson",
    attribution: NAVODI.grad,
  });
  karta.addLayer(
    {
      id: "zgrade",
      type: "fill",
      source: "zgrade",
      paint: { "fill-color": "#3f3a34", "fill-opacity": 0.35 },
    },
    // Ispod obrisa plohe i perjanice, da zgrade ne prekriju ono što se gleda.
    karta.getLayer("ploha-obris") ? "ploha-obris" : undefined,
  );
}

/** Koji je sloj podloge za koji izbor. */
export const PODLOGE: Record<Podloga, string> = {
  karta: "karta",
  ortofoto: "ortofoto",
};
