"use client";

import { useState } from "react";
import { submitProblem } from "@/lib/actions/public";
import { NEIGHBORHOODS, CATEGORIES } from "@/lib/constants";

export function SubmitForm({
  lokacija,
}: {
  lokacija: { lat: number; lng: number; kc: string | null } | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  // Lokacija se može ukloniti. Prijava s karte ne smije značiti da se mora
  // prijaviti baš ta točka — netko klikne susjednu česticu pa se predomisli.
  const [saLokacijom, setSaLokacijom] = useState(true);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submitProblem(formData);
    setPending(false);
    if (result.ok) {
      setDone(true);
    } else {
      setError(result.error);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900">
        <h2 className="font-bold">Hvala na prijavi! 🙌</h2>
        <p className="mt-2 text-sm">
          Moderatori će je pregledati i objaviti u najkraćem roku. Ako ste
          ostavili kontakt, javit ćemo vam se kad prijedlog bude objavljen.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Što se šalje uz prijavu, ispisano — a ne skriveno polje o kojem
          prijavitelj ne zna. Lokacija ide u opis, jer tablica prijava nema
          stupce za koordinate; moderator je vidi i prenosi na prijedlog. */}
      {lokacija && saLokacijom && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-maslina-rub bg-maslina-vez px-3 py-2">
          <p className="text-sm text-zinc-800">
            <span className="font-semibold">Lokacija s karte:</span>{" "}
            {lokacija.kc ? `k.č. ${lokacija.kc} · ` : ""}
            <span className="font-mono text-xs">
              {lokacija.lat.toFixed(5)}, {lokacija.lng.toFixed(5)}
            </span>
            <br />
            <span className="text-zinc-600">
              Šalje se uz prijavu da se ne mora opisivati riječima.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setSaLokacijom(false)}
            className="fokus meta shrink-0 rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ukloni
          </button>
        </div>
      )}
      {lokacija && saLokacijom && (
        <>
          <input type="hidden" name="lat" value={lokacija.lat} />
          <input type="hidden" name="lng" value={lokacija.lng} />
          {lokacija.kc && <input type="hidden" name="kc" value={lokacija.kc} />}
        </>
      )}

      <Field label="Naslov *">
        <input
          name="title"
          required
          minLength={5}
          maxLength={200}
          placeholder="npr. Neosvijetljen prijelaz kod škole"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kvart *">
          <select
            name="neighborhood"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            <option value="" disabled>
              Odaberite kvart
            </option>
            {Object.entries(NEIGHBORHOODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kategorija *">
          <select
            name="category"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            <option value="" disabled>
              Odaberite kategoriju
            </option>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Opis problema ili prijedloga *">
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={5000}
          rows={6}
          placeholder="Opišite gdje se problem nalazi, koga pogađa i što predlažete."
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </Field>

      <Field label="Fotografija (nije obavezno)">
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="w-full text-sm"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Vaše ime (nije obavezno)">
          <input
            name="name"
            maxLength={100}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </Field>
        <Field label="Kontakt — e-mail ili mobitel (nije obavezno)">
          <input
            name="contact"
            maxLength={200}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </Field>
      </div>

      {/* Honeypot — hidden from real users, bots fill it in. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-maslina px-6 py-3 font-semibold text-white hover:bg-maslina-tamna disabled:opacity-50"
      >
        {pending ? "Slanje…" : "Pošalji prijavu"}
      </button>
      <p className="text-xs text-zinc-500">
        Prijave se objavljuju nakon pregleda moderatora. Kontakt podaci se ne
        objavljuju i služe samo za povratnu informaciju.
      </p>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </span>
      {children}
    </label>
  );
}
