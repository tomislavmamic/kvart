"use client";

import { useState } from "react";

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
import { imeIzvora } from "@/lib/sim/vrijeme-satno";
import { bojaRazine } from "@/components/karepovac/sim/razina-boje";
import { strana } from "@/components/karepovac/sim/vjetar-kartica";
import { danMjesno, opisKadra, satMjesno } from "@/components/karepovac/sim/vremenska-crta";

/**
 * Kartica situacije: ono što karta mora reći u pet sekundi.
 *
 * Redoslijed je redoslijed pitanja: **koliko** (razina, velikim slovima i
 * bojom), **gdje** (naselja koja perjanica dotiče), **kamo ide** (strelica),
 * **bolje ili gore** (trend), **koliko ste sigurni** (pouzdanost, uz „zašto?”
 * koji otvara razloge) i **kad se mijenja** (sljedeći sat s drugom razinom).
 * Sve ostalo — vjetar, sloj, izvor — stoji sitno ispod, a postavke iza
 * gumba „Više”.
 *
 * Dva pravila prikaza koja se ne daju zaobići:
 *
 * - **„Ne znamo” nije „čisto”.** Kad je pouzdanost niska, a perjanica ne
 *   dotiče naselja, kartica ne kaže „nema mirisa” nego da se ne zna; isto
 *   za sat koji još nije izračunat ili nema vjetra.
 * - **Riječi i boje su iste kao na karti i traci** (`razina-boje.ts`);
 *   legenda pri dnu ponavlja iste tri riječi da se karta dade čitati.
 */

/** Naslov po razini, u obliku koji stoji sam: „Moguć miris”, ne „moguće miris”. */
const NASLOV: Readonly<Record<Exclude<Razina, "nema">, string>> = {
  moguce: "Moguć miris",
  slabo: "Slab miris",
  osjetno: "Osjetan miris",
  jako: "Jak miris",
};

function Plocica({ razina, ljestvica, velika = false }: { razina: Razina; ljestvica: Ljestvica; velika?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 ${velika ? "h-5 w-5" : "h-2.5 w-2.5"}`}
      style={{ backgroundColor: bojaRazine(razina, ljestvica) }}
    />
  );
}

function Strelica({ azimut }: { azimut: number }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <g transform={`rotate(${azimut} 10 10)`}>
        <path d="M10 2.5 L14 12 L10 10 L6 12 Z" fill="currentColor" />
        <path d="M10 9v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function IkonaTrenda({ trend }: { trend: Situacija["trend"] }) {
  if (trend === "nepoznato") return <span aria-hidden="true" className="text-zinc-400">·</span>;
  const kut = trend === "gore" ? -35 : trend === "bolje" ? 35 : 0;
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <g transform={`rotate(${kut} 10 10)`}>
        <path d="M3 10h13M12 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function broj(x: number, decimala = 1): string {
  return x.toFixed(decimala).replace(".", ",");
}

export function SituacijaKartica({
  situacija,
  kadar,
  izracunat,
  ljestvica,
  prijedlozi = false,
  naVise,
  plocaOtvorena,
}: {
  situacija: Situacija;
  kadar: Kadar | null;
  /** Je li radnik sliku za ovaj sat već isporučio. */
  izracunat: boolean;
  /** Ljestvica tvari koja se gleda; iz nje su boje pločica. */
  ljestvica: Ljestvica;
  /** Jesu li na karti predložene postaje; tada legenda objašnjava točke. */
  prijedlozi?: boolean;
  naVise: () => void;
  plocaOtvorena: boolean;
}) {
  const [zasto, postaviZasto] = useState(false);
  if (!kadar) return null;

  const nedostupan = kadar.dostupnost === "nedostupno";
  const zahvacena = situacija.podrucja.filter((p) => p.razina !== "nema");
  const nesigurno = situacija.pouzdanost === "niska";
  const prognoza = kadar.vrsta === "prognoza";

  let naslov: string;
  let podnaslov: string | null = null;
  let razinaNaslova: Razina = situacija.razina;
  if (nedostupan) {
    naslov = "Nema podataka o vjetru";
    podnaslov = "Za ovaj sat nijedan izvor nije javio vjetar, pa se perjanica ne može izračunati.";
    razinaNaslova = "nema";
  } else if (!izracunat) {
    naslov = "Računam ovaj sat…";
    podnaslov = "Perjanica stiže za koju sekundu.";
    razinaNaslova = "nema";
  } else if (situacija.razina === "nema") {
    naslov = nesigurno ? "Ne znamo pouzdano" : "Nema naznaka mirisa u naseljima";
    podnaslov = nesigurno
      ? "Model za ovaj sat nema pouzdan vjetar, pa „ništa” ne znači „čisto”."
      : "Perjanica ne dotiče nijedno naselje oko plohe.";
  } else {
    naslov = NASLOV[situacija.razina];
    podnaslov = null;
  }

  const v = kadar.vjetar;
  const promjena = situacija.promjena;
  const promjenaRijec =
    promjena && (stupanj(promjena.razina) < stupanj(situacija.razina) ? "slabije" : "jače");

  return (
    <section
      aria-label="Situacija za odabrani sat"
      className="pointer-events-auto w-full rounded-xl bg-white/92 shadow-md ring-1 ring-black/5 backdrop-blur-sm"
    >
      <div className="px-3.5 pt-2.5">
        {/* Koji sat gledamo, i je li to prošlost ili nagađanje. */}
        <div className="flex items-center gap-2 text-[11px] leading-4 text-zinc-500">
          <span className="font-semibold tabular-nums text-zinc-800">{satMjesno(kadar.sat)}</span>
          <span className={prognoza ? "font-semibold text-violet-700" : ""}>
            {prognoza
              ? `prognoza +${kadar.pomak} h`
              : kadar.vrsta === "sada"
                ? "sada"
                : `${danMjesno(kadar.sat)}, prije ${-kadar.pomak} h`}
          </span>
          {!prognoza && situacija.izvorVjetra === "model" ? (
            <span
              className="rounded bg-violet-100 px-1 py-px text-[10px] font-semibold text-violet-800"
              title="Nijedna postaja nije javila vjetar; uzet je iz modela."
            >
              vjetar iz modela
            </span>
          ) : null}
        </div>

        {/* Koliko: jedna riječ, jedna boja. Čitaču zaslona ide jedna rečenica
            po satu, jer se naslov mijenja i s tipkovnicom i s reprodukcijom,
            a slider javlja samo sat. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {`${satMjesno(kadar.sat)}, ${opisKadra(kadar)}: ${naslov.toLowerCase()}, pouzdanost ${
            RIJECI_POUZDANOSTI[situacija.pouzdanost]
          }`}
        </p>
        <div className="mt-1 flex items-center gap-2.5">
          <Plocica razina={razinaNaslova} ljestvica={ljestvica} velika />
          <h2 className="text-lg font-bold leading-6 text-zinc-900">{naslov}</h2>
        </div>
        {/* Rečenica koju stanovnik čita: 1rem, ne gusto (Reading-Size Rule). */}
        {podnaslov ? <p className="mt-0.5 text-base leading-6 text-zinc-700">{podnaslov}</p> : null}

        {/* Gdje: naselja koja perjanica dotiče, od najjačeg. */}
        {zahvacena.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {[...zahvacena]
              .sort((a, b) => stupanj(b.razina) - stupanj(a.razina) || b.zahvacenost - a.zahvacenost)
              .map((p) => (
                <li
                  key={p.podrucje.id}
                  className="flex items-center gap-1.5 text-sm leading-5 text-zinc-800"
                  title={`Perjanica pokriva oko ${Math.round(p.zahvacenost * 100)} % naselja`}
                >
                  <Plocica razina={p.razina} ljestvica={ljestvica} />
                  <span className="font-semibold">{p.podrucje.naziv}</span>
                  <span className="text-zinc-500">{RIJECI_RAZINA[p.razina]}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </div>

      {/* Kamo, bolje ili gore, koliko sigurno. */}
      <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-200/80 px-3.5 py-2 text-xs leading-5 text-zinc-700">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Kamo nosi</dt>
          <dd className="flex items-center gap-1.5">
            {situacija.nosi ? (
              <>
                <Strelica azimut={situacija.nosi.azimut} />
                <span>nosi {situacija.nosi.opis}</span>
              </>
            ) : (
              <span className="text-zinc-500">{v?.tisina ? "tišina, ne nosi nikamo" : "smjer nije poznat"}</span>
            )}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Trend</dt>
          <dd className="flex items-center gap-1.5">
            <IkonaTrenda trend={situacija.trend} />
            <span>{RIJECI_TRENDA[situacija.trend]}</span>
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Pouzdanost</dt>
          <dd className="flex items-center gap-1">
            <span>
              pouzdanost{" "}
              {/* Riječ nosi značenje sama; boja izvan palete (jantar) bi
                  glumila upozorenje koje sustav boja ne poznaje. */}
              <b className={nesigurno ? "text-zinc-900 underline decoration-dotted underline-offset-2" : "text-zinc-900"}>
                {RIJECI_POUZDANOSTI[situacija.pouzdanost]}
              </b>
            </span>
            <button
              type="button"
              onClick={() => postaviZasto((z) => !z)}
              aria-expanded={zasto}
              className="fokus -my-2 min-h-11 rounded px-1.5 font-semibold text-maslina underline decoration-dotted underline-offset-2 hover:bg-maslina-vez"
            >
              zašto?
            </button>
          </dd>
        </div>
        {promjena && promjenaRijec ? (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Sljedeća promjena</dt>
            <dd>
              oko {satMjesno(promjena.sat).slice(0, 2)} h: <b className="text-zinc-900">{promjenaRijec}</b>{" "}
              <span className="text-zinc-500">({RIJECI_RAZINA[promjena.razina]})</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {zasto ? (
        <ul className="mx-3.5 mb-2 list-disc space-y-1 rounded-lg bg-zinc-50 py-2 pl-7 pr-3 text-base leading-6 text-zinc-700">
          {situacija.razlozi.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {/* Sitno: vjetar koji vodi kartu, legenda i put do postavki. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200/80 px-3.5 py-1.5 text-[11px] leading-4 text-zinc-500">
        {v ? (
          <span>
            vjetar{" "}
            <b className="text-zinc-700">{v.tisina ? "tišina" : `${broj(v.brzina)} m/s iz ${strana(v.smjerOd)}`}</b>
            {kadar.stanje ? <> · sloj {kadar.stanje.dubina} m</> : null}
            {kadar.izvor ? <> · {imeIzvora(kadar.izvor)}</> : null}
          </span>
        ) : (
          <span>vjetar nije poznat</span>
        )}
        <span className="ml-auto flex items-center gap-2" aria-label="Legenda boja">
          {(["moguce", "osjetno", "jako"] as const).map((r) => (
            <span key={r} className="flex items-center gap-1">
              <Plocica razina={r} ljestvica={ljestvica} />
              {RIJECI_RAZINA[r]}
            </span>
          ))}
          {prijedlozi ? (
            <span className="flex items-center gap-1" title="Mjesta gdje bi se isplatilo mjeriti; klik na točku kaže što i pošto">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-maslina" />
              predložene postaje
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={naVise}
          aria-expanded={plocaOtvorena}
          className="fokus -my-2 min-h-11 min-w-11 rounded px-2.5 font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          {plocaOtvorena ? "Zatvori" : "Više"}
        </button>
      </div>
    </section>
  );
}
