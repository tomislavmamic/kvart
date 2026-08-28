"use client";

import { TVARI, type Tvar } from "@/lib/dim";
import { BOJE, JACINA, bojaZa, uGradijent } from "@/lib/sim/ljestvica";
import type { PostavkePrikaza } from "@/components/karepovac/sim/sim-scena";
import type { Podloga } from "@/components/karepovac/sim/sim-karta";

/**
 * Ploča s postavkama: tvari, vjetar, podloga i postaje.
 *
 * Podjela nije po tome kako je unutra složeno nego po tome što gledatelj pita.
 * „Što gledam” su tvari, „kuda ide” je vjetar, „gdje sam” je podloga, „tko to
 * mjeri” su postaje.
 *
 * Kod jačine izvora ploča mora biti izričita. Klizač ne mijenja prozirnost
 * nego pita „što bi bilo da ploha ispušta ovoliko puta više”, a to je
 * pretpostavka, ne mjerenje. Zato uz svaku vrijednost osim jedinice stoji da
 * je riječ o zamišljenom slučaju.
 */

const TVARI_REDOM: readonly Tvar[] = ["sumporovodik", "merkaptani"];

function Naslov({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
      {children}
    </h3>
  );
}

function Prekidac({
  ukljucen,
  naPromjenu,
  children,
}: {
  ukljucen: boolean;
  naPromjenu: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-zinc-800">
      <input
        type="checkbox"
        checked={ukljucen}
        onChange={(e) => naPromjenu(e.target.checked)}
        className="fokus h-4 w-4 rounded border-zinc-400 accent-zinc-900"
      />
      {children}
    </label>
  );
}

export type PloceStanje = {
  readonly prikaz: PostavkePrikaza;
  readonly podloga: Podloga;
  readonly reljef: boolean;
  readonly zgrade: boolean;
  readonly postaje: boolean;
};

export function UpravljackaPloca({
  stanje,
  naPrikaz,
  naStanje,
  naSredinu,
}: {
  stanje: PloceStanje;
  naPrikaz: (p: PostavkePrikaza) => void;
  naStanje: (p: Partial<PloceStanje>) => void;
  naSredinu: () => void;
}) {
  function postaviTvar(tvar: Tvar, promjena: Partial<PostavkePrikaza["tvari"][Tvar]>) {
    naPrikaz({
      ...stanje.prikaz,
      tvari: { ...stanje.prikaz.tvari, [tvar]: { ...stanje.prikaz.tvari[tvar], ...promjena } },
    });
  }

  return (
    <div className="space-y-5 p-4">
      {/* Ograda stoji prva i ne da se zatvoriti. Perjanicu ovdje računa model
          čestica, građen da pokaže kuda zrak ide — ne da pogodi koliko ga
          ima. Bazdareni model raspršenja na istim satima daje drukčiju sliku,
          pa bi prešutjeti razliku značilo prikaz predstaviti kao predviđanje. */}
      <aside className="rounded-lg border-l-[3px] border-amber-500 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-zinc-700">
        <b className="text-zinc-900">Ovo je prikaz, ne mjerenje.</b> Perjanicu
        crta model čestica: pokazuje kuda zrak ide, ali širina i doseg nisu
        provjereni mjerenjem. Bazdareni model raspršenja na istim satima daje
        užu perjanicu pri umjerenom vjetru. Boja je usidrena na medijan
        izmjeren na postaji uz plohu — jedina točka u kojoj se prikaz i
        mjerenje dodiruju.
      </aside>

      <section>
        <Naslov>Što gledam</Naslov>
        <div className="space-y-4">
          {TVARI_REDOM.map((tvar) => {
            const t = stanje.prikaz.tvari[tvar];
            const boja = bojaZa(t.boja, tvar);
            return (
              <div key={tvar} className="rounded-lg border border-zinc-200 p-3">
                <Prekidac
                  ukljucen={t.vidljiv}
                  naPromjenu={(v) => postaviTvar(tvar, { vidljiv: v })}
                >
                  <span className="font-semibold">{TVARI[tvar].naziv}</span>
                  <span className="text-zinc-500">{TVARI[tvar].kratica}</span>
                </Prekidac>

                <span
                  aria-hidden="true"
                  className="mt-1 block h-2 rounded-full"
                  style={{ background: uGradijent(boja.ljestvica) }}
                />

                <div className="mt-3">
                  <label className="flex items-center justify-between text-xs text-zinc-600">
                    Boja
                    <select
                      value={t.boja}
                      onChange={(e) => postaviTvar(tvar, { boja: e.target.value })}
                      aria-label={`Boja za ${TVARI[tvar].naziv}`}
                      className="fokus ml-2 min-h-9 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
                    >
                      {BOJE.map((b) => (
                        <option key={b.kljuc} value={b.kljuc}>
                          {b.naziv}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-zinc-600" htmlFor={`jacina-${tvar}`}>
                    Jačina izvora
                    <span className="ml-1 font-semibold tabular-nums text-zinc-900">
                      {t.jacina.toFixed(1).replace(".", ",")}×
                    </span>
                  </label>
                  <input
                    id={`jacina-${tvar}`}
                    type="range"
                    min={JACINA.najmanja}
                    max={JACINA.najveca}
                    step={JACINA.korak}
                    value={t.jacina}
                    onChange={(e) => postaviTvar(tvar, { jacina: Number(e.target.value) })}
                    aria-valuetext={
                      t.jacina === 1
                        ? "zadana jačina prikaza"
                        : `${t.jacina.toFixed(1).replace(".", ",")} puta jače od zadanog — zamišljeni slučaj`
                    }
                    className="fokus mt-1 w-full cursor-pointer accent-zinc-900"
                  />
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {t.jacina === 0
                      ? "Ploha ne ispušta ništa."
                      : Math.abs(t.jacina - 1) < 0.05
                        ? "Zadana jačina — ona pri kojoj boja odgovara medijanu izmjerenom na postaji."
                        : `Zamišljeni slučaj: ${t.jacina.toFixed(1).replace(".", ",")}× od zadanog.`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <Naslov>Kuda ide</Naslov>
        <Prekidac
          ukljucen={stanje.prikaz.vjetar}
          naPromjenu={(v) => naPrikaz({ ...stanje.prikaz, vjetar: v })}
        >
          Tragovi vjetra
        </Prekidac>
        <p className="ml-6.5 text-xs leading-5 text-zinc-500">
          Svaki trag je čestica zraka; rep pokazuje odakle je došla, a koliko
          brzo putuje toliko ondje puše.
        </p>
      </section>

      <section>
        <Naslov>Podloga</Naslov>
        <div className="mb-2 flex gap-2">
          {(["karta", "ortofoto"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={stanje.podloga === p}
              onClick={() => naStanje({ podloga: p })}
              className={`fokus min-h-9 flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                stanje.podloga === p
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {p === "karta" ? "Ulična karta" : "Ortofoto"}
            </button>
          ))}
        </div>
        <Prekidac ukljucen={stanje.reljef} naPromjenu={(v) => naStanje({ reljef: v })}>
          Sjenčani reljef
        </Prekidac>
        {stanje.reljef ? (
          <p className="-mt-1 mb-1 text-xs leading-5 text-zinc-500">
            Pločice reljefa izrađene su za uži okvir oko kvarta, pa sjenčanje
            prestaje prije ruba karte. Ondje gdje ga nema, teren nije ravan —
            samo nije snimljen za ovaj prikaz.
          </p>
        ) : null}
        <Prekidac ukljucen={stanje.zgrade} naPromjenu={(v) => naStanje({ zgrade: v })}>
          Zgrade
        </Prekidac>
        <Prekidac ukljucen={stanje.postaje} naPromjenu={(v) => naStanje({ postaje: v })}>
          Mjerne postaje
        </Prekidac>
        <button
          type="button"
          onClick={naSredinu}
          className="fokus mt-2 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Vrati na Karepovac
        </button>
      </section>

      <section>
        <Naslov>Tko to mjeri</Naslov>
        <p className="text-xs leading-5 text-zinc-600">
          Brojke stoje na karti, uz samu točku mjerenja — pitanje je koliko je
          bilo <i>ondje</i>, a ploča na to ne može odgovoriti.
        </p>
        <p className="mt-1.5 text-xs leading-5 text-zinc-500">
          Satne tablice Zavoda za javno zdravstvo SDŽ, nevalidirane — Zavod ih
          naknadno provjerava. Postaje vjetra objavljuju samo zadnje očitanje,
          pa im brojka stoji tek dok je klizač na sadašnjem satu.
        </p>
      </section>
    </div>
  );
}
