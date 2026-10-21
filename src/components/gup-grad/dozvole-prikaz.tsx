"use client";

/**
 * /planovi/dozvole: karta preko cijele širine s legendom na sebi i ploča uz
 * desni rub (na uskom zaslonu ispod karte) s naslovom, brojkama, grafikonom
 * po godinama, odabirom (ishod, vrsta dozvole, UPU, izmjene) i popisom
 * predmeta. Tekst uvoda i izvora iscrtava poslužitelj (page.tsx) i dolazi
 * kao propovi. Podatke (dozvole-sanacija-2025.geojson) učita jednom; karta
 * (dozvole-karta.tsx) samo crta i javlja klik na česticu, a učitava se bez
 * SSR-a.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Geometry, Position } from "geojson";

import type { CiljDozvola } from "@/components/gup-grad/dozvole-karta";
import {
  BOJE_ISHODA,
  ISHODI,
  POSTUPCI,
  datum,
  ishodCestice,
  ishodTekst,
  kad,
  type Ishod,
  type PodaciDozvola,
  type Postupak,
  type Predmet,
  type ZnacajkaCestice,
  type ZnacajkaPredmeta,
} from "@/lib/gup-grad/dozvole";

const DozvoleKarta = dynamic(() => import("@/components/gup-grad/dozvole-karta").then((m) => m.DozvoleKarta), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-200" />,
});

type Granice = CiljDozvola["granice"];

function granice(g: Geometry): Granice {
  let s = 90, j = -90, z = 180, i = -180;
  const prodji = (c: Position | Position[] | Position[][] | Position[][][]) => {
    if (typeof c[0] === "number") {
      const [x, y] = c as Position;
      s = Math.min(s, y);
      j = Math.max(j, y);
      z = Math.min(z, x);
      i = Math.max(i, x);
    } else (c as Position[]).forEach((d) => prodji(d as Position));
  };
  if (g.type !== "GeometryCollection") prodji(g.coordinates);
  return [
    [s, z],
    [j, i],
  ];
}

const spojiGranice = (g: Granice[]): Granice => [
  [Math.min(...g.map((x) => x[0][0])), Math.min(...g.map((x) => x[0][1]))],
  [Math.max(...g.map((x) => x[1][0])), Math.max(...g.map((x) => x[1][1]))],
];

function Cip({ aktivan, onClick, boja, children }: { aktivan: boolean; onClick: () => void; boja?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={aktivan}
      onClick={onClick}
      className={`fokus inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800 transition-opacity ${aktivan ? "" : "opacity-40"}`}
    >
      {boja && <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: boja }} />}
      {children}
    </button>
  );
}

function OpisPredmeta({ p }: { p: Predmet }) {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong style={{ color: BOJE_ISHODA[p.ishod] }}>{ishodTekst(p)}</strong>
        <span className="text-zinc-600">{p.datum ? `riješeno ${datum(p.datum)}` : `zaprimljeno ${datum(p.zaprimljeno)}`}</span>
      </div>
      <div className="font-mono text-xs text-zinc-800">{p.klasa}</div>
      <div className="text-zinc-800">
        {p.vrsta}
        {p.izvor !== "eDozvola" && <span className="text-zinc-500"> ({p.izvor})</span>}
      </div>
      {p.zahvat && <div className="text-zinc-700">{p.zahvat}</div>}
      {p.namjena && <div className="text-zinc-500">{p.namjena}</div>}
      <div className="text-zinc-500">
        {p.kc}
        {p.adresa ? ` · ${p.adresa}` : ""}
      </div>
      <div className="text-zinc-500">{p.upu}</div>
    </div>
  );
}

/** Stupci po godini (rješenja, a neriješeni po zaprimanju), složeni po ishodu. */
function Godine({ predmeti }: { predmeti: Predmet[] }) {
  const god = new Map<string, Partial<Record<Ishod, number>>>();
  for (const p of predmeti) {
    const g = kad(p).slice(0, 4);
    if (!g) continue;
    const r = god.get(g) ?? {};
    r[p.ishod] = (r[p.ishod] ?? 0) + 1;
    god.set(g, r);
  }
  const godine = [...god.keys()].sort();
  const zbroj = (g: string) => Object.values(god.get(g)!).reduce((a, b) => a + (b ?? 0), 0);
  const najvise = Math.max(1, ...godine.map(zbroj));
  const VISINA = 44;
  return (
    <figure>
      <figcaption className="text-xs text-zinc-500">Zahtjevi po godini rješavanja ili zaprimanja</figcaption>
      <div className="mt-1.5 flex items-end gap-[3px]" style={{ height: VISINA + 16 }}>
        {godine.map((g) => {
          const r = god.get(g)!;
          return (
            <div
              key={g}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
              title={`${g}.: ${ISHODI.filter((i) => r[i]).map((i) => `${r[i]} ${i}`).join(", ")}`}
            >
              <div className="flex w-full flex-col-reverse">
                {ISHODI.filter((i) => r[i]).map((i) => (
                  <span key={i} className="block w-full" style={{ height: ((r[i] ?? 0) / najvise) * VISINA, background: BOJE_ISHODA[i] }} />
                ))}
              </div>
              <span className="text-[9.5px] tabular-nums text-zinc-500">{g.slice(2)}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export function DozvolePrikaz({ uvod, izvori }: { uvod: ReactNode; izvori: ReactNode }) {
  const [podaci, setPodaci] = useState<PodaciDozvola | null>(null);
  const [greska, setGreska] = useState(false);
  const [ishodi, setIshodi] = useState<Set<Ishod>>(new Set(ISHODI));
  const [postupci, setPostupci] = useState<Set<Postupak>>(new Set(POSTUPCI));
  const [upu, setUpu] = useState("");
  const [izmjene, setIzmjene] = useState(false);
  const [obuhvati, setObuhvati] = useState(true);
  const [odabrana, setOdabrana] = useState<number | null>(null);
  const [cilj, setCilj] = useState<CiljDozvola | null>(null);

  useEffect(() => {
    fetch("/geo/gup-grad/dozvole-sanacija-2025.geojson")
      .then((r) => r.json() as Promise<PodaciDozvola>)
      .then(setPodaci)
      .catch(() => setGreska(true));
  }, []);

  const predmeti = useMemo(
    () => (podaci?.features.filter((f) => f.properties?.sloj === "akt") ?? []) as ZnacajkaPredmeta[],
    [podaci],
  );
  const cestice = useMemo(
    () => (podaci?.features.filter((f) => f.properties?.sloj === "cestica") ?? []) as ZnacajkaCestice[],
    [podaci],
  );
  const poKlasi = useMemo(() => new Map(predmeti.map((f) => [f.properties.klasa, f])), [predmeti]);

  const vidljiv = useMemo(
    () => (p: Predmet) =>
      ishodi.has(p.ishod) && postupci.has(p.postupak) && (izmjene || !p.izmjena) && (!upu || p.upu === upu),
    [ishodi, postupci, izmjene, upu],
  );

  const boje = useMemo(
    () =>
      cestice.map((c) => {
        const i = ishodCestice(c.properties.klase.map((k) => poKlasi.get(k)!.properties).filter(vidljiv));
        return i ? BOJE_ISHODA[i] : null;
      }),
    [cestice, poKlasi, vidljiv],
  );

  const popis = useMemo(
    () =>
      predmeti
        .map((f) => f.properties)
        .filter(vidljiv)
        .sort((a, b) => kad(b).localeCompare(kad(a))),
    [predmeti, vidljiv],
  );

  const osnovni = useMemo(() => predmeti.map((f) => f.properties).filter((p) => !p.izmjena), [predmeti]);
  const upui = useMemo(() => Object.entries(podaci?.zbroj.po_upu ?? {}).sort((a, b) => b[1] - a[1]), [podaci]);

  const prebaci = <T,>(skup: Set<T>, v: T, set: (s: Set<T>) => void) => {
    const n = new Set(skup);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    set(n);
  };

  const pomakni = (g: Granice) => setCilj((c) => ({ kljuc: (c?.kljuc ?? 0) + 1, granice: g }));

  const pokaziPredmet = (klasa: string) => {
    const f = poKlasi.get(klasa);
    if (!f) return;
    const i = cestice.findIndex((c, j) => boje[j] && c.properties.klase.includes(klasa));
    setOdabrana(i >= 0 ? i : null);
    pomakni(granice(f.geometry));
    // na uskom zaslonu karta je iznad popisa
    if (window.matchMedia("(max-width: 1023px)").matches) {
      document.getElementById("dozvole-karta")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const odabranaCestica = odabrana !== null ? cestice[odabrana] : null;
  const predmetiCestice = odabranaCestica
    ? odabranaCestica.properties.klase.map((k) => poKlasi.get(k)!.properties).sort((a, b) => kad(a).localeCompare(kad(b)))
    : [];

  const n = (f: (p: Predmet) => boolean) => osnovni.filter(f).length;

  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <div id="dozvole-karta" className="relative h-[62svh] min-h-[360px] bg-zinc-200 lg:h-full lg:min-w-0 lg:flex-1">
        {podaci ? (
          <DozvoleKarta
            podaci={podaci}
            cestice={cestice}
            predmeti={predmeti}
            boje={boje}
            odabrana={odabrana}
            prikaziObuhvate={obuhvati}
            cilj={cilj}
            onOdaberi={setOdabrana}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {greska ? "Karta se nije učitala. Osvježi stranicu." : "Karta se učitava…"}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] max-w-[15rem] rounded-lg bg-white/95 px-3 py-2 text-xs leading-relaxed text-zinc-800 shadow">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-sm border-[1.5px] border-green-600 bg-green-600/25" />
            urbana sanacija (novi GUP)
          </div>
          {ISHODI.slice(0, 5).map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: BOJE_ISHODA[i] }} />
              {i}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-sm border border-dashed border-zinc-500" />
            obuhvat zahvata iz akta
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500">Čestica s više predmeta nosi boju prvog ishoda po ovom redu.</p>
        </div>
      </div>

      <aside className="flex min-w-0 flex-col border-zinc-200 bg-white lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:border-l">
        <div className="flex flex-col gap-3.5 border-b border-zinc-200 px-4 pb-4 pt-4 sm:px-5">
          <p className="text-sm">
            <Link href="/planovi" className="fokus text-emerald-700 underline">
              Planovi
            </Link>
          </p>
          <h1 className="text-xl font-bold leading-tight text-zinc-900 [text-wrap:balance]">
            Zahtjevi za dozvolu po važećem GUP-u na zemljištu koje novi GUP stavlja u urbanu sanaciju
          </h1>
          <div className="text-sm text-zinc-600">{uvod}</div>
          <dl className="grid grid-cols-4 gap-2">
            {(
              [
                [n((p) => p.ishod === "izdana"), "izdanih dozvola"],
                [n((p) => p.ishod === "odbijena"), "odbijenih zahtjeva"],
                [n((p) => p.ishod === "obustavljena" || p.ishod === "proslijeđena"), "obustavljenih ili proslijeđenih"],
                [n((p) => p.ishod === "u obradi"), "u obradi"],
              ] as const
            ).map(([b, s]) => (
              <div key={s} className="flex flex-col">
                <dt className="order-2 text-[11.5px] leading-tight text-zinc-500">{s}</dt>
                <dd className="order-1 text-2xl font-bold tabular-nums text-zinc-900">{podaci ? b : "–"}</dd>
              </div>
            ))}
          </dl>
          {podaci && <Godine predmeti={osnovni} />}
          <div className="flex flex-wrap gap-1.5">
            {ISHODI.map((i) => (
              <Cip key={i} aktivan={ishodi.has(i)} boja={BOJE_ISHODA[i]} onClick={() => prebaci(ishodi, i, setIshodi)}>
                {i} <span className="tabular-nums text-zinc-500">{n((p) => p.ishod === i)}</span>
              </Cip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POSTUPCI.map((p) => (
              <Cip key={p} aktivan={postupci.has(p)} onClick={() => prebaci(postupci, p, setPostupci)}>
                {p} <span className="tabular-nums text-zinc-500">{n((x) => x.postupak === p)}</span>
              </Cip>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="shrink-0">Propisani UPU</span>
            <select
              id="dozvole-upu"
              value={upu}
              onChange={(e) => {
                const u = e.target.value;
                setUpu(u);
                setOdabrana(null);
                const fs = predmeti.filter((f) => !u || f.properties.upu === u);
                if (fs.length) pomakni(spojiGranice(fs.map((f) => granice(f.geometry))));
              }}
              className="fokus min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-900"
            >
              <option value="">sva područja</option>
              {upui.map(([u, b]) => (
                <option key={u} value={u}>
                  {u} ({b})
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            <label className="inline-flex items-center gap-1.5">
              <input id="dozvole-izmjene" type="checkbox" checked={izmjene} onChange={(e) => setIzmjene(e.target.checked)} />i
              izmjene i produljenja dozvola
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input id="dozvole-obuhvati" type="checkbox" checked={obuhvati} onChange={(e) => setObuhvati(e.target.checked)} />
              obuhvati iz akata
            </label>
          </div>
        </div>

        {odabranaCestica && (
          <div className="border-b-2 border-zinc-900 bg-zinc-50 px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-zinc-900">
                k.č. {odabranaCestica.properties.kc}, k.o. {odabranaCestica.properties.ko}
              </h2>
              <button type="button" onClick={() => setOdabrana(null)} className="fokus text-sm text-zinc-500 hover:text-zinc-900">
                Zatvori
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {predmetiCestice.length} {predmetiCestice.length === 1 ? "predmet" : "predmeta"} ·{" "}
              {odabranaCestica.properties.izgradjena ? "na snimci izgrađena" : "na snimci neizgrađena"}
            </p>
            <ul className="mt-2 space-y-2.5">
              {predmetiCestice.map((p) => (
                <li key={p.klasa} className="border-t border-zinc-200 pt-2">
                  <OpisPredmeta p={p} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 sm:px-5">
            {podaci ? `${popis.length} ${popis.length === 1 ? "predmet" : "predmeta"}, najnoviji prvi. ` : ""}Klik pokazuje
            predmet na karti.
          </p>
          {popis.length === 0 && (
            <p className="px-4 py-4 text-sm text-zinc-500 sm:px-5">
              {podaci ? "Nijedan predmet ne odgovara odabiru." : "Predmeti se učitavaju…"}
            </p>
          )}
          <ul>
            {popis.map((p) => (
              <li key={p.klasa}>
                <button
                  type="button"
                  onClick={() => pokaziPredmet(p.klasa)}
                  className="fokus grid w-full grid-cols-[10px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 border-b border-zinc-100 px-4 py-2.5 text-left hover:bg-zinc-50 sm:px-5"
                >
                  <span aria-hidden className="mt-1.5 h-2.5 w-2.5 rounded-sm" style={{ background: BOJE_ISHODA[p.ishod] }} />
                  <span className="font-mono text-xs text-zinc-900">
                    {p.klasa}
                    {p.izmjena && (
                      <span className="ml-1 rounded border border-zinc-200 px-1 font-sans text-[10px] uppercase text-zinc-500">izmjena</span>
                    )}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-500">{datum(kad(p))}</span>
                  <span className="col-span-2 col-start-2 text-xs text-zinc-600 [overflow-wrap:anywhere]">
                    <strong className="text-zinc-900">{ishodTekst(p)}</strong> · {p.postupak} · {p.upu} · {p.zahvat_vrsta}
                    {p.zahvat ? ` · ${p.zahvat.slice(0, 120)}` : ""}
                    <br />
                    {p.kc.slice(0, 70)}
                    {p.adresa ? ` · ${p.adresa}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-zinc-200 px-4 py-4 text-xs leading-relaxed text-zinc-600 sm:px-5">{izvori}</div>
      </aside>
    </div>
  );
}
