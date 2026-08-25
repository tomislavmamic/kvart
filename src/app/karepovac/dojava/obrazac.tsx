"use client";

import { useState } from "react";

import { Kotacic } from "@/components/karepovac/kotacic";
import { prijaviMiris } from "@/lib/actions/public";
import { ODOUR_STRENGTHS, ODOUR_STRENGTH_SHORT } from "@/lib/constants";
import type { OdourStrength } from "@/lib/constants";
import { imeSata, satiZaDan, uRasponu, uTrenutak } from "@/lib/dojava-vrijeme";
import { oznakaDojavitelja, zaboraviDojavitelja } from "@/lib/dojavitelj";
import { uOkviru, zaokruziMjesto } from "@/lib/mjesto";

/**
 * Obrazac je pisan za mobitel u ruci, na ulici, u mraku — i za jedan zaslon.
 *
 * Duljina je ovdje osobina, ne posljedica. Dojava se ispunjava u trenutku u
 * kojem netko stoji vani i osjeti miris; ako obrazac traži klizanje, dio
 * ljudi odustane na pola, a odustali dojavitelj nije podatak.
 *
 * Odatle izbori koje treba znati prije mijenjanja:
 *
 * - **Kotačić umjesto kalendara i tipkovnice.** Dan i sat biraju se kao na
 *   budilici (`Kotacic`): jedan pokret palca, stalna visina.
 * - **Nema biranja datuma.** Miris se javlja dok se pamti — danas ili jučer.
 * - **Kraj se pita tek kad ga netko ima.** Dva gumba stoje uvijek, kotačić
 *   sati pojavi se samo onome tko je odabrao „prestalo je”; inače bi
 *   sporedno pitanje uzelo trećinu zaslona.
 * - **Svaka skupina ima vidljiv natpis.** Kotačić bez natpisa je zagonetka:
 *   vrijednosti se vide, ali ne i pitanje na koje odgovaraju.
 */

/** Koliko dana unatrag obrazac dopušta; poslužitelj drži isto ograničenje. */
const DANA_UNATRAG = 30;

type StanjeMjesta =
  | { vrsta: "nema" }
  | { vrsta: "trazim" }
  | { vrsta: "imam"; lat: number; lng: number }
  | { vrsta: "odbijeno" }
  | { vrsta: "izvan" };

/** Veliki gumb-izbor; prst, ne miš. */
const IZBOR =
  "fokus-unutar flex min-h-12 cursor-pointer items-center justify-center "
  + "rounded-xl border border-kamen-rub bg-white px-3 text-center text-base "
  + "font-semibold text-kamen-tinta hover:bg-kamen-plitko "
  + "has-checked:border-maslina has-checked:bg-maslina-vez "
  + "has-checked:text-maslina-noc";

/** Natpis skupine; govori na koje pitanje polja ispod odgovaraju. */
const NATPIS = "block text-base font-bold text-kamen-tinta";

export function ObrazacDojave() {
  const [smrdi, setSmrdi] = useState(true);
  const [jacina, setJacina] = useState<OdourStrength>("osjetno");
  const [danas, setDanas] = useState(true);
  const [sat, setSat] = useState(() => new Date().getHours());
  const [kraj, setKraj] = useState<"traje" | "prestalo" | null>(null);
  const [krajSata, setKrajSata] = useState<number | null>(null);
  const [mjesto, setMjesto] = useState<StanjeMjesta>({ vrsta: "nema" });
  const [zaboravljen, setZaboravljen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const dopusteniSati = satiZaDan(danas);
  const najveciSat = dopusteniSati[dopusteniSati.length - 1];
  const satiKotacica = dopusteniSati.map((i) => ({
    vrijednost: i,
    natpis: imeSata(i),
  }));
  const krajeviSati = Array.from({ length: Math.max(0, najveciSat - sat) }, (_, i) => ({
    vrijednost: sat + 1 + i,
    natpis: imeSata(sat + 1 + i),
  }));

  function odaberiDan(noviDanas: boolean) {
    setDanas(noviDanas);
    if (noviDanas && sat > new Date().getHours()) setSat(new Date().getHours());
    setKraj(null);
    setKrajSata(null);
  }

  function odaberiSat(noviSat: number) {
    setSat(noviSat);
    if (krajSata !== null && krajSata <= noviSat) setKrajSata(null);
  }

  function trazimMjesto() {
    if (!navigator.geolocation) {
      setMjesto({ vrsta: "odbijeno" });
      return;
    }
    setMjesto({ vrsta: "trazim" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const tocka = { lat: coords.latitude, lng: coords.longitude };
        if (!uOkviru(tocka)) {
          setMjesto({ vrsta: "izvan" });
          return;
        }
        // Zaokružuje se odmah, prije nego što išta ode s uređaja.
        setMjesto({ vrsta: "imam", ...zaokruziMjesto(tocka) });
      },
      () => setMjesto({ vrsta: "odbijeno" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function posalji(formData: FormData) {
    setPending(true);
    setError(null);
    const pocetak = uTrenutak(danas, sat);
    if (!uRasponu(pocetak, DANA_UNATRAG)) {
      setPending(false);
      setError("Javiti se može za zadnjih trideset dana.");
      return;
    }
    formData.set("kada", pocetak.toISOString());
    formData.set("smelled", smrdi ? "da" : "ne");
    if (smrdi) formData.set("strength", jacina);
    if (smrdi && kraj === "prestalo" && krajSata !== null) {
      formData.set("doKada", uTrenutak(danas, krajSata).toISOString());
    } else {
      formData.delete("doKada");
    }
    formData.set("ongoing", smrdi && kraj === "traje" ? "1" : "0");
    const moja = oznakaDojavitelja();
    if (moja) formData.set("reporterId", moja);
    if (mjesto.vrsta === "imam") {
      formData.set("lat", String(mjesto.lat));
      formData.set("lng", String(mjesto.lng));
    }
    const rezultat = await prijaviMiris(formData);
    setPending(false);
    if (rezultat.ok) setDone(true);
    else setError(rezultat.error);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-maslina-rub bg-maslina-vez p-5 text-maslina-noc">
        <h2 className="text-xl font-bold">Zabilježeno. Hvala.</h2>
        <p className="mt-2 text-base leading-7">
          {smrdi
            ? "Dojavu spajamo s izmjerenim vjetrom za taj sat."
            : "I sat bez mirisa se broji — bez njega se ne zna koliko je često smrdjelo."}
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setError(null);
          }}
          className="fokus mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-maslina font-semibold text-maslina-tamna hover:bg-white"
        >
          Javi još jednu
        </button>
      </div>
    );
  }

  return (
    <form action={posalji} className="space-y-4">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <fieldset>
        <legend className="sr-only">Je li se osjetio miris</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { kljuc: true, natpis: "Smrdjelo je" },
            { kljuc: false, natpis: "Nije smrdjelo" },
          ].map((izbor) => (
            <label key={String(izbor.kljuc)} className={IZBOR}>
              <input
                type="radio"
                name="smrdi-izbor"
                checked={smrdi === izbor.kljuc}
                onChange={() => setSmrdi(izbor.kljuc)}
                className="sr-only"
              />
              {izbor.natpis}
            </label>
          ))}
        </div>
      </fieldset>

      {smrdi && (
        <fieldset>
          <legend className={NATPIS}>Koliko jako?</legend>
          {/* Dva po dva, ne četiri u redu: „nepodnošljivo” u redu od četiri
              traži sitna slova, a stranicu čitaju i oči kojima sitno ne ide. */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(ODOUR_STRENGTHS).map(([kljuc]) => (
              <label key={kljuc} className={IZBOR}>
                <input
                  type="radio"
                  name="strength"
                  value={kljuc}
                  checked={jacina === kljuc}
                  onChange={() => setJacina(kljuc as OdourStrength)}
                  className="sr-only"
                />
                {ODOUR_STRENGTH_SHORT[kljuc as OdourStrength]}
              </label>
            ))}
          </div>
          {/* Puna rečenica odabrane jačine: na mobitelu nema pokazivača, pa
              opis mora stajati na zaslonu, a ne u `title`. */}
          <p className="mt-2 text-base leading-6 text-kamen-drugi">
            {ODOUR_STRENGTHS[jacina]}
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend className={NATPIS}>{smrdi ? "Kada je počelo?" : "Kada?"}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-kamen-rub bg-white px-2 py-1">
          <Kotacic
            stavke={[
              { vrijednost: "jucer", natpis: "Jučer" },
              { vrijednost: "danas", natpis: "Danas" },
            ]}
            vrijednost={danas ? "danas" : "jucer"}
            promijeni={(v) => odaberiDan(v === "danas")}
            naslov="Dan"
          />
          <Kotacic
            stavke={satiKotacica}
            vrijednost={sat}
            promijeni={odaberiSat}
            naslov="Sat"
          />
        </div>
      </fieldset>

      {smrdi && (
        <fieldset>
          <legend className={NATPIS}>
            Traje li još?{" "}
            <span className="font-normal text-kamen-drugi">(nije obavezno)</span>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { kljuc: "traje" as const, natpis: "Još traje" },
              { kljuc: "prestalo" as const, natpis: "Prestalo je" },
            ].map((izbor) => (
              <label key={izbor.kljuc} className={IZBOR}>
                <input
                  type="radio"
                  name="kraj-izbor"
                  checked={kraj === izbor.kljuc}
                  onChange={() => {
                    setKraj(izbor.kljuc);
                    if (izbor.kljuc === "traje") setKrajSata(null);
                    else if (krajSata === null && krajeviSati.length > 0) {
                      setKrajSata(krajeviSati[0].vrijednost);
                    }
                  }}
                  className="sr-only"
                />
                {izbor.natpis}
              </label>
            ))}
          </div>
          {kraj === "prestalo" && krajeviSati.length > 0 && (
            <div className="mt-2 rounded-xl border border-kamen-rub bg-white px-2 py-1">
              <Kotacic
                stavke={krajeviSati}
                vrijednost={krajSata ?? krajeviSati[0].vrijednost}
                promijeni={setKrajSata}
                naslov="Sat u kojem je prestalo"
                redaka={3}
              />
            </div>
          )}
          {kraj === "prestalo" && krajeviSati.length === 0 && (
            <p className="mt-2 text-base leading-6 text-kamen-drugi">
              Za taj sat nema kasnijeg sata na koji bi miris mogao prestati.
            </p>
          )}
        </fieldset>
      )}

      <div>
        <span className={NATPIS}>Gdje ste bili?</span>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
          {mjesto.vrsta === "imam" ? (
            <button
              type="button"
              onClick={() => setMjesto({ vrsta: "nema" })}
              className="fokus flex min-h-12 items-center justify-center rounded-xl border border-maslina bg-maslina-vez px-4 text-base font-semibold text-maslina-noc"
            >
              Lokacija uzeta · ukloni
            </button>
          ) : (
            <button
              type="button"
              onClick={trazimMjesto}
              disabled={mjesto.vrsta === "trazim"}
              className="fokus flex min-h-12 items-center justify-center rounded-xl border border-kamen-rub bg-white px-4 text-base font-semibold text-kamen-tinta hover:bg-kamen-plitko disabled:opacity-60"
            >
              {mjesto.vrsta === "trazim" ? "Tražim…" : "Uzmi lokaciju"}
            </button>
          )}
          <input
            type="text"
            name="place"
            maxLength={120}
            autoComplete="street-address"
            aria-label="Najbliža adresa"
            placeholder="Najbliža adresa"
            className="fokus block min-h-12 w-full rounded-xl border border-kamen-rub bg-white px-4 text-base text-kamen-tinta placeholder:text-kamen-drugi"
          />
        </div>
        {mjesto.vrsta === "imam" && (
          <p className="mt-2 text-base leading-6 text-kamen-drugi">
            Zabilježena je zaokružena na stotinjak metara, još u vašem
            pregledniku.
          </p>
        )}
        {mjesto.vrsta === "odbijeno" && (
          <p className="mt-2 text-base leading-6 text-kamen-drugi">
            Preglednik nije dao lokaciju. Upišite najbližu adresu — i to je
            dovoljno.
          </p>
        )}
        {mjesto.vrsta === "izvan" && (
          <p className="mt-2 text-base leading-6 text-kamen-drugi">
            Lokacija je izvan Dračevca i Bilica, pa je ne bilježimo. Adresa
            ostaje.
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-odbijeno bg-rose-50 px-4 py-3 text-base leading-7 text-odbijeno-tamna"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="fokus flex min-h-14 w-full items-center justify-center rounded-full bg-maslina text-lg font-semibold text-white transition-colors hover:bg-maslina-tamna disabled:opacity-60"
      >
        {pending ? "Šaljem…" : "Pošalji dojavu"}
      </button>

      <p className="text-base leading-6 text-kamen-drugi">
        Ne tražimo ni ime ni kontakt. Preglednik pamti nasumičan broj, da se
        dvije vaše dojave u istom satu ne broje kao dvoje ljudi.{" "}
        {zaboravljen ? (
          <span className="font-semibold text-maslina-tamna">
            Obrisano. Sljedeća dojava kreće kao nova.
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              zaboraviDojavitelja();
              setZaboravljen(true);
            }}
            className="fokus rounded font-semibold text-maslina-tamna underline underline-offset-4"
          >
            Obriši taj broj
          </button>
        )}
      </p>
    </form>
  );
}
