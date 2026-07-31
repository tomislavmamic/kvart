"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type * as LeafletNS from "leaflet";
import {
  BASE_LAYERS,
  OVERLAY_LAYERS,
  MAP_VIEWS,
  DIMENSIONS,
  COMPARISONS,
  UPRAVLJANI_SLOJEVI,
  KVART_CENTER,
  type MapView,
  type OverlayLayer,
} from "@/lib/map-views";
import { IME_POLJA, vrijednostPolja } from "@/lib/polja";
import { ODNOS_NATPIS, type Dosje } from "@/lib/dosje-oblik";

const OVERLAY_BY_ID = new Map(OVERLAY_LAYERS.map((l) => [l.id, l]));

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
  const baseRef = useRef<LeafletNS.TileLayer | null>(null);
  // Uz sam sloj pamti se i okno u kojem je stvoren: klizač sloj seli u
  // rezano okno, a sloj se u Leafletu ne može premjestiti nakon stvaranja.
  const overlayInstances = useRef<Map<string, Postavljeni>>(new Map());
  const geojsonCache = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const solarHandler = useRef<((e: LeafletNS.LeafletMouseEvent) => void) | null>(
    null
  );

  const [ready, setReady] = useState(false);
  const [baseId, setBaseId] = useState("dof");
  const [viewId, setViewId] = useState(MAP_VIEWS[0].id);
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(phase1(MAP_VIEWS[0].layerIds))
  );
  // Otvorena po dolasku: u njoj su i pogledi, pa zatvorena skriva navigaciju.
  const [panelOpen, setPanelOpen] = useState(true);
  // Desna ploča: podloga (ortofoto/ulična) i biralo namjene. Sklapa se jer
  // je s legendom visoka pola karte, a jednom odabrana podloga se rijetko
  // mijenja — nema razloga da trajno pokriva desnu trećinu prikaza.
  const [kontroleOpen, setKontroleOpen] = useState(true);
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
  // Svaki klik dobiva svoj broj; kad se odgovor vrati, upisuje se samo ako
  // je u međuvremenu nije pretekao noviji klik.
  const dosjeZahtjev = useRef(0);

  // Trenutačno istaknuta čestica — drži se da je se može vratiti u izvorni
  // stil kad se odabere druga ili kad se ploča zatvori.
  const istaknuto = useRef<Isticanje | null>(null);

  const otvoriDosje = useRef((lat: number, lng: number, oznaci?: Isticanje) => {
    const moj = ++dosjeZahtjev.current;
    istaknuto.current?.vrati();
    istaknuto.current = oznaci ?? null;
    oznaci?.istakni();
    setDosje(null);
    setDosjeGreska(null);
    setDosjeUcitavanje(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/cestica?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`
        );
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


  // ---- init map once ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapDiv.current) return;
      LRef.current = L;
      const map = L.map(mapDiv.current, {
        center: KVART_CENTER,
        zoom: 15,
        minZoom: 12,
        maxZoom: 19,
        zoomControl: false,
        attributionControl: true,
      });
      // Ograniči pomicanje na kvart + ~700 m rezerve — karta je o Dračevcu
      // i Bilicama, ne o cijelom Splitu.
      map.setMaxBounds([
        [43.514, 16.481],
        [43.536, 16.518],
      ]);
      // Vektorski slojevi svi crtaju u zajedničko overlayPane, pa se ne mogu
      // rezati pojedinačno. Svaka strana klizača dobiva svoje okno.
      for (const ime of ["sbs-lijevo", "sbs-desno"]) {
        const okno = map.createPane(ime);
        okno.style.zIndex = "400";
      }
      L.control.zoom({ position: "topright" }).addTo(map);
      mapRef.current = map;
      setReady(true);

      // Stvarna granica kvartova (službeni poligoni) + oznake u središtu svakog.
      try {
        const fc = (await (
          await fetch("/geo/granica.geojson")
        ).json()) as GeoJSON.FeatureCollection;
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
        map.fitBounds(boundary.getBounds(), { padding: [34, 34] });
      } catch {
        map.setView(KVART_CENTER, 15);
      }
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
    if (baseRef.current) map.removeLayer(baseRef.current);
    const base = BASE_LAYERS.find((b) => b.id === baseId) ?? BASE_LAYERS[0];
    let layer: LeafletNS.TileLayer;
    if (base.type === "wms") {
      layer = L.tileLayer.wms(base.url, {
        layers: base.wmsLayers,
        format: "image/jpeg",
        crs: L.CRS.EPSG4326,
        attribution: base.attribution,
        maxZoom: 19,
      });
    } else {
      layer = L.tileLayer(base.url, {
        attribution: base.attribution,
        subdomains: "abcd",
        maxZoom: 19,
      });
    }
    layer.addTo(map);
    layer.bringToBack();
    baseRef.current = layer;
  }, [baseId, ready]);

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
      if (!renderIds.has(id) || inst.okno !== okna[id]) {
        map.removeLayer(inst.sloj);
        overlayInstances.current.delete(id);
      }
    }
    for (const id of renderIds) {
      if (overlayInstances.current.has(id)) continue;
      const layer = OVERLAY_BY_ID.get(id);
      if (!layer || layer.phase !== 1) continue;
      if (layer.type === "api") continue; // handled separately (solar)
      dodajSloj(L, map, layer, okna[id], overlayInstances.current,
        geojsonCache.current, otvoriDosje.current);
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
  }, [renderIds, ready, okna]);

  // ---- klizač za usporedbu dviju godina ----
  // Pisano ručno, a ne preko leaflet-side-by-side: taj dodatak iznutra radi
  // require('./layout.css'), a Turbopack tu tvornicu ne isporuči modulu
  // povučenom dinamičkim import()-om, pa uvoz padne. Sama je logika kratka:
  // razdjelnik + `clip` na oba okna, preračunat pri svakom pomaku karte.
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

    let omjer = 0.5;
    const drska = document.createElement("div");
    drska.setAttribute("role", "separator");
    drska.setAttribute("aria-label", "Razdjelnik usporedbe");
    drska.style.cssText =
      "position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;" +
      "background:#fff;box-shadow:0 0 4px rgba(0,0,0,.5);cursor:ew-resize;" +
      "z-index:400;touch-action:none";
    map.getContainer().appendChild(drska);

    const osvjezi = () => {
      const velicina = map.getSize();
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint([velicina.x, velicina.y]);
      const rez = nw.x + velicina.x * omjer;
      lijevo.style.clip = `rect(${nw.y}px,${rez}px,${se.y}px,${nw.x}px)`;
      desno.style.clip = `rect(${nw.y}px,${se.x}px,${se.y}px,${rez}px)`;
      drska.style.left = `${velicina.x * omjer}px`;
    };

    const pomak = (e: PointerEvent) => {
      const okvir = map.getContainer().getBoundingClientRect();
      omjer = Math.min(1, Math.max(0, (e.clientX - okvir.left) / okvir.width));
      osvjezi();
    };
    const kraj = (e: PointerEvent) => {
      drska.releasePointerCapture(e.pointerId);
      drska.removeEventListener("pointermove", pomak);
      map.dragging.enable();
    };
    const pocetak = (e: PointerEvent) => {
      e.preventDefault();
      drska.setPointerCapture(e.pointerId);
      drska.addEventListener("pointermove", pomak);
      map.dragging.disable();
    };
    drska.addEventListener("pointerdown", pocetak);
    drska.addEventListener("pointerup", kraj);
    map.on("move zoom resize", osvjezi);
    osvjezi();

    return () => {
      map.off("move zoom resize", osvjezi);
      drska.removeEventListener("pointerdown", pocetak);
      drska.removeEventListener("pointerup", kraj);
      drska.remove();
      lijevo.style.clip = "";
      desno.style.clip = "";
    };
  }, [klizac, usporedba, ready, renderIds]);

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

  const currentView = MAP_VIEWS.find((v) => v.id === viewId);

  return (
    // Cijeli prozor. `fixed inset-0`, a ne visina u `vh`: karta je sama
    // sebi stranica — nema ničega iznad ni ispod, pa nema ni listanja koje
    // bi pomicalo ploče, ni razmimoilaženja s trakom mobilnog preglednika.
    <div className="fixed inset-0 overflow-hidden bg-zinc-100">
      <div ref={mapDiv} className="h-full w-full bg-zinc-100" />

      <Kontrole
        baseId={baseId}
        onBase={setBaseId}
        dimValue={dimValue}
        onDimValue={(dimId, layerId) =>
          setDimValue((p) => ({ ...p, [dimId]: layerId }))
        }
        comparisonId={comparisonId}
        onComparison={setComparisonId}
        nacin={nacin}
        onNacin={setNacin}
        klizac={klizac}
        open={kontroleOpen}
        onOpen={setKontroleOpen}
      />

      <Sidebar
        views={MAP_VIEWS}
        viewId={viewId}
        onSelectView={selectView}
        currentView={currentView}
        activeIds={activeIds}
        onToggle={toggleLayer}
        open={panelOpen}
        onOpen={setPanelOpen}
      />

      {(dosje || dosjeUcitavanje || dosjeGreska) && (
        <DosjePlaca
          uzKontrole={kontroleOpen}
          dosje={dosje}
          ucitavanje={dosjeUcitavanje}
          greska={dosjeGreska}
          onClose={() => {
            dosjeZahtjev.current++;
            istaknuto.current?.vrati();
            istaknuto.current = null;
            setDosje(null);
            setDosjeGreska(null);
            setDosjeUcitavanje(false);
          }}
        />
      )}
    </div>
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
  open: boolean;
  onOpen: (v: boolean) => void;
}) {
  const { currentView } = props;
  // Slojeve kojima upravlja biralo desno ovdje se ne nudi ni kad ih pogled
  // spominje — inače bi ista podloga imala i kvačicu i čip.
  const odabrani = (currentView?.layerIds ?? [])
    .map((id) => OVERLAY_BY_ID.get(id))
    .filter((l): l is OverlayLayer => !!l && !UPRAVLJANI_SLOJEVI.has(l.id));
  const podignuti = new Set(odabrani.map((l) => l.id));
  const skupine = [...new Set(OVERLAY_LAYERS.map((l) => l.group))];
  const uSkupini = (g: string) =>
    OVERLAY_LAYERS.filter(
      (l) =>
        l.group === g && !UPRAVLJANI_SLOJEVI.has(l.id) && !podignuti.has(l.id)
    );

  // Ispod plutajućeg izbornika, koji drži gornji lijevi ugao.
  if (!props.open) {
    return (
      <button
        onClick={() => props.onOpen(true)}
        className="absolute left-3 top-16 z-[1100] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold shadow hover:bg-zinc-50"
      >
        ☰ Slojevi
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 top-16 z-[1100] flex w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <span className="text-sm font-bold">Karta kvarta</span>
        <button
          onClick={() => props.onOpen(false)}
          aria-label="Sakrij bočnu traku"
          className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          ⟨ sakrij
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 text-xs">
        <p className="mb-1 font-bold uppercase tracking-wide text-zinc-500">
          Pogled
        </p>
        <div className="flex flex-wrap gap-1">
          {props.views.map((v) => (
            <button
              key={v.id}
              onClick={() => props.onSelectView(v.id)}
              className={`rounded-full border px-2.5 py-1 font-semibold ${
                v.id === props.viewId
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {currentView && (
          <Opis view={currentView} />
        )}

        {odabrani.length > 0 && (
          <>
            <p className="mb-1 mt-4 font-bold uppercase tracking-wide text-zinc-500">
              U ovom pogledu
            </p>
            <div className="space-y-1">
              {odabrani.map((l) => (
                <Kvacica
                  key={l.id}
                  sloj={l}
                  upaljen={props.activeIds.has(l.id)}
                  onToggle={props.onToggle}
                />
              ))}
            </div>
          </>
        )}

        <p className="mb-1 mt-4 font-bold uppercase tracking-wide text-zinc-500">
          {odabrani.length > 0 ? "Ostali slojevi" : "Slojevi"}
        </p>
        {skupine.map((g) => {
          const slojevi = uSkupini(g);
          if (slojevi.length === 0) return null;
          const n = slojevi.filter((l) => props.activeIds.has(l.id)).length;
          return (
            <details key={g} open={n > 0} className="border-b border-zinc-100">
              <summary className="cursor-pointer select-none py-1.5 font-semibold text-zinc-700">
                {g}
                {n > 0 && (
                  <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-emerald-800">
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
                    onToggle={props.onToggle}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {/* Prije je stajalo ispod karte. Otkad karta uzima cijeli prozor,
          „ispod” ne postoji, a oboje je i dalje potrebno: granicu se
          preuzima, a izvore se mora navesti. */}
      <div className="border-t border-zinc-200 px-3 py-2 text-[11px] leading-snug text-zinc-400">
        <a
          href="/geo/granica.geojson"
          download="granica-dracevac-bilice.geojson"
          className="inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900"
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
          <a href="/podaci" className="underline hover:text-zinc-600">
            Prostorni podaci
          </a>
          .
        </p>
      </div>
    </div>
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
      <p className={`text-zinc-500 ${dug && !razvijen ? "line-clamp-4" : ""}`}>
        {view.description}
      </p>
      {dug && (
        <button
          onClick={() => setOtvoren(razvijen ? null : view.id)}
          className="mt-0.5 font-semibold text-emerald-700 hover:underline"
        >
          {razvijen ? "manje ▴" : "cijeli opis ▾"}
        </button>
      )}
    </div>
  );
}

/** Jedan sloj u bočnoj traci — isti redak i u skupini pogleda i u izvornoj. */
function Kvacica({
  sloj,
  upaljen,
  onToggle,
}: {
  sloj: OverlayLayer;
  upaljen: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 ${sloj.phase === 2 ? "opacity-45" : ""}`}
    >
      <input
        type="checkbox"
        checked={upaljen}
        disabled={sloj.phase === 2}
        onChange={() => onToggle(sloj.id)}
        className="mt-0.5 accent-emerald-600"
      />
      <span className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ background: sloj.color }}
        />
        <span>
          {sloj.label}
          {sloj.phase === 2 && (
            <span className="ml-1 text-zinc-400">(uskoro)</span>
          )}
        </span>
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
  dimValue: Record<string, string>;
  onDimValue: (dimId: string, layerId: string) => void;
  comparisonId: string | null;
  onComparison: (id: string | null) => void;
  nacin: "obris" | "klizac";
  onNacin: (n: "obris" | "klizac") => void;
  klizac: boolean;
  open: boolean;
  onOpen: (v: boolean) => void;
}) {
  if (!props.open) {
    return (
      <button
        onClick={() => props.onOpen(true)}
        className="absolute right-3 top-[5.5rem] z-[1100] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold shadow hover:bg-zinc-50"
      >
        Podloga ☰
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-[5.5rem] z-[1100] flex max-h-[calc(100%-7rem)] w-56 max-w-[70vw] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <span className="text-sm font-bold">Podloga</span>
        <button
          onClick={() => props.onOpen(false)}
          aria-label="Sakrij izbor podloge"
          className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          sakrij ⟩
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 text-xs">
        <div className="flex flex-wrap gap-1">
          {BASE_LAYERS.map((b) => (
            <Cip
              key={b.id}
              odabran={b.id === props.baseId}
              onClick={() => props.onBase(b.id)}
            >
              {b.label}
            </Cip>
          ))}
        </div>

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

              {usporedbe.length > 0 && (
                <>
                  <p className="mb-1 mt-2 font-semibold text-zinc-600">
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
                    {usporedbe.map((c) => (
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
                </>
              )}

              {usporedbe.some((c) => c.id === props.comparisonId) && (
                <>
                  <p className="mb-1 mt-2 font-semibold text-zinc-600">Prikaz</p>
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
      </div>
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
  const izabrano = crveni
    ? "bg-red-600 text-white"
    : tamni
      ? "bg-zinc-800 text-white"
      : "bg-emerald-600 text-white";
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 font-medium ${
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

/**
 * Obris ulice po razredu iz OSM-a.
 *
 * Ceste su linije, ne plohe, pa ih ispuna ne opisuje — nosi ih debljina.
 * Hijerarhija je namjerno gruba: magistrala, ulica, servisni put, makadam.
 * Boje su svijetle jer je podloga ortofoto.
 */
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
}

async function ucitajGeoJSON(
  url: string,
  spremnik: Map<string, GeoJSON.FeatureCollection>
): Promise<GeoJSON.FeatureCollection> {
  const spremljeno = spremnik.get(url);
  if (spremljeno) return spremljeno;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const fc = (await res.json()) as GeoJSON.FeatureCollection;
  spremnik.set(url, fc);
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
  otvoriDosje: (lat: number, lng: number, oznaci?: Isticanje) => void
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
  registar.set(layer.id, { sloj: grupa, okno });
  ucitajGeoJSON(layer.url, spremnik)
    .then((fc) => {
      // Provjerava se identitet, ne samo prisutnost: sloj je u međuvremenu
      // mogao biti ugašen pa ponovno stvoren u drugom oknu.
      if (registar.get(layer.id)?.sloj !== grupa) return;
      const gj = L.geoJSON(fc, {
        ...(okno ? { pane: okno } : {}),
        // Slojevi namjene nose boju po plohi, onu iz tumača znakova plana.
        // Bez toga bi cijela karta namjene bila jednobojna i beskorisna.
        style: (f) => {
          const p = f?.properties as
            | { boja?: string; promjena?: string; highway?: string }
            | undefined;
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
          // Katastar je jedini sloj kod kojeg klik ne pita „što je ovo”, nego
          // „što je sve ovdje” — pa umjesto vlastitih polja otvara dosje
          // sastavljen od svih slojeva. Ostali slojevi ostaju sami sebi.
          if (SLOJEVI_DOSJEA.has(layer.id)) {
            lyr.on("click", (e) => {
              const { lat, lng } = (e as LeafletNS.LeafletMouseEvent).latlng;
              const put = lyr as LeafletNS.Path;
              otvoriDosje(lat, lng, {
                istakni: () => {
                  put.setStyle(STIL_ODABRANO);
                  put.bringToFront();
                },
                // Vraćanje ide preko sloja koji je česticu i nacrtao —
                // izvorni stil dolazi iz `style` funkcije i drugdje ga
                // nemamo zapisanog.
                vrati: () => gj.resetStyle(put),
              });
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
                `<span style="color:#6b746d">${esc(razred)}` +
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
      console.warn(`Sloj ${layer.id} nije učitan:`, e);
    });
}

/** Slojevi kod kojih klik otvara dosje čestice umjesto vlastitih polja. */
const SLOJEVI_DOSJEA: ReadonlySet<string> = new Set([
  "katastar",
  "katastar-vlasnistvo",
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
  color: "#0f172a",
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
  "pointer-events-auto absolute inset-x-2 bottom-2 z-[1000] max-h-[62%] " +
  "overflow-y-auto rounded-xl border border-zinc-200 bg-white/97 shadow-lg " +
  "backdrop-blur";
const DOSJE_SAM =
  " sm:inset-x-auto sm:right-3 sm:top-[9rem] sm:bottom-3 sm:max-h-none " +
  "sm:w-[min(34rem,46vw)] lg:w-[min(44rem,48vw)]";
const DOSJE_UZ_KONTROLE =
  " lg:inset-x-auto lg:right-[15.5rem] lg:top-[5.5rem] lg:bottom-3 " +
  "lg:max-h-none lg:w-[min(34rem,40vw)]";

function DosjePlaca({
  uzKontrole,
  dosje,
  ucitavanje,
  greska,
  onClose,
}: {
  uzKontrole: boolean;
  dosje: Dosje | null;
  ucitavanje: boolean;
  greska: string | null;
  onClose: () => void;
}) {
  const c = dosje?.cestica;
  return (
    <aside
      className={
        DOSJE_SVUDA + (uzKontrole ? DOSJE_UZ_KONTROLE : DOSJE_SAM)
      }
      aria-label="Podaci o čestici"
    >
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white/97 px-4 py-3">
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
          className="-mr-1 -mt-1 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Zatvori"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        {ucitavanje && <p className="text-sm text-zinc-500">Skupljam podatke…</p>}
        {greska && <p className="text-sm text-rose-700">{greska}</p>}
        {dosje && !ucitavanje && (
          <>
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
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
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
                              <span className="text-xs text-zinc-400">
                                ×{st.broj}
                              </span>
                            )}
                            <span className="rounded bg-zinc-100 px-1 text-[10px] uppercase tracking-wide text-zinc-500">
                              {ODNOS_NATPIS[st.odnos]}
                            </span>
                            {st.poveznica && (
                              <a
                                href={st.poveznica}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-700 underline"
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
            <p className="mt-2 border-t border-zinc-200 pt-2 text-[11px] text-zinc-400">
              pretraženo {dosje.pretrazeno} slojeva
            </p>
          </>
        )}
      </div>
    </aside>
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
      )} kWh</b> godišnje po 1 kWp<br><span style="color:#6b746d">iradijacija ${data.irradiation.toLocaleString(
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
    .map(([k, ime]) => `${esc(ime)}: ${esc(vrijednostPolja(p[k]))}`);
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
    `<br><span style="color:#6b746d">${redci.join("<br>")}</span>`
  );
}

function popupPromjene(p: Record<string, unknown>): string {
  const ha = Number(p.povrsina_m2) / 1e4;
  const glava =
    `<b>${esc(p.iz_namjena)} → ${esc(p.u_namjena)}</b><br>` +
    `<span style="color:#6b746d">${esc(p.iz_kod)} → ${esc(p.u_kod)} · ` +
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
