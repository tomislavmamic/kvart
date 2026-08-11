"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PrimaryNavigation } from "./primary-navigation";
import { SECONDARY_NAV_ITEMS } from "@/lib/site-navigation";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  return (
    <SiteHeaderView
      pathname={pathname}
      open={open}
      onToggle={() => setOpen((value) => !value)}
      onClose={close}
    />
  );
}

type SiteHeaderViewProps = {
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function SiteHeaderView({
  pathname,
  open,
  onToggle,
  onClose,
}: SiteHeaderViewProps) {
  const homepage = pathname === "/";

  return (
    <header className="relative z-30 border-b border-kamen-tlo bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Brand onClick={onClose} />

        {homepage ? (
          <SecondaryMenu pathname={pathname} />
        ) : (
          <>
            <div className="hidden items-center gap-4 lg:flex">
              <PrimaryNavigation variant="header" pathname={pathname} />
              <SecondaryMenu pathname={pathname} />
            </div>

            <button
              type="button"
              onClick={onToggle}
              aria-label={open ? "Zatvori izbornik" : "Otvori izbornik"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="fokus meta inline-flex h-11 w-11 items-center justify-center rounded-lg text-kamen-tekst hover:bg-kamen-plitko lg:hidden"
            >
              <Hamburger open={open} />
            </button>
          </>
        )}
      </div>

      {!homepage && open && (
        <div
          id="mobile-nav"
          className="border-t border-kamen-tlo bg-white px-4 pb-4 pt-2 lg:hidden"
        >
          <PrimaryNavigation
            variant="menu"
            pathname={pathname}
            onNavigate={onClose}
          />
          <div className="mt-2 border-t border-kamen-tlo pt-2">
            <SecondaryLinks pathname={pathname} onNavigate={onClose} />
          </div>
        </div>
      )}
    </header>
  );
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="fokus meta flex items-center whitespace-nowrap text-lg font-bold tracking-tight"
    >
      Naš kvart{" "}
      <span className="font-normal text-maslina">
        &nbsp;Dračevac · Bilice
      </span>
    </Link>
  );
}

function SecondaryMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Otvori dodatne stranice"
        aria-expanded={open}
        aria-controls="secondary-nav"
        className="fokus meta inline-flex items-center gap-1 rounded-full border border-kamen-rub bg-white px-3 py-2 text-sm font-medium text-kamen-tekst hover:bg-kamen-plitko"
      >
        Više
        <Chevron open={open} />
      </button>

      {open && (
        <nav
          id="secondary-nav"
          aria-label="Dodatne stranice"
          className="absolute right-0 top-full z-40 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-kamen-tlo bg-white p-2 text-sm shadow-lg"
        >
          <SecondaryLinks
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      )}
    </div>
  );
}

function SecondaryLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return SECONDARY_NAV_ITEMS.map((item) => {
    const active =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`fokus meta flex items-center rounded-lg px-3 py-2.5 ${
          active
            ? "bg-kamen-plitko font-medium text-kamen-tinta"
            : "text-kamen-tekst hover:bg-kamen-plitko hover:text-kamen-tinta"
        }`}
      >
        {item.label}
      </Link>
    );
  });
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m4 6 4 4 4-4" />
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
    const klik = (event: MouseEvent) => {
      if (!okvir.current?.contains(event.target as Node)) setOpen(false);
    };
    const tipka = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", tipka);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", tipka);
    };
  }, [open]);

  return (
    <div ref={okvir} className="fixed left-3 top-3 z-[1200]">
      <div className="flex items-center gap-1 rounded-full border border-kamen-tlo bg-white py-1 pl-4 pr-1 shadow-lg">
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
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Zatvori izbornik" : "Otvori izbornik"}
          aria-expanded={open}
          aria-controls="plutajuci-izbornik"
          className="fokus meta inline-flex h-8 w-8 min-w-11 items-center justify-center rounded-full text-kamen-tekst hover:bg-kamen-plitko"
        >
          <Hamburger open={open} />
        </button>
      </div>

      {open && (
        <div
          id="plutajuci-izbornik"
          className="mt-2 w-64 rounded-xl border border-kamen-tlo bg-white p-2 shadow-lg"
        >
          <PrimaryNavigation
            variant="menu"
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
          <nav
            aria-label="Dodatne stranice"
            className="mt-2 flex flex-col gap-1 border-t border-kamen-tlo pt-2 text-sm"
          >
            <SecondaryLinks
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </nav>
        </div>
      )}
    </div>
  );
}
