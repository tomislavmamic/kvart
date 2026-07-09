"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import {
  BASE_LAYERS,
  OVERLAY_LAYERS,
  MAP_VIEWS,
  KVART_CENTER,
  type OverlayLayer,
} from "@/lib/map-views";

const OVERLAY_BY_ID = new Map(OVERLAY_LAYERS.map((l) => [l.id, l]));

export function MapClient() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const baseRef = useRef<LeafletNS.TileLayer | null>(null);
  const overlayInstances = useRef<Map<string, LeafletNS.Layer>>(new Map());
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
  const [panelOpen, setPanelOpen] = useState(false);

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
        zoomControl: true,
        attributionControl: true,
      });
      map.setMaxBounds([
        [43.505, 16.46],
        [43.545, 16.53],
      ]);
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

  // ---- sync overlays with activeIds ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    // remove no-longer-active
    for (const [id, inst] of overlayInstances.current) {
      if (!activeIds.has(id)) {
        map.removeLayer(inst);
        overlayInstances.current.delete(id);
      }
    }
    // add newly-active
    for (const id of activeIds) {
      if (overlayInstances.current.has(id)) continue;
      const layer = OVERLAY_BY_ID.get(id);
      if (!layer || layer.phase !== 1) continue;
      if (layer.type === "api") continue; // handled separately (solar)
      addOverlay(L, map, layer);
    }
    // solar click handler
    const solarActive = activeIds.has("solar");
    if (solarActive && !solarHandler.current) {
      const handler = (e: LeafletNS.LeafletMouseEvent) =>
        showSolar(L, map, e.latlng);
      map.on("click", handler);
      solarHandler.current = handler;
      map.getContainer().style.cursor = "crosshair";
    } else if (!solarActive && solarHandler.current) {
      map.off("click", solarHandler.current);
      solarHandler.current = null;
      map.getContainer().style.cursor = "";
    }
  }, [activeIds, ready]);

  function addOverlay(
    L: typeof LeafletNS,
    map: LeafletNS.Map,
    layer: OverlayLayer
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
      overlayInstances.current.set(layer.id, wms);
      return;
    }
    // geojson — lazy fetch + cache
    const placeholder = L.layerGroup().addTo(map);
    overlayInstances.current.set(layer.id, placeholder);
    loadGeoJSON(layer.url)
      .then((fc) => {
        if (!overlayInstances.current.has(layer.id)) return; // toggled off meanwhile
        const gj = L.geoJSON(fc, {
          style: () => ({
            color: layer.color,
            weight: 2,
            fillColor: layer.color,
            fillOpacity: 0.25,
          }),
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
            const label =
              p.naziv ?? p.geografskoime ?? p.name ?? p.NAZIV ?? null;
            if (label) lyr.bindPopup(String(label));
          },
        });
        gj.addTo(placeholder);
      })
      .catch(() => {});
  }

  async function loadGeoJSON(url: string): Promise<GeoJSON.FeatureCollection> {
    const cached = geojsonCache.current.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    geojsonCache.current.set(url, fc);
    return fc;
  }

  async function showSolar(
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

  // ---- UI actions ----
  function selectView(id: string) {
    const view = MAP_VIEWS.find((v) => v.id === id);
    if (!view) return;
    setViewId(id);
    setActiveIds(new Set(phase1(view.layerIds)));
    setPanelOpen(false);
  }
  function toggleLayer(id: string) {
    setActiveIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const currentView = MAP_VIEWS.find((v) => v.id === viewId);
  const legendLayers = [...activeIds]
    .map((id) => OVERLAY_BY_ID.get(id))
    .filter((l): l is OverlayLayer => Boolean(l) && l!.phase === 1);

  return (
    <div className="relative">
      {/* view chips */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {MAP_VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => selectView(v.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              v.id === viewId
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
            panelOpen
              ? "border-zinc-700 bg-zinc-800 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          ⚙ Prilagodi
        </button>
      </div>
      {currentView && !panelOpen && (
        <p className="pb-3 text-sm text-zinc-500">{currentView.description}</p>
      )}

      <div className="relative overflow-hidden rounded-xl border border-zinc-200">
        <div
          ref={mapDiv}
          className="h-[62vh] min-h-[420px] w-full bg-zinc-100"
        />

        {/* base switch */}
        <div className="absolute right-3 top-3 z-[500] flex gap-1 rounded-lg bg-white/90 p-1 text-xs shadow">
          {BASE_LAYERS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBaseId(b.id)}
              className={`rounded px-2 py-1 font-medium ${
                b.id === baseId
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* legend */}
        {legendLayers.length > 0 && (
          <div className="absolute bottom-6 left-3 z-[500] max-w-[220px] rounded-lg bg-white/92 p-3 text-xs shadow">
            <p className="mb-1 font-bold uppercase tracking-wide text-zinc-500">
              {currentView?.label ?? "Slojevi"}
            </p>
            {legendLayers.map((l) => (
              <div key={l.id} className="flex items-center gap-2 py-0.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: l.color }}
                />
                <span className="text-zinc-700">{l.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* customization panel */}
        {panelOpen && (
          <div className="absolute inset-y-0 left-0 z-[600] w-72 max-w-[80%] overflow-y-auto border-r border-zinc-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Svi slojevi</h3>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Zatvori
              </button>
            </div>
            <LayerPanel activeIds={activeIds} onToggle={toggleLayer} />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Simulirani prikaz koristi službene otvorene servise (DGU, ISPU/MGIPU,
        Hrvatske vode, Copernicus, Promet Split, HAKOM…). Puni popis izvora i
        licenci na stranici{" "}
        <a href="/podaci" className="underline">
          Prostorni podaci
        </a>
        .
      </p>
    </div>
  );
}

// group overlays by section for the panel
function LayerPanel({
  activeIds,
  onToggle,
}: {
  activeIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      {OVERLAY_LAYERS.map((l) => (
        <label
          key={l.id}
          className={`flex items-start gap-2 ${
            l.phase === 2 ? "opacity-45" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={activeIds.has(l.id)}
            disabled={l.phase === 2}
            onChange={() => onToggle(l.id)}
            className="mt-0.5 accent-emerald-600"
          />
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: l.color }}
            />
            <span>
              {l.label}
              {l.phase === 2 && (
                <span className="ml-1 text-xs text-zinc-400">(uskoro)</span>
              )}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function phase1(ids: string[]): string[] {
  return ids.filter((id) => OVERLAY_BY_ID.get(id)?.phase === 1);
}
