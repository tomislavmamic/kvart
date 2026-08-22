"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader, PlutajuciIzbornik } from "./site-header";

/**
 * Okvir stranice: traka i podnožje, osim ondje gdje sadržaj uzima prozor.
 *
 * Karta nije dio stranice nego jest stranica — okvir joj oduzima 4,5 rem
 * gore i pola zaslona listanja dolje, a zauzvrat ne daje ništa što joj
 * vlastite ploče već ne daju. Zato na tim rutama traka postaje plutajuća
 * pločica, a podnožje otpada; sadržaj se sam brine za visinu.
 *
 * Odluka mora u klijentsku komponentu jer ovisi o ruti, a korijenski je
 * layout poslužiteljski. `children` i `podnozje` dolaze kao propovi, pa
 * ostaju poslužiteljski iscrtani — granica je samo ovaj prekidač.
 */
const PUNI_PROZOR: ReadonlySet<string> = new Set(["/karta"]);

/**
 * Rute na kojima okvir otpada do kraja — ni plutajuće pločice.
 *
 * Maketa se gleda, a ne čita: svaka traka preko nje je nešto što stoji između
 * oka i terena. Izlaz zato nudi sama stranica, jednim križićem u kutu, a sve
 * ostalo — naslov, upute, izvori — stane iza gumba s upitnikom.
 */
const BEZ_OKVIRA: ReadonlySet<string> = new Set(["/igra"]);

export function SiteChrome({
  children,
  podnozje,
}: {
  children: ReactNode;
  podnozje: ReactNode;
}) {
  const pathname = usePathname();
  if (BEZ_OKVIRA.has(pathname)) return <>{children}</>;
  if (PUNI_PROZOR.has(pathname)) {
    return (
      <>
        <PlutajuciIzbornik />
        {children}
      </>
    );
  }
  const homepage = pathname === "/";
  return (
    <>
      <SiteHeader />
      <main
        className={
          homepage
            ? "mx-auto max-w-5xl px-4 pb-0 pt-8"
            : "mx-auto max-w-5xl px-4 py-8"
        }
      >
        {children}
      </main>
      {homepage ? <div className="[&>footer]:mt-0">{podnozje}</div> : podnozje}
    </>
  );
}
