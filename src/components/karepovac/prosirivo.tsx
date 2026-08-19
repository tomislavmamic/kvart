"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const NAJMANJE = 0.2;
const NAJVISE = 8;
const KORAK_TIPKOM = 60;

/**
 * Prikaz koji se može otvoriti preko cijelog zaslona i po njemu se pomicati.
 *
 * Karte raspršenja pokrivaju 4,8 × 3,6 km, a u kartici stoje na nekoliko
 * stotina piksela. Sve što je sitnije od ulice tu se izgubi, pa je povećanje
 * jedini način da se vidi ono zbog čega karta uopće postoji.
 *
 * Dok je otvoreno, primjerak u kartici se ne crta — ne skriva se nego ga nema.
 * Dva primjerka istog prikaza značila bi dva jednaka `id`-a u dokumentu, pa bi
 * oznake gumba za sloj pokazivale na skriveni primjerak i prebacivanje u
 * povećalu ne bi radilo. Usput, ovako ne vrte se dvije iste simulacije.
 */
export function Prosirivo({
  naslov,
  children,
}: {
  naslov: string;
  children: ReactNode;
}) {
  const [otvoreno, setOtvoreno] = useState(false);
  const [zum, setZum] = useState(1);
  const pocetni = useRef(1);
  const pomak = useRef({ x: 0, y: 0 });
  const platno = useRef<HTMLDivElement>(null);
  const vidik = useRef<HTMLDivElement>(null);
  const vuce = useRef<{ x: number; y: number } | null>(null);

  const namjesti = useCallback(() => {
    if (platno.current) {
      platno.current.style.transform = `translate(${pomak.current.x}px, ${pomak.current.y}px) scale(${zum})`;
    }
  }, [zum]);

  useEffect(namjesti, [namjesti]);

  const vrati = useCallback(() => {
    pomak.current = { x: 0, y: 0 };
    setZum(pocetni.current);
  }, []);

  // Pri otvaranju se mjerilo namjesti tako da prikaz stane u zaslon. Bez toga
  // se na niskim prozorima gornji rub — gdje stoje gumbi za sloj — nađe ispod
  // zaglavlja, pa se do njega mora doći povlačenjem, što nitko neće pogoditi.
  useEffect(() => {
    if (!otvoreno) return;
    const namjesti_mjerilo = () => {
      const s = platno.current;
      const v = vidik.current;
      if (!s || !v || !s.offsetHeight) return;
      const stane = Math.min(
        1,
        (v.clientWidth - 24) / s.offsetWidth,
        (v.clientHeight - 24) / s.offsetHeight,
      );
      pocetni.current = Math.max(stane, NAJMANJE);
      pomak.current = { x: 0, y: 0 };
      setZum(pocetni.current);
    };
    namjesti_mjerilo();
    const kad_naraste = setTimeout(namjesti_mjerilo, 250);
    window.addEventListener("resize", namjesti_mjerilo);
    return () => {
      clearTimeout(kad_naraste);
      window.removeEventListener("resize", namjesti_mjerilo);
    };
  }, [otvoreno]);

  const zatvori = useCallback(() => {
    setOtvoreno(false);
    pocetni.current = 1;
    pomak.current = { x: 0, y: 0 };
    setZum(1);
  }, []);

  useEffect(() => {
    if (!otvoreno) return;
    const tipka = (e: KeyboardEvent) => {
      if (e.key === "Escape") return zatvori();
      const smjer: Record<string, [number, number]> = {
        ArrowLeft: [1, 0],
        ArrowRight: [-1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      if (smjer[e.key]) {
        e.preventDefault();
        pomak.current = {
          x: pomak.current.x + smjer[e.key][0] * KORAK_TIPKOM,
          y: pomak.current.y + smjer[e.key][1] * KORAK_TIPKOM,
        };
        namjesti();
      }
      if (e.key === "+" || e.key === "=") setZum((z) => Math.min(z * 1.3, NAJVISE));
      if (e.key === "-") setZum((z) => Math.max(z / 1.3, NAJMANJE));
      if (e.key === "0") vrati();
    };
    document.addEventListener("keydown", tipka);
    const prije = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tipka);
      document.body.style.overflow = prije;
    };
  }, [otvoreno, zatvori, namjesti, vrati]);

  const kotac = (e: React.WheelEvent) => {
    e.preventDefault();
    // Povećanje ide oko pokazivača, ne oko sredine: inače ono što se gleda
    // pobjegne izvan zaslona čim se približi.
    const okvir = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - okvir.left - okvir.width / 2 - pomak.current.x;
    const my = e.clientY - okvir.top - okvir.height / 2 - pomak.current.y;
    setZum((stari) => {
      const novi = Math.min(Math.max(stari * (e.deltaY < 0 ? 1.15 : 1 / 1.15), NAJMANJE), NAJVISE);
      const omjer = novi / stari;
      pomak.current = {
        x: pomak.current.x - mx * (omjer - 1),
        y: pomak.current.y - my * (omjer - 1),
      };
      return novi;
    });
  };

  return (
    <>
      {!otvoreno && (
      <div className="relative">
        {children}
        <button
          type="button"
          onClick={() => setOtvoreno(true)}
          className="fokus absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-kamen-rub bg-white/90 px-4 py-2 text-sm font-semibold text-kamen-tekst shadow-[0_4px_14px_-6px_rgb(24_24_27/0.35)] backdrop-blur-sm hover:bg-white"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path
              d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Povećaj
        </button>
      </div>
      )}

      {otvoreno && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={naslov}
          className="fixed inset-0 z-50 flex flex-col bg-kamen-tinta"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
            <p className="text-base font-bold">{naslov}</p>
            <div className="flex items-center gap-2">
              <Gumb oznaka="Smanji" onClick={() => setZum((z) => Math.max(z / 1.3, NAJMANJE))}>
                −
              </Gumb>
              <span className="min-w-14 text-center text-sm tabular-nums text-zinc-300">
                {zum.toFixed(1)}×
              </span>
              <Gumb oznaka="Povećaj" onClick={() => setZum((z) => Math.min(z * 1.3, NAJVISE))}>
                +
              </Gumb>
              <Gumb oznaka="Vrati na početak" onClick={vrati}>
                ⟲
              </Gumb>
              <button
                type="button"
                onClick={zatvori}
                className="fokus ml-2 inline-flex min-h-11 items-center rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Zatvori
              </button>
            </div>
          </div>

          <div
            onWheel={kotac}
            onPointerDown={(e) => {
              vuce.current = { x: e.clientX - pomak.current.x, y: e.clientY - pomak.current.y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!vuce.current) return;
              pomak.current = { x: e.clientX - vuce.current.x, y: e.clientY - vuce.current.y };
              namjesti();
            }}
            onPointerUp={() => {
              vuce.current = null;
            }}
            ref={vidik}
            className="relative flex-1 touch-none overflow-hidden bg-kamen-tinta"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                ref={platno}
                className="w-[min(1100px,92vw)] cursor-grab origin-center active:cursor-grabbing"
              >
                {children}
              </div>
            </div>
          </div>

          <p className="px-4 pb-3 text-center text-base text-zinc-400 sm:px-6">
            Povlačenjem se pomiče, kotačićem ili tipkama + i − mijenja mjerilo,
            strelicama pomiče, tipkom 0 vraća, Escape zatvara.
          </p>
        </div>
      )}
    </>
  );
}

function Gumb({
  oznaka,
  onClick,
  children,
}: {
  oznaka: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={oznaka}
      className="fokus inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/40 text-lg font-bold text-white hover:bg-white/10"
    >
      {children}
    </button>
  );
}
