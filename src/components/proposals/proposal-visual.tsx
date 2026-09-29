"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Runtime = Awaited<ReturnType<typeof import("./proposal-scene")["createProposalScene"]>>;
const button = "fokus min-h-11 rounded-lg border border-kamen-rub bg-white px-3 text-sm font-semibold disabled:opacity-40";

export function ProposalSceneVisual({ kind }: { kind: "nogostupi" | "rekreacija" }) {
  const recreation = kind === "rekreacija";
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [growth, setGrowth] = useState(100);
  const [trees, setTrees] = useState(true);
  const [selected, setSelected] = useState("");
  const [enhanced, setEnhanced] = useState(true);
  const [enhancedAvailable, setEnhancedAvailable] = useState(true);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const controller = new AbortController();
    let cancelled = false;
    const lost = (event: Event) => { event.preventDefault(); runtime.current?.dispose(); runtime.current = null; setStatus("unavailable"); };
    element.addEventListener("webglcontextlost", lost);
    void import("./proposal-scene").then(({ createProposalScene }) => {
      if (cancelled) return null;
      return createProposalScene(element, controller.signal, (tree) => setSelected(`${tree.id} · buduća krošnja oko ${tree.radius * 2} m · ${tree.conditional ? "potrebno usklađivanje s instalacijama" : "potrebna terenska provjera"}`), kind);
    }).then((scene) => {
      if (!scene) return;
      if (cancelled) { scene.dispose(); return; }
      runtime.current = scene; setEnhanced(scene.enhancedAvailable); setEnhancedAvailable(scene.enhancedAvailable); setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("unavailable"); });
    return () => { cancelled = true; controller.abort(); element.removeEventListener("webglcontextlost", lost); runtime.current?.dispose(); runtime.current = null; };
  }, [kind]);
  const ready = status === "ready";
  return <figure>
    <div className="relative h-[390px] overflow-hidden rounded-xl bg-kamen-tlo sm:h-[560px]">
      {!ready && <Image src={recreation ? "/prijedlozi/rekreacija-render-hlad.png" : "/prijedlozi/nogostupi-render-hlad.png"} alt={recreation ? "Idejni prikaz rekreativne zone na tri razine" : "Idejni prikaz nogostupa u hladu razvijenih krošnji"} fill preload sizes="(max-width: 1024px) 100vw, 992px" className="object-cover" />}
      <canvas ref={canvas} role="img" aria-label={recreation ? "Interaktivni 3D plan dječje terase, cageballa i teretane" : "Interaktivni 3D prijedlog drvoreda na reljefu Dračevca"} aria-describedby={`${kind}-3d-help`} className={`h-full w-full touch-none ${ready ? "" : "invisible"}`} />
      {!ready && <p role="status" className="absolute inset-x-4 bottom-4 rounded-lg bg-white/95 p-4 text-sm">{status === "loading" ? "Učitavam 3D plan…" : <>3D prikaz nije dostupan u ovom pregledniku. <a href="#prijedlog" className="font-semibold text-maslina underline">Pogledajte plan na karti.</a></>}</p>}
      {ready && <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold">3D plan · {recreation ? "tri terase za igru i sport" : "budući izgled drvoreda"}</p>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Upravljanje 3D prikazom">
      <button className={button} disabled={!ready} onClick={() => runtime.current?.zoom(1.5)}>Povećaj +</button>
      <button className={button} disabled={!ready} onClick={() => runtime.current?.zoom(1 / 1.5)}>Smanji −</button>
      <button className={button} disabled={!ready} onClick={() => runtime.current?.rotate(-Math.PI / 6)} aria-label="Zakreni pogled ulijevo">Zakreni ←</button>
      <button className={button} disabled={!ready} onClick={() => runtime.current?.rotate(Math.PI / 6)} aria-label="Zakreni pogled udesno">Zakreni →</button>
      <button className={button} disabled={!ready} onClick={() => runtime.current?.reset(true)}>Odozgo</button>
      <button className={button} disabled={!ready} onClick={() => runtime.current?.reset()}>{recreation ? "Cijeli park" : "Cijela ulica"}</button>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={trees} disabled={!ready} onChange={(event) => { setTrees(event.target.checked); runtime.current?.showTrees(event.target.checked); setSelected(""); }} className="h-4 w-4 accent-maslina" />Nova stabla u 3D</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={!ready} onChange={(event) => runtime.current?.showParcels(event.target.checked)} className="h-4 w-4 accent-maslina" />{recreation ? "Čestice i obuhvat" : "Granica cestovne čestice"}</label>
      <label className="flex min-h-11 items-center gap-3">Krošnje <input type="range" min="35" max="100" value={growth} disabled={!ready || !trees} onChange={(event) => { const value = Number(event.target.value); setGrowth(value); runtime.current?.growth(value / 100); }} className="w-28 accent-maslina" aria-label="Veličina krošnje od mlađeg do razvijenog stabla" /><span className="w-20">{growth < 65 ? "Manje" : "Razvijene"}</span></label>
      <label className="flex min-h-11 items-center gap-2">Smjer sunca <select defaultValue="afternoon" disabled={!ready} onChange={(event) => runtime.current?.sunlight(event.target.value)} className="fokus min-h-11 rounded-lg border border-kamen-rub bg-white px-2"><option value="morning">Jutarnji</option><option value="noon">Podnevni</option><option value="afternoon">Popodnevni</option></select></label>
    </div>
    <label className="mt-3 flex min-h-11 flex-wrap items-center gap-3 text-sm">Podloga
      <select value={enhanced ? "enhanced" : "source"} disabled={!ready} onChange={(event) => { const value = event.target.value === "enhanced"; setEnhanced(value); runtime.current?.showEnhanced(value); }} className="fokus min-h-11 rounded-lg border border-kamen-rub bg-white px-3">
        <option value="enhanced" disabled={!enhancedAvailable}>Detaljniji idejni prikaz · AI</option>
        <option value="source">Izvorni DGU ortofoto</option>
      </select>
    </label>
    {recreation && <p className="mt-3 text-sm leading-6 text-kamen-tekst">Donja terasa: dječja igra · srednja: cageball · gornja: teretana. Parking je zapadno od donje terase, uz zelenu šetnicu.</p>}
    {selected && <p role="status" className="mt-3 text-sm text-kamen-tekst">{selected}</p>}
    <figcaption id={`${kind}-3d-help`} className="mt-3 max-w-3xl text-sm leading-6 text-kamen-tekst">Povucite za zakretanje, približite za pojedina stabla. {enhanced ? "Detaljnija podloga je AI ilustracija približno poravnata sa snimkom; njezina stabla i detalji nisu evidencija postojećeg stanja. Za usporedbu odaberite izvorni ortofoto." : "Izvorna snimka: DGU DOF 2023., Otvorena dozvola. Tamnozeleni pojasevi približno označavaju postojeću sadnju koju čuvamo."} Položaji prijedloga ostaju isti pri promjeni podloge. {recreation && "Razine terasa, zid i raspored sprava su radni prikaz za daljnju razradu. "}Krošnje i njihove sjene prikazuju mogući razvoj, ne stručni proračun osunčanja.</figcaption>
  </figure>;
}
