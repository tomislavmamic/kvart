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
  /** Naslov sklopive skupine u bočnoj traci. */
  group: string;
  /** 1 = spremno u prvoj verziji; 2 = kasnija faza. */
  phase: 1 | 2;
}

/**
 * Slojevi stupaju u dvije vrste odnosa, i svaki traži svoju kontrolu.
 *
 * 1. Neovisni slojevi prikazuju različite stvari i mogu supostojati —
 *    kvačica, pa ih se pali koliko god treba.
 * 2. Vrijednosti jedne DIMENZIJE prikazuju istu veličinu u različitim
 *    stanjima (namjena 2008., 2015., 2024.). Dvije upaljene ne daju
 *    usporedbu nego kašu, pa se bira točno jedna.
 * 3. USPOREDBA je izvedena iz dviju vrijednosti dimenzije. Nije ni stvar
 *    ni stanje nego odnos, pa se crta kao natpis preko odabrane godine.
 *
 * Posljedica koja rješava staru grešku legende: budući da sve vrijednosti
 * dimenzije dijele isti ključ boja, legenda pripada dimenziji, a ne sloju.
 * Ako se dvjema vrijednostima ne može napisati zajednička legenda, onda to
 * i nisu stanja iste veličine i ne pripadaju istoj dimenziji.
 */
export interface LegendEntry {
  boja: string;
  kod: string;
  opis: string;
}

export interface DimensionValue {
  /** Sloj iz OVERLAY_LAYERS koji crta to stanje. */
  layerId: string;
  label: string;
}

export interface Dimension {
  id: string;
  label: string;
  values: DimensionValue[];
  legend: LegendEntry[];
}

export interface Comparison {
  id: string;
  dimensionId: string;
  label: string;
  /** Sloj iz OVERLAY_LAYERS s izračunatim razlikama. */
  layerId: string;
  /** Stanja iz kojih je razlika izvedena — treba ih klizač za usporedbu. */
  fromLayerId: string;
  toLayerId: string;
}

export interface MapView {
  id: string;
  label: string;
  description: string;
  layerIds: string[];
  /** Pogled koji uspoređuje stanja izlaže biralo te dimenzije. */
  dimensionId?: string;
  defaultValueLayerId?: string;
  defaultComparisonId?: string;
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
    group: "Urbanizam",
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
    group: "Urbanizam",
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
    group: "Urbanizam",
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
    group: "Urbanizam",
    phase: 1,
  },
  {
    id: "zgrade",
    label: "Zgrade",
    type: "geojson",
    url: "/geo/zgrade.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#78716c",
    group: "Urbanizam",
    phase: 1,
  },
  {
    id: "stanovnistvo",
    label: "Stanovništvo (Popis 2021., 1 km)",
    type: "geojson",
    url: "/geo/popis-2021.geojson",
    attribution: "© Eurostat (Census Grid 2021)",
    color: "#6366f1",
    group: "Urbanizam",
    // Nema izvedbe: mrežu Eurostatova popisa nitko još ne dohvaća, pa
    // datoteke na disku nema. Dok je bio phase 1, pogled „Urbanizam” nudio
    // je upaljenu kvačicu koja ne crta ništa.
    phase: 2,
  },

  // ---------- Krajobraz ----------
  {
    id: "krosnje",
    label: "Krošnje — pokrivenost 10 m",
    type: "wms",
    url: "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/WMSServer",
    // Bez ovoga Leaflet šalje `layers=undefined` i poslužitelj ne vrati
    // ništa — pogled „Krajobraz” je zato imao 40 slomljenih pločica već pri
    // dolasku. Ime sloja je iz GetCapabilities istog servisa.
    wmsLayers: "HRL_TreeCoverDensity_2018",
    attribution: "© Copernicus Land Monitoring Service",
    color: "#16a34a",
    defaultOpacity: 0.65,
    group: "Krajobraz",
    phase: 1,
  },
  {
    id: "nepropusnost",
    label: "Nepropusnost tla (zabetoniranost)",
    type: "wms",
    url: "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_ImperviousnessDensity_2018/ImageServer/WMSServer",
    wmsLayers: "HRL_ImperviousnessDensity_2018",
    attribution: "© Copernicus Land Monitoring Service",
    color: "#9ca3af",
    defaultOpacity: 0.65,
    group: "Krajobraz",
    phase: 1,
  },
  {
    id: "zelene-povrsine",
    label: "Zelene površine (parkovi, šuma, makija)",
    type: "geojson",
    url: "/geo/zelene-povrsine.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#22c55e",
    group: "Krajobraz",
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
    group: "Krajobraz",
    phase: 1,
  },
  {
    id: "toponimi",
    label: "Geografska imena",
    type: "geojson",
    url: "/geo/toponimi.geojson",
    attribution: "RGI © Državna geodetska uprava",
    color: "#0ea5e9",
    group: "Krajobraz",
    phase: 1,
  },
  {
    id: "zeleni-katastar",
    label: "Zeleni katastar — stabla",
    type: "geojson",
    url: "/geo/stabla.geojson",
    attribution: "Grad Split / Parkovi i nasadi",
    color: "#15803d",
    group: "Mobilnost",
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
    group: "Mobilnost",
    phase: 1,
  },
  {
    // Sve prometno u jednom sloju. Dolazi iz tri cjevovoda — OSM, listovi
    // GUP-a i CAD listovi DPU-a — ali za stanara je to jedna stvar: gdje se
    // vozi i hoda, sad i planirano. Spaja ih scripts/merge-roads.py, a
    // razlikuje svojstvo `vrsta`: postojeće je puna crta, planirano crtkana.
    id: "ceste-sve",
    label: "Ceste, ulice i staze",
    type: "geojson",
    url: "/geo/ceste-sve.geojson",
    attribution:
      "© OpenStreetMap contributors · Hrvatske ceste (INSPIRE WFS) · GUP i " +
      "DPU Splita — vektorizirano iz PDF-a",
    color: "#e2e8f0",
    group: "Mobilnost",
    phase: 1,
  },
  {
    id: "parkiralista",
    label: "Parkirališta",
    type: "geojson",
    url: "/geo/parkiralista.geojson",
    attribution: "© OpenStreetMap contributors",
    color: "#64748b",
    group: "Mobilnost",
    phase: 1,
  },
  {
    id: "zivi-autobusi",
    label: "Autobusi uživo",
    type: "api",
    url: "/api/autobusi",
    attribution: "Promet Split (javni API)",
    color: "#047857",
    group: "Mobilnost",
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
    group: "Infrastruktura",
    phase: 1,
  },
  {
    id: "internet",
    label: "Dostupne brzine interneta",
    type: "geojson",
    url: "/geo/internet.geojson",
    attribution: "HAKOM (javni preglednik)",
    color: "#f97316",
    group: "Infrastruktura",
    phase: 1,
  },
  {
    id: "solar",
    label: "Solarni potencijal (klik na krov)",
    type: "api",
    url: "/api/solar",
    attribution: "PVGIS © European Union",
    color: "#fbbf24",
    group: "Infrastruktura",
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
    group: "Javni prostori",
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
    group: "Planirana infrastruktura",
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
    group: "Planirana infrastruktura",
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
    group: "Planirana infrastruktura",
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
    group: "Planirana infrastruktura",
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
    group: "Planirana infrastruktura",
    phase: 1,
  },
  // ---------- DPU radne zone Dračevac (vektorizirano iz PDF-a) ----------
  // Izvučeno iz službenih CAD listova plana i georeferencirano prema ISPU
  // obuhvatu — vidi scripts/vectorize-plans.py. Ovo su jedini vektorski
  // podaci o vodovodu, odvodnji i telekomu koje uopće imamo: u OSM-u ih za
  // ovo područje nema nijedan objekt.
  {
    id: "dpu-vodoopskrba",
    label: "Vodoopskrba (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/vodoopskrba.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#0ea5e9",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-odvodnja",
    label: "Odvodnja otpadnih voda (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/odvodnja.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#a16207",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-oborinska",
    label: "Oborinska odvodnja (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/oborinska.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#0891b2",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-struja",
    label: "Elektroopskrba i javna rasvjeta (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/struja.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#dc2626",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-telekom",
    label: "Telekom kanalizacija (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/telekom.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#c026d3",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-plin",
    label: "Planirani plinovod (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/plin.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#f59e0b",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    // Bujični kanali iz DPU-a. Jedini vektorski podatak o bujicama koji
    // postoji — u OSM-u ih za ovo područje nema, a kvart je pod Kozjakom pa
    // ih se tiče gdje voda ide.
    id: "dpu-bujica",
    label: "Bujični kanali (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/bujica.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#0284c7",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-zgrade",
    label: "Postojeće zgrade po planu (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/zgrade-postojece.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#a8a29e",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-granica",
    label: "Granica obuhvata DPU-a Dračevac",
    type: "geojson",
    url: "/geo/planovi/granica.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#15803d",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-gradivi-dio",
    label: "Gradivi dio parcela (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/gradivi-dio.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#7c3aed",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },
  {
    id: "dpu-parcelacija",
    label: "Plan parcelacije (DPU Dračevac)",
    type: "geojson",
    url: "/geo/planovi/parcelacija.geojson",
    attribution: "DPU radne zone Dračevac, Grad Split — vektorizirano iz PDF-a",
    color: "#78716c",
    group: "DPU radne zone Dračevac",
    phase: 1,
  },

  // ---------- Namjena iz GUP-a (vektorizirano iz listova) ----------
  // Plohe su dobivene praćenjem rastera (scripts/trace-plans.py), jer su na
  // listovima nacrtane kao šrafura, ne kao poligoni. Boje su očitane iz
  // tumača znakova; ondje gdje plan dvjema namjenama daje istu boju (I/K,
  // M/K5), oznaka to i kaže.
  //
  // Lista iz 2008. ovdje NEMA namjerno. Skripta ga i dalje prati i razliku
  // 2008.→2015. i dalje računa (0,8 ha, tri plohe — listovi su gotovo isti
  // crtež), ali taj je list jedini vidljivo krivo smješten: pri velikom
  // mjerilu rub plohe siječe cestu umjesto da ide njome. Za usporedbu koju
  // nacrt traži — važeći plan protiv prijedloga — on ionako ne treba, pa se
  // ne objavljuje dok se smještanje ne popravi (vidi zaglavlje skripte).
  {
    id: "gup-2015-namjena",
    label: "GUP 2015. — namjena (uklj. ID 2014.)",
    type: "geojson",
    url: "/geo/planovi/gup-2015-namjena.geojson",
    attribution:
      "GUP Splita, neslužbeni pročišćeni prikaz 2015. — plohe praćene iz PDF lista",
    color: "#e0a000",
    group: "GUP — namjena",
    phase: 1,
  },
  {
    id: "gup-2024-namjena",
    label: "GUP — nacrt 2024. (namjena)",
    type: "geojson",
    url: "/geo/planovi/gup-2024-namjena.geojson",
    attribution:
      "Nacrt ID GUP-a Splita 2024. (javna rasprava) — plohe praćene iz PDF lista",
    color: "#80e000",
    group: "GUP — namjena",
    phase: 1,
  },
  // Prometnice s listova GUP-a. Ceste ondje nisu obojene nego nacrtane kao
  // bijeli koridori omeđeni crnim rubom, pa ih razvrstavanje po paleti baca;
  // vade se zasebnim prolazom (prometnice() u trace-plans.py) i crtaju
  // obrisom, kao rub asfalta.
  // Razlike su računate nad klasificiranim rasterima na istoj mreži od 1 m,
  // pa su točne, a ne približno preklapanje poligona. Tanke trake uz svaku
  // granicu (posljedica ±2–5 m georeferenciranja) uklonjene su otvaranjem:
  // u sloju 2015.→2024. nijedan m² promjene nije uži od 20 m.
  //
  // Nacrt uz izmijenjene plohe otiskuje broj stavke iz svog popisa izmjena,
  // pa svaka ploha koju je moguće pripisati nosi i službeni opis odluke.
  {
    id: "gup-promjene-2015-2024",
    label: "Promjene namjene 2015. → nacrt 2024.",
    type: "geojson",
    url: "/geo/planovi/gup-promjene-2015-2024.geojson",
    attribution:
      "Izračunato iz lista GUP-a 2015. i nacrta ID 2024. (javna rasprava)",
    color: "#dc2626",
    group: "GUP — namjena",
    phase: 1,
  },

  // ---------- UPU Bilice sjever (vektorizirano iz PDF-a) ----------
  // List nema imenovane CAD slojeve, pa je namjena razvrstana po boji ispune
  // prema tumaču znakova otisnutom na samom listu.
  {
    id: "upu-namjena-poslovna",
    label: "Poslovna namjena K (UPU Bilice sjever)",
    type: "geojson",
    url: "/geo/planovi/namjena-poslovna.geojson",
    attribution: "UPU Bilice sjever, Grad Split — vektorizirano iz PDF-a",
    color: "#f97316",
    group: "UPU Bilice sjever",
    phase: 1,
  },
  {
    id: "upu-namjena-proizvodna",
    label: "Proizvodna namjena I (UPU Bilice sjever)",
    type: "geojson",
    url: "/geo/planovi/namjena-proizvodna.geojson",
    attribution: "UPU Bilice sjever, Grad Split — vektorizirano iz PDF-a",
    color: "#9333ea",
    group: "UPU Bilice sjever",
    phase: 1,
  },
  {
    id: "upu-namjena-zelenilo",
    label: "Pejzažno i zaštitno zelenilo Z5 (UPU Bilice sjever)",
    type: "geojson",
    url: "/geo/planovi/namjena-zelenilo.geojson",
    attribution: "UPU Bilice sjever, Grad Split — vektorizirano iz PDF-a",
    color: "#65a30d",
    group: "UPU Bilice sjever",
    phase: 1,
  },
  {
    id: "upu-obalni-pojas",
    label: "Granica zaštićenog obalnog pojasa (UPU Bilice sjever)",
    type: "geojson",
    url: "/geo/planovi/granica-obalni-pojas.geojson",
    attribution: "UPU Bilice sjever, Grad Split — vektorizirano iz PDF-a",
    color: "#166534",
    group: "UPU Bilice sjever",
    phase: 1,
  },

  {
    id: "plan-optika",
    label: "Plan telekom infrastrukture (zone)",
    type: "geojson",
    url: "/geo/plan-optika.geojson",
    attribution: "HAKOM — Objedinjeni plan (Uredba 2025)",
    color: "#fb923c",
    group: "UPU Bilice sjever",
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
    group: "Okoliš i rizici",
    phase: 1,
  },
  {
    id: "vrucina",
    label: "Ljetna vrućina (površinska temperatura)",
    type: "geojson", // po izradi: raster pločice, placeholder tip
    url: "/geo/vrucina.geojson",
    attribution: "Landsat © USGS",
    color: "#ef4444",
    group: "Okoliš i rizici",
    phase: 2, // traži jednokratnu izradu u Earth Engineu
  },
  {
    id: "zrak",
    label: "Kvaliteta zraka (najbliže postaje)",
    type: "api",
    url: "/api/zrak",
    attribution: "MINGOR/DHMZ",
    color: "#94a3b8",
    group: "Okoliš i rizici",
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
      "Autobusi, ulična mreža, pješačke staze i parkirališta.",
    layerIds: [
      "stajalista",
      "ceste-sve",
      "parkiralista",
      "zivi-autobusi",
    ],
  },
  {
    id: "ceste",
    label: "Ceste i ulice",
    description:
      "Cijela prometna mreža u jednom sloju i samo obrisom, bez rasterskih " +
      "preklopa. Puna crta je postojeće — ulice iz OSM-a s razredom i imenom " +
      "(klik daje podlogu i ograničenje) te državne ceste; crtkana je " +
      "planirano — koridori s listova GUP-a i prometne površine iz DPU-a " +
      "radne zone Dračevac.",
    layerIds: [
      "ceste-sve",
      "parkiralista",
    ],
  },
  {
    id: "urbanizam",
    label: "Urbanizam",
    description:
      "Što se gdje smije graditi: UPU i DPU planovi, zgrade i gustoća " +
      "stanovništva. Podloga je namjena iz GUP-a na snazi; što joj nacrt " +
      "mijenja vidi se u pogledu „Nacrt GUP-a”.",
    dimensionId: "gup-godina",
    defaultValueLayerId: "gup-2015-namjena",
    layerIds: [
      "gradevinska-podrucja",
      "upu-bilice-sjever",
      "dpu-dracevac",
      // vektorizirana namjena iz samih listova — za razliku od gornjih
      // ISPU rastera ovo je prava geometrija koja se može upitati
      "upu-namjena-poslovna",
      "upu-namjena-proizvodna",
      "upu-namjena-zelenilo",
      "dpu-granica",
      "dpu-gradivi-dio",
      "zgrade",
      "stanovnistvo",
    ],
  },
  {
    id: "nacrt-gupa",
    label: "Nacrt GUP-a",
    description:
      "Karta je nacrt izmjena GUP-a iz 2024., a crveno obrubljeno je ono što " +
      "on mijenja u odnosu na plan koji je na snazi — 9,4 ha na 24 mjesta. " +
      "Klik na plohu daje staru i novu namjenu te, gdje je moguće, stavku " +
      "popisa izmjena kojom nacrt tu promjenu sam obrazlaže. Biralom se " +
      "podloga prebacuje na plan na snazi.",
    layerIds: ["ceste-sve"],
    dimensionId: "gup-godina",
    defaultValueLayerId: "gup-2024-namjena",
    defaultComparisonId: "promjene-2015-2024",
  },
  {
    id: "infrastruktura",
    label: "Infrastruktura",
    description:
      "Struja, internet i energetika. Vodovod, odvodnja, plin i telekom postoje " +
      "samo za radnu zonu Dračevac — izvučeni su iz grafičkih listova DPU-a jer " +
      "ih ni ViK ni HEP ni OSM ne objavljuju.",
    layerIds: [
      "struja",
      "internet",
      "solar",
      "dpu-vodoopskrba",
      "dpu-odvodnja",
      "dpu-oborinska",
      "dpu-struja",
      "dpu-telekom",
      "dpu-plin",
    ],
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

/**
 * Namjena prostora kroz generacije GUP-a. Sve vrijednosti dijele ključ boja
 * otisnut u tumaču znakova samih listova, pa im je legenda zajednička.
 *
 * `gup-namjena` (službeni ISPU raster plana na snazi) namjerno je vrijednost
 * ove dimenzije, a ne samostalan sloj: prikazuje istu veličinu kao i naši
 * praćeni slojevi, pa upaljen uz njih daje dvije karte namjene jednu preko
 * druge — točno kašu zbog koje je dimenzija i uvedena.
 */
export const NAMJENA_LEGENDA: LegendEntry[] = [
  { boja: "#ffff00", kod: "S", opis: "Stambena" },
  { boja: "#e0a000", kod: "M", opis: "Mješovita (stanovanje + poslovno)" },
  { boja: "#f46040", kod: "D", opis: "Javna i društvena" },
  { boja: "#a02080", kod: "I / K", opis: "Gospodarska i poslovna" },
  { boja: "#c02000", kod: "T", opis: "Ugostiteljsko-turistička" },
  { boja: "#20a0c0", kod: "L", opis: "Luke" },
  { boja: "#006000", kod: "R1", opis: "Športski centar" },
  { boja: "#c0e080", kod: "R2", opis: "Rekreacija" },
  { boja: "#40c0c0", kod: "R3", opis: "Kupalište" },
  { boja: "#40c040", kod: "Z1", opis: "Javne zelene površine" },
  { boja: "#80e000", kod: "Z5", opis: "Zaštitno i pejsažno zelenilo" },
  { boja: "#a000c0", kod: "N", opis: "Posebna namjena" },
];

export const DIMENSIONS: Dimension[] = [
  {
    id: "gup-godina",
    label: "Namjena prema planu iz",
    legend: NAMJENA_LEGENDA,
    values: [
      { layerId: "gup-2024-namjena", label: "2024. (nacrt)" },
      { layerId: "gup-2015-namjena", label: "2015. (na snazi)" },
      { layerId: "gup-namjena", label: "ISPU raster" },
    ],
  },
];

export const COMPARISONS: Comparison[] = [
  {
    id: "promjene-2015-2024",
    dimensionId: "gup-godina",
    label: "2015. → nacrt 2024.",
    layerId: "gup-promjene-2015-2024",
    fromLayerId: "gup-2015-namjena",
    toLayerId: "gup-2024-namjena",
  },
];

/**
 * Slojevi kojima upravlja dimenzija ili usporedba ne smiju se nuditi i kao
 * slobodne kvačice — inače se ista veličina opet može naslagati sama na se.
 */
export const UPRAVLJANI_SLOJEVI: ReadonlySet<string> = new Set([
  ...DIMENSIONS.flatMap((d) => d.values.map((v) => v.layerId)),
  ...COMPARISONS.map((c) => c.layerId),
]);
