"use client";

import { useId } from "react";

import type { Crta, Kadar } from "@/lib/sim/kadrovi";

/**
 * Klizač po satima — tanak, jer karta je ono što se gleda.
 *
 * Jedina stvar koju traka mora reći bez riječi je granica između izmjerenog i
 * prognoziranog. Sat unatrag i sat unaprijed izgledaju na karti jednako, a
 * jedan je ono što se dogodilo, a drugi nagađanje. Prognozirani dio zato ima
 * svoju podlogu, a odabrani sat uz brojku nosi i riječ.
 *
 * Satovi koje nijedan izvor nije pokrio ne daju se odabrati: klizač preko njih
 * preskače na najbliži koji postoji. Prazan kadar bi izgledao kao čist zrak, a
 * to je najgora moguća laž na ovoj karti.
 */

const MJESNO = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const MJESNO_DAN = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  weekday: "short",
  day: "numeric",
  month: "numeric",
});

export function satMjesno(iso: string): string {
  return MJESNO.format(new Date(iso));
}

export function danMjesno(iso: string): string {
  return MJESNO_DAN.format(new Date(iso));
}

/** Riječ koja uz sat stoji na traci i u čitaču zaslona. */
export function opisKadra(kadar: Kadar): string {
  if (kadar.dostupnost === "nedostupno") return "nema podataka";
  if (kadar.vrsta === "prognoza") return "prognoza";
  if (kadar.vrsta === "sada") return "sada";
  return "izmjereno";
}

export function VremenskaCrta({
  crta,
  pomak,
  izracunati,
  naPromjenu,
}: {
  crta: Crta;
  pomak: number;
  /** Satovi za koje je perjanica gotova; ostali se još računaju. */
  izracunati: ReadonlySet<string>;
  naPromjenu: (pomak: number) => void;
}) {
  const id = useId();
  const kadrovi = crta.kadrovi;
  const prvi = kadrovi[0]?.pomak ?? 0;
  const zadnji = kadrovi[kadrovi.length - 1]?.pomak ?? 0;
  const odabrani = kadrovi.find((k) => k.pomak === pomak) ?? kadrovi[0];
  if (!odabrani) return null;

  const udio = (p: number) => (zadnji === prvi ? 0 : ((p - prvi) / (zadnji - prvi)) * 100);
  const prognoza = odabrani.vrsta === "prognoza";

  /** Klizač smije stati samo na sat koji se dade prikazati. */
  function naKlizac(trazeni: number) {
    const dostupni = kadrovi.filter((k) => k.dostupnost !== "nedostupno");
    if (!dostupni.length) return;
    let najbolji = dostupni[0];
    for (const k of dostupni) {
      const razmak = Math.abs(k.pomak - trazeni);
      const dosad = Math.abs(najbolji.pomak - trazeni);
      if (razmak < dosad || (razmak === dosad && k.pomak > najbolji.pomak)) najbolji = k;
    }
    naPromjenu(najbolji.pomak);
  }

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-white/80 px-3 py-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
      <div className="shrink-0 leading-none">
        <span className="text-sm font-bold tabular-nums text-zinc-900">
          {satMjesno(odabrani.sat)}
        </span>
        <span
          className={`ml-1.5 text-[11px] ${prognoza ? "font-semibold text-violet-700" : "text-zinc-500"}`}
        >
          {prognoza ? "prognoza" : odabrani.vrsta === "sada" ? "sada" : danMjesno(odabrani.sat)}
        </span>
      </div>

      <div className="relative flex-1">
        {/* Prognozirani dio ima svoju podlogu: granica se mora vidjeti i kad
            nitko ne čita natpise. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-[7px] rounded-r-full bg-violet-200"
          style={{ left: `${udio(0)}%`, right: 0 }}
        />
        {/* Satovi koji su izračunati; ostali se još vrte u radnicima. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[7px] flex h-1.5 overflow-hidden rounded-full">
          {kadrovi.map((k) => (
            <span
              key={k.sat}
              className={`flex-1 ${
                k.dostupnost === "nedostupno"
                  ? "bg-zinc-300"
                  : izracunati.has(k.sat)
                    ? "bg-emerald-400/70"
                    : "bg-amber-300/60"
              }`}
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={prvi}
          max={zadnji}
          step={1}
          value={pomak}
          onChange={(e) => naKlizac(Number(e.target.value))}
          aria-label="Sat koji se prikazuje"
          aria-valuetext={`${satMjesno(odabrani.sat)}, ${danMjesno(odabrani.sat)}, ${opisKadra(odabrani)}`}
          className="fokus relative block w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-4 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[2px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:shadow"
        />
      </div>

      <button
        type="button"
        onClick={() => naKlizac(0)}
        aria-label="Vrati se na sadašnji sat"
        className="fokus shrink-0 rounded px-1.5 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        sada
      </button>
    </div>
  );
}
