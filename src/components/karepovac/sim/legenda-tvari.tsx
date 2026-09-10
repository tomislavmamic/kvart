"use client";

import { TVARI, type Tvar } from "@/lib/dim";
import { bojaZa, uGradijent } from "@/lib/sim/ljestvica";
import type { PostavkePrikaza } from "@/components/karepovac/sim/sim-scena";
import { SimIkona } from "./sim-ikona";

const TVARI_REDOM: readonly Tvar[] = ["merkaptani", "sumporovodik"];

export function LegendaTvari({ prikaz, naPromjenu }: {
  prikaz: PostavkePrikaza;
  naPromjenu: (tvar: Tvar, vidljiv: boolean) => void;
}) {
  return (
    <div className="sim-ui-layers" role="group" aria-label="Tvari i ljestvice prikaza">
      {TVARI_REDOM.map((tvar) => {
        const postavke = prikaz.tvari[tvar];
        return (
          <button
            key={tvar}
            type="button"
            aria-pressed={postavke.vidljiv}
            aria-label={`${tvar === "sumporovodik" ? "H₂S (sumporovodik)" : TVARI[tvar].naziv}: ${postavke.vidljiv ? "prikazano" : "skriveno"}`}
            onClick={() => naPromjenu(tvar, !postavke.vidljiv)}
            className={`fokus sim-ui-layer`}
          >
            <SimIkona ime={postavke.vidljiv ? "check" : "minus"} />
            <span className={postavke.vidljiv ? "" : "text-zinc-500 line-through"}>{tvar === "merkaptani" ? "Merkaptani" : "H₂S"}</span>
            <span aria-hidden="true" className="sim-ui-ramp" style={{ background: uGradijent(bojaZa(postavke.boja, tvar).ljestvica) }} />
            <span className="sr-only">Ljestvica prikaza od manje prema više; nije mjerenje.</span>
            {postavke.jacina !== 1 ? <span className="sim-ui-multiplier">{postavke.jacina.toFixed(1).replace(".", ",")}×</span> : null}
          </button>
        );
      })}
    </div>
  );
}
