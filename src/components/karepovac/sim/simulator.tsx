"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Bez ovoga karta ostane siva ploha: MapLibre iz stilskog lista uzima veličinu
// platna, položaj kontrola i oblik navoda izvora.
import "maplibre-gl/dist/maplibre-gl.css";

import type { Tvar } from "@/lib/dim";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import { primijeniVjetar } from "@/lib/sim/dohvat";
import type { Crta } from "@/lib/sim/kadrovi";
import { najbliziDostupan } from "@/lib/sim/kadrovi";
import { jacinaURasponu, SIDRO_SIMULATORA, ZADANA_BOJA } from "@/lib/sim/ljestvica";
import { pokreniPogon, type Pogon, type StanjePogona } from "@/lib/sim/pogon";
import { razloziOsnove, slozi, type Osnove } from "@/lib/sim/polje";
import type { SatSimulacije } from "@/lib/sim/simulacija";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";
import type { Postaja, Vjetar } from "@/lib/vjetar";
import { zapisiGustocu } from "@/lib/sim/zapis-gustoce";
import {
  dodajZgrade,
  NAJVECI_OBUHVAT,
  POCETNI_OBUHVAT,
  PODLOGE,
  SLOJEVI_POSTAJA,
  stiloviKarte,
} from "@/components/karepovac/sim/sim-karta";
import type { PostavkePrikaza, Scena } from "@/components/karepovac/sim/sim-scena";
import { stvoriOznake, type Oznake } from "@/components/karepovac/sim/oznake";
import { UpravljackaPloca, type PloceStanje } from "@/components/karepovac/sim/upravljacka-ploca";
import { VjetarKartica } from "@/components/karepovac/sim/vjetar-kartica";
import { VremenskaCrta } from "@/components/karepovac/sim/vremenska-crta";

/**
 * Simulator širenja mirisa s Karepovca.
 *
 * Sastavlja tri stvari koje inače ne znaju jedna za drugu: kartu (MapLibre),
 * račun perjanice (radnici) i postavke prikaza. Sve troje ima svoj životni
 * vijek, pa se ovdje pazi samo na to da se ne prežive međusobno.
 *
 * ## Redoslijed kojim se stvari pojavljuju
 *
 * Karta prva, jer je ona jedina koja odmah ima što pokazati. Zatim se skidaju
 * osnove polja (1,4 MB) i pokreću radnici. Perjanica se ne pojavi odjednom
 * nego sat po sat, počevši od onoga koji je odabran — traka pri dnu pokazuje
 * koji su gotovi. Na kraju stiže izmjereni vjetar s AZO-a i zamjenjuje
 * modelski ondje gdje ga ima.
 *
 * ## Pod `next dev` karta ostaje prazna
 *
 * Turbopackov razvojni način ne posluži MapLibreove radnike: zahtjevi za
 * `turbopack-worker-…` ostanu visjeti, pa svi GeoJSON izvori zauvijek stoje
 * na „neučitano”. Karta pritom ne javi nikakvu grešku — pločice se skinu,
 * platno ima veličinu, a ne nacrta se ništa. Rasterski slojevi rade jer im
 * radnik ne treba, pa je zavaravajuće: izgleda kao greška u ovom kodu.
 *
 * Za razvoj karte zato ide `npm run dev:karta` (Webpack), gdje radi. Gradnja
 * i `npm start` rade oba načina — provjereno 22. 8. 2026.
 *
 * Nijedan od tih koraka nije uvjet za prethodni. Ako osnove ne stignu, karta
 * ostaje karta; ako radnici padnu, piše zašto; ako AZO šuti, satovi ostaju na
 * modelu i tako i piše uz njih.
 */

type Kadrovi = Map<string, { bajtovi: Uint8Array; sirina: number; visina: number }>;

const ZADANI_PRIKAZ: PostavkePrikaza = {
  tvari: {
    sumporovodik: { vidljiv: true, boja: ZADANA_BOJA.sumporovodik, jacina: 1 },
    merkaptani: { vidljiv: false, boja: ZADANA_BOJA.merkaptani, jacina: 1 },
  },
  strelice: true,
  cestice: true,
  mirovanje: false,
};

const ZADANO_STANJE: PloceStanje = {
  prikaz: ZADANI_PRIKAZ,
  podloga: "karta",
  reljef: false,
  zgrade: false,
  postaje: true,
};

/** Čita postavke iz adrese, da se odabrani slučaj dade podijeliti. */
function izAdrese(zadano: PloceStanje): { stanje: PloceStanje; pomak: number | null } {
  if (typeof window === "undefined") return { stanje: zadano, pomak: null };
  const p = new URLSearchParams(window.location.search);
  // `Number(null)` je nula, a nula je ovdje smislena vrijednost (izvor koji
  // ne ispušta ništa). Bez provjere postojanja svaki bi posjet bez parametara
  // ispao kao „ploha ne ispušta ništa” — karta bi bila prazna, a izgledala bi
  // ispravno.
  const broj = (kljuc: string) => {
    const sirovo = p.get(kljuc);
    if (sirovo === null || sirovo.trim() === "") return null;
    const v = Number(sirovo);
    return Number.isFinite(v) ? v : null;
  };
  const tvar = (ime: Tvar, kratica: string) => {
    const jacina = broj(`${kratica}j`);
    return {
      vidljiv: p.get(`${kratica}v`) === null ? zadano.prikaz.tvari[ime].vidljiv : p.get(`${kratica}v`) === "1",
      boja: p.get(`${kratica}b`) ?? zadano.prikaz.tvari[ime].boja,
      jacina: jacina === null ? 1 : jacinaURasponu(jacina),
    };
  };
  const zastavica = (kljuc: string, zadana: boolean) =>
    p.get(kljuc) === null ? zadana : p.get(kljuc) === "1";
  return {
    pomak: broj("sat"),
    stanje: {
      prikaz: {
        tvari: { sumporovodik: tvar("sumporovodik", "h"), merkaptani: tvar("merkaptani", "m") },
        strelice: zastavica("str", zadano.prikaz.strelice),
        cestice: zastavica("ces", zadano.prikaz.cestice),
        mirovanje: zadano.prikaz.mirovanje,
      },
      podloga: p.get("pod") === "ortofoto" ? "ortofoto" : "karta",
      reljef: zastavica("rel", zadano.reljef),
      zgrade: zastavica("zgr", zadano.zgrade),
      postaje: zastavica("pos", zadano.postaje),
    },
  };
}

/** Piše postavke u adresu bez novog zapisa u povijesti pregledavanja. */
function uAdresu(stanje: PloceStanje, pomak: number): void {
  const p = new URLSearchParams();
  p.set("sat", String(pomak));
  for (const [ime, kratica] of [["sumporovodik", "h"], ["merkaptani", "m"]] as const) {
    const t = stanje.prikaz.tvari[ime];
    p.set(`${kratica}v`, t.vidljiv ? "1" : "0");
    p.set(`${kratica}b`, t.boja);
    p.set(`${kratica}j`, String(t.jacina));
  }
  p.set("str", stanje.prikaz.strelice ? "1" : "0");
  p.set("ces", stanje.prikaz.cestice ? "1" : "0");
  p.set("pod", stanje.podloga);
  p.set("rel", stanje.reljef ? "1" : "0");
  p.set("zgr", stanje.zgrade ? "1" : "0");
  p.set("pos", stanje.postaje ? "1" : "0");
  window.history.replaceState(null, "", `?${p.toString()}`);
}

export function Simulator({ pocetna }: { pocetna: Crta }) {
  const spremnik = useRef<HTMLDivElement>(null);
  const kartaRef = useRef<import("maplibre-gl").Map | null>(null);
  const scenaRef = useRef<Scena | null>(null);
  const pogonRef = useRef<Pogon | null>(null);
  const osnoveRef = useRef<Osnove | null>(null);
  /**
   * Je li karta spremna primiti slojeve.
   *
   * Ne pita se `isStyleLoaded()`: on je istina tek kad se učitaju **svi**
   * izvori, a među njima su zgrade od 2,3 MB. Dok one stižu, karta je odavno
   * spremna, ali bi sloj perjanice ostao neodložen — i nikad dodan, jer se
   * osnove u međuvremenu već dohvate.
   */
  const kartaSpremnaRef = useRef(false);
  const kadroviRef = useRef<Kadrovi>(new Map());

  const [crta, postaviCrtu] = useState<Crta>(pocetna);
  const [pomak, postaviPomak] = useState<number>(0);
  const [stanje, postaviStanje] = useState<PloceStanje>(ZADANO_STANJE);
  const [izracunati, postaviIzracunate] = useState<ReadonlySet<string>>(new Set());
  const [napredak, postaviNapredak] = useState<StanjePogona>({
    gotovo: 0,
    ukupno: pocetna.kadrovi.length,
    greska: null,
  });
  const [stanjeKarte, postaviStanjeKarte] = useState<"ucitavanje" | "spremna" | "bezWebgl">(
    "ucitavanje",
  );
  // Ploča je zatvorena dok je netko ne zatraži: karta je ono što se gleda.
  const [plocaOtvorena, postaviPlocu] = useState(false);
  const [sadaOcitanja, postaviSada] = useState<readonly Vjetar[]>([]);
  /** Satni nizovi po postaji; AZO ih objavljuje, DHMZ i METAR ne. */
  const [serije, postaviSerije] = useState<
    ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>
  >(new Map());
  const oznakeRef = useRef<Oznake | null>(null);
  /**
   * Je li WebGL sloj spremljen u `scenaRef`.
   *
   * Stanje, a ne samo `ref`: scena stiže iz odgođenog uvoza, dakle poslije
   * prvog crtanja. Bez okidača učinci koji je postavljaju otišli bi u prazno
   * i strelice bi ostale ugašene dok se nešto drugo ne promijeni.
   */
  const [scenaSpremna, postaviScenuSpremnom] = useState(false);

  const kadar = useMemo(
    () => crta.kadrovi.find((k) => k.pomak === pomak) ?? null,
    [crta, pomak],
  );

  /** Svi satovi za simulaciju, zalet uključen; radnicima treba upravo ovo. */
  const sviSatovi = useMemo<SatSimulacije[]>(
    () =>
      [...crta.zalet, ...crta.kadrovi]
        .filter((k) => k.stanje !== null)
        .map((k) => ({ sat: k.sat, stanje: k.stanje! })),
    [crta],
  );

  // Postavke iz adrese i poštovanje želje za mirovanjem.
  useEffect(() => {
    const { stanje: izAdr, pomak: satIzAdrese } = izAdrese(ZADANO_STANJE);
    const mir = window.matchMedia("(prefers-reduced-motion: reduce)");
    postaviStanje({ ...izAdr, prikaz: { ...izAdr.prikaz, mirovanje: mir.matches } });
    if (satIzAdrese !== null) {
      const nadeni = najbliziDostupan(pocetna, satIzAdrese);
      if (nadeni) postaviPomak(nadeni.pomak);
    }

    // Želja za mirovanjem se prati, ne samo pročita pri otvaranju. Tko je
    // uključi dok karta stoji otvorena, dobiva mirnu kartu odmah — a ne tek
    // kad je sljedeći put učita. Isto radi i maketa na `/igra`.
    const prati = (d: MediaQueryListEvent) => {
      postaviStanje((s) => ({ ...s, prikaz: { ...s.prikaz, mirovanje: d.matches } }));
    };
    mir.addEventListener("change", prati);
    return () => mir.removeEventListener("change", prati);
  }, [pocetna]);

  /** Dodaje WebGL sloj ispod postaja, čim i karta i osnove postoje. */
  const dodajSloj = useCallback(() => {
    const karta = kartaRef.current;
    const osnove = osnoveRef.current;
    // Oba uvjeta stižu neovisno — karta iz `load`, osnove iz mreže — pa se
    // pokušava iz obaju smjerova, a stvarno dodaje onaj koji stigne drugi.
    if (!karta || !osnove || !kartaSpremnaRef.current) return;
    if (scenaRef.current || karta.getLayer("karepovac-perjanica")) return;
    void import("@/components/karepovac/sim/sim-scena").then(({ stvoriSlojPerjanice }) => {
      if (!kartaRef.current || kartaRef.current !== karta) return;
      if (karta.getLayer("karepovac-perjanica")) return;
      // Ispod postaja, da oznake mjerenja ostanu iznad perjanice.
      karta.addLayer(
        stvoriSlojPerjanice(osnove, (scena) => {
          scenaRef.current = scena;
          postaviScenuSpremnom(true);
        }),
        karta.getLayer("postaje-krug") ? "postaje-krug" : undefined,
      );
    });
  }, []);

  // Karta i WebGL sloj.
  useEffect(() => {
    const element = spremnik.current;
    if (!element) return;
    let otkazano = false;

    void (async () => {
      try {
        const { Map: MapaLibre, Marker, NavigationControl, ScaleControl } = await import("maplibre-gl");
        if (otkazano) return;

        const karta = new MapaLibre({
          container: element,
          style: stiloviKarte(),
          bounds: POCETNI_OBUHVAT,
          // Ploča sa strane pokriva desnu trećinu na širokom zaslonu; bez
          // odmaka bi ploha završila ispod nje.
          fitBoundsOptions: { padding: { top: 64, bottom: 120, left: 16, right: 16 } },
          maxBounds: NAJVECI_OBUHVAT,
          maxZoom: 17,
          // Do 10 se vidi cijela mreža postaja vjetra, sve do zračne luke.
          minZoom: 10,
          // Pogled odozgo je zadan: iz njega se uspoređuje dokle perjanica
          // seže. Nagib ostaje moguć rukom, ali se ne nameće.
          pitch: 0,
          attributionControl: { compact: true },
        });
        kartaRef.current = karta;

        // Karta greške javlja događajem, ne iznimkom: bez ovoga podloga koja
        // ne stigne izgleda isto kao podloga koje nema.
        karta.on("error", (d) => {
          console.error("[sim] karta:", d.error?.message ?? d);
        });

        karta.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
        karta.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
        // `style.load`, ne `load`: `load` čeka da se učitaju i svi izvori, pa
        // bi jedan spor sloj zadržao i perjanicu i postaje. Ovaj se javi čim
        // je stil složen, a to je sve što dodavanje slojeva treba.
        karta.on("style.load", () => {
          if (otkazano) return;
          for (const sloj of SLOJEVI_POSTAJA) {
            if (!karta.getLayer(sloj.id)) karta.addLayer(sloj);
          }
          if (!oznakeRef.current) oznakeRef.current = stvoriOznake(karta, Marker);
          kartaSpremnaRef.current = true;
          dodajSloj();
          postaviStanjeKarte("spremna");
        });
      } catch {
        if (!otkazano) postaviStanjeKarte("bezWebgl");
      }
    })();

    return () => {
      otkazano = true;
      scenaRef.current = null;
      oznakeRef.current?.ukloni();
      oznakeRef.current = null;
      postaviScenuSpremnom(false);
      kartaSpremnaRef.current = false;
      kartaRef.current?.remove();
      kartaRef.current = null;
    };
  }, [dodajSloj]);

  // Osnove polja i radnici.
  useEffect(() => {
    let otkazano = false;
    void (async () => {
      try {
        const odgovor = await fetch(SIM_POLJE.bajtovi);
        if (!odgovor.ok) throw new Error("Osnove polja nisu stigle");
        const spremnikOsnova = await odgovor.arrayBuffer();
        if (otkazano) return;
        const osnove = razloziOsnove(spremnikOsnova);
        osnoveRef.current = osnove;

        dodajSloj();

        pogonRef.current = pokreniPogon({
          osnove: spremnikOsnova,
          svi: sviSatovi,
          crta: crta.kadrovi.filter((k) => k.stanje !== null).map((k) => k.sat),
          onKadar: (sat, sirina, visina, gustoca) => {
            if (otkazano) return;
            kadroviRef.current.set(sat, {
              bajtovi: zapisiGustocu(gustoca, SIDRO_SIMULATORA),
              sirina,
              visina,
            });
            postaviIzracunate(new Set(kadroviRef.current.keys()));
          },
          onStanje: (s) => {
            if (!otkazano) postaviNapredak(s);
          },
        });
        pogonRef.current.trazi(crta.kadrovi.find((k) => k.pomak === 0)?.sat ?? crta.kadrovi[0].sat);
      } catch (greska) {
        if (!otkazano) {
          postaviNapredak((s) => ({
            ...s,
            greska: greska instanceof Error ? greska.message : String(greska),
          }));
        }
      }
    })();
    return () => {
      otkazano = true;
      pogonRef.current?.ugasi();
      pogonRef.current = null;
    };
    // Radnici se pokreću jednom; crta se poslije mijenja samo u izvoru vjetra,
    // a to `primijeniVjetar` rješava bez ponovnog računa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Izmjereni vjetar stiže naknadno i zamjenjuje modelski gdje ga ima.
  useEffect(() => {
    let otkazano = false;
    void (async () => {
      try {
        const odgovor = await fetch("/api/karepovac/sim/vjetar");
        if (!odgovor.ok) return;
        const podatci: {
          satovi?: SatniVjetar[];
          sada?: Vjetar[];
          serije?: Partial<Record<Postaja, SatniVjetar[]>>;
        } = await odgovor.json();
        if (otkazano) return;
        if (podatci.sada?.length) postaviSada(podatci.sada);
        if (podatci.serije) {
          postaviSerije(
            new Map(
              Object.entries(podatci.serije).map(([postaja, niz]) => [
                postaja as Postaja,
                new Map((niz ?? []).map((v) => [v.sat, v])),
              ]),
            ),
          );
        }
        if (!podatci.satovi?.length) return;
        postaviCrtu((stara) =>
          primijeniVjetar(stara, new Map(podatci.satovi!.map((v) => [v.sat, v]))),
        );
      } catch {
        // Izmjereni vjetar je poboljšanje, ne uvjet: bez njega satovi ostaju
        // na modelu i uz njih to i piše.
      }
    })();
    return () => {
      otkazano = true;
    };
  }, []);

  // Odabrani sat → gustoća i polje vjetra u sceni.
  useEffect(() => {
    const scena = scenaRef.current;
    const osnove = osnoveRef.current;
    if (!scena || !kadar) return;
    const slika = kadroviRef.current.get(kadar.sat);
    if (slika) scena.postaviGustocu(slika.bajtovi, slika.sirina, slika.visina);
    if (osnove && kadar.stanje) {
      const polje = slozi(kadar.stanje, osnove);
      const vx = new Float32Array(polje.vx.length);
      const vy = new Float32Array(polje.vy.length);
      for (let i = 0; i < vx.length; i += 1) {
        vx[i] = (polje.vx[i] / 255) * 2 * polje.skala - polje.skala;
        vy[i] = (polje.vy[i] / 255) * 2 * polje.skala - polje.skala;
      }
      scena.postaviVjetar(vx, vy, polje.gw, polje.gh);
    }
  }, [kadar, izracunati, scenaSpremna]);

  // Odabrani sat → brojke na pribadačama.
  useEffect(() => {
    oznakeRef.current?.postavi(kadar, sadaOcitanja, serije);
  }, [kadar, sadaOcitanja, serije, stanjeKarte]);

  // Postavke prikaza → scena.
  useEffect(() => {
    scenaRef.current?.postaviPrikaz(stanje.prikaz);
  }, [stanje.prikaz, scenaSpremna]);

  // Postavke podloge → karta.
  useEffect(() => {
    const karta = kartaRef.current;
    if (!karta || stanjeKarte !== "spremna") return;
    const vidljivost = (sloj: string, vidljiv: boolean) => {
      if (karta.getLayer(sloj)) {
        karta.setLayoutProperty(sloj, "visibility", vidljiv ? "visible" : "none");
      }
    };
    vidljivost(PODLOGE.karta, stanje.podloga === "karta");
    vidljivost(PODLOGE.ortofoto, stanje.podloga === "ortofoto");
    vidljivost("reljef", stanje.reljef);
    vidljivost("postaje-krug", stanje.postaje);
    oznakeRef.current?.vidljivost(stanje.postaje);
    // Zgrade stižu tek na zahtjev; do tada sloja nema pa se nema što skrivati.
    if (stanje.zgrade) dodajZgrade(karta);
    vidljivost("zgrade", stanje.zgrade);
  }, [stanje, stanjeKarte]);

  // Adresa pamti odabrani slučaj, da se dade podijeliti.
  useEffect(() => {
    uAdresu(stanje, pomak);
  }, [stanje, pomak]);

  const naPomak = useCallback(
    (novi: number) => {
      postaviPomak(novi);
      const sat = crta.kadrovi.find((k) => k.pomak === novi)?.sat;
      if (sat) pogonRef.current?.trazi(sat);
    },
    [crta],
  );

  const spreman = kadar !== null && izracunati.has(kadar.sat);

  if (stanjeKarte === "bezWebgl") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-100 p-6">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center">
          <h1 className="text-lg font-bold text-zinc-900">Simulator traži WebGL</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Ovaj preglednik ne može nacrtati kartu s ubrzanom grafikom, pa
            simulator ovdje ne radi. Isti model i ista mjerenja stoje i na
            pregledu, bez trodimenzionalnog prikaza.
          </p>
          <Link
            href="/karepovac/zrak"
            className="fokus mt-4 inline-flex min-h-11 items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Otvori pregled zraka
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-100">
      {/* Visina se zadaje izravno, a ne kroz `inset-0`: MapLibre spremniku
          postavi `position: relative`, pa se gornji i donji rub prestanu
          držati roditelja i visina padne na nulu. Karta tada postoji, prima
          kontrole i ne javlja grešku — samo ne traži nijednu pločicu. */}
      <div ref={spremnik} className="h-full w-full" />

      {/* Gore lijevo stoji ono što vodi cijelu kartu: vjetar koji model uzima
          za odabrani sat. Ispod njega samo napredak računa, i to dok traje. */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5">
        <VjetarKartica kadar={kadar} />
        {napredak.greska || napredak.gotovo < napredak.ukupno ? (
          <span className="pointer-events-auto rounded bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-white">
            {napredak.greska ?? `Računam ${napredak.gotovo}/${napredak.ukupno} sati`}
          </span>
        ) : null}
      </div>

      {/* Gore desno: izlaz i otvaranje ploče. Ništa više — navigacija stranice
          je na ovoj karti sakrivena (vidi PUNI_PROZOR u site-chrome). */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => postaviPlocu((v) => !v)}
          aria-expanded={plocaOtvorena}
          aria-label={plocaOtvorena ? "Zatvori postavke" : "Otvori postavke"}
          className="fokus flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 text-zinc-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm hover:bg-white hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
            <path
              d="M3 6h14M3 10h14M3 14h14"
              className="stroke-current"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
        <Link
          href="/karepovac/zrak"
          aria-label="Zatvori simulator"
          className="fokus flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 text-zinc-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm hover:bg-white hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
            <path
              d="M5 5l10 10M15 5L5 15"
              className="stroke-current"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </Link>
      </div>

      {/* Ploča se otvara na zahtjev i sa strane, da karta ostane vidljiva. */}
      {plocaOtvorena ? (
        <div className="absolute inset-x-0 bottom-0 top-16 z-20 overflow-y-auto border-t border-black/5 bg-white/90 backdrop-blur-md sm:inset-x-auto sm:right-3 sm:bottom-14 sm:w-[19rem] sm:rounded-xl sm:border sm:shadow-lg">
          <UpravljackaPloca
            stanje={stanje}
            naPrikaz={(prikaz) => postaviStanje((s) => ({ ...s, prikaz }))}
            naStanje={(p) => postaviStanje((s) => ({ ...s, ...p }))}
            naSredinu={() =>
              kartaRef.current?.fitBounds(POCETNI_OBUHVAT, { duration: 600, pitch: 0 })
            }
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
        <div className="mx-auto max-w-3xl">
          {!spreman && kadar ? (
            <p className="pointer-events-auto mb-1.5 inline-block rounded bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-white">
              {kadar.dostupnost === "nedostupno"
                ? "Za ovaj sat nema podataka o vjetru."
                : "Računam ovaj sat…"}
            </p>
          ) : null}
          <VremenskaCrta
            crta={crta}
            pomak={pomak}
            izracunati={izracunati}
            naPromjenu={naPomak}
          />
        </div>
      </div>
    </div>
  );
}
