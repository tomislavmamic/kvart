"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";

const groups = {
  "stop-candidate": { label: "Kandidati za stajališta", color: "#007956" },
  "stop-earlier": { label: "Ranije razmotrene lokacije", color: "#71717b" },
  "stop-rejected": { label: "Ukrcaj za preseljenje", color: "#a30037" },
  "public-parcel": { label: "Javno zemljište · GIS evidencija", color: "#005986" },
  "recreation-zone": { label: "Rekreativna zona", color: "#657b27" },
  "existing-road": { label: "Postojeće ceste · nisu potvrđena autobusna trasa", color: "#71717b" },
  "planned-road": { label: "Planirani kolnici DPU-a", color: "#953d00" },
  "approach-direction": { label: "Prilaz iz radne zone · smjer", color: "#007956" },
  "dpu-entry": { label: "Ulaz u Bilice prikazan u DPU-u", color: "#005986" },
  "existing-sidewalk": { label: "Evidentirani nogostupi", color: "#005986" },
  "existing-crossing": { label: "Evidentirani prijelazi", color: "#005986" },
} as const;

export function SchoolBusMap() {
  const container = useRef<HTMLDivElement>(null);
  const controls = useRef<{ overview: () => void; focus: (id: string) => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [stops, setStops] = useState<{ id: string; label: string }[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    let map: import("leaflet").Map | undefined;
    async function setup() {
      const [L, response] = await Promise.all([
        import("leaflet"),
        fetch("/geo/prijedlozi/skolski-autobus.geojson", { signal: abort.signal }),
      ]);
      if (!response.ok) throw new Error("Podaci nisu dostupni");
      const data: FeatureCollection = await response.json();
      if (abort.signal.aborted || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false });
      const streets = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20,
      }).addTo(map);
      const aerial = L.tileLayer.wms("https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms", {
        layers: "OI.OrthoimageCoverage", format: "image/png", version: "1.1.1",
        crs: L.CRS.EPSG4326, maxZoom: 21, attribution: "DOF 2023 © DGU · Otvorena dozvola",
      });
      const layers = Object.fromEntries(Object.entries(groups).map(([role, value]) => [role, { ...value, layer: L.featureGroup() }]));
      const stopLayers = new Map<string, { layer: import("leaflet").Layer; latlng: import("leaflet").LatLng }>();
      const choices: { id: string; label: string }[] = [];
      for (const feature of data.features) {
        const properties = feature.properties ?? {};
        const role = String(properties.role);
        const group = layers[role];
        if (!group) continue;
        const isStop = role.startsWith("stop-");
        const layer = L.geoJSON(feature, {
          style: {
            color: group.color, weight: role === "approach-direction" || role === "dpu-entry" ? 4 : role === "existing-road" ? 2 : 1.5,
            opacity: role === "existing-road" ? 0.65 : 0.9,
            fillOpacity: role === "public-parcel" ? 0.12 : 0.18,
            dashArray: role === "planned-road" || role === "approach-direction" ? "6 5" : undefined,
          },
          pointToLayer: (_, latlng) => L.circleMarker(latlng, {
            radius: isStop ? 10 : 5, color: "#fff", weight: 3,
            fillColor: group.color, fillOpacity: 1,
          }),
        });
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = String(properties.label ?? group.label);
        popup.append(title);
        for (const field of ["evidence", "reason", "direction"]) {
          if (properties[field]) {
            const text = document.createElement("p");
            text.textContent = String(properties[field]);
            popup.append(text);
          }
        }
        layer.bindPopup(popup).addTo(group.layer);
        if (role === "approach-direction" && feature.geometry.type === "LineString") {
          const coordinates = feature.geometry.coordinates;
          const [lng, lat] = coordinates[coordinates.length - 1];
          const [previousLng, previousLat] = coordinates[coordinates.length - 2];
          const angle = Math.atan2((lng - previousLng) * Math.cos(lat * Math.PI / 180), lat - previousLat) * 180 / Math.PI;
          const arrow = document.createElement("span");
          arrow.textContent = "▲";
          arrow.style.cssText = `display:block;color:#007956;font-size:24px;line-height:24px;transform:rotate(${angle}deg);text-shadow:0 0 3px white`;
          L.marker([lat, lng], { icon: L.divIcon({ html: arrow, className: "", iconSize: [24, 24], iconAnchor: [12, 12] }), keyboard: false, interactive: false }).addTo(group.layer);
        }
        if (isStop && feature.geometry.type === "Point") {
          const id = String(properties.candidate_id);
          layer.bindTooltip(id, { permanent: true, direction: "top", className: "!border-0 !bg-white !font-bold !text-sm !shadow-none" });
          if (role === "stop-candidate") {
            const [lng, lat] = feature.geometry.coordinates;
            stopLayers.set(id, { layer, latlng: L.latLng(lat, lng) });
            choices.push({ id, label: String(properties.label) });
          }
        }
      }
      // Context first, stop markers last so candidates remain easy to select.
      for (const role of ["public-parcel", "recreation-zone", "existing-road", "planned-road", "dpu-entry", "approach-direction", "stop-rejected", "stop-candidate"]) {
        layers[role].layer.addTo(map);
      }
      L.control.layers({ "Ulična karta": streets, "Ortofoto 2023": aerial },
        Object.fromEntries(Object.values(layers).map(({ label, layer }) => [label, layer]))).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);
      const bounds = L.featureGroup([layers["stop-candidate"].layer, layers["approach-direction"].layer]).getBounds();
      const instance = map;
      controls.current = {
        overview: () => { if (bounds.isValid()) instance.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 }); },
        focus: (id) => {
          const stop = stopLayers.get(id);
          if (stop) { instance.setView(stop.latlng, 18); stop.layer.openPopup(); }
        },
      };
      controls.current.overview();
      setStops(choices);
      setStatus("ready");
    }
    setup().catch(() => { if (!abort.signal.aborted) setStatus("error"); });
    return () => { abort.abort(); controls.current = null; map?.remove(); };
  }, []);

  return <div>
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Pogledi na stajališta">
      <button type="button" disabled={status !== "ready"} aria-pressed={!selected} onClick={() => { controls.current?.overview(); setSelected(""); }} className={`fokus min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-50 ${!selected ? "border-maslina bg-maslina text-white" : "border-kamen-rub bg-white"}`}>Sve lokacije</button>
      {stops.map((stop) => <button key={stop.id} type="button" aria-pressed={selected === stop.id} onClick={() => { controls.current?.focus(stop.id); setSelected(stop.id); }} className={`fokus min-h-11 rounded-full border px-4 text-sm font-semibold ${selected === stop.id ? "border-maslina bg-maslina text-white" : "border-kamen-rub bg-white"}`}>{stop.id} · {stop.label}</button>)}
    </div>
    <div ref={container} role="region" aria-label="Karta kandidata školskih autobusnih stajališta u Bilicama i Dračevcu, javnih čestica i planiranih cesta" className="relative z-0 h-[440px] rounded-xl bg-kamen-tlo sm:h-[580px]" />
    {status === "loading" && <p role="status" className="mt-3 text-sm text-kamen-tekst">Učitavam lokacije i javne čestice…</p>}
    {status === "error" && <p role="alert" className="mt-3 text-sm text-kamen-tekst">Interaktivna karta nije dostupna. Lokacije, čestice i ograničenja navedeni su i u tekstu prijedloga. <a className="fokus underline" href="/prijedlozi/skolski-autobus.svg">Otvori preglednu kartu</a>.</p>}
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-kamen-tekst">{Object.entries(groups).filter(([key]) => !key.startsWith("existing-") && key !== "stop-earlier").map(([key, group]) => <span key={key} className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />{group.label}</span>)}</div>
    <p className="mt-3 text-sm leading-6 text-kamen-tekst">R1 i N1 su dvije mogućnosti za jedno stajalište Dračevca; B2 je zaseban prijedlog uz planski ulaz u Bilice. Strelica prikazuje smjer dolaska iz radne zone, ne proračun skretanja. Smeđe plohe su planirani kolnici. Ranije lokacije B1 i D1 možete uključiti u izborniku slojeva.</p>
  </div>;
}
