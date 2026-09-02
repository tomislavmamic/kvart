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
import { najbliziDostupan, zahvaceniSati } from "@/lib/sim/kadrovi";
import { bojaZa, jacinaURasponu, SIDRO_SIMULATORA, ZADANA_BOJA } from "@/lib/sim/ljestvica";
import { pokreniPogon, type Pogon, type StanjePogona } from "@/lib/sim/pogon";
import { razloziOsnove, slozi, type Osnove } from "@/lib/sim/polje";
import { crtaScenarija, jeScenarij } from "@/lib/sim/scenariji";
import { ZALET_SATI, type SatSimulacije } from "@/lib/sim/simulacija";
import {
  izvediSituaciju,
  ocijeniPodrucja,
  ukupnaRazina,
  type Razina,
  type Situacija,
  type SusjedniSat,
} from "@/lib/sim/situacija";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";
import type { Postaja, Vjetar } from "@/lib/vjetar";
import { zapisiGustocu } from "@/lib/sim/zapis-gustoce";
import {
  dodajSlojeveSimulatora,
  dodajZgrade,
  NAJVECI_OBUHVAT,
  POCETNI_OBUHVAT,
  PODLOGE,
  ucitajStil,
} from "@/components/karepovac/sim/sim-karta";
import type { PostavkePrikaza, Scena } from "@/components/karepovac/sim/sim-scena";
import { stvoriOznake, type Oznake } from "@/components/karepovac/sim/oznake";
import { SituacijaKartica } from "@/components/karepovac/sim/situacija-kartica";
import { TockaKartica } from "@/components/karepovac/sim/tocka-kartica";
import { PrijedlogKartica } from "@/components/karepovac/sim/prijedlog-kartica";
import { stvoriPrijedloge, type Prijedlozi } from "@/components/karepovac/sim/prijedlozi";
import type { PrijedlogPostaje } from "@/lib/sim/prijedlozi-postaja";
import { izvediTocku, razinaUTocki, tockaIzAdrese, type Tocka } from "@/lib/sim/tocka";
import { UpravljackaPloca, type PloceStanje } from "@/components/karepovac/sim/upravljacka-ploca";
import { VremenskaCrta } from "@/components/karepovac/sim/vremenska-crta";
import {
  nesigurnostKadra,
  PRIJELAZ_MS,
} from "@/components/karepovac/sim/vremenska-crta-logika";

/**
 * Simulator širenja mirisa s Karepovca.
 *
 * Sastavlja tri stvari koje inače ne znaju jedna za drugu: kartu (MapLibre),
 * račun perjanice (radnici) i postavke prikaza. Sve troje ima svoj životni
 * vijek, pa se ovdje pazi samo na to da se ne prežive međusobno.
 *
 * ## Što se vidi prvo
 *
 * Kartica situacije gore i traka vremena dolje; karta između. Kartica
 * odgovara na „smrdi li kod mene, koliko, kamo ide, hoće li biti bolje i
 * koliko ste sigurni” (`situacija.ts`), traka pokazuje kad je bilo i kad će
 * biti loše. Postavke — boje, jačina izvora, podloge — stoje iza gumba
 * „Više”: to je ono što se traži, ne ono što se gleda.
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
 * `turbopack-worker-…` ostanu visjeti, pa svi GeoJSON izvori — i vektorska
 * podloga, koja isti radnik treba — zauvijek stoje na „neučitano”. Karta
 * pritom ne javi nikakvu grešku. Rasterski slojevi rade jer im radnik ne
 * treba, pa je zavaravajuće: izgleda kao greška u ovom kodu.
 *
 * Za razvoj karte zato ide `npm run dev:karta` (Webpack), gdje radi. Gradnja
 * i `npm start` rade oba načina — provjereno 22. 8. 2026.
 *
 * ## Adresa
 *
 * Uz postavke prikaza adresa nosi i dva prekidača za stroj, ne za čovjeka:
 * `?scenarij=<ime>` zamjenjuje živu crtu zadanim prizorom iz `scenariji.ts`
 * (isti radnici, isti model — mijenja se samo ulaz), a `?snimka=1` čuva
 * nacrtano platno između slika i gasi sve što se samo od sebe miče, da
 * automatska snimka zaslona bude ista svaki put.
 *
 * Nijedan od tih koraka nije uvjet za prethodni. Ako osnove ne stignu, karta
 * ostaje karta; ako radnici padnu, piše zašto; ako AZO šuti, satovi ostaju na
 * modelu i tako i piše uz njih.
 */

type Kadrovi = Map<
  string,
  {
    bajtovi: Uint8Array;
    /** Merkaptanska gustoća; drugi zapis jer izvor prati radne sate. */
    bajtoviMerkaptana: Uint8Array;
    sirina: number;
    visina: number;
  }
>;

const ZADANI_PRIKAZ: PostavkePrikaza = {
  tvari: {
    sumporovodik: { vidljiv: true, boja: ZADANA_BOJA.sumporovodik, jacina: 1 },
    merkaptani: { vidljiv: false, boja: ZADANA_BOJA.merkaptani, jacina: 1 },
  },
  vjetar: true,
  mirovanje: false,
};

const ZADANO_STANJE: PloceStanje = {
  prikaz: ZADANI_PRIKAZ,
  podloga: "karta",
  reljef: false,
  zgrade: false,
  postaje: true,
  prijedlozi: true,
};

const PRAZNO = new Uint8Array(0);

/** Čita postavke iz adrese, da se odabrani slučaj dade podijeliti. */
function izAdrese(zadano: PloceStanje): {
  stanje: PloceStanje;
  pomak: number | null;
  scenarij: string | null;
  snimka: boolean;
} {
  if (typeof window === "undefined") return { stanje: zadano, pomak: null, scenarij: null, snimka: false };
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
    scenarij: p.get("scenarij"),
    snimka: p.get("snimka") === "1",
    stanje: {
      prikaz: {
        tvari: { sumporovodik: tvar("sumporovodik", "h"), merkaptani: tvar("merkaptani", "m") },
        // Adrese podijeljene prije nego su strujnice i čestice srasle u
        // tragove nose `str` i `ces`; tko je imao upaljeno ijedno od toga,
        // htio je vidjeti vjetar, pa mu ostane upaljen.
        vjetar:
          p.get("vje") === null
            ? p.get("str") === null && p.get("ces") === null
              ? zadano.prikaz.vjetar
              : p.get("str") === "1" || p.get("ces") === "1"
            : p.get("vje") === "1",
        mirovanje: zadano.prikaz.mirovanje,
      },
      podloga: p.get("pod") === "ortofoto" ? "ortofoto" : "karta",
      reljef: zastavica("rel", zadano.reljef),
      zgrade: zastavica("zgr", zadano.zgrade),
      postaje: zastavica("pos", zadano.postaje),
      prijedlozi: zastavica("pri", zadano.prijedlozi),
    },
  };
}

/** Piše postavke u adresu bez novog zapisa u povijesti pregledavanja. */
function uAdresu(stanje: PloceStanje, pomak: number): void {
  const staro = new URLSearchParams(window.location.search);
  const p = new URLSearchParams();
  // Prekidači za stroj ostaju kakvi jesu; njih ovdje nitko ne mijenja.
  for (const kljuc of ["scenarij", "snimka", "t"]) {
    const v = staro.get(kljuc);
    if (v !== null) p.set(kljuc, v);
  }
  p.set("sat", String(pomak));
  for (const [ime, kratica] of [["sumporovodik", "h"], ["merkaptani", "m"]] as const) {
    const t = stanje.prikaz.tvari[ime];
    p.set(`${kratica}v`, t.vidljiv ? "1" : "0");
    p.set(`${kratica}b`, t.boja);
    p.set(`${kratica}j`, String(t.jacina));
  }
  p.set("vje", stanje.prikaz.vjetar ? "1" : "0");
  p.set("pod", stanje.podloga);
  p.set("rel", stanje.reljef ? "1" : "0");
  p.set("zgr", stanje.zgrade ? "1" : "0");
  p.set("pos", stanje.postaje ? "1" : "0");
  p.set("pri", stanje.prijedlozi ? "1" : "0");
  window.history.replaceState(null, "", `?${p.toString()}`);
}

/** Satovi za simulaciju, zalet uključen; radnicima treba upravo ovo. */
function satoviZaRadnike(crta: Crta): SatSimulacije[] {
  return [...crta.zalet, ...crta.kadrovi]
    .filter((k) => k.stanje !== null)
    .map((k) => ({ sat: k.sat, stanje: k.stanje! }));
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
  /**
   * Crta s kojom radnici kreću. Scenarij iz adrese zamjenjuje živu prije
   * nego se radnici pokrenu; učinci u istom prolazu ne vide novo stanje,
   * pa se predaje kroz `ref`.
   */
  const pocetnaCrtaRef = useRef<Crta>(pocetna);
  const scenarijRef = useRef<string | null>(null);
  const snimkaRef = useRef(false);

  const [crta, postaviCrtu] = useState<Crta>(pocetna);
  const [pomak, postaviPomak] = useState<number>(0);
  /**
   * Mjesto na koje je gledatelj kliknuo — „a kod mene?”. Jedno, jer kartica
   * za dva mjesta više nije kartica nego tablica; drugi klik zamjenjuje prvi.
   */
  const [tocka, postaviTocku] = useState<Tocka | null>(() =>
    typeof window === "undefined" ? null : tockaIzAdrese(new URLSearchParams(window.location.search).get("t")),
  );
  const markerKlasaRef = useRef<typeof import("maplibre-gl").Marker | null>(null);
  /** Odabrani prijedlog postaje; klik na kartu ga miče. */
  const [prijedlog, postaviPrijedlog] = useState<PrijedlogPostaje | null>(null);
  const prijedloziRef = useRef<Prijedlozi | null>(null);
  const tockaMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const pomakRef = useRef(0);
  const [stanje, postaviStanje] = useState<PloceStanje>(ZADANO_STANJE);
  const [snimka, postaviSnimku] = useState(false);
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
  const [reproducira, postaviReprodukciju] = useState(false);
  const [sadaOcitanja, postaviSada] = useState<readonly Vjetar[]>([]);
  /** Dohvat vjetra traje dvadesetak sekundi; do tada pribadače čekaju. */
  const [vjetarStigao, postaviVjetarStigao] = useState(false);
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

  // Postavke iz adrese, scenarij, snimka i poštovanje želje za mirovanjem.
  useEffect(() => {
    const { stanje: izAdr, pomak: satIzAdrese, scenarij, snimka: zaSnimku } = izAdrese(ZADANO_STANJE);
    const mir = window.matchMedia("(prefers-reduced-motion: reduce)");
    snimkaRef.current = zaSnimku;
    postaviSnimku(zaSnimku);
    // Snimka ne smije ovisiti o trenutku: tragovi vjetra miruju kao pri
    // želji za mirovanjem.
    postaviStanje({ ...izAdr, prikaz: { ...izAdr.prikaz, mirovanje: mir.matches || zaSnimku } });

    let pocetnaCrta = pocetna;
    if (jeScenarij(scenarij)) {
      const zadana = crtaScenarija(scenarij);
      if (zadana) {
        pocetnaCrta = zadana;
        scenarijRef.current = scenarij;
        pocetnaCrtaRef.current = zadana;
        postaviCrtu(zadana);
        postaviNapredak((s) => ({ ...s, ukupno: zadana.kadrovi.length }));
      }
    }
    if (satIzAdrese !== null) {
      const nadeni = najbliziDostupan(pocetnaCrta, satIzAdrese);
      if (nadeni) postaviPomak(nadeni.pomak);
    }

    // Želja za mirovanjem se prati, ne samo pročita pri otvaranju. Tko je
    // uključi dok karta stoji otvorena, dobiva mirnu kartu odmah — a ne tek
    // kad je sljedeći put učita. Isto radi i maketa na `/igra`.
    const prati = (d: MediaQueryListEvent) => {
      postaviStanje((s) => ({ ...s, prikaz: { ...s.prikaz, mirovanje: d.matches || snimkaRef.current } }));
      if (d.matches) postaviReprodukciju(false);
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
        const [{ Map: MapaLibre, Marker, NavigationControl, ScaleControl, setWorkerUrl }, stil] =
          await Promise.all([import("maplibre-gl"), ucitajStil()]);
        if (otkazano) return;
        // MapLibreov radnik parsira vektorske pločice. Kad ga pakira Next
        // (Turbopack, i u `next build`), zahtjev za `turbopack-worker-…js`
        // ostane visjeti i karta nikad ne zatraži nijednu pločicu — bez
        // greške, samo prazna podloga (provjereno 2. 9. 2026. na
        // proizvodnoj gradnji). Zato radnik dolazi kao gotova datoteka iz
        // `public/`, koju `kopiraj:maplibre-radnik` prepisuje pri gradnji.
        setWorkerUrl("/karepovac/maplibre/maplibre-gl-worker.mjs");
        const zaSnimku = new URLSearchParams(window.location.search).get("snimka") === "1";

        const karta = new MapaLibre({
          container: element,
          style: stil,
          bounds: POCETNI_OBUHVAT,
          // Kartica gore i traka dolje pokrivaju rubove; bez odmaka bi ploha
          // završila ispod njih.
          fitBoundsOptions: { padding: { top: 150, bottom: 110, left: 16, right: 16 } },
          maxBounds: NAJVECI_OBUHVAT,
          maxZoom: 17,
          // Do 10 se vidi cijela mreža postaja vjetra, sve do zračne luke.
          minZoom: 10,
          // Pogled odozgo je zadan: iz njega se uspoređuje dokle perjanica
          // seže. Nagib ostaje moguć rukom, ali se ne nameće.
          pitch: 0,
          attributionControl: { compact: true },
          // Bez ovoga preglednik platno isprazni čim ga nacrta, pa snimka
          // zaslona uhvati prazninu osim ako karta baš tada crta. Košta
          // nešto memorije, zato samo za snimku.
          canvasContextAttributes: zaSnimku ? { preserveDrawingBuffer: true } : undefined,
        });
        kartaRef.current = karta;
        // Skrivena kartica (prozor iza drugoga, automatska snimka) ne dobiva
        // `requestAnimationFrame`, a MapLibre i učitavanje stila dovrši tek u
        // njemu: karta ostane na boji podloge bez ijedne pločice, bez greške
        // (izmjereno 2. 9. 2026.: `document.hidden === true`, `loaded()`
        // laž i nakon 30 s). U načinu snimke zato crtanje tjera sat, ne okvir.
        const tikSnimke = zaSnimku
          ? window.setInterval(() => {
              try {
                karta.redraw();
              } catch {
                // Karta u rastavljanju; sljedeći otkucaj ionako ne stiže.
              }
            }, 300)
          : null;
        karta.once("remove", () => {
          if (tikSnimke !== null) window.clearInterval(tikSnimke);
        });

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
        // Klik na kartu bira mjesto za karticu „kod mene”. Pribadače postaja
        // su HTML oznake i njihov klik ne stiže do platna, pa se ne miješaju.
        karta.on("click", (d) => {
          postaviTocku({ lat: d.lngLat.lat, lng: d.lngLat.lng });
          postaviPrijedlog(null);
        });
        karta.on("style.load", () => {
          if (otkazano) return;
          dodajSlojeveSimulatora(karta);
          if (!oznakeRef.current) oznakeRef.current = stvoriOznake(karta, Marker);
          markerKlasaRef.current = Marker;
          if (!prijedloziRef.current) {
            prijedloziRef.current = stvoriPrijedloge(karta, Marker, (p) => {
              postaviPrijedlog(p);
              postaviTocku(null);
            });
          }
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
      prijedloziRef.current?.ukloni();
      prijedloziRef.current = null;
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

        const pocetnaCrta = pocetnaCrtaRef.current;
        pogonRef.current = pokreniPogon({
          osnove: spremnikOsnova,
          svi: satoviZaRadnike(pocetnaCrta),
          crta: pocetnaCrta.kadrovi.filter((k) => k.stanje !== null).map((k) => k.sat),
          onKadar: (sat, sirina, visina, gustoca, merkaptani) => {
            if (otkazano) return;
            kadroviRef.current.set(sat, {
              bajtovi: zapisiGustocu(gustoca, SIDRO_SIMULATORA),
              bajtoviMerkaptana: zapisiGustocu(merkaptani, SIDRO_SIMULATORA),
              sirina,
              visina,
            });
            postaviIzracunate(new Set(kadroviRef.current.keys()));
          },
          onStanje: (s) => {
            if (!otkazano) postaviNapredak(s);
          },
        });
        const gledani =
          pocetnaCrta.kadrovi.find((k) => k.pomak === pomakRef.current)?.sat ??
          pocetnaCrta.kadrovi.find((k) => k.pomak === 0)?.sat ??
          pocetnaCrta.kadrovi[0].sat;
        pogonRef.current.trazi(gledani);
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

  /**
   * Šalje radnicima na ponovni račun sate kojima je vjetar promijenjen.
   *
   * `primijeniVjetar` mijenja podatke, ali slike su već izračunate na
   * modelskom vjetru — bez ovoga bi karta crtala perjanicu vjetra kojega
   * više nigdje ne piše, a upravo je tekući sat onaj koji AZO najčešće
   * javi tek naknadno. Promjena sata utječe i na sljedeća tri: svaki se
   * kadar računa iz svog zaleta (`ZALET_SATI`).
   */
  const preracunajPromijenjene = useCallback((stari: Crta, novi: Crta) => {
    const pogon = pogonRef.current;
    if (!pogon) return;
    const zaKadar = zahvaceniSati(stari, novi, ZALET_SATI);
    if (!zaKadar.length) return;
    for (const sat of zaKadar) kadroviRef.current.delete(sat);
    postaviIzracunate(new Set(kadroviRef.current.keys()));
    pogon.osvjezi(satoviZaRadnike(novi), zaKadar);
    const gledani =
      novi.kadrovi.find((k) => k.pomak === pomakRef.current)?.sat ?? zaKadar[0];
    pogon.trazi(gledani);
  }, []);

  // Izmjereni vjetar stiže naknadno i zamjenjuje modelski gdje ga ima.
  useEffect(() => {
    let otkazano = false;
    void (async () => {
      // Scenarij je zatvoren prizor: izmjereni vjetar bi ga pretvorio u
      // mješavinu izmišljenog i stvarnog, a to nije ni jedno ni drugo.
      if (scenarijRef.current) return;
      try {
        const odgovor = await fetch("/api/karepovac/vjetar");
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
        postaviCrtu((stara) => {
          const nova = primijeniVjetar(
            stara,
            new Map(podatci.satovi!.map((v) => [v.sat, v])),
          );
          preracunajPromijenjene(stara, nova);
          return nova;
        });
      } catch {
        // Izmjereni vjetar je poboljšanje, ne uvjet: bez njega satovi ostaju
        // na modelu i uz njih to i piše.
      } finally {
        // I kad padne: pokušali smo, pa postaja bez brojke doista šuti.
        if (!otkazano) postaviVjetarStigao(true);
      }
    })();
    return () => {
      otkazano = true;
    };
  }, [preracunajPromijenjene]);

  /**
   * Tvar o kojoj kartica govori: sumporovodik dok je vidljiv, inače
   * merkaptani. Sažetak govori o jednoj tvari, jer dvije razine u jednoj
   * rečenici nitko ne pročita u pet sekundi.
   */
  const tvarKartice: Tvar = stanje.prikaz.tvari.sumporovodik.vidljiv || !stanje.prikaz.tvari.merkaptani.vidljiv
    ? "sumporovodik"
    : "merkaptani";
  const jacinaKartice = stanje.prikaz.tvari[tvarKartice].jacina;
  const ljestvicaKartice = bojaZa(stanje.prikaz.tvari[tvarKartice].boja, tvarKartice).ljestvica;

  /** Razina nad naseljima po satu, za traku i za susjede u sažetku. */
  const razinePoSatu = useMemo(() => {
    const izlaz = new Map<string, Razina>();
    for (const k of crta.kadrovi) {
      if (k.dostupnost === "nedostupno") continue;
      const slika = kadroviRef.current.get(k.sat);
      if (!slika) continue;
      const bajtovi = tvarKartice === "merkaptani" ? slika.bajtoviMerkaptana : slika.bajtovi;
      izlaz.set(
        k.sat,
        ukupnaRazina(
          ocijeniPodrucja(
            { bajtovi, sirina: slika.sirina, visina: slika.visina },
            SIM_POLJE.granice,
            tvarKartice,
            jacinaKartice,
          ),
        ),
      );
    }
    return izlaz;
    // `izracunati` je okidač: slike žive u `ref`, a skup se mijenja kad stignu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crta, izracunati, tvarKartice, jacinaKartice]);

  const situacija = useMemo<Situacija | null>(() => {
    if (!kadar) return null;
    const slika = kadroviRef.current.get(kadar.sat);
    const susjed = (k: (typeof crta.kadrovi)[number]): SusjedniSat => ({
      sat: k.sat,
      pomak: k.pomak,
      dostupnost: k.dostupnost,
      razina: razinePoSatu.get(k.sat) ?? null,
    });
    const prije = crta.kadrovi
      .filter((k) => k.pomak < kadar.pomak)
      .sort((a, b) => b.pomak - a.pomak)
      .map(susjed);
    const poslije = crta.kadrovi.filter((k) => k.pomak > kadar.pomak).map(susjed);
    return izvediSituaciju({
      kadar,
      slika: slika
        ? {
            bajtovi: tvarKartice === "merkaptani" ? slika.bajtoviMerkaptana : slika.bajtovi,
            sirina: slika.sirina,
            visina: slika.visina,
          }
        : null,
      granice: SIM_POLJE.granice,
      tvar: tvarKartice,
      jacina: jacinaKartice,
      prije,
      poslije,
    });
  }, [kadar, crta, razinePoSatu, tvarKartice, jacinaKartice]);

  /** Razina u odabranoj točki po satu, za njezinu traku i za trend. */
  const razineTocke = useMemo(() => {
    const izlaz = new Map<string, Razina>();
    if (!tocka) return izlaz;
    for (const k of crta.kadrovi) {
      if (k.dostupnost === "nedostupno") continue;
      const slika = kadroviRef.current.get(k.sat);
      if (!slika) continue;
      const bajtovi = tvarKartice === "merkaptani" ? slika.bajtoviMerkaptana : slika.bajtovi;
      izlaz.set(
        k.sat,
        razinaUTocki({ bajtovi, sirina: slika.sirina, visina: slika.visina }, SIM_POLJE.granice, tvarKartice, jacinaKartice, tocka),
      );
    }
    return izlaz;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crta, izracunati, tvarKartice, jacinaKartice, tocka]);

  const situacijaTocke = useMemo<Situacija | null>(() => {
    if (!kadar || !tocka) return null;
    const slika = kadroviRef.current.get(kadar.sat);
    const susjed = (k: (typeof crta.kadrovi)[number]): SusjedniSat => ({
      sat: k.sat,
      pomak: k.pomak,
      dostupnost: k.dostupnost,
      razina: razineTocke.get(k.sat) ?? null,
    });
    return izvediTocku(
      {
        kadar,
        slika: slika
          ? {
              bajtovi: tvarKartice === "merkaptani" ? slika.bajtoviMerkaptana : slika.bajtovi,
              sirina: slika.sirina,
              visina: slika.visina,
            }
          : null,
        granice: SIM_POLJE.granice,
        tvar: tvarKartice,
        jacina: jacinaKartice,
        prije: crta.kadrovi.filter((k) => k.pomak < kadar.pomak).sort((a, b) => b.pomak - a.pomak).map(susjed),
        poslije: crta.kadrovi.filter((k) => k.pomak > kadar.pomak).map(susjed),
      },
      tocka,
    );
  }, [kadar, crta, razineTocke, tvarKartice, jacinaKartice, tocka]);

  // Odabrana točka → oznaka na karti i `t` u adresi.
  useEffect(() => {
    const karta = kartaRef.current;
    const Marker = markerKlasaRef.current;
    tockaMarkerRef.current?.remove();
    tockaMarkerRef.current = null;
    if (karta && Marker && tocka) {
      tockaMarkerRef.current = new Marker({ color: "#18181b", scale: 0.8 })
        .setLngLat([tocka.lng, tocka.lat])
        .addTo(karta);
    }
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (tocka) p.set("t", `${tocka.lat.toFixed(4)},${tocka.lng.toFixed(4)}`);
      else p.delete("t");
      window.history.replaceState(null, "", `?${p.toString()}`);
    }
  }, [tocka, stanjeKarte]);

  useEffect(() => {
    prijedloziRef.current?.istakni(prijedlog?.id ?? null);
  }, [prijedlog, stanjeKarte]);

  // Odabrani sat → gustoća i polje vjetra u sceni.
  const prikazanoRef = useRef<{ sat: string; slika: unknown } | null>(null);
  useEffect(() => {
    const scena = scenaRef.current;
    const osnove = osnoveRef.current;
    if (!scena || !kadar) return;
    const slika = kadroviRef.current.get(kadar.sat) ?? null;
    // Ista slika istog sata ne treba ponovno u karticu; bez ovoga bi svaki
    // novi izračunati sat pokrenuo pretapanje slike u samu sebe.
    if (prikazanoRef.current?.sat !== kadar.sat || prikazanoRef.current.slika !== slika) {
      prikazanoRef.current = { sat: kadar.sat, slika };
      const prijelaz = stanje.prikaz.mirovanje || snimka ? 0 : PRIJELAZ_MS;
      scena.postaviNesigurnost(nesigurnostKadra(kadar));
      if (slika) {
        scena.postaviGustocu(slika.bajtovi, slika.bajtoviMerkaptana, slika.sirina, slika.visina, prijelaz);
      } else {
        // Sat koji još nije izračunat ne smije nositi tuđu perjanicu.
        scena.postaviGustocu(PRAZNO, PRAZNO, 1, 1, prijelaz);
      }
    }
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
  }, [kadar, izracunati, scenaSpremna, stanje.prikaz.mirovanje, snimka]);

  // Odabrani sat → brojke na pribadačama.
  useEffect(() => {
    oznakeRef.current?.postavi(kadar, sadaOcitanja, serije, crta.kadrovi, vjetarStigao);
  }, [kadar, sadaOcitanja, serije, crta, vjetarStigao, stanjeKarte]);

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
    scenaRef.current?.postaviPodlogu(stanje.podloga);
    // Ulična podloga je vektorski stil i ne gasi se: ortofoto je prekrije.
    // `PODLOGE.karta` postoji samo u rezervnom rasteru.
    vidljivost(PODLOGE.karta, stanje.podloga === "karta");
    vidljivost(PODLOGE.ortofoto, stanje.podloga === "ortofoto");
    vidljivost("reljef", stanje.reljef);
    vidljivost("postaje-krug", stanje.postaje);
    oznakeRef.current?.vidljivost(stanje.postaje);
    prijedloziRef.current?.vidljivost(stanje.prijedlozi);
    // Zgrade stižu tek na zahtjev; do tada sloja nema pa se nema što skrivati.
    if (stanje.zgrade) dodajZgrade(karta);
    vidljivost("zgrade", stanje.zgrade);
  }, [stanje, stanjeKarte]);

  // Adresa pamti odabrani slučaj, da se dade podijeliti.
  useEffect(() => {
    uAdresu(stanje, pomak);
    pomakRef.current = pomak;
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
    <div
      className="fixed inset-0 overflow-hidden bg-zinc-100"
      // Stroju koji snima: koliko je sati gotovo i koji se gleda.
      data-izracunato={`${napredak.gotovo}/${napredak.ukupno}`}
      data-sat={kadar?.sat ?? ""}
      data-spreman={spreman ? "1" : "0"}
    >
      {/* Visina se zadaje izravno, a ne kroz `inset-0`: MapLibre spremniku
          postavi `position: relative`, pa se gornji i donji rub prestanu
          držati roditelja i visina padne na nulu. Karta tada postoji, prima
          kontrole i ne javlja grešku — samo ne traži nijednu pločicu. */}
      <div ref={spremnik} className="h-full w-full" />

      {/* Gore: kartica situacije lijevo, gumbi desno. Na uskom zaslonu
          kartica uzima cijelu širinu, gumbi ostaju u kutu iznad nje. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-2 sm:p-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:max-w-[26rem]">
          {situacija && kadar ? (
            <SituacijaKartica
              situacija={situacija}
              kadar={kadar}
              izracunat={spreman}
              ljestvica={ljestvicaKartice}
              naVise={() => postaviPlocu((v) => !v)}
              plocaOtvorena={plocaOtvorena}
            />
          ) : null}
          {prijedlog ? (
            <PrijedlogKartica prijedlog={prijedlog} naZatvori={() => postaviPrijedlog(null)} />
          ) : null}
          {tocka && situacijaTocke && kadar ? (
            <TockaKartica
              tocka={tocka}
              situacija={situacijaTocke}
              kadar={kadar}
              izracunat={spreman}
              ljestvica={ljestvicaKartice}
              poSatu={crta.kadrovi.map((k) => ({
                sat: k.sat,
                pomak: k.pomak,
                vrsta: k.vrsta,
                razina: razineTocke.get(k.sat) ?? null,
              }))}
              naZatvori={() => postaviTocku(null)}
              naSat={(p) => postaviPomak(p)}
            />
          ) : null}
          {napredak.greska || napredak.gotovo < napredak.ukupno ? (
            <span className="pointer-events-auto rounded bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-white">
              {napredak.greska ?? `Računam ${napredak.gotovo}/${napredak.ukupno} sati`}
            </span>
          ) : null}
        </div>

        {/* Gore desno: izlaz i otvaranje ploče. Ništa više — navigacija
            stranice je na ovoj karti sakrivena (vidi BEZ_OKVIRA u site-chrome). */}
        <div className="pointer-events-auto z-30 flex shrink-0 items-center gap-1.5">
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
      </div>

      {/* Ploča se otvara na zahtjev: sa strane na širokom zaslonu, kao list
          odozdo na uskom — da karta ostane vidljiva. */}
      {plocaOtvorena ? (
        <div className="absolute inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-black/5 bg-white/95 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:bottom-24 sm:right-3 sm:top-16 sm:max-h-none sm:w-[19rem] sm:rounded-xl sm:border sm:shadow-lg">
          <div className="flex items-center justify-between px-4 pt-3 sm:hidden">
            <h2 className="text-sm font-bold text-zinc-900">Napredno</h2>
            <button
              type="button"
              onClick={() => postaviPlocu(false)}
              className="fokus rounded px-2 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              Zatvori
            </button>
          </div>
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 sm:p-3">
        <div className="mx-auto max-w-3xl">
          <VremenskaCrta
            crta={crta}
            pomak={pomak}
            izracunati={izracunati}
            razine={razinePoSatu}
            ljestvica={ljestvicaKartice}
            reproducira={reproducira}
            mirovanje={stanje.prikaz.mirovanje}
            naReprodukciju={postaviReprodukciju}
            naPromjenu={naPomak}
          />
        </div>
      </div>
    </div>
  );
}
