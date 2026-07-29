"use client";

import { useState } from "react";
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
          <span className="font-normal text-emerald-700">
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
            className="rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
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
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 sm:hidden"
        >
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
              className="mt-1 rounded-full bg-emerald-600 px-4 py-2.5 text-center font-semibold text-white hover:bg-emerald-700"
            >
              Prijavi problem
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
