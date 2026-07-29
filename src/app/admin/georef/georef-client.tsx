"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback } from "react";
import type * as LeafletNS from "leaflet";
import { KVART_CENTER } from "@/lib/map-views";

/** Jedan list plana spreman za ručno smještanje. */
export interface Preview {
  id: string;
  naziv: string;
  mjerilo: string;
  png: string;
  px_sirina: number;
  px_visina: number;
  pdf_x0: number;
  pdf_y0: number;
  pdf_sirina_pt: number;
  pdf_visina_pt: number;
  dpi: number;
}

/**
 * HTRS96/TM (EPSG:3765) ↔ WGS84, bez proj4 — transverzalna Merkatorova
 * projekcija s lon0 = 16,5°, k = 0,9999, x0 = 500000, GRS80.
 * Dovoljno točno za smještanje lista (odstupanje ispod centimetra).
 */
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const K0 = 0.9999;
const LON0 = (16.5 * Math.PI) / 180;
const X0 = 500000;

function toTM(lonDeg: number, latDeg: number): [number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const n = E2 / (1 - E2);
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  const t = Math.tan(lat);
  const c = n * Math.cos(lat) ** 2;
  const Aa = (lon - LON0) * Math.cos(lat);
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const M =
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * lat -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * lat) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * lat) -
      ((35 * e6) / 3072) * Math.sin(6 * lat));
  const x =
    K0 *
      N *
      (Aa +
        ((1 - t * t + c) * Aa ** 3) / 6 +
        ((5 - 18 * t * t + t ** 4 + 72 * c - 58 * n) * Aa ** 5) / 120) +
    X0;
  const y =
    K0 *
    (M +
      N *
        t *
        ((Aa * Aa) / 2 +
          ((5 - t * t + 9 * c + 4 * c * c) * Aa ** 4) / 24 +
          ((61 - 58 * t * t + t ** 4 + 600 * c - 330 * n) * Aa ** 6) / 720));
  return [x, y];
}

function fromTM(x: number, y: number): [number, number] {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const n = E2 / (1 - E2);
  const C1 = n * Math.cos(phi1) ** 2;
  const T1 = Math.tan(phi1) ** 2;
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const D = (x - X0) / (N1 * K0);
  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * n) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * n) * D ** 6) / 720);
  const lon =
    LON0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * n + 24 * T1 * T1) * D ** 5) /
        120) /
      Math.cos(phi1);
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

const BASES = [
  {
    id: "dof",
    label: "Ortofoto (DGU)",
    url: "https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms",
    layers: "OI.OrthoimageCoverage",
    wms: true,
  },
  {
    id: "osm",
    label: "Ulična karta",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    wms: false,
  },
] as const;

/** CSS vrti u smjeru kazaljke, a uklapanje mjeri suprotno — otud minus. */
function postaviZakret(ov: LeafletNS.ImageOverlay, stupnjeva: number) {
  const el = ov.getElement();
  if (!el) return;
  el.style.transformOrigin = "50% 50%";
  el.style.rotate = `${-stupnjeva}deg`;
}

export function GeorefClient({ previews }: { previews: Preview[] }) {
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const overlayRef = useRef<LeafletNS.ImageOverlay | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const [sel, setSel] = useState<Preview | null>(previews[0] ?? null);
  // Početak na 1:10000 (mjerilo otisnuto na nacrtu GUP-a) pri 100 dpi:
  // m/pt = 25,4/72 × 10 = 3,52778, a 1 px = 0,72 pt → 2,54 m po pikselu.
  const [mpp, setMpp] = useState((25.4 / 72) * 10 * (72 / 100));
  // Listovi GUP-a 2008. i 2015. nisu crtani sjeverno — bez zakreta se ne
  // mogu poklopiti nikakvim pomicanjem (1° preko 4 km je 70 m razlike).
  const [zakret, setZakret] = useState(0);
  const [origin, setOrigin] = useState<[number, number]>([490486, 4821697]); // gornji lijevi kut, EPSG:3765
  const [opacity, setOpacity] = useState(0.6);
  const [base, setBase] = useState<string>("osm");
  const [locked, setLocked] = useState(false);
  // Leaflet se učitava dinamički, pa efekti koji traže kartu moraju čekati
  // na ovu zastavicu — inače se izvedu dok je mapRef još null i nikad se
  // ne ponove (ovisnosti im se ne mijenjaju).
  const [ready, setReady] = useState(false);
  // "list" = plain drag moves the sheet (map panning is off), "karta" =
  // normal map panning. Modifier keys proved unreliable here: Leaflet
  // registers its drag handler first, so a Shift-based scheme kept losing
  // the race no matter how the event was intercepted.
  const [mode, setMode] = useState<"karta" | "list">("list");
  const [dragInfo, setDragInfo] = useState("spreman");

  /** Postavi/pomakni sliku prema trenutnom ishodištu i mjerilu. */
  const redraw = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !sel) return;
    const wM = sel.px_sirina * mpp;
    const hM = sel.px_visina * mpp;
    const [lonNW, latNW] = fromTM(origin[0], origin[1]);
    const [lonSE, latSE] = fromTM(origin[0] + wM, origin[1] - hM);
    const bounds = L.latLngBounds([latSE, lonNW], [latNW, lonSE]);
    const ov = overlayRef.current;
    // Sliku stvaramo jednom pa joj samo mičemo okvir. Ponovno stvaranje
    // sloja pri svakom pomaku miša značilo bi dekodiranje slike od ~10
    // milijuna piksela 60 puta u sekundi — sučelje bi se zaledilo i
    // izgledalo kao da povlačenje ne radi.
    if (ov && (ov as unknown as { _url: string })._url === sel.png) {
      ov.setBounds(bounds);
      ov.setOpacity(opacity);
      postaviZakret(ov, zakret);
      return;
    }
    if (ov) map.removeLayer(ov);
    const next = L.imageOverlay(sel.png, bounds, {
      opacity,
      interactive: false,
      className: "georef-overlay",
    });
    next.addTo(map);
    overlayRef.current = next;
    postaviZakret(next, zakret);
  }, [sel, mpp, origin, opacity, zakret]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !nodeRef.current || mapRef.current) return;
      LRef.current = L;
      // boxZoom je isključen jer Leaflet inače na shift+povuci crta pravokutnik
      // za zumiranje, a nama je shift+povuci pomicanje lista.
      const map = L.map(nodeRef.current, {
        zoomControl: true,
        boxZoom: false,
      }).setView(KVART_CENTER, 14);
      mapRef.current = map;
      redraw();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // podloga
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    map.eachLayer((l) => {
      if ((l as { _url?: string })._url && l !== overlayRef.current) {
        map.removeLayer(l);
      }
    });
    const b = BASES.find((x) => x.id === base)!;
    const layer = b.wms
      ? L.tileLayer.wms(b.url, {
          layers: (b as { layers: string }).layers,
          format: "image/png",
          transparent: false,
          version: "1.3.0",
        })
      : L.tileLayer(b.url, { maxZoom: 20 });
    layer.addTo(map);
    layer.bringToBack();
  }, [base, ready]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // povlačenje slike mišem po karti
  useEffect(() => {
    const map = mapRef.current;
    const node = nodeRef.current;
    if (!map || !node || !ready) return;

    const aktivno = mode === "list" && !locked;
    if (aktivno) map.dragging.disable();
    else map.dragging.enable();
    if (!aktivno) return;

    let dragging = false;
    let last: [number, number] | null = null;

    const down = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      const p = map.mouseEventToLatLng(e);
      last = toTM(p.lng, p.lat);
      setDragInfo("povlačim…");
      e.preventDefault();
    };
    const move = (e: MouseEvent) => {
      if (!dragging || !last) return;
      const p = map.mouseEventToLatLng(e);
      const cur = toTM(p.lng, p.lat);
      const dx = cur[0] - last[0];
      const dy = cur[1] - last[1];
      last = cur;
      setOrigin(([ox, oy]) => [ox + dx, oy + dy]);
    };
    const up = () => {
      if (dragging) setDragInfo("spreman");
      dragging = false;
      last = null;
    };

    node.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      node.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      map.dragging.enable();
    };
  }, [locked, ready, mode]);

  // tipkovnica: strelice pomiču, +/- mijenjaju mjerilo
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const step = e.shiftKey ? 25 : e.altKey ? 0.5 : 5;
      if (e.key === "ArrowLeft") setOrigin(([x, y]) => [x - step, y]);
      else if (e.key === "ArrowRight") setOrigin(([x, y]) => [x + step, y]);
      else if (e.key === "ArrowUp") setOrigin(([x, y]) => [x, y + step]);
      else if (e.key === "ArrowDown") setOrigin(([x, y]) => [x, y - step]);
      else if (e.key === "+" || e.key === "=")
        setMpp((m) => m * (e.shiftKey ? 1.01 : 1.001));
      else if (e.key === "-" || e.key === "_")
        setMpp((m) => m / (e.shiftKey ? 1.01 : 1.001));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked]);

  // izlaz: afina u obliku koji traži scripts/vectorize-plans.py
  const ptPerPx = sel ? 72 / sel.dpi : 0.72;
  // Jedan piksel slike je ptPerPx PDF točaka, pa se metri po pikselu
  // DIJELE s tim brojem da se dobiju metri po točki. (Prije je ovdje stajalo
  // množenje, pa je alat prijavljivao mjerilo promašeno za faktor dpi/72².)
  const SC = mpp / ptPerPx; // metara po PDF točki
  const OX = sel ? origin[0] - sel.pdf_x0 * SC : 0;
  const OY = sel
    ? origin[1] - (sel.pdf_y0 + sel.pdf_visina_pt) * SC
    : 0;
  // 1 pt na papiru = 25,4/72 mm; na terenu SC metara → nazivnik mjerila.
  const mjeriloIzUklapanja = SC ? (SC * 1000) / (25.4 / 72) : 0;
  // Zakret se zadaje oko središta slike, a skripta ga primjenjuje oko
  // ishodišta lista — pa se ovdje jednom preračuna u pomaknuto ishodište.
  const Cx = sel ? origin[0] + (sel.px_sirina * mpp) / 2 : 0;
  const Cy = sel ? origin[1] - (sel.px_visina * mpp) / 2 : 0;
  const rad = (zakret * Math.PI) / 180;
  const cosZ = Math.cos(rad);
  const sinZ = Math.sin(rad);
  const OXr = cosZ * (OX - Cx) - sinZ * (OY - Cy) + Cx;
  const OYr = sinZ * (OX - Cx) + cosZ * (OY - Cy) + Cy;

  const snippet = sel
    ? `# ${sel.naziv}\n# ručno smješteno na /admin/georef\n"mjerilo": ${Math.round(
        mjeriloIzUklapanja
      )},\n"afin": (${SC.toFixed(6)}, ${OXr.toFixed(2)}, ${OYr.toFixed(2)}),\n"zakret": ${zakret},`
    : "";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 lg:flex-row">
      <div className="flex-1 overflow-hidden rounded-lg border border-black/10">
        <div ref={nodeRef} className="h-full w-full" />
      </div>

      <aside className="w-full space-y-4 overflow-y-auto text-sm lg:w-96">
        <div>
          <label className="mb-1 block font-medium">List</label>
          <select
            className="w-full rounded border border-black/20 px-2 py-1"
            value={sel?.id ?? ""}
            onChange={(e) =>
              setSel(previews.find((p) => p.id === e.target.value) ?? null)
            }
          >
            {previews.map((p) => (
              <option key={p.id} value={p.id}>
                {p.naziv}
              </option>
            ))}
          </select>
          {sel && (
            <p className="mt-1 text-xs text-black/60">
              {sel.px_sirina}×{sel.px_visina} px · crtež {sel.pdf_sirina_pt}×
              {sel.pdf_visina_pt} pt · otisnuto mjerilo {sel.mjerilo}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block font-medium">Podloga</label>
          <div className="flex gap-2">
            {BASES.map((b) => (
              <button
                key={b.id}
                onClick={() => setBase(b.id)}
                className={`rounded border px-2 py-1 ${
                  base === b.id
                    ? "border-black bg-black text-white"
                    : "border-black/20"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Prozirnost lista: {Math.round(opacity * 100)} %
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Mjerilo: 1:{Math.round(mjeriloIzUklapanja)} ({SC.toFixed(4)} m/pt)
          </label>
          <input
            type="range"
            min={Math.log(0.2)}
            max={Math.log(12)}
            step={0.0005}
            value={Math.log(mpp)}
            onChange={(e) => setMpp(Math.exp(Number(e.target.value)))}
            className="w-full"
          />
          <div className="mt-1 flex gap-2">
            {[1000, 2000, 5000, 10000, 25000].map((d) => (
              <button
                key={d}
                onClick={() => setMpp((25.4 / 72) * (d / 1000) * ptPerPx)}
                className="rounded border border-black/20 px-2 py-0.5 text-xs"
              >
                1:{d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold">Zakret</span>
          <button
            onClick={() => setZakret((z) => Math.round((z - 0.05) * 100) / 100)}
            className="rounded border border-zinc-300 px-2 py-0.5"
          >
            −
          </button>
          <input
            type="number"
            step="0.05"
            value={zakret}
            onChange={(e) => setZakret(Number(e.target.value) || 0)}
            className="w-20 rounded border border-zinc-300 px-1 py-0.5 text-right tabular-nums"
          />
          <span className="text-zinc-500">°</span>
          <button
            onClick={() => setZakret((z) => Math.round((z + 0.05) * 100) / 100)}
            className="rounded border border-zinc-300 px-2 py-0.5"
          >
            +
          </button>
          <button
            onClick={() => setZakret(0)}
            className="rounded border border-zinc-300 px-2 py-0.5 text-zinc-500"
          >
            0
          </button>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => setLocked(e.target.checked)}
          />
          Zaključaj list (da ga ne pomakneš slučajno)
        </label>

        <div>
          <label className="mb-1 block font-medium">Što povlačenje pomiče</label>
          <div className="flex gap-2">
            {(["list", "karta"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded border px-3 py-1 ${
                  mode === m
                    ? "border-black bg-black text-white"
                    : "border-black/20"
                }`}
              >
                {m === "list" ? "List plana" : "Kartu"}
              </button>
            ))}
            <span className="self-center text-xs text-black/50">{dragInfo}</span>
          </div>
        </div>

        <div className="rounded bg-black/5 p-3 text-xs leading-relaxed">
          <p className="font-medium">Kako se koristi</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              U načinu <b>List plana</b> povlačenje mišem pomiče list. Za
              pomicanje karte prebaci na <b>Kartu</b>.
            </li>
            <li>
              <b>Strelice</b> — pomak 5 m; <b>Shift</b> 25 m; <b>Alt</b> 0,5 m.
            </li>
            <li>
              <b>+ / −</b> — fino mjerilo; sa <b>Shift</b> grublje.
            </li>
            <li>
              Ako je mjerilo otisnuto na listu, klikni gumb s tim mjerilom i
              onda samo pomiči — mjerilo više ne diraj.
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-1 font-medium">
            Ishodište (gornji lijevi kut, EPSG:3765)
          </p>
          <p className="font-mono text-xs">
            E {origin[0].toFixed(1)} · N {origin[1].toFixed(1)}
          </p>
        </div>

        <div>
          <p className="mb-1 font-medium">
            Za scripts/vectorize-plans.py
          </p>
          <textarea
            readOnly
            value={snippet}
            rows={5}
            className="w-full rounded border border-black/20 bg-white p-2 font-mono text-xs"
          />
          <button
            onClick={() => navigator.clipboard?.writeText(snippet)}
            className="mt-2 rounded bg-black px-3 py-1 text-white"
          >
            Kopiraj afinu
          </button>
        </div>
      </aside>
    </div>
  );
}
