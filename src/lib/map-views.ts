/**
 * Registar slojeva i kuriranih pogleda za kartu kvarta (/karta).
 *
 * Ovo je konfiguracijska podloga za "hibrid" pristup: jedna Leaflet karta,
 * red čipova s pogledima koji pale kombinacije slojeva, te puni panel za
 * prilagodbu. Endpointi dolaze iz kataloga provjerenog 8. 7. 2026.
 * (vidi /podaci i src/lib/datasets.ts).
 *
 * Sloj s `phase: 2` još nema podatke/obradu — prikazuje se zasivljen u
 * panelu dok ne bude spreman.
 */

/**
 * Obuhvat prikupljanja podataka: [zapad, jug, istok, sjever] (EPSG:4326).
 * Namjerno širi od samih kvartova — koristi ga skripta za izvlačenje i
 * maksimalne granice karte. Za stvarnu granicu kvartova vidi granica.geojson.
 */
export const KVART_BBOX: [number, number, number, number] = [
  16.47, 43.51, 16.52, 43.54,
];

/**
 * Stvarni obuhvat kvartova Dračevac + Bilice, izveden iz službenih poligona
 * (data/sources/…kmz → public/geo/granica.geojson). Koristi se za koordinate
 * u podnožju i za uokvirivanje karte.
 */
export const NEIGHBORHOOD_EXTENT: [number, number, number, number] = [
  16.48846, 43.52055, 16.51005, 43.52932,
];

export const KVART_CENTER: [number, number] = [43.5249, 16.4993];

export interface BaseLayer {
  id: string;
  label: string;
  /** WMS endpoint ili XYZ predložak. */
  url: string;
  type: "wms" | "xyz";
  wmsLayers?: string;
  attribution: string;
}

export type OverlayType =
  | "wms" // izravni WMS overlay
  | "geojson" // statični GeoJSON u public/geo/ (izrađuje build skripta)
  | "api"; // živi upit kroz naš proxy route

export interface OverlayLayer {
  id: string;
  label: string;
  type: OverlayType;
  /** WMS endpoint, putanja do /geo datoteke ili API route. */
  url: string;
  wmsLayers?: string;
  /** ISPU/OSS ne podržavaju EPSG:3857 — Leaflet ih traži u 4326. */
  wmsCrs?: "EPSG:4326" | "EPSG:3857";
  attribution: string;
  /** Boja za legendu/stil vektorskih slojeva. */
  color: string;
  defaultOpacity?: number;
  /** 1 = spremno u prvoj verziji; 2 = kasnija faza. */
  phase: 1 | 2;
}

export interface MapView {
  id: string;
  label: string;
  description: string;
  layerIds: string[];
}

export const BASE_LAYERS: BaseLayer[] = [
  {
    id: "dof",
    label: "Ortofoto (DOF 2023)",
    type: "wms",
    url: "https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms",
    wmsLayers: "OI.OrthoimageCoverage",
    attribution: "DOF 2023 © Državna geodetska uprava (Otvorena dozvola)",
  },
  {
    id: "karta",
    label: "Ulična karta",
    type: "xyz",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap contributors © CARTO",
  },
];

export const OVERLAY_LAYERS: OverlayLayer[] = [
  // ---------- Urbanizam ----------
  {
    id: "gup-namjena",
    label: "GUP — namjena površina",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_GUP1_04090_R07_KN_1_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#eab308",
    defaultOpacity: 0.6,
    phase: 1,
  },
  {
    id: "gradevinska-podrucja",
    label: "Građevinska područja (PPUG)",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_PPGO_04090_R02_GP_4_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#f97316",
    defaultOpacity: 0.6,
    phase: 1,
  },
  {
    id: "upu-bilice-sjever",
    label: "UPU Bilice sjever — namjena",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_UPU2_04090_R01_KN_1_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#a855f7",
    defaultOpacity: 0.6,
    phase: 1,
  },
  {
    id: "dpu-dracevac",
    label: "DPU radne zone Dračevac — namjena",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_DPU36_04090_R04_KN_1_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#a855f7",
    defaultOpacity: 0.6,
    phase: 1,
  },
  {
    id: "zgrade",
    label: "Zgrade",
    type: "geojson",
    url: "/geo/zgrade.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#78716c",
    phase: 1,
  },
  {
    id: "stanovnistvo",
    label: "Stanovništvo (Popis 2021., 1 km)",
    type: "geojson",
    url: "/geo/popis-2021.geojson",
    attribution: "© Eurostat (Census Grid 2021)",
    color: "#6366f1",
    phase: 1,
  },

  // ---------- Krajobraz ----------
  {
    id: "krosnje",
    label: "Krošnje — pokrivenost 10 m",
    type: "wms",
    url: "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/WMSServer",
    attribution: "© Copernicus Land Monitoring Service",
    color: "#16a34a",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "nepropusnost",
    label: "Nepropusnost tla (zabetoniranost)",
    type: "wms",
    url: "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_ImperviousnessDensity_2018/ImageServer/WMSServer",
    attribution: "© Copernicus Land Monitoring Service",
    color: "#9ca3af",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "zelene-povrsine",
    label: "Zelene površine (parkovi, šuma, makija)",
    type: "geojson",
    url: "/geo/zelene-povrsine.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#22c55e",
    phase: 1,
  },
  {
    id: "reljef",
    label: "Reljef (sjenčanje)",
    type: "wms",
    url: "https://geoportal.dgu.hr/services/dmr/wms",
    wmsLayers: "Hillshade",
    attribution: "© Državna geodetska uprava",
    color: "#a8a29e",
    defaultOpacity: 0.5,
    phase: 1,
  },
  {
    id: "toponimi",
    label: "Geografska imena",
    type: "geojson",
    url: "/geo/toponimi.geojson",
    attribution: "RGI © Državna geodetska uprava",
    color: "#0ea5e9",
    phase: 1,
  },
  {
    id: "zeleni-katastar",
    label: "Zeleni katastar — stabla",
    type: "geojson",
    url: "/geo/stabla.geojson",
    attribution: "Grad Split / Parkovi i nasadi",
    color: "#15803d",
    phase: 2, // host split-gisportal.gdi.net nedostupan tijekom istraživanja
  },

  // ---------- Mobilnost ----------
  {
    id: "stajalista",
    label: "Autobusna stajališta",
    type: "geojson",
    url: "/geo/stajalista.geojson",
    attribution: "Promet Split (javni API)",
    color: "#047857",
    phase: 1,
  },
  {
    id: "javne-ceste",
    label: "Javne ceste (nadležnost)",
    type: "wms",
    url: "https://geoportal.hrvatske-ceste.hr/inspire/tn-ro/wms",
    wmsLayers: "TN.RoadTransportNetwork.RoadLink",
    attribution: "© Hrvatske ceste",
    color: "#f59e0b",
    phase: 1,
  },
  {
    id: "pjesacke",
    label: "Pješačke staze i nogostupi",
    type: "geojson",
    url: "/geo/pjesacke.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#14b8a6",
    phase: 1,
  },
  {
    id: "parkiralista",
    label: "Parkirališta",
    type: "geojson",
    url: "/geo/parkiralista.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#64748b",
    phase: 1,
  },
  {
    id: "zivi-autobusi",
    label: "Autobusi uživo",
    type: "api",
    url: "/api/autobusi",
    attribution: "Promet Split (javni API)",
    color: "#047857",
    phase: 2,
  },

  // ---------- Infrastruktura ----------
  {
    id: "struja",
    label: "Elektro-mreža (dalekovodi, trafostanice)",
    type: "geojson",
    url: "/geo/struja.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#facc15",
    phase: 1,
  },
  {
    id: "internet",
    label: "Dostupne brzine interneta",
    type: "geojson",
    url: "/geo/internet.geojson",
    attribution: "HAKOM (javni preglednik)",
    color: "#f97316",
    phase: 1,
  },
  {
    id: "solar",
    label: "Solarni potencijal (klik na krov)",
    type: "api",
    url: "/api/solar",
    attribution: "PVGIS © European Union",
    color: "#fbbf24",
    phase: 1,
  },

  // ---------- Javni prostori ----------
  {
    id: "sadrzaji",
    label: "Javni sadržaji (škole, igrališta, sport…)",
    type: "geojson",
    url: "/geo/sadrzaji.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#8b5cf6",
    phase: 1,
  },

  // ---------- Planirana infrastruktura (ISPU IS_* listovi) ----------
  // Konvencija listova: IS_1 promet · IS_2 elektroničke komunikacije i
  // energetika · IS_3 vodoopskrba · IS_4 odvodnja (otpadne/oborinske).
  // Oznake potvrditi prema legendi lista (GetLegendGraphic) pri ugradnji.
  {
    id: "plan-promet",
    label: "Planirane prometnice (GUP)",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_GUP1_04090_R07_IS_1_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#dc2626",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "plan-energetika",
    label: "Plan: telekomunikacije i energetika (GUP)",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_GUP1_04090_R07_IS_2_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#facc15",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "plan-vodoopskrba",
    label: "Plan: vodoopskrba (GUP)",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_GUP1_04090_R07_IS_3_2",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#0ea5e9",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "plan-odvodnja",
    label: "Plan: odvodnja — otpadne i oborinske vode (GUP)",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers: "HR_ISPU_GUP1_04090_R07_IS_4_1,HR_ISPU_GUP1_04090_R07_IS_4_2",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#7c3aed",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "plan-lokalni-is",
    label: "Detaljni planovi infrastrukture (UPU/DPU)",
    type: "wms",
    url: "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms",
    wmsLayers:
      "HR_ISPU_UPU2_04090_R01_IS_1_1,HR_ISPU_UPU1_04090_R01_IS_1_1,HR_ISPU_DPU36_04090_R04_IS_1_1,HR_ISPU_DPU5_04090_R01_IS_1_1",
    wmsCrs: "EPSG:4326",
    attribution: "ISPU © MGIPU",
    color: "#f472b6",
    defaultOpacity: 0.65,
    phase: 1,
  },
  {
    id: "plan-optika",
    label: "Plan telekom infrastrukture (zone)",
    type: "geojson",
    url: "/geo/plan-optika.geojson",
    attribution: "HAKOM — Objedinjeni plan (Uredba 2025)",
    color: "#fb923c",
    phase: 1,
  },

  // ---------- Okoliš i rizici ----------
  {
    id: "poplave",
    label: "Opasnost od poplava",
    type: "wms",
    url: "https://servisi.voda.hr/poplave_opasnosti/wms",
    wmsLayers:
      "hr.fd.opasnost-od-poplave-velika-vjerojatnost,hr.fd.opasnost-od-poplave-srednja-vjerojatnost",
    attribution: "© Hrvatske vode",
    color: "#3b82f6",
    defaultOpacity: 0.6,
    phase: 1,
  },
  {
    id: "vrucina",
    label: "Ljetna vrućina (površinska temperatura)",
    type: "geojson", // po izradi: raster pločice, placeholder tip
    url: "/geo/vrucina.geojson",
    attribution: "Landsat © USGS",
    color: "#ef4444",
    phase: 2, // traži jednokratnu izradu u Earth Engineu
  },
  {
    id: "zrak",
    label: "Kvaliteta zraka (najbliže postaje)",
    type: "api",
    url: "/api/zrak",
    attribution: "MINGOR/DHMZ",
    color: "#94a3b8",
    phase: 2,
  },
];

export const MAP_VIEWS: MapView[] = [
  {
    id: "krajobraz",
    label: "Krajobraz",
    description:
      "Zelenilo, krošnje, zabetoniranost, reljef i stara imena predjela.",
    layerIds: ["krosnje", "zelene-povrsine", "nepropusnost", "reljef", "toponimi", "zeleni-katastar"],
  },
  {
    id: "mobilnost",
    label: "Mobilnost",
    description:
      "Autobusi, ceste s nadležnošću, pješačke staze i parkirališta.",
    layerIds: ["stajalista", "javne-ceste", "pjesacke", "parkiralista", "zivi-autobusi"],
  },
  {
    id: "urbanizam",
    label: "Urbanizam",
    description:
      "Što se gdje smije graditi: GUP, UPU i DPU planovi, zgrade i gustoća stanovništva.",
    layerIds: ["gup-namjena", "gradevinska-podrucja", "upu-bilice-sjever", "dpu-dracevac", "zgrade", "stanovnistvo"],
  },
  {
    id: "infrastruktura",
    label: "Infrastruktura",
    description:
      "Struja, internet i energetika. (Vodovod i kanalizacija nisu otvoreni podaci.)",
    layerIds: ["struja", "internet", "solar"],
  },
  {
    id: "javni-prostori",
    label: "Javni prostori",
    description:
      "Škole, igrališta, sportski tereni, zelene površine i ostali javni sadržaji.",
    layerIds: ["sadrzaji", "zelene-povrsine"],
  },
  {
    id: "okolis-rizici",
    label: "Okoliš i rizici",
    description:
      "Gdje plavi, gdje ljeti gori i kakav zrak dišemo.",
    layerIds: ["poplave", "vrucina", "zrak", "nepropusnost"],
  },
  {
    id: "planirano",
    label: "Planirano",
    description:
      "Buduća infrastruktura iz važećih planova: prometnice, energetika i telekomunikacije, vodoopskrba, odvodnja te plan gradnje optike.",
    layerIds: [
      "plan-promet",
      "plan-energetika",
      "plan-vodoopskrba",
      "plan-odvodnja",
      "plan-lokalni-is",
      "plan-optika",
    ],
  },
];
