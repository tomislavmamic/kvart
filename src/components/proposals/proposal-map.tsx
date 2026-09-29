"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";

const COLORS: Record<string, string> = {
  "recreation-zone": "#657b27",
  parcel: "#71717b",
  "road-parcel": "#ea580c",
  "project-parcel": "#a16207",
  "unresolved-road-parcels": "#e11d48",
  "proposal-cageball": "#005f46",
  "proposal-gym": "#b65e37",
  "proposal-playground": "#b58938",
  "proposal-parking": "#64748b",
  "proposal-path": "#a78a53",
  "proposal-promenade": "#729353",
  "proposal-canopy": "#5a893c",
  "retained-trees": "#285c35",
  "terrain-edge": "#795548",
  playground: "#a16207",
  workout: "#a16207",
  "proposed-tree": "#007956",
  road: "#71717b",
  "existing-sidewalk": "#0284c7",
  "planned-sidewalk": "#b45309",
  "tree-conflict": "#a30037",
  infrastructure: "#a30037",
  "dpu-sidewalk": "#7c3aed",
  "dpu-road": "#64748b",
  "dpu-boundary": "#52525b",
  "obligation-plot": "#7e22ce",
  "obligation-tree": "#7e22ce",
};

const NETWORK_COLORS: Record<string, string> = {
  vodovod: "#0ea5e9", "vodovod-kanali": "#0ea5e9", vodoopskrba: "#0ea5e9",
  odvodnja: "#a16207", "odvodnja-tlacni": "#a16207", oborinska: "#0891b2",
  "struja-nn": "#dc2626", "struja-sn": "#dc2626", "struja-vn-110": "#dc2626", struja: "#dc2626",
  "telekom-ht-podzemno": "#c026d3", "telekom-trase": "#c026d3", telekom: "#c026d3",
  plin: "#f59e0b",
};

const LABELS: Record<string, string> = {
  "recreation-zone": "Zona R2 iz prijedloga GUP-a",
  parcel: "Katastarske čestice — okolica",
  "road-parcel": "Cestovne katastarske čestice",
  "project-parcel": "Čestice rekreativne zone",
  "unresolved-road-parcels": "Trasa bez potvrđene cestovne čestice",
  "proposal-cageball": "Prijedlog · cageball",
  "proposal-gym": "Prijedlog · teretana na otvorenom",
  "proposal-playground": "Prijedlog · dječja igra",
  "proposal-parking": "Prijedlog · 3 parkirna mjesta",
  "proposal-path": "Prijedlog · pješačka veza",
  "proposal-promenade": "Prijedlog · zelena šetnica umjesto bočne ceste",
  "proposal-canopy": "Prijedlog · buduće velike krošnje (ilustracija)",
  "retained-trees": "Zadržati postojeću sadnju · približni položaji",
  "terrain-edge": "Postojeći teren · viša cesta i zid",
  playground: "Evidentirana oprema igrališta",
  workout: "Evidentirano vježbalište",
  "proposed-tree": "Prijedlog položaja stabla — potrebna terenska provjera",
  road: "Cijela trasa postojeće ceste",
  "existing-sidewalk": "Postojeći nogostupi — gradski sloj",
  "planned-sidewalk": "Dionice bez evidentiranog nogostupa",
  "tree-conflict": "Sadna mjesta blizu instalacija — prilagoditi",
  infrastructure: "Evidentirana infrastruktura",
  "dpu-sidewalk": "DPU — planirani nogostupi",
  "dpu-road": "DPU — kolnici",
  "dpu-boundary": "Granica DPU-a",
  "obligation-plot": "Čestice čiji su vlasnici dužni saditi",
  "obligation-tree": "Dugovana stabla",
};

const PLACEMENTS: Record<string, string> = { plan: "ucrtana u DPU-u", ilustracija: "po GUP-u, položaj je prijedlog" };

const LEVELS: Record<string, string> = { surface: "razina terena", upper: "gornja razina", lower: "donja razina" };
const PLAN_STATUS: Record<string, string> = {
  planned: "U DPU-u označeno kao planirano",
  "existing-source-plan": "U DPU-u označeno kao postojeće",
  "mixed-source-plan": "DPU zajedno prikazuje postojeće i planirane vodove",
  "source-plan": "DPU ne razdvaja postojeće i planirano u ovom sloju",
};

/** `extraUrls`: dodatni slojevi iste karte, npr. obveze sadnje uz nogostupe. */
export function ProposalMap({ url, extraUrls = [], label, sidewalks = false }: { url: string; extraUrls?: string[]; label: string; sidewalks?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const views = useRef<{ target: () => void; plan: () => void } | null>(null);
  const [error, setError] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);

  // Niz se svakim iscrtavanjem stvara iznova; efekt ovisi o sadržaju, ne o nizu.
  const extraKey = extraUrls.join("\n");

  useEffect(() => {
    const abort = new AbortController();
    const extra = extraKey ? extraKey.split("\n") : [];
    let map: import("leaflet").Map | undefined;
    async function setup() {
      const [L, responses] = await Promise.all([
        import("leaflet"),
        Promise.all([url, ...extra].map((u) => fetch(u, { signal: abort.signal }))),
      ]);
      if (responses.some((r) => !r.ok)) throw new Error("Geometrija nije dostupna");
      const collections: FeatureCollection[] = await Promise.all(responses.map((r) => r.json()));
      const data: FeatureCollection = { type: "FeatureCollection", features: collections.flatMap((c) => c.features) };
      if (abort.signal.aborted || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false });
      const streets = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20,
      });
      const aerial = L.tileLayer.wms("https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms", {
        layers: "OI.OrthoimageCoverage", format: "image/png", version: "1.1.1",
        crs: L.CRS.EPSG4326, maxZoom: 21,
        attribution: "DOF 2023 © DGU · Otvorena dozvola",
      });
      aerial.addTo(map);
      map.createPane("parcels").style.zIndex = "410";
      map.createPane("utilities").style.zIndex = "420";
      map.createPane("canopies").style.zIndex = "430";
      map.createPane("obligations").style.zIndex = "435";
      map.createPane("planting").style.zIndex = "440";
      const groups: Record<string, import("leaflet").FeatureGroup> = {};
      const proposalGroups = new Set<string>();
      for (const feature of data.features) {
        const p = feature.properties ?? {};
        const role = p.screen_result === "conflict" ? "tree-conflict" : String(p.role);
        const plannedNetwork = p.network_status === "dpu-plan";
        const name = role === "infrastructure"
          ? `${String(p.label ?? "Instalacije").replace(/^DPU · /, "")} · ${plannedNetwork ? "DPU" : "gradska evidencija"}`
          : `${LABELS[role] ?? role}${["dpu-sidewalk", "dpu-road"].includes(role) && p.level ? ` · ${LEVELS[p.level] ?? p.level}` : ""}${role === "obligation-tree" && p.placement ? ` · ${PLACEMENTS[p.placement] ?? p.placement}` : ""}`;
        const group = groups[name] ??= L.featureGroup();
        if (role.startsWith("proposal-") || ["recreation-zone", "retained-trees", "proposed-tree", "tree-conflict", "planned-sidewalk", "obligation-plot", "obligation-tree"].includes(role)) proposalGroups.add(name);
        const color = role === "infrastructure"
          ? NETWORK_COLORS[String(p.network).replace(/^dpu-/, "")] ?? "#a30037"
          : COLORS[role] ?? "#a30037";
        const isParcel = ["parcel", "road-parcel", "project-parcel"].includes(role);
        const obligation = role.startsWith("obligation-");
        const pane = role === "proposal-canopy" ? "canopies" : obligation ? "obligations" : role === "infrastructure" ? "utilities" : p.candidate_id ? "planting" : isParcel ? "parcels" : "overlayPane";
        const layer = L.geoJSON(feature, {
          pane,
          style: { pane, color, weight: role === "existing-sidewalk" ? 4 : role === "road-parcel" ? 3 : role === "dpu-road" || role === "parcel" ? 1 : 2, fillOpacity: role === "proposal-canopy" ? 0.14 : role === "retained-trees" ? 0.3 : role.startsWith("proposal-") ? 0.5 : isParcel ? 0 : role === "dpu-sidewalk" ? 0.32 : role === "planned-sidewalk" || role === "recreation-zone" ? 0.12 : role === "obligation-plot" ? 0.04 : 0.05, dashArray: plannedNetwork || p.conditional || ["proposal-canopy", "retained-trees", "parcel", "planned-sidewalk", "dpu-boundary", "unresolved-road-parcels"].includes(role) ? "5 5" : undefined },
          pointToLayer: (_, latlng) => role === "obligation-tree"
            ? L.circle(latlng, { pane, color, fillColor: color, fillOpacity: 0.25, radius: Number(p.crown_radius_m ?? 2), weight: 2, dashArray: p.placement === "ilustracija" ? "4 3" : undefined })
            : p.candidate_id
            ? L.circle(latlng, { pane, color, fillColor: color, fillOpacity: 0.8, radius: Number(p.tree_pit_radius_m ?? 1), weight: 1.5 })
            : L.circleMarker(latlng, { pane, color, fillColor: color, fillOpacity: 1, radius: 5, weight: 2 }),
        });
        const text = document.createElement("div");
        text.textContent = [p.candidate_id, name, PLAN_STATUS[p.source_status], p.sirina != null ? `Evidentirana širina: ${Number(p.sirina).toLocaleString("hr-HR")} m` : null, p.chainage_m != null ? `${p.chainage_m} m od početka trase` : null, p.nearest_utility_distance_m != null ? `${p.nearest_utility?.label} (${p.nearest_utility?.network_status === "dpu-plan" ? "DPU" : "gradska evidencija"}): ${Number(p.nearest_utility_distance_m).toLocaleString("hr-HR")} m` : null, p.passage_basis === "existing-sidewalk" ? "Položaj uz vanjski rub evidentiranog nogostupa" : null, p.action, p.ownership_status === "unknown" ? "Vlasništvo treba provjeriti" : null, p.source, p.source_url].filter(Boolean).join(" · ");
        if (p.cestica) text.prepend(document.createTextNode(`k.č. ${p.cestica}, k.o. ${p.ko} · `));
        if (p.planting_parcel_ids) text.append(document.createTextNode(` · Sadna površina unutar čestice: ${p.planting_parcel_ids.join(", ")}`));
        if (p.candidate_id && role !== "proposal-canopy") layer.bindTooltip(String(p.candidate_id), { permanent: true, direction: "top", className: "!border-0 !bg-white/90 !shadow-none !text-[10px]", opacity: 0.9 });
        if (p.label) text.prepend(document.createTextNode(`${p.label} · `));
        if (p.purpose) text.append(document.createTextNode(` · ${p.purpose}`));
        if (p.evidence) text.append(document.createTextNode(` · ${p.evidence}`));
        layer.bindPopup(text).addTo(group);
        if (isParcel && p.label_coordinates) {
          const parcelLabel = document.createElement("span");
          parcelLabel.textContent = String(p.cestica);
          L.tooltip({ permanent: true, direction: "center", className: "!border-0 !bg-white/80 !px-1 !py-0 !shadow-none !text-[10px]", opacity: 0.9 })
            .setLatLng([p.label_coordinates[1], p.label_coordinates[0]]).setContent(parcelLabel).addTo(group);
        }
      }
      for (const [name, group] of Object.entries(groups)) {
        if (proposalGroups.has(name)) group.addTo(map);
      }
      L.control.layers({ "Ortofoto 2023": aerial, "Ulična karta": streets }, groups).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);
      const extent: FeatureCollection = {
        type: "FeatureCollection",
        features: data.features.filter((f) => ["recreation-zone", "road", "proposal-parking"].includes(f.properties?.role)),
      };
      const targetBounds = L.geoJSON(extent).getBounds();
      const plan: FeatureCollection = { type: "FeatureCollection", features: data.features.filter((f) => f.properties?.role === "dpu-boundary") };
      const planBounds = L.geoJSON(plan).getBounds();
      const instance = map;
      views.current = {
        target: () => instance.fitBounds(targetBounds, { padding: [35, 35], maxZoom: 19 }),
        plan: () => { if (planBounds.isValid()) instance.fitBounds(planBounds, { padding: [25, 25] }); },
      };
      setHasPlan(planBounds.isValid());
      views.current.target();
    }
    setup().catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => { abort.abort(); views.current = null; map?.remove(); };
  }, [url, extraKey, sidewalks]);

  return (
    <div>
      <div ref={container} role="region" aria-label={label} className="relative z-0 h-[420px] w-full rounded-xl bg-kamen-tlo sm:h-[520px]" />
      {error && <p role="alert" className="mt-3 text-kamen-tekst">Kartu nije moguće učitati. Pokušajte ponovno učitati stranicu ili otvorite kartu kvarta.</p>}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-kamen-tekst">{(sidewalks ? [["#b45309", "Dopuna nogostupa"], ["#007956", "Moguća sadnja"], ["#a30037", "Sadnja uz prilagodbu instalacija"], ...(extraUrls.length ? [["#7e22ce", "Stabla koja duguju susjedne građevine"]] : [])] : [["#005f46", "Cageball"], ["#b65e37", "Teretana"], ["#b58938", "Dječja igra"], ["#729353", "Zelena šetnica"], ["#285c35", "Postojeća sadnja · zadržati"], ["#5a893c", "Buduće krošnje"], ["#64748b", "3 parkirna mjesta"]]).map(([color, text]) => <span key={text} className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{text}</span>)}</div>
      <p className="mt-3 text-sm leading-6 text-kamen-tekst">Prikazan je prijedlog uređenja. Katastar, postojeće nogostupe i instalacije možete uključiti u izborniku slojeva u gornjem desnom kutu.</p>
      {hasPlan && <details className="mt-3 text-sm"><summary className="fokus cursor-pointer py-2 font-semibold text-maslina">Pregled izvornog plana</summary><div className="flex flex-wrap gap-3 py-2"><button type="button" onClick={() => views.current?.target()} className="fokus min-h-11 rounded-lg border border-kamen-rub px-4">Vrati na prijedlog</button><button type="button" onClick={() => views.current?.plan()} className="fokus min-h-11 rounded-lg border border-kamen-rub px-4">Obuhvat cijelog DPU-a</button></div><p className="leading-6 text-kamen-tekst">Slojeve DPU-a uključite zasebno u izborniku karte.</p></details>}
    </div>
  );
}
