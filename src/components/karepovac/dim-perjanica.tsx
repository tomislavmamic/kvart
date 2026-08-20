"use client";

import { useEffect, useRef } from "react";

import { SLUCAJEVI_DIMA } from "@/generated/karepovac-polje";
import { type Tvar, TVARI, ljestvicaBoja, razina, stvoriDim } from "@/lib/dim";

/**
 * Zagrijavanje: sedamdesetak sekundi prikaza, u komadima.
 *
 * Toliko treba da se perjanica ustali — pri slabom vjetru čestica prijeđe
 * okvir za nekih pola minute, a gustoća se puni dok se dotok i odlazak ne
 * izjednače. Korak smije biti krupan jer izvor više ne pulsira; prije je
 * krupan korak preskakao pulseve pa su naleti izlazili u grudama.
 */
const ZAGRIJAVANJE = { komada: 25, poKomadu: 12, korak: 0.25 };

/**
 * Perjanica mirisa nad kvartom, računata u pregledniku.
 *
 * Stvari koje nisu očite:
 *
 * Zagrijavanje ide preko `setTimeout`, a ne u petlji animacije, jer bi karta
 * inače dobru minutu stajala gotovo prazna; odraditi to u jednom potezu
 * blokira prikaz. Usput znači da se perjanica pojavi i ondje gdje preglednik
 * uspori `requestAnimationFrame` — u pozadinskoj kartici ili pri štednji.
 *
 * Platno se pokreće tek kad uđe u vidno polje, da kartice koje nitko ne gleda
 * ne troše struju.
 *
 * Promjena tvari ne ruši simulaciju. Sumporovodik i merkaptani putuju istim
 * zrakom i na ovoj udaljenosti jednako — razlikuju se po tome koliko ih ima i
 * pri kojoj se količini osjete, a to je razlika u ljestvici, ne u gibanju.
 * Zato se pri prebacivanju mijenja samo tablica boja, i prizor ne trepne.
 *
 * Promjena slučaja vremena, naprotiv, gradi sve iznova. Zadržati čestice pri
 * promjeni polja izgledalo bi kao da vjetar okrene u trenutku, a on to ne radi.
 */
export function DimPerjanica({
  slucaj = 0,
  tvar = "sumporovodik",
  klasa = "",
}: {
  /** Redni broj slučaja vremena u `SLUCAJEVI_DIMA`. */
  slucaj?: number;
  /** Koja se tvar boji; gibanje je isto za obje. */
  tvar?: Tvar;
  klasa?: string;
}) {
  const platno = useRef<HTMLCanvasElement>(null);
  // Odabrana tvar ide kroz `ref`, a ne kroz ovisnost učinka: mijenja se samo
  // tablica boja, pa bi ponovno građenje simulacije značilo da perjanica pri
  // svakom prebacivanju krene ispočetka.
  const odabrana = useRef<Tvar>(tvar);
  useEffect(() => {
    odabrana.current = tvar;
  }, [tvar]);

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
    const lut: Record<Tvar, Uint8ClampedArray> = {
      sumporovodik: ljestvicaBoja(TVARI.sumporovodik.ljestvica),
      merkaptani: ljestvicaBoja(TVARI.merkaptani.ljestvica),
    };

    element.width = sim.sirina;
    element.height = sim.visina;
    const slika = ctx.createImageData(sim.sirina, sim.visina);

    const nacrtaj = () => {
      const g = sim.crtaj();
      // Ljestvica je nepomična. Kad se povlačila za vrhom u kadru, bezvjetrica
      // i vjetar izgledali su jednako tamno — a upravo je ta razlika ono što
      // prikaz ima reći.
      const t = odabrana.current;
      const boje = lut[t];
      const d = slika.data;
      for (let i = 0; i < g.length; i += 1) {
        const q = ((razina(g[i], t) * 255) | 0) * 4;
        d[i * 4] = boje[q];
        d[i * 4 + 1] = boje[q + 1];
        d[i * 4 + 2] = boje[q + 2];
        d[i * 4 + 3] = boje[q + 3];
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
      nacrtaj();
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
      nacrtaj();
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
