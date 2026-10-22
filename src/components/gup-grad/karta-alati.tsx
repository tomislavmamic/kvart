"use client";

/**
 * Zajedničko kartama s tražilicom adrese (/gup/zabrana, /gup/gradnja):
 * tražilica kućnog broja ili ulice, karta preko cijelog zaslona i ikona
 * njezina gumba.
 *
 * Kućni brojevi (~0,5 MB, public/geo/gup-grad/kucni-brojevi.json) stižu tek
 * kad se krene tipkati adresa.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { pripremiAdrese, trazi, type Adrese, type Prijedlog, type SiroveAdrese } from "@/lib/gup-grad/zabrana";

export function TrazilicaAdrese(props: {
  id: string;
  /** natpis nad poljem; na karti preko cijelog zaslona skriven */
  natpis: string;
  sakrijNatpis?: boolean;
  /** tekst ispod polja; na karti preko cijelog zaslona izostaje */
  podnaslov?: string;
  onOdaberi: (p: Prijedlog, adrese: Adrese) => void;
}) {
  const { id, natpis, sakrijNatpis = false, podnaslov, onOdaberi } = props;
  const [adrese, setAdrese] = useState<Adrese | null>(null);
  const [upit, setUpit] = useState("");
  const [otvoreno, setOtvoreno] = useState(false);
  const [aktivni, setAktivni] = useState(0);
  const ucitavam = useRef(false);
  const ucitajAdrese = () => {
    if (adrese || ucitavam.current) return;
    ucitavam.current = true;
    fetch("/geo/gup-grad/kucni-brojevi.json")
      .then((r) => r.json() as Promise<SiroveAdrese>)
      .then((a) => setAdrese(pripremiAdrese(a)))
      .catch(() => (ucitavam.current = false));
  };
  const prijedlozi = useMemo(() => (adrese ? trazi(adrese, upit) : []), [adrese, upit]);

  const odaberi = (p: Prijedlog) => {
    setOtvoreno(false);
    setUpit(p.naziv);
    if (adrese) onOdaberi(p, adrese);
  };

  return (
    <div className="relative max-w-md">
      <label htmlFor={id} className={sakrijNatpis ? "sr-only" : "block font-semibold text-zinc-900"}>
        {natpis}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="npr. Put Mostina 12"
        role="combobox"
        aria-expanded={otvoreno && upit.trim().length > 0}
        aria-controls={`${id}-prijedlozi`}
        aria-autocomplete="list"
        aria-activedescendant={otvoreno && prijedlozi[aktivni] ? `${id}-p-${aktivni}` : undefined}
        value={upit}
        onFocus={() => {
          ucitajAdrese();
          setOtvoreno(true);
        }}
        onBlur={() => setTimeout(() => setOtvoreno(false), 120)}
        onChange={(e) => {
          ucitajAdrese();
          setUpit(e.target.value);
          setAktivni(0);
          setOtvoreno(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && prijedlozi.length) {
            setAktivni((a) => (a + 1) % prijedlozi.length);
            e.preventDefault();
          } else if (e.key === "ArrowUp" && prijedlozi.length) {
            setAktivni((a) => (a - 1 + prijedlozi.length) % prijedlozi.length);
            e.preventDefault();
          } else if (e.key === "Enter") {
            if (prijedlozi[aktivni]) odaberi(prijedlozi[aktivni]);
            e.preventDefault();
          } else if (e.key === "Escape") setOtvoreno(false);
        }}
        className="fokus mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
      />
      {otvoreno && upit.trim().length > 0 && (
        <ul
          id={`${id}-prijedlozi`}
          role="listbox"
          className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {prijedlozi.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">{adrese ? "Te ulice nema u gradskom adresnom registru" : "Adrese se učitavaju…"}</li>
          ) : (
            prijedlozi.map((p, i) => (
              <li
                key={`${p.naziv}-${p.kotar}-${i}`}
                id={`${id}-p-${i}`}
                role="option"
                aria-selected={i === aktivni}
                onMouseDown={(e) => {
                  e.preventDefault();
                  odaberi(p);
                }}
                className={`flex cursor-pointer justify-between gap-3 px-3 py-2 text-sm ${i === aktivni ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
              >
                <span className="text-zinc-900">{p.naziv}</span>
                <span className="shrink-0 text-zinc-500">{p.kotar}</span>
              </li>
            ))
          )}
        </ul>
      )}
      {podnaslov && <p className="mt-1 text-sm text-zinc-500">{podnaslov}</p>}
    </div>
  );
}

/**
 * Karta s tražilicom preko cijelog zaslona: pravi cijeli zaslon gdje ga
 * preglednik daje, inače (iPhone ga za elemente nema) prozor preko stranice.
 * Izlaz je isti gumb ili Esc.
 */
export function useCijeliZaslon(cijeli: RefObject<HTMLElement | null>): [boolean, () => void] {
  const [puno, setPuno] = useState(false);
  const prebaci = () => {
    if (puno) {
      setPuno(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    setPuno(true);
    cijeli.current?.requestFullscreen?.()?.catch(() => {});
  };
  useEffect(() => {
    if (!puno) return;
    // Esc u pravom cijelom zaslonu hvata preglednik i javlja fullscreenchange
    const izlaz = () => {
      if (!document.fullscreenElement) setPuno(false);
    };
    const tipka = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement && (e.target as HTMLElement | null)?.tagName !== "INPUT") setPuno(false);
    };
    const html = document.documentElement;
    const staro = html.style.overflow;
    html.style.overflow = "hidden";
    document.addEventListener("fullscreenchange", izlaz);
    document.addEventListener("keydown", tipka);
    return () => {
      html.style.overflow = staro;
      document.removeEventListener("fullscreenchange", izlaz);
      document.removeEventListener("keydown", tipka);
    };
  }, [puno]);
  return [puno, prebaci];
}

/** Strelice prema kutovima (proširi) ili prema sredini (vrati). */
export function IkonaZaslona({ puno }: { puno: boolean }) {
  const d = puno ? "M7 2v5H2M11 2v5h5M7 16v-5H2M11 16v-5h5" : "M2 7V2h5M16 7V2h-5M2 11v5h5M16 11v5h-5";
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
