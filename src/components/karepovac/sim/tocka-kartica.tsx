"use client";

import Link from "next/link";
import { useRef } from "react";

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
import { pomakIzUdjela } from "@/components/karepovac/sim/vremenska-crta-logika";

/**
 * Kartica za kliknuto mjesto: „a kod mene?”
 *
 * Kartica situacije govori o naseljima; ova o jednoj točki koju je gledatelj
 * odabrao na karti. Nosi isto troje što i velika — razinu u riječima, trend i
 * pouzdanost — plus traku po satima **za to mjesto**, jer je pitanje „kad je
 * kod mene bilo i kad će biti” ono zbog čega netko uopće klikne. Ispod je
 * poziv na dojavu s tim mjestom i satom već upisanim: model tvrdi, nos
 * provjerava.
 *
 * Traka po satima je jedan klizač (kao velika traka), ne 28 gumba od 12 px:
 * pločice ostaju tanke da kartica ne naraste, a cilj dodira je cijela visina
 * od 44 px. Strelice idu sat po sat.
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
  stara = false,
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
  /** Je li crta starija od sata; tada sredina trake nije „sada” nego „zadnje”. */
  stara?: boolean;
  naZatvori: () => void;
  naSat: (pomak: number) => void;
}) {
  const traka = useRef<HTMLDivElement>(null);
  const nedostupan = kadar.dostupnost === "nedostupno";
  const razina = situacija.razina;
  const nesigurno = situacija.pouzdanost === "niska";
  const promjena = situacija.promjena;
  const promjenaRijec =
    promjena && (stupanj(promjena.razina) < stupanj(razina) ? "slabije" : "jače");
  const prvi = poSatu[0]?.pomak ?? 0;
  const zadnji = poSatu[poSatu.length - 1]?.pomak ?? 0;
  const n = poSatu.length || 1;
  const odabrani = poSatu.find((s) => s.pomak === kadar.pomak);

  let naslov: string;
  if (nedostupan) naslov = "Nema podataka o vjetru";
  else if (!izracunat) naslov = "Računam ovaj sat…";
  else if (razina === "nema" && nesigurno) naslov = "Ne znamo pouzdano";
  else naslov = NASLOV[razina];

  function izPokazivaca(e: React.PointerEvent<HTMLDivElement>) {
    const el = traka.current;
    if (!el) return;
    const okvir = el.getBoundingClientRect();
    const udio = (e.clientX - okvir.left) / okvir.width;
    const p = pomakIzUdjela(udio - 0.5 / n, prvi, zadnji);
    if (p !== kadar.pomak) naSat(p);
  }

  return (
    <section
      aria-label="Situacija na odabranom mjestu"
      // Na telefonu ispod nje mora ostati traka sati: iznad 45 % visine lista se
      // unutar sebe (kratka je, pa do toga rijetko dođe).
      className="pointer-events-auto max-h-[45vh] w-full overflow-y-auto rounded-lg bg-white/90 text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur-sm sm:max-h-none"
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
          className="fokus -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
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
          <b className={`font-semibold ${nesigurno ? "underline decoration-dotted underline-offset-2" : ""}`}>
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

      {/* Traka po satima za ovo mjesto: iste boje kao na velikoj crti; potez
          ili strelice pomiču cijelu kartu na taj sat. Klizač je visok 44 px,
          pločice u njemu 12 px. */}
      <div className="px-3 pt-1">
        <div
          ref={traka}
          role="slider"
          tabIndex={0}
          aria-label="Razina na ovom mjestu po satima"
          aria-valuemin={prvi}
          aria-valuemax={zadnji}
          aria-valuenow={kadar.pomak}
          aria-valuetext={`${satMjesno(kadar.sat)}: ${
            odabrani?.razina ? RIJECI_RAZINA[odabrani.razina] : "još se računa"
          }`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            izPokazivaca(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) izPokazivaca(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              if (kadar.pomak > prvi) naSat(kadar.pomak - 1);
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              if (kadar.pomak < zadnji) naSat(kadar.pomak + 1);
            } else if (e.key === "Home") {
              e.preventDefault();
              naSat(prvi);
            } else if (e.key === "End") {
              e.preventDefault();
              naSat(zadnji);
            }
          }}
          className="fokus flex h-11 cursor-pointer touch-none select-none items-center rounded"
        >
          <div aria-hidden="true" className="flex h-3 w-full gap-px overflow-hidden rounded">
            {poSatu.map((s) => (
              <span
                key={s.sat}
                title={`${satMjesno(s.sat)}: ${s.razina ? RIJECI_RAZINA[s.razina] : "još se računa"}`}
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
        </div>
        <div aria-hidden="true" className="-mt-2 flex justify-between text-[10px] text-zinc-500">
          <span>−24 h</span>
          <span>{stara ? "zadnje" : "sada"}</span>
          <span>+3 h</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-zinc-200 px-3 py-2 text-[12px]">
        <span className="text-zinc-600">Osjećate li miris ovdje?</span>
        <Link
          href={adresaDojave(tocka, kadar.sat)}
          prefetch={false}
          className="fokus flex min-h-11 items-center rounded-full bg-maslina px-3.5 font-semibold text-white hover:bg-maslina-tamna"
        >
          Javi za ovo mjesto
        </Link>
      </div>
    </section>
  );
}
