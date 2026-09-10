"use client";

import { TVARI, type Tvar } from "@/lib/dim";
import { BOJE, JACINA } from "@/lib/sim/ljestvica";
import type { PostavkePrikaza } from "@/components/karepovac/sim/sim-scena";
import type { Podloga } from "@/components/karepovac/sim/sim-karta";
import { SimIkona } from "./sim-ikona";

const TVARI_REDOM: readonly Tvar[] = ["merkaptani", "sumporovodik"];

function Prekidac({ ukljucen, naPromjenu, children }: {
  ukljucen: boolean;
  naPromjenu: (vrijednost: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="sim-ui-settingRow">
      <input type="checkbox" checked={ukljucen} onChange={(event) => naPromjenu(event.target.checked)} className="fokus" />
      <span>{children}</span>
    </label>
  );
}

export type PloceStanje = {
  readonly prikaz: PostavkePrikaza;
  readonly podloga: Podloga;
  readonly reljef: boolean;
  readonly zgrade: boolean;
  readonly postaje: boolean;
  /** Predložene mjerne postaje iz zahtjeva #28, kao oznake na karti. */
  readonly prijedlozi: boolean;
};


export function UpravljackaPloca({ stanje, naPrikaz, naStanje, naSredinu }: {
  stanje: PloceStanje;
  naPrikaz: (prikaz: PostavkePrikaza) => void;
  naStanje: (promjena: Partial<PloceStanje>) => void;
  naSredinu: () => void;
}) {
  function postaviTvar(tvar: Tvar, promjena: Partial<PostavkePrikaza["tvari"][Tvar]>) {
    naPrikaz({
      ...stanje.prikaz,
      tvari: { ...stanje.prikaz.tvari, [tvar]: { ...stanje.prikaz.tvari[tvar], ...promjena } },
    });
  }

  return (
    <div className="sim-ui-settingsBody">
      <Prekidac ukljucen={stanje.prikaz.vjetar} naPromjenu={(vjetar) => naPrikaz({ ...stanje.prikaz, vjetar })}>Tragovi vjetra</Prekidac>
      <Prekidac ukljucen={stanje.postaje} naPromjenu={(postaje) => naStanje({ postaje })}>Mjerne postaje</Prekidac>

      <h3 className="sim-ui-settingHeading">Podloga</h3>
      <div className="sim-ui-basemap" role="group" aria-label="Podloga karte">
        {(["karta", "ortofoto"] as const).map((podloga) => (
          <button key={podloga} type="button" aria-pressed={stanje.podloga === podloga} onClick={() => naStanje({ podloga })} className="fokus">
            {podloga === "karta" ? "Ulična karta" : "Ortofoto"}
          </button>
        ))}
      </div>

      <details className="sim-ui-disclosure">
        <summary className="fokus">Slojevi karte<SimIkona ime="chevron" /></summary>
        <Prekidac ukljucen={stanje.reljef} naPromjenu={(reljef) => naStanje({ reljef })}>Sjenčani reljef</Prekidac>
        <Prekidac ukljucen={stanje.zgrade} naPromjenu={(zgrade) => naStanje({ zgrade })}>Zgrade</Prekidac>
        <Prekidac ukljucen={stanje.prijedlozi} naPromjenu={(prijedlozi) => naStanje({ prijedlozi })}>Predložene postaje</Prekidac>
      </details>

      <details className="sim-ui-disclosure">
        <summary className="fokus">Napredno<SimIkona ime="chevron" /></summary>
        {TVARI_REDOM.map((tvar) => {
          const postavke = stanje.prikaz.tvari[tvar];
          return (
            <section key={tvar} className="sim-ui-species" aria-label={TVARI[tvar].naziv}>
              <h3 className="sim-ui-settingHeading">{TVARI[tvar].naziv}</h3>
              <label className="sim-ui-settingRow">
                Boja
                <select value={postavke.boja} onChange={(event) => postaviTvar(tvar, { boja: event.target.value })} aria-label={`Boja za ${TVARI[tvar].naziv}`} className="fokus">
                  {BOJE.map((boja) => <option key={boja.kljuc} value={boja.kljuc}>{boja.naziv}</option>)}
                </select>
              </label>
              <label className="sim-ui-settingRow" htmlFor={`jacina-${tvar}`}>
                Jačina izvora
                <span className="sim-ui-sourceValue">{postavke.jacina.toFixed(1).replace(".", ",")}×</span>
              </label>
              <input
                id={`jacina-${tvar}`}
                type="range"
                min={JACINA.najmanja}
                max={JACINA.najveca}
                step={JACINA.korak}
                value={postavke.jacina}
                onChange={(event) => postaviTvar(tvar, { jacina: Number(event.target.value) })}
                aria-valuetext={postavke.jacina === 1 ? "zadana jačina prikaza" : `${postavke.jacina.toFixed(1).replace(".", ",")} puta jače od zadanog — zamišljeni slučaj`}
                className={`fokus sim-ui-range`}
              />
              <p className="sim-ui-help">
                {postavke.jacina === 0 ? "Ploha ne ispušta ništa." : postavke.jacina === 1 ? "Zadana jačina prikaza." : `Zamišljeni slučaj: ${postavke.jacina.toFixed(1).replace(".", ",")}× od zadanog.`}
              </p>
            </section>
          );
        })}
      </details>

      <details className="sim-ui-disclosure">
        <summary className="fokus">O prikazu<SimIkona ime="chevron" /></summary>
        <div className="sim-ui-help">
          <p>Ovo je prikaz, ne mjerenje. Širina i doseg nisu provjereni mjerenjem.</p>
          <p>Svaka tvar ima vlastitu ljestvicu: svjetlije → tamnije znači manje → više u modelu, ne izmjerenu koncentraciju.</p>
          <p>Mjerenja su uz samu točku mjerenja. Satni podaci ZZJZ-a nisu validirani.</p>
          <p>Obuhvat prati vjetar i vijek čestica. Blizu Karepovca vjetar prati detaljni reljef; dalje koristi satnu procjenu bez lokalnih detalja. Širi prikaz nije potvrda dosega mirisa.</p>
        </div>
      </details>

      <button type="button" onClick={naSredinu} className={`fokus sim-ui-button`}>
        <SimIkona ime="locate" />Vrati na Karepovac
      </button>
    </div>
  );
}
