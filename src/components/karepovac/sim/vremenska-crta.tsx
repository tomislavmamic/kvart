"use client";

import { useEffect } from "react";

import { SimIkona } from "./sim-ikona";

import { najbliziDostupan, type Crta, type Kadar } from "@/lib/sim/kadrovi";
import { danMjesno, oznakaSata, satMjesno, zastarjela } from "@/lib/sim/oznaka-sata";
import { KORAK_REPRODUKCIJE_MS, sljedeciZaReprodukciju } from "@/components/karepovac/sim/vremenska-crta-logika";

export { danMjesno, satMjesno };

export function opisKadra(kadar: Kadar, sadaStvarno?: Date): string {
  if (kadar.dostupnost === "nedostupno") return "nema podataka";
  if (sadaStvarno) return oznakaSata(kadar, sadaStvarno);
  if (kadar.vrsta === "prognoza") return `prognoza +${kadar.pomak} h`;
  if (kadar.vrsta === "sada") return "sada";
  return "izmjereno";
}

export function VremenskaCrta({
  crta, pomak, izracunati, reproducira, sadaStvarno,
  naReprodukciju, naPromjenu,
}: {
  crta: Crta;
  pomak: number;
  izracunati: ReadonlySet<string>;
  reproducira: boolean;
  sadaStvarno: Date;
  naReprodukciju: (vrijednost: boolean) => void;
  naPromjenu: (pomak: number) => void;
}) {
  const kadrovi = crta.kadrovi;
  const prvi = kadrovi[0];
  const zadnji = kadrovi[kadrovi.length - 1];
  const odabrani = kadrovi.find((kadar) => kadar.pomak === pomak) ?? prvi;
  const dostupni = kadrovi.filter((kadar) => kadar.dostupnost !== "nedostupno");
  const stara = zastarjela(crta.sada, sadaStvarno);

  useEffect(() => {
    if (!reproducira) return;
    const timer = window.setInterval(() => {
      const sljedeci = sljedeciZaReprodukciju(kadrovi, pomak);
      if (sljedeci === null) naReprodukciju(false);
      else naPromjenu(sljedeci);
    }, KORAK_REPRODUKCIJE_MS);
    return () => window.clearInterval(timer);
  }, [reproducira, kadrovi, pomak, naPromjenu, naReprodukciju]);

  if (!prvi || !zadnji || !odabrani) return null;

  function odaberi(trazeni: number) {
    const kadar = najbliziDostupan(crta, trazeni);
    if (kadar) {
      naReprodukciju(false);
      naPromjenu(kadar.pomak);
    }
  }

  return (
    <section aria-label="Vrijeme simulacije" className="sim-ui-timeline">
      <div className="sim-ui-timeHeader">
        <time className="sim-ui-time" dateTime={odabrani.sat}>{satMjesno(odabrani.sat)}</time>
        <span className="sim-ui-date">{danMjesno(odabrani.sat)} · {opisKadra(odabrani, sadaStvarno)}</span>
      </div>
      <div className="sim-ui-trackRow">
        <button
          type="button"
          disabled={dostupni.length < 2}
          onClick={() => naReprodukciju(!reproducira)}
          aria-pressed={reproducira}
          aria-label={reproducira ? "Zaustavi prikaz po satima" : "Pokreni prikaz po satima"}
          className={`fokus sim-ui-iconButton sim-ui-play`}
        >
          <SimIkona ime={reproducira ? "pause" : "play"} />
        </button>
        <div className="sim-ui-track">
          <div className="sim-ui-availability" aria-hidden="true">
            {kadrovi.map((kadar) => (
              <span
                key={kadar.sat}
                className="sim-ui-frame"
                data-state={kadar.dostupnost === "nedostupno" ? "missing" : izracunati.has(kadar.sat) ? "ready" : "pending"}
                data-forecast={kadar.vrsta === "prognoza"}
              />
            ))}
          </div>
        <input
          type="range"
          min={prvi.pomak}
          max={zadnji.pomak}
          step={1}
          value={pomak}
          disabled={!dostupni.length}
          aria-label="Sat koji se prikazuje"
          aria-valuetext={`${satMjesno(odabrani.sat)}, ${danMjesno(odabrani.sat)}, ${opisKadra(odabrani, sadaStvarno)}`}
          onChange={(event) => odaberi(Number(event.target.value))}
          onKeyDown={(event) => {
            const smjer = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
            if (smjer) {
              event.preventDefault();
              const sljedeci = smjer > 0 ? dostupni.find((kadar) => kadar.pomak > pomak) : dostupni.findLast((kadar) => kadar.pomak < pomak);
              if (sljedeci) odaberi(sljedeci.pomak);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              odaberi(event.key === "Home" ? prvi.pomak : zadnji.pomak);
            }
          }}
          className={`fokus sim-ui-range`}
        />
          <div className="sim-ui-ticks" aria-hidden="true">
            <span>{satMjesno(prvi.sat)}</span>
            <span>{satMjesno(zadnji.sat)}</span>
          </div>
        </div>
        <button type="button" disabled={!dostupni.length} onClick={() => odaberi(crta.pomakSada)} className={`fokus sim-ui-button`}>
          {stara ? "Zadnje" : "Sada"}
        </button>
      </div>
    </section>
  );
}
