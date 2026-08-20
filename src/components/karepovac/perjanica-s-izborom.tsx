"use client";

import { type ReactNode, useState } from "react";

import { DimPerjanica } from "@/components/karepovac/dim-perjanica";
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
 * iste plohe i na ovoj udaljenosti putuju istim zrakom. Nacrtati ih kao dvije
 * perjanice različitog oblika bila bi izmišljotina. Razlika koja postoji je
 * druga i veća — merkaptana ima više, a osjete se pri mnogo manjoj količini,
 * pa se isti zrak koji je za sumporovodik na rubu osjetljivosti za merkaptane
 * odavno smrdi. Zato se mijenja ljestvica, a ne gibanje.
 *
 * Ljestvica je u mirisnim jedinicama: koliko je puta tvari više nego što treba
 * da se osjeti. Korak na traci je jedinica — ondje počinje smrad.
 *
 * Podloga i natpisi stižu kao `children` iz poslužiteljske komponente; ovdje
 * je klijentski samo ono što se doista mijenja klikom.
 */
export function PerjanicaSIzborom({
  polje,
  podloga,
  natpisi,
}: {
  /** Polje vjetra složeno za vjetar koji trenutačno puše. */
  polje: PoljeDima;
  /** Nepomični SVG ispod platna. */
  podloga: ReactNode;
  /** Nepomični SVG iznad platna. */
  natpisi: ReactNode;
}) {
  const [tvar, odaberi] = useState<Tvar>("sumporovodik");
  const odabrana = TVARI[tvar];

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-kamen-tlo">
        <div className="relative">
          {podloga}
          <DimPerjanica polje={polje} tvar={tvar} />
          {natpisi}
        </div>
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
