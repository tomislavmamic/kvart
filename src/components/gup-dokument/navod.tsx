/**
 * Poveznica na mjesto u GUP-u. Bez JavaScripta vodi na stranicu navoda
 * (/gup/navod/<id>); s njim klik otvara skočni prozor s doslovnim tekstom
 * ili isječkom lista (ProzorNavoda sluša `data-gup-navod` na cijeloj stranici).
 *
 * Običan <a>, bez stanja — radi u poslužiteljskim i klijentskim komponentama.
 * Za HTML nizove (skočni prozori karte) isto daje navodHtml iz id.ts.
 */
import type { ReactNode } from "react";

import { KLASA_NAVODA, putNavoda } from "@/lib/gup-dokument/id";

export function Navod({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a href={putNavoda(id)} data-gup-navod={id} className={KLASA_NAVODA}>
      {children}
    </a>
  );
}
