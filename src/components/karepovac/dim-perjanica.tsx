"use client";

import { useEffect, useRef } from "react";

import { ljestvicaBoja, stvoriDim, type PoljeDima } from "@/lib/dim";

/**
 * Zagrijavanje: simulacija u komadima, dok prizor ne prijeđe okvir.
 *
 * Korak mora ostati jednak onome u živoj petlji. Pri krupnijem koraku puls
 * izvora se preskače između dva otipkavanja, pa naleti izađu u grudama i
 * perjanica se odvoji od plohe.
 *
 * Komad se mjeri vremenom, a ne brojem koraka: jedan korak s devedeset tisuća
 * čestica traje od 7 do 20 ms, pa je komad od dvanaest koraka znao zaustaviti
 * stranicu na četvrt sekunde odjednom. Ovako se stane čim istekne proračun za
 * jednu sličicu.
 *
 * Međukoraci se ne crtaju. Dvanaest sekundi simulacije prođe za manje od
 * sekunde stvarnog vremena, pa bi crtanje svakog komada izgledalo kao
 * premotavanje na početku svakog učitavanja. Platno zato stoji prazno dok se
 * prizor ne razvije, pa se pojavi odjednom.
 *
 * Ako zagrijavanje potraje — na sporom uređaju ili u pozadinskoj kartici, gdje
 * preglednik usporava `setTimeout` na sekundu po pozivu — počinje se crtati i
 * usput, jer je tada bolje vidjeti kako se razvija nego dugo gledati prazno.
 */
const ZAGRIJAVANJE = { korak: 0.05, komadMs: 12, strpljenje: 1500 };

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
 * Polje dolazi izvana, iz poslužitelja: složeno je za vjetar koji trenutačno
 * puše (`src/lib/vjetar.ts`), pa se pri tišini čestice jedva miču.
 */
export function DimPerjanica({
  polje,
  klasa = "",
}: {
  polje: PoljeDima;
  klasa?: string;
}) {
  const platno = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = platno.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;

    const mirno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sim = stvoriDim(polje, {});
    const lut = ljestvicaBoja();

    element.width = sim.sirina;
    element.height = sim.visina;
    const slika = ctx.createImageData(sim.sirina, sim.visina);
    let norma = 0;

    // Platno čeka prazno dok se prizor ne razvije; da ne bane, prva se slika
    // kratko utopi. Tko je isključio gibanje, dobiva je odmah.
    element.style.opacity = "0";
    if (!mirno) element.style.transition = "opacity 220ms ease-out";

    const nacrtaj = () => {
      const g = sim.crtaj();
      let najvise = 0;
      for (let i = 0; i < g.length; i += 1) if (g[i] > najvise) najvise = g[i];
      const cilj = Math.max(najvise * 0.8, 0.2);
      // Ljestvica se povlači za vrhom, da prizor ne titra. Prvi put se namjesti
      // odmah: da se povlači i tada, prva bi slika bila presvijetla pa bi se
      // gasila pred očima.
      norma = norma === 0 ? cilj : norma + (cilj - norma) * 0.04;

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
      element.style.opacity = "1";
    };

    let zahtjev = 0;
    let tajmer: ReturnType<typeof setTimeout> | undefined;
    let zadnji = 0;
    let zagrijano = false;
    let vidljivo = false;
    let ugaseno = false;

    const pocetakZagrijavanja = performance.now();
    const zagrij = (preostaloSekundi: number) => {
      if (ugaseno) return;
      if (preostaloSekundi <= 0) {
        zagrijano = true;
        nacrtaj();
        return;
      }
      const kraj = performance.now() + ZAGRIJAVANJE.komadMs;
      let ostalo = preostaloSekundi;
      do {
        sim.korak(ZAGRIJAVANJE.korak);
        ostalo -= ZAGRIJAVANJE.korak;
      } while (ostalo > 0 && performance.now() < kraj);
      if (performance.now() - pocetakZagrijavanja > ZAGRIJAVANJE.strpljenje) {
        nacrtaj();
      }
      tajmer = setTimeout(() => zagrij(ostalo), 0);
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
          zagrij(sim.zagrijavanje);
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
  }, [polje]);

  return (
    <canvas
      ref={platno}
      aria-hidden="true"
      className={`absolute inset-0 block h-full w-full ${klasa}`}
    />
  );
}
