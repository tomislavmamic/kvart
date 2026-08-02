"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/prijedlozi", label: "Problemi i prijedlozi" },
  { href: "/karta", label: "Karta" },
  { href: "/plan", label: "Izmjene GUP-a" },
  { href: "/dokumenti", label: "Dokumenti" },
  { href: "/podaci", label: "Prostorni podaci" },
  { href: "/o-inicijativi", label: "O inicijativi" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  // Close the mobile menu whenever the route changes.
  const pathname = usePathname();
  const close = () => setOpen(false);

  return (
    <header className="relative z-30 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          onClick={close}
          className="text-lg font-bold tracking-tight"
        >
          Naš kvart{" "}
          <span className="font-normal text-maslina">
            Dračevac · Bilice
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-medium text-zinc-900"
                  : "text-zinc-600 hover:text-zinc-900"
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/prijavi"
            className="rounded-full bg-maslina px-4 py-2 font-semibold text-white hover:bg-maslina-tamna"
          >
            Prijavi problem
          </Link>
        </nav>

        {/* Mobile burger toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zatvori izbornik" : "Otvori izbornik"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="fokus meta inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 sm:hidden"
        >
          <Hamburger open={open} />
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-zinc-200 bg-white px-4 pb-4 pt-2 sm:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={
                  pathname === link.href
                    ? "rounded-lg bg-zinc-100 px-3 py-2.5 font-medium text-zinc-900"
                    : "rounded-lg px-3 py-2.5 text-zinc-700 hover:bg-zinc-100"
                }
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/prijavi"
              onClick={close}
              className="mt-1 rounded-full bg-maslina px-4 py-2.5 text-center font-semibold text-white hover:bg-maslina-tamna"
            >
              Prijavi problem
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function Hamburger({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}

/**
 * Izbornik za stranice na kojima sadržaj uzima cijeli prozor.
 *
 * Traka preko cijele širine ondje pojede 4,5 rem karte i ništa ne vrati:
 * na karti se navigacija koristi jednom, pri odlasku. Zato je skupljena u
 * pločicu koja pluta iznad sadržaja, a popis stranica se otvara klikom —
 * i na širokom zaslonu, gdje bi stao. Klik izvan i Escape je zatvaraju,
 * jer otvoren panel ovdje pokriva kartu, a ne prazan prostor.
 */
export function PlutajuciIzbornik() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const okvir = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const klik = (e: MouseEvent) => {
      if (!okvir.current?.contains(e.target as Node)) setOpen(false);
    };
    const tipka = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", tipka);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", tipka);
    };
  }, [open]);

  return (
    // Iznad ploča karte (z-1100), inače bi ga bočna traka prekrila.
    <div ref={okvir} className="fixed left-3 top-3 z-[1200]">
      <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white py-1 pl-4 pr-1 shadow-lg">
        {/* `meta` jer je ovo na karti jedini put natrag na ostatak stranice, a
            mjereno je bilo 63×20 px — ispod dodirne mjere na uređaju na kojem
            se karta i otvara. */}
        <Link
          href="/"
          className="fokus meta flex items-center text-sm font-bold tracking-tight"
        >
          Naš kvart{" "}
          <span className="hidden font-normal text-maslina sm:inline">
            &nbsp;Dračevac · Bilice
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zatvori izbornik" : "Otvori izbornik"}
          aria-expanded={open}
          aria-controls="plutajuci-izbornik"
          className="fokus meta inline-flex h-8 w-8 min-w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
        >
          <Hamburger open={open} />
        </button>
      </div>

      {open && (
        <nav
          id="plutajuci-izbornik"
          className="mt-2 flex w-64 flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-lg"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={
                pathname === link.href
                  ? "rounded-lg bg-zinc-100 px-3 py-2 font-medium text-zinc-900"
                  : "rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100"
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/prijavi"
            onClick={() => setOpen(false)}
            className="mt-1 rounded-full bg-maslina px-4 py-2 text-center font-semibold text-white hover:bg-maslina-tamna"
          >
            Prijavi problem
          </Link>
        </nav>
      )}
    </div>
  );
}
