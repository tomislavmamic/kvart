"use client";

import { useState } from "react";

import { prijaviMiris } from "@/lib/actions/public";
import { NEIGHBORHOODS, ODOUR_STRENGTHS } from "@/lib/constants";
import { oznakaDojavitelja, zaboraviDojavitelja } from "@/lib/dojavitelj";
import { uOkviru, zaokruziMjesto } from "@/lib/mjesto";

/** Koliko unatrag obrazac dopušta; isto ograničenje stoji i na poslužitelju. */
const DANA_UNATRAG = 30;

function lokalnoZaUnos(vrijeme: Date) {
  const pomak = vrijeme.getTimezoneOffset() * 60_000;
  return new Date(vrijeme.getTime() - pomak).toISOString().slice(0, 16);
}

type StanjeMjesta =
  | { vrsta: "nema" }
  | { vrsta: "trazim" }
  | { vrsta: "imam"; lat: number; lng: number }
  | { vrsta: "odbijeno" }
  | { vrsta: "izvan" };

/** Kartica koja objašnjava zašto se traži mjesto i što se od njega pamti. */
function GumbMjesta({
  stanje,
  trazi,
  odustani,
}: {
  stanje: StanjeMjesta;
  trazi: () => void;
  odustani: () => void;
}) {
  if (stanje.vrsta === "imam") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-maslina-rub bg-maslina-vez px-4 py-3">
        <span className="text-base font-semibold text-maslina-noc">
          Mjesto zabilježeno
        </span>
        <span className="text-base text-maslina-tamna">
          zaokruženo na ~100 m
        </span>
        <button
          type="button"
          onClick={odustani}
          className="fokus ml-auto min-h-11 rounded-lg px-3 text-base font-semibold text-maslina-tamna underline underline-offset-4"
        >
          Ukloni
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={trazi}
        disabled={stanje.vrsta === "trazim"}
        className="fokus inline-flex min-h-11 items-center gap-2 rounded-lg border border-kamen-rub bg-white px-4 py-2.5 text-base font-semibold text-kamen-tinta hover:bg-kamen-plitko disabled:opacity-60"
      >
        {stanje.vrsta === "trazim" ? "Tražim…" : "Uzmi moje mjesto"}
      </button>
      {stanje.vrsta === "odbijeno" && (
        <span className="ml-3 text-base text-kamen-drugi">
          Preglednik nije dao mjesto — kvart ispod je dovoljan.
        </span>
      )}
      {stanje.vrsta === "izvan" && (
        <span className="ml-3 text-base text-kamen-drugi">
          Mjesto je izvan kvarta, pa ga ne pamtimo.
        </span>
      )}
    </div>
  );
}

export function ObrazacDojave() {
  const sada = new Date();
  const [smrdi, setSmrdi] = useState(true);
  const [kada, setKada] = useState(() => lokalnoZaUnos(sada));
  const [doKada, setDoKada] = useState("");
  const [josTraje, setJosTraje] = useState(false);
  const [mjesto, setMjesto] = useState<StanjeMjesta>({ vrsta: "nema" });
  const [zaboravljen, setZaboravljen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

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
        // Zaokružuje se odmah, prije nego što išta ode s uređaja: točnija
        // koordinata modelu ne treba, a o dojavitelju govori previše.
        setMjesto({ vrsta: "imam", ...zaokruziMjesto(tocka) });
      },
      () => setMjesto({ vrsta: "odbijeno" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function posalji(formData: FormData) {
    setPending(true);
    setError(null);
    // Poslužitelj ne zna u kojoj je zoni netko unio sat, pa se ovdje pretvara
    // u UTC. Provjera raspona ostaje i ondje — ovo je pogodnost, ne obrana.
    formData.set("kada", new Date(kada).toISOString());
    formData.set("smelled", smrdi ? "da" : "ne");
    if (smrdi && doKada && !josTraje) {
      formData.set("doKada", new Date(doKada).toISOString());
    } else {
      formData.delete("doKada");
    }
    formData.set("ongoing", smrdi && josTraje ? "1" : "0");
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
      <div className="rounded-xl border border-maslina-rub bg-maslina-vez p-6 text-maslina-noc">
        <h2 className="text-xl font-bold">Zabilježeno. Hvala.</h2>
        <p className="mt-3 leading-7">
          {smrdi
            ? "Dojava ulazi u ružu čim joj pridružimo izmjereni vjetar za taj sat."
            : "I ovakva dojava ulazi u ružu: bez sati u kojima nije smrdjelo ne "
              + "zna se koliko je često smrdjelo, nego samo koliko je ljudi javilo."}{" "}
          Niz vjetra osvježavamo pri svakoj objavi stranice, pa se najnovije
          dojave znaju pojaviti s danom ili dva zakašnjenja.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setError(null);
          }}
          className="fokus mt-5 inline-flex min-h-11 items-center rounded-lg border border-maslina px-5 py-2.5 font-semibold text-maslina-tamna hover:bg-white"
        >
          Javi još jednu
        </button>
      </div>
    );
  }

  const najranije = lokalnoZaUnos(
    new Date(sada.getTime() - DANA_UNATRAG * 86_400_000),
  );

  return (
    <form action={posalji} className="space-y-6">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <fieldset>
        <legend className="text-base font-bold text-kamen-tinta">
          Što ste osjetili?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { kljuc: true, naslov: "Smrdjelo je", opis: "miris s odlagališta" },
            { kljuc: false, naslov: "Nije smrdjelo", opis: "bio sam vani, zrak je bio čist" },
          ].map((izbor) => (
            <label
              key={String(izbor.kljuc)}
              className="fokus-unutar flex cursor-pointer items-start gap-3 rounded-lg border border-kamen-rub bg-white px-4 py-3 hover:bg-kamen-plitko has-checked:border-maslina has-checked:bg-maslina-vez"
            >
              <input
                type="radio"
                name="smrdi-izbor"
                checked={smrdi === izbor.kljuc}
                onChange={() => setSmrdi(izbor.kljuc)}
                className="mt-1.5 accent-maslina"
              />
              <span className="text-base leading-7 text-kamen-tekst">
                <span className="block font-semibold text-kamen-tinta">
                  {izbor.naslov}
                </span>
                <span className="block text-kamen-drugi">{izbor.opis}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-base leading-7 text-kamen-drugi">
          Dojava da <strong>nije</strong> smrdjelo vrijedi koliko i ona da jest.
          Bez njih se iz zbroja ne vidi koliko je često smrdjelo, nego samo
          koliko je ljudi stiglo javiti.
        </p>
      </fieldset>

      {smrdi && (
        <fieldset>
          <legend className="text-base font-bold text-kamen-tinta">
            Koliko se jako osjetilo?
          </legend>
          <div className="mt-3 grid gap-2">
            {Object.entries(ODOUR_STRENGTHS).map(([kljuc, opis], i) => (
              <label
                key={kljuc}
                className="fokus-unutar flex cursor-pointer items-start gap-3 rounded-lg border border-kamen-rub bg-white px-4 py-3 hover:bg-kamen-plitko has-checked:border-maslina has-checked:bg-maslina-vez"
              >
                <input
                  type="radio"
                  name="strength"
                  value={kljuc}
                  required
                  defaultChecked={i === 1}
                  className="mt-1.5 accent-maslina"
                />
                <span className="text-base leading-7 text-kamen-tekst">{opis}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-base font-bold text-kamen-tinta">
            {smrdi ? "Kada je počelo" : "Kada"}
          </span>
          <input
            type="datetime-local"
            value={kada}
            min={najranije}
            max={lokalnoZaUnos(sada)}
            onChange={(e) => setKada(e.target.value)}
            required
            className="fokus mt-2 block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base text-kamen-tinta"
          />
          <span className="mt-2 block text-base leading-6 text-kamen-drugi">
            Sat je ono što dojavu čini upotrebljivom — bez njega se ne može
            spojiti s vjetrom. Pamtimo ga zaokruženog na puni sat.
          </span>
        </label>

        {smrdi && (
          <div className="block">
            <span className="text-base font-bold text-kamen-tinta">
              Do kada{" "}
              <span className="font-normal text-kamen-drugi">(nije obavezno)</span>
            </span>
            <input
              type="datetime-local"
              name="doKadaVidljivo"
              value={doKada}
              min={kada}
              max={lokalnoZaUnos(sada)}
              disabled={josTraje}
              onChange={(e) => setDoKada(e.target.value)}
              className="fokus mt-2 block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base text-kamen-tinta disabled:bg-kamen-plitko disabled:text-kamen-tih"
            />
            <label className="fokus-unutar mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={josTraje}
                onChange={(e) => setJosTraje(e.target.checked)}
                className="accent-maslina"
              />
              <span className="text-base text-kamen-tekst">Još traje</span>
            </label>
            <span className="mt-2 block text-base leading-6 text-kamen-drugi">
              Raspon vrijedi više od trenutka: svaki sat u njemu nosi svoj
              izmjereni vjetar.
            </span>
          </div>
        )}
      </div>

      <div>
        <span className="text-base font-bold text-kamen-tinta">Gdje ste bili</span>
        <GumbMjesta
          stanje={mjesto}
          trazi={trazimMjesto}
          odustani={() => setMjesto({ vrsta: "nema" })}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            name="neighborhood"
            required
            aria-label="Kvart"
            className="fokus block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base text-kamen-tinta"
          >
            {Object.entries(NEIGHBORHOODS).map(([kljuc, ime]) => (
              <option key={kljuc} value={kljuc}>
                {ime}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="place"
            maxLength={120}
            aria-label="Ulica ili orijentir"
            placeholder="Ulica ili orijentir, ako želite"
            className="fokus block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base text-kamen-tinta placeholder:text-kamen-tih"
          />
        </div>
        <span className="mt-2 block text-base leading-6 text-kamen-drugi">
          Mjesto zaokružujemo na stotinjak metara još u vašem pregledniku —
          točnije od toga model ionako ne razlučuje, a govorilo bi o kući.
        </span>
      </div>

      <label className="block">
        <span className="text-base font-bold text-kamen-tinta">
          Napomena <span className="font-normal text-kamen-drugi">(nije obavezno)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="Na primjer: prestalo kad se digao vjetar."
          className="fokus mt-2 block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base leading-7 text-kamen-tinta placeholder:text-kamen-tih"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-odbijeno bg-rose-50 px-4 py-3 text-base text-odbijeno-tamna">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="fokus inline-flex min-h-11 items-center justify-center rounded-full bg-maslina px-6 py-3 font-semibold text-white transition-colors hover:bg-maslina-tamna disabled:opacity-60"
      >
        {pending ? "Šaljem…" : "Pošalji dojavu"}
      </button>

      <div className="space-y-2 text-base leading-7 text-kamen-drugi">
        <p>
          Ne tražimo ni ime ni kontakt. Podatak koji se ne prikupi ne može ni
          procuriti, a ruži dojava ime ionako ne treba.
        </p>
        <p>
          Vaš preglednik pamti nasumičan niz znakova, da se dvije vaše dojave
          za isti sat ne broje kao dvoje ljudi. Ne kaže tko ste i ne putuje
          nikamo dalje.{" "}
          {zaboravljen ? (
            <span className="font-semibold text-maslina-tamna">
              Zaboravljeno — sljedeća dojava kreće kao nova osoba.
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
              Zaboravi me
            </button>
          )}
        </p>
      </div>
    </form>
  );
}
