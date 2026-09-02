"use client";

import Link from "next/link";

import type { Ljestvica } from "@/lib/dim";
import type { Kadar } from "@/lib/sim/kadrovi";
import {
  RIJECI_POUZDANOSTI,
  RIJECI_RAZINA,
  RIJECI_TRENDA,
  stupanj,
  type Razina,
  type Situacija,
} from "@/lib/sim/situacija";
import { adresaDojave, imeTocke, type Tocka } from "@/lib/sim/tocka";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import { bojaRazine } from "@/components/karepovac/sim/razina-boje";
import { satMjesno } from "@/components/karepovac/sim/vremenska-crta";

/**
 * Kartica za kliknuto mjesto: „a kod mene?”
 *
 * Kartica situacije govori o naseljima; ova o jednoj točki koju je gledatelj
 * odabrao na karti. Nosi isto troje što i velika — razinu u riječima, trend i
 * pouzdanost — plus traku po satima **za to mjesto**, jer je pitanje „kad je
 * kod mene bilo i kad će biti” ono zbog čega netko uopće klikne. Ispod je
 * poziv na dojavu s tim mjestom već upisanim: model tvrdi, nos provjerava.
 *
 * Pouzdanost je ista kao na velikoj kartici (isti vjetar, isti sat), pa se ne
 * ponavlja s razlozima — samo riječ.
 */

const NASLOV: Readonly<Record<Razina, string>> = {
  nema: "Nema naznaka mirisa",
  moguce: "Moguć miris",
  slabo: "Slab miris",
  osjetno: "Osjetan miris",
  jako: "Jak miris",
};

export function TockaKartica({
  tocka,
  situacija,
  kadar,
  izracunat,
  ljestvica,
  poSatu,
  naZatvori,
  naSat,
}: {
  tocka: Tocka;
  situacija: Situacija;
  kadar: Kadar;
  izracunat: boolean;
  ljestvica: Ljestvica;
  /** Razina u točki po satu crte, redom kadrova; `null` dok sat nije izračunat. */
  poSatu: readonly { sat: string; pomak: number; vrsta: Kadar["vrsta"]; razina: Razina | null }[];
  naZatvori: () => void;
  naSat: (pomak: number) => void;
}) {
  const nedostupan = kadar.dostupnost === "nedostupno";
  const razina = situacija.razina;
  const nesigurno = situacija.pouzdanost === "niska";
  const promjena = situacija.promjena;
  const promjenaRijec =
    promjena && (stupanj(promjena.razina) < stupanj(razina) ? "slabije" : "jače");

  let naslov: string;
  if (nedostupan) naslov = "Nema podataka o vjetru";
  else if (!izracunat) naslov = "Računam ovaj sat…";
  else if (razina === "nema" && nesigurno) naslov = "Ne znamo pouzdano";
  else naslov = NASLOV[razina];

  return (
    <section
      aria-label="Situacija na odabranom mjestu"
      className="pointer-events-auto w-full rounded-lg bg-white/90 text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur-sm"
    >
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-zinc-500">
            Odabrano mjesto · {imeTocke(tocka, SIM_POLJE.izvor)}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ background: bojaRazine(izracunat && !nedostupan ? razina : "nema", ljestvica) }}
            />
            <h2 className="truncate text-base font-bold leading-tight">{naslov}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={naZatvori}
          aria-label="Makni odabrano mjesto"
          className="fokus -mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1.5 text-[12px] text-zinc-700">
        <span>
          trend: <b className="font-semibold">{RIJECI_TRENDA[situacija.trend]}</b>
        </span>
        <span>
          pouzdanost:{" "}
          <b className={`font-semibold ${nesigurno ? "text-amber-700" : ""}`}>
            {RIJECI_POUZDANOSTI[situacija.pouzdanost]}
          </b>
        </span>
        {promjena ? (
          <span>
            oko {satMjesno(promjena.sat).slice(0, 2)} h: <b className="font-semibold">{promjenaRijec}</b>{" "}
            <span className="text-zinc-500">({RIJECI_RAZINA[promjena.razina]})</span>
          </span>
        ) : null}
      </div>

      {/* Traka po satima za ovo mjesto: iste boje kao na velikoj crti, a klik
          na pločicu pomiče cijelu kartu na taj sat. */}
      <div className="px-3 pt-2" aria-label="Razina na ovom mjestu po satima">
        <div className="flex h-3 gap-px overflow-hidden rounded">
          {poSatu.map((s) => (
            <button
              key={s.sat}
              type="button"
              onClick={() => naSat(s.pomak)}
              title={`${satMjesno(s.sat)}: ${s.razina ? RIJECI_RAZINA[s.razina] : "još se računa"}`}
              aria-label={`${satMjesno(s.sat)}, ${s.razina ? RIJECI_RAZINA[s.razina] : "još se računa"}`}
              className={`min-w-0 flex-1 ${s.pomak === kadar.pomak ? "outline outline-2 outline-zinc-900" : ""} ${
                s.vrsta === "prognoza" ? "opacity-70" : ""
              }`}
              style={{
                background: s.razina ? bojaRazine(s.razina, ljestvica) : "#e4e4e7",
                backgroundImage:
                  s.vrsta === "prognoza"
                    ? "repeating-linear-gradient(135deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 5px)"
                    : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-zinc-500">
          <span>−24 h</span>
          <span>sada</span>
          <span>+3 h</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-[12px]">
        <span className="text-zinc-600">Osjećate li miris ovdje?</span>
        <Link
          href={adresaDojave(tocka)}
          className="fokus rounded-md bg-zinc-900 px-2.5 py-1 font-semibold text-white hover:bg-zinc-700"
        >
          Javi za ovo mjesto
        </Link>
      </div>
    </section>
  );
}
