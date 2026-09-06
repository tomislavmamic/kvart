"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { KAREPOVAC_NAV } from "@/lib/karepovac";

/**
 * Traka projekta: sedam pilula u jednom redu.
 *
 * Na mobitelu se red pomiče vodoravno umjesto da se lomi u tri reda: rešetka
 * od tri stupca davala je 164 px trake (jedan natpis prelomljen u dva retka
 * rastezao je cijeli red, „Postaje” je ostajao sam u trećem), pa je naslov
 * stranice na telefonu počinjao tek na 354 px. Sad je traka 44 px, a da se
 * vidi kako ide dalje, desni rub blijedi u bijelo; odabrana se pilula sama
 * dovede u kadar.
 */
export function KarepovacProjectNav() {
  const pathname = usePathname();
  const traka = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = traka.current;
    const odabrana = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !odabrana) return;
    // Vodoravno u sredinu; ne `scrollIntoView`, jer bi taj pomaknuo i stranicu.
    const cilj = odabrana.offsetLeft - (el.clientWidth - odabrana.offsetWidth) / 2;
    el.scrollLeft = Math.max(0, cilj);
  }, [pathname]);

  return <KarepovacProjectNavView pathname={pathname} trakaRef={traka} />;
}

export function KarepovacProjectNavView({
  pathname,
  trakaRef,
}: {
  pathname: string;
  trakaRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <nav aria-label="Praćenje zraka oko Karepovca" className="relative">
      <div
        ref={trakaRef}
        className="traka-vodoravna mx-auto flex max-w-5xl snap-x gap-1 overflow-x-auto px-4 pb-2 pe-12 md:flex-wrap md:overflow-visible md:pb-3 md:pe-4"
      >
        {KAREPOVAC_NAV.map((link) => {
          const active = pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "fokus meta-cip inline-flex min-h-11 shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-full bg-kamen-tinta px-4 py-2 text-sm font-semibold text-white"
                  : "fokus meta-cip inline-flex min-h-11 shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-kamen-tekst hover:bg-kamen-plitko"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      {/* Znak da traka ide dalje: desni rub blijedi. Desni odmak trake (pe-12)
          je veći od blijeđenja, pa na kraju pomaka zadnja pilula stoji cijela. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-white to-transparent md:hidden"
      />
    </nav>
  );
}
