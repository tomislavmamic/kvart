"use client";

import { useEffect, useRef } from "react";

import {
  ljestvicaBoja,
  OKVIR_M,
  raspakirajPolje,
  razina,
  stvoriDimSirovo,
  UBRZANJE,
  type PoljeDima,
  type SirovoPolje,
  type Tvar,
  TVARI,
} from "@/lib/dim";
import { planSata } from "@/lib/sim/simulacija";
import type { ZaletnoPolje } from "@/lib/zrak";

/**
 * Zagrijavanje: simulacija u komadima, dok se gustoća ne ustali.
 *
 * Korak smije biti krupniji nego u živoj petlji jer izvor ne pulsira — nema
 * naleta koje bi krupno otipkavanje preskočilo. Ustaljeno stanje ovisi samo o
 * omjeru dotoka i odlaska, a ne o tome koliko se sitno računa put.
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
const ZAGRIJAVANJE = { korak: 0.25, komadMs: 12, strpljenje: 1500 };

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
 * puše (`src/lib/vjetar.ts`), pa se pri tišini čestice jedva miču — i upravo
 * se tada nad kvartom nakuplja najviše zraka s plohe.
 *
 * Promjena tvari ne ruši simulaciju. Obje tvari putuju istim zrakom, pa se
 * pri prebacivanju ne računa ništa iznova: mijenja se tablica boja i način
 * vaganja čestica (merkaptanski izvor prati radne sate, vidi
 * `PROFIL_MERKAPTANA`), oboje u istom kadru.
 */
export function DimPerjanica({
  polje,
  zalet = [],
  tvar = "sumporovodik",
  klasa = "",
}: {
  polje: PoljeDima;
  /**
   * Polja prethodnih sati, najstariji prvi.
   *
   * Zagrijavanje tada ide kroz stvarne prošle sate — isto pravilo koračanja
   * kao u simulatoru (`planSata`) — pa prizor pri učitavanju nosi zrak koji
   * se s plohe digao prije sat-dva, pod tadašnjim vjetrom, a ne izmišljeno
   * ponavljanje trenutačnoga.
   */
  zalet?: readonly ZaletnoPolje[];
  /** Koja se tvar boji; gibanje je isto za obje. */
  tvar?: Tvar;
  klasa?: string;
}) {
  const platno = useRef<HTMLCanvasElement>(null);
  // Odabrana tvar ide kroz `ref`, a ne kroz ovisnost učinka: da ulazi u
  // ovisnosti, perjanica bi se pri svakom kliku gradila ispočetka.
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

    // Zagrijavanje po fazama: stvarni prethodni sati, pa načeti tekući.
    // Bez zaleta ostaje stara jedna faza s trenutačnim poljem.
    const glavno = raspakirajPolje(polje);
    const celijaM = OKVIR_M.sirina / polje.gw;
    const faze: { polje: SirovoPolje; sekundi: number; dt: number }[] =
      zalet.map((z) => {
        const { koraka, dt } = planSata(z.brzina, celijaM);
        return {
          polje: raspakirajPolje({ ...z, maska: polje.maska }),
          sekundi: koraka * dt,
          dt,
        };
      });
    // Stvarno vrijeme prizora, za profil izvora merkaptana: t = 0 je
    // početak zaleta (puni sat), a prizor predstavlja „sada”.
    const vrhMs = Math.floor(Date.now() / 3600_000) * 3600_000;
    const sim = stvoriDimSirovo(faze.length ? faze[0].polje : glavno, {
      pocetakMs: vrhMs - zalet.length * 3600_000,
      krajMs: Date.now(),
    });
    faze.push({
      polje: glavno,
      sekundi: zalet.length
        ? Math.max((new Date().getUTCMinutes() * 60) / UBRZANJE, 5)
        : sim.zagrijavanje,
      dt: ZAGRIJAVANJE.korak,
    });
    const lut: Record<Tvar, Uint8ClampedArray> = {
      sumporovodik: ljestvicaBoja(TVARI.sumporovodik.ljestvica),
      merkaptani: ljestvicaBoja(TVARI.merkaptani.ljestvica),
    };

    element.width = sim.sirina;
    element.height = sim.visina;
    const slika = ctx.createImageData(sim.sirina, sim.visina);

    // Platno čeka prazno dok se prizor ne razvije; da ne bane, prva se slika
    // kratko utopi. Tko je isključio gibanje, dobiva je odmah.
    element.style.opacity = "0";
    if (!mirno) element.style.transition = "opacity 220ms ease-out";

    const nacrtaj = () => {
      const g = sim.crtaj(odabrana.current);
      // Ljestvica je nepomična. Kad se povlačila za vrhom u kadru, tišina i
      // bura izgledale su jednako tamno — a upravo je ta razlika ono što
      // prikaz ima reći. Sad pri tišini prizor potamni sam, a pri buri splasne.
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
      element.style.opacity = "1";
    };

    let zahtjev = 0;
    let tajmer: ReturnType<typeof setTimeout> | undefined;
    let zadnji = 0;
    let zagrijano = false;
    let vidljivo = false;
    let ugaseno = false;

    const pocetakZagrijavanja = performance.now();
    let faza = 0;
    let ostaloFaze = faze[0].sekundi;
    const zagrij = () => {
      if (ugaseno) return;
      const kraj = performance.now() + ZAGRIJAVANJE.komadMs;
      do {
        if (ostaloFaze <= 0) {
          faza += 1;
          if (faza >= faze.length) {
            zagrijano = true;
            nacrtaj();
            return;
          }
          // Čestice ostaju gdje jesu; mijenja se samo vjetar koji ih nosi —
          // isto kao pri koračanju satova u simulatoru.
          sim.postaviPolje(faze[faza].polje);
          ostaloFaze = faze[faza].sekundi;
        }
        sim.korak(faze[faza].dt);
        ostaloFaze -= faze[faza].dt;
      } while (performance.now() < kraj);
      if (performance.now() - pocetakZagrijavanja > ZAGRIJAVANJE.strpljenje) {
        nacrtaj();
      }
      tajmer = setTimeout(zagrij, 0);
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
          zagrij();
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
  }, [polje, zalet]);

  return (
    <canvas
      ref={platno}
      aria-hidden="true"
      className={`absolute inset-0 block h-full w-full ${klasa}`}
    />
  );
}
