"use client";

import { useEffect, useRef } from "react";

/**
 * Kotačić za odabir, kakav nosi budilica na iPhoneu.
 *
 * Zašto kotačić, a ne padajući popis: dojava se ispunjava na mobitelu, jednim
 * palcem, često u mraku. Kotačić je jedan pokret palca preko nekoliko
 * vrijednosti odjednom, bez otvaranja i zatvaranja ičega, i zauzima stalnu
 * visinu — a upravo je visina ono što odlučuje hoće li cijeli obrazac stati
 * na jedan zaslon.
 *
 * Izveden je bez ijedne knjižnice: klizni okvir s `scroll-snap` hvata
 * vrijednosti, pojas u sredini pokazuje odabranu, a rubovi blijede maskom
 * (razred `.kotacic` u `globals.css`). Odabir se čita iz položaja klizanja,
 * pa prst radi ono što i na budilici.
 *
 * Pristupačnost je razlog zbog kojega ovo nije samo `div` koji se kliže:
 * svaka je vrijednost `option` u `listbox`-u, dohvatljiva tabom i strelicama,
 * pa kotačić radi i bez ijednog pokreta prstom. Tko ne želi gibanje
 * (`prefers-reduced-motion`), dobiva skok umjesto klizanja.
 */

/** Visina jednog retka u pikselima; mora se poklapati s `h-9` u razredu. */
const REDAK = 36;

/** Koliko redaka kotačić pokazuje; neparan broj, da sredina bude sredina. */
const REDAKA = 5;

export type StavkaKotacica<T> = {
  vrijednost: T;
  natpis: string;
};

export function Kotacic<T extends string | number>({
  stavke,
  vrijednost,
  promijeni,
  naslov,
  redaka = REDAKA,
}: {
  stavke: readonly StavkaKotacica<T>[];
  vrijednost: T;
  promijeni: (nova: T) => void;
  naslov: string;
  /** Koliko redaka kotačić pokazuje; manje za sporedne odabire. */
  redaka?: number;
}) {
  const okvir = useRef<HTMLDivElement>(null);
  const mirovanje = useRef<ReturnType<typeof setTimeout> | null>(null);
  const odabrani = Math.max(
    0,
    stavke.findIndex((s) => s.vrijednost === vrijednost),
  );

  // Kad se vrijednost promijeni izvana — recimo kad odabir dana odreže sate
  // koji su tek u budućnosti — kotačić se mora pomaknuti za njom.
  useEffect(() => {
    const el = okvir.current;
    if (!el) return;
    const cilj = odabrani * REDAK;
    if (Math.abs(el.scrollTop - cilj) < REDAK / 2) return;
    const mirno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: cilj, behavior: mirno ? "auto" : "smooth" });
  }, [odabrani]);

  function kliznuo() {
    const el = okvir.current;
    if (!el) return;
    if (mirovanje.current) clearTimeout(mirovanje.current);
    // Čita se tek kad prst stane: usput bi svaki međupoložaj javio svoju
    // vrijednost, pa bi se stanje mijenjalo desetak puta po pokretu.
    mirovanje.current = setTimeout(() => {
      const i = Math.round(el.scrollTop / REDAK);
      const stavka = stavke[Math.min(Math.max(i, 0), stavke.length - 1)];
      if (stavka && stavka.vrijednost !== vrijednost) promijeni(stavka.vrijednost);
    }, 90);
  }

  function tipka(e: React.KeyboardEvent, i: number) {
    const pomak = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!pomak) return;
    e.preventDefault();
    const sljedeci = stavke[i + pomak];
    if (sljedeci) promijeni(sljedeci.vrijednost);
  }

  return (
    <div className="relative" style={{ height: REDAK * redaka }}>
      {/* Pojas u sredini: pokazuje koja je vrijednost odabrana. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-lg bg-kamen-plitko"
        style={{ height: REDAK }}
      />
      <div
        ref={okvir}
        role="listbox"
        aria-label={naslov}
        tabIndex={-1}
        onScroll={kliznuo}
        className="kotacic h-full overflow-y-auto overscroll-contain scroll-smooth snap-y snap-mandatory"
        style={{
          paddingTop: REDAK * ((redaka - 1) / 2),
          paddingBottom: REDAK * ((redaka - 1) / 2),
        }}
      >
        {stavke.map((stavka, i) => (
          <div
            key={String(stavka.vrijednost)}
            role="option"
            aria-selected={i === odabrani}
            tabIndex={0}
            onClick={() => promijeni(stavka.vrijednost)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                promijeni(stavka.vrijednost);
              } else {
                tipka(e, i);
              }
            }}
            className={`fokus flex cursor-pointer snap-center items-center justify-center rounded-lg text-lg tabular-nums transition-colors ${
              i === odabrani
                ? "font-bold text-kamen-tinta"
                : "text-kamen-drugi"
            }`}
            style={{ height: REDAK }}
          >
            {stavka.natpis}
          </div>
        ))}
      </div>
    </div>
  );
}
