"use client";

import { useState } from "react";

import { prijaviMiris } from "@/lib/actions/public";
import { NEIGHBORHOODS, ODOUR_STRENGTHS } from "@/lib/constants";

/** Koliko unatrag obrazac dopušta; isto ograničenje stoji i na poslužitelju. */
const DANA_UNATRAG = 30;

function lokalnoZaUnos(vrijeme: Date) {
  const pomak = vrijeme.getTimezoneOffset() * 60_000;
  return new Date(vrijeme.getTime() - pomak).toISOString().slice(0, 16);
}

export function ObrazacDojave() {
  const sada = new Date();
  const [kada, setKada] = useState(() => lokalnoZaUnos(sada));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function posalji(formData: FormData) {
    setPending(true);
    setError(null);
    // Poslužitelj ne zna u kojoj je zoni netko unio sat, pa se ovdje pretvara
    // u UTC. Provjera raspona ostaje i ondje — ovo je pogodnost, ne obrana.
    formData.set("kada", new Date(kada).toISOString());
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
          Dojava ulazi u ružu čim joj pridružimo izmjereni vjetar za taj sat.
          Niz vjetra osvježavamo pri svakoj objavi stranice, pa se najnovije
          dojave znaju pojaviti s danom ili dva zakašnjenja.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
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

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-base font-bold text-kamen-tinta">Kada</span>
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

        <label className="block">
          <span className="text-base font-bold text-kamen-tinta">Gdje ste bili</span>
          <select
            name="neighborhood"
            required
            className="fokus mt-2 block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base text-kamen-tinta"
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
            placeholder="Ulica ili orijentir, ako želite"
            className="fokus mt-2 block w-full rounded-lg border border-kamen-rub bg-white px-3 py-2.5 text-base text-kamen-tinta placeholder:text-kamen-tih"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-base font-bold text-kamen-tinta">
          Napomena <span className="font-normal text-kamen-drugi">(nije obavezno)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="Na primjer: trajalo je pola sata, prestalo kad se digao vjetar."
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

      <p className="text-base leading-7 text-kamen-drugi">
        Ne tražimo ni ime ni kontakt. Podatak koji se ne prikupi ne može ni
        procuriti, a ruži dojava ime ionako ne treba.
      </p>
    </form>
  );
}
