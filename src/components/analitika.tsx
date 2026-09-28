"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Brojač posjeta: Vercel Web Analytics, bez kolačića, pa bez natpisa o
 * pristanku. Brojke su u nadzornoj ploči projekta na Vercelu (Analytics);
 * skupljanje se ondje mora uključiti, inače skripta ne postoji na
 * `/_vercel/insights` i ne šalje se ništa.
 *
 * Zapis prolazi kroz `pripremiPosjet` prije slanja:
 * - moderatori se ne broje — /admin nije stranica za javnost, a svaki bi
 *   pregled prijedloga napuhao brojke;
 * - adresa ide bez upita i sidra. Poveznice s karte na obrasce nose točku
 *   koju je stanovnik kliknuo (`/prijavi?lat=…&lng=…`,
 *   `/karepovac/dojava?lat=…&lng=…`) — često vlastitu kuću — a za broj
 *   posjeta po stranici dovoljan je put.
 */
export function pripremiPosjet(
  dogadaj: BeforeSendEvent,
): BeforeSendEvent | null {
  const adresa = new URL(dogadaj.url);
  if (adresa.pathname === "/admin" || adresa.pathname.startsWith("/admin/")) {
    return null;
  }
  adresa.search = "";
  adresa.hash = "";
  return { ...dogadaj, url: adresa.toString() };
}

export function Analitika() {
  return <Analytics beforeSend={pripremiPosjet} />;
}
