"use client";

import { useState } from "react";
import { updateProposal, addStatusUpdate } from "@/lib/actions/admin";
import { NEIGHBORHOODS, CATEGORIES, STATUSES } from "@/lib/constants";
import type { Proposal } from "@/lib/db/schema";

export function EditForms({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-8">
      <DetailsForm proposal={proposal} />
      <StatusForm proposalId={proposal.id} currentStatus={proposal.status} />
    </div>
  );
}

function useFormResult() {
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  return { message, setMessage };
}

function FormMessage({
  message,
}: {
  message: { kind: "ok" | "error"; text: string } | null;
}) {
  if (!message) return null;
  return (
    <p
      className={`rounded-lg px-4 py-2 text-sm ${
        message.kind === "ok"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-rose-50 text-rose-800"
      }`}
    >
      {message.text}
    </p>
  );
}

function DetailsForm({ proposal }: { proposal: Proposal }) {
  const { message, setMessage } = useFormResult();

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    const result = await updateProposal(formData);
    setMessage(
      result.ok
        ? { kind: "ok", text: "Spremljeno." }
        : { kind: "error", text: result.error }
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <h2 className="font-bold">Podaci prijedloga</h2>
      <input type="hidden" name="id" value={proposal.id} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Naslov</span>
        <input
          name="title"
          defaultValue={proposal.title}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Opis</span>
        <textarea
          name="description"
          defaultValue={proposal.description}
          rows={6}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Kvart</span>
          <select
            name="neighborhood"
            defaultValue={proposal.neighborhood}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            {Object.entries(NEIGHBORHOODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Kategorija</span>
          <select
            name="category"
            defaultValue={proposal.category}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Reddit poveznica (rasprava)
        </span>
        <input
          name="redditUrl"
          defaultValue={proposal.redditUrl ?? ""}
          placeholder="https://www.reddit.com/r/DracevacBilice/comments/…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <FormMessage message={message} />
      <button className="rounded-full bg-maslina px-5 py-2 text-sm font-semibold text-white hover:bg-maslina-tamna">
        Spremi promjene
      </button>
    </form>
  );
}

function StatusForm({
  proposalId,
  currentStatus,
}: {
  proposalId: number;
  currentStatus: string;
}) {
  const { message, setMessage } = useFormResult();

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    const result = await addStatusUpdate(formData);
    setMessage(
      result.ok
        ? { kind: "ok", text: "Status ažuriran." }
        : { kind: "error", text: result.error }
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <h2 className="font-bold">Novi status</h2>
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select
            name="status"
            defaultValue={currentStatus}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Bilješka (npr. datum i klasa dopisa Gradu)
        </span>
        <textarea
          name="note"
          rows={3}
          placeholder="Poslano Gradu Splitu 15. srpnja 2026., KLASA: …, URBROJ: …"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <FormMessage message={message} />
      <button className="rounded-full bg-maslina px-5 py-2 text-sm font-semibold text-white hover:bg-maslina-tamna">
        Dodaj status
      </button>
    </form>
  );
}
