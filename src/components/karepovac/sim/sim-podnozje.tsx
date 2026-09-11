"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { StanjePogona } from "@/lib/sim/pogon";
import { VremenskaCrta, danMjesno, opisKadra, satMjesno } from "./vremenska-crta";
import { SimIkona } from "./sim-ikona";

export function SimPodnozje({ napredak, vjetar, status, upozorenje, ...vrijeme }: ComponentProps<typeof VremenskaCrta> & {
  napredak: StanjePogona;
  vjetar?: ReactNode;
  status?: ReactNode;
  upozorenje: boolean;
}) {
  const [otvorena, postaviOtvorenu] = useState(false);
  const gumb = useRef<HTMLButtonElement>(null);
  const model = useRef<HTMLDialogElement>(null);
  const kadar = vrijeme.crta.kadrovi.find((kadar) => kadar.pomak === vrijeme.pomak);
  const poruka = napredak.greska ?? (napredak.gotovo < napredak.ukupno ? `Računam ${napredak.gotovo}/${napredak.ukupno}` : "");
  const sazetak = napredak.greska || upozorenje ? "!" : poruka ? "…" : "i";

  function zatvori() {
    postaviOtvorenu(false);
    vrijeme.naReprodukciju(false);
    gumb.current?.focus();
  }

  return (
    <>
      {otvorena ? (
        <div id="sim-vrijeme" className="sim-ui-timePanel" onKeyDown={(event) => { if (event.key === "Escape") zatvori(); }}>
          <button type="button" className="fokus sim-ui-iconButton sim-ui-timeClose" aria-label="Zatvori vremensku crtu" onClick={zatvori}><SimIkona ime="close" /></button>
          <VremenskaCrta {...vrijeme} />
        </div>
      ) : null}
      <footer className="sim-ui-footer">
        <button ref={gumb} type="button" className="fokus sim-ui-timeToggle" aria-expanded={otvorena} aria-controls="sim-vrijeme" aria-label={kadar ? `Vremenska crta: ${danMjesno(kadar.sat)}, ${satMjesno(kadar.sat)}, ${opisKadra(kadar, vrijeme.sadaStvarno)}` : "Vremenska crta"} onClick={() => otvorena ? zatvori() : postaviOtvorenu(true)}>
          <span>{kadar ? satMjesno(kadar.sat) : "Vrijeme"}</span><SimIkona ime="chevron" />
        </button>
        <button type="button" className="fokus sim-ui-modelButton" onClick={() => model.current?.showModal()}>Model, ne mjerenje</button>
        {vjetar}
        <details className="sim-ui-wind sim-ui-health" onKeyDown={(event) => {
          if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
        }}>
          <summary className="fokus" aria-label={napredak.greska ? "Greška izračuna — pojedinosti" : upozorenje ? "Obavijesti — pojedinosti" : poruka ? "Izračun u tijeku — pojedinosti" : "Stanje podataka — pojedinosti"}><span role="status">{sazetak}</span></summary>
          <div className="sim-ui-windInfo">
            {poruka ? <p>{poruka}</p> : !upozorenje ? <p>Prikaz je spreman.</p> : null}
            {status}
          </div>
        </details>
      </footer>
      <dialog ref={model} className="sim-ui-model" aria-labelledby="sim-model-title" onClick={(event) => { if (event.target === event.currentTarget) model.current?.close(); }}>
        <div className="sim-ui-modelContent">
          <div className="sim-ui-settingsHeader"><h2 id="sim-model-title">Model, ne mjerenje</h2><button type="button" autoFocus className="fokus sim-ui-iconButton" aria-label="Zatvori objašnjenje modela" onClick={() => model.current?.close()}><SimIkona ime="close" /></button></div>
          <div className="sim-ui-help">
            <p>Oblaci prikazuju mogući prijenos tvari vjetrom. Širina i doseg nisu provjereni mjerenjem i ne potvrđuju gdje se miris osjeti.</p>
            <p>Merkaptani i sumporovodik imaju zasebne ljestvice. Svjetlije → tamnije znači manje → više u modelu, ne izmjerenu koncentraciju. Boje različitih tvari nisu međusobno usporedive.</p>
            <p>Blizu Karepovca vjetar prati detaljni reljef; dalje koristi satnu procjenu bez lokalnih detalja.</p>
            <p>Mjerenja pripadaju samo označenim mjernim postajama. Satni podaci ZZJZ-a nisu validirani.</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
