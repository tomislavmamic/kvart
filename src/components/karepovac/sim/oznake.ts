/**
 * Pribadače na karti: gdje se mjeri i što je ondje izmjereno.
 *
 * Brojke stoje na mjestu mjerenja, a ne u ploči sa strane. Razlog je jedan:
 * pitanje koje gledatelj ima glasi „koliko je bilo **ondje**”, a ploča na to ne
 * može odgovoriti — ona ne zna gdje je ondje. Pribadača zna.
 *
 * Dvije vrste, i razlikuju se po tome što izvor uopće objavljuje:
 *
 * - **Postaje uz plohu** (H₂S, merkaptani) objavljuju satni niz, pa brojka
 *   prati klizač i vrijedi za odabrani sat.
 * - **Postaje vjetra** objavljuju samo zadnje očitanje — DHMZ i METAR nemaju
 *   javnu povijest. Zato im brojka stoji samo dok je klizač na sadašnjem satu;
 *   povučen unatrag, pribadača ostaje, a brojka nestane. Zadnje očitanje uz
 *   jučerašnji sat bilo bi tvrdnja koju nitko nije izmjerio.
 *
 * AZO-ove postaje (Split-2, Split-3) nemaju javno objavljene koordinate, pa se
 * ne zabadaju. Vidi napomenu uz `POSTAJE` u `src/lib/vjetar.ts`.
 *
 * Radi se izravno s DOM-om, bez Reacta: pribadače žive i umiru s kartom, a ne
 * s prikazom, pa bi ih React morao stalno pratiti kroz `ref`.
 */

import type { Map as MapaLibre, Marker } from "maplibre-gl";

import { TVARI } from "@/lib/dim";
import type { Kadar } from "@/lib/sim/kadrovi";
import { SIM_POSTAJE } from "@/lib/sim/postaje-satno";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";
import { POSTAJE, type Postaja, type Vjetar } from "@/lib/vjetar";
import { strana } from "@/components/karepovac/sim/vjetar-kartica";

/** Što pribadača postaje uz plohu piše za jednu tvar u zadanom satu. */
export function natpisMjerenja(
  kadar: Kadar | null,
  postaja: (typeof SIM_POSTAJE)[number],
): { kratica: string; vrijednost: string; nema: boolean } {
  const kratica = TVARI[postaja.tvar].kratica;
  // Budućnost se ne mjeri; crtica, a ne prazno mjesto koje bi izgledalo kao nula.
  if (!kadar || kadar.vrsta === "prognoza") {
    return { kratica, vrijednost: "—", nema: true };
  }
  const o = kadar.ocitanja.find((x) => x.postaja === postaja.oznaka);
  if (!o || o.vrijednost === null) return { kratica, vrijednost: "nema", nema: true };
  return { kratica, vrijednost: broj(o.vrijednost, 2), nema: false };
}

/**
 * Što pribadača postaje vjetra piše u zadanom satu.
 *
 * DHMZ i METAR objavljuju samo zadnje očitanje, pa brojka stoji jedino dok je
 * klizač na sadašnjem satu. Povučen unatrag, ostaje mjesto bez brojke.
 */
export function natpisVjetra(
  kadar: Kadar | null,
  imena: string,
  ocitanje: Vjetar | undefined,
  /** Satni niz te postaje, ako ga uopće objavljuje. */
  niz?: SatniVjetar | undefined,
): { imena: string; vrijednost: string; nema: boolean } {
  // AZO objavljuje satni niz, pa njegova brojka prati klizač kao i sve ostalo.
  if (niz) {
    if (niz.tisina) return { imena, vrijednost: "tišina", nema: false };
    return { imena, vrijednost: `${broj(niz.brzina, 1)} ${strana(niz.smjerOd)}`, nema: false };
  }
  // DHMZ i METAR objavljuju samo zadnje očitanje; ono vrijedi jedino sada.
  const naSada = kadar?.vrsta === "sada";
  if (!naSada) return { imena, vrijednost: "bez povijesti", nema: true };
  if (!ocitanje) return { imena, vrijednost: "šuti", nema: true };
  if (ocitanje.tisina) return { imena, vrijednost: "tišina", nema: false };
  return {
    imena,
    vrijednost: `${broj(ocitanje.brzina, 1)} ${strana(ocitanje.smjerOd)}`,
    nema: false,
  };
}

export type Oznake = {
  /** Osvježava brojke za odabrani sat. */
  postavi(
    kadar: Kadar | null,
    sada: readonly Vjetar[],
    serije: ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>,
  ): void;
  vidljivost(vidljive: boolean): void;
  ukloni(): void;
};

function broj(x: number, decimala: number): string {
  return x.toFixed(decimala).replace(".", ",");
}

/** Postaje vjetra koje se mogu zabosti — one kojima izvor objavljuje mjesto. */
const SA_MJESTOM = (Object.keys(POSTAJE) as Postaja[]).filter(
  (k) => POSTAJE[k].lat !== null && POSTAJE[k].lon !== null,
);

/** Zračna luka nosi dvije postaje na istoj točki; zabada se jednom. */
function poMjestu(): { kljuc: string; lat: number; lon: number; postaje: Postaja[] }[] {
  const skup = new Map<string, { kljuc: string; lat: number; lon: number; postaje: Postaja[] }>();
  for (const k of SA_MJESTOM) {
    const p = POSTAJE[k];
    const kljuc = `${p.lat},${p.lon}`;
    const dosad = skup.get(kljuc);
    if (dosad) dosad.postaje.push(k);
    else skup.set(kljuc, { kljuc, lat: p.lat!, lon: p.lon!, postaje: [k] });
  }
  return [...skup.values()];
}

function element(klase: string, html: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = klase;
  el.innerHTML = html;
  return el;
}

/**
 * Zabada pribadače na kartu.
 *
 * Args:
 *   karta: Karta na koju idu.
 *   maplibre: Modul, da se ne uvozi drugi put.
 *
 * Returns:
 *   Upravljač pribadačama.
 */
export function stvoriOznake(
  karta: MapaLibre,
  MarkerRazred: typeof Marker,
): Oznake {
  const pribadace: Marker[] = [];

  // --- postaje uz plohu: jedna točka, obje tvari ---
  const mjerenja = element(
    "sim-oznaka sim-oznaka--mjerenje",
    `<div class="sim-oznaka__tocka"></div><div class="sim-oznaka__ploca" data-mjerenja></div>`,
  );
  const plocaMjerenja = mjerenja.querySelector("[data-mjerenja]") as HTMLElement;
  pribadace.push(
    new MarkerRazred({ element: mjerenja, anchor: "left" })
      .setLngLat([SIM_POSTAJE[0].lon, SIM_POSTAJE[0].lat])
      .addTo(karta),
  );

  // --- postaje vjetra ---
  const vjetrovi = poMjestu().map((m) => {
    const el = element(
      "sim-oznaka sim-oznaka--vjetar",
      `<div class="sim-oznaka__tocka"></div><div class="sim-oznaka__ploca" data-v></div>`,
    );
    pribadace.push(
      new MarkerRazred({ element: el, anchor: "left" }).setLngLat([m.lon, m.lat]).addTo(karta),
    );
    return { ...m, ploca: el.querySelector("[data-v]") as HTMLElement };
  });

  return {
    postavi(kadar, sada, serije) {
      // Postaje uz plohu prate klizač: njihov niz je satni.
      const redci = SIM_POSTAJE.map((p) => {
        const n = natpisMjerenja(kadar, p);
        const klasa = n.nema ? "sim-oznaka__red sim-oznaka__red--nema" : "sim-oznaka__red";
        const v = n.nema ? `<i>${n.vrijednost}</i>` : n.vrijednost;
        return `<span class="${klasa}"><b>${n.kratica}</b> ${v}</span>`;
      });
      plocaMjerenja.innerHTML = redci.join("");
      plocaMjerenja.title = "Izmjereno na postajama uz plohu, µg/m³";

      // Postaje vjetra nemaju povijest, pa brojka stoji samo na sadašnjem satu.
      const naSada = kadar?.vrsta === "sada";
      for (const m of vjetrovi) {
        const imena = m.postaje.map((k) => POSTAJE[k].oznaka).join(" · ");
        // Ako neka od postaja na ovoj točki ima satni niz, on ima prednost.
        const izNiza = kadar
          ? m.postaje.map((k) => serije.get(k)?.get(kadar.sat)).find(Boolean)
          : undefined;
        const n = natpisVjetra(
          kadar,
          imena,
          sada.find((v) => m.postaje.includes(v.postaja)),
          izNiza,
        );
        const klasa = n.nema ? "sim-oznaka__red sim-oznaka__red--nema" : "sim-oznaka__red";
        const v = n.nema ? `<i>${n.vrijednost}</i>` : n.vrijednost;
        m.ploca.innerHTML = `<span class="${klasa}"><b>${n.imena}</b> ${v}</span>`;
        m.ploca.title = izNiza
          ? `${imena} — izmjereno u odabranom satu`
          : naSada
            ? `${imena} — zadnje objavljeno očitanje`
            : `${imena} — objavljuje samo zadnje očitanje, ne i povijest`;
      }
    },
    vidljivost(vidljive) {
      for (const p of pribadace) {
        p.getElement().style.display = vidljive ? "" : "none";
      }
    },
    ukloni() {
      for (const p of pribadace) p.remove();
      pribadace.length = 0;
    },
  };
}
