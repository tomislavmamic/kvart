"use client";

/**
 * Skočni prozor navoda GUP-a, jedan za cijelo mjesto (korijenski layout).
 *
 * Sluša klik na bilo koju poveznicu s `data-gup-navod` — iz JSX-a (Navod) ili
 * iz HTML niza u skočnom prozoru karte (navodHtml) — i umjesto odlaska na
 * stranicu navoda pokazuje ulomak: doslovan tekst s istaknutim citatom ili
 * isječak lista, s poveznicom na cijeli dokument otvoren na tom mjestu.
 *
 * Klik se hvata u fazi hvatanja: Leaflet skočnim prozorima zaustavlja
 * širenje klika, pa slušač u fazi mjehurića ne bi ništa čuo. Klik s Ctrl/Cmd,
 * Shift ili srednjom tipkom ostaje običan (nova kartica sa stranicom navoda).
 *
 * Na uskom zaslonu prozor je donja ploča, na širem kartica u sredini.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { PREDMETAK_TOCKE } from "@/lib/gup-dokument/id";
import { listoviKlijent, ulomakTocke } from "@/lib/gup-dokument/listovi-klijent";
import type { Ulomak } from "@/lib/gup-dokument/model";

import { TijeloUlomka } from "./ulomak";

const ucitani = new Map<string, Promise<Ulomak | null>>();

function ucitaj(id: string): Promise<Ulomak | null> {
  // navod mjesta na listu (skočni prozor čestice) slaže se ovdje, iz podataka o listu
  if (id.startsWith(PREDMETAK_TOCKE)) return listoviKlijent().then((l) => ulomakTocke(id, l));
  let p = ucitani.get(id);
  if (!p) {
    p = fetch(`/api/gup/navod/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Ulomak>) : null))
      .catch(() => {
        ucitani.delete(id);
        return null;
      });
    ucitani.set(id, p);
  }
  return p;
}

type Stanje = { id: string; ulomak?: Ulomak | null } | null;

export function ProzorNavoda() {
  const dialog = useRef<HTMLDialogElement>(null);
  const okidac = useRef<HTMLElement | null>(null);
  const [stanje, setStanje] = useState<Stanje>(null);

  const otvori = useCallback((id: string) => {
    setStanje({ id });
    if (!dialog.current?.open) dialog.current?.showModal();
    ucitaj(id).then((ulomak) => setStanje((s) => (s?.id === id ? { id, ulomak } : s)));
  }, []);

  useEffect(() => {
    const klik = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[data-gup-navod]") as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.dataset.gupNavod;
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      okidac.current = a;
      otvori(id);
    };
    // Prvi dodir ili prelazak mišem već počinje učitavanje: prozor se otvara s tekstom.
    const najava = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.("a[data-gup-navod]") as HTMLAnchorElement | null;
      if (a?.dataset.gupNavod) void ucitaj(a.dataset.gupNavod);
    };
    document.addEventListener("click", klik, true);
    document.addEventListener("pointerover", najava, { capture: true, passive: true });
    document.addEventListener("focusin", najava, true);
    return () => {
      document.removeEventListener("click", klik, true);
      document.removeEventListener("pointerover", najava, true);
      document.removeEventListener("focusin", najava, true);
    };
  }, [otvori]);

  const zatvori = () => dialog.current?.close();
  const u = stanje?.ulomak;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="navod-naslov"
      className="prozor-navoda"
      onClose={() => {
        setStanje(null);
        okidac.current?.focus({ preventScroll: true });
      }}
      onClick={(e) => {
        // klik na zamućenu pozadinu (sam <dialog>, ne njegov sadržaj) zatvara
        if (e.target === e.currentTarget) zatvori();
      }}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-kamen-tlo px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-kamen-drugi">Iz GUP-a</p>
            <h2 id="navod-naslov" className="mt-1 text-lg font-bold leading-snug text-kamen-tinta">
              {u ? u.naslov : stanje ? "Učitavam navod…" : ""}
            </h2>
            {u?.opis && <p className="mt-1 text-sm text-kamen-drugi">{u.opis}</p>}
          </div>
          <button
            type="button"
            onClick={zatvori}
            className="fokus meta -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-kamen-drugi hover:bg-kamen-plitko hover:text-kamen-tinta"
            aria-label="Zatvori"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-24 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {u ? (
            <TijeloUlomka u={u} />
          ) : u === null ? (
            <p className="text-kamen-tekst">
              Navod se nije mogao učitati.{" "}
              {stanje && !stanje.id.startsWith(PREDMETAK_TOCKE) && (
                <a href={`/gup/navod/${stanje.id}`} className="fokus font-semibold text-maslina underline">
                  Otvori ga kao stranicu
                </a>
              )}
              .
            </p>
          ) : (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-4 w-11/12 animate-pulse rounded bg-kamen-plitko" />
              <div className="h-4 w-10/12 animate-pulse rounded bg-kamen-plitko" />
              <div className="h-4 w-8/12 animate-pulse rounded bg-kamen-plitko" />
            </div>
          )}
        </div>

        {u && (
          <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-kamen-tlo px-5 py-3">
            <a
              href={u.href}
              className="fokus meta inline-flex items-center rounded-full bg-maslina px-4 py-2 text-sm font-semibold text-white hover:bg-maslina-tamna"
            >
              {u.list ? "Otvori cijeli list" : "Otvori u cijelom dokumentu"} →
            </a>
            <a
              href={u.list ? u.list.url : u.dokument?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="fokus meta inline-flex items-center text-sm text-kamen-drugi underline hover:text-kamen-tinta"
            >
              Izvornik (PDF, split.hr)
            </a>
          </footer>
        )}
      </div>
    </dialog>
  );
}
