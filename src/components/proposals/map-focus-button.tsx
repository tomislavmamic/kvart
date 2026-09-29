"use client";

import { MAP_FOCUS_EVENT } from "./proposal-map";

/** Skrolaj do karte prijedloga (`#prijedlog`) i pokaži na njoj zadani okvir [zapad, jug, istok, sjever]. */
export function MapFocusButton({ bounds, label = "Prikaži na karti" }: { bounds: number[]; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById("prijedlog")?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.dispatchEvent(new CustomEvent(MAP_FOCUS_EVENT, { detail: bounds }));
      }}
      className="fokus inline-flex min-h-11 items-center gap-2 rounded-full border border-kamen-rub bg-white px-4 py-2 text-sm font-semibold text-maslina hover:border-maslina"
    >
      <span aria-hidden>↑</span>
      {label}
    </button>
  );
}
