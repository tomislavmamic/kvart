"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { KAREPOVAC_NAV } from "@/lib/karepovac";

export function KarepovacProjectNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Praćenje zraka oko Karepovca">
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-1 px-4 pb-3 sm:flex">
        {KAREPOVAC_NAV.map((link) => {
          const active =
            link.href === "/karepovac"
              ? pathname === link.href
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "fokus meta-cip inline-flex min-h-11 items-center justify-center rounded-full bg-kamen-tinta px-3 py-2 text-center text-sm font-semibold text-white sm:px-4"
                  : "fokus meta-cip inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 text-center text-sm font-medium text-kamen-tekst hover:bg-kamen-plitko sm:px-4"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
