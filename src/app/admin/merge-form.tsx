"use client";

import { useState } from "react";
import { mergeSubmission } from "@/lib/actions/admin";

export function MergeForm({ submissionId }: { submissionId: number }) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await mergeSubmission(formData);
    if (!result.ok) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="flex items-center gap-2">
      <input type="hidden" name="id" value={submissionId} />
      <input
        type="number"
        name="proposalId"
        required
        placeholder="br. prijedloga"
        className="w-36 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
      />
      <button className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
        Spoji (duplikat)
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </form>
  );
}
