/**
 * Karta simulatora: podloge, reljef, zgrade i postaje.
 *
 * Odvojeno od `/karta`, iako se podloge preklapaju. Ta karta stoji na Leafletu
 * i nosi tri tisuće redaka planerskog alata — čestice, planovi, vremeplov,
 * vlasništvo. Ovdje treba drugo: jedan okvir oko plohe, nekoliko podloga i
 * WebGL sloj koji crta zrak. Uplesti to u postojeću komponentu značilo bi da
 * svaka promjena simulatora dira i planersku kartu.
 *
 * ## Podloga bez ključa
 *
 * Ulična podloga bila je CARTO-ov raster; od rujna 2026. bez ključa vraća
 * pločice s vodenim žigom „API KEY REQUIRED”, pa je karta ispod perjanice
 * bila nečitljiva. Sad je podloga **OpenFreeMap** (vektorski stil Positron,
 * bez ključa i bez ograničenja prometa, OpenMapTiles nad OSM-om). Stil se
 * skida kao JSON i naši se izvori i slojevi dodaju **poslije** njega u
 * `dodajSlojeveSimulatora`, jer MapLibre pri `setStyle` briše sve što stil
 * ne nosi.
 *
 * Vektorska podloga traži MapLibreov radnik, kao i GeoJSON slojevi — pod
 * `next dev` (Turbopack) ne radi, vidi bilješku u `simulator.tsx`. Ako stil
 * ne stigne (mreža, pad poslužitelja), ide **OSM-ov raster** kao rezerva.
 * Ta rezerva mora ostati rezerva: pravila OSM-ove poslužiteljske mreže
 * dopuštaju samo lagan promet i traže navod izvora, a ovo je mala stranica
 * jednoga kvarta pa u to stane — ali kao zadana podloga za sve posjete ne bi
 * bila u redu.
 *
 * Zajedničko s `/karta` ostaje ono što i treba: iste adrese ortofota i
 * reljefa i isti navodi izvora, pa se dvije karte istoga kvarta ne mogu
 * razići u tome što pokazuju.
 */

import type { Map as MapaLibre, StyleSpecification } from "maplibre-gl";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import { PRIJEDLOZI_POSTAJA } from "@/lib/sim/prijedlozi-postaja";
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

/**
 * Početni pogled: okvir polja, s plohom u sredini, proširen do svih prijedloga.
 *
 * Polje je ono što se gleda, ali predložene postaje smiju iskoračiti iz njega
 * (kampus je 300 m zapadnije). Na širokom zaslonu one ionako upadnu u kadar,
 * na uskom ne bi — a pribadača koju se ne vidi ne postoji.
 */
export const POCETNI_OBUHVAT: [[number, number], [number, number]] = [
  [
    Math.min(SIM_POLJE.granice.zapad, ...PRIJEDLOZI_POSTAJA.map((p) => p.lon)) - 0.002,
    Math.min(SIM_POLJE.granice.jug, ...PRIJEDLOZI_POSTAJA.map((p) => p.lat)) - 0.002,
  ],
  [
    Math.max(SIM_POLJE.granice.istok, ...PRIJEDLOZI_POSTAJA.map((p) => p.lon)) + 0.002,
    Math.max(SIM_POLJE.granice.sjever, ...PRIJEDLOZI_POSTAJA.map((p) => p.lat)) + 0.002,
  ],
];

export type Podloga = "karta" | "ortofoto";

/** Vektorski stil bez ključa; `liberty` je šareniji, Positron ne guši perjanicu. */
export const STIL_PODLOGE = "https://tiles.openfreemap.org/styles/positron";

const NAVODI = {
  openfreemap: "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors",
  osm: "© OpenStreetMap contributors",
  dof: "DOF 2024 © Državna geodetska uprava (Otvorena dozvola)",
  dmr: "DMR iz LiDAR-a © Državna geodetska uprava (Otvorena dozvola)",
  grad: "Objekti © Grad Split (GIS izvoz)",
} as const;

/** Sjenčani reljef postoji do z17; dalje se rasteže isti podatak. */
const RELJEF_NAJVECI_Z = 17;

/** Koliko se čeka na stil prije nego se posegne za rezervom. */
const ISTEK_STILA_MS = 6000;

/**
 * Rezervna podloga: OSM-ov raster, bez ključa.
 *
 * Samo kad vektorski stil ne stigne. OSM-ova pravila (operations.osmfoundation
 * .org/policies/tiles) traže navod izvora i lagan promet; obje stvari ovdje
 * vrijede, ali se raster ne uzima kao zadana podloga.
 */
export function rezervniStil(): StyleSpecification {
  return {
    version: 8,
    sources: {
      karta: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: NAVODI.osm,
      },
    },
    layers: [
      { id: "pozadina", type: "background", paint: { "background-color": "#eceae5" } },
      { id: "karta", type: "raster", source: "karta" },
    ],
  };
}

/**
 * Skida vektorski stil podloge; kad ne stigne, vraća rezervni raster.
 *
 * Stil se skida ovdje, a ne predaje karti kao adresa: tako se pad stila vidi
 * kao pad, a ne kao siva ploha bez greške, i tako se navod izvora smije
 * dopisati prije nego karta išta nacrta.
 *
 * Returns:
 *   Stil spreman za `new maplibregl.Map({ style })`.
 */
export async function ucitajStil(): Promise<StyleSpecification> {
  try {
    const odgovor = await fetch(STIL_PODLOGE, { signal: AbortSignal.timeout(ISTEK_STILA_MS) });
    if (!odgovor.ok) throw new Error(`stil ${odgovor.status}`);
    const stil = (await odgovor.json()) as StyleSpecification;
    if (stil.version !== 8 || !stil.layers?.length) throw new Error("stil nije MapLibreov");
    // Navod stoji na izvoru, jer ga karta odande čita; OpenFreeMap ga u stilu
    // ne nosi, a bez njega bi karta prešutjela odakle su joj ulice.
    for (const izvor of Object.values(stil.sources)) {
      const s = izvor as { attribution?: string };
      if (!s.attribution) s.attribution = NAVODI.openfreemap;
    }
    return stil;
  } catch (greska) {
    console.warn("[sim] vektorska podloga nije stigla, ide OSM raster:", greska);
    return rezervniStil();
  }
}

/**
 * Dodaje izvore i slojeve simulatora povrh učitanog stila.
 *
 * Svi slojevi postoje od početka; pale se i gase vidljivošću, a ne dodavanjem.
 * Tako poredak ostaje isti bez obzira na to kojim ih redom netko uključi —
 * inače zgrade znaju završiti iznad perjanice, a postaje ispod nje.
 *
 * Args:
 *   karta: Karta kojoj je stil već složen (`style.load`).
 */
export function dodajSlojeveSimulatora(karta: MapaLibre): void {
  const dodajIzvor = (id: string, izvor: Parameters<MapaLibre["addSource"]>[1]) => {
    if (!karta.getSource(id)) karta.addSource(id, izvor);
  };
  dodajIzvor("ortofoto", {
    type: "raster",
    tiles: [
      "https://geoportal.dgu.hr/services/dof/wms?service=WMS&version=1.1.1" +
        "&request=GetMap&layers=DOF05_VPI_2024&styles=&format=image/jpeg" +
        "&transparent=false&srs=EPSG:3857&width=512&height=512&bbox={bbox-epsg-3857}",
    ],
    tileSize: 512,
    attribution: NAVODI.dof,
  });
  dodajIzvor("reljef", {
    type: "raster",
    tiles: ["/geo/reljef/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: RELJEF_NAJVECI_Z,
    attribution: NAVODI.dmr,
  });
  dodajIzvor("postaje", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: SIM_POSTAJE.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        properties: { oznaka: p.oznaka, naziv: p.naziv, tvar: p.tvar },
      })),
    },
  });
  dodajIzvor("ploha", { type: "geojson", data: "/geo/karepovac.geojson" });

  const dodajSloj = (sloj: Parameters<MapaLibre["addLayer"]>[0]) => {
    if (!karta.getLayer(sloj.id)) karta.addLayer(sloj);
  };
  // Ortofoto ide preko cijele podloge, uključujući natpise: sivi natpisi
  // Positrona na snimci iz zraka bili bi nečitljivi, a ortofoto se i gleda
  // zbog terena, ne zbog imena ulica.
  dodajSloj({ id: "ortofoto", type: "raster", source: "ortofoto", layout: { visibility: "none" } });
  dodajSloj({
    id: "reljef",
    type: "raster",
    source: "reljef",
    layout: { visibility: "none" },
    // Reljef ide preko podloge kao sjena, da se ispod njega i dalje vide
    // ulice; pun bi ih prekrio i karta bi ostala bez imena.
    paint: { "raster-opacity": 0.55 },
  });
  dodajSloj({
    id: "ploha-obris",
    type: "line",
    source: "ploha",
    paint: {
      "line-color": "#7c182c",
      "line-width": 1.6,
      "line-dasharray": [3, 2],
      "line-opacity": 0.9,
    },
  });
  for (const sloj of SLOJEVI_POSTAJA) dodajSloj(sloj);
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
export function dodajZgrade(karta: MapaLibre): void {
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

/**
 * Koji je sloj podloge za koji izbor.
 *
 * Ulična podloga je vektorski stil, dakle desetci slojeva: ne gasi se, nego
 * je ortofoto prekrije. `karta` ovdje stoji samo za rezervni raster.
 */
export const PODLOGE: Record<Podloga, string> = {
  karta: "karta",
  ortofoto: "ortofoto",
};
