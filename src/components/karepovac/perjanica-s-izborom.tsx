"use client";

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { DimPerjanica } from "@/components/karepovac/dim-perjanica";
import type { ZaletnoPolje } from "@/lib/zrak";
import {
  type PoljeDima,
  type Ljestvica,
  MIRISNI_RASPON,
  PRAG_NA_LJESTVICI,
  type Tvar,
  TVARI,
  UBRZANJE,
  mirisneJedinice,
} from "@/lib/dim";

const TVARI_REDOM: readonly Tvar[] = ["sumporovodik", "merkaptani"];

/** Pretvara ljestvicu boja u CSS prijelaz, da traka i karta ne odu svaka svojim. */
function uGradijent(ljestvica: Ljestvica): string {
  const postaje = ljestvica
    .map(
      ([mjesto, [r, g, b, a]]) =>
        `rgb(${r} ${g} ${b} / ${(a / 255).toFixed(2)}) ${(mjesto * 100).toFixed(1)}%`,
    )
    .join(", ");
  return `linear-gradient(90deg, ${postaje})`;
}

function broj(x: number): string {
  return x.toLocaleString("hr-HR", { maximumFractionDigits: x < 1 ? 1 : 0 });
}

/**
 * Perjanica s izborom tvari i ljestvicom koja kaže što boja znači.
 *
 * Zašto izbor tvari, a ne dvije karte: sumporovodik i merkaptani izlaze iz
 * iste plohe i na ovoj udaljenosti putuju istim zrakom, pa je gibanje jedno.
 * Dvije su stvarne razlike. Prva: merkaptana ima više i osjete se pri mnogo
 * manjoj količini — to je razlika u ljestvici. Druga, iz mjerenja: merkaptani
 * izlaze kad se na plohi radi, pa se njihove čestice važu satnim profilom
 * izvora (`PROFIL_MERKAPTANA`) i noću njihova perjanica utihne ondje gdje
 * sumporovodikova, koja curi kroz pokrov stalno, i dalje stoji.
 *
 * Ljestvica je u mirisnim jedinicama: koliko je puta tvari više nego što treba
 * da se osjeti. Korak na traci je jedinica — ondje počinje smrad.
 *
 * Podloga i natpisi stižu kao `children` iz poslužiteljske komponente; ovdje
 * je klijentski samo ono što se doista mijenja klikom.
 */
export function PerjanicaSIzborom({
  polje,
  zalet,
  podloga,
  natpisi,
}: {
  /** Polje vjetra složeno za vjetar koji trenutačno puše. */
  polje: PoljeDima;
  /** Polja prethodnih sati za zalet; vidi `DimPerjanica`. */
  zalet?: readonly ZaletnoPolje[];
  /** Nepomični SVG ispod platna. */
  podloga: ReactNode;
  /** Nepomični SVG iznad platna. */
  natpisi: ReactNode;
}) {
  const [tvar, odaberi] = useState<Tvar>("sumporovodik");
  const [prosireno, postaviProsireno] = useState(false);
  const odabrana = TVARI[tvar];
  const okvir = useRef<HTMLDivElement>(null);
  const zatvarac = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!prosireno) return;

    const stariOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Dok je prizor povećan, ostatak stranice doista nije dostupan — isto
    // obećanje koje `aria-modal` daje čitaču zaslona.
    const promijenjeni: HTMLElement[] = [];
    let grana: HTMLElement | null = okvir.current;
    while (grana?.parentElement) {
      const roditelj = grana.parentElement;
      for (const dijete of roditelj.children) {
        if (dijete === grana || !(dijete instanceof HTMLElement) || dijete.inert)
          continue;
        dijete.inert = true;
        promijenjeni.push(dijete);
      }
      if (roditelj === document.body) break;
      grana = roditelj;
    }

    const fokus = requestAnimationFrame(() => zatvarac.current?.focus());
    const tipka = (dogadaj: KeyboardEvent) => {
      if (dogadaj.key === "Escape") {
        dogadaj.preventDefault();
        postaviProsireno(false);
      } else if (dogadaj.key === "Tab") {
        dogadaj.preventDefault();
        zatvarac.current?.focus();
      }
    };
    document.addEventListener("keydown", tipka);

    return () => {
      cancelAnimationFrame(fokus);
      document.removeEventListener("keydown", tipka);
      document.body.style.overflow = stariOverflow;
      for (const element of promijenjeni) element.inert = false;
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(
            '#vizualizacija-zraka button[data-part="expand-trigger"]',
          )
          ?.focus();
      });
    };
  }, [prosireno]);

  const zatvoriPozadinu = (dogadaj: MouseEvent<HTMLDivElement>) => {
    if (prosireno && dogadaj.target === dogadaj.currentTarget) {
      postaviProsireno(false);
    }
  };

  return (
    <div>
      <div
        ref={okvir}
        id="vizualizacija-zraka"
        data-component="VizualizacijaZraka"
        data-part="viewport"
        data-state={prosireno ? "expanded" : "inline"}
        role={prosireno ? "dialog" : undefined}
        aria-modal={prosireno || undefined}
        aria-label={prosireno ? "Povećana vizualizacija zraka" : undefined}
        onClick={zatvoriPozadinu}
        className={
          prosireno
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
            : "relative overflow-hidden rounded-lg border border-kamen-tlo"
        }
      >
        <div
          data-part="canvas-stack"
          className={
            prosireno
              ? "relative w-full max-w-7xl overflow-hidden rounded-xl bg-white"
              : "relative"
          }
        >
          {podloga}
          <DimPerjanica polje={polje} zalet={zalet} tvar={tvar} />
          {natpisi}
        </div>

        {prosireno ? (
          <button
            ref={zatvarac}
            type="button"
            onClick={() => postaviProsireno(false)}
            aria-label="Zatvori povećanu vizualizaciju zraka"
            className="fokus absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-kamen-tinta hover:bg-kamen-plitko"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            data-part="expand-trigger"
            onClick={() => postaviProsireno(true)}
            aria-label="Povećaj vizualizaciju zraka"
            aria-haspopup="dialog"
            className="fokus group absolute inset-0 z-20 cursor-zoom-in rounded-lg"
          >
            <span className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-kamen-rub bg-white/90 text-kamen-tinta group-hover:bg-white">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                <path
                  d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-kamen-drugi">Boja pokazuje:</span>
        {TVARI_REDOM.map((kljuc) => (
          <button
            key={kljuc}
            type="button"
            aria-pressed={kljuc === tvar}
            onClick={() => odaberi(kljuc)}
            className={`fokus inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              kljuc === tvar
                ? "border-kamen-tinta bg-kamen-tinta text-white"
                : "border-kamen-rub text-kamen-tekst hover:bg-white"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full"
              style={{
                background: `rgb(${TVARI[kljuc].ljestvica[4][1].slice(0, 3).join(" ")})`,
              }}
            />
            {TVARI[kljuc].naziv}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <div className="relative">
          <span
            aria-hidden="true"
            className="block h-2.5 rounded-full"
            style={{ background: uGradijent(odabrana.ljestvica) }}
          />
          {/* Prag mirisa je jedina točka na traci koja išta znači sama za sebe. */}
          <span
            aria-hidden="true"
            className="absolute top-0 h-2.5 w-px bg-kamen-tinta"
            style={{ left: `${(PRAG_NA_LJESTVICI * 100).toFixed(1)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-kamen-drugi">
          <span>{broj(MIRISNI_RASPON.od)}× praga</span>
          <span className="font-semibold text-kamen-tinta">osjeti se</span>
          <span>{broj(MIRISNI_RASPON.do)}× praga</span>
        </div>
      </div>

      <p className="mt-3 max-w-prose text-base leading-7 text-kamen-tekst">
        Vrijeme teče {UBRZANJE}× brže od stvarnoga: sekunda prikaza je minuta
        vjetra. Izvor ne ispušta u naletima nego neprekidno, kao što plin i curi
        kroz pokrov — a koliko ga se nad kvartom nakupi ovisi o tome odnosi li ga
        vjetar brže nego što dotječe. Kad je tišina, prizor potamni sam od sebe;
        kad zapuše, splasne.{" "}
        {odabrana.naziv.toLowerCase()} se na postaji uz plohu mjeri oko{" "}
        {broj(mirisneJedinice(tvar))} puta iznad praga na kojem se osjeti
        {tvar === "merkaptani"
          ? " — zato zrak može smrdjeti i u satu u kojem je sumporovodik uredan."
          : "."}
      </p>
    </div>
  );
}
