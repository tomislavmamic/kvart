"use client";

import { useState } from "react";
import { login } from "@/lib/actions/admin";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await login(formData);
    // login() redirects on success; a return value means failure.
    if (result && !result.ok) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input
        type="password"
        name="password"
        required
        placeholder="Lozinka moderatora"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2"
      />
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        className="w-full rounded-full bg-emerald-600 px-6 py-2.5 font-semibold text-white hover:bg-emerald-700"
      >
        Prijava
      </button>
    </form>
  );
}
