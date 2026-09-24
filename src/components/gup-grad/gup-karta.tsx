"use client";

/**
 * Karta provjere GUP-a na /gup (zadani prikaz): cijeli grad, svaka
 * katastarska čestica razvrstana istim izračunom kao grafikon.
 *
 * Karta uzima cijeli prozor, kao /karta: traka stranice postaje plutajući
 * izbornik gore lijevo. Postavke su u lijevoj ploči, legenda u desnoj; obje
 * su na početku sklopljene, da se prvo vidi grad.
 *
 * Sama karta je tanka — podloga, službeni list plana za usporedbu i adresa
 * (`c`, `z`) za duboke poveznice. Slojeve čestica, zgrada i slike namjene,
 * skočne prozore i prijedloge ispravka nosi useGupProvjera
 * (gup-provjera.tsx), a sadržaj ploča GupProvjeraPostavke i GupProvjeraLegenda.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as LeafletNS from "leaflet";

import {
  GupProvjeraLegenda,
  GupProvjeraPostavke,
  useGupProvjera,
  type GupPostavke,
} from "@/components/gup-grad/gup-provjera";
import { PlutajuciIzbornik } from "@/components/site-header";
import { BASE_LAYERS, GUP_GRAD_BOUNDS, OVERLAY_LAYERS, SIRI_OBUHVAT_KARTE } from "@/lib/map-views";

/** Središte grada kad adresa ne kaže drugo. */
const SREDISTE: [number, number] = [43.5125, 16.455];
const PODLOGE = ["dof", "karta"] as const;
type Podloga = (typeof PODLOGE)[number];
/** Službeni ISPU list namjene (plan na snazi) — isti sloj kao na /karta. */
const SLUZBENI = OVERLAY_LAYERS.find((l) => l.id === "gup-namjena");

/** Pločica WMS podloge kroz naš posrednik (src/app/api/podloga) — kao na /karta. */
const WMS_PLOCICA = 512;

function podlogaSloj(L: typeof LeafletNS, id: Podloga): LeafletNS.TileLayer {
  const b = BASE_LAYERS.find((x) => x.id === id)!;
  const zajednicko = { attribution: b.attribution, maxZoom: 19, bounds: SIRI_OBUHVAT_KARTE };
  return b.type === "wms"
    ? L.tileLayer(`/api/podloga/${b.id}/{z}/{x}/{y}`, { ...zajednicko, tileSize: WMS_PLOCICA, zoomOffset: -1 })
    : L.tileLayer(b.url, { ...zajednicko, subdomains: "abcd" });
}

/** Središte i zum iz adrese (`c=lat,lng&z=16`), ako su u obuhvatu GUP-a. */
function izAdrese(): { sredina?: [number, number]; zum?: number } {
  const q = new URLSearchParams(window.location.search);
  const [lat, lng] = (q.get("c") ?? "").split(",").map(Number);
  const z = Number(q.get("z"));
  const [[jug, zapad], [sjever, istok]] = GUP_GRAD_BOUNDS;
  const u = Number.isFinite(lat) && Number.isFinite(lng) && lat > jug && lat < sjever && lng > zapad && lng < istok;
  return { sredina: u ? [lat, lng] : undefined, zum: z >= 12 && z <= 19 ? z : undefined };
}

export function GupKarta(props: {
  postavke: GupPostavke;
  onPostavke: (p: GupPostavke) => void;
  /** Prekidač Grafikon / Karta čestica — pluta gore desno. */
  prekidac: ReactNode;
}) {
  const div = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const pogodakSloja = useRef(0);
  const [spremno, setSpremno] = useState(false);
  const [podloga, setPodloga] = useState<Podloga>("dof");
  const [sluzbeni, setSluzbeni] = useState(false);
  const [lijeva, setLijeva] = useState(false);
  const [desna, setDesna] = useState(false);

  // Karta je cijeli prozor: stranica ispod ne smije se listati.
  useEffect(() => {
    const prije = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prije;
    };
  }, []);

  useEffect(() => {
    let otkazano = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (otkazano || !div.current) return;
      LRef.current = L;
      const adr = izAdrese();
      const map = L.map(div.current, {
        center: adr.sredina ?? SREDISTE,
        zoom: adr.zum ?? 13,
        minZoom: 12,
        maxZoom: 19,
        maxBounds: SIRI_OBUHVAT_KARTE,
        // ~41 000 čestica kao SVG bi zagušilo DOM
        preferCanvas: true,
        zoomControl: false,
      });
      // dolje lijevo: dolje desno je plutajući gumb razgovora, gore su ploče
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      // bez mjesta u adresi: cijeli obuhvat GUP-a
      if (!adr.sredina) map.fitBounds(GUP_GRAD_BOUNDS);
      // središte i zum u adresu, bez novog zapisa u povijesti
      map.on("moveend", () => {
        const c = map.getCenter();
        const u = new URL(window.location.href);
        u.searchParams.set("c", `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`);
        u.searchParams.set("z", String(map.getZoom()));
        window.history.replaceState(window.history.state, "", u);
      });
      mapRef.current = map;
      setSpremno(true);
    })();
    return () => {
      otkazano = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setSpremno(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L) return;
    const sloj = podlogaSloj(L, podloga).addTo(map);
    sloj.bringToBack();
    return () => {
      sloj.remove();
    };
  }, [spremno, podloga]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !sluzbeni || !SLUZBENI || SLUZBENI.type !== "wms") return;
    const sloj = L.tileLayer
      .wms(SLUZBENI.url, {
        layers: SLUZBENI.wmsLayers,
        format: "image/png",
        transparent: true,
        opacity: 0.7,
        crs: L.CRS.EPSG4326,
        attribution: SLUZBENI.attribution,
      })
      .addTo(map);
    return () => {
      sloj.remove();
    };
  }, [spremno, sluzbeni]);

  const info = useGupProvjera({ mapRef, LRef, spremno, aktivno: true, postavke: props.postavke, pogodakSloja });

  const gumb = (aktivan: boolean) =>
    `fokus meta-cip rounded-full border px-2.5 py-1 text-xs font-semibold ${
      aktivan ? "border-maslina bg-maslina text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
    }`;
  const plutajuci = "fokus rounded-full border border-kamen-tlo bg-white px-4 py-2 text-sm font-semibold shadow-lg hover:bg-zinc-50";
  // lijeva ploča staje iznad gumba za zum (dolje lijevo)
  const ploca =
    "absolute top-[4.25rem] z-[1010] flex w-[min(20rem,calc(100%-1.5rem))] flex-col rounded-xl border border-zinc-200 bg-white shadow-xl";
  const zaglavlje = (naslov: string, zatvori: () => void) => (
    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
      <h2 className="text-sm font-bold">{naslov}</h2>
      <button type="button" onClick={zatvori} className="fokus -mr-2 rounded-full px-2 text-lg leading-none text-zinc-500 hover:bg-zinc-100" aria-label={`Sklopi: ${naslov}`}>
        ×
      </button>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[1100] bg-zinc-100">
      <PlutajuciIzbornik />
      <div ref={div} className="absolute inset-0" role="region" aria-label="Karta provjere GUP-a" />

      <div className="absolute right-3 top-3 z-[1010] rounded-lg shadow-lg">{props.prekidac}</div>

      {lijeva ? (
        <aside id="gup-postavke" className={`${ploca} left-3 max-h-[calc(100%-10rem)]`} aria-label="Postavke karte">
          {zaglavlje("Postavke", () => setLijeva(false))}
          <div className="overflow-y-auto px-4 py-3">
            <GupProvjeraPostavke postavke={props.postavke} onPostavke={props.onPostavke}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Podloga</p>
                <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Podloga">
                  {PODLOGE.map((id) => (
                    <button key={id} type="button" aria-pressed={podloga === id} onClick={() => setPodloga(id)} className={gumb(podloga === id)}>
                      {id === "dof" ? "Ortofoto 2023." : "Ulična karta"}
                    </button>
                  ))}
                </div>
                {SLUZBENI && (
                  <label className="meta mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={sluzbeni} onChange={(e) => setSluzbeni(e.target.checked)} />
                    Službeni list GUP-a (ISPU, plan na snazi)
                  </label>
                )}
              </div>
            </GupProvjeraPostavke>
          </div>
        </aside>
      ) : (
        <button type="button" onClick={() => setLijeva(true)} aria-expanded={false} aria-controls="gup-postavke" className={`absolute left-3 top-[4.25rem] z-[1010] ${plutajuci}`}>
          Postavke
        </button>
      )}

      {desna ? (
        <aside id="gup-legenda" className={`${ploca} right-3 max-h-[calc(100%-5.5rem)]`} aria-label="Legenda karte">
          {zaglavlje("Legenda", () => setDesna(false))}
          <div className="overflow-y-auto px-4 py-3">
            <GupProvjeraLegenda postavke={props.postavke} info={info} />
          </div>
        </aside>
      ) : (
        <button type="button" onClick={() => setDesna(true)} aria-expanded={false} aria-controls="gup-legenda" className={`absolute right-3 top-[4.25rem] z-[1010] ${plutajuci}`}>
          Legenda
        </button>
      )}

      {/* Kad je legenda sklopljena, poruka o zumu ne smije nestati s njom. */}
      {!desna && info.zum > 0 && info.zum < 15 && props.postavke.cestice && (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-[1010] -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs text-zinc-700 shadow">
          Približi kartu da se učitaju čestice
        </p>
      )}
    </div>
  );
}
