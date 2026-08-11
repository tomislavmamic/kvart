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

export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [43.514, 16.481],
  [43.536, 16.518],
];

/**
 * A narrow dossier is modal and leaves only the top 28% of the map visible.
 * Releasing the bounds while it is open lets Leaflet place the selected
 * parcel in that strip even near an edge; closing the dossier restores them.
 */
export function dossierMapBounds(
  narrow: boolean,
): [[number, number], [number, number]] | undefined {
  return narrow ? undefined : MAP_MAX_BOUNDS;
}

export type DossierPresentation = "closed" | "loading" | "resolved" | "error";

/**
 * Coordinates can be hydrated before the asynchronous dossier is presented.
 * Only a visible narrow dossier makes the rest of the map application modal.
 */
export function shouldIsolateMapBackground(
  narrow: boolean,
  state: { selected: boolean; presentation: DossierPresentation },
): boolean {
  return narrow && state.presentation !== "closed";
}

interface DossierMapLayoutTarget {
  invalidateSize: (options: { animate: boolean; pan: boolean }) => unknown;
  setMaxBounds: (
    bounds?: [[number, number], [number, number]],
  ) => unknown;
  getSize: () => { x: number; y: number };
  latLngToContainerPoint: (
    point: [number, number],
  ) => { x: number; y: number };
  panBy: (
    offset: [number, number],
    options: { animate: boolean; duration: number },
  ) => unknown;
}

/**
 * Synchronizes every dossier layout transition: open, responsive breakpoint,
 * and close. Keeping those branches together prevents a resize from retaining
 * the bounds and target point chosen for the previous layout.
 */
export function syncDossierMapLayout(
  map: DossierMapLayoutTarget,
  narrow: boolean,
  point: [number, number] | null,
  animate: boolean,
): void {
  // Leaflet caches the old viewport until its resize handler runs. Refresh it
  // synchronously so a breakpoint transition cannot use the previous layout's
  // dimensions when positioning the selected parcel.
  map.invalidateSize({ animate: false, pan: false });

  if (!point) {
    map.setMaxBounds(MAP_MAX_BOUNDS);
    return;
  }

  map.setMaxBounds(dossierMapBounds(narrow));
  const viewport = map.getSize();
  const current = map.latLngToContainerPoint(point);
  const target = narrow
    ? { x: viewport.x / 2, y: viewport.y * 0.17 }
    : { x: viewport.x * 0.28, y: viewport.y / 2 };
  map.panBy([current.x - target.x, current.y - target.y], {
    animate,
    duration: 0.4,
  });
}

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
  /** Namjensko Leaflet okno kad red crtanja mora biti neovisan o vremenu dohvata. */
  pane?: string;
  /** CSS z-index namjenskog okna; koristi se samo uz `pane`. */
  paneZIndex?: number;
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
 *
 * Biralo dimenzije stoji uz odabir podloge (desna ploča karte), ne među
 * kvačicama: ono ne pali još jedan sloj nego mijenja ono što je ispod svega,
 * pa pripada onamo gdje se bira i ortofoto. Zato je dostupno u svakom
 * pogledu, a pogled mu zadaje samo početnu vrijednost — prazna znači
 * ugašenu podlogu.
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
  /**
   * Slojevi koje pogled bira. Bočna traka ih diže u skupinu „U ovom
   * pogledu”, a iz skupina po izvoru ih izostavlja — svaki sloj tako stoji
   * na točno jednom mjestu i nema dviju kvačica za istu stvar.
   */
  layerIds: string[];
  /**
   * Početno stanje dimenzije. Biralo je uz podlogu i vidi se uvijek (vidi
   * komentar uz Dimension); pogled ga ne izlaže nego samo namješta.
   */
  dimensionId?: string;
  defaultValueLayerId?: string;
  defaultComparisonId?: string;
  /**
   * Ključ boja izvedenog sloja, ako ga pogled ima.
   *
   * Sloj koji sam računa značenje (zeleno = slobodno, crveno = bez pristupa)
   * mora ga i objasniti, i to na zaslonu — ne u opisu. Za „Gdje se može
   * graditi stan” je razlika crvenog i zelenog bila jedna rečenica usred
   * 1400 znakova skraćenih na četiri retka, pa je stanar mogao vidjeti svoju
   * česticu crvenu i ne doznati znači li to dobro ili loše.
   */
  legend?: LegendEntry[];
  /**
   * Razina u traci pogleda.
   *
   * `pitanje` su načini na koje se u kvartu doista pita — „gdje se može
   * graditi”, „što se mijenja”, „što ovdje vrijedi”. Njih je malo i stoje
   * odmah, jer je to ono s čime susjed dolazi.
   *
   * `nacin` su načini gledanja: krajobraz, mobilnost, infrastruktura, cijeli
   * registar. Nisu manje vrijedni, ali nisu pitanje — pa stoje iza „Više”.
   * Trinaest ravnopravnih čipova u traci koja se ne vidi do kraja značilo je
   * da nijedan nije istaknut, a onaj po koji se došlo bio je izvan zaslona.
   */
  razina: "pitanje" | "nacin";
  /**
   * Izlaže li pogled biralo usporedbe (i klizač).
   *
   * Prije je stajalo u desnoj ploči, uz podlogu, gdje ga je bilo u svakom
   * pogledu iako je korisno u jednom. Ploča se zove „Podloga i plan”, a
   * usporedba nije ni jedno ni drugo.
   */
  usporedbe?: boolean;
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

/**
 * Slojevi iz GIS izvoza Grada Splita (scripts/import-split-gis.ts).
 *
 * Njih je 70 i svi dijele oblik — statični GeoJSON pod /geo/grad/, ista
 * atribucija, faza 1 — pa stoje kao tablica umjesto kao 70 gotovo
 * jednakih objekata. Redak je [id, natpis, skupina, boja]; `id` je ujedno
 * ime datoteke, čime se gubi cijela vrsta greške u kojoj se to dvoje
 * raziđe. Poredak unutar skupine je poredak u bočnoj traci.
 */
const GRAD_SLOJEVI = [
  // --- Urbanizam ---
  ["kotar", "Gradski kotar / mjesni odbor", "Urbanizam", "#be123c"],
  ["naselja", "Naselja (službena granica)", "Urbanizam", "#9f1239"],
  ["planovi-obuhvat", "Prostorni planovi — što gdje vrijedi", "Urbanizam", "#7c3aed"],
  ["planovi-obuhvat-pp", "Obuhvati planova (PPUG, GUP, UPU)", "Urbanizam", "#8b5cf6"],
  ["zgrade-2025", "Zgrade — evidencija Grada (2025.)", "Urbanizam", "#57534e"],
  ["zgrade-visine", "Zgrade s visinom i obujmom", "Urbanizam", "#44403c"],
  ["korisna-povrsina", "Korisna površina zgrada", "Urbanizam", "#78716c"],
  ["kiosci-plan", "Plan kioska", "Urbanizam", "#a8a29e"],
  ["kiosci-zone", "Zone kioska", "Urbanizam", "#d6d3d1"],
  ["komunalna-naknada", "Naplata komunalne naknade", "Urbanizam", "#f59e0b"],

  // --- Katastar i adrese ---
  ["katastar", "Katastarske čestice (2024.)", "Katastar i adrese", "#a16207"],
  ["katastar-vlasnistvo", "Čestice s vlasništvom i teretima", "Katastar i adrese", "#854d0e"],
  ["katastar-objekti", "Katastarski objekti", "Katastar i adrese", "#ca8a04"],
  ["granice-ko", "Granice katastarskih općina", "Katastar i adrese", "#713f12"],
  ["kucni-brojevi", "Kućni brojevi", "Katastar i adrese", "#0f766e"],
  ["adrese", "Adrese s popisnim krugom", "Katastar i adrese", "#0d9488"],
  ["zgrade-adrese", "Zgrade s kućnim brojem", "Katastar i adrese", "#115e59"],
  ["popisni-krugovi", "Popisni krugovi (Popis 2021.)", "Katastar i adrese", "#6366f1"],
  ["statisticki-krugovi", "Statistički krugovi", "Katastar i adrese", "#818cf8"],

  // --- Mobilnost ---
  ["ceste-nerazvrstane", "Nerazvrstane ceste (nadležnost Grada)", "Mobilnost", "#fb923c"],
  ["ceste-dionice", "Dionice cesta (s imenima)", "Mobilnost", "#f97316"],
  ["ulice-osi", "Osi ulica (službeni nazivi)", "Mobilnost", "#ea580c"],
  ["ulice-podrucja", "Područja ulica", "Mobilnost", "#fdba74"],
  ["drzavne-ceste", "Državne ceste (D1, D8, D432)", "Mobilnost", "#dc2626"],
  ["nogostupi", "Nogostupi (sa širinom)", "Mobilnost", "#38bdf8"],
  ["pjesacki-prijelazi", "Pješački prijelazi", "Mobilnost", "#f8fafc"],
  ["izbocine", "Izbočine za usporavanje", "Mobilnost", "#ef4444"],
  ["prometni-znakovi", "Prometni znakovi", "Mobilnost", "#2563eb"],
  ["odbojne-ograde", "Odbojne ograde", "Mobilnost", "#64748b"],
  ["stajalista-grad", "Autobusna stajališta (Grad)", "Mobilnost", "#047857"],
  ["nadstresnice", "Nadstrešnice na stajalištima", "Mobilnost", "#059669"],
  ["parkiraliste-grad", "Javno parkiralište", "Mobilnost", "#475569"],

  // --- Voda i odvodnja ---
  ["vodovod", "Vodovodna mreža", "Voda i odvodnja", "#0284c7"],
  ["vodovod-spojevi", "Vodovod — spojevi", "Voda i odvodnja", "#0369a1"],
  ["vodovod-zatvaraci", "Vodovod — zatvarači", "Voda i odvodnja", "#075985"],
  ["vodovod-kanali", "Vodovod — kanali", "Voda i odvodnja", "#0c4a6e"],
  ["vodovod-podrucja", "Vodoopskrbna područja", "Voda i odvodnja", "#7dd3fc"],
  ["hidranti", "Hidranti", "Voda i odvodnja", "#dc2626"],
  ["odvodnja", "Odvodnja (oborinska, fekalna, mješovita)", "Voda i odvodnja", "#7c3aed"],
  ["odvodnja-okna", "Odvodnja — revizijska okna", "Voda i odvodnja", "#6d28d9"],
  ["odvodnja-slivnici", "Slivnici (gdje kiša ulazi u sustav)", "Voda i odvodnja", "#a78bfa"],
  ["odvodnja-tlacni", "Odvodnja — tlačni vodovi", "Voda i odvodnja", "#5b21b6"],
  ["odvodnja-gradevine", "Odvodnja — građevine", "Voda i odvodnja", "#c4b5fd"],

  // --- Struja i sunce ---
  ["struja-nn", "Niskonaponska mreža i kućni priključci", "Struja i sunce", "#facc15"],
  ["struja-nn-stupovi", "Niskonaponski stupovi", "Struja i sunce", "#eab308"],
  ["struja-nn-ormarici", "Kabelski ormarići (KRO)", "Struja i sunce", "#ca8a04"],
  ["struja-sn", "Srednjenaponska mreža (do 35 kV)", "Struja i sunce", "#f97316"],
  ["struja-vn-110", "Dalekovodi 110 kV i 220 kV", "Struja i sunce", "#b91c1c"],
  ["struja-stupovi-vn", "Stupovi SN i VN mreže", "Struja i sunce", "#9a3412"],
  ["trafostanice", "Trafostanice (SN) — točke", "Struja i sunce", "#fbbf24"],
  ["trafostanice-plohe", "Trafostanice (SN) — tlocrt", "Struja i sunce", "#f59e0b"],
  ["trafostanica-110", "Trafostanica 110/35 kV Meterize", "Struja i sunce", "#7f1d1d"],
  ["solar-krovovi", "Solarni potencijal po plohi krova", "Struja i sunce", "#fde047"],

  // --- Telekom i rasvjeta ---
  ["telekom-trase", "Telekom — trase DTK", "Telekom i rasvjeta", "#c084fc"],
  ["telekom-sahte", "Telekom — šahte DTK", "Telekom i rasvjeta", "#a855f7"],
  ["telekom-ht-podzemno", "HT — podzemne trase", "Telekom i rasvjeta", "#9333ea"],
  ["telekom-ht-nadzemno", "HT — nadzemne trase", "Telekom i rasvjeta", "#d8b4fe"],
  ["telekom-ht-zdenci", "HT — zdenci (s adresom)", "Telekom i rasvjeta", "#7e22ce"],
  ["telekom-ht-stupovi", "HT — stupovi", "Telekom i rasvjeta", "#6b21a8"],
  ["rasvjeta", "Javna rasvjeta (stupovi)", "Telekom i rasvjeta", "#fde047"],
  ["rasvjeta-mjesta", "Rasvjetna mjesta (s ugradnjom)", "Telekom i rasvjeta", "#fef08a"],
  ["rasvjeta-zone", "Zone javne rasvjete", "Telekom i rasvjeta", "#fef9c3"],
  ["rasvjeta-trafostanice", "Rasvjeta — trafostanice", "Telekom i rasvjeta", "#facc15"],

  // --- Javni prostori ---
  ["igralista", "Dječja igrališta", "Javni prostori", "#ec4899"],
  ["kulturno-dobro", "Zaštićena kulturna dobra", "Javni prostori", "#b45309"],
  ["zelene-zone", "Zelene površine (ZP Mejaši)", "Javni prostori", "#16a34a"],
  ["zelenilo-oprema", "Klupe i stolovi za piknik", "Javni prostori", "#15803d"],
  ["zelenilo-kosevi", "Koševi za otpad", "Javni prostori", "#166534"],
  ["zelenilo-vjezbaliste", "Vježbalište na otvorenom", "Javni prostori", "#22c55e"],
  // Natpis se namjerno razlikuje od sloja `zeleni-katastar`: ondje je riječ
  // o zelenom katastru sa split-gisportala, a ovdje o jedinom stablu koje
  // gradska evidencija u kvartu uopće bilježi.
  ["zelenilo-stabla", "Stabla u evidenciji Grada", "Javni prostori", "#14532d"],
] as const satisfies ReadonlyArray<readonly [string, string, string, string]>;

/**
 * Slojevi koji postoje samo na razvojnom stroju.
 *
 * Čestice s vlasništvom imenuju fizičke osobe, uz OIB, i bilježe hipoteke i
 * služnosti. Repozitorij je javan, pa commit te datoteke JEST objava — i to
 * trajna, jer ostaje u povijesti i nakon brisanja. Zato datoteka nije u
 * gitu (vidi .gitignore), a sloj se ne upisuje u registar izvan razvoja:
 * inače bi na produkciji stajala kvačica koja ne crta ništa.
 *
 * Uvjet je `NODE_ENV === "development"`, dakle samo `next dev`. Svaka
 * gradnja — i lokalna i na Vercelu, uključujući preglede grana — sloj
 * izostavlja. Provjera se obavlja pri gradnji, pa kod uopće ne dospije u
 * produkcijski svežanj.
 */
const SAMO_LOKALNO: ReadonlySet<string> = new Set(["katastar-vlasnistvo"]);
const JE_RAZVOJ = process.env.NODE_ENV === "development";

const ATRIBUCIJA_GRADA = "Grad Split — GIS izvoz";

/** Slojevi čiji podatak potječe od nekog drugog, pa im atribucija nije ista. */
const ATRIBUCIJA_IZNIMKE: Record<string, string> = {
  "kulturno-dobro":
    "Registar kulturnih dobara — Ministarstvo kulture i medija · " +
    "Grad Split (GIS izvoz)",
  "struja-nn": "HEP ODS · Grad Split (GIS izvoz)",
  "struja-nn-stupovi": "HEP ODS · Grad Split (GIS izvoz)",
  "struja-nn-ormarici": "HEP ODS · Grad Split (GIS izvoz)",
  "struja-sn": "HEP ODS · Grad Split (GIS izvoz)",
  "struja-vn-110": "HEP ODS · Grad Split (GIS izvoz)",
  "struja-stupovi-vn": "HEP ODS · Grad Split (GIS izvoz)",
  "trafostanice": "HEP ODS · Grad Split (GIS izvoz)",
  "trafostanice-plohe": "HEP ODS · Grad Split (GIS izvoz)",
  "trafostanica-110": "HEP ODS · Grad Split (GIS izvoz)",
  "telekom-ht-podzemno": "Hrvatski telekom · Grad Split (GIS izvoz)",
  "telekom-ht-nadzemno": "Hrvatski telekom · Grad Split (GIS izvoz)",
  "telekom-ht-zdenci": "Hrvatski telekom · Grad Split (GIS izvoz)",
  "telekom-ht-stupovi": "Hrvatski telekom · Grad Split (GIS izvoz)",
  "popisni-krugovi": "SRPJ — Državna geodetska uprava · Grad Split (GIS izvoz)",
  "statisticki-krugovi":
    "SRPJ — Državna geodetska uprava · Grad Split (GIS izvoz)",
};

function gradniSloj(
  [id, label, group, color]: (typeof GRAD_SLOJEVI)[number]
): OverlayLayer {
  return {
    id,
    label,
    type: "geojson",
    url: `/geo/grad/${id}.geojson`,
    attribution: ATRIBUCIJA_IZNIMKE[id] ?? ATRIBUCIJA_GRADA,
    color,
    group,
    phase: 1,
  };
}

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
  // obuhvatu — vidi scripts/vectorize-plans.py. U OSM-u za ovo područje
  // nema nijednog takvog objekta.
  //
  // Otkad postoji GIS izvoz Grada (scripts/import-split-gis.ts), za iste
  // vodove imamo i izvedeno stanje. Slojevi se ne preklapaju nego dopunjuju:
  // ovo je ono što plan propisuje, „Vodovodna mreža” i „Odvodnja” su ono što
  // je u zemlji — pa se po razlici vidi što od plana još nije izvedeno.
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
    label: "GUP 2024. — namjena",
    type: "geojson",
    url: "/geo/planovi/gup-2024-namjena.geojson",
    attribution:
      "GUP Splita 2024. — plohe praćene iz PDF lista",
    color: "#80e000",
    group: "GUP — namjena",
    phase: 1,
  },
  {
    id: "gup-2024-planirane-ceste",
    label: "Planirane ceste — GUP 2024.",
    type: "geojson",
    url: "/geo/planovi/gup-2024-promet.geojson",
    attribution: "Nacrt GUP-a Splita 2024. — prometni koridori praćeni iz PDF lista",
    color: "#3f3f46",
    group: "GUP — namjena",
    phase: 1,
    pane: "planirane-ceste-podloga",
    paneZIndex: 410,
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
    label: "Promjene namjene 2015. → 2024.",
    type: "geojson",
    url: "/geo/planovi/gup-promjene-2015-2024.geojson",
    attribution:
      "Izračunato iz listova GUP-a 2015. i 2024.",
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

  // ---------- Izvedeni sloj: gdje se još može graditi stan ----------
  // Presjek uvjeta, računat u scripts/slobodne-parcele.py: čestica je
  // većinom u zoni GUP-a koja dopušta stanovanje (S, M, K5), nije sama
  // cesta ni pod dalekovodom, na njoj nema zgrade, nije uska traka bez
  // duge strane uz susjeda, i leži u nakupini dovoljnoj za građevnu
  // česticu. Nije očitanje nego zaključak — pragovi i lijevak stoje u
  // _stambeno-slobodno.json.
  //
  // Namjena ispod njega je praćeni raster, pa rub plohe zna odstupati
  // nekoliko metara; zato se namjena čestici pripisuje većinom površine, a
  // ne dodirom. Za pojedinačnu česticu ovo je uputa gdje gledati, a ne
  // potvrda — mjerodavni su akt i uvjeti gradnje.
  //
  // Inačice po nacrtu 2024. NEMA jer bi bila ista datoteka. Registracijski
  // robustan raster-diff kaže da nacrt unutar kvarta ne mijenja ništa
  // (0,0 ha od svojih 9,57 ha), pa se rezultat ne mijenja. Ono što na
  // sirovom listu 2024. izgleda kao 0,22 ha rekreacije u kvartu jest šum
  // uklapanja i skripta ga odbacuje — vidi namjena_po_kodu().
  {
    id: "stambeno-slobodno",
    label: "Slobodne čestice za stanovanje",
    type: "geojson",
    url: "/geo/analiza/stambeno-slobodno.geojson",
    attribution:
      "Izvedeno iz GUP-a 2015. (praćeno s lista), katastra i evidencije " +
      "zgrada Grada Splita",
    color: "#16a34a",
    group: "GUP — namjena",
    phase: 1,
  },
  {
    id: "javne-cestice",
    label: "Evidentirane javne čestice",
    type: "geojson",
    url: "/geo/analiza/javne-cestice.geojson",
    attribution:
      "GIS izvoz Grada Splita, 3. 10. 2025. — djelomična evidencija javnog statusa",
    color: "#007956",
    group: "Katastar i adrese",
    phase: 1,
  },
  {
    id: "ciljana-provjera-vlasnistva",
    label: "Ciljana provjera vlasništva",
    type: "geojson",
    url: "/geo/analiza/ciljana-provjera-vlasnistva.geojson",
    attribution:
      "Uređena zemlja — ciljano provjereno 2. 8. 2026.; katastar i nacrt GUP-a 2024.",
    color: "#007956",
    group: "Katastar i adrese",
    phase: 1,
  },
  {
    id: "cestice-planiranih-cesta",
    label: "Čestice na planiranim cestama",
    type: "geojson",
    url: "/geo/analiza/cestice-planiranih-cesta.geojson",
    attribution:
      "Izvedeno iz katastra i prometnih koridora nacrta GUP-a Splita 2024.; " +
      "vlasništvo samo iz postojećih sanitiziranih zapisa",
    color: "#953d00",
    group: "Katastar i adrese",
    phase: 1,
    pane: "planirane-ceste-cestice",
    paneZIndex: 420,
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
  ...GRAD_SLOJEVI.filter(
    ([id]) => JE_RAZVOJ || !SAMO_LOKALNO.has(id)
  ).map(gradniSloj),
];

/**
 * Pogledi. Prvi je ujedno i početni.
 *
 * „Svi slojevi” namjerno ne bira ništa: kurirani pogled je dobar kad znaš
 * što tražiš, a loš kad ne znaš — sedamdesetak slojeva koje nijedan pogled
 * ne spominje inače se ne može ni naslutiti. Zato registar ima i ulaz na
 * kojem stoji cijeli, složen po izvoru, i s kojeg se pali kvačicu po
 * kvačicu. Ostali pogledi su prečaci: svoj izbor dižu na vrh bočne trake,
 * pa se vidi što pogled tvrdi, a ostatak ostaje dohvatljiv ispod.
 */
const POGLEDI: MapView[] = [
  {
    id: "svi-slojevi",
    label: "Svi slojevi",
    razina: "nacin",
    description:
      `Cijeli registar — ${OVERLAY_LAYERS.filter((l) => l.phase === 1).length} ` +
      "slojeva složenih po izvoru i temi, ništa upaljeno unaprijed. Otvori " +
      "skupinu i pali što te zanima. Namjena iz GUP-a nije među kvačicama " +
      "nego je podloga — bira se desno, uz ortofoto.",
    layerIds: [],
  },
  {
    id: "krajobraz",
    label: "Krajobraz",
    razina: "nacin",
    description:
      "Zelenilo, krošnje, zabetoniranost, reljef i stara imena predjela.",
    layerIds: ["krosnje", "zelene-povrsine", "nepropusnost", "reljef", "toponimi", "zeleni-katastar"],
  },
  {
    id: "mobilnost",
    label: "Mobilnost",
    razina: "nacin",
    description:
      "Autobusi, ulična mreža, pješačke staze i parkirališta, te ono po čemu " +
      "se pješice zapravo hoda — nogostupi sa širinom, prijelazi, izbočine " +
      "za usporavanje i prometni znakovi.",
    layerIds: [
      "stajalista",
      "ceste-sve",
      "ceste-nerazvrstane",
      "ceste-dionice",
      "ulice-osi",
      "drzavne-ceste",
      "nogostupi",
      "pjesacki-prijelazi",
      "izbocine",
      "prometni-znakovi",
      "odbojne-ograde",
      "stajalista-grad",
      "nadstresnice",
      "parkiralista",
      "parkiraliste-grad",
      "zivi-autobusi",
    ],
  },
  {
    id: "ceste",
    label: "Ceste i ulice",
    razina: "nacin",
    description:
      "Cijela prometna mreža u jednom sloju i samo obrisom, bez rasterskih " +
      "preklopa. Puna crta je postojeće — ulice iz OSM-a s razredom i imenom " +
      "(klik daje podlogu i ograničenje) te državne ceste; crtkana je " +
      "planirano — koridori s listova GUP-a i prometne površine iz DPU-a " +
      "radne zone Dračevac. Zaseban sloj nerazvrstanih cesta pokazuje koje " +
      "dionice održava Grad Split — to je nadležnost na koju ide prijava.",
    layerIds: [
      "ceste-sve",
      "ceste-nerazvrstane",
      "parkiralista",
    ],
  },
  {
    id: "urbanizam",
    label: "Urbanizam",
    razina: "nacin",
    description:
      "Što se gdje smije graditi: UPU i DPU planovi, zgrade i gustoća " +
      "stanovništva. Podloga je namjena iz GUP-a na snazi; što joj prethodni " +
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
      "kotar",
      "naselja",
      "planovi-obuhvat",
      "zgrade-2025",
      "zgrade-visine",
      "zgrade",
      "stanovnistvo",
    ],
  },
  {
    id: "nacrt-gupa",
    label: "Što se promijenilo?",
    razina: "pitanje",
    usporedbe: true,
    description:
      "Karta je GUP iz 2024., a crveno obrubljeno je ono što se u njemu " +
      "promijenilo u odnosu na plan iz 2015. — 9,4 ha na 24 mjesta, sve IZVAN " +
      "Dračevca i Bilica. Unutar kvarta se namjena nije promijenila: " +
      "registracijski robustan raster-diff daje 0,0 ha od 9,57 ha. " +
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
    razina: "nacin",
    description:
      "Izvedeno stanje mreža iz evidencije Grada: vodovod, odvodnja s " +
      "razlikovanjem oborinske i fekalne, hidranti, trafostanice, stupovi " +
      "javne rasvjete i trase telekoma. Uz to slojevi iz DPU-a radne zone " +
      "Dračevac, koji pokazuju što je planom propisano — po razlici se vidi " +
      "što još nije izvedeno. Solarni potencijal krovova nije upaljen odmah — " +
      "sam je težak koliko sve ostalo zajedno, pa se pali kvačicom kad zatreba.",
    // „solar-krovovi” je namjerno izvan ovog popisa.
    //
    // Sam nosi 2,8 MB raspakiranog GeoJSON-a — više od polovice svega što je
    // ovaj pogled dosad povlačio (12,9 MB ukupno), a odgovara na pitanje koje
    // nema veze s ostalih dvadeset devet slojeva ovdje: ovo je pogled na mreže
    // koje su u zemlji, a solar je pogled na krovove. Ostaje u registru i pali
    // se kvačicom; ne otvara se svakome tko dođe vidjeti gdje je vodovod.
    layerIds: [
      "vodovod",
      "vodovod-spojevi",
      "vodovod-zatvaraci",
      "hidranti",
      "odvodnja",
      "odvodnja-okna",
      "odvodnja-slivnici",
      "odvodnja-tlacni",
      "struja-nn",
      "struja-nn-stupovi",
      "struja-sn",
      "struja-vn-110",
      "trafostanice",
      "trafostanice-plohe",
      "rasvjeta",
      "rasvjeta-mjesta",
      "telekom-trase",
      "telekom-sahte",
      "telekom-ht-podzemno",
      "telekom-ht-zdenci",
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
    razina: "nacin",
    description:
      "Škole, igrališta, sportski tereni, zelene površine i ostali javni " +
      "sadržaji, uz zaštićena kulturna dobra — kroz kvart prolazi trasa " +
      "Dioklecijanova vodovoda.",
    layerIds: [
      "sadrzaji",
      "igralista",
      "zelene-zone",
      "zelenilo-oprema",
      "zelenilo-vjezbaliste",
      "zelenilo-kosevi",
      "kulturno-dobro",
      "zelene-povrsine",
    ],
  },
  {
    id: "katastar",
    label: "Katastar i adrese",
    razina: "nacin",
    description:
      "Čestice, kućni brojevi i granice katastarskih općina, uz popisne " +
      "krugove Popisa 2021. Podatak o vlasništvu postoji u gradskoj " +
      "evidenciji, ali ovdje se ne objavljuje: imenuje fizičke osobe uz OIB " +
      "i bilježi hipoteke, pa stoji samo na razvojnom stroju.",
    layerIds: [
      "katastar",
      "katastar-vlasnistvo",
      "katastar-objekti",
      "granice-ko",
      "kucni-brojevi",
      "adrese",
      "popisni-krugovi",
    ],
  },
  {
    id: "planovi-obuhvat",
    label: "Što vrijedi ovdje?",
    razina: "pitanje",
    description:
      "Za svako mjesto u kvartu: koji ga prostorni planovi pokrivaju. Klik " +
      "na plohu daje naziv plana i poveznicu na sam dokument na split.hr, " +
      "pa se s karte može otići čitati odredbe koje ondje vrijede.",
    layerIds: ["planovi-obuhvat", "planovi-obuhvat-pp", "kotar", "naselja"],
  },
  {
    id: "javno-evidentirano",
    label: "Što je javno evidentirano?",
    razina: "pitanje",
    description:
      "Djelomičan prikaz čestica koje dostupni GIS izvoz izričito označava " +
      "kao Grad/JLS, Republiku Hrvatsku ili Županiju, dopunjen ciljanom " +
      "provjerom 30 čestica uz prometni koridor i velikih čestica. Čestice " +
      "bez statusa nisu proglašene privatnima.",
    layerIds: ["ciljana-provjera-vlasnistva"],
  },
  {
    id: "cestice-planiranih-cesta",
    label: "Čestice na planiranim cestama",
    razina: "pitanje",
    description:
      "Svih 338 čestica koje planirani prometni koridori nacrta GUP-a 2024. " +
      "zahvaćaju za najmanje 1 m². Vlasništvo je označeno samo za 54 čestice " +
      "s već raspoloživim sanitiziranim zapisom; za ostale se izričito kaže " +
      "da podataka nema.",
    layerIds: ["gup-2024-planirane-ceste", "cestice-planiranih-cesta"],
  },
  {
    id: "okolis-rizici",
    label: "Okoliš i rizici",
    razina: "nacin",
    description:
      "Gdje plavi, gdje ljeti gori i kakav zrak dišemo.",
    layerIds: ["poplave", "vrucina", "zrak", "nepropusnost"],
  },
  {
    id: "gdje-se-moze-graditi",
    label: "Gdje se može graditi?",
    razina: "pitanje",
    description:
      "Čestice na kojima GUP dopušta stanovanje, kroz koje ne prolazi cesta " +
      "i na kojima nema zgrade. U kvartu ih je 56 u 21 nakupini, ukupno " +
      "5,0 ha katastarski — stvarno slobodnog je 4,0 ha, jer se broji samo " +
      "dio čestice koji je U stambenoj zoni: čestica koja je pola K5 a pola " +
      "zaštitno zelenilo ulazi u sloj, ali s njom ulazi samo ta polovica. " +
      "Ispada sve čime cesta upravlja: i čestica koja JEST cesta, i ona kroz " +
      "koju nerazvrstana cesta prolazi cijelom dužinom. Prag najmanje " +
      "građevne čestice ide na NAKUPINU susjednih, ne na pojedinu, i traži " +
      "POVEZAN komad — dvije polovice razdvojene cestom ne zbrajaju se u " +
      "jednu građevnu. Njih 14 doseže 500 m², koliko Odredbe traže za " +
      "slobodnostojeću građevinu. Uska traka (ispod 6 m, koliko pojedu dva " +
      "propisana odmaka od 3 m) ulazi samo ako je uz susjeda prislonjena " +
      "dugom stranom i time ga proširuje; nadovezana krajem ispada, jer " +
      "dvije trake u nizu i dalje su traka. CRVENO je osam čestica u četiri " +
      "nakupine do kojih ne dopire cesta: Odredbe traže da građevna čestica " +
      "ima pristup na javnoprometnu površinu, a pristupni put najmanje 3 m, " +
      "pa se ondje bez služnosti ili nove ulice ne gradi — zemljište je " +
      "slobodno, ali zaključano. Pristup se sudi po nakupini, jer ako " +
      "spojeni komad negdje dodiruje cestu, do njega se dolazi. Vrijedi i " +
      "za plan na snazi i za nacrt iz 2024. — nacrt unutar kvarta ne " +
      "mijenja nijednu plohu. Sve su u zoni K5, poslovnoj namjeni koja uz " +
      "posao dopušta i stanovanje; čiste stambene zone (S, M1) u kvartu " +
      "nema, jer je ovo radna zona.",
    // Samo rezultat. Ortofoto ispod već pokazuje i zgrade i ceste, pa su
    // katastar (1314 obrisa), zgrade i ceste-sve (5383 crte) ovdje bili
    // čista mreža preko koje se sitne zelene čestice nisu vidjele. Stoje
    // kvačicom kad zatrebaju.
    layerIds: ["stambeno-slobodno"],
    legend: [
      { boja: "#16a34a", kod: "zeleno", opis: "slobodno i ima pristup na cestu" },
      {
        boja: "#dc2626",
        kod: "crveno",
        opis: "slobodno, ali bez pristupa — zaključano dok nema služnosti ili nove ulice",
      },
    ],
    dimensionId: "gup-godina",
    // Podloga namjene ugašena po dolasku: šarena je i preglasa sitne
    // čestice zbog kojih se pogled i otvara. Bira se iz istog reda čipova.
    defaultValueLayerId: "",
  },
  {
    id: "planirano",
    label: "Planirano",
    razina: "nacin",
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
 * Pitanja idu prva, i to ovim redom — prvo je ujedno i dolazna stranica.
 *
 * Redoslijed stoji izrijekom, a ne po mjestu u izvoru: mjesto u izvoru prati
 * povijest datoteke, a ovo je odluka o tome s čime se dolazi. „Gdje se može
 * graditi?” je prvo jer je to jedino pitanje na koje ova stranica ima
 * odgovor kakav za ovaj kvart ne postoji nigdje drugdje.
 */
const REDOSLIJED_PITANJA = [
  "gdje-se-moze-graditi",
  "javno-evidentirano",
  "cestice-planiranih-cesta",
  "nacrt-gupa",
  "planovi-obuhvat",
];

export const MAP_VIEWS: MapView[] = [
  ...POGLEDI.filter((v) => v.razina === "pitanje").sort(
    (a, b) =>
      REDOSLIJED_PITANJA.indexOf(a.id) - REDOSLIJED_PITANJA.indexOf(b.id)
  ),
  ...POGLEDI.filter((v) => v.razina === "nacin"),
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
    label: "2015. → 2024.",
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
