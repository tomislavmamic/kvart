/**
 * Oznake predloženih mjernih postaja na karti.
 *
 * Isti obrazac kao pribadače postaja (`oznake.ts`): HTML oznake preko
 * MapLibreova `Marker`, jer im treba klik i natpis, a ne samo točka. Izgled
 * je namjerno drukčiji — crtkan obrub, boja tikvine — da se prijedlog ni na
 * tren ne zamijeni s postajom koja doista mjeri.
 */

import type { Map as MapaLibre, Marker } from "maplibre-gl";

import { PRIJEDLOZI_POSTAJA, type PrijedlogPostaje } from "@/lib/sim/prijedlozi-postaja";

export type Prijedlozi = {
  vidljivost(vidljivo: boolean): void;
  /** Ističe odabrani prijedlog; `null` gasi isticanje. */
  istakni(id: string | null): void;
  ukloni(): void;
};

/**
 * Postavlja oznake i vraća upravljač.
 *
 * Args:
 *   karta: Karta na koju se oznake dodaju.
 *   MarkerRazred: MapLibreov razred `Marker` (stiže odgođenim uvozom).
 *   naKlik: Poziva se s prijedlogom na koji je netko kliknuo.
 */
export function stvoriPrijedloge(
  karta: MapaLibre,
  MarkerRazred: typeof Marker,
  naKlik: (p: PrijedlogPostaje) => void,
): Prijedlozi {
  const oznake: { marker: Marker; el: HTMLElement; id: string }[] = [];
  for (const p of PRIJEDLOZI_POSTAJA) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sim-prijedlog";
    el.setAttribute("aria-label", `Predložena postaja: ${p.naziv}`);
    el.innerHTML = `<span class="sim-prijedlog__tocka" data-faza="${p.faza}"></span><span class="sim-prijedlog__natpis">${p.naziv}</span>`;
    el.addEventListener("click", (d) => {
      // Klik na oznaku ne smije proći do karte, koja bi ga uzela kao odabir
      // točke.
      d.stopPropagation();
      naKlik(p);
    });
    const marker = new MarkerRazred({ element: el, anchor: "left" })
      .setLngLat([p.lon, p.lat])
      .addTo(karta);
    oznake.push({ marker, el, id: p.id });
  }
  return {
    vidljivost(vidljivo) {
      for (const o of oznake) o.el.style.display = vidljivo ? "" : "none";
    },
    istakni(id) {
      for (const o of oznake) o.el.classList.toggle("sim-prijedlog--odabran", o.id === id);
    },
    ukloni() {
      for (const o of oznake) o.marker.remove();
      oznake.length = 0;
    },
  };
}
