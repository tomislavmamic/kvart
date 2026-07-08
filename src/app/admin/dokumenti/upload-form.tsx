"use client";

import { useState } from "react";
import { uploadDocument } from "@/lib/actions/admin";

export function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await uploadDocument(formData);
    setPending(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <h2 className="font-bold">Novi dokument</h2>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Naslov</span>
        <input
          name="title"
          required
          placeholder="npr. Dopis Gradu Splitu — rasvjeta Dračevac, srpanj 2026."
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Datoteka (PDF ili slika)</span>
          <input type="file" name="file" required accept="application/pdf,image/*" className="w-full text-sm" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Br. prijedloga (nije obavezno)
          </span>
          <input
            type="number"
            name="proposalId"
            placeholder="npr. 3"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        disabled={pending}
        className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Učitavanje…" : "Učitaj dokument"}
      </button>
    </form>
  );
}
