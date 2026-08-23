"use client";

import type { Kadar } from "@/lib/sim/kadrovi";
import { imeIzvora } from "@/lib/sim/vrijeme-satno";

/**
 * Vjetar koji vodi kartu, u gornjem lijevom kutu.
 *
 * Ovo nije očitanje s jedne postaje nego ono što model uzima kao vjetar nad
 * plohom: najbliža postaja koja je za taj sat javila i brzinu i smjer, a kad
 * nijedna nije — model. Zato uz brojku uvijek stoji odakle je, jer razlika
 * između izmjerenog i modelskog vjetra ovdje mijenja cijelu kartu.
 *
 * Ruža je jedan potez, ne dijagram: strelica pokazuje **kamo** zrak ide, a
 * meteorološki smjer (odakle puše) stoji uz nju brojkom. To dvoje se stalno
 * brka, pa se crta ono što gledatelja zanima — kamo nosi — a piše ono što je
 * dogovoreni zapis.
 */

const STRANE = ["S", "SSI", "SI", "ISI", "I", "IJI", "JI", "JJI",
                "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ"] as const;

/** Ime strane svijeta iz koje puše. */
export function strana(smjerOd: number): string {
  return STRANE[Math.round((((smjerOd % 360) + 360) % 360) / 22.5) % 16];
}

function broj(x: number, decimala = 1): string {
  return x.toFixed(decimala).replace(".", ",");
}

export function VjetarKartica({ kadar }: { kadar: Kadar | null }) {
  const v = kadar?.vjetar;
  const tisina = v?.tisina ?? false;
  // Strelica pokazuje kamo nosi: suprotno od smjera iz kojega puše.
  const kut = v ? (v.smjerOd + 180) % 360 : 0;

  return (
    <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-white/80 py-1.5 pl-1.5 pr-3 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
      <svg
        viewBox="0 0 40 40"
        className="h-9 w-9 shrink-0"
        role="img"
        aria-label={
          v
            ? tisina
              ? "Tišina, vjetar praktički ne nosi"
              : `Vjetar iz ${strana(v.smjerOd)}, ${broj(v.brzina)} metara u sekundi`
            : "Vjetar za ovaj sat nije poznat"
        }
      >
        <circle cx="20" cy="20" r="17" className="fill-none stroke-zinc-300" strokeWidth="1" />
        {/* Sjever je jedina oznaka na ruži; ostale bi na ovoj veličini bile šum. */}
        <text x="20" y="7.5" textAnchor="middle" className="fill-zinc-400" fontSize="7" fontWeight="700">
          S
        </text>
        {v && !tisina ? (
          <g transform={`rotate(${kut} 20 20)`}>
            <path d="M20 8 L24.5 26 L20 22.5 L15.5 26 Z" className="fill-zinc-900" />
          </g>
        ) : (
          <circle cx="20" cy="20" r="3.5" className="fill-zinc-400" />
        )}
      </svg>

      <div className="leading-tight">
        {v ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tabular-nums text-zinc-900">
                {tisina ? "tišina" : `${broj(v.brzina)} m/s`}
              </span>
              {!tisina ? (
                <span className="text-sm font-semibold text-zinc-500">
                  {strana(v.smjerOd)}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-zinc-500">
              {kadar?.stanje ? <>sloj {kadar.stanje.dubina} m · </> : null}
              {imeIzvora(v.izvor)}
            </div>
          </>
        ) : (
          <div className="text-sm text-zinc-500">Vjetar nije poznat</div>
        )}
      </div>
    </div>
  );
}
