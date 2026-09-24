"use client";

/**
 * Karta provjere GUP-a na /gup (prikaz „Karta”): cijeli grad, svaka
 * katastarska čestica razvrstana istim izračunom kao grafikon.
 *
 * Sama karta je tanka — podloga, službeni list plana za usporedbu i adresa
 * (`c`, `z`) za duboke poveznice. Slojeve čestica, zgrada i slike namjene,
 * skočne prozore i prijedloge ispravka nosi useGupProvjera
 * (gup-provjera.tsx); ploču s legendom GupProvjeraPloca.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";

import { GupProvjeraPloca, useGupProvjera, type GupPostavke } from "@/components/gup-grad/gup-provjera";
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

export function GupKarta(props: { postavke: GupPostavke; onPostavke: (p: GupPostavke) => void }) {
  const div = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const pogodakSloja = useRef(0);
  const [spremno, setSpremno] = useState(false);
  const [podloga, setPodloga] = useState<Podloga>("dof");
  const [sluzbeni, setSluzbeni] = useState(false);

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
      L.control.zoom({ position: "topright" }).addTo(map);
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
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div
        ref={div}
        className="h-[70vh] min-h-[26rem] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
        role="region"
        aria-label="Karta provjere GUP-a"
      />
      <div className="lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
        <div className="text-sm">
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
        <GupProvjeraPloca postavke={props.postavke} onPostavke={props.onPostavke} info={info} />
      </div>
    </div>
  );
}
