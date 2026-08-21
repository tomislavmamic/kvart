"use client";

import { useId } from "react";

import type { Crta, Kadar } from "@/lib/sim/kadrovi";

/**
 * Klizač po satima, s vidljivom granicom između izmjerenog i prognoziranog.
 *
 * Granica je jedina stvar koju ova traka mora reći bez riječi. Sat unatrag i
 * sat unaprijed izgledaju na karti jednako — ista perjanica, iste boje — a
 * jedan je ono što se dogodilo, a drugi nagađanje. Zato prognozirani dio ima
 * svoju podlogu i crtkani rub, a odabrani sat uz sebe uvijek nosi i riječ.
 *
 * Satovi koje nijedan izvor nije pokrio ne daju se odabrati: klizač preko njih
 * preskače na najbliži koji postoji. Prazan kadar bi inače izgledao kao čist
 * zrak, a to je najgora moguća laž na ovoj karti.
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

/** Sat u mjesnom vremenu; karta se gleda po satu na zidu, ne po UTC-u. */
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

  const udio = (p: number) =>
    zadnji === prvi ? 0 : ((p - prvi) / (zadnji - prvi)) * 100;

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
    <div className="pointer-events-auto rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tabular-nums text-zinc-900">
            {satMjesno(odabrani.sat)}
          </span>
          <span className="text-sm text-zinc-500">{danMjesno(odabrani.sat)}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            odabrani.vrsta === "prognoza"
              ? "bg-violet-100 text-violet-800"
              : odabrani.vrsta === "sada"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {opisKadra(odabrani)}
        </span>
      </div>

      <div className="relative">
        {/* Prognozirani dio trake ima svoju podlogu: granica se mora vidjeti
            i kad nitko ne čita natpise. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 rounded-r bg-violet-100"
          style={{ left: `${udio(0)}%`, right: 0 }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-violet-400"
          style={{ left: `${udio(0)}%` }}
        />
        {/* Satovi koji su izračunati; ostali se još vrte u radnicima. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1">
          {kadrovi.map((k) => (
            <span
              key={k.sat}
              className={`flex-1 ${
                k.dostupnost === "nedostupno"
                  ? "bg-zinc-300"
                  : izracunati.has(k.sat)
                    ? "bg-emerald-400"
                    : "bg-amber-200"
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
          className="fokus relative w-full cursor-pointer appearance-none bg-transparent py-2 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-200 [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:shadow"
        />
      </div>

      <div className="flex justify-between text-xs tabular-nums text-zinc-500">
        <span>−24 h</span>
        <button
          type="button"
          onClick={() => naKlizac(0)}
          className="fokus rounded px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          sada
        </button>
        <span>+{zadnji} h</span>
      </div>
    </div>
  );
}
