"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

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
 * Tri stvari koje kotačić čine upotrebljivim i bez prsta — i istinitim:
 *
 * - **Jedno zaustavljanje tabulatorom, ne dvadeset četiri.** Popis je
 *   `listbox` s pomičnim `tabindex`: dohvatljiva je samo odabrana
 *   vrijednost, a strelice pomiču odabir i žarište zajedno. Bez toga bi se
 *   do sljedećeg polja stizalo kroz dvadeset četiri zaustavljanja.
 * - **Visina raste s tekstom.** Redak se mjeri u `rem`, a računica klizanja
 *   čita stvarnu visinu iz DOM-a, pa povećanje teksta na 200 % (WCAG 1.4.4)
 *   razmakne kotačić umjesto da odreže slova.
 * - **Ono što se vidi jest ono što se šalje.** Pri dolasku kotačić se
 *   namjesti *odmah*, bez animacije, u `useLayoutEffect` — prije nego što
 *   preglednik išta nacrta. Animirano namještanje od vrha (800 px za sat 23)
 *   u kartici otvorenoj u pozadini nikad se ne dovrši, pa je pojas pokazivao
 *   „00” dok je obrazac držao „23”; a `onScroll` je usput taj „00” i upisao.
 *   Zato se klizanje čita tek kad je kotačić namješten, a kartica koja se
 *   vrati u prvi plan ponovno se poravna sa stanjem.
 */

/** Visina retka u `rem`: 44 px pri 16 px, jer je svaki redak i cilj dodira. */
const REDAK_REM = 2.75;

/** Koliko redaka kotačić pokazuje; neparan broj, da sredina bude sredina. */
const REDAKA = 3;

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
  /** Koliko redaka kotačić pokazuje; više gdje ima mjesta. */
  redaka?: number;
}) {
  const okvir = useRef<HTMLDivElement>(null);
  const mirovanje = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Je li kotačić namješten na stanje; do tada se klizanje ne čita. */
  const namjesten = useRef(false);
  /** Cilj tekuće glatke vožnje, u px; klizanje se čita tek kad stigne. */
  const ciljVoznje = useRef<number | null>(null);
  const krajVoznje = useRef<ReturnType<typeof setTimeout> | null>(null);
  const odabrani = Math.max(
    0,
    stavke.findIndex((s) => s.vrijednost === vrijednost),
  );

  /** Stvarna visina retka; čita se iz DOM-a jer ovisi o veličini teksta. */
  function visinaRetka(el: HTMLDivElement): number {
    const prvi = el.firstElementChild as HTMLElement | null;
    return prvi?.getBoundingClientRect().height || 1;
  }

  /** Namješta kotačić na odabranu vrijednost; glatko samo ako se smije. */
  function namjesti(glatko: boolean) {
    const el = okvir.current;
    if (!el) return;
    const redak = visinaRetka(el);
    const cilj = odabrani * redak;
    if (Math.abs(el.scrollTop - cilj) < redak / 2) return;
    // `instant`, ne `auto`: razred `.scroll-smooth` na okviru pretvara `auto`
    // u animaciju, pa bi i tko je isključio pokrete dobio vrtnju.
    const mirno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (glatko && !mirno) {
      // Za vrijeme vožnje klizanje se ne čita: prekinuta animacija (kartica
      // skrivena na pola puta) inače bi upisala redak na kojem je stala, pa
      // bi poslano odstupilo od dodirnutog. Čita se opet kad stigne na cilj
      // ili, u krajnjem slučaju, poslije roka — vožnja od 24 retka traje kraće.
      namjesten.current = false;
      ciljVoznje.current = cilj;
      if (krajVoznje.current) clearTimeout(krajVoznje.current);
      krajVoznje.current = setTimeout(() => {
        ciljVoznje.current = null;
        namjesten.current = true;
      }, 800);
      el.scrollTo({ top: cilj, behavior: "smooth" });
      return;
    }
    el.scrollTo({ top: cilj, behavior: "instant" });
  }

  // Pri dolasku: odmah i bez animacije, prije prvog crtanja. Kotačić koji se
  // vrti pri učitavanju kriv je prvi dojam, a u pozadinskoj kartici se ta
  // vrtnja ni ne dovrši.
  useLayoutEffect(() => {
    namjesti(false);
    namjesten.current = true;
    // Namještanje ide samo pri dolasku i kad se popis zamijeni; kasnije
    // promjene vrijednosti vodi učinak ispod, animirano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stavke.length]);

  // Kad se vrijednost promijeni izvana — recimo kad odabir sata odreže minute
  // koje su tek u budućnosti — kotačić se mora pomaknuti za njom.
  useEffect(() => {
    namjesti(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odabrani]);

  // Kartica vraćena u prvi plan: što god se u pozadini dogodilo s
  // klizanjem, pojas se poravna sa stanjem, a ne obrnuto.
  useEffect(() => {
    function poravnaj() {
      if (document.visibilityState === "visible") namjesti(false);
    }
    document.addEventListener("visibilitychange", poravnaj);
    return () => document.removeEventListener("visibilitychange", poravnaj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odabrani]);

  function kliznuo() {
    const el = okvir.current;
    if (!el) return;
    if (!namjesten.current) {
      // Glatka vožnja stigla na cilj: od sada se klizanje opet čita.
      if (ciljVoznje.current !== null && Math.abs(el.scrollTop - ciljVoznje.current) < 1) {
        ciljVoznje.current = null;
        namjesten.current = true;
      }
      return;
    }
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
