"use client";

import "leaflet/dist/leaflet.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, Geometry } from "geojson";
import {
  BASE_LAYERS,
  BASE_SKUPINE,
  OVERLAY_LAYERS,
  MAP_VIEWS,
  DIMENSIONS,
  COMPARISONS,
  UPRAVLJANI_SLOJEVI,
  KVART_CENTER,
  MAP_MAX_BOUNDS,
  shouldIsolateMapBackground,
  syncDossierMapLayout,
  type BaseLayer,
  type Comparison,
  type DossierPresentation,
  type MapView,
  type OverlayLayer,
} from "@/lib/map-views";
import { postaviKlizac } from "@/lib/karta-klizac";
import {
  izAdrese as vremeplovIzAdrese,
  natpisPodloge,
  postaviStranu,
  snimke,
  uAdresu as vremeplovUAdresu,
  vremeplovMoguc,
  zadaniVremeplov,
  type Vremeplov,
} from "@/lib/vremeplov";
import { IME_POLJA, vrijednostPolja } from "@/lib/polja";
import { ODNOS_NATPIS, type Dosje } from "@/lib/dosje-oblik";
import { STRANA_NATPIS } from "@/lib/reljef-oblik";
import { NA_SNAZI, PRETHODNI, natpisPlana } from "@/lib/plan-status";
import {
  formatPublicSourceDate,
  matchesPublicParcel,
  PUBLIC_LEVEL_LABELS,
  publicParcelDossierFacts,
  summarizePublicParcels,
  validatePublicParcelProperties,
  type PublicLevel,
  type PublicParcelFilters,
  type PublicParcelProperties,
} from "@/lib/public-parcels";
import {
  matchesTargetedOwnership,
  OWNERSHIP_COHORT_LABELS,
  OWNERSHIP_STATUS_LABELS,
  PUBLIC_ENTITY_CATEGORY_LABELS,
  summarizeTargetedOwnership,
  targetedOwnershipDossierFacts,
  validateTargetedOwnershipProperties,
  type OwnershipCohort,
  type OwnershipVerificationStatus,
  type PublicEntityCategory,
  type TargetedOwnershipFilters,
  type TargetedOwnershipProperties,
} from "@/lib/targeted-ownership";
import {
  canonicalParcelId,
  matchesPlannedRoadParcel,
  normalizeCanonicalParcelId,
  plannedRoadParcelDossierFacts,
  plannedRoadOwnershipStatusTone,
  plannedRoadPanelToneClasses,
  PLANNED_ROAD_OWNERSHIP_EVIDENCE_LABELS,
  PLANNED_ROAD_OWNERSHIP_STATUS_LABELS,
  summarizePlannedRoadParcels,
  validatePlannedRoadParcelProperties,
  type PlannedRoadOwnershipStatus,
  type PlannedRoadParcelFilters,
  type PlannedRoadParcelProperties,
} from "@/lib/planned-road-parcels";

const OVERLAY_BY_ID = new Map(OVERLAY_LAYERS.map((l) => [l.id, l]));
const JAVNE_CESTICE_URL = "/geo/analiza/javne-cestice.geojson";
const CILJANA_PROVJERA_URL = "/geo/analiza/ciljana-provjera-vlasnistva.geojson";
const PLANIRANE_CESTE_CESTICE_URL = "/geo/analiza/cestice-planiranih-cesta.geojson";
const POCETNI_JAVNI_FILTRI: PublicParcelFilters = {
  levels: [],
  purposes: [],
  built: "all",
};
const POCETNI_CILJANI_FILTRI: TargetedOwnershipFilters = {
  statuses: [],
  entityCategories: [],
  cohorts: [],
  purposes: [],
  built: "all",
};
const POCETNI_FILTRI_PLANIRANIH_CESTA: PlannedRoadParcelFilters = { statuses: [] };

/**
 * Traži li korisnik da se ne miče?
 *
 * Čita se pri svakoj uporabi, a ne jednom: postavka se mijenja usred posjeta
 * (iOS je veže uz uštedu baterije), a karta živi dugo.
 */
function bezPokreta(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Hrvatska brojnica: 1 / 2–4 / 5+.
 *
 * Zapisana je u DESIGN.md kao pravilo koje vrijedi za SVAKI broj koji sučelje
 * ispiše. „3 rezultata” i „1 rezultat” nisu isti oblik, a engleski `s` ovdje ne
 * postoji. Izuzeci su 11–14, koji unatoč zadnjoj znamenki idu u peti oblik.
 */
function brojnica(n: number, jedan: string, dva: string, pet: string): string {
  const zadnja = n % 10;
  const zadnje2 = n % 100;
  if (zadnja === 1 && zadnje2 !== 11) return jedan;
  if (zadnja >= 2 && zadnja <= 4 && (zadnje2 < 12 || zadnje2 > 14)) return dva;
  return pet;
}

/**
 * Koliko raspakiranih slojeva smije ostati u memoriji.
 *
 * Spremnik je dosad rastao bez granice: gašenje sloja miče crtež s karte, ali
 * razgrađeni GeoJSON je ostajao zauvijek. Prošetati kroz šest pogleda znači
 * 65 datoteka i 20,7 MB raspakiranog teksta, a kao JS objekti to je višestruko
 * više. Petnaest je otprilike dva puna pogleda — dovoljno da povratak na
 * prethodni pogled bude trenutačan, premalo da se skupi cijeli registar.
 */
const SPREMNIK_MAX = 15;

/**
 * Stanje karte u adresi.
 *
 * Karta je bila jedina stranica koja ne proizvodi poveznicu: pogled, slojevi,
 * podloga i odabrana čestica živjeli su samo u Reactu, a adresa je do kraja
 * ostajala `/karta`. Za inicijativu čiji je jedini živi kanal WhatsApp grupa
 * to znači da se najveća površina ne može podijeliti — susjed koji nađe da mu
 * čestica leži pod dalekovodom nema što poslati.
 *
 * Zapisuje se `replaceState`, ne `pushState`: paljenje sloja nije navigacija i
 * ne smije puniti povijest, inače „natrag” postane petnaest kvačica unatrag.
 */
const P = {
  pogled: "pogled",
  sloj: "sloj",
  podloga: "podloga",
  vremeplov: "vremeplov",
  namjena: "namjena",
  usporedba: "usporedba",
  prikaz: "prikaz",
  cestica: "kc",
  parcelId: "pid",
  sredina: "c",
  zum: "z",
} as const;

interface StanjeKarte {
  viewId: string;
  activeIds: string[];
  baseId: string;
  /** Par podloga koje vremeplov reže; `null` kad je ugašen. */
  vremeplov: Vremeplov | null;
  dimValue: Record<string, string>;
  comparisonId: string | null;
  nacin: "obris" | "klizac";
  cestica: [number, number] | null;
  parcelId: string | null;
}

/**
 * Adresa kakva je bila pri UČITAVANJU stranice, ne pri montiranju komponente.
 *
 * Modul-razina namjerno. U razvoju React montira dvaput (StrictMode), a između
 * dva montiranja karta je već jednom zapisala svoje zadano središte u adresu —
 * pa bi druga snimka pročitala ono što je aplikacija upravo pregazila i duboka
 * poveznica bi se opet izgubila. Ovdje se čita jednom po učitavanju stranice i
 * pamti do kraja.
 */
let PRVA_ADRESA: (Partial<StanjeKarte> & {
  sredina?: [number, number];
  zum?: number;
}) | null = null;

function prvaAdresa() {
  PRVA_ADRESA ??= izAdrese();
  return PRVA_ADRESA;
}

function izAdrese(): Partial<StanjeKarte> & {
  sredina?: [number, number];
  zum?: number;
} {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const par = (v: string | null): [number, number] | undefined => {
    const d = v?.split(",").map(Number);
    return d?.length === 2 && d.every(Number.isFinite)
      ? [d[0], d[1]]
      : undefined;
  };
  const pogled = q.get(P.pogled);
  const namjena = q.get(P.namjena);
  const out: Partial<StanjeKarte> & {
    sredina?: [number, number];
    zum?: number;
  } = {};
  if (pogled && MAP_VIEWS.some((v) => v.id === pogled)) out.viewId = pogled;
  const slojevi = q.getAll(P.sloj).filter((id) => OVERLAY_BY_ID.has(id));
  if (q.has(P.sloj)) out.activeIds = slojevi;
  const podloga = q.get(P.podloga);
  if (podloga && BASE_LAYERS.some((b) => b.id === podloga)) out.baseId = podloga;
  out.vremeplov = vremeplovIzAdrese(BASE_LAYERS, q.get(P.vremeplov));
  // Prazan `namjena=` je valjano stanje („bez podloge”), pa se razlikuje
  // od izostanka parametra — has() umjesto istinitosti vrijednosti.
  if (q.has(P.namjena) && DIMENSIONS.length)
    out.dimValue = { [DIMENSIONS[0].id]: namjena ?? "" };
  const usp = q.get(P.usporedba);
  if (usp !== null)
    out.comparisonId = COMPARISONS.some((c) => c.id === usp) ? usp : null;
  const prikaz = q.get(P.prikaz);
  if (prikaz === "klizac" || prikaz === "obris") out.nacin = prikaz;
  out.cestica = par(q.get(P.cestica)) ?? null;
  out.parcelId = normalizeCanonicalParcelId(q.get(P.parcelId));
  out.sredina = par(q.get(P.sredina));
  const z = Number(q.get(P.zum));
  if (Number.isFinite(z) && z >= 12 && z <= 19) out.zum = z;
  return out;
}

function uAdresu(s: StanjeKarte, sredina: [number, number], zum: number) {
  const q = new URLSearchParams();
  q.set(P.pogled, s.viewId);
  for (const id of s.activeIds) q.append(P.sloj, id);
  q.set(P.podloga, s.baseId);
  // Vremeplov se u adresu upisuje samo kad je upaljen: prazan parametar bi
  // svakoj podijeljenoj poveznici dodao rep koji ništa ne znači.
  if (s.vremeplov) q.set(P.vremeplov, vremeplovUAdresu(s.vremeplov));
  for (const d of DIMENSIONS) q.set(P.namjena, s.dimValue[d.id] ?? "");
  if (s.comparisonId) q.set(P.usporedba, s.comparisonId);
  if (s.nacin !== "obris") q.set(P.prikaz, s.nacin);
  if (s.cestica) q.set(P.cestica, s.cestica.map((n) => n.toFixed(6)).join(","));
  if (s.parcelId) q.set(P.parcelId, s.parcelId);
  q.set(P.sredina, sredina.map((n) => n.toFixed(5)).join(","));
  q.set(P.zum, String(zum));
  window.history.replaceState(null, "", `?${q}`);
}

/**
 * Početna vrijednost svake dimenzije za odabrani pogled.
 *
 * Upisuju se SVE dimenzije, ne samo ona koju pogled spominje: biralo stoji
 * uz podlogu i vidi se uvijek, pa dimenzija koju pogled ne namješta mora
 * imati definirano stanje — prazan niz, dakle ugašena podloga. Bez toga bi
 * biralo pri promjeni pogleda ostalo bez ijednog odabranog čipa, a stara
 * podloga bi ostala na karti.
 */
function dimenzijaPogleda(view: MapView): Record<string, string> {
  return Object.fromEntries(
    DIMENSIONS.map((d) => [
      d.id,
      view.dimensionId === d.id
        ? (view.defaultValueLayerId ?? d.values[0].layerId)
        : "",
    ])
  );
}

export function MapClient() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  // Podloga ih je jedna, a s vremeplovom dvije, pa ih drži niz umjesto jedne
  // reference: inače pri gašenju vremeplova ostane jedna nepočišćena i visi
  // pod kartom do sljedeće promjene podloge.
  const podlogeRef = useRef<LeafletNS.TileLayer[]>([]);
  // Uz sam sloj pamti se i okno u kojem je stvoren: klizač sloj seli u
  // rezano okno, a sloj se u Leafletu ne može premjestiti nakon stvaranja.
  const overlayInstances = useRef<Map<string, Postavljeni>>(new Map());
  const geojsonCache = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const solarHandler = useRef<((e: LeafletNS.LeafletMouseEvent) => void) | null>(
    null
  );

  // Adresa se NE čita pri prvom iscrtavanju.
  //
  // `/karta` je statički prerendana: poslužitelj ne zna upit, pa bi svako
  // čitanje `window.location` u inicijalizatoru stanja dalo drugačiji prvi
  // kadar na klijentu nego u HTML-u i srušilo hidraciju. Prvi kadar zato
  // uvijek pokazuje zadani pogled, a adresa se primijeni odmah nakon
  // montiranja — jedan kadar razlike umjesto slomljenog stabla.
  //
  // `useSyncExternalStore` je za to i napravljen: poslužiteljski snimak je
  // prazan niz, klijentski je pravi upit, i React sam ponovno iscrta nakon
  // hidracije umjesto da prijavi razliku.
  const upit = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => ""
  );
  const [hidriran, setHidriran] = useState(false);
  // Snimka upita, uzeta prije nego što išta stigne pisati u adresu.
  //
  // Prije se `izAdrese()` zvao lijeno, tek nakon dva await-a u pokretanju
  // karte — a dotad je karta već poslala `moveend` sa zadanog središta i
  // `uAdresu()` je adresu prepisao. Duboka poveznica se tako uništavala
  // sama: `c` i `z` su se čitali iz URL-a koji je aplikacija u međuvremenu
  // pregazila, pa je z=18 uvijek ispadao z=15.

  const [ready, setReady] = useState(false);
  const [baseId, setBaseId] = useState("dof");
  // Vremeplov je ugašen dok se ne zatraži. Karta se otvara na jednoj podlozi,
  // ne na razdjelniku koji nitko nije povukao.
  const [vremeplov, setVremeplov] = useState<Vremeplov | null>(null);
  const [viewId, setViewId] = useState(MAP_VIEWS[0].id);
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(phase1(MAP_VIEWS[0].layerIds))
  );
  const [javniFiltri, setJavniFiltri] = useState<PublicParcelFilters>(
    POCETNI_JAVNI_FILTRI
  );
  const [javneCestice, setJavneCestice] = useState<
    Feature<Geometry, PublicParcelProperties>[] | null
  >(null);
  const [ciljaniFiltri, setCiljaniFiltri] = useState<TargetedOwnershipFilters>(
    POCETNI_CILJANI_FILTRI
  );
  const [ciljanaProvjera, setCiljanaProvjera] = useState<
    Feature<Geometry, TargetedOwnershipProperties>[] | null
  >(null);
  const [filtriPlaniranihCesta, setFiltriPlaniranihCesta] =
    useState<PlannedRoadParcelFilters>(POCETNI_FILTRI_PLANIRANIH_CESTA);
  const [cesticePlaniranihCesta, setCesticePlaniranihCesta] = useState<
    Feature<Geometry, PlannedRoadParcelProperties>[] | null
  >(null);
  // Stanje podloge: `null` dok se ne zna, pa poruka ne bljesne bez potrebe.
  const [podlogaStanje, setPodlogaStanje] = useState<
    "ucitava" | "gotovo" | "greska" | null
  >(null);
  // Slojevi koji se dohvaćaju ili nisu uspjeli — kvačica to mora pokazati,
  // inače je upaljen sloj koji ništa ne crta isto što i prazan prostor.
  const [slojStanje, setSlojStanje] = useState<
    Record<string, "ucitava" | "greska">
  >({});
  // Uske zaslone se ne pogađa širinom nego ULAZOM i prostorom: `usko` je
  // istinito kad nema mjesta za dvije lebdeće ploče pokraj karte.
  const usko = useUsko();
  // Ploče su otvorene po dolasku na širokom zaslonu; na uskom NISU, jer bi
  // pokrile upravo ono zbog čega se stranica otvara. Vidi PlohaSlojeva.
  const [panelOpen, setPanelOpen] = useState(false);
  const [kontroleOpen, setKontroleOpen] = useState(false);
  // Na uskom zaslonu smije biti otvorena najviše jedna ploča. Dvije se ondje
  // preklapaju i druga viri ispod prve kao greška iscrtavanja.
  const otvoriTraku = (v: boolean) => {
    setPanelOpen(v);
    if (v && usko) setKontroleOpen(false);
  };
  const otvoriKontrole = (v: boolean) => {
    setKontroleOpen(v);
    if (v && usko) setPanelOpen(false);
  };
  // Kad se širina promijeni (i pri prvom mjerenju na klijentu), ploče se
  // vraćaju na zadano za tu širinu: na širokom obje otvorene, na uskom
  // nijedna. Namješta se tijekom iscrtavanja, a ne u efektu — efekt bi
  // ovdje značio jedan iscrtan kadar s krivim stanjem, pa bi na telefonu
  // ploče bljesnule preko karte prije nego što se sklope.
  const [zadnjeUsko, setZadnjeUsko] = useState<boolean | null>(null);
  if (zadnjeUsko !== usko) {
    setZadnjeUsko(usko);
    setPanelOpen(!usko);
    setKontroleOpen(!usko);
  }
  // Odabrana vrijednost po dimenziji i uključena usporedba. Ovo su odvojene
  // kontrole namjerno: koju godinu gledaš i koju promjenu ističeš dvije su
  // različite odluke.
  const [dimValue, setDimValue] = useState<Record<string, string>>(() =>
    dimenzijaPogleda(MAP_VIEWS[0])
  );
  const [comparisonId, setComparisonId] = useState<string | null>(
    () => MAP_VIEWS[0].defaultComparisonId ?? null
  );
  // "obris" = odabrana godina + crtkani obrisi promjena; "klizac" = obje
  // godine jedna uz drugu s razdjelnikom.
  const [nacin, setNacin] = useState<"obris" | "klizac">("obris");
  // Dosje kliknute čestice. Stoji u ploči, ne u skočnom prozoru — vidi
  // DosjePlaca. `null` znači da nijedna čestica nije odabrana.
  const [dosje, setDosje] = useState<Dosje | null>(null);
  const [dosjeUcitavanje, setDosjeUcitavanje] = useState(false);
  const [dosjeGreska, setDosjeGreska] = useState<string | null>(null);
  // Točka po kojoj je dosje otvoren ide u adresu za stare koordinatne veze;
  // kad klik ili pretraga znaju kanonski ID, ide i on kako se preklopljene
  // geometrije ne bi pri ponovnom otvaranju zamijenile susjednom česticom.
  const [cestica, setCestica] = useState<[number, number] | null>(null);
  const [parcelId, setParcelId] = useState<string | null>(null);
  // Svaki klik dobiva svoj broj; kad se odgovor vrati, upisuje se samo ako
  // je u međuvremenu nije pretekao noviji klik.
  const dosjeZahtjev = useRef(0);
  // Klik na objekt sloja i klik na kartu stižu oba do karte. Ova oznaka
  // razlikuje „pogodio sam nešto” od „pogodio sam prazno”, pa dosje ne
  // iskoči preko skočnog prozora koji je upravo otvoren.
  const pogodakSloja = useRef(0);

  // Trenutačno istaknuta čestica — drži se da je se može vratiti u izvorni
  // stil kad se odabere druga ili kad se ploča zatvori.
  const istaknuto = useRef<Isticanje | null>(null);
  /** Biljeg na točki dosjea — postoji i kad nijedan poligon nije pogođen. */
  const biljeg = useRef<LeafletNS.Marker | null>(null);

  const postaviBiljeg = (lat: number, lng: number) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    biljeg.current?.remove();
    biljeg.current = L.marker([lat, lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "",
        iconSize: [0, 0],
        html:
          '<span style="position:absolute;left:-11px;top:-11px;width:22px;' +
          'height:22px;border-radius:9999px;border:3px solid #18181b;' +
          'box-shadow:0 0 0 3px rgba(255,255,255,.9),0 1px 6px rgba(0,0,0,.5)">' +
          "</span>",
      }),
    }).addTo(map);
  };

  const otvoriDosje = useRef((
    lat: number,
    lng: number,
    oznaci?: Isticanje,
    selectedParcelId?: string,
  ) => {
    const moj = ++dosjeZahtjev.current;
    istaknuto.current?.vrati();
    istaknuto.current = oznaci ?? null;
    oznaci?.istakni();
    // Bez oznake na karti dosje opisuje česticu koju nitko ne vidi. Ploha
    // se istakne samo kad je klik pogodio poligon katastra; klik na prazno
    // i duboka poveznica nisu imali ništa. Biljeg stoji uvijek.
    postaviBiljeg(lat, lng);
    setCestica([lat, lng]);
    setParcelId(selectedParcelId ?? null);
    setDosje(null);
    setDosjeGreska(null);
    setDosjeUcitavanje(true);
    void (async () => {
      try {
        const query = new URLSearchParams({
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
        });
        if (selectedParcelId) query.set("parcel_id", selectedParcelId);
        const res = await fetch(`/api/cestica?${query}`);
        const d = (await res.json()) as Dosje & { error?: string };
        if (moj !== dosjeZahtjev.current) return;
        if (!res.ok) setDosjeGreska(d.error ?? "Nema podataka.");
        else setDosje(d);
      } catch {
        if (moj === dosjeZahtjev.current)
          setDosjeGreska("Greška pri dohvaćanju.");
      } finally {
        if (moj === dosjeZahtjev.current) setDosjeUcitavanje(false);
      }
    })();
  });


  // Adresa se primjenjuje tijekom iscrtavanja, čim klijentski snimak stigne
  // — isti obrazac kao kod širine ploča, i jedini koji ne uvodi kadar s
  // krivim stanjem.
  if (!hidriran && upit !== "") {
    const a = prvaAdresa();
    const pogled = MAP_VIEWS.find((v) => v.id === a.viewId);
    if (pogled) {
      setViewId(pogled.id);
      setDimValue(dimenzijaPogleda(pogled));
      setComparisonId(pogled.defaultComparisonId ?? null);
      if (!a.activeIds) setActiveIds(new Set(phase1(pogled.layerIds)));
    }
    if (a.activeIds) setActiveIds(new Set(a.activeIds));
    if (a.baseId) setBaseId(a.baseId);
    if (a.vremeplov) setVremeplov(a.vremeplov);
    if (a.dimValue) setDimValue((p) => ({ ...p, ...a.dimValue }));
    if (a.comparisonId !== undefined) setComparisonId(a.comparisonId);
    if (a.nacin) setNacin(a.nacin);
    if (a.cestica) setCestica(a.cestica);
    if (a.parcelId) setParcelId(a.parcelId);
    setHidriran(true);
  }

  // Snimka upita, uzeta prije nego što išta stigne pisati u adresu. Ovaj
  // efekt je prvi po redu, a pisač adrese čeka `ready`, koji se postavlja
  // tek unutar sljedećeg efekta — pa je izvorni upit ovdje zajamčeno još
  // netaknut.
  // ---- init map once ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapDiv.current) return;
      LRef.current = L;
      // Karta se STVARA na mjestu iz adrese, a ne skače na njega poslije.
      //
      // Prije je nastajala na zadanom središtu, pa se tek nakon dohvata
      // granice pomicala — a u tom razmaku je već poslala `moveend`, pisač
      // adrese je zapisao zadano, i duboka poveznica se gubila. Uz to je
      // pomak dolazio na kartu koja je u međuvremenu mogla biti uklonjena
      // (dvostruko montiranje u razvoju), pa se nije ni dogodio.
      const adr = prvaAdresa();
      const mirno = bezPokreta();
      const map = L.map(mapDiv.current, {
        center: adr.sredina ?? KVART_CENTER,
        zoom: adr.zum ?? 15,
        minZoom: 12,
        maxZoom: 19,
        zoomControl: false,
        attributionControl: true,
        // Platno umjesto SVG-a.
        //
        // Leaflet zadano crta svaki objekt kao <path> u DOM-u. Mjereno na
        // pogledu „Infrastruktura”: 33 510 elemenata u jednom <svg>, iz 12,9 MB
        // raspakiranog JSON-a, uz 15 dugih zadataka i 3,1 s blokiranog glavnog
        // reda — i to na stolnom računalu i brzoj vezi. Telefon na 4G, koji je
        // ovdje zapisan kao stvarni prizor, prolazi puno gore.
        //
        // Platno crta isti sadržaj bez ijednog čvora po objektu. `setStyle`,
        // `bringToFront`, skočni prozori i klik rade jednako, pa isticanje
        // odabrane čestice i dosje ostaju netaknuti.
        preferCanvas: true,
        // Pokret koji nitko nije tražio. Uz `prefers-reduced-motion` Leaflet
        // inače i dalje animira zumiranje i prijelaz pločica.
        zoomAnimation: !mirno,
        fadeAnimation: !mirno,
        markerZoomAnimation: !mirno,
      });
      // Ograniči pomicanje na kvart + ~700 m rezerve — karta je o Dračevcu
      // i Bilicama, ne o cijelom Splitu.
      map.setMaxBounds(MAP_MAX_BOUNDS);
      // Vektorski slojevi svi crtaju u zajedničko overlayPane, pa se ne mogu
      // rezati pojedinačno. Svaka strana klizača dobiva svoje okno.
      for (const ime of ["sbs-lijevo", "sbs-desno"]) {
        const okno = map.createPane(ime);
        okno.style.zIndex = "400";
      }
      // Podloge vremeplova idu u okna na visini Leafletova `tilePane` (200),
      // dakle ispod svih preklopnika: rez dijeli ono što je NAJDONJE, a slojevi
      // iznad ostaju cijeli s obje strane razdjelnika.
      for (const ime of ["podloga-lijevo", "podloga-desno"]) {
        const okno = map.createPane(ime);
        okno.style.zIndex = "200";
      }
      // Slojevi koji moraju zadržati međusobni red bez obzira na to koji se
      // GeoJSON prvi učita dobivaju vlastita okna. Red u registru nije
      // dovoljan: putanje se stvaraju tek nakon neovisnih fetch odgovora.
      for (const layer of OVERLAY_LAYERS) {
        if (!layer.pane || layer.paneZIndex === undefined || map.getPane(layer.pane))
          continue;
        const pane = map.createPane(layer.pane);
        pane.style.zIndex = String(layer.paneZIndex);
      }
      L.control.zoom({ position: "topright" }).addTo(map);

      // Klik na praznu kartu otvara dosje.
      //
      // Prije je dosje visio o pogotku u poligon katastra, pa je u pogledu
      // „Katastar i adrese” svaki dodir hvatala ploha popisnog kruga i
      // vraćala šifru statističkog kruga, a drugdje se nije događalo ništa.
      // Dosje ionako pita poslužitelj po koordinati, ne po objektu, pa mu
      // poligon nije ni trebao. Slojevi sa skočnim prozorom postavljaju
      // `pogodakSloja` pa njihov klik ovdje ne odjekne dvaput.
      map.on("click", (e) => {
        if (Date.now() - pogodakSloja.current < 60) return;
        if (solarHandler.current) return; // solarni način ima svoj klik
        otvoriDosje.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setReady(true);

      // Stvarna granica kvartova (službeni poligoni) + oznake u središtu svakog.
      try {
        const fc = (await (
          await fetch("/geo/granica.geojson")
        ).json()) as GeoJSON.FeatureCollection;
        if (cancelled) return;
        const boundary = L.geoJSON(fc, {
          interactive: false,
          style: {
            color: "#059669",
            weight: 2.5,
            dashArray: "7 6",
            fillColor: "#059669",
            fillOpacity: 0.06,
          },
          onEachFeature: (f, lyr) => {
            const name = (f.properties as { naziv?: string })?.naziv;
            if (!name || !("getBounds" in lyr)) return;
            const c = (lyr as LeafletNS.Polygon).getBounds().getCenter();
            L.marker(c, {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "",
                iconSize: [0, 0],
                html: `<span style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font:800 15px/1 system-ui,sans-serif;letter-spacing:.03em;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.7)">${name}</span>`,
              }),
            }).addTo(map);
          },
        }).addTo(map);
        // Granica se uokviruje samo ako adresa nije rekla kamo gledati.
        if (!(adr.sredina && adr.zum))
          map.fitBounds(boundary.getBounds(), { padding: [34, 34] });
      } catch {
        /* bez granice karta ostaje ondje gdje je i stvorena */
      }

      // Čestica iz adrese: otvori dosje čim je karta spremna.
      if (adr.cestica)
        otvoriDosje.current(
          adr.cestica[0],
          adr.cestica[1],
          undefined,
          adr.parcelId ?? undefined,
        );
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- base layer ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    for (const stara of podlogeRef.current) {
      stara.off();
      map.removeLayer(stara);
    }
    podlogeRef.current = [];

    // Podloga je najteža stvar na stranici i jedina koja stiže izvana. Dok
    // je nema, karta je siva ploha bez ijedne riječi — a „sporija veza je
    // normalna” je zapisana obveza, pa je to redovito stanje, ne rub.
    //
    // Broje se pločice koje su pale: jedna promašena pločica nije kvar
    // (poslužitelj ih zna odbiti pod opterećenjem), ali tri jesu. S upaljenim
    // vremeplovom se broji preko obiju podloga zajedno — stanje opisuje ono
    // što se vidi, a vidi se jedna slika s rezom, ne dvije karte.
    let pale = 0;
    setPodlogaStanje("ucitava");

    const postavi = (base: BaseLayer, okno?: string) => {
      const layer = podlogaSloj(L, base, okno);
      layer.on("loading", () => setPodlogaStanje("ucitava"));
      layer.on("load", () => {
        pale = 0;
        setPodlogaStanje("gotovo");
      });
      layer.on("tileerror", () => {
        if (++pale >= 3) setPodlogaStanje("greska");
      });
      layer.addTo(map);
      if (!okno) layer.bringToBack();
      podlogeRef.current.push(layer);
    };

    if (vremeplov) {
      // Svaka strana u svoje okno, da ih klizač može rezati zasebno — isto
      // kao kod usporedbe godina namjene.
      postavi(podlogaPoId(vremeplov.lijevo), "podloga-lijevo");
      postavi(podlogaPoId(vremeplov.desno), "podloga-desno");
    } else {
      postavi(podlogaPoId(baseId));
    }

    const postavljene = podlogeRef.current;
    return () => {
      for (const layer of postavljene) layer.off();
    };
  }, [baseId, vremeplov, ready]);

  // ---- adresa: zapiši stanje kad se promijeni ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || (upit !== "" && !hidriran)) return;
    const zapisi = () => {
      const c = map.getCenter();
      uAdresu(
        {
          viewId,
          activeIds: [...activeIds],
          baseId,
          vremeplov,
          dimValue,
          comparisonId,
          nacin,
          cestica,
          parcelId,
        },
        [c.lat, c.lng],
        map.getZoom()
      );
    };
    zapisi();
    map.on("moveend zoomend", zapisi);
    return () => {
      map.off("moveend zoomend", zapisi);
    };
  }, [viewId, activeIds, baseId, vremeplov, dimValue, comparisonId, nacin, cestica, parcelId, ready, hidriran, upit]);

  // Što se crta = neovisni slojevi + odabrana vrijednost svake dimenzije
  // + sloj usporedbe ako je uključen.
  const usporedba = comparisonId
    ? (COMPARISONS.find((x) => x.id === comparisonId) ?? null)
    : null;
  const klizac = nacin === "klizac" && usporedba !== null;

  const renderIds = useMemo(() => {
    const out = new Set(activeIds);
    if (klizac && usporedba) {
      // Obje godine odjednom, ali razdvojene razdjelnikom pa se ne miješaju.
      out.add(usporedba.fromLayerId);
      out.add(usporedba.toLayerId);
      return out;
    }
    // Prazna vrijednost znači ugašenu podlogu — dimenzija smije biti i
    // nijedna. Bez toga se izvedeni slojevi (npr. slobodne čestice) ne mogu
    // gledati bez šarene namjene ispod, koja ih preglasa.
    for (const layerId of Object.values(dimValue)) if (layerId) out.add(layerId);
    if (usporedba) out.add(usporedba.layerId);
    return out;
  }, [activeIds, dimValue, usporedba, klizac]);

  const javniFilterKey = useMemo(
    () =>
      JSON.stringify({
        levels: [...javniFiltri.levels].sort(),
        purposes: [...javniFiltri.purposes].sort(),
        built: javniFiltri.built,
      }),
    [javniFiltri]
  );
  const ciljaniFilterKey = useMemo(
    () =>
      JSON.stringify({
        statuses: [...ciljaniFiltri.statuses].sort(),
        entityCategories: [...ciljaniFiltri.entityCategories].sort(),
        cohorts: [...ciljaniFiltri.cohorts].sort(),
        purposes: [...ciljaniFiltri.purposes].sort(),
        built: ciljaniFiltri.built,
      }),
    [ciljaniFiltri]
  );
  const planiraneCesteFilterKey = useMemo(
    () => JSON.stringify({ statuses: [...filtriPlaniranihCesta.statuses].sort() }),
    [filtriPlaniranihCesta]
  );

  // Panel treba iste podatke kao Leaflet, ali ne zaseban mrežni zahtjev:
  // ucitajGeoJSON dijeli LRU spremnik s crtežom sloja. Učitava se tek kad
  // je pitanje ili sam sloj doista uključen.
  useEffect(() => {
    if (!ready || !renderIds.has("javne-cestice") || javneCestice) return;
    let cancelled = false;
    void ucitajGeoJSON(JAVNE_CESTICE_URL, geojsonCache.current)
      .then((collection) => {
        const features = collection.features.map((feature) => {
          validatePublicParcelProperties(feature.properties);
          return feature as Feature<Geometry, PublicParcelProperties>;
        });
        if (!cancelled) setJavneCestice(features);
      })
      .catch(() => {
        if (!cancelled)
          setSlojStanje((current) => ({
            ...current,
            "javne-cestice": "greska",
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, renderIds, javneCestice]);

  useEffect(() => {
    if (
      !ready ||
      !renderIds.has("ciljana-provjera-vlasnistva") ||
      ciljanaProvjera
    )
      return;
    let cancelled = false;
    void ucitajGeoJSON(CILJANA_PROVJERA_URL, geojsonCache.current)
      .then((collection) => {
        const features = collection.features.map((feature) => {
          validateTargetedOwnershipProperties(feature.properties);
          return feature as Feature<Geometry, TargetedOwnershipProperties>;
        });
        if (!cancelled) setCiljanaProvjera(features);
      })
      .catch(() => {
        if (!cancelled)
          setSlojStanje((current) => ({
            ...current,
            "ciljana-provjera-vlasnistva": "greska",
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, renderIds, ciljanaProvjera]);

  useEffect(() => {
    if (
      !ready ||
      !renderIds.has("cestice-planiranih-cesta") ||
      cesticePlaniranihCesta
    )
      return;
    let cancelled = false;
    void ucitajGeoJSON(PLANIRANE_CESTE_CESTICE_URL, geojsonCache.current)
      .then((collection) => {
        const features = collection.features.map((feature) => {
          validatePlannedRoadParcelProperties(feature.properties);
          return feature as Feature<Geometry, PlannedRoadParcelProperties>;
        });
        if (!cancelled) setCesticePlaniranihCesta(features);
      })
      .catch(() => {
        if (!cancelled)
          setSlojStanje((current) => ({
            ...current,
            "cestice-planiranih-cesta": "greska",
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, renderIds, cesticePlaniranihCesta]);

  /** layerId → okno, da klizač može odrezati svaku stranu zasebno. */
  const okna = useMemo<Record<string, string>>(
    () =>
      klizac && usporedba
        ? {
            [usporedba.fromLayerId]: "sbs-lijevo",
            [usporedba.toLayerId]: "sbs-desno",
          }
        : {},
    [klizac, usporedba]
  );

  // ---- sync overlays with renderIds ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    // Miču se ugašeni slojevi, ali i oni kojima se promijenilo okno —
    // paljenje klizača sloj mora preseliti u rezano okno, a Leaflet okno
    // postojećem sloju ne mijenja, pa se mora stvoriti iznova. Bez toga
    // odabrana godina ostane izvan reza i klizač naizgled ne radi.
    for (const [id, inst] of overlayInstances.current) {
      const layer = OVERLAY_BY_ID.get(id);
      const zeljenoOkno = okna[id] ?? layer?.pane;
      if (
        !renderIds.has(id) ||
        inst.okno !== zeljenoOkno ||
        (id === "javne-cestice" && inst.filterKey !== javniFilterKey) ||
        (id === "ciljana-provjera-vlasnistva" &&
          inst.filterKey !== ciljaniFilterKey) ||
        (id === "cestice-planiranih-cesta" &&
          inst.filterKey !== planiraneCesteFilterKey)
      ) {
        map.removeLayer(inst.sloj);
        overlayInstances.current.delete(id);
      }
    }
    for (const id of renderIds) {
      if (overlayInstances.current.has(id)) continue;
      const layer = OVERLAY_BY_ID.get(id);
      if (!layer || layer.phase !== 1) continue;
      if (layer.type === "api") continue; // handled separately (solar)
      const layerOkno = okna[id] ?? layer.pane;
      dodajSloj(L, map, layer, layerOkno, overlayInstances.current,
        geojsonCache.current, otvoriDosje.current, pogodakSloja,
        (id, stanje) =>
          setSlojStanje((p) => {
            if (stanje) return { ...p, [id]: stanje };
            if (!(id in p)) return p;
            const rest = { ...p };
            delete rest[id];
            return rest;
          }),
        id === "javne-cestice" ? javniFiltri : undefined,
        id === "ciljana-provjera-vlasnistva" ? ciljaniFiltri : undefined,
        id === "cestice-planiranih-cesta" ? filtriPlaniranihCesta : undefined,
        id === "javne-cestice"
          ? javniFilterKey
          : id === "ciljana-provjera-vlasnistva"
            ? ciljaniFilterKey
            : id === "cestice-planiranih-cesta"
              ? planiraneCesteFilterKey
            : undefined,
      );
    }
    // solar click handler
    const solarActive = renderIds.has("solar");
    if (solarActive && !solarHandler.current) {
      const handler = (e: LeafletNS.LeafletMouseEvent) =>
        prikaziSolar(L, map, e.latlng);
      map.on("click", handler);
      solarHandler.current = handler;
      map.getContainer().style.cursor = "crosshair";
    } else if (!solarActive && solarHandler.current) {
      map.off("click", solarHandler.current);
      solarHandler.current = null;
      map.getContainer().style.cursor = "";
    }
  }, [
    renderIds,
    ready,
    okna,
    javniFiltri,
    javniFilterKey,
    ciljaniFiltri,
    ciljaniFilterKey,
    filtriPlaniranihCesta,
    planiraneCesteFilterKey,
  ]);

  // ---- klizač za usporedbu dviju godina namjene ----
  //
  // Sama mehanika (razdjelnik, `clip`, tipkovnica) živi u lib/karta-klizac.ts
  // jer je traže dvije stvari: ova usporedba i vremeplov među podlogama.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lijevo = map.getPane("sbs-lijevo");
    const desno = map.getPane("sbs-desno");
    if (!lijevo || !desno) return;
    if (!klizac) {
      lijevo.style.clip = "";
      desno.style.clip = "";
      return;
    }
    return postaviKlizac(map, lijevo, desno, {
      lijevo:
        OVERLAY_BY_ID.get(usporedba?.fromLayerId ?? "")?.label ?? "lijeva strana",
      desno:
        OVERLAY_BY_ID.get(usporedba?.toLayerId ?? "")?.label ?? "desna strana",
    });
  }, [klizac, usporedba, ready, renderIds]);

  // ---- klizač vremeplova ----
  //
  // Isti razdjelnik, druga dva okna. Vremeplov i usporedba namjene se
  // MEĐUSOBNO ISKLJUČUJU (vidi `postaviVremeplov` i `postaviNacin`), pa na
  // karti nikad nisu dvije drške: dvije bi bile zbrka, a `aria-valuetext` bi
  // uz to opisivao rez koji se ne gleda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lijevo = map.getPane("podloga-lijevo");
    const desno = map.getPane("podloga-desno");
    if (!lijevo || !desno) return;
    if (!vremeplov) {
      lijevo.style.clip = "";
      desno.style.clip = "";
      return;
    }
    return postaviKlizac(map, lijevo, desno, {
      lijevo: natpisPodloge(BASE_LAYERS, vremeplov.lijevo),
      desno: natpisPodloge(BASE_LAYERS, vremeplov.desno),
    });
  }, [vremeplov, ready]);

  // ---- UI actions ----
  function selectView(id: string) {
    const view = MAP_VIEWS.find((v) => v.id === id);
    if (!view) return;
    setViewId(id);
    setActiveIds(new Set(phase1(view.layerIds)));
    setDimValue(dimenzijaPogleda(view));
    setComparisonId(view.defaultComparisonId ?? null);
  }
  function toggleLayer(id: string) {
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Pali i gasi vremeplov. Paljenje gasi klizač usporedbe namjene.
   *
   * Dvije drške na istoj karti nisu dvije usporedbe nego nijedna: povlačenjem
   * jedne pomiče se rez koji se ne gleda, a onaj koji se gleda stoji. Zato se
   * ovdje bira — zadnje traženo je ono koje ostaje.
   */
  function postaviVremeplov(par: Vremeplov | null) {
    setVremeplov(par);
    if (par) setNacin("obris");
  }

  /** Klizač usporedbe namjene; paljenje gasi vremeplov, iz istog razloga. */
  function postaviNacin(n: "obris" | "klizac") {
    setNacin(n);
    if (n === "klizac") setVremeplov(null);
  }

  const currentView = MAP_VIEWS.find((v) => v.id === viewId);
  const prezentacijaDosjea: DossierPresentation = dosjeUcitavanje
    ? "loading"
    : dosje
      ? "resolved"
      : dosjeGreska !== null
        ? "error"
        : "closed";
  const dosjePrikazan = prezentacijaDosjea !== "closed";
  const uskiModalOtvoren = shouldIsolateMapBackground(usko, {
    selected: cestica !== null,
    presentation: prezentacijaDosjea,
  });

  // Jedan životni ciklus posjeduje i granice i cilj odabrane točke. Tako
  // otvaranje, zatvaranje i promjena 1024px prijeloma ne mogu zadržati
  // postavke prethodnog rasporeda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // MatchMedia may update React before Leaflet and the browser have committed
    // the new container dimensions. Wait one frame, then refresh Leaflet's size
    // and position against the actual responsive layout.
    const frame = window.requestAnimationFrame(() => {
      syncDossierMapLayout(
        map,
        uskiModalOtvoren,
        dosjePrikazan ? cestica : null,
        !bezPokreta(),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready, uskiModalOtvoren, dosjePrikazan, cestica]);

  // Dira samo refove i postavljače stanja, koji su svi stalni — pa je i sama
  // stalna, i smije stajati u popisu ovisnosti efekta ispod bez da ga budi.
  const zatvoriDosje = useCallback(() => {
    dosjeZahtjev.current++;
    istaknuto.current?.vrati();
    istaknuto.current = null;
    biljeg.current?.remove();
    biljeg.current = null;
    setDosje(null);
    setDosjeGreska(null);
    setDosjeUcitavanje(false);
    setCestica(null);
    setParcelId(null);
  }, []);

  // Escape zatvara ono što je najgore otvoreno — dosje prije ploča. Prije
  // nije zatvarao ništa osim izbornika, pa je tipkovnicom karta bila zamka.
  useEffect(() => {
    const naTipku = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dosje || dosjeUcitavanje || dosjeGreska) zatvoriDosje();
      else if (kontroleOpen && usko) setKontroleOpen(false);
      else if (panelOpen && usko) setPanelOpen(false);
    };
    document.addEventListener("keydown", naTipku);
    return () => document.removeEventListener("keydown", naTipku);
    // Popis ovisnosti je izričit. Bez njega se slušač skidao i vješao pri
    // svakom iscrtavanju — radilo je, ali je svako pomicanje karte prolazilo
    // kroz dvije izmjene slušača bez razloga.
  }, [dosje, dosjeUcitavanje, dosjeGreska, kontroleOpen, panelOpen, usko, zatvoriDosje]);

  return (
    // Cijeli prozor. `fixed inset-0`, a ne visina u `vh`: karta je sama
    // sebi stranica — nema ničega iznad ni ispod, pa nema ni listanja koje
    // bi pomicalo ploče, ni razmimoilaženja s trakom mobilnog preglednika.
    <div className="fixed inset-0 overflow-hidden bg-zinc-100">
      <div
        data-map-background
        inert={uskiModalOtvoren}
        className="absolute inset-0"
        style={{ pointerEvents: uskiModalOtvoren ? "none" : undefined }}
      >
        <div ref={mapDiv} className="h-full w-full bg-zinc-100" />

        <StanjePodloge
          stanje={podlogaStanje}
          naUlicnu={() => setBaseId("karta")}
        />

        {/* Traka pogleda. Na uskom zaslonu stoji IZVAN bočne trake i uvijek je
            vidljiva: dok je bila u njoj, zatvaranje trake da bi se vidjela
            karta odnosilo je i cijelu navigaciju. */}
        {usko && (
          <TrakaPogleda
            views={MAP_VIEWS}
            viewId={viewId}
            onSelectView={selectView}
          />
        )}

        <Kontrole
          baseId={baseId}
          onBase={setBaseId}
          vremeplov={vremeplov}
          onVremeplov={postaviVremeplov}
          dimValue={dimValue}
          onDimValue={(dimId, layerId) =>
            setDimValue((p) => ({ ...p, [dimId]: layerId }))
          }
          comparisonId={comparisonId}
          klizac={klizac}
          open={kontroleOpen}
          onOpen={otvoriKontrole}
          usko={usko}
        />

        <Sidebar
          views={MAP_VIEWS}
          viewId={viewId}
          onSelectView={selectView}
          currentView={currentView}
          activeIds={activeIds}
          onToggle={toggleLayer}
          slojStanje={slojStanje}
          usporedbe={COMPARISONS.filter(
            (c) => c.dimensionId === currentView?.dimensionId,
          )}
          comparisonId={comparisonId}
          onComparison={setComparisonId}
          nacin={nacin}
          onNacin={postaviNacin}
          javneCestice={javneCestice}
          javniFiltri={javniFiltri}
          onJavniFiltri={setJavniFiltri}
          onPonoviJavne={() => {
            toggleLayer("javne-cestice");
            setTimeout(() => toggleLayer("javne-cestice"), 0);
          }}
          ciljanaProvjera={ciljanaProvjera}
          ciljaniFiltri={ciljaniFiltri}
          onCiljaniFiltri={setCiljaniFiltri}
          onPonoviCiljanu={() => {
            toggleLayer("ciljana-provjera-vlasnistva");
            setTimeout(() => toggleLayer("ciljana-provjera-vlasnistva"), 0);
          }}
          cesticePlaniranihCesta={cesticePlaniranihCesta}
          filtriPlaniranihCesta={filtriPlaniranihCesta}
          onFiltriPlaniranihCesta={setFiltriPlaniranihCesta}
          onPonoviCesticePlaniranihCesta={() => {
            toggleLayer("cestice-planiranih-cesta");
            setTimeout(() => toggleLayer("cestice-planiranih-cesta"), 0);
          }}
          onOtvoriCesticu={(lat, lng, selectedParcelId) =>
            otvoriDosje.current(lat, lng, undefined, selectedParcelId)
          }
          open={panelOpen}
          onOpen={otvoriTraku}
          usko={usko}
        />
      </div>

      {dosjePrikazan && (
        <DosjePlaca
          uzKontrole={kontroleOpen && !usko}
          usko={usko}
          tocka={cestica}
          dosje={dosje}
          ucitavanje={dosjeUcitavanje}
          greska={dosjeGreska}
          onClose={zatvoriDosje}
        />
      )}
    </div>
  );
}

/**
 * Ima li mjesta za dvije lebdeće ploče pokraj karte?
 *
 * Prag je 1024 px, a ne `sm`: bočna traka je 20 rem, desna ploča 14 rem, i
 * tek iznad tisuću piksela između njih ostane karte vrijedne gledanja.
 */
function useUsko(): boolean {
  const [usko, setUsko] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const na = () => setUsko(mq.matches);
    na();
    mq.addEventListener("change", na);
    return () => mq.removeEventListener("change", na);
  }, []);
  return usko;
}

/**
 * Stanje podloge: jedina poruka koja se sama pojavi na karti.
 *
 * Ortofoto je najteža stvar na stranici i dolazi s tuđeg poslužitelja. Dok
 * ga nema, karta je siva ploha — a bez ijedne riječi to se čita kao kvar, ne
 * kao čekanje. Kad doista padne, nudi se ulična karta: lakša je i uvijek
 * radi, pa je bolja od praznine.
 */
function StanjePodloge({
  stanje,
  naUlicnu,
}: {
  stanje: "ucitava" | "gotovo" | "greska" | null;
  naUlicnu: () => void;
}) {
  if (stanje === null || stanje === "gotovo") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute left-1/2 top-3 z-[1050] flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow"
    >
      {stanje === "ucitava" ? (
        <>
          <span
            aria-hidden
            className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-maslina"
          />
          <span className="text-zinc-600">Učitavam ortofoto…</span>
        </>
      ) : (
        <>
          <span className="text-zinc-700">Ortofoto se ne učitava.</span>
          <button
            onClick={naUlicnu}
            className="fokus rounded-full bg-maslina px-2.5 py-1 font-semibold text-white hover:bg-maslina-tamna"
          >
            Uličnu kartu
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Vodoravna traka pogleda za uski zaslon.
 *
 * Pogled je jedina prava navigacija ove stranice. U bočnoj traci je bio
 * dostupan samo dok ona pokriva kartu, što je na telefonu značilo „ili
 * gledaš kartu ili znaš gdje si”. Ovdje stoji iznad svega, jednoredno, i
 * kliže vodoravno.
 */
function TrakaPogleda({
  views,
  viewId,
  onSelectView,
}: {
  views: typeof MAP_VIEWS;
  viewId: string;
  onSelectView: (id: string) => void;
}) {
  // Traka je šira od zaslona, a odabrani čip zna biti tisuću piksela desno.
  // Poveznica iz WhatsAppa tako otvara pogled na kojem ništa ne izgleda
  // odabrano — pa se aktivni čip sam dovuče u vidno polje.
  const aktivni = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    aktivni.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [viewId]);
  // „Više” se otvara samo ako je u njemu ono što je odabrano — inače traka
  // pri dolasku pokazuje tri pitanja i ništa drugo.
  const [vise, setVise] = useState(
    () => views.find((v) => v.id === viewId)?.razina === "nacin"
  );
  const pitanja = views.filter((v) => v.razina === "pitanje");
  const nacini = views.filter((v) => v.razina === "nacin");
  const cip = (v: MapView) => (
    <button
      key={v.id}
      onClick={() => onSelectView(v.id)}
      aria-current={v.id === viewId}
      aria-pressed={v.id === viewId}
      ref={v.id === viewId ? aktivni : undefined}
      className={`fokus meta-cip shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
        v.id === viewId
          ? "border-maslina bg-maslina text-white"
          : "border-zinc-200 bg-white text-zinc-700"
      }`}
    >
      {v.label}
    </button>
  );
  return (
    // „Više” stoji IZVAN klizne trake, prikvačeno uz desni rub.
    //
    // Mjereno na 390 px: tri pitanja + „Više” traže 515 px, pa je „Više”
    // počinjalo na x=425 — potpuno izvan zaslona, iza sakrivenog klizača,
    // bez ijednog znaka da ondje išta ima. Deset pogleda bilo je dostupno
    // samo pokretom koji se ne da otkriti. Sad se traka kliže ispod njega,
    // a prijelaz je omekšan da se vidi da ima još.
    // Desni razmak drži trak dalje od Leafletovog zumiranja.
    //
    // Mjereno na 500 px: „Više” je sjedalo na x 409–488, a gumb „−” na
    // 458–488 / y 42–72 — pa je čip svojim z-indexom (1050 protiv Leafletovih
    // 1000) pokrivao donjih 8 px cijele širine gumba. Zumiranje je ondje bilo
    // djelomično nepritisnjivo, i to na uskom zaslonu, gdje se karta i gleda.
    // Razmak je računat na dodirnu mjeru zumiranja (44 px + 10 px odmaka), ne
    // na mišju (30 px), jer je dodir slučaj koji mora proći.
    <nav
      aria-label="Pogled"
      className="absolute inset-x-0 top-16 z-[1050] flex items-start gap-1.5 py-0 pb-1 pl-3 pr-16"
    >
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pitanja.map(cip)}
        {vise && nacini.map(cip)}
      </div>
      <button
        onClick={() => setVise((v) => !v)}
        aria-expanded={vise}
        className="fokus meta-cip shrink-0 whitespace-nowrap rounded-full border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
      >
        {vise ? "Manje" : `Više (${nacini.length})`}
      </button>
    </nav>
  );
}

/**
 * Bočna traka unutar karte: pogledi i kvačice slojeva.
 *
 * Skupine su izvorni `<details>`: sklapanje i tipkovnica dolaze besplatno,
 * bez knjižnice, a stotinjak slojeva se više ne pregledava beskrajnim
 * listanjem.
 *
 * Ono što je pogled odabrao diže se u vlastitu skupinu na vrhu i iz skupine
 * po izvoru se briše. Duplikat bi značio dvije kvačice za isti sloj, pa bi
 * gašenje na jednom mjestu naizgled ne bi radilo na drugom; ovako svaki
 * sloj stoji točno jednom, a odgovor na „što ovaj pogled zapravo pokazuje”
 * ne traži prelistavanje četrnaest skupina.
 */
function Sidebar(props: {
  views: typeof MAP_VIEWS;
  viewId: string;
  onSelectView: (id: string) => void;
  currentView?: MapView;
  activeIds: Set<string>;
  onToggle: (id: string) => void;
  slojStanje: Record<string, "ucitava" | "greska">;
  usporedbe: Comparison[];
  comparisonId: string | null;
  onComparison: (id: string | null) => void;
  nacin: "obris" | "klizac";
  onNacin: (n: "obris" | "klizac") => void;
  javneCestice: Feature<Geometry, PublicParcelProperties>[] | null;
  javniFiltri: PublicParcelFilters;
  onJavniFiltri: (filters: PublicParcelFilters) => void;
  onPonoviJavne: () => void;
  ciljanaProvjera: Feature<Geometry, TargetedOwnershipProperties>[] | null;
  ciljaniFiltri: TargetedOwnershipFilters;
  onCiljaniFiltri: (filters: TargetedOwnershipFilters) => void;
  onPonoviCiljanu: () => void;
  cesticePlaniranihCesta: Feature<Geometry, PlannedRoadParcelProperties>[] | null;
  filtriPlaniranihCesta: PlannedRoadParcelFilters;
  onFiltriPlaniranihCesta: (filters: PlannedRoadParcelFilters) => void;
  onPonoviCesticePlaniranihCesta: () => void;
  onOtvoriCesticu: (lat: number, lng: number, parcelId?: string) => void;
  open: boolean;
  onOpen: (v: boolean) => void;
  usko: boolean;
}) {
  const { currentView, usko } = props;
  // Slojeve kojima upravlja biralo desno ovdje se ne nudi ni kad ih pogled
  // spominje — inače bi ista podloga imala i kvačicu i čip.
  const odabrani = (currentView?.layerIds ?? [])
    .map((id) => OVERLAY_BY_ID.get(id))
    .filter((l): l is OverlayLayer => !!l && !UPRAVLJANI_SLOJEVI.has(l.id));
  const podignuti = new Set(odabrani.map((l) => l.id));
  if (currentView?.id === "javno-evidentirano") {
    podignuti.add("javne-cestice");
    podignuti.add("ciljana-provjera-vlasnistva");
  }
  const skupine = [...new Set(OVERLAY_LAYERS.map((l) => l.group))];
  const uSkupini = (g: string) =>
    OVERLAY_LAYERS.filter(
      (l) =>
        l.group === g && !UPRAVLJANI_SLOJEVI.has(l.id) && !podignuti.has(l.id)
    );

  const [trazi, setTrazi] = useState("");
  // Pretraga ide bez dijakritike i bez obzira na veličinu slova: „daljnovod”
  // se ne piše, ali „dalekovod” se traži i s „č” i bez njega.
  const bezKvacica = (v: string) =>
    v.toLocaleLowerCase("hr-HR").normalize("NFD").replace(/\p{M}/gu, "");
  const upit = bezKvacica(trazi.trim());
  const nadeni =
    upit === ""
      ? []
      : OVERLAY_LAYERS.filter(
          (l) =>
            !UPRAVLJANI_SLOJEVI.has(l.id) &&
            !podignuti.has(l.id) &&
            (bezKvacica(l.label).includes(upit) ||
              bezKvacica(l.group).includes(upit))
        );
  // Sloj koji je pogled već podigao gore ne ponavlja se u rezultatima (jedan
  // sloj, jedna kvačica), ali se ni ne prešućuje: „nema ništa” dok stoji dva
  // reda više bilo bi laž.
  const nadeniPodignuti =
    upit === ""
      ? []
      : odabrani.filter(
          (l) =>
            bezKvacica(l.label).includes(upit) ||
            bezKvacica(l.group).includes(upit)
        );
  // Slojevi kojima upravlja biralo podloge nemaju kvačicu, ali se traže —
  // „namjena” i „gup” su najtraženiji pojmovi na stranici, a vraćali su
  // sve osim onoga što se tražilo. Prikazuju se kao uputa, ne kao kvačica.
  const nadeniUpravljani =
    upit === ""
      ? []
      : OVERLAY_LAYERS.filter(
          (l) =>
            UPRAVLJANI_SLOJEVI.has(l.id) &&
            (bezKvacica(l.label).includes(upit) ||
              bezKvacica(l.group).includes(upit))
        );

  // Zatvorena: na širokom zaslonu gumb uz rub, na uskom vrpca uz dno —
  // ondje je palac, a i sve ostalo se na telefonu otvara odozdo.
  if (!props.open) {
    return (
      <button
        onClick={() => props.onOpen(true)}
        className={
          usko
            ? "fokus meta absolute inset-x-0 bottom-0 z-[1050] flex items-center justify-center gap-2 border-t border-zinc-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-sm font-semibold shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
            : "fokus absolute left-3 top-16 z-[1100] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold shadow hover:bg-zinc-50"
        }
      >
        <span aria-hidden>☰</span> Slojevi
        {props.activeIds.size > 0 && (
          <span className="rounded-full bg-maslina-vez px-2 text-xs text-maslina-tamna">
            {props.activeIds.size}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={
        usko
          ? "absolute inset-x-0 bottom-0 z-[1120] flex max-h-[72%] flex-col overflow-hidden rounded-t-xl border-t border-zinc-200 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
          : "absolute bottom-3 left-3 top-16 z-[1100] flex w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
      }
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <span className="text-sm font-bold">Karta kvarta</span>
        <button
          onClick={() => props.onOpen(false)}
          aria-label="Sakrij bočnu traku"
          className="fokus meta rounded px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          {usko ? "zatvori ⌄" : "⟨ sakrij"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
        {/* Na uskom zaslonu pogledi imaju vlastitu traku iznad karte, pa se
            ovdje ne ponavljaju — dvije iste kontrole na jednom zaslonu. */}
        {!usko && (
          <>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
              Pitanja
            </p>
            <div className="flex flex-wrap gap-1">
              {props.views
                .filter((v) => v.razina === "pitanje")
                .map((v) => (
                  <button
                    key={v.id}
                    onClick={() => props.onSelectView(v.id)}
                    aria-current={v.id === props.viewId}
                    aria-pressed={v.id === props.viewId}
                    className={`fokus meta-cip rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      v.id === props.viewId
                        ? "border-maslina bg-maslina text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
            </div>
            {/* Načini gledanja nisu pitanja i ne stoje uz njih. Skupljeni su
                jer ih je devet, a otvoreni ako je odabran jedan od njih. */}
            <details
              open={
                props.views.find((v) => v.id === props.viewId)?.razina ===
                "nacin"
              }
              className="group mt-1.5"
            >
              <summary className="fokus meta flex cursor-pointer select-none items-center gap-1.5 py-1 text-xs font-semibold text-zinc-600 [&::-webkit-details-marker]:hidden">
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden
                  className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90"
                >
                  <path d="M4 2.5 8 6l-4 3.5z" fill="currentColor" />
                </svg>
                Načini gledanja
              </summary>
              <div className="flex flex-wrap gap-1 pt-1">
                {props.views
                  .filter((v) => v.razina === "nacin")
                  .map((v) => (
                    <button
                      key={v.id}
                      onClick={() => props.onSelectView(v.id)}
                      aria-current={v.id === props.viewId}
                      aria-pressed={v.id === props.viewId}
                      className={`fokus meta-cip rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        v.id === props.viewId
                          ? "border-maslina bg-maslina text-white"
                          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
              </div>
            </details>
          </>
        )}
        {currentView &&
          currentView.id !== "javno-evidentirano" &&
          currentView.id !== "cestice-planiranih-cesta" && (
          <Opis view={currentView} />
        )}

        {currentView?.id === "cestice-planiranih-cesta" && (
          <PlaniraneCesteFilteri
            features={props.cesticePlaniranihCesta}
            filters={props.filtriPlaniranihCesta}
            onFilters={props.onFiltriPlaniranihCesta}
            stanje={props.slojStanje["cestice-planiranih-cesta"]}
            onRetry={props.onPonoviCesticePlaniranihCesta}
          />
        )}

        {currentView?.id === "javno-evidentirano" && (
          <IzborJavnogDokaza
            activeIds={props.activeIds}
            onToggle={props.onToggle}
          />
        )}

        {currentView?.id === "javno-evidentirano" &&
          props.activeIds.has("ciljana-provjera-vlasnistva") && (
          <CiljanaProvjeraFilteri
            features={props.ciljanaProvjera}
            filters={props.ciljaniFiltri}
            onFilters={props.onCiljaniFiltri}
            stanje={props.slojStanje["ciljana-provjera-vlasnistva"]}
            onRetry={props.onPonoviCiljanu}
          />
        )}

        {currentView?.id === "javno-evidentirano" &&
          props.activeIds.has("javne-cestice") && (
          <JavneCesticeFilteri
            features={props.javneCestice}
            filters={props.javniFiltri}
            onFilters={props.onJavniFiltri}
            stanje={props.slojStanje["javne-cestice"]}
            onRetry={props.onPonoviJavne}
          />
        )}

        {/* Ključ boja izvedenog sloja stoji odmah uz opis, prije popisa
            slojeva: on je odgovor na „zašto je moja čestica crvena”. */}
        {currentView?.legend && (
          <dl className="mt-2 space-y-1">
            {currentView.legend.map((e) => (
              <div key={e.kod} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-black/20"
                  style={{ background: e.boja }}
                />
                <dt className="sr-only">{e.kod}</dt>
                <dd className="text-zinc-600">{e.opis}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Usporedba živi u pogledu koji je i postavlja, ne u ploči podloge.
            Ondje je bila u svakom pogledu iako je korisna u jednom. */}
        {currentView?.usporedbe && props.usporedbe.length > 0 && (
          <div className="mt-3 rounded-lg bg-zinc-100 p-2">
            <p className="mb-1 text-xs font-semibold text-zinc-600">
              Istakni promjene
            </p>
            <div className="flex flex-wrap gap-1">
              <Cip
                odabran={props.comparisonId === null}
                tamni
                onClick={() => props.onComparison(null)}
              >
                ne
              </Cip>
              {props.usporedbe.map((c) => (
                <Cip
                  key={c.id}
                  odabran={props.comparisonId === c.id}
                  crveni
                  onClick={() => props.onComparison(c.id)}
                >
                  {c.label}
                </Cip>
              ))}
            </div>
            {props.comparisonId && (
              <>
                <p className="mb-1 mt-2 text-xs font-semibold text-zinc-600">
                  Prikaz
                </p>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["obris", "obrisi promjena"],
                      ["klizac", "klizač"],
                    ] as const
                  ).map(([id, oznaka]) => (
                    <Cip
                      key={id}
                      odabran={props.nacin === id}
                      tamni
                      onClick={() => props.onNacin(id)}
                    >
                      {oznaka}
                    </Cip>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <TraziCesticu onOtvori={props.onOtvoriCesticu} />

        {odabrani.length > 0 && (
          <>
            <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-zinc-500">
              U ovom pogledu
            </p>
            <div className="space-y-1">
              {odabrani.map((l) => (
                <Kvacica
                  key={l.id}
                  sloj={l}
                  upaljen={props.activeIds.has(l.id)}
                  stanje={props.slojStanje[l.id]}
                  onToggle={props.onToggle}
                />
              ))}
            </div>
          </>
        )}

        <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-zinc-500">
          {odabrani.length > 0 ? "Ostali slojevi" : "Slojevi"}
        </p>

        {/* Pretraživanje. Sa 113 slojeva u četrnaest skupina „gdje je
            dalekovod” je bilo prelistavanje; sad je jedan potez. Dok se
            traži, skupine se ne prikazuju — hijerarhija je tu smetnja. */}
        <label className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina">
          <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-500">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={trazi}
            onChange={(e) => setTrazi(e.target.value)}
            placeholder="Traži sloj…"
            aria-label="Traži sloj po imenu"
            className="meta w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-zinc-600"
          />
          {trazi && (
            <button
              onClick={() => setTrazi("")}
              aria-label="Očisti pretraživanje"
              className="fokus meta shrink-0 rounded px-2 text-zinc-600 hover:text-zinc-900"
            >
              ✕
            </button>
          )}
        </label>

        {/* Isto kao kod traženja čestice: sa 113 slojeva pretraga je glavni put
            do sloja, a rezultati su se dosad mijenjali bez ijedne riječi. */}
        <p role="status" aria-live="polite" className="sr-only">
          {upit === ""
            ? ""
            : (() => {
                const n =
                  nadeni.length +
                  nadeniUpravljani.length +
                  nadeniPodignuti.length;
                // „Pronađeno” je bezlično, pa se slaže i s 1 i s 2 i s 5;
                // „odgovara/odgovaraju” bi tražilo i slaganje glagola.
                return n === 0
                  ? `Nijedan sloj ne odgovara upitu ${trazi}.`
                  : `Pronađeno: ${n} ${brojnica(n, "sloj", "sloja", "slojeva")}.`;
              })()}
        </p>

        {trazi.trim() !== "" && nadeniPodignuti.length > 0 && (
          <p className="mb-2 rounded-lg bg-zinc-50 p-2 text-zinc-700">
            {nadeniPodignuti.map((l) => l.label).join(", ")} — već je gore, u{" "}
            <b className="font-semibold">U ovom pogledu</b>.
          </p>
        )}

        {trazi.trim() !== "" && nadeniUpravljani.length > 0 && (
          <div className="mb-2 space-y-1 rounded-lg bg-zinc-50 p-2">
            {nadeniUpravljani.map((l) => (
              <div key={l.id} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-black/20"
                  style={{ background: l.color }}
                />
                <p className="text-zinc-700">
                  {l.label} — nije kvačica nego podloga, bira se u{" "}
                  <b className="font-semibold">Podloga i plan</b>.
                </p>
              </div>
            ))}
          </div>
        )}

        {trazi.trim() !== "" ? (
          nadeni.length === 0 &&
          nadeniUpravljani.length === 0 &&
          nadeniPodignuti.length === 0 ? (
            <p className="py-2 text-zinc-600">
              Nijedan sloj ne odgovara upitu „{trazi}”.
            </p>
          ) : (
            <div className="space-y-1">
              {nadeni.map((l) => (
                <div key={l.id}>
                  <Kvacica
                    sloj={l}
                    upaljen={props.activeIds.has(l.id)}
                    stanje={props.slojStanje[l.id]}
                    onToggle={props.onToggle}
                  />
                  <p className="pl-8 text-xs text-zinc-600">{l.group}</p>
                </div>
              ))}
            </div>
          )
        ) : (
        skupine.map((g) => {
          const slojevi = uSkupini(g);
          if (slojevi.length === 0) return null;
          const n = slojevi.filter((l) => props.activeIds.has(l.id)).length;
          return (
            <details key={g} open={n > 0} className="group border-b border-zinc-100">
              <summary className="fokus meta flex cursor-pointer select-none items-center gap-1.5 py-2 font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
                {/* `display:flex` na <summary> gasi preglednikov trokutić, pa
                    ga crtamo sami — inače 14 skupina izgleda kao 14 naslova,
                    a ne kao 14 kontrola. */}
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden
                  className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90"
                >
                  <path d="M4 2.5 8 6l-4 3.5z" fill="currentColor" />
                </svg>
                {g}
                {n > 0 && (
                  <span className="ml-1 rounded-full bg-maslina-vez px-1.5 text-maslina-tamna">
                    {n}
                  </span>
                )}
              </summary>
              <div className="space-y-1 pb-2 pl-1">
                {slojevi.map((l) => (
                  <Kvacica
                    key={l.id}
                    sloj={l}
                    upaljen={props.activeIds.has(l.id)}
                    stanje={props.slojStanje[l.id]}
                    onToggle={props.onToggle}
                  />
                ))}
              </div>
            </details>
          );
        })
        )}
      </div>

      {/* Prije je stajalo ispod karte. Otkad karta uzima cijeli prozor,
          „ispod” ne postoji, a oboje je i dalje potrebno: granicu se
          preuzima, a izvore se mora navesti. */}
      <div className="border-t border-zinc-200 px-3 py-2 text-xs leading-snug text-zinc-500">
        <a
          href="/geo/granica.geojson"
          download="granica-dracevac-bilice.geojson"
          className="fokus meta inline-flex items-center gap-1.5 py-1 font-semibold text-zinc-700 hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15h12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Preuzmi granicu (GeoJSON)
        </a>
        <p className="mt-1">
          Službeni otvoreni servisi (DGU, ISPU/MGIPU, Hrvatske vode,
          Copernicus, Promet Split, HAKOM…). Puni popis izvora i licenci na{" "}
          <a href="/podaci" className="fokus underline hover:text-zinc-800">
            Prostorni podaci
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Traženje čestice po broju ili adresi.
 *
 * Ovo je tipkovnički put do dosjea, kojeg dosad nije bilo: geometrija na
 * karti nema `tabindex`, pa je korisnik koji ne rukuje mišem mogao proći
 * kroz svaku kontrolu na stranici i ne otvoriti nijednu česticu — a dosje
 * je jedino zbog čega stranica postoji. WCAG AA je zapisan kao pod.
 *
 * Usput odgovara i na pitanje koje mišem nema odgovora: „znam svoj broj
 * čestice, gdje je?”
 */
function TraziCesticu({
  onOtvori,
}: {
  onOtvori: (lat: number, lng: number, parcelId?: string) => void;
}) {
  const [q, setQ] = useState("");
  // Rezultat nosi upit za koji je dobiven. Time se „učitavam” i „nema ništa”
  // IZVODE iz stanja umjesto da se postavljaju — efekt tako ne dira stanje
  // sinkrono, pa nema kaskadnog iscrtavanja pri svakom slovu.
  const [odgovor, setOdgovor] = useState<{
    q: string;
    lista: {
      naziv: string;
      opis: string;
      lat: number;
      lng: number;
      parcel_id?: string;
    }[];
  }>({ q: "", lista: [] });
  const zahtjev = useRef(0);
  const upit = q.trim();
  const svjez = odgovor.q === upit;
  const ucitava = upit !== "" && !svjez;
  const prazno = upit !== "" && svjez && odgovor.lista.length === 0;

  useEffect(() => {
    const u = q.trim();
    if (u === "") return;
    const moj = ++zahtjev.current;
    // Odgoda, da se ne šalje zahtjev na svako slovo.
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/cestica/trazi?q=${encodeURIComponent(u)}`);
          const d = (await r.json()) as {
            pogodci?: {
              naziv: string;
              opis: string;
              lat: number;
              lng: number;
              parcel_id?: string;
            }[];
          };
          if (moj === zahtjev.current) setOdgovor({ q: u, lista: d.pogodci ?? [] });
        } catch {
          if (moj === zahtjev.current) setOdgovor({ q: u, lista: [] });
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mt-4">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">
          Nađi česticu
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="k.č. 392/3 ili Mostine 1"
          className="fokus meta w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-600"
        />
      </label>
      {/* Rezultati se objavljuju.
          Traženje čestice postoji zato da se do dosjea može doći tipkovnicom.
          Put je postojao, ali dolazak se nije čuo: rezultati bi se pojavili, a
          čitač zaslona ne bi rekao ništa. `role="status"` je pristojan — čeka
          stanku umjesto da prekida tipkanje. */}
      <p role="status" aria-live="polite" className="sr-only">
        {ucitava
          ? "Tražim…"
          : prazno
            ? `Nema rezultata za ${upit}.`
            : svjez && odgovor.lista.length > 0
              ? `${odgovor.lista.length} ${brojnica(odgovor.lista.length, "rezultat", "rezultata", "rezultata")}. Odaberi za otvaranje dosjea.`
              : ""}
      </p>
      {ucitava && <p className="mt-1 text-xs text-zinc-600">Tražim…</p>}
      {prazno && (
        <p className="mt-1 text-xs text-zinc-600">
          Ništa pod „{upit}”. Broj čestice ide s kosom crtom, npr. 392/3.
        </p>
      )}
      {svjez && odgovor.lista.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {odgovor.lista.map((p) => (
            <li key={`${p.naziv}-${p.lat}-${p.lng}`}>
              <button
                onClick={() => {
                  onOtvori(p.lat, p.lng, p.parcel_id);
                  setQ("");
                }}
                className="fokus meta flex w-full items-baseline gap-2 rounded px-1 text-left hover:bg-zinc-100"
              >
                <span className="font-medium text-zinc-900">{p.naziv}</span>
                <span className="text-xs text-zinc-600">{p.opis}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IzborJavnogDokaza({
  activeIds,
  onToggle,
}: {
  activeIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const odaberi = (odabrani: string, ugasi: string) => {
    if (!activeIds.has(odabrani)) onToggle(odabrani);
    if (activeIds.has(ugasi)) onToggle(ugasi);
  };
  const opcije = [
    {
      id: "ciljana-provjera-vlasnistva",
      ugasi: "javne-cestice",
      naslov: "Provjerene",
      opis: "30 ciljanih čestica",
    },
    {
      id: "javne-cestice",
      ugasi: "ciljana-provjera-vlasnistva",
      naslov: "GIS izvoz",
      opis: "81 izričito javna",
    },
  ];
  return (
    <fieldset className="mt-3">
      <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
        Skup podataka
      </legend>
      <p className="mt-1 text-xs leading-normal text-zinc-600">
        Prikazuje se jedan skup odjednom.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
        {opcije.map((opcija) => {
          const odabran = activeIds.has(opcija.id);
          return (
            <button
              key={opcija.id}
              type="button"
              aria-pressed={odabran}
              onClick={() => odaberi(opcija.id, opcija.ugasi)}
              className={`fokus meta min-h-11 rounded-md px-2 py-1.5 text-left ${
                odabran
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <span className="block text-sm font-bold">{opcija.naslov}</span>
              <span className="block text-xs">{opcija.opis}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PlaniraneCesteFilteri({
  features,
  filters,
  onFilters,
  stanje,
  onRetry,
}: {
  features: Feature<Geometry, PlannedRoadParcelProperties>[] | null;
  filters: PlannedRoadParcelFilters;
  onFilters: (filters: PlannedRoadParcelFilters) => void;
  stanje?: "ucitava" | "greska";
  onRetry: () => void;
}) {
  const summary = features
    ? summarizePlannedRoadParcels(features, filters)
    : { count: 0, road_overlap_m2: 0 };
  const statusCounts = features
    ? features.reduce(
        (counts, feature) => {
          counts[feature.properties.ownership_status] += 1;
          return counts;
        },
        {
          confirmed_public: 0,
          mixed_public: 0,
          cadastre_public: 0,
          city_gis_public: 0,
          not_confirmed_public: 0,
          unresolved: 0,
          no_data: 0,
        } satisfies Record<PlannedRoadOwnershipStatus, number>
      )
    : null;
  const toggleStatus = (status: PlannedRoadOwnershipStatus) =>
    onFilters({
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((candidate) => candidate !== status)
        : [...filters.statuses, status],
    });

  return (
    <section aria-label="Filtri čestica na planiranim cestama" className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-zinc-900">
          Čestice na planiranim cestama
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${plannedRoadPanelToneClasses("count")}`}
        >
          338 čestica
        </span>
      </div>
      <p className="mt-2 text-base leading-normal text-zinc-700">
        Planirani prometni koridori nacrta GUP-a 2024. zahvaćaju svaku od ovih
        čestica za najmanje 1 m². Vlasništvo je označeno samo za 54 čestice s
        već raspoloživim sanitiziranim zapisom; za ostale podataka nema.
      </p>

      {stanje === "greska" ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${plannedRoadPanelToneClasses("error")}`}
        >
          <p>Sloj čestica na planiranim cestama nije se učitao.</p>
          <button
            type="button"
            onClick={onRetry}
            className="fokus meta mt-1 min-h-11 font-semibold underline"
          >
            Pokušaj ponovno
          </button>
        </div>
      ) : !features || stanje === "ucitava" ? (
        <p role="status" aria-busy="true" className="mt-3 text-sm text-zinc-600">
          Učitavam 338 čestica na planiranim cestama…
        </p>
      ) : (
        <>
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-lg font-bold text-zinc-900"
          >
            {summary.count.toLocaleString("hr-HR")} {brojnica(summary.count, "čestica", "čestice", "čestica")} ·{" "}
            {(summary.road_overlap_m2 / 10_000).toLocaleString("hr-HR", {
              maximumFractionDigits: 1,
            })}{" "}
            ha zahvata planiranih cesta
          </p>

          <fieldset className="mt-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
              Status vlasništva
            </legend>
            <div className="mt-1 space-y-0.5">
              {(
                Object.keys(
                  PLANNED_ROAD_OWNERSHIP_STATUS_LABELS
                ) as PlannedRoadOwnershipStatus[]
              ).map((status) => (
                <label
                  key={status}
                  className="meta flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 hover:bg-zinc-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina"
                >
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                    className="h-4 w-4 shrink-0 accent-maslina outline-none"
                  />
                  <span className="flex-1 leading-tight">
                    {PLANNED_ROAD_OWNERSHIP_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-600">
                    {statusCounts?.[status] ?? 0}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {summary.count === 0 && (
            <p className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-700">
              Nema čestica na planiranim cestama za odabrane filtre.
            </p>
          )}
          {filters.statuses.length > 0 && (
            <button
              type="button"
              onClick={() => onFilters(POCETNI_FILTRI_PLANIRANIH_CESTA)}
              className="fokus meta mt-2 min-h-11 text-sm font-semibold text-maslina hover:underline"
            >
              Poništi filtre
            </button>
          )}
        </>
      )}

      <p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-normal text-zinc-600">
        Vlasništvo je označeno samo iz postojećih sanitiziranih zapisa. Nova
        provjera nije provedena.
      </p>
    </section>
  );
}

function JavneCesticeFilteri({
  features,
  filters,
  onFilters,
  stanje,
  onRetry,
}: {
  features: Feature<Geometry, PublicParcelProperties>[] | null;
  filters: PublicParcelFilters;
  onFilters: (filters: PublicParcelFilters) => void;
  stanje?: "ucitava" | "greska";
  onRetry: () => void;
}) {
  const summary = features
    ? summarizePublicParcels(features, filters)
    : { count: 0, area_m2: 0 };
  const purposeOptions = features
    ? [...
        features.reduce((options, feature) => {
          const code = feature.properties.purpose_primary_code ?? "unknown";
          const current = options.get(code) ?? {
            code,
            label:
              feature.properties.purpose_primary_label ??
              "Namjena nije određena",
            count: 0,
          };
          current.count += 1;
          options.set(code, current);
          return options;
        }, new Map<string, { code: string; label: string; count: number }>()).values(),
      ].sort((a, b) =>
        a.code === "unknown"
          ? 1
          : b.code === "unknown"
            ? -1
            : a.code.localeCompare(b.code, "hr")
      )
    : [];
  const active =
    filters.levels.length > 0 ||
    filters.purposes.length > 0 ||
    filters.built !== "all";
  const reset = () => onFilters(POCETNI_JAVNI_FILTRI);
  const toggleLevel = (level: PublicLevel) =>
    onFilters({
      ...filters,
      levels: filters.levels.includes(level)
        ? filters.levels.filter((candidate) => candidate !== level)
        : [...filters.levels, level],
    });
  const togglePurpose = (code: string) =>
    onFilters({
      ...filters,
      purposes: filters.purposes.includes(code)
        ? filters.purposes.filter((candidate) => candidate !== code)
        : [...filters.purposes, code],
    });

  return (
    <section aria-label="Filtri evidentiranih javnih čestica" className="mt-4">
      <div className="border-y border-zinc-200 py-3 text-zinc-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-status-u-tijeku-ground px-2 py-0.5 text-xs font-bold text-status-u-tijeku">
            Djelomična evidencija
          </span>
          <span className="text-xs text-zinc-600">GIS izvoz · 3. 10. 2025.</span>
        </div>
        <p className="mt-2 text-sm leading-normal">
          Prikazane su samo čestice izričito označene kao Grad/JLS, RH ili
          Županija. <b className="font-semibold">1.060 čestica bez statusa</b>{" "}
          nije klasificirano.
        </p>
      </div>

      {stanje === "greska" ? (
        <div className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
          <p>Sloj evidentiranih javnih čestica nije se učitao.</p>
          <button
            type="button"
            onClick={onRetry}
            className="fokus meta mt-1 min-h-11 font-semibold underline"
          >
            Pokušaj ponovno
          </button>
        </div>
      ) : !features || stanje === "ucitava" ? (
        <div className="mt-3 text-zinc-600" aria-busy="true">
          <p role="status" className="text-sm">
            Učitavam evidentirane javne čestice…
          </p>

          <fieldset disabled className="mt-3 opacity-60">
            <legend className="text-xs font-bold uppercase tracking-wide">
              Javna razina
            </legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {["Sve", ...Object.values(PUBLIC_LEVEL_LABELS)].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="meta-cip min-h-11 rounded-full border border-zinc-300 px-3 text-sm font-semibold"
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset disabled className="mt-4 opacity-60">
            <legend className="text-xs font-bold uppercase tracking-wide">
              Namjena prema GUP-u 2024. (nacrt)
            </legend>
            <p className="mt-2 min-h-11 text-sm">Učitavam dostupne namjene…</p>
          </fieldset>

          <fieldset disabled className="mt-4 opacity-60">
            <legend className="text-xs font-bold uppercase tracking-wide">
              Evidentirani tlocrt
            </legend>
            <div className="mt-1 grid grid-cols-3 rounded-lg bg-zinc-100 p-1">
              {["Sve", "Ima tlocrt", "Nema tlocrt"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="meta min-h-11 rounded-md px-2 text-xs font-semibold"
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <>
          <p role="status" aria-live="polite" className="mt-3 text-lg font-bold text-zinc-900">
            {summary.count.toLocaleString("hr-HR")} {brojnica(summary.count, "čestica", "čestice", "čestica")} ·{" "}
            {(summary.area_m2 / 10_000).toLocaleString("hr-HR", {
              maximumFractionDigits: 1,
            })}{" "}
            ha
          </p>

          <fieldset className="mt-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
              Javna razina
            </legend>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                type="button"
                aria-pressed={filters.levels.length === 0}
                onClick={() => onFilters({ ...filters, levels: [] })}
                className={`fokus meta-cip min-h-11 rounded-full border px-3 text-sm font-semibold ${
                  filters.levels.length === 0
                    ? "border-maslina bg-maslina text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Sve
              </button>
              {(Object.keys(PUBLIC_LEVEL_LABELS) as PublicLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={filters.levels.includes(level)}
                  onClick={() => toggleLevel(level)}
                  className={`fokus meta-cip min-h-11 rounded-full border px-3 text-sm font-semibold ${
                    filters.levels.includes(level)
                      ? "border-maslina bg-maslina text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {PUBLIC_LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
              Namjena prema GUP-u 2024. (nacrt)
            </legend>
            <div className="mt-1 space-y-0.5">
              {purposeOptions.map((option) => (
                <label
                  key={option.code}
                  className="meta flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 hover:bg-zinc-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina"
                >
                  <input
                    type="checkbox"
                    checked={filters.purposes.includes(option.code)}
                    onChange={() => togglePurpose(option.code)}
                    className="h-4 w-4 shrink-0 accent-maslina outline-none"
                  />
                  <span className="flex-1 leading-tight">
                    {option.code === "unknown" ? "" : `${option.code} — `}
                    {option.label}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-600">{option.count}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
              Evidentirani tlocrt
            </legend>
            <div className="mt-1 grid grid-cols-3 rounded-lg bg-zinc-100 p-1">
              {(
                [
                  ["all", "Sve"],
                  ["with_footprint", "Ima tlocrt"],
                  ["without_footprint", "Nema tlocrt"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters.built === value}
                  onClick={() => onFilters({ ...filters, built: value })}
                  className={`fokus meta min-h-11 rounded-md px-2 text-xs font-semibold ${
                    filters.built === value
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {summary.count === 0 && (
            <p className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-700">
              Nema evidentiranih javnih čestica za odabrane filtre.
            </p>
          )}

          {active && (
            <button
              type="button"
              onClick={reset}
              className="fokus meta mt-2 min-h-11 text-sm font-semibold text-maslina hover:underline"
            >
              Poništi filtre
            </button>
          )}

          <div className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-normal text-zinc-600">
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              {(Object.keys(PUBLIC_LEVEL_LABELS) as PublicLevel[]).map((level) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`h-2.5 w-4 rounded-sm ${
                      level === "state"
                        ? "bg-status-objavljeno"
                        : level === "county"
                          ? "bg-status-u-tijeku"
                          : "bg-maslina"
                    }`}
                  />
                  {PUBLIC_LEVEL_LABELS[level]}
                </span>
              ))}
            </p>
            <p className="mt-2">
              Crtkani obrub znači suvlasništvo. Informativni prikaz; provjeri
              službeni podatak na Uređenoj zemlji. Nacrt GUP-a 2024. nije plan
              na snazi.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function CiljanaProvjeraFilteri({
  features,
  filters,
  onFilters,
  stanje,
  onRetry,
}: {
  features: Feature<Geometry, TargetedOwnershipProperties>[] | null;
  filters: TargetedOwnershipFilters;
  onFilters: (filters: TargetedOwnershipFilters) => void;
  stanje?: "ucitava" | "greska";
  onRetry: () => void;
}) {
  const summary = features
    ? summarizeTargetedOwnership(features, filters)
    : { count: 0, mapped_area_m2: 0 };
  const statusCounts = features
    ? features.reduce(
        (counts, feature) => {
          counts[feature.properties.verification_status] += 1;
          return counts;
        },
        {
          confirmed_public: 0,
          mixed_public: 0,
          cadastre_public: 0,
          private_or_other: 0,
          unresolved: 0,
        } satisfies Record<OwnershipVerificationStatus, number>
      )
    : null;
  const categoryOptions = features
    ? [...
        features.reduce((options, feature) => {
          for (const entity of feature.properties.public_entities)
            options.set(entity.category, (options.get(entity.category) ?? 0) + 1);
          return options;
        }, new Map<PublicEntityCategory, number>()),
      ].sort((a, b) => a[0].localeCompare(b[0], "hr"))
    : [];
  const purposeOptions = features
    ? [...
        features.reduce((options, feature) => {
          const code = feature.properties.purpose_primary_code ?? "unknown";
          const current = options.get(code) ?? {
            code,
            label: feature.properties.purpose_primary_label ?? "Namjena nije određena",
            count: 0,
          };
          current.count += 1;
          options.set(code, current);
          return options;
        }, new Map<string, { code: string; label: string; count: number }>()),
      ]
        .map(([, option]) => option)
        .sort((a, b) =>
          a.code === "unknown"
            ? 1
            : b.code === "unknown"
              ? -1
              : a.code.localeCompare(b.code, "hr")
        )
    : [];
  const active =
    filters.statuses.length > 0 ||
    filters.entityCategories.length > 0 ||
    filters.cohorts.length > 0 ||
    filters.purposes.length > 0 ||
    filters.built !== "all";
  const toggle = <T extends string>(values: T[], value: T): T[] =>
    values.includes(value)
      ? values.filter((candidate) => candidate !== value)
      : [...values, value];

  return (
    <section
      aria-label="Filtri ciljane provjere vlasništva"
      className="mt-5 border-t border-zinc-200 pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-zinc-900">Ciljana provjera vlasništva</h3>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
          30 čestica
        </span>
      </div>
      <p className="mt-1 text-base leading-normal text-zinc-700">
        Sve čestice na odabranom koridoru ceste i sve čestice od najmanje
        10.000 m² provjerene su kroz javni OSS tok.
      </p>

      {stanje === "greska" ? (
        <div className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
          <p>Sloj ciljane provjere nije se učitao.</p>
          <button
            type="button"
            onClick={onRetry}
            className="fokus meta mt-1 min-h-11 font-semibold underline"
          >
            Pokušaj ponovno
          </button>
        </div>
      ) : !features || stanje === "ucitava" ? (
        <p role="status" aria-busy="true" className="mt-3 text-sm text-zinc-600">
          Učitavam 30 ciljanih čestica…
        </p>
      ) : (
        <>
          <p role="status" aria-live="polite" className="mt-3 text-lg font-bold text-zinc-900">
            {summary.count.toLocaleString("hr-HR")} {brojnica(summary.count, "čestica", "čestice", "čestica")} ·{" "}
            {(summary.mapped_area_m2 / 10_000).toLocaleString("hr-HR", {
              maximumFractionDigits: 1,
            })}{" "}
            ha u obuhvatu
          </p>

          <fieldset className="mt-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
              Status provjere
            </legend>
            <div className="mt-1 space-y-0.5">
              {(Object.keys(OWNERSHIP_STATUS_LABELS) as OwnershipVerificationStatus[]).map(
                (status) => (
                  <label
                    key={status}
                    className="meta flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 hover:bg-zinc-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina"
                  >
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(status)}
                      onChange={() =>
                        onFilters({ ...filters, statuses: toggle(filters.statuses, status) })
                      }
                      className="h-4 w-4 shrink-0 accent-maslina outline-none"
                    />
                    <span className="flex-1 leading-tight">{OWNERSHIP_STATUS_LABELS[status]}</span>
                    <span className="text-xs tabular-nums text-zinc-600">
                      {statusCounts?.[status] ?? 0}
                    </span>
                  </label>
                )
              )}
            </div>
          </fieldset>

          <details className="mt-3 border-t border-zinc-200 pt-3">
            <summary className="fokus meta min-h-11 cursor-pointer rounded text-sm font-semibold text-maslina">
              Vlasnik, skup, namjena i tlocrt
            </summary>

            <fieldset className="mt-2">
              <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                Prepoznati javni subjekt
              </legend>
              <div className="mt-1 space-y-0.5">
                {categoryOptions.map(([category, count]) => (
                  <label
                    key={category}
                    className="meta flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 hover:bg-zinc-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina"
                  >
                    <input
                      type="checkbox"
                      checked={filters.entityCategories.includes(category)}
                      onChange={() =>
                        onFilters({
                          ...filters,
                          entityCategories: toggle(filters.entityCategories, category),
                        })
                      }
                      className="h-4 w-4 shrink-0 accent-maslina outline-none"
                    />
                    <span className="flex-1 leading-tight">
                      {PUBLIC_ENTITY_CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs tabular-nums text-zinc-600">{count}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                Zašto je provjerena
              </legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {(Object.keys(OWNERSHIP_COHORT_LABELS) as OwnershipCohort[]).map((cohort) => (
                  <button
                    key={cohort}
                    type="button"
                    aria-pressed={filters.cohorts.includes(cohort)}
                    onClick={() =>
                      onFilters({ ...filters, cohorts: toggle(filters.cohorts, cohort) })
                    }
                    className={`fokus meta-cip min-h-11 rounded-full border px-3 text-sm font-semibold ${
                      filters.cohorts.includes(cohort)
                        ? "border-maslina bg-maslina text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {OWNERSHIP_COHORT_LABELS[cohort]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                Namjena prema GUP-u 2024. (nacrt)
              </legend>
              <div className="mt-1 space-y-0.5">
                {purposeOptions.map((option) => (
                  <label
                    key={option.code}
                    className="meta flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 hover:bg-zinc-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina"
                  >
                    <input
                      type="checkbox"
                      checked={filters.purposes.includes(option.code)}
                      onChange={() =>
                        onFilters({
                          ...filters,
                          purposes: toggle(filters.purposes, option.code),
                        })
                      }
                      className="h-4 w-4 shrink-0 accent-maslina outline-none"
                    />
                    <span className="flex-1 leading-tight">
                      {option.code === "unknown" ? "" : `${option.code} — `}
                      {option.label}
                    </span>
                    <span className="text-xs tabular-nums text-zinc-600">{option.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                Evidentirani tlocrt
              </legend>
              <div className="mt-1 grid grid-cols-3 rounded-lg bg-zinc-100 p-1">
                {(
                  [
                    ["all", "Sve"],
                    ["with_footprint", "Ima tlocrt"],
                    ["without_footprint", "Nema tlocrt"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filters.built === value}
                    onClick={() => onFilters({ ...filters, built: value })}
                    className={`fokus meta min-h-11 rounded-md px-2 text-xs font-semibold ${
                      filters.built === value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </details>

          {summary.count === 0 && (
            <p className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-700">
              Nema ciljanih čestica za odabrane filtre.
            </p>
          )}
          {active && (
            <button
              type="button"
              onClick={() => onFilters(POCETNI_CILJANI_FILTRI)}
              className="fokus meta mt-2 min-h-11 text-sm font-semibold text-maslina hover:underline"
            >
              Poništi filtre ciljane provjere
            </button>
          )}

          <p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-normal text-zinc-600">
            Provjereno 2. 8. 2026. ZK list B ima prednost; katastarski posjednik
            je označen kao slabiji dokaz. Privatna imena nisu objavljena. Ovo je
            ciljana provjera 30 čestica, ne cjelovit popis javne imovine.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Opis pogleda, skraćen ako je dug.
 *
 * Opisi su namjerno različite dužine: neki pogled je razumljiv iz naslova,
 * a „Gdje se može graditi stan” mora izložiti sve pragove po kojima broji,
 * jer bi inače tvrdio nešto neprovjerljivo. Nesažet, taj opis gura popis
 * slojeva pet okretaja kotačića ispod ruba — pa se dugi kroji na četiri
 * retka, a cijeli ostaje na jedan klik.
 *
 * Prag je na broju znakova, ne na izmjerenoj visini: mjerenje bi tražilo
 * ResizeObserver i još jedno iscrtavanje, a jedino što odluka treba jest
 * „staje li otprilike u četiri retka”.
 */
const DUG_OPIS = 240;

function Opis({ view }: { view: MapView }) {
  // Stanje pamti ID pogleda, ne zastavicu: promjena pogleda tako sama vraća
  // opis na skraćeno, bez efekta koji to čisti.
  const [otvoren, setOtvoren] = useState<string | null>(null);
  const dug = view.description.length > DUG_OPIS;
  const razvijen = otvoren === view.id;
  return (
    <div className="mt-2">
      {/* Opis je proza, a proza je 1rem — Reading-Size Rule iz DESIGN.md.
          Ostatak trake smije biti gušći; ovo je jedino što se ČITA. */}
      <p
        className={`text-base leading-normal text-zinc-600 ${
          dug && !razvijen ? "line-clamp-4" : ""
        }`}
      >
        {view.description}
      </p>
      {dug && (
        <button
          onClick={() => setOtvoren(razvijen ? null : view.id)}
          className="fokus meta mt-0.5 py-1 text-sm font-semibold text-maslina hover:underline"
        >
          {razvijen ? "manje ▴" : "cijeli opis ▾"}
        </button>
      )}
    </div>
  );
}

/**
 * Jedan sloj u bočnoj traci — isti redak i u skupini pogleda i u izvornoj.
 *
 * Cijeli redak je meta, ne kvadratić od 13px: `meta` mu na dodirnim
 * uređajima daje 44px visine, a na mišu ostaje gust, pa 114 slojeva ne
 * naraste u pet metara popisa.
 *
 * Kvadratić boje ima obrub. Bez njega su svijetli slojevi bili nevidljivi —
 * „Pješački prijelazi” je bijelo na bijelom.
 */
function Kvacica({
  sloj,
  upaljen,
  stanje,
  onToggle,
}: {
  sloj: OverlayLayer;
  upaljen: boolean;
  stanje?: "ucitava" | "greska";
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className={`meta flex cursor-pointer items-center gap-2 rounded px-1 hover:bg-zinc-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maslina ${
        sloj.phase === 2 ? "cursor-not-allowed" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={upaljen}
        disabled={sloj.phase === 2}
        onChange={() => onToggle(sloj.id)}
        className="h-4 w-4 shrink-0 accent-maslina outline-none"
      />
      <span
        className="h-3 w-3 shrink-0 rounded-sm border border-black/20"
        style={{ background: sloj.color }}
      />
      <span className={`leading-tight ${sloj.phase === 2 ? "text-zinc-500" : ""}`}>
        {sloj.label}
        {sloj.phase === 2 && (
          <span className="ml-1 text-zinc-500">(još nema podataka)</span>
        )}
        {stanje === "ucitava" && (
          <span className="ml-1.5 text-zinc-500">učitavam…</span>
        )}
        {stanje === "greska" && (
          <span className="ml-1.5 font-medium text-odbijeno">
            nije se učitao{" "}
            <button
              type="button"
              onClick={(e) => {
                // Ponovni pokušaj je gašenje pa paljenje: sloj se briše iz
                // registra i sljedeći prolaz ga dohvaća iznova.
                e.preventDefault();
                e.stopPropagation();
                onToggle(sloj.id);
                setTimeout(() => onToggle(sloj.id), 0);
              }}
              className="fokus underline hover:text-odbijeno-tamna"
            >
              pokušaj ponovno
            </button>
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * Desna ploča: sve što se bira jednim odabirom, a ne kvačicom.
 *
 * Podloga (ortofoto ili ulična karta) i namjena iz GUP-a različite su
 * stvari, ali ista vrsta odluke — ono što je ISPOD svega ostalog, i čega
 * može biti samo jedno. Zato stoje zajedno i odvojeno od popisa slojeva:
 * kvačica se pita „hoću li i ovo vidjeti”, a ovdje „na čemu gledam”.
 *
 * Biralo je izvan pogleda, pa je dostupno u svakom — pogled mu zadaje samo
 * početnu vrijednost. Prije je stajalo u bočnoj traci i vidjelo se jedino u
 * pogledima koji ga izrijekom izlažu, pa se namjena nije mogla podmetnuti
 * pod, recimo, katastar.
 */
function Kontrole(props: {
  baseId: string;
  onBase: (id: string) => void;
  vremeplov: Vremeplov | null;
  onVremeplov: (par: Vremeplov | null) => void;
  dimValue: Record<string, string>;
  onDimValue: (dimId: string, layerId: string) => void;
  comparisonId: string | null;
  klizac: boolean;
  open: boolean;
  onOpen: (v: boolean) => void;
  usko: boolean;
}) {
  const { usko } = props;
  if (!props.open) {
    return (
      <button
        onClick={() => props.onOpen(true)}
        className={
          usko
            ? "fokus meta absolute right-3 top-28 z-[1100] rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold shadow"
            : "fokus absolute right-3 top-[5.5rem] z-[1100] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold shadow hover:bg-zinc-50"
        }
      >
        Podloga <span aria-hidden>☰</span>
      </button>
    );
  }

  return (
    <div
      className={
        usko
          ? "absolute inset-x-0 bottom-0 z-[1120] flex max-h-[72%] flex-col overflow-hidden rounded-t-xl border-t border-zinc-200 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
          : "absolute right-3 top-[5.5rem] z-[1100] flex max-h-[calc(100%-7rem)] w-56 max-w-[70vw] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow"
      }
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <span className="text-sm font-bold">Podloga i plan</span>
        <button
          onClick={() => props.onOpen(false)}
          aria-label="Sakrij izbor podloge"
          className="fokus meta rounded px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          {usko ? "zatvori ⌄" : "sakrij ⟩"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 text-xs">
        {/* Podloge po skupinama: „Danas”, „Nekad”, „Reljef”. Šest čipova u
            jednom nizu je popis u kojem snimka iz 2011. stoji uz sjenčani
            reljef kao da su ista vrsta izbora — a jedno je „kad”, drugo
            „što”. Vidi BASE_SKUPINE. */}
        {BASE_SKUPINE.map((skupina) => {
          const uSkupini = BASE_LAYERS.filter((b) => b.skupina === skupina.id);
          if (!uSkupini.length) return null;
          return (
            <div key={skupina.id} className="mb-2">
              <p className="mb-1 font-semibold text-zinc-600">{skupina.naslov}</p>
              <div className="flex flex-wrap gap-1">
                {uSkupini.map((b) => (
                  <Cip
                    key={b.id}
                    odabran={!props.vremeplov && b.id === props.baseId}
                    onClick={() => {
                      // Odabir podloge gasi vremeplov: tražena je JEDNA
                      // podloga, a rez bi je pokazao samo na pola karte.
                      props.onVremeplov(null);
                      props.onBase(b.id);
                    }}
                  >
                    {b.label}
                  </Cip>
                ))}
              </div>
              {/* Opis samo za odabranu: šest rečenica odjednom je zid teksta
                  u ploči širokoj 14 rem, a tražena je jedna. */}
              {uSkupini.find((b) => b.id === props.baseId && !props.vremeplov)
                ?.opis && (
                <p className="mt-1 leading-snug text-zinc-500">
                  {uSkupini.find((b) => b.id === props.baseId)?.opis}
                </p>
              )}
            </div>
          );
        })}

        <VremeplovBiralo
          vremeplov={props.vremeplov}
          onVremeplov={props.onVremeplov}
        />

        {DIMENSIONS.map((d) => {
          const usporedbe = COMPARISONS.filter((c) => c.dimensionId === d.id);
          const klizacOve =
            props.klizac &&
            usporedbe.some((c) => c.id === props.comparisonId);
          const vrijednost = props.dimValue[d.id] ?? "";
          return (
            <div key={d.id} className="mt-3 border-t border-zinc-200 pt-2">
              <p className="mb-1 font-semibold text-zinc-600">
                {klizacOve ? "Klizač uspoređuje" : d.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {/* Klizač uspoređuje dvije godine, pa ondje ugasiti podlogu
                    nema smisla — nema što uspoređivati. */}
                {!klizacOve && (
                  <Cip
                    odabran={!vrijednost}
                    tamni
                    onClick={() => props.onDimValue(d.id, "")}
                  >
                    bez podloge
                  </Cip>
                )}
                {d.values.map((v) => (
                  <Cip
                    key={v.layerId}
                    odabran={vrijednost === v.layerId}
                    onClick={() => props.onDimValue(d.id, v.layerId)}
                  >
                    {v.label}
                  </Cip>
                ))}
              </div>

              {/* Usporedba i način prikaza više NISU ovdje.
                  Ploča se zove „Podloga i plan” i drži ono što je ispod
                  svega; usporedba je pitanje, korisna u jednom pogledu, pa
                  stoji u njemu — vidi Usporedba u bočnoj traci. */}

              {/* Legenda pripada podlozi, pa s ugašenom podlogom nema što
                  tumačiti — inače objašnjava boje kojih na karti nema. */}
              {(vrijednost || klizacOve) && (
                <div className="mt-2">
                  {d.legend.map((e) => (
                    <div key={e.kod} className="flex items-center gap-2 py-0.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                        style={{ background: e.boja }}
                      />
                      <span className="text-zinc-700">
                        <span className="font-semibold">{e.kod}</span> — {e.opis}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {usporedbe.some((c) => c.id === props.comparisonId) && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-0 w-3 shrink-0 border-t-2 border-dashed border-red-600" />
                  <span className="text-zinc-700">Mijenja se</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Izvor podloge stoji uz izbor podloge. Na uskom zaslonu ova ploha
            zna pokriti Leafletovu atribuciju, a navođenje je uvjet dozvole,
            pa mora postojati i ovdje.

            S upaljenim vremeplovom se vide DVIJE podloge, pa se navode obje:
            navesti samo jednu značilo bi koristiti tuđi podatak bez navođenja,
            a to je uvjet dozvole, ne kozmetika. */}
        <p className="mt-3 border-t border-zinc-200 pt-2 text-[11px] leading-snug text-zinc-500">
          {props.vremeplov
            ? [props.vremeplov.lijevo, props.vremeplov.desno]
                .map((id) => podlogaPoId(id).attribution)
                .join(" · ")
            : podlogaPoId(props.baseId).attribution}
        </p>
      </div>
    </div>
  );
}

/**
 * Vremeplov: rez između dviju snimaka, s biralom za svaku stranu.
 *
 * Stoji u ploči „Podloga i plan”, a ne u bočnoj traci uz usporedbu namjene,
 * i to nije nedosljednost. Usporedba namjene uspoređuje dva SLOJA i korisna
 * je u jednom pogledu, pa stoji u njemu. Vremeplov uspoređuje dvije PODLOGE —
 * dakle upravo ono što ova ploča i drži, ono što je ispod svega — i vrijedi u
 * svakom pogledu.
 *
 * Ne prikazuje se ako u registru nema barem dvije snimke s godinom: biralo
 * koje se ne može upotrijebiti gore je od izostanka.
 */
function VremeplovBiralo(props: {
  vremeplov: Vremeplov | null;
  onVremeplov: (par: Vremeplov | null) => void;
}) {
  const dostupne = snimke(BASE_LAYERS);
  if (!vremeplovMoguc(BASE_LAYERS)) return null;
  const par = props.vremeplov;

  return (
    <div className="mt-3 border-t border-zinc-200 pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-zinc-600">Vremeplov</p>
        <Cip
          odabran={par !== null}
          onClick={() =>
            props.onVremeplov(par ? null : zadaniVremeplov(BASE_LAYERS))
          }
        >
          {par ? "ugasi" : "usporedi"}
        </Cip>
      </div>

      {!par ? (
        <p className="mt-1 leading-snug text-zinc-500">
          Povuci razdjelnik i vidi isto mjesto u dvije godine.
        </p>
      ) : (
        <>
          {(["lijevo", "desno"] as const).map((strana) => (
            <div key={strana} className="mt-2">
              <p className="mb-1 text-zinc-500">
                {strana === "lijevo" ? "Lijevo od reza" : "Desno od reza"}
              </p>
              <div className="flex flex-wrap gap-1">
                {dostupne.map((b) => (
                  <Cip
                    key={b.id}
                    odabran={par[strana] === b.id}
                    onClick={() =>
                      props.onVremeplov(postaviStranu(par, strana, b.id))
                    }
                  >
                    {b.godina ?? b.label}
                  </Cip>
                ))}
              </div>
            </div>
          ))}
          {/* Rečenica postoji jer je razdjelnik jedina stvar na karti koju
              treba POVUĆI, a nigdje drugdje to ne piše. Tipkovnica se spominje
              jer drška prima fokus i strelice, pa to nije skriveni put. */}
          <p className="mt-2 leading-snug text-zinc-500">
            Razdjelnik se povlači mišem, prstom ili strelicama.
          </p>
        </>
      )}
    </div>
  );
}

/** Čip jednostrukog izbora. `tamni` je „ništa”, `crveni` je promjena. */
function Cip({
  odabran,
  tamni,
  crveni,
  onClick,
  children,
}: {
  odabran: boolean;
  tamni?: boolean;
  crveni?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  // Bijelo na maslini živoj daje 3,65 : 1 — ispod praga. Filled stanje zato
  // stoji na maslini (5,43 : 1). Vidi The Contrast Floor Rule.
  const izabrano = crveni
    ? "bg-odbijeno text-white"
    : tamni
      ? "bg-zinc-800 text-white"
      : "bg-maslina text-white";
  return (
    <button
      onClick={onClick}
      aria-pressed={odabran}
      className={`fokus meta-cip rounded px-2 py-1 font-medium ${
        odabran ? izabrano : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function phase1(ids: string[]): string[] {
  return ids.filter((id) => OVERLAY_BY_ID.get(id)?.phase === 1);
}

/** Podloga po id-u; nepoznat id pada na prvu, kao i dosad. */
function podlogaPoId(id: string): BaseLayer {
  return BASE_LAYERS.find((b) => b.id === id) ?? BASE_LAYERS[0];
}

/**
 * Koliko je velika jedna pločica podloge koju poslužujemo sami.
 *
 * Mjereno 14. 8. 2026. na jednom oknu pri z16: podloga je izravno s
 * geoportala tražila 28 pločica od 256 px, uz medijan dohvata 4,2 s
 * (p90 6,2 s). Sam poslužitelj pritom NIJE spor — pojedinačna pločica stigne
 * za 0,4 s. Sporo je bilo čekanje u redu: preglednik prema jednom
 * poslužitelju drži otprilike šest usporednih veza, pa 28 zahtjeva čeka
 * jedan drugoga, a geoportal se pod usporednim opterećenjem još i uspori.
 *
 * Pločica od 512 px pokriva istu površinu kao četiri od 256 i traži jednako
 * mnogo metara po pikselu — ista razlučivost, četvrtina zahtjeva. Mjereno:
 * jedna od 512 px = 0,86–1,3 s, četiri od 256 px = 3,85 s.
 *
 * Vrijedi samo za podloge koje idu kroz našu rutu: sjenčani reljef i
 * CARTO-va ulična karta izrađeni su kao 256 px i to nije stvar dogovora.
 * Mora se poklapati s PLOCICA_PX u src/lib/plocice.ts.
 */
const WMS_PLOCICA = 512;

/**
 * Leafletov sloj za jednu podlogu.
 *
 * `maxNativeZoom` je razlika između „nema pločice” i „pločica je razvučena”:
 * sjenčani reljef ima vlastite pločice do z17, jer je ondje 0,87 m po pikselu
 * ≈ izvorna gustoća DMR-a. Bez ove postavke Leaflet na z18 traži pločice koje
 * nikad nisu izrađene i podloga na najkrupnijem mjerilu nestane.
 *
 * `bounds` je okvir do kojeg karta uopće pušta pomicanje. Bez njega Leaflet
 * na sitnom mjerilu traži i pločice izvan kvarta — nikad cijelu Hrvatsku,
 * jer se traži samo ono što je u oknu, ali na z12 okno seže znatno dalje
 * od onoga o čemu je ova karta.
 */
function podlogaSloj(
  L: typeof LeafletNS,
  base: BaseLayer,
  okno?: string,
): LeafletNS.TileLayer {
  const zajednicko = {
    attribution: base.attribution,
    maxZoom: 19,
    bounds: MAP_MAX_BOUNDS,
    ...(base.maxNativeZoom ? { maxNativeZoom: base.maxNativeZoom } : {}),
    ...(okno ? { pane: okno } : {}),
  };
  if (base.type === "wms") {
    // WMS podloge NE idu izravno na geoportal nego kroz našu rutu, koja ih
    // pamti na rubu mreže (vidi src/app/api/podloga i src/lib/plocice.ts).
    // Registar i dalje opisuje izvorni servis — njega čita ruta; klijent zna
    // samo za nas.
    //
    // `zoomOffset: -1` uz pločicu od 512 px: Leaflet tada traži pločicu
    // standardne mreže za zum manji za jedan, a crta je na dvostrukoj
    // stranici. Ista razlučivost, četvrtina zahtjeva — i u adresi ostaje
    // obična (z, x, y), pa je pločica jedan zapis u predmemoriji.
    return L.tileLayer(`/api/podloga/${base.id}/{z}/{x}/{y}`, {
      ...zajednicko,
      tileSize: WMS_PLOCICA,
      zoomOffset: -1,
    });
  }
  return L.tileLayer(base.url, { ...zajednicko, subdomains: "abcd" });
}

/**
 * Obris ulice po razredu iz OSM-a.
 *
 * Ceste su linije, ne plohe, pa ih ispuna ne opisuje — nosi ih debljina.
 * Hijerarhija je namjerno gruba: magistrala, ulica, servisni put, makadam.
 * Boje su svijetle jer je podloga ortofoto.
 */
/**
 * Razredi veličine grane za sloj izvedenih tokova (`rang` iz
 * scripts/izvedi-tokove.py: 1 = <5 ha uzvodnog sliva, 2 = 5–20, 3 = 20–100,
 * 4 = ≥100). Debljina i boja nose isti podatak namjerno — udvojeno
 * kodiranje čita se i na maloj karti i pri slabijem razlikovanju boja.
 */
const TOK_PO_RANGU: Record<number, { boja: string; debljina: number; prozirnost: number }> = {
  1: { boja: "#7dd3fc", debljina: 1, prozirnost: 0.7 },
  2: { boja: "#38bdf8", debljina: 2, prozirnost: 0.85 },
  3: { boja: "#0284c7", debljina: 3.25, prozirnost: 0.95 },
  4: { boja: "#075985", debljina: 5, prozirnost: 1 },
};

const STIL_ULICE: Record<string, { boja: string; debljina: number; crtkano?: string }> = {
  motorway: { boja: "#38bdf8", debljina: 4 },
  trunk: { boja: "#38bdf8", debljina: 4 },
  primary: { boja: "#38bdf8", debljina: 3.5 },
  secondary: { boja: "#7dd3fc", debljina: 3 },
  tertiary: { boja: "#7dd3fc", debljina: 2.5 },
  residential: { boja: "#e2e8f0", debljina: 2 },
  living_street: { boja: "#e2e8f0", debljina: 2 },
  unclassified: { boja: "#e2e8f0", debljina: 2 },
  road: { boja: "#e2e8f0", debljina: 2 },
  service: { boja: "#cbd5e1", debljina: 1.2 },
  track: { boja: "#a8a29e", debljina: 1.2, crtkano: "4 3" },
};

/** "trunk_link" se crta kao "trunk" — spojnica je istog razreda kao cesta. */
function stilUlice(razred: string | undefined) {
  if (!razred) return null;
  return STIL_ULICE[razred] ?? STIL_ULICE[razred.replace(/_link$/, "")] ?? null;
}

/**
 * Prometni sloj je jedan, a vrste se razlikuju crtom.
 *
 * Postojeće je puna linija, planirano crtkana — to je jedina razlika koja
 * korisnika zanima prije nego što klikne. Ulice uz to nose i debljinu po
 * razredu (vidi STIL_ULICE), pa im ovdje stoji samo zamjenska vrijednost.
 */
const STIL_VRSTE: Record<string, { boja: string; debljina: number; crtkano?: string }> = {
  ulica: { boja: "#e2e8f0", debljina: 2 },
  pjesacka: { boja: "#14b8a6", debljina: 1.5, crtkano: "2 3" },
  drzavna: { boja: "#f59e0b", debljina: 3 },
  "koridor-nacrt": { boja: "#f472b6", debljina: 1.2, crtkano: "5 4" },
  "koridor-vazeci": { boja: "#c084fc", debljina: 1.2, crtkano: "5 4" },
  "dpu-povrsina": { boja: "#fb7185", debljina: 1, crtkano: "3 3" },
};

const IME_RAZREDA: Record<string, string> = {
  motorway: "autocesta",
  trunk: "brza cesta",
  primary: "glavna cesta",
  secondary: "županijska cesta",
  tertiary: "lokalna cesta",
  residential: "stambena ulica",
  living_street: "ulica smirenog prometa",
  unclassified: "nerazvrstana cesta",
  road: "cesta",
  service: "servisni put",
  track: "makadam / poljski put",
};

/** Sloj na karti, uz okno u kojem je stvoren — vidi overlayInstances. */
interface Postavljeni {
  sloj: LeafletNS.Layer;
  okno: string | undefined;
  /** Samo izvedeni javni sloj: promjena filtra traži novu Leaflet grupu. */
  filterKey?: string;
}

/**
 * Dohvat sloja uz spremnik ograničene veličine (LRU).
 *
 * `Map` u JS-u pamti redoslijed umetanja, pa je najstariji ključ uvijek prvi —
 * a ponovno umetanje već postojećeg ključa ga premješta na kraj. To je cijeli
 * LRU, bez knjižnice: pri pogotku se stavka izbaci pa vrati natrag.
 */
async function ucitajGeoJSON(
  url: string,
  spremnik: Map<string, GeoJSON.FeatureCollection>
): Promise<GeoJSON.FeatureCollection> {
  const spremljeno = spremnik.get(url);
  if (spremljeno) {
    spremnik.delete(url);
    spremnik.set(url, spremljeno);
    return spremljeno;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const fc = (await res.json()) as GeoJSON.FeatureCollection;
  spremnik.set(url, fc);
  while (spremnik.size > SPREMNIK_MAX) {
    const najstariji = spremnik.keys().next();
    if (najstariji.done) break;
    spremnik.delete(najstariji.value);
  }
  return fc;
}

/**
 * Stvara sloj na karti i upisuje ga u registar postavljenih.
 *
 * Živi izvan komponente jer je čista funkcija nad proslijeđenim stanjem —
 * unutar nje eslint je s pravom prigovarao da je efekt zove prije nego što
 * je deklarirana, a i dependency lista bi je morala nositi.
 */
function dodajSloj(
  L: typeof LeafletNS,
  map: LeafletNS.Map,
  layer: OverlayLayer,
  okno: string | undefined,
  registar: Map<string, Postavljeni>,
  spremnik: Map<string, GeoJSON.FeatureCollection>,
  otvoriDosje: (
    lat: number,
    lng: number,
    oznaci?: Isticanje,
    parcelId?: string,
  ) => void,
  pogodakSloja: { current: number },
  stanje: (id: string, s: "ucitava" | "greska" | null) => void,
  javniFiltri?: PublicParcelFilters,
  ciljaniFiltri?: TargetedOwnershipFilters,
  filtriPlaniranihCesta?: PlannedRoadParcelFilters,
  filterKey?: string,
) {
  if (layer.type === "wms") {
    const wms = L.tileLayer.wms(layer.url, {
      layers: layer.wmsLayers,
      format: "image/png",
      transparent: true,
      opacity: layer.defaultOpacity ?? 0.7,
      crs: layer.wmsCrs === "EPSG:4326" ? L.CRS.EPSG4326 : undefined,
      attribution: layer.attribution,
    });
    wms.addTo(map);
    registar.set(layer.id, { sloj: wms, okno });
    return;
  }
  if (layer.type === "xyz") {
    // Rasterske pločice iz public/geo/ — zasad samo sjenčani reljef.
    // `maxNativeZoom` mora ovamo iz istog razloga kao kod podloge: bez njega
    // Leaflet na z18 traži pločice koje nikad nisu izrađene i sloj nestane
    // baš na mjerilu na kojem se gleda pojedina čestica.
    const plocice = L.tileLayer(layer.url, {
      opacity: layer.defaultOpacity ?? 0.7,
      attribution: layer.attribution,
      maxZoom: 19,
      ...(layer.maxNativeZoom ? { maxNativeZoom: layer.maxNativeZoom } : {}),
      ...(okno ? { pane: okno } : {}),
    });
    plocice.addTo(map);
    registar.set(layer.id, { sloj: plocice, okno });
    return;
  }
  // geojson — dohvat na zahtjev. Atribucija ide na samu grupu: registar je
  // nosi za svaki sloj, a bez ovoga Leaflet ju je ispisivao samo za WMS,
  // pa su OSM, Hrvatske ceste i gradski planovi ostajali nenavedeni.
  const grupa = L.layerGroup([], { attribution: layer.attribution }).addTo(map);
  if (okno) {
    // Klizač reže `layer.getContainer()`. Grupa ga nema, ali njezino okno
    // sadrži točno taj sloj, pa je to ispravan spremnik.
    (grupa as unknown as { getContainer: () => HTMLElement }).getContainer =
      () => map.getPane(okno) as HTMLElement;
  }
  registar.set(layer.id, { sloj: grupa, okno, filterKey });
  stanje(layer.id, "ucitava");
  ucitajGeoJSON(layer.url, spremnik)
    .then((fc) => {
      // Provjerava se identitet, ne samo prisutnost: sloj je u međuvremenu
      // mogao biti ugašen pa ponovno stvoren u drugom oknu.
      if (registar.get(layer.id)?.sloj !== grupa) return;
      stanje(layer.id, null);
      const gj = L.geoJSON(fc, {
        ...(okno ? { pane: okno } : {}),
        ...(layer.id === "javne-cestice" && javniFiltri
          ? {
              filter: (feature: GeoJSON.Feature) => {
                try {
                  validatePublicParcelProperties(feature.properties);
                  return matchesPublicParcel(feature.properties, javniFiltri);
                } catch {
                  return false;
                }
              },
            }
          : {}),
        ...(layer.id === "ciljana-provjera-vlasnistva" && ciljaniFiltri
          ? {
              filter: (feature: GeoJSON.Feature) => {
                try {
                  validateTargetedOwnershipProperties(feature.properties);
                  return matchesTargetedOwnership(feature.properties, ciljaniFiltri);
                } catch {
                  return false;
                }
              },
            }
          : {}),
        ...(layer.id === "cestice-planiranih-cesta" && filtriPlaniranihCesta
          ? {
              filter: (feature: GeoJSON.Feature) => {
                try {
                  validatePlannedRoadParcelProperties(feature.properties);
                  return matchesPlannedRoadParcel(
                    feature.properties,
                    filtriPlaniranihCesta
                  );
                } catch {
                  return false;
                }
              },
            }
          : {}),
        ...(NEINTERAKTIVNE_PLOHE.has(layer.id) ? { interactive: false } : {}),
        // Slojevi namjene nose boju po plohi, onu iz tumača znakova plana.
        // Bez toga bi cijela karta namjene bila jednobojna i beskorisna.
        style: (f) => {
          const p = f?.properties as
            | ({ boja?: string; promjena?: string; highway?: string } &
                Partial<PublicParcelProperties> &
                Partial<TargetedOwnershipProperties> &
                Partial<PlannedRoadParcelProperties>)
            | undefined;
          if (layer.id === "javne-cestice") {
            const c =
              p?.public_level === "state"
                ? "#005986"
                : p?.public_level === "county"
                  ? "#953d00"
                  : "#007956";
            return {
              color: c,
              weight: 2.5,
              dashArray: p?.ownership_form === "coownership" ? "7 5" : undefined,
              fillColor: c,
              fillOpacity: 0.48,
            };
          }
          if (layer.id === "ciljana-provjera-vlasnistva") {
            const status = p?.verification_status;
            const c =
              status === "confirmed_public"
                ? "#007956"
                : status === "cadastre_public"
                  ? "#005986"
                  : status === "mixed_public"
                    ? "#5d0ec0"
                    : status === "private_or_other"
                      ? "#71717b"
                      : "#953d00";
            return {
              color: c,
              weight: status === "confirmed_public" ? 3 : 2.25,
              dashArray:
                status === "mixed_public"
                  ? "8 5"
                  : status === "cadastre_public"
                    ? "6 4"
                    : status === "unresolved"
                      ? "2 5"
                      : undefined,
              fillColor: c,
              fillOpacity:
                status === "confirmed_public"
                  ? 0.58
                  : status === "cadastre_public"
                    ? 0.38
                    : status === "mixed_public"
                      ? 0.34
                      : 0.12,
            };
          }
          if (layer.id === "tokovi") {
            // Jedina razlika među crtama je veličina grane — i debljina i
            // boja nose isti podatak (uzvodni sliv), pa se čitaju zajedno:
            // žilica od hektara je tanka i blijeda, deblo od dvjesto hektara
            // debelo i tamno. Granica kvarta se u stilu NE vidi: ista bujica
            // teče dalje i kad je prijeđe.
            const rang = (p as { rang?: number } | undefined)?.rang ?? 1;
            const stil = TOK_PO_RANGU[rang] ?? TOK_PO_RANGU[1];
            return {
              color: stil.boja,
              weight: stil.debljina,
              opacity: stil.prozirnost,
              lineCap: "round" as const,
              lineJoin: "round" as const,
              fill: false,
            };
          }
          if (layer.id === "izohipse") {
            // Izohipsa se crta TANKO i prigušeno: ona je mjerilo, ne nalaz.
            // Nacrtana kao ostali slojevi, tisuću sedamsto crta preglasa sve
            // preko čega leže — a leže preko svega, jer teren je posvuda.
            //
            // Svaka deseta je deblja i tamnija, i to je jedini način da se u
            // nizu jednakih crta zna koja je koja: visina se broji od najbliže
            // označene. Na ortofotu je smeđe-oker, jer bijelo nestane u
            // izgorjelom kršu, a crno u sjeni krošanja.
            const glavna = (p as { glavna?: boolean } | undefined)?.glavna === true;
            return {
              color: "#a16207",
              weight: glavna ? 1.4 : 0.7,
              opacity: glavna ? 0.85 : 0.5,
              lineCap: "round" as const,
              lineJoin: "round" as const,
              fill: false,
            };
          }
          if (layer.id === "vodotoci-hok") {
            return {
              color: "#0f766e",
              weight: 2,
              opacity: 0.9,
              dashArray: "6 4",
              lineCap: "round" as const,
              lineJoin: "round" as const,
              fill: false,
            };
          }
          if (layer.id === "gup-2024-planirane-ceste") {
            return {
              color: "#3f3f46",
              weight: 2.5,
              dashArray: "12 8",
              fillColor: "#f4f4f5",
              fillOpacity: 0.38,
            };
          }
          if (layer.id === "cestice-planiranih-cesta") {
            const status = p?.ownership_status;
            const conflict = p?.has_evidence_conflict === true;
            const styleByStatus: Record<
              PlannedRoadOwnershipStatus,
              LeafletNS.PathOptions
            > = {
              confirmed_public: {
                color: "#005f46",
                weight: 3,
                fillColor: "#005f46",
                fillOpacity: 0.58,
              },
              mixed_public: {
                color: "#5d0ec0",
                weight: 2.5,
                dashArray: "8 5",
                fillColor: "#5d0ec0",
                fillOpacity: 0.34,
              },
              cadastre_public: {
                color: "#005986",
                weight: 2.5,
                dashArray: "6 4",
                fillColor: "#005986",
                fillOpacity: 0.38,
              },
              city_gis_public: {
                color: "#007956",
                weight: 2.5,
                dashArray: "10 5",
                fillColor: "#007956",
                fillOpacity: 0.3,
              },
              not_confirmed_public: {
                color: "#71717b",
                weight: 2,
                fillColor: "#71717b",
                fillOpacity: 0.18,
              },
              unresolved: {
                color: "#953d00",
                weight: 2.5,
                dashArray: "2 5",
                fillColor: "#fef3c6",
                fillOpacity: 0.32,
              },
              no_data: {
                color: "#9f9fa9",
                weight: 1,
                fillColor: "#f4f4f5",
                fillOpacity: 0.55,
              },
            };
            const primary = status ? styleByStatus[status] : styleByStatus.no_data;
            return conflict ? { ...primary, dashArray: "3 3" } : primary;
          }
          // Sve prometno je jedan sloj i crta se samo obrisom — plohe iz
          // plana pune bi radnu zonu pretvorile u mrlju, a rub asfalta je
          // ono što se zapravo želi vidjeti. Ulici razred određuje debljinu,
          // ostalima vrsta.
          const vrsta = (p as { vrsta?: string } | undefined)?.vrsta;
          if (vrsta) {
            const s = stilUlice(p?.highway) ?? STIL_VRSTE[vrsta];
            if (s) {
              return {
                color: s.boja,
                weight: s.debljina,
                opacity: 0.95,
                lineCap: "round" as const,
                lineJoin: "round" as const,
                ...(s.crtkano ? { dashArray: s.crtkano } : {}),
                ...(vrsta === "pjesacka" ? { dashArray: "2 3" } : {}),
                fill: false,
              };
            }
          }
          const own = p?.boja;
          const c = /^#[0-9a-f]{6}$/i.test(own ?? "") ? own! : layer.color;
          // Sloj razlika ide PREKO sloja godine, pa ne smije imati punu
          // ispunu iz iste palete — inače se dvije karte namjene stope u
          // kašu. Ostaje jak obrub, a ispod se vidi namjena te godine.
          if (p?.promjena) {
            return {
              color: layer.color,
              weight: 3,
              dashArray: "6 4",
              fillColor: c,
              fillOpacity: 0.12,
            };
          }
          return {
            color: c,
            weight: own ? 1 : 2,
            fillColor: c,
            fillOpacity: own ? 0.55 : 0.25,
          };
        },
        pointToLayer: (_f, latlng) =>
          L.circleMarker(latlng, {
            radius: 5,
            color: "#fff",
            weight: 1.5,
            fillColor: layer.color,
            fillOpacity: 1,
          }),
        onEachFeature: (f, lyr) => {
          const p = f.properties ?? {};
          // Svaki klik na objekt najavljuje se karti, da njezin vlastiti
          // rukovatelj zna da prazno nije pogođeno.
          lyr.on("click", () => {
            pogodakSloja.current = Date.now();
          });
          // Katastar je jedini sloj kod kojeg klik ne pita „što je ovo”, nego
          // „što je sve ovdje” — pa umjesto vlastitih polja otvara dosje
          // sastavljen od svih slojeva. Ostali slojevi ostaju sami sebi.
          if (SLOJEVI_DOSJEA.has(layer.id)) {
            lyr.on("click", (e) => {
              const { lat, lng } = (e as LeafletNS.LeafletMouseEvent).latlng;
              const put = lyr as LeafletNS.Path;
              otvoriDosje(
                lat,
                lng,
                {
                  istakni: () => {
                    put.setStyle(STIL_ODABRANO);
                    put.bringToFront();
                  },
                  // Vraćanje ide preko sloja koji je česticu i nacrtao —
                  // izvorni stil dolazi iz `style` funkcije i drugdje ga
                  // nemamo zapisanog.
                  vrati: () => gj.resetStyle(put),
                },
                normalizeCanonicalParcelId(p.parcel_id) ??
                  canonicalParcelId(p.ko, p.cestica) ??
                  canonicalParcelId(
                    p.cadastral_municipality,
                    p.parcel_number,
                  ) ??
                  undefined,
              );
            });
            return;
          }
          if (p.promjena) {
            lyr.bindPopup(popupPromjene(p));
            return;
          }
          // Uvjet ide na `opis_vrste`, a ne na `vrsta`: `opis_vrste` postavlja
          // samo merge-roads.py i nosi ga svaka prometnica, dok `vrsta` ima i
          // pola slojeva iz gradskog GIS-a (kotar, rasvjeta, kulturno dobro…).
          // Dok se granalo po `vrsta`, klik na kotar Mejaši davao je natpis
          // „prometnica”.
          if (p.opis_vrste) {
            const razred = p.highway
              ? (IME_RAZREDA[p.highway.replace(/_link$/, "")] ?? p.highway)
              : p.opis_vrste;
            lyr.bindPopup(
              `<b>${esc(p.name ?? p.opis_vrste ?? "prometnica")}</b><br>` +
                `<span style="color:#71717b">${esc(razred)}` +
                (p.surface ? ` · ${esc(p.surface)}` : "") +
                (p.maxspeed ? ` · ${esc(p.maxspeed)} km/h` : "") +
                (p.postojece === false ? " · planirano" : "") +
                `</span>`
            );
            return;
          }
          // Namjena ide prva: ona ima svoj oblik natpisa (s godinom GUP-a)
          // koji općeniti ispis polja ne bi pogodio.
          if (p.namjena) {
            lyr.bindPopup(
              `${p.namjena}${p.godina ? ` — GUP ${p.godina}.` : ""}`
            );
            return;
          }
          // Slojevi gradskog GIS-a imaju vlastiti ispis polja. Vezan je uz
          // putanju, a ne uz oblik podataka, da općeniti ispis ne počne
          // iskakati i nad OSM slojevima koji dosad nisu imali skočni prozor.
          if (layer.url.startsWith("/geo/grad/")) {
            lyr.bindPopup(popupGrad(p, layer.label));
            return;
          }
          const label = p.naziv ?? p.geografskoime ?? p.name ?? p.NAZIV ?? null;
          if (label) lyr.bindPopup(String(label));
        },
      });
      gj.addTo(grupa);
    })
    .catch((e) => {
      // Prije se ovdje samo pisalo u konzolu, pa je neuspio sloj izgledao
      // točno kao sloj bez ijednog objekta: kvačica upaljena, karta prazna.
      // Kvačica sad nosi stanje i nudi ponovni pokušaj.
      console.warn(`Sloj ${layer.id} nije učitan:`, e);
      if (registar.get(layer.id)?.sloj === grupa) stanje(layer.id, "greska");
    });
}

/** Slojevi kod kojih klik otvara dosje čestice umjesto vlastitih polja. */
const SLOJEVI_DOSJEA: ReadonlySet<string> = new Set([
  "katastar",
  "katastar-vlasnistvo",
  "javne-cestice",
  "ciljana-provjera-vlasnistva",
  "cestice-planiranih-cesta",
  // Izvedeni sloj mora voditi u dosje, ne u skočni prozor s „M/K5”.
  //
  // Bio je običan sloj s natpisom, pa je u pogledu „Gdje se može graditi
  // stan” dodir na zelenu česticu vraćao dva znaka i gasio klik na kartu —
  // vlastita analiza inicijative stajala je na putu čitanju vlastite
  // analize. Ovdje je odgovor dosje, koji tu istu analizu i ispisuje.
  "stambeno-slobodno",
]);

/**
 * Statističke i upravne plohe koje pokrivaju cijeli kvart.
 *
 * One nisu objekti nego pozadina: popisni krug, zona rasvjete, područje
 * ulice. Kao interaktivne pojedu svaki dodir — u pogledu „Katastar i adrese”
 * ploha popisnog kruga leži preko cijelog kvarta, pa je klik na česticu
 * uvijek vraćao šifru statističkog kruga umjesto dosjea.
 *
 * Ništa se ne gubi time što više ne primaju klik: dosje ionako ispituje SVE
 * slojeve po koordinati, pa se popisni krug i dalje pojavi u njemu — samo
 * kao jedan redak među ostalima, a ne kao odgovor na svako pitanje.
 */
const NEINTERAKTIVNE_PLOHE: ReadonlySet<string> = new Set([
  // Izohipse nisu ploha nego mreža od tisuću sedamsto crta razapeta preko
  // cijelog kvarta. Interaktivne bi presrele svaki klik na česticu ispod —
  // isti kvar kao kod popisnog kruga, samo tisuću puta.
  "izohipse",
  "gup-2024-planirane-ceste",
  "popisni-krugovi",
  "statisticki-krugovi",
  "ulice-podrucja",
  "rasvjeta-zone",
  "kiosci-zone",
  "vodovod-podrucja",
  "komunalna-naknada",
]);

/**
 * Kako izgleda odabrana čestica.
 *
 * Tamni obrub i topla ispuna drže se odvojeno od palete slojeva (smeđa
 * katastra, zelena/siva vlasništva), pa se odabir čita kao odabir, a ne
 * kao još jedna vrsta podatka. Bez toga se, dok je ploča otvorena, ne vidi
 * o kojoj je čestici riječ.
 */
const STIL_ODABRANO: LeafletNS.PathOptions = {
  color: "#18181b",
  weight: 3,
  fillColor: "#f59e0b",
  fillOpacity: 0.3,
};

/** Poziva se pri odabiru čestice i pri zatvaranju ploče. */
interface Isticanje {
  istakni: () => void;
  vrati: () => void;
}


/**
 * Ploča s dosjeom čestice.
 *
 * Dosje ne stane u skočni prozor: sedam tema i do šezdesetak redaka u
 * stupcu širokom 300 px daje traku kroz koju se samo skrola. Ploča ide uz
 * rub karte, pa se teme mogu složiti u više stupaca i pregled stane na
 * jedan zaslon. Uz to ne pokriva kliknutu česticu.
 */
/**
 * Uz desni rub, ali koliko prostora ostane.
 *
 * Zatvorena ploča podloge zauzima samo gumb, pa dosje počinje ispod njega i
 * ide do ruba. Otvorena je široka 14 rem i visoka pola karte, pa se dosje
 * mora odmaknuti — a ispod 1024 px za oboje jednostavno nema mjesta uz
 * otvorenu bočnu traku, pa dosje ondje pada na oblik uz dno.
 */
const DOSJE_SVUDA =
  "pointer-events-auto absolute inset-x-0 bottom-0 z-[1150] max-h-[72%] " +
  "overflow-y-auto rounded-t-xl border-t border-zinc-200 bg-white " +
  "shadow-[0_-8px_24px_rgba(0,0,0,0.12)]";
const DOSJE_SAM =
  " lg:inset-x-auto lg:right-3 lg:top-[9rem] lg:bottom-3 lg:max-h-none " +
  "lg:rounded-xl lg:border lg:shadow-lg lg:w-[min(44rem,48vw)]";
const DOSJE_UZ_KONTROLE =
  " lg:inset-x-auto lg:right-[15.5rem] lg:top-[5.5rem] lg:bottom-3 " +
  "lg:max-h-none lg:rounded-xl lg:border lg:shadow-lg lg:w-[min(34rem,40vw)]";

function DosjePlaca({
  uzKontrole,
  usko,
  tocka,
  dosje,
  ucitavanje,
  greska,
  onClose,
}: {
  uzKontrole: boolean;
  usko: boolean;
  /** Točka na kojoj je dosje otvoren — ide u prijavu, da se ne prepisuje. */
  tocka: [number, number] | null;
  dosje: Dosje | null;
  ucitavanje: boolean;
  greska: string | null;
  onClose: () => void;
}) {
  const c = dosje?.cestica;
  const okvir = useRef<HTMLElement>(null);

  // Na telefonu je dosje stvarno modal. Osim unutarnjeg omota karte treba
  // utišati i krom stranice izvan MapClienta (npr. poveznicu "Naš kvart").
  // Inertiramo samo braću duž grane koja vodi do dijaloga, nikad pretke koji
  // sadrže sam dijalog, i vraćamo isključivo elemente koje smo mi promijenili.
  useEffect(() => {
    if (!usko || !okvir.current) return;
    const promijenjeni: HTMLElement[] = [];
    const izvanDosjea = (meta: EventTarget | null) =>
      meta instanceof Node && !okvir.current?.contains(meta);
    const zadrziFokus = (e: PointerEvent) => {
      if (izvanDosjea(e.target)) e.preventDefault();
    };
    const zaustaviKlik = (e: MouseEvent) => {
      if (!izvanDosjea(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener("pointerdown", zadrziFokus, true);
    document.addEventListener("click", zaustaviKlik, true);
    let grana: HTMLElement = okvir.current;
    while (grana.parentElement) {
      const roditelj = grana.parentElement;
      for (const dijete of roditelj.children) {
        if (dijete === grana || !(dijete instanceof HTMLElement) || dijete.inert)
          continue;
        dijete.inert = true;
        promijenjeni.push(dijete);
      }
      if (roditelj === document.body) break;
      grana = roditelj;
    }
    return () => {
      document.removeEventListener("pointerdown", zadrziFokus, true);
      document.removeEventListener("click", zaustaviKlik, true);
      for (const element of promijenjeni) element.inert = false;
    };
  }, [usko]);

  // Fokus ulazi u ploču kad se otvori. Prije je ostajao na kontejneru karte,
  // pa je čitač zaslona javljao da se nešto dogodilo, ali ne i što.
  //
  // I vraća se kamo je bio kad se zatvori. Bez toga fokus pada na početak
  // dokumenta, pa je zatvaranje dosjea značilo ponovno prolaženje kroz cijelu
  // stranicu da se dođe do sljedeće kontrole.
  useEffect(() => {
    const odakle = document.activeElement as HTMLElement | null;
    okvir.current?.focus();
    return () => {
      if (odakle && document.contains(odakle)) odakle.focus();
    };
  }, []);

  /**
   * Zamka za fokus, ali SAMO na uskom zaslonu.
   *
   * Ondje ploča pokriva donjih 72 % i karta iza nje se ne može ni vidjeti ni
   * koristiti — to je modalno stanje, pa se tako i ponaša i tako se najavljuje.
   * Na širokom zaslonu ista ploča stoji uz rub dok su bočna traka i biralo
   * podloge i dalje na dohvat: ondje bi zamka bila kvar, a ne pomoć. Zato
   * `aria-modal` ide uz zamku, a ne umjesto nje — obećanje čitaču zaslona da je
   * ostatak nedostupan mora biti istinito.
   */
  useEffect(() => {
    if (!usko) return;
    const naTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !okvir.current) return;
      const meta = okvir.current.querySelectorAll<HTMLElement>(
        'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'
      );
      if (meta.length === 0) return;
      const prvi = meta[0];
      const zadnji = meta[meta.length - 1];
      const aktivan = document.activeElement;
      if (aktivan === okvir.current || !okvir.current.contains(aktivan)) {
        e.preventDefault();
        (e.shiftKey ? zadnji : prvi).focus();
      } else if (e.shiftKey && aktivan === prvi) {
        e.preventDefault();
        zadnji.focus();
      } else if (!e.shiftKey && aktivan === zadnji) {
        e.preventDefault();
        prvi.focus();
      }
    };
    document.addEventListener("keydown", naTab);
    return () => document.removeEventListener("keydown", naTab);
  }, [usko]);

  return (
    <aside
      ref={okvir}
      tabIndex={-1}
      role="dialog"
      aria-modal={usko}
      // Ploča prima fokus da čitač zaslona uđe u nju, ali ga ne obrubljuje:
      // preglednikov plavi prsten na ploči od 44 rem izgleda kao pogreška, a
      // ne kao pokazivač. Prsten pripada kontrolama u njoj.
      className={
        "outline-none " +
        DOSJE_SVUDA +
        (uzKontrole ? DOSJE_UZ_KONTROLE : DOSJE_SAM)
      }
      aria-label="Podaci o čestici"
    >
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          {c ? (
            <>
              <h2 className="text-base font-bold leading-tight">
                k.č. {String(c.cestica)}
                {c.ko ? `, k.o. ${String(c.ko)}` : ""}
              </h2>
              {typeof c.povrsina === "number" && (
                <p className="text-sm text-zinc-500">
                  {c.povrsina.toLocaleString("hr-HR", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  m²
                </p>
              )}
            </>
          ) : (
            <h2 className="text-base font-bold leading-tight">
              {ucitavanje ? "Skupljam podatke…" : "Odabrana točka"}
            </h2>
          )}
        </div>
        <button
          onClick={onClose}
          className="fokus meta -mr-1 -mt-1 min-w-11 rounded px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Zatvori dosje čestice"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        {/* Ploča se najavi imenom, a sadržaj stigne poslije nje — naslov se
            tiho prepiše iz „Skupljam podatke…” u „k.č. 275/9”. Bez ovoga je
            čitač zaslona javljao otvaranje i onda šutio do kraja. */}
        <p role="status" aria-live="polite" className="sr-only">
          {ucitavanje
            ? "Skupljam podatke o čestici…"
            : greska
              ? greska
              : dosje
                ? `${c ? `k.č. ${String(c.cestica)}. ` : ""}${
                    dosje.namjena
                      ? `Namjena ${dosje.namjena.kod}. ${
                          dosje.namjena.stanovanje
                            ? "Dopušta stanovanje."
                            : "Ne dopušta stanovanje."
                        } `
                      : ""
                  }${
                    dosje.skupine.length === 0
                      ? "Nijedan sloj ovdje nema ništa."
                      : `${dosje.skupine.length} ${brojnica(dosje.skupine.length, "tema", "teme", "tema")} s podacima.`
                  }`
                : ""}
        </p>
        {ucitavanje && <p className="text-sm text-zinc-500">Skupljam podatke…</p>}
        {greska && <p className="text-sm text-odbijeno">{greska}</p>}
        {dosje && !ucitavanje && (
          <>
            <NamjenaOdgovor namjena={dosje.namjena} />
            <TerenOdgovor teren={dosje.teren} />
            {dosje.planiranaCestaCestica ? (
              <PlaniranaCestaCesticaOdgovor
                properties={dosje.planiranaCestaCestica}
              />
            ) : (
              <>
                {dosje.ciljanaProvjeraVlasnistva && (
                  <CiljanaProvjeraOdgovor
                    properties={dosje.ciljanaProvjeraVlasnistva}
                  />
                )}
                {dosje.javnaCestica && (
                  <JavnaCesticaOdgovor properties={dosje.javnaCestica} />
                )}
              </>
            )}
            {dosje.skupine.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nijedan sloj ovdje nema ništa.
              </p>
            ) : (
              // Stupci su CSS-ovi, ne mreža: teme su različito visoke, pa ih
              // `columns` složi jednu ispod druge bez praznina koje bi mreža
              // ostavila. `break-inside` drži temu na okupu.
              <div className="gap-x-6 sm:columns-1 lg:columns-2 [column-fill:balance]">
                {dosje.skupine.map((s) => (
                  <section
                    key={s.naslov}
                    className="mb-4 break-inside-avoid"
                  >
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {s.naslov}
                    </h3>
                    <ul className="space-y-1.5">
                      {s.stavke.map((st) => (
                        <li key={st.sloj} className="text-sm leading-snug">
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="font-semibold text-zinc-800">
                              {st.sloj}
                            </span>
                            {st.broj > 1 && (
                              <span className="text-xs text-zinc-500">
                                ×{st.broj}
                              </span>
                            )}
                            <span className="rounded bg-zinc-100 px-1 text-[11px] uppercase tracking-wide text-zinc-600">
                              {ODNOS_NATPIS[st.odnos]}
                            </span>
                            {st.poveznica && (
                              <a
                                href={st.poveznica}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-maslina underline"
                              >
                                dokument ↗
                              </a>
                            )}
                          </div>
                          <div className="text-[13px] text-zinc-500">
                            {st.primjeri.map((p, i) => (
                              <div key={i}>{p}</div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-500">
              pretraženo {dosje.pretrazeno} slojeva koji mogu nositi podatak o čestici
            </p>

            {/* Put iz nalaza u radnju.
                Dosad se s karte nije moglo nikamo: tko je ovdje nešto našao,
                morao je otvoriti izbornik, naći „Prijavi problem” i prepisati
                lokaciju po sjećanju. Uspjeh je zapisan kao „više uključenih
                susjeda”, a ovo je jedino mjesto na karti gdje netko već gleda
                određenu točku i ima razlog. Lokacija ide sa sobom. */}
            {tocka && (
              <a
                href={`/prijavi?lat=${tocka[0].toFixed(6)}&lng=${tocka[1].toFixed(
                  6
                )}${
                  c?.cestica ? `&kc=${encodeURIComponent(String(c.cestica))}` : ""
                }`}
                className="fokus meta mt-3 inline-flex items-center gap-1.5 rounded-full bg-maslina px-4 py-2 text-sm font-semibold text-white hover:bg-maslina-tamna"
              >
                Prijavi problem ovdje
                <span aria-hidden>→</span>
              </a>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function PlaniranaCestaCesticaOdgovor({
  properties,
}: {
  properties: PlannedRoadParcelProperties;
}) {
  const facts = plannedRoadParcelDossierFacts(properties);
  const statusTone = plannedRoadOwnershipStatusTone(properties.ownership_status);
  return (
    <section className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-zinc-900">
          Planirana cesta i vlasništvo
        </h3>
        <span
          className={
            "rounded-full px-2 py-0.5 text-xs font-bold " +
            (statusTone === "neutral"
              ? "bg-zinc-200 text-zinc-700"
              : "bg-amber-100 text-amber-800")
          }
        >
          {PLANNED_ROAD_OWNERSHIP_STATUS_LABELS[properties.ownership_status]}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-sm leading-normal text-zinc-800">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
        <li>
          Izvor dokaza:{" "}
          {PLANNED_ROAD_OWNERSHIP_EVIDENCE_LABELS[properties.ownership_evidence]}
        </li>
      </ul>
      {properties.has_evidence_conflict && (
        <p className="mt-2 rounded bg-amber-100 px-2 py-1.5 text-sm font-semibold text-amber-800">
          Dostupni izvori nisu međusobno usklađeni.
        </p>
      )}
      {properties.secondary_evidence_labels.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm leading-normal text-zinc-700">
          {properties.secondary_evidence_labels.map((label) => (
            <li key={label}>Dodatni izvor: {label}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs leading-normal text-zinc-600">
        Informativni prikaz nacrta GUP-a 2024. Vlasništvo nije ponovno
        provjeravano; službeni zapis provjeri na{" "}
        <a
          href="https://oss.uredjenazemlja.hr/map"
          target="_blank"
          rel="noopener noreferrer"
          className="fokus font-semibold text-maslina underline"
        >
          Uređenoj zemlji
        </a>
        .
      </p>
    </section>
  );
}

function CiljanaProvjeraOdgovor({
  properties,
}: {
  properties: TargetedOwnershipProperties;
}) {
  const facts = targetedOwnershipDossierFacts(properties);
  const publicStatus = ["confirmed_public", "cadastre_public", "mixed_public"].includes(
    properties.verification_status
  );
  return (
    <section
      className={`mb-3 rounded-lg border px-3 py-2.5 ${
        publicStatus
          ? "border-maslina-rub bg-maslina-vez"
          : properties.verification_status === "unresolved"
            ? "border-status-u-tijeku-ground bg-status-u-tijeku-ground"
            : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-zinc-900">Ciljana provjera vlasništva</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            publicStatus
              ? "bg-status-rijeseno-ground text-status-rijeseno"
              : properties.verification_status === "unresolved"
                ? "bg-white text-status-u-tijeku"
                : "bg-zinc-200 text-zinc-700"
          }`}
        >
          {OWNERSHIP_STATUS_LABELS[properties.verification_status]}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-sm leading-normal text-zinc-800">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-normal text-zinc-600">
        {properties.verified_at
          ? `Provjereno ${formatPublicSourceDate(properties.verified_at)}. `
          : "Nije razriješeno u automatskoj provjeri. "}
        Privatna imena nisu objavljena. Službeni zapis provjeri na{" "}
        <a
          href="https://oss.uredjenazemlja.hr/map"
          target="_blank"
          rel="noopener noreferrer"
          className="fokus font-semibold text-maslina underline"
        >
          Uređenoj zemlji
        </a>
        .
      </p>
    </section>
  );
}

function JavnaCesticaOdgovor({
  properties,
}: {
  properties: PublicParcelProperties;
}) {
  const facts = publicParcelDossierFacts(properties);
  return (
    <section className="mb-3 rounded-lg bg-zinc-100 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-zinc-900">
          Evidentirani javni status
        </h3>
        <span className="rounded-full bg-status-u-tijeku-ground px-2 py-0.5 text-xs font-bold text-status-u-tijeku">
          djelomična evidencija
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-sm leading-normal text-zinc-800">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-normal text-zinc-600">
        GIS izvoz Grada Splita, stanje izvornog sloja{" "}
        {formatPublicSourceDate(properties.source_updated_at)}.
        Informativni prikaz; vlasništvo provjeri na{" "}
        <a
          href="https://oss.uredjenazemlja.hr/map"
          target="_blank"
          rel="noopener noreferrer"
          className="fokus font-semibold text-maslina underline"
        >
          Uređenoj zemlji
        </a>
        . Nacrt GUP-a 2024. nije plan na snazi.
      </p>
    </section>
  );
}

/**
 * Teren: visina, nagib i strana svijeta za kliknutu točku.
 *
 * Stoji odmah ispod namjene, a ne među temama. Teme su popis onoga što se na
 * čestici ZATEKLO — okno telekoma, koš za otpad, trasa DTK-a — a ovo je
 * svojstvo samog zemljišta, kao i zapreke. Među pedeset šest redaka bi se
 * čitalo kao još jedan nalaz, a nije nalaz nego opis.
 *
 * Nagib se izriče i riječju, ne samo brojem: „14 %” je za većinu ljudi prazan
 * podatak, a „blaga kosina” nije. Razredi su grubi namjerno — mreža ima korak
 * od 3 m i finija podjela bi tvrdila više nego što izmjera nosi.
 */
function TerenOdgovor({ teren }: { teren: Dosje["teren"] }) {
  // Nema reljefa — nema retka. Za razliku od namjene, gdje šutnja može značiti
  // „nije dopušteno”, ovdje odsutnost ne mijenja ničije planove, pa ne treba
  // trošiti redak da bi se objasnila. Točka izvan mreže je uz to izvan
  // obuhvata karte, dakle mjesto na koje se ne može ni doći.
  if (!teren) return null;
  const { visina, nagib, ekspozicija, cestica } = teren;
  const razred =
    nagib < 3
      ? "ravno"
      : nagib < 12
        ? "blaga kosina"
        : nagib < 25
          ? "kosina"
          : "strmo";
  return (
    <section className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
        Teren
      </h3>
      <p className="mt-0.5 text-base font-semibold leading-snug text-zinc-900">
        {visina.toLocaleString("hr-HR", { maximumFractionDigits: 1 })} m
        nadmorske visine
      </p>
      <p className="mt-1 text-base leading-snug text-zinc-800">
        {razred}
        {nagib >= 3 && (
          <>
            {" "}
            — {nagib.toLocaleString("hr-HR", { maximumFractionDigits: 1 })} %
            {ekspozicija && `, pada prema ${STRANA_NATPIS[ekspozicija]}u`}
          </>
        )}
      </p>
      {cestica && cestica.najvisa > cestica.najniza && (
        <p className="mt-1 text-sm leading-snug text-zinc-700">
          Preko cijele čestice:{" "}
          {cestica.najniza.toLocaleString("hr-HR", {
            maximumFractionDigits: 1,
          })}
          –
          {cestica.najvisa.toLocaleString("hr-HR", {
            maximumFractionDigits: 1,
          })}{" "}
          m, dakle{" "}
          {(cestica.najvisa - cestica.najniza).toLocaleString("hr-HR", {
            maximumFractionDigits: 1,
          })}{" "}
          m visinske razlike.
        </p>
      )}
      {/* Izvor uz tvrdnju, kao svugdje. Zaglađivanje se ne spominje jer se
          ovdje NE očitava iz zaglađene mreže nego iz one na 3 m — zaglađuju
          se samo izohipse, i to je zapisano uz njih. */}
      <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
        Izmjereno iz DMR-a (LiDAR) Državne geodetske uprave, mreža 3 m.
      </p>
    </section>
  );
}

/**
 * Namjena kao ODGOVOR, ne kao redak.
 *
 * Dosje je pedeset šest slojeva poredanih po temi, i u toj poredanoj hrpi
 * pitanje s kojim je susjed došao — „smijem li ovdje graditi?” — nije imalo
 * nijedan redak. Ovo stoji iznad svega ostalog, prije prvog naslova teme,
 * jer je jedino što se traži prije nego što se išta drugo pogleda.
 *
 * Uz svaku tvrdnju ide izvor i godina. Namjena je pravna činjenica koja
 * mijenja nečije planove; bez „po GUP-u 2015., na snazi” to je glasina.
 */
function NamjenaOdgovor({ namjena }: { namjena: Dosje["namjena"] }) {
  if (!namjena) {
    return (
      <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
        Za ovu točku nema plohe namjene na praćenom listu GUP-a. To ne znači
        da namjene nema — znači da je ovdje ne možemo očitati.
      </p>
    );
  }
  const { kod, opis, godina, stanovanje, saPrethodnog, prije, slobodna, izvan, zapreke } =
    namjena;
  // Boja slijedi ISHOD, ne namjenu.
  //
  // Prije je okvir bio zelen čim namjena dopušta stanovanje — pa je zaključana
  // čestica dobivala zeleni okvir oko rečenice „ovdje se ne gradi”, a K5 s
  // četiri zgrade zeleni okvir bez ijedne ograde. Boja koja proturječi
  // rečenici pokraj sebe je gore od nikakve, i krši One Green Rule: maslina
  // označava ono na što se može djelovati, ne raspoloženje.
  //
  // Dopunjeno zaprekama. Prije je „ishod” znao samo za pristup na cestu, pa je
  // k.č. 401/1 dobivala zeleni okvir i „2.945 m² stvarno slobodne površine”
  // iako preko nje idu dva dalekovoda od 110 kV, a 30 % pada u planirani
  // cestovni koridor. Zeleno oko rečenice koja ne zna za dalekovod nije
  // ohrabrenje nego kriva tvrdnja.
  const povoljno =
    stanovanje &&
    slobodna !== null &&
    !slobodna.bez_pristupa &&
    zapreke.length === 0;
  return (
    <section
      className={`mb-3 rounded-lg border px-3 py-2.5 ${
        povoljno
          ? "border-maslina-rub bg-maslina-vez"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
        Namjena
      </h3>
      <p className="mt-0.5 text-base font-semibold leading-snug text-zinc-900">
        <span className="font-mono">{kod}</span> — {opis}
      </p>
      <p className="mt-1 text-base font-medium leading-snug text-zinc-800">
        {stanovanje
          ? "Ova namjena dopušta stanovanje."
          : "Ova namjena ne dopušta stanovanje."}
      </p>
      {/* Godina i pravni status dolaze iz jednog mjesta (plan-status.ts).
          Dok navod odluke nije upisan, piše se godina bez tvrdnje „na snazi” —
          „Ništa bez izvora” vrijedi i za pravni status akta. */}
      <p className="mt-0.5 text-xs text-zinc-600">
        {natpisPlana({ ...NA_SNAZI, godina })}
      </p>
      {/* Očitano sa starijeg lista, i to piše. Tri slobodne čestice u kvartu
          nemaju plohu na listu na snazi; prešutjeti odakle podatak dolazi
          značilo bi pripisati ga planu na kojem ga nema. */}
      {saPrethodnog && (
        <p className="mt-1 text-sm leading-snug text-zinc-700">
          Na listu GUP-a {NA_SNAZI.godina}. ovdje nema plohe namjene, pa je
          očitano s lista iz {PRETHODNI.godina}. Provjeri kod nadležne službe.
        </p>
      )}

      {prije && (
        <p className="mt-2 border-t border-black/10 pt-2 text-base leading-snug text-zinc-800">
          Po prethodnom planu ({PRETHODNI.godina}.) ovdje je bilo{" "}
          <span className="font-mono font-semibold">{prije.kod}</span> —{" "}
          {prije.opis}.
        </p>
      )}

      {slobodna && (
        <p className="mt-2 border-t border-black/10 pt-2 text-base leading-snug text-zinc-800">
          {slobodna.bez_pristupa ? (
            <>
              Čestica je u sloju slobodnih, ali{" "}
              <b className="font-semibold text-odbijeno">nema pristup na cestu</b>{" "}
              — bez služnosti ili nove ulice ovdje se ne gradi.
            </>
          ) : (
            <>
              Čestica je u sloju slobodnih:{" "}
              <b className="font-semibold">
                {Math.round(slobodna.slobodno_m2).toLocaleString("hr-HR")} m²
              </b>{" "}
              stvarno slobodne površine.
            </>
          )}
        </p>
      )}

      {/* Odsutnost se izriče. Prešućena, čita se kao dopuštenje. */}
      {!slobodna && izvan && (
        <p className="mt-2 border-t border-black/10 pt-2 text-base leading-snug text-zinc-800">
          Nije u sloju slobodnih čestica — {izvan}.
        </p>
      )}

      {/* Zapreke idu IZNAD upute i ispod svega ostalog što je izrečeno —
          dakle na kraj presude, a ne u temu „Struja” četiri zaslona niže.
          Ruža, ne alarm-crvena: ovo je činjenica koja se bilježi. */}
      {zapreke.length > 0 && (
        <div className="mt-2 border-t border-black/10 pt-2">
          <p className="text-base font-semibold leading-snug text-odbijeno">
            {zapreke.length === 1
              ? "Na čestici je zapreka gradnji:"
              : "Na čestici su zapreke gradnji:"}
          </p>
          <ul className="mt-1 space-y-1">
            {zapreke.map((z) => (
              <li key={z.vrsta} className="text-base leading-snug text-zinc-800">
                {z.opis}{" "}
                <span className="text-xs text-zinc-600">({z.izvor})</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-zinc-700">
            U zaštitnom pojasu dalekovoda i unutar koridora se ne gradi.
            Provjeri kod nadležnih službi prije bilo kakve odluke.
          </p>
        </div>
      )}

      <p className="mt-2 text-sm text-zinc-700">
        Uputa gdje gledati, ne potvrda — mjerodavni su akt i uvjeti gradnje.
      </p>
    </section>
  );
}

async function prikaziSolar(
  L: typeof LeafletNS,
  map: LeafletNS.Map,
  latlng: LeafletNS.LatLng
) {
  const popup = L.popup()
    .setLatLng(latlng)
    .setContent("Računam solarni potencijal…")
    .openOn(map);
  try {
    const res = await fetch(
      `/api/solar?lat=${latlng.lat.toFixed(5)}&lon=${latlng.lng.toFixed(5)}`
    );
    const data = await res.json();
    if (!res.ok) {
      popup.setContent(data.error ?? "Nema podataka.");
      return;
    }
    popup.setContent(
      `<b>Solarni potencijal</b><br>~<b>${data.kwhPerKwp.toLocaleString(
        "hr-HR"
      )} kWh</b> godišnje po 1 kWp<br><span style="color:#71717b">iradijacija ${data.irradiation.toLocaleString(
        "hr-HR"
      )} kWh/m²</span>`
    );
  } catch {
    popup.setContent("Greška pri dohvaćanju.");
  }
}

function esc(v: unknown): string {
  return String(v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

/**
 * Skočni prozor plohe koja se mijenja.
 *
 * Ako nacrt tu promjenu sam obrazlaže brojem stavke iz svog popisa izmjena,
 * navodi se doslovno — to je jedini dio prikaza koji ne izvodimo mi nego ga
 * plan tvrdi o sebi, pa stoji odvojeno od naše računice.
 */
/**
 * Skočni prozor za slojeve iz GIS izvoza Grada (scripts/import-split-gis.ts).
 *
 * Ti slojevi nemaju zajednički oblik — cesta nosi upravitelja, cijev promjer,
 * čestica broj — pa se natpis sastavlja od onoga što objekt doista ima.
 * Uvoz je već izbacio prazne vrijednosti, tako da je prisutnost polja ujedno
 * i znak da ga vrijedi pokazati.
 */
/** Redom kojim se traži naslov; prvo pronađeno postaje podebljana glava. */
const NASLOV_POLJA = ["naziv", "ulica", "oznaka", "broj", "vrsta", "tip"];

/**
 * Naslov + polja koja je naslov već potrošio (da se ne ponove u tijelu).
 * Adresa i čestica imaju ustaljen zapis koji redoslijed polja ne pogađa:
 * kućni broj se piše „Dračevac 48”, a čestica „k.č. 392/3”.
 */
function naslovGrada(
  p: Record<string, unknown>
): { glava: string; potroseno: string[] } | null {
  if (p.ulica != null && p.broj != null) {
    return { glava: `${p.ulica} ${p.broj}`, potroseno: ["ulica", "broj"] };
  }
  if (p.cestica != null) {
    const ko = p.ko != null ? `, k.o. ${p.ko}` : "";
    return { glava: `k.č. ${p.cestica}${ko}`, potroseno: ["cestica", "ko"] };
  }
  const kljuc = NASLOV_POLJA.find((k) => p[k] !== undefined && p[k] !== null);
  return kljuc ? { glava: String(p[kljuc]), potroseno: [kljuc] } : null;
}

/**
 * `nazivSloja` je zaliha za objekte bez ikakva imena — zgradu, pješački
 * prijelaz ili izbočinu. Bez njega bi klik na njih davao ništa, a upravo je
 * „što je ovo?” jedino pitanje koje stanar nad takvom točkom ima.
 */
function popupGrad(p: Record<string, unknown>, nazivSloja: string): string {
  const naslov = naslovGrada(p) ?? { glava: nazivSloja, potroseno: [] };
  const redci = Object.entries(IME_POLJA)
    .filter(
      ([k]) =>
        !naslov.potroseno.includes(k) &&
        p[k] !== undefined &&
        p[k] !== null
    )
    .map(([k, ime]) => `${esc(ime)}: ${esc(vrijednostPolja(p[k], k))}`);
  // Obuhvati planova nose poveznicu na sam dokument na split.hr. Ispisana
  // kao tekst ne vrijedi ništa — cijela je poanta da se s karte može otići
  // čitati plan koji na tom mjestu vrijedi.
  const url = typeof p.poveznica === "string" ? p.poveznica : null;
  if (url && /^https?:\/\//.test(url)) {
    redci.push(
      `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" ` +
        `style="color:#047857">otvori dokument plana ↗</a>`
    );
  }
  const glava = `<b>${esc(naslov.glava)}</b>`;
  if (redci.length === 0) return glava;
  return (
    glava +
    `<br><span style="color:#71717b">${redci.join("<br>")}</span>`
  );
}

function popupPromjene(p: Record<string, unknown>): string {
  const ha = Number(p.povrsina_m2) / 1e4;
  const glava =
    `<b>${esc(p.iz_namjena)} → ${esc(p.u_namjena)}</b><br>` +
    `<span style="color:#71717b">${esc(p.iz_kod)} → ${esc(p.u_kod)} · ` +
    `${ha.toLocaleString("hr-HR", { maximumFractionDigits: 2 })} ha · ` +
    `nacrt ${esc(p.do_godine)}. prema planu iz ${esc(p.od_godine)}.</span>`;
  if (!p.stavka) return glava;
  return (
    glava +
    `<hr style="margin:6px 0;border:0;border-top:1px solid #e4e4e7">` +
    `<span style="color:#3f3f46">Nacrt to navodi kao stavku ` +
    `<b>${esc(p.stavka)}</b>:<br><i>„${esc(p.stavka_tekst)}”</i></span>`
  );
}
