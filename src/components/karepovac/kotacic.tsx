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
 * Dvije stvari koje kotačić čine upotrebljivim i bez prsta:
 *
 * - **Jedno zaustavljanje tabulatorom, ne dvadeset četiri.** Popis je
 *   `listbox` s pomičnim `tabindex`: dohvatljiva je samo odabrana
 *   vrijednost, a strelice pomiču odabir i žarište zajedno. Bez toga bi se
 *   do sljedećeg polja stizalo kroz dvadeset četiri zaustavljanja.
 * - **Visina raste s tekstom.** Redak se mjeri u `rem`, a računica klizanja
 *   čita stvarnu visinu iz DOM-a, pa povećanje teksta na 200 % (WCAG 1.4.4)
 *   razmakne kotačić umjesto da odreže slova.
 */

/** Visina retka u `rem`; raste s postavkom veličine teksta. */
const REDAK_REM = 2.25;

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

  /** Stvarna visina retka; čita se iz DOM-a jer ovisi o veličini teksta. */
  function visinaRetka(el: HTMLDivElement): number {
    const prvi = el.firstElementChild as HTMLElement | null;
    return prvi?.getBoundingClientRect().height || 1;
  }

  // Kad se vrijednost promijeni izvana — recimo kad odabir dana odreže sate
  // koji su tek u budućnosti — kotačić se mora pomaknuti za njom.
  useEffect(() => {
    const el = okvir.current;
    if (!el) return;
    const redak = visinaRetka(el);
    const cilj = odabrani * redak;
    if (Math.abs(el.scrollTop - cilj) < redak / 2) return;
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
      const i = Math.round(el.scrollTop / visinaRetka(el));
      const stavka = stavke[Math.min(Math.max(i, 0), stavke.length - 1)];
      if (stavka && stavka.vrijednost !== vrijednost) promijeni(stavka.vrijednost);
    }, 90);
  }

  function tipka(e: React.KeyboardEvent<HTMLDivElement>) {
    const pomak =
      e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : e.key === "Home" ? -odabrani
      : e.key === "End" ? stavke.length - 1 - odabrani : 0;
    if (!pomak) return;
    e.preventDefault();
    const sljedeci = stavke[odabrani + pomak];
    if (!sljedeci) return;
    promijeni(sljedeci.vrijednost);
    // Žarište ide za odabirom, inače bi tabulator poslije strelice skočio
    // natrag na staru vrijednost.
    const el = okvir.current;
    const cilj = el?.children[odabrani + pomak] as HTMLElement | undefined;
    cilj?.focus();
  }

  return (
    <div className="relative" style={{ height: `${redaka * REDAK_REM}rem` }}>
      {/* Pojas u sredini: pokazuje koja je vrijednost odabrana.
          Stoji ispod popisa, ne iznad njega — položeni element inače crta
          preko sadržaja koji nije položen, pa je pojas prekrivao upravo
          odabranu vrijednost i ona je nestajala. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-lg bg-kamen-plitko"
        style={{ height: `${REDAK_REM}rem` }}
      />
      <div
        ref={okvir}
        role="listbox"
        aria-label={naslov}
        onScroll={kliznuo}
        className="kotacic relative z-10 h-full overflow-y-auto overscroll-contain scroll-smooth snap-y snap-mandatory"
        style={{
          paddingTop: `${((redaka - 1) / 2) * REDAK_REM}rem`,
          paddingBottom: `${((redaka - 1) / 2) * REDAK_REM}rem`,
        }}
      >
        {stavke.map((stavka, i) => (
          <div
            key={String(stavka.vrijednost)}
            role="option"
            aria-selected={i === odabrani}
            // Pomični tabindex: samo odabrana vrijednost je zaustavljanje.
            tabIndex={i === odabrani ? 0 : -1}
            onClick={() => promijeni(stavka.vrijednost)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                promijeni(stavka.vrijednost);
              } else {
                tipka(e);
              }
            }}
            className={`fokus flex cursor-pointer snap-center items-center justify-center rounded-lg text-lg tabular-nums transition-colors ${
              i === odabrani ? "font-bold text-kamen-tinta" : "text-kamen-tekst"
            }`}
            style={{ height: `${REDAK_REM}rem` }}
          >
            {stavka.natpis}
          </div>
        ))}
      </div>
    </div>
  );
}
