"use client";

import { useEffect, useRef } from "react";

import { SLUCAJEVI_DIMA } from "@/generated/karepovac-polje";
import { ljestvicaBoja, stvoriDim } from "@/lib/dim";

/**
 * Zagrijavanje: dvanaest sekundi simulacije, u komadima.
 *
 * Korak mora ostati jednak onome u živoj petlji. Pri krupnijem koraku puls
 * izvora se preskače između dva otipkavanja, pa naleti izađu u grudama i
 * perjanica se odvoji od plohe.
 */
const ZAGRIJAVANJE = { komada: 20, poKomadu: 12, korak: 0.05 };

/**
 * Perjanica mirisa nad kvartom, računata u pregledniku.
 *
 * Dvije stvari koje nisu očite:
 *
 * Zagrijavanje ide preko `setTimeout`, a ne u petlji animacije. Prvi nalet
 * treba dvanaestak sekundi da prijeđe kvart, pa bi karta dotad stajala prazna;
 * odraditi to u jednom potezu blokira prikaz oko 700 ms. Ovako se razlomi na
 * komade, a usput znači da se perjanica pojavi i ondje gdje preglednik uspori
 * `requestAnimationFrame` — u pozadinskoj kartici ili pri štednji baterije.
 *
 * Platno se pokreće tek kad uđe u vidno polje, da kartice koje nitko ne gleda
 * ne troše struju.
 *
 * Promjena slučaja vremena ruši i ponovno gradi cijelu simulaciju. Zadržati
 * čestice pri promjeni polja izgledalo bi kao da vjetar okrene u trenutku, a
 * on to ne radi — i prizor bi nekoliko sekundi bio ni jedno ni drugo.
 */
export function DimPerjanica({
  slucaj = 0,
  klasa = "",
}: {
  /** Redni broj slučaja vremena u `SLUCAJEVI_DIMA`. */
  slucaj?: number;
  klasa?: string;
}) {
  const platno = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = platno.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;

    const mirno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const odabran = SLUCAJEVI_DIMA.slucajevi[slucaj] ?? SLUCAJEVI_DIMA.slucajevi[0];
    const sim = stvoriDim(
      {
        gw: SLUCAJEVI_DIMA.gw,
        gh: SLUCAJEVI_DIMA.gh,
        maska: SLUCAJEVI_DIMA.maska,
        skala: odabran.skala,
        vx: odabran.vx,
        vy: odabran.vy,
      },
      {},
    );
    const lut = ljestvicaBoja();

    element.width = sim.sirina;
    element.height = sim.visina;
    const slika = ctx.createImageData(sim.sirina, sim.visina);
    let norma = 8;

    const nacrtaj = (brzoNamjesti: boolean) => {
      const g = sim.crtaj();
      let najvise = 0;
      for (let i = 0; i < g.length; i += 1) if (g[i] > najvise) najvise = g[i];
      // Ljestvica se povlači za vrhom, da prizor ne titra; dok se perjanica
      // tek razvija smije se namjestiti brže.
      norma += (Math.max(najvise * 0.8, 0.2) - norma) * (brzoNamjesti ? 0.3 : 0.04);

      const d = slika.data;
      for (let i = 0; i < g.length; i += 1) {
        const v = g[i] / norma;
        const q = (v > 1 ? 255 : v < 0 ? 0 : (v * 255) | 0) * 4;
        d[i * 4] = lut[q];
        d[i * 4 + 1] = lut[q + 1];
        d[i * 4 + 2] = lut[q + 2];
        d[i * 4 + 3] = lut[q + 3];
      }
      ctx.putImageData(slika, 0, 0);
    };

    let zahtjev = 0;
    let tajmer: ReturnType<typeof setTimeout> | undefined;
    let zadnji = 0;
    let zagrijano = false;
    let vidljivo = false;
    let ugaseno = false;

    const zagrij = (preostalo: number) => {
      if (ugaseno) return;
      if (preostalo <= 0) {
        zagrijano = true;
        return;
      }
      for (let s = 0; s < ZAGRIJAVANJE.poKomadu; s += 1) {
        sim.korak(ZAGRIJAVANJE.korak);
      }
      nacrtaj(true);
      tajmer = setTimeout(() => zagrij(preostalo - 1), 0);
    };

    const petlja = (t: number) => {
      zahtjev = requestAnimationFrame(petlja);
      if (!vidljivo || !zagrijano || document.hidden || mirno) {
        zadnji = t;
        return;
      }
      const dt = zadnji ? Math.min(0.05, (t - zadnji) / 1000) : 1 / 60;
      zadnji = t;
      sim.korak(dt);
      nacrtaj(false);
    };

    const promatrac = new IntersectionObserver(
      ([unos]) => {
        vidljivo = unos.isIntersecting;
        if (!vidljivo) {
          zadnji = 0;
          return;
        }
        if (!zagrijano && tajmer === undefined) {
          zagrij(ZAGRIJAVANJE.komada);
        }
      },
      { rootMargin: "120px" },
    );
    promatrac.observe(element);
    zahtjev = requestAnimationFrame(petlja);

    return () => {
      ugaseno = true;
      cancelAnimationFrame(zahtjev);
      if (tajmer !== undefined) clearTimeout(tajmer);
      promatrac.disconnect();
    };
  }, [slucaj]);

  return (
    <canvas
      ref={platno}
      aria-hidden="true"
      className={`absolute inset-0 block h-full w-full ${klasa}`}
    />
  );
}
