"use client";

import { useEffect, useId, useRef, useState } from "react";
import { footprintAppearance, inboundRoadArrows, isBiliceRoadSceneData, roadColors, roadFrame, wideningFrame, type BiliceRoadSceneData, type BiliceRoadSegment, type BiliceWideningParcel, type RoadXYZ } from "./bilice-road-scene-types";

type Runtime = ReturnType<typeof import("./bilice-road-scene")["createBiliceRoadScene"]>;
const button = "fokus min-h-11 rounded-lg border border-kamen-rub bg-white px-3 text-sm font-semibold hover:bg-kamen-plitko disabled:opacity-40";
const number = (value: number) => Math.round(value).toLocaleString("hr-HR");
const segmentLength = (segment: BiliceRoadSegment) => segment.points.reduce((length, point, i, points) => i ? length + Math.hypot(point[0] - points[i - 1][0], point[2] - points[i - 1][2]) : length, 0);
const polygonPath = (rings: RoadXYZ[][]) => rings.map((ring) => ring.map(([x, , z], i) => `${i ? "L" : "M"}${x},${z}`).join(" ") + " Z").join(" ");

function RoadMap({ data, plan, proposal, buildings, wideningVisible, focused, selectedParcel, hoveredParcel, onSelect, onSelectParcel, onHoverParcel }: { data: BiliceRoadSceneData; plan: boolean; proposal: boolean; buildings: boolean; wideningVisible: boolean; focused: boolean; selectedParcel: string | null; hoveredParcel: string | null; onSelect: (segment: BiliceRoadSegment) => void; onSelectParcel: (parcel: BiliceWideningParcel) => void; onHoverParcel: (parcel: BiliceWideningParcel | null) => void }) {
  const frame = focused && data.widening ? wideningFrame(data.widening) : roadFrame(data);
  const width = frame.maxX - frame.minX, depth = frame.maxZ - frame.minZ;
  const margin = Math.max(width, depth) * .035;
  return <svg viewBox={`${frame.minX - margin} ${frame.minZ - margin} ${width + margin * 2} ${depth + margin * 2}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Tlocrt trase: zeleno korištenje postojećih cesta, narančasto nedostajući spojevi prema DPU-u i radni priključak, bijele strelice označavaju ulaz s D1">
    <rect x={frame.minX - margin} y={frame.minZ - margin} width={width + margin * 2} height={depth + margin * 2} fill="#deded0" />
    {data.surfaces.map((surface, index) => {
      const planned = surface.role.startsWith("dpu") || surface.role.startsWith("planned");
      if (surface.role.startsWith("proposal") || planned && !plan) return null;
      return <path key={index} d={polygonPath(surface.rings)} fill={planned ? roadColors.plan : roadColors.road} fillOpacity={planned ? .25 : 1} stroke={planned ? roadColors.plan : "none"} strokeWidth=".7" strokeDasharray={planned ? "5 3" : undefined} fillRule="evenodd" />;
    })}
    {proposal && data.proposalFootprints?.map((footprint, index) => {
      const segment = data.segments.find((item) => item.id === footprint.segmentId);
      if (!segment) return null;
      const appearance = footprintAppearance(footprint);
      return <path key={index} d={polygonPath(footprint.rings)} fill={appearance.color} fillRule="evenodd" className="fokus cursor-pointer" role="button" tabIndex={0} aria-label={`${appearance.label}: ${segment.label}`} onClick={() => onSelect(segment)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(segment); } }} />;
    })}
    {proposal && inboundRoadArrows(data).map(({ segmentId, ring }, index) => <path key={`${segmentId}-${index}`} d={polygonPath([ring])} fill="#fff8e7" pointerEvents="none" />)}
    {buildings && data.buildings.map((building) => <path key={building.id} d={polygonPath(building.rings)} fill={roadColors.building} stroke="#98988e" strokeWidth=".65" fillRule="evenodd" />)}
    {wideningVisible && data.widening && <g>
      <path d={polygonPath(data.widening.rings)} fill={roadColors.widening} fillOpacity={.85} stroke="#fff8e7" strokeWidth="1" fillRule="evenodd" />
      {data.widening.parcels.map((parcel) => {
        const active = parcel.id === selectedParcel || parcel.id === hoveredParcel;
        return <path key={parcel.id} d={polygonPath(parcel.rings)} fill={active ? roadColors.widening : roadColors.parcel} fillOpacity={active ? .22 : .05} stroke={active ? "#8c2455" : roadColors.parcel} strokeWidth={active ? 2 : 1.2} vectorEffect="non-scaling-stroke" fillRule="evenodd" className="fokus cursor-pointer" role="button" tabIndex={0} aria-label={`${parcel.label}: ${parcel.ownershipLabel}, preklop radnog koridora ${number(parcel.overlapM2)} četvornih metara`} onMouseEnter={() => onHoverParcel(parcel)} onMouseLeave={() => onHoverParcel(null)} onFocus={() => onHoverParcel(parcel)} onBlur={() => onHoverParcel(null)} onClick={() => onSelectParcel(parcel)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectParcel(parcel); } }} />;
      })}
    </g>}
    {!focused && data.labels.map((label) => <text key={label.label} x={label.position[0]} y={label.position[2] - 10} textAnchor="middle" fontSize={Math.max(width, depth) * .019} fontWeight="650" fill="#343c36" stroke="#f6f5eb" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" pointerEvents="none">{label.label}</text>)}
  </svg>;
}

export function BiliceRoadVisual() {
  const helpId = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [data, setData] = useState<BiliceRoadSceneData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [mode, setMode] = useState<"3d" | "map">("3d");
  const [plan, setPlan] = useState(false);
  const [proposal, setProposal] = useState(true);
  const [buildings, setBuildings] = useState(true);
  const [selected, setSelected] = useState<BiliceRoadSegment | null>(null);
  const [wideningVisible, setWideningVisible] = useState(true);
  const [focused, setFocused] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<BiliceWideningParcel | null>(null);
  const [hoveredParcel, setHoveredParcel] = useState<BiliceWideningParcel | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const controller = new AbortController();
    let cancelled = false;
    const lost = (event: Event) => {
      event.preventDefault();
      runtime.current?.dispose(); runtime.current = null;
      if (!cancelled) setStatus("unavailable");
    };
    element.addEventListener("webglcontextlost", lost);
    void (async () => {
      let sceneData: BiliceRoadSceneData;
      try {
        const response = await fetch("/geo/prijedlozi/bilice-cesta-3d.json", { signal: controller.signal });
        if (!response.ok) throw new Error("Road data unavailable");
        const payload: unknown = await response.json();
        if (!isBiliceRoadSceneData(payload)) throw new Error("Incomplete road data");
        sceneData = payload;
        if (cancelled) return;
        setData(sceneData);
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      try {
        const { createBiliceRoadScene } = await import("./bilice-road-scene");
        if (cancelled) return;
        const scene = createBiliceRoadScene(element, sceneData, controller.signal, setSelected, { onSelect: setSelectedParcel, onHover: setHoveredParcel });
        if (cancelled) { scene.dispose(); return; }
        runtime.current = scene; setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true; controller.abort();
      element.removeEventListener("webglcontextlost", lost);
      runtime.current?.dispose(); runtime.current = null;
    };
  }, []);

  useEffect(() => {
    runtime.current?.showPlan(plan);
    runtime.current?.showProposal(proposal);
    runtime.current?.showBuildings(buildings);
    runtime.current?.showWidening(wideningVisible);
    runtime.current?.selectParcel(selectedParcel?.id ?? null);
  }, [plan, proposal, buildings, wideningVisible, selectedParcel, status]);

  useEffect(() => {
    if (focused && status === "ready") runtime.current?.focusWidening();
  }, [focused, status]);

  const ready = status === "ready";
  const show3d = ready && mode === "3d";
  const parcelReadout = wideningVisible ? hoveredParcel ?? selectedParcel : null;
  const selectedSources = new Set(data?.proposalFootprints?.filter((footprint) => footprint.segmentId === selected?.id).map((footprint) => footprint.source));
  const selectedExistingWidths = [...new Set(data?.proposalFootprints?.filter((footprint) => footprint.segmentId === selected?.id && footprint.source === "existing").flatMap((footprint) => footprint.widthM === undefined ? [] : [footprint.widthM]))];
  return <figure className="overflow-hidden rounded-xl border border-kamen-rub bg-white">
    <div className="relative h-[470px] overflow-hidden bg-[#e9e9e1] sm:h-[600px]">
      {data && !show3d && <RoadMap data={data} plan={plan} proposal={proposal} buildings={buildings} wideningVisible={wideningVisible} focused={focused} selectedParcel={selectedParcel?.id ?? null} hoveredParcel={hoveredParcel?.id ?? null} onSelect={setSelected} onSelectParcel={setSelectedParcel} onHoverParcel={setHoveredParcel} />}
      <canvas ref={canvas} role="img" aria-label="Interaktivni 3D model cestovne veze Bilica s postojećom mrežom u Dračevcu" aria-describedby={helpId} className={`absolute inset-0 h-full w-full touch-none ${show3d ? "" : "invisible"}`} />
      <div className="pointer-events-none absolute left-3 top-3 max-w-[65%] rounded-lg bg-white/95 px-3 py-2 shadow-sm sm:left-4 sm:top-4">
        <p className="text-[11px] font-bold uppercase tracking-[.08em] text-kamen-drugi">Bilice · etapa za provjeru</p>
        <p className="mt-0.5 text-sm font-semibold">{focused && data?.widening ? `${number(data.widening.lengthM)} m · proširenje za provjeru` : show3d ? "Trasa na postojećem terenu" : "Tlocrt cestovne veze"}</p>
        <p className="mt-0.5 text-[11px] text-kamen-tekst">{focused && data?.widening ? `Radni profil ${data.widening.widthM.toLocaleString("hr-HR")} m · potrebna prometna provjera` : "Uvjetna etapa · niveletu treba projektirati"}</p>
      </div>
      {ready && <div className="absolute right-3 top-3 flex rounded-lg border border-kamen-rub bg-white p-1 sm:right-4 sm:top-4" aria-label="Vrsta prikaza">
        {(["3d", "map"] as const).map((view) => <button key={view} type="button" aria-pressed={mode === view} onClick={() => setMode(view)} className={`fokus min-h-10 rounded-md px-3 text-sm font-semibold ${mode === view ? "bg-maslina text-white" : "text-kamen-tekst"}`}>{view === "3d" ? "3D" : "Karta"}</button>)}
      </div>}
      {wideningVisible && hoveredParcel && <div className="pointer-events-none absolute right-3 top-24 max-w-[55%] rounded-lg border border-[#dfbdce] bg-white/95 px-3 py-2 text-xs leading-5 shadow-sm">
        <p className="font-bold">{hoveredParcel.label}</p><p className="text-kamen-drugi">{hoveredParcel.id}</p><p>{hoveredParcel.ownershipLabel}</p><p>{hoveredParcel.overlapM2.toLocaleString("hr-HR", { maximumFractionDigits: 1 })} m² preklopa radnog koridora</p>
      </div>}
      {!show3d && data && <span className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-center font-mono text-xs font-semibold text-kamen-tekst" aria-label="Sjever je gore"><span className="text-2xl leading-none">↑</span>S</span>}
      {!data && <div role="status" className="absolute inset-x-6 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-xl bg-white/95 p-5 text-sm leading-6">{status === "error" ? <>Podaci prikaza trenutačno nisu dostupni. <a className="fokus font-semibold text-maslina underline" href="/geo/prijedlozi/bilice-cesta.geojson">Preuzmite trasu za kartu.</a></> : "Učitavam teren, zgrade i trasu…"}</div>}
      <div className="pointer-events-none absolute bottom-3 left-3 right-12 max-w-sm rounded-lg border border-[#d4a979] bg-[#fff9ef]/95 px-3 py-2 text-xs leading-5 shadow-sm">
        <p className="font-bold text-[#744210]">Izlaz na D1 nije potvrđen.</p>
        <p>Odvojak služi samo ulazu: D1 → Dračevac. Ovo nije dovršeno rješenje pristupa.</p>
        {status === "loading" && data && <p role="status" className="mt-1 text-kamen-tekst">Pripremam 3D prikaz…</p>}
        {status === "unavailable" && <p role="status" className="mt-1 text-kamen-tekst">3D nije dostupan. Karta prikazuje iste podatke.</p>}
      </div>
    </div>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-kamen-tekst" aria-label="Legenda trase">
        <span className="flex items-center gap-2"><span className="h-1.5 w-6 rounded-full" style={{ background: roadColors.existing }} />Postojeća cesta za korištenje</span>
        <span className="flex items-center gap-2"><span className="h-1.5 w-6 rounded-full" style={{ background: roadColors.new }} />Nedostajući spoj · DPU / radni priključak</span>
        <span className="flex items-center gap-2"><span className="w-6 rounded bg-[#007e75] text-center font-bold leading-4 text-white">→</span>Jednosmjerni ulaz s D1</span>
        {plan && <span className="flex items-center gap-2"><span className="h-3 w-6 border border-dashed" style={{ borderColor: roadColors.plan, background: `${roadColors.plan}30` }} />Cijeli DPU · usporedba</span>}
        <span className="flex items-center gap-2"><span className="h-3 w-4 border border-[#98988e]" style={{ background: roadColors.building }} />Postojeće zgrade</span>
        {data?.widening && <><span className="flex items-center gap-2"><span className="h-1.5 w-6 rounded-full" style={{ background: roadColors.widening }} />Radni koridor proširenja</span><span className="flex items-center gap-2"><span className="h-3 w-6 border" style={{ borderColor: roadColors.parcel }} />Zahvaćene čestice</span></>}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Upravljanje 3D prikazom">
        <button type="button" className={button} disabled={!show3d} onClick={() => runtime.current?.zoom(1.4)} aria-label="Povećaj 3D prikaz">Povećaj +</button>
        <button type="button" className={button} disabled={!show3d} onClick={() => runtime.current?.zoom(1 / 1.4)} aria-label="Smanji 3D prikaz">Smanji −</button>
        <button type="button" className={button} disabled={!show3d} onClick={() => runtime.current?.rotate(-Math.PI / 6)} aria-label="Zakreni prikaz ulijevo">Zakreni ←</button>
        <button type="button" className={button} disabled={!show3d} onClick={() => runtime.current?.rotate(Math.PI / 6)} aria-label="Zakreni prikaz udesno">Zakreni →</button>
        <button type="button" className={button} disabled={!show3d} onClick={() => { setFocused(false); runtime.current?.reset(true); }}>Odozgo</button>
        <button type="button" className={button} disabled={!data} onClick={() => { setFocused(false); runtime.current?.reset(); }}>Cijela veza</button>
        {data?.widening && <button type="button" className={`${button} text-[#8c2455]`} onClick={() => { setFocused(true); setWideningVisible(true); runtime.current?.focusWidening(); }}>Prvih {number(data.widening.lengthM)} m</button>}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-kamen-rub pt-3 text-sm">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={proposal} disabled={!data} onChange={(event) => { setProposal(event.target.checked); setSelected(null); }} className="h-4 w-4 accent-maslina" />Prijedlog veze</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={plan} disabled={!data} onChange={(event) => setPlan(event.target.checked)} className="h-4 w-4 accent-maslina" />Cijeli DPU · usporedi s postojećim cestama</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={buildings} disabled={!data} onChange={(event) => setBuildings(event.target.checked)} className="h-4 w-4 accent-maslina" />Postojeće zgrade</label>
        {data?.widening && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={wideningVisible} onChange={(event) => { setWideningVisible(event.target.checked); setHoveredParcel(null); }} className="h-4 w-4 accent-maslina" />Proširenje i čestice</label>}
      </div>
      {data?.widening && <section className="space-y-3 rounded-lg border border-[#dfbdce] bg-[#fbf5f8] p-4" aria-label="Čestice radnog proširenja">
        <p className="text-sm leading-6"><strong>{data.widening.label}</strong> · {number(data.widening.lengthM)} m po postojećoj osi{data.widening.adjustedLengthM !== undefined && <>, duljina prilagođene osi {data.widening.adjustedLengthM.toLocaleString("hr-HR", { maximumFractionDigits: 2 })} m</>}. Radni profil iznosi {data.widening.widthM.toLocaleString("hr-HR")} m; potrebna je prometna provjera širine. Dodirnite česticu ili je odaberite na popisu.</p>
        {data.widening.note && <p className="text-sm leading-6 text-kamen-tekst">{data.widening.note}</p>}
        <label className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Čestica</span><select className="fokus min-h-11 min-w-0 max-w-full flex-1 rounded-lg border border-kamen-rub bg-white px-3" value={selectedParcel?.id ?? ""} onChange={(event) => { setSelectedParcel(data.widening?.parcels.find((parcel) => parcel.id === event.target.value) ?? null); setHoveredParcel(null); setWideningVisible(true); }}><option value="">Odaberite česticu</option>{data.widening.parcels.map((parcel) => <option key={parcel.id} value={parcel.id}>{parcel.label}</option>)}</select></label>
        <div className="min-h-20 text-sm leading-6" aria-live="polite">
          {parcelReadout ? <><p><strong>{parcelReadout.label}</strong> <span className="text-kamen-drugi">({parcelReadout.id})</span></p><p>{parcelReadout.ownershipLabel}</p><p>Preklop s radnim koridorom: <strong>{parcelReadout.overlapM2.toLocaleString("hr-HR", { maximumFractionDigits: 1 })} m²</strong>.</p></> : <p className="text-kamen-tekst">Prelazak pokazivačem ili odabir prikazuje oznaku čestice, dostupnu napomenu o vlasništvu i preklop s radnim koridorom.</p>}
        </div>
        <p className="text-xs leading-5 text-kamen-tekst">Preklop je geometrijska provjera radnog profila, a ne površina za otkup ili izvlaštenje. Prikaz ne potvrđuje vlasništvo; mjerodavne podatke, međe i konačan zahvat treba provjeriti.</p>
      </section>}
      {data && <label className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Dionica</span><select className="fokus min-h-11 min-w-0 max-w-full flex-1 rounded-lg border border-kamen-rub bg-white px-3 sm:flex-none" value={selected?.id ?? ""} onChange={(event) => setSelected(data.segments.find((segment) => segment.id === event.target.value) ?? null)}><option value="">Odaberite na prikazu ili popisu</option>{data.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.label}</option>)}</select></label>}
      {selected && <p role="status" className="rounded-lg bg-kamen-plitko px-4 py-3 text-sm leading-6"><strong>{selected.label}</strong> · približno {number(segmentLength(selected))} m duž radne osi. {selectedSources.has("existing") && <>Zeleno je postojeća cesta koja se zadržava i unutar obuhvata DPU-a. Prikazana širina{selectedExistingWidths.length > 0 && <> ({selectedExistingWidths.map((width) => width.toLocaleString("hr-HR")).join(" / ")} m)</>} radna je pretpostavka, ne izmjereni rub asfalta. </>}{selectedSources.has("dpu") && <>Narančasto je dio planiranog kolnika potreban za nedostajući spoj; preuzet je obris DPU-a s promjenama širine. </>}{selectedSources.has("candidate") && <>Radni priključak traži projektnu i plansku provjeru. </>}{selected.onewayInbound && <strong className="mt-1 block text-[#744210]">Samo ulaz s D1 prema Dračevcu. Nije dopušteni izlaz na D1.</strong>}</p>}
      <figcaption id={helpId} className="max-w-3xl text-sm leading-6 text-kamen-tekst">Povucite za zakretanje, kotačićem ili s dva prsta približite. Zeleno pratimo postojeće ceste i unutar DPU-a; njihove prikazane širine su radne pretpostavke. Narančasto su samo nedostajući spojevi: odgovarajući dijelovi izvornog DPU kolnika i radni priključak. Cijeli plan možete uključiti zasebno radi usporedbe. Bijele strelice označavaju jednosmjerni ulaz s D1. Trasa prati današnji DGU teren; buduće visine ceste i konstrukcije nisu projektirane. Obrisi zgrada preuzeti su iz GIS-a, uz evidentirane ili shematske visine. Izvori: DGU i GIS Grada Splita. <a href="/geo/prijedlozi/bilice-cesta.geojson" className="fokus font-semibold text-maslina underline underline-offset-2">Podaci trase</a>.</figcaption>
    </div>
  </figure>;
}
