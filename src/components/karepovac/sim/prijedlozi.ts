/**
 * Oznake predloženih mjernih postaja na karti.
 *
 * Isti obrazac kao pribadače postaja (`oznake.ts`): HTML oznake preko
 * MapLibreova `Marker`, jer im treba klik i natpis, a ne samo točka. Izgled
 * je namjerno drukčiji — crtkan obrub, boja tikvine — da se prijedlog ni na
 * tren ne zamijeni s postajom koja doista mjeri.
 */

import type { Map as MapaLibre, Marker } from "maplibre-gl";

import {
  obodPodrucja,
  PRIJEDLOZI_POSTAJA,
  type PrijedlogPostaje,
} from "@/lib/sim/prijedlozi-postaja";

/** Izvor i slojevi područja; jedan prsten jer je otvorena najviše jedna kartica. */
const IZVOR_PODRUCJA = "prijedlog-podrucje";

export type Prijedlozi = {
  vidljivost(vidljivo: boolean): void;
  /**
   * Ističe odabrani prijedlog i crta njegovo područje; `null` gasi oboje.
   *
   * Područje se vidi samo dok je kartica otvorena: devet isječaka odjednom
   * prekrilo bi pola karte i ništa ne bi značilo.
   */
  istakni(id: string | null): void;
  ukloni(): void;
};

const PRAZNO = { type: "FeatureCollection" as const, features: [] };

/** Prsten područja kao GeoJSON, ili prazna zbirka kad ništa nije odabrano. */
function podrucjeKao(p: PrijedlogPostaje | undefined) {
  if (!p) return PRAZNO;
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [obodPodrucja(p)] },
        properties: { id: p.id },
      },
    ],
  };
}

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
  // Sloj područja ide ispod oznaka (one su HTML, uvijek iznad platna) i iznad
  // podloge; boja je ista maslina kao na oznakama, da se vidi čije je.
  if (!karta.getSource(IZVOR_PODRUCJA)) {
    karta.addSource(IZVOR_PODRUCJA, { type: "geojson", data: PRAZNO });
  }
  if (!karta.getLayer(`${IZVOR_PODRUCJA}-ispuna`)) {
    karta.addLayer({
      id: `${IZVOR_PODRUCJA}-ispuna`,
      type: "fill",
      source: IZVOR_PODRUCJA,
      paint: { "fill-color": "#4d7c3f", "fill-opacity": 0.12 },
    });
  }
  if (!karta.getLayer(`${IZVOR_PODRUCJA}-obris`)) {
    karta.addLayer({
      id: `${IZVOR_PODRUCJA}-obris`,
      type: "line",
      source: IZVOR_PODRUCJA,
      paint: {
        "line-color": "#4d7c3f",
        "line-width": 1.6,
        "line-dasharray": [4, 3],
        "line-opacity": 0.9,
      },
    });
  }

  const postaviPodrucje = (id: string | null) => {
    const izvor = karta.getSource(IZVOR_PODRUCJA) as
      | { setData(d: unknown): void }
      | undefined;
    izvor?.setData(podrucjeKao(PRIJEDLOZI_POSTAJA.find((p) => p.id === id)));
  };

  /**
   * Dovodi područje u kadar ako je izvan njega.
   *
   * Isječci prema Solinu i kampusu veći su od pola zaslona i na uskom zaslonu
   * lako ostanu izvan pogleda — kartica bi tada govorila o liku koji se ne
   * vidi. Ako je već sve u kadru, karta se ne miče: pomak koji nije potreban
   * gledatelju izgleda kao greška.
   */
  const dovediUKadar = (p: PrijedlogPostaje) => {
    const prsten = obodPodrucja(p);
    const lon = prsten.map((t) => t[0]);
    const lat = prsten.map((t) => t[1]);
    const okvir: [[number, number], [number, number]] = [
      [Math.min(...lon), Math.min(...lat)],
      [Math.max(...lon), Math.max(...lat)],
    ];
    const kadar = karta.getBounds?.();
    const unutra =
      kadar &&
      okvir[0][0] >= kadar.getWest() &&
      okvir[0][1] >= kadar.getSouth() &&
      okvir[1][0] <= kadar.getEast() &&
      okvir[1][1] <= kadar.getNorth();
    if (unutra) return;
    karta.fitBounds?.(okvir, {
      // Kartica stoji gore lijevo, vremenska crta dolje: bez ovoga bi lik
      // završio pod njima.
      padding: { top: 180, bottom: 150, left: 24, right: 24 },
      maxZoom: 14.5,
      duration: 600,
    });
  };

  let vidljivi = true;
  let odabran: string | null = null;

  return {
    vidljivost(vidljivo) {
      vidljivi = vidljivo;
      for (const o of oznake) o.el.style.display = vidljivo ? "" : "none";
      // Ugašeni prijedlozi ne smiju ostaviti isječak na karti.
      postaviPodrucje(vidljivo ? odabran : null);
    },
    istakni(id) {
      odabran = id;
      for (const o of oznake) o.el.classList.toggle("sim-prijedlog--odabran", o.id === id);
      postaviPodrucje(vidljivi ? id : null);
      const p = PRIJEDLOZI_POSTAJA.find((x) => x.id === id);
      if (p && vidljivi) dovediUKadar(p);
    },
    ukloni() {
      for (const o of oznake) o.marker.remove();
      oznake.length = 0;
      for (const sloj of [`${IZVOR_PODRUCJA}-obris`, `${IZVOR_PODRUCJA}-ispuna`]) {
        if (karta.getLayer(sloj)) karta.removeLayer(sloj);
      }
      if (karta.getSource(IZVOR_PODRUCJA)) karta.removeSource(IZVOR_PODRUCJA);
    },
  };
}
