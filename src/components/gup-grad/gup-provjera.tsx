"use client";

/**
 * Karta provjere na /gup (prikaz „Karta”, gup-karta.tsx): kako je
 * infografika razvrstala svaku katastarsku česticu.
 *
 * Dva sloja, oba izvedena skriptom scripts/gup-grad/cestice.py:
 *  - slika namjene po godini (naše razvrstavanje lista, u bojama legende
 *    plana) — da se usporedi sa službenim ISPU listom i ortofotom;
 *  - čestice s mjerenjima po komadima, u pločicama od 1 km, koje se
 *    dohvaćaju samo za okno i tek od zuma MIN_ZUM (cijeli grad je ~41 000
 *    čestica).
 *
 * Sud o čestici računa src/lib/gup-grad/provjera.ts istim funkcijama i
 * pravilima kao /gup, pa karta ne može reći drugo nego infografika.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { GODINE, KLASE, type Godina } from "@/lib/gup-grad/model";
import { INACICE, type VrstaKoristenja } from "@/lib/gup-grad/pravila";
import { VRSTA_ZA_KLASU, type NajmanjaCestica, type VrstaOdredbe } from "@/lib/gup-grad/odredbe";
import type { UvjetiKomada } from "@/lib/gup-grad/izracun";
import { NAJDULJA_NAPOMENA, VRSTE_ISPRAVKA } from "@/lib/gup-grad/ispravci";
import { predloziIspravak } from "@/lib/actions/gup";
import { MIN_ZUM_REGIJA, regijeVrijede } from "@/components/gup-grad/gup-regije";
import { sudCestice, type Sklad, type SudCestice, type SvojstvaCestice } from "@/lib/gup-grad/provjera";

const MIN_ZUM = 15;
/** Zgrade su gušće od čestica (~60 000 tlocrta), pa tek od zuma 16. */
const MIN_ZUM_ZGRADA = 16;

/**
 * Što boja karte pokazuje. Tri osi čestice — namjena, iskorištenost, sklad
 * s planom — svaka ima svoj kanal: nijansu, jačinu ispune i crvene pruge.
 * „Sve” ih slaže jednu preko druge; ostali načini pokazuju samo jednu os,
 * vlastitom jasnom paletom.
 */
export type BojaKarte = "sve" | "namjena" | "iskoristenost" | "sklad";
export const BOJE_KARTE: { id: BojaKarte; naziv: string; opis: string }[] = [
  { id: "sve", naziv: "Sve tri", opis: "Nijansa je namjena, jačina ispune iskorištenost, crvene pruge protivno planu." },
  { id: "namjena", naziv: "Namjena", opis: "Samo zona plana u koju čestica pada, kao na listu plana." },
  { id: "iskoristenost", naziv: "Iskorištenost", opis: "Samo koliko je čestice slobodno: što jače plavo, to više slobodnog, bez obzira na namjenu." },
  { id: "sklad", naziv: "Sklad s planom", opis: "Samo je li ono što stoji dopušteno u toj zoni. Neiskorištene čestice nemaju suda." },
];

export interface GupPostavke {
  godina: Godina;
  prikaz: BojaKarte;
  inacica: string;
  slika: boolean;
  cestice: boolean;
  zgrade: boolean;
  /** Dijelovi čestice: gdje je unutar nje zauzeto, a gdje slobodno (gup-regije.ts). */
  dijelovi: boolean;
}

export const POCETNE_GUP_POSTAVKE: GupPostavke = {
  godina: 2025,
  prikaz: "sve",
  inacica: INACICE[0].id,
  slika: true,
  cestice: true,
  zgrade: true,
  dijelovi: true,
};

const CRVENA = "#d03b3b";
/** Boja čestice koja je ulica (namjena „Ulice i infrastruktura”). */
const ULICA = "#a1a1aa";

/** Os 3 — pruge preko boje namjene; gušće = veći dio iskorištenog je protivan. */
const PRUGE: Partial<Record<Sklad, { razmak: number; debljina: number }>> = {
  djelomicno: { razmak: 13, debljina: 1.6 },
  protivno: { razmak: 8, debljina: 2.6 },
};

/** Os 3 kad se gleda sama: statusne boje. */
export const SKLAD: Record<Sklad, { naziv: string; boja: string }> = {
  "po-planu": { naziv: "po planu", boja: "#16a34a" },
  djelomicno: { naziv: "dijelom protivno planu", boja: "#f59e0b" },
  protivno: { naziv: "protivno planu", boja: "#dc2626" },
  nema: { naziv: "neiskorištena — nema što suditi", boja: "#f4f4f5" },
};

/**
 * Os 2 — iskorištenost je broj (0–100 %) i karta ga boji kontinuirano.
 * Razredi su samo za brojke u legendi.
 */
export const RAZREDI_ISKORISTENOSTI = [
  { do: 0.05, naziv: "0–5 %" },
  { do: 0.5, naziv: "5–50 %" },
  { do: 0.95, naziv: "50–95 %" },
  { do: Infinity, naziv: "95–100 %" },
];
const razred = (u: number) => RAZREDI_ISKORISTENOSTI.findIndex((r) => u < r.do);

/** Jačina ispune za iskorištenost u načinu „Sve tri”: prazna čestica je gotovo prozirna. */
const ispunaIskoristenosti = (u: number) => 0.1 + 0.78 * u;

/** Os 2 sama: od sive (sve iskorišteno) do plave (sve slobodno). */
const SIVA = [228, 228, 231];
const PLAVA = [2, 132, 199];
export function bojaSlobodnog(udioSlobodnog: number): string {
  const t = Math.max(0, Math.min(1, udioSlobodnog));
  const c = SIVA.map((a, i) => Math.round(a + (PLAVA[i] - a) * t));
  return `rgb(${c.join(",")})`;
}

/** Brojke u legendi: čestice u oknu po svakoj osi — svaka se os zbraja na `n`. */
export interface BrojUOknu {
  n: number;
  /** Čestice koje su (gotovo) cijele ulica izuzeta iz zone — nisu ni slobodne ni iskorištene. */
  ulice: number;
  namjena: Partial<Record<string, number>>;
  iskoristenost: number[];
  nijeZaGradnju: number;
  sklad: Record<Sklad, number>;
}

/**
 * Šrafura kao ispuna platna: Leafletov Canvas samo prepiše `fillColor` u
 * `ctx.fillStyle`, a fillStyle smije biti i CanvasPattern. Uzorak (boja
 * namjene + crvene pruge „/”) pravi se jednom po boji i gustoći.
 */
const uzorci = new Map<string, CanvasPattern>();
function srafura(boja: string, pruge: { razmak: number; debljina: number }): CanvasPattern | string {
  if (typeof document === "undefined") return boja;
  const kljuc = `${boja}|${pruge.razmak}`;
  const gotov = uzorci.get(kljuc);
  if (gotov) return gotov;
  const n = pruge.razmak;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d");
  if (!x) return boja;
  x.fillStyle = boja;
  x.fillRect(0, 0, n, n);
  x.strokeStyle = CRVENA;
  x.lineWidth = pruge.debljina;
  x.beginPath();
  // glavna dijagonala i dva ugla, da se pločice uzorka spoje bez šava
  for (const [x0, y0, x1, y1] of [
    [0, n, n, 0],
    [-n / 2, n / 2, n / 2, -n / 2],
    [n / 2, n * 1.5, n * 1.5, n / 2],
  ]) {
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
  }
  x.stroke();
  const u = x.createPattern(c, "repeat");
  if (!u) return boja;
  uzorci.set(kljuc, u);
  return u;
}

/** Ista šrafura u CSS-u, za legendu i skočni prozor. */
function srafuraCss(boja: string, pruge?: { razmak: number; debljina: number }): string {
  if (!pruge) return boja;
  const d = Math.max(1.5, pruge.debljina * 0.8);
  const r = Math.max(4, pruge.razmak * 0.55);
  return `repeating-linear-gradient(135deg, ${CRVENA} 0 ${d}px, ${boja} ${d}px ${r}px)`;
}

const VRSTE: Record<VrstaKoristenja, string> = {
  stambena: "stambena zgrada",
  gospodarska: "gospodarska/poslovna zgrada",
  javna: "javna zgrada",
  pomocna: "pomoćna zgrada",
  ostala: "ostala građevina",
  neevidentirana: "zgrada koje nema u katastru",
  promet: "cesta/nogostup",
  parkiraliste: "parkiralište",
  uredjeno: "groblje/igralište/šport/trg",
  zelenilo: "park/održavano zelenilo",
  gradiliste: "gradilište",
  okucnica: "okućnica (dvorište zgrade)",
};

const NOVA_STAMBENA: Record<string, string> = {
  da: "nova stambena gradnja dopuštena",
  interpolacija: "nova stambena gradnja samo kao interpolacija",
  upu: "nova stambena gradnja kroz propisani UPU/DPU",
  rekonstrukcija: "samo rekonstrukcija postojećih — nema nove stambene gradnje",
  ne: "nema stambene gradnje",
  gp: "gradski projekt (kvota GBP-a)",
};

const RUCNO: Record<string, string> = {
  parkiraliste: "parkiralište",
  javna: "javna ustanova",
  uredjeno: "igralište/šport/trg",
  zelenilo: "park/zelenilo",
  gradiliste: "gradilište",
  izgradjeno: "izgrađeno (zgrade nema u podacima)",
  promet: "cesta/put",
  infrastruktura: "infrastruktura",
  neizgradivo: "neizgradivo (stijena, strmina)",
  slobodno: "doista neizgrađeno",
};

const SKUPINA_ZGRADE = ["", "stambena", "gospodarska", "javna", "pomoćna", "ostala"];

const TIP_GRADNJE: Record<string, string> = {
  slobodnostojeca: "slobodnostojeća",
  dvojna: "dvojna",
  interpolacija: "interpolacija između dvije izgrađene čestice",
  opcenito: "bez navedene vrste građevine",
  niz: "građevine u nizu",
};

interface Plocica {
  id: string;
  n: number;
  granice: [[number, number], [number, number]];
}

export interface GupInfo {
  zum: number;
  stanje: "ucitava" | "greska" | null;
  /** Broj učitanih čestica u oknu po osima (ili null ispod MIN_ZUM). */
  uOknu: BrojUOknu | null;
}

type CesticaFeature = Feature<Geometry, SvojstvaCestice>;

/** Najmanja građevna čestica iz odredbi po kodu urbanog pravila i vrsti. */
type Ppmin = Record<string, Partial<Record<VrstaOdredbe, NajmanjaCestica>>>;

/** Što odredbe dopuštaju graditi po kodu urbanog pravila (stambene i mješovite zone). */
type Gradnja = Record<
  string,
  { novaGradnja: boolean; kig: number | null; kis?: number | null; nova_stambena: string; izvor: string; citat: string }
>;

interface Ostaci {
  /** čestica → klase njezinih komada koji su premali ostatak */
  poCestici: Map<number, Set<number>>;
  /** čestica → klasa → [okućnica susjedne zgrade, od toga protivno], u pikselima */
  posudjeno: Map<number, Map<number, [number, number]>>;
  ppmin: Ppmin;
  gradnja: Gradnja;
}
const PRAZNO: Ostaci = { poCestici: new Map(), posudjeno: new Map(), ppmin: {}, gradnja: {} };

/** Odredbe o gradnji za komad klase u području urbanog pravila — kao podaci.ts na poslužitelju. */
function uvjetiKomada(o: Ostaci, kodPravila: string | undefined, klasa: (typeof KLASE)[number]): UvjetiKomada {
  const vrsta = VRSTA_ZA_KLASU[klasa.kod];
  const najmanja = vrsta && kodPravila ? o.ppmin[kodPravila]?.[vrsta] : undefined;
  const g = vrsta === "stanovanje" && kodPravila ? o.gradnja[kodPravila] : undefined;
  return {
    najmanjaPx: (najmanja?.m2 ?? 0) / 4,
    kig: g?.kig ?? null,
    kis: g?.kis ?? null,
    novaGradnja: g?.novaGradnja ?? true,
    pikselM2: 4,
  };
}

/**
 * Ostaci i najmanje čestice po načinu brojanja i godini, iz
 * /api/gup-ostaci (statično, isti izracun.ts kao /gup). Jednom po ključu.
 */
const ostaciPoKljucu = new Map<string, Promise<Ostaci>>();
function ucitajOstatke(inacica: string, godina: number): Promise<Ostaci> {
  const kljuc = `${inacica}-${godina}`;
  let p = ostaciPoKljucu.get(kljuc);
  if (!p) {
    p = fetch(`/api/gup-ostaci/${kljuc}`)
      .then((r) => (r.ok ? r.json() : { ostaci: [], ppmin: {}, gradnja: {} }))
      .then((d: { ostaci: [number, number][]; posudjeno?: [number, number, number, number][]; ppmin: Ppmin; gradnja?: Gradnja }) => {
        const m = new Map<number, Set<number>>();
        for (const [c, k] of d.ostaci) {
          if (!m.has(c)) m.set(c, new Set());
          m.get(c)!.add(k);
        }
        const posudjeno = new Map<number, Map<number, [number, number]>>();
        for (const [c, k, px, protivno] of d.posudjeno ?? []) {
          if (!posudjeno.has(c)) posudjeno.set(c, new Map());
          posudjeno.get(c)!.set(k, [px, protivno]);
        }
        return { poCestici: m, posudjeno, ppmin: d.ppmin ?? {}, gradnja: d.gradnja ?? {} };
      })
      .catch(() => {
        ostaciPoKljucu.delete(kljuc);
        return PRAZNO;
      });
    ostaciPoKljucu.set(kljuc, p);
  }
  return p;
}
const NEMA = new Set<number>();

/** Zgrada u public/geo/gup-grad/zgrade/*.json: izvor k = katastar, m = 3D model. */
interface SvojstvaZgrade {
  s: "k" | "m";
  /** skupina katastarske zgrade, kao `g` u komadima */
  g?: number;
  /** šifra VRSTA iz katastra */
  v?: number;
}

/**
 * Dohvaćač pločica jednog sloja: indeks se čita jednom, pločica jednom, a
 * ona koja nije stigla smije se tražiti ponovno.
 */
function plocnik<P>(indeksUrl: string, mapa: string, dodaj: (fc: FeatureCollection<Geometry, P>) => void) {
  let indeks: Plocica[] | null = null;
  const ucitane = new Set<string>();
  return async (L: typeof LeafletNS, okno: LeafletNS.LatLngBounds, prije: () => void) => {
    indeks ??= ((await (await fetch(indeksUrl)).json()) as { plocice: Plocica[] }).plocice;
    const trebaju = indeks.filter((p) => !ucitane.has(p.id) && okno.intersects(L.latLngBounds(p.granice)));
    if (trebaju.length) prije();
    await Promise.all(
      trebaju.map(async (p) => {
        ucitane.add(p.id);
        const r = await fetch(`${mapa}/${p.id}.json`);
        if (!r.ok) {
          ucitane.delete(p.id);
          throw new Error(`pločica ${p.id}: ${r.status}`);
        }
        dodaj((await r.json()) as FeatureCollection<Geometry, P>);
      }),
    );
  };
}

/**
 * Zgrade preko čestica: tlocrt 3D modela kao tamna ploha (ono što stoji na
 * tlu), katastarska zgrada kao bijeli obrub (ono što je upisano). Gdje se
 * poklapaju, vidi se tamna ploha s bijelim rubom; upisana zgrada koje nema
 * ostaje prazan bijeli obris, a neupisana tamna ploha bez obrisa.
 */
function stilZgrade(z: SvojstvaZgrade): LeafletNS.PathOptions {
  return z.s === "m"
    ? { stroke: false, fillColor: "#18181b", fillOpacity: 0.55 }
    : { color: "#ffffff", weight: 1.6, opacity: 0.95, fill: false };
}

export function useGupProvjera(opts: {
  mapRef: { current: LeafletNS.Map | null };
  LRef: { current: typeof LeafletNS | null };
  /** Karta je stvorena (refovi su puni). */
  spremno: boolean;
  aktivno: boolean;
  postavke: GupPostavke;
  pogodakSloja: { current: number };
}): GupInfo {
  const { mapRef, LRef, spremno, aktivno, postavke, pogodakSloja } = opts;
  const [info, setInfo] = useState<GupInfo>({ zum: 0, stanje: null, uOknu: null });
  const postavkeRef = useRef(postavke);
  const slojRef = useRef<LeafletNS.GeoJSON | null>(null);
  const slikaRef = useRef<LeafletNS.ImageOverlay | null>(null);
  const slikeRef = useRef<{ granice: [[number, number], [number, number]]; slike: { godina: number; url: string }[] } | null>(null);
  const osvjeziRef = useRef<() => void>(() => {});
  const prozirnostRef = useRef<() => void>(() => {});
  const ostaciRef = useRef<Ostaci>(PRAZNO);

  // Sloj čestica i njegovi rukovatelji žive dok je pogled aktivan.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno) return;
    let ziv = true;
    const pravila = () => INACICE.find((i) => i.id === postavkeRef.current.inacica)?.pravila ?? INACICE[0].pravila;
    const sud = (p: SvojstvaCestice) => {
      const g = postavkeRef.current.godina;
      const o = ostaciRef.current;
      return sudCestice(
        p,
        g,
        pravila(),
        4,
        o.poCestici.get(p.i) ?? NEMA,
        (kl) => uvjetiKomada(o, p.u?.[`${g}`], kl),
        o.posudjeno.get(p.i),
      );
    };

    // Platno dolazi od karte (preferCanvas) — 5 000+ čestica u oknu kao SVG
    // bi zagušilo DOM.
    const sloj = L.geoJSON(undefined, {
      style: (f) => stil(sud((f as CesticaFeature).properties), postavkeRef.current),
      onEachFeature: (f, lyr) => {
        lyr.on("click", (e: LeafletNS.LeafletMouseEvent) => {
          pogodakSloja.current = Date.now();
          const p = (f as CesticaFeature).properties;
          const s = postavkeRef.current;
          L.popup({ maxWidth: 340, className: "gup-provjera-popup" })
            .setLatLng(e.latlng)
            .setContent(popup(p, sud(p), s, ostaciRef.current))
            .openOn(map);
        });
      },
    });
    slojRef.current = sloj;

    // Zgrade u vlastitom oknu i na vlastitom platnu, iznad čestica bez
    // obzira na to koja pločica prva stigne, i bez klika — klik ide čestici
    // ispod, koja zna reći što je izmjereno.
    if (!map.getPane("gup-zgrade")) {
      const okno = map.createPane("gup-zgrade");
      okno.style.zIndex = "420";
      okno.style.pointerEvents = "none";
    }
    const zgrade = L.geoJSON(undefined, {
      renderer: L.canvas({ pane: "gup-zgrade" }),
      interactive: false,
      style: (f) => stilZgrade((f as Feature<Geometry, SvojstvaZgrade>).properties),
    } as LeafletNS.GeoJSONOptions);
    const ucitajCestice = plocnik<SvojstvaCestice>("/geo/gup-grad/cestice-indeks.json", "/geo/gup-grad/cestice", (fc) => {
      if (ziv) sloj.addData(fc);
    });
    const ucitajZgrade = plocnik<SvojstvaZgrade>("/geo/gup-grad/zgrade-indeks.json", "/geo/gup-grad/zgrade", (fc) => {
      if (ziv) zgrade.addData(fc);
    });

    // Slika namjene je za pogled izdaleka i za usporedbu s listom. Ispod
    // obojenih čestica u načinu „iskorištenost” miješala bi boje plana sa
    // statusnim bojama, pa se ondje skriva; uz „namjenu” ostaje blijeda.
    const prozirnostSlike = (cesticeVidljive: boolean) => {
      const prikaz = postavkeRef.current.prikaz;
      slikaRef.current?.setOpacity(!cesticeVidljive ? 0.55 : prikaz === "namjena" ? 0.25 : 0);
    };
    prozirnostRef.current = () => prozirnostSlike(map.getZoom() >= MIN_ZUM && postavkeRef.current.cestice);

    const prebroji = () => {
      if (map.getZoom() < MIN_ZUM || !postavkeRef.current.cestice) {
        setInfo((i) => ({ ...i, zum: map.getZoom(), uOknu: null }));
        return;
      }
      const okno = map.getBounds();
      const n: BrojUOknu = {
        n: 0,
        ulice: 0,
        namjena: {},
        iskoristenost: RAZREDI_ISKORISTENOSTI.map(() => 0),
        nijeZaGradnju: 0,
        sklad: { "po-planu": 0, djelomicno: 0, protivno: 0, nema: 0 },
      };
      sloj.eachLayer((l) => {
        const pl = l as LeafletNS.Polygon & { feature?: CesticaFeature };
        if (!pl.feature || !okno.intersects(pl.getBounds())) return;
        const s = sud(pl.feature.properties);
        if (!s.pretezita && !s.jeUlica) return;
        n.n++;
        const kod = s.jeUlica ? "P" : s.pretezita!.kod;
        n.namjena[kod] = (n.namjena[kod] ?? 0) + 1;
        if (s.jeUlica) {
          n.ulice++; // ulica nije ni slobodna ni iskorištena zona
          return;
        }
        if (s.iskoristenost !== null) n.iskoristenost[razred(s.iskoristenost)]++;
        if (s.slobodnoNijeZaGradnju) n.nijeZaGradnju++;
        n.sklad[s.sklad]++;
      });
      setInfo((i) => ({ ...i, zum: map.getZoom(), uOknu: n }));
    };

    const ucitaj = async () => {
      const zum = map.getZoom();
      const vidljivo = zum >= MIN_ZUM && postavkeRef.current.cestice;
      const vidljiveZgrade = zum >= MIN_ZUM_ZGRADA && postavkeRef.current.zgrade;
      prozirnostSlike(vidljivo);
      if (vidljivo && !map.hasLayer(sloj)) sloj.addTo(map);
      if (!vidljivo && map.hasLayer(sloj)) sloj.remove();
      if (vidljiveZgrade && !map.hasLayer(zgrade)) zgrade.addTo(map);
      if (!vidljiveZgrade && map.hasLayer(zgrade)) zgrade.remove();
      const okno = map.getBounds().pad(0.2);
      const ucitava = () => setInfo((i) => ({ ...i, stanje: "ucitava" }));
      try {
        await Promise.all([
          vidljivo ? ucitajCestice(L, okno, ucitava) : null,
          vidljiveZgrade ? ucitajZgrade(L, okno, ucitava) : null,
        ]);
        if (ziv) setInfo((i) => ({ ...i, stanje: null }));
      } catch {
        if (ziv) setInfo((i) => ({ ...i, stanje: "greska" }));
      }
      if (ziv) prebroji();
    };

    osvjeziRef.current = () => {
      sloj.setStyle((f) => stil(sud((f as CesticaFeature).properties), postavkeRef.current));
      void ucitaj();
    };
    // Prijedlog ispravka iz skočnog prozora (obrazacIspravka)
    const naOtvaranje = (e: LeafletNS.PopupEvent) => {
      const f = e.popup.getElement()?.querySelector<HTMLFormElement>("form[data-ispravak]");
      if (!f) return;
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const poruka = f.querySelector<HTMLElement>("[data-poruka]")!;
        const gumb = f.querySelector<HTMLButtonElement>("button[type=submit]")!;
        const fd = new FormData(f);
        const ll = e.popup.getLatLng();
        if (ll) {
          fd.set("lat", String(ll.lat));
          fd.set("lng", String(ll.lng));
        }
        gumb.disabled = true;
        poruka.style.color = "#52525c";
        poruka.textContent = "Šaljem…";
        try {
          const r = await predloziIspravak(fd);
          poruka.style.color = r.ok ? "#047857" : "#b91c1c";
          poruka.textContent = r.ok ? "Hvala! Prijedlog je zapisan i čeka pregled." : r.error;
          if (r.ok) f.querySelectorAll("select, textarea").forEach((x) => ((x as HTMLInputElement).disabled = true));
          else gumb.disabled = false;
        } catch {
          poruka.style.color = "#b91c1c";
          poruka.textContent = "Slanje nije uspjelo. Provjerite vezu i pokušajte ponovno.";
          gumb.disabled = false;
        }
      });
    };
    map.on("popupopen", naOtvaranje);
    map.on("moveend", ucitaj);
    void ucitaj();
    return () => {
      ziv = false;
      map.off("popupopen", naOtvaranje);
      map.off("moveend", ucitaj);
      map.closePopup();
      sloj.remove();
      zgrade.remove();
      slojRef.current = null;
      osvjeziRef.current = () => {};
      prozirnostRef.current = () => {};
    };
  }, [mapRef, LRef, spremno, aktivno, pogodakSloja]);

  // Slika našeg razvrstavanja lista za odabranu godinu.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno || !postavke.slika) return;
    let ziv = true;
    void (async () => {
      try {
        slikeRef.current ??= await (await fetch("/geo/gup-grad/namjena-slike.json")).json();
        const meta = slikeRef.current!;
        const s = meta.slike.find((x) => x.godina === postavke.godina);
        if (!ziv || !s) return;
        const sl = L.imageOverlay(s.url, meta.granice, { opacity: 0.55, interactive: false });
        sl.addTo(map);
        sl.bringToBack();
        slikaRef.current = sl;
        prozirnostRef.current();
      } catch {
        if (ziv) setInfo((i) => ({ ...i, stanje: "greska" }));
      }
    })();
    return () => {
      ziv = false;
      slikaRef.current?.remove();
      slikaRef.current = null;
    };
  }, [mapRef, LRef, spremno, aktivno, postavke.slika, postavke.godina]);

  // Promjena godine, prikaza ili načina brojanja samo prebojava.
  useEffect(() => {
    postavkeRef.current = postavke;
    // Ostaci ovise o načinu brojanja i godini; stari se ne smiju zadržati
    // pod novom godinom, pa se do dolaska novih crta bez njih.
    let aktualno = true;
    ostaciRef.current = PRAZNO;
    void ucitajOstatke(postavke.inacica, postavke.godina).then((m) => {
      if (!aktualno) return;
      ostaciRef.current = m;
      osvjeziRef.current();
    });
    osvjeziRef.current();
    return () => {
      aktualno = false;
    };
  }, [postavke]);

  return info;
}

/**
 * Kako se čestica crta u pojedinom načinu „Boja karte”. Svaka os ima jedan
 * kanal i nijedan kanal ne nosi dvije osi:
 *  - namjena: nijansa (boja zone iz legende plana; ulica siva);
 *  - iskorištenost: jačina ispune, kontinuirano po udjelu; isprekidan rub
 *    kad slobodni dio nije za gradnju;
 *  - sklad s planom: crvene kose pruge preko iskorištene čestice.
 */
function stil(s: SudCestice, p: GupPostavke): LeafletNS.PathOptions {
  const nista = { stroke: false, fill: false };
  if (!s.pretezita && !s.jeUlica) return nista;
  // dijelovi čestice boje ono unutar nje; čestica ostaje obris (i klik)
  if (regijeVrijede(p)) {
    return { color: "#18181b", weight: 0.7, opacity: 0.75, fillColor: "#ffffff", fillOpacity: 0 };
  }
  const vise = s.komadi.length > 1;
  const rub = { color: "#18181b", weight: 0.5, opacity: 0.8 };
  const crtkano = { color: "#3f3f46", weight: 1, dashArray: "4 3", opacity: 0.9 };
  const boja = s.jeUlica ? ULICA : s.pretezita!.bojaPlana;
  const u = s.iskoristenost ?? 0;
  switch (p.prikaz) {
    case "namjena":
      return {
        ...rub,
        weight: vise ? 1.2 : 0.5,
        dashArray: vise ? "4 3" : undefined,
        fillColor: boja,
        fillOpacity: 0.6,
      };
    case "iskoristenost":
      if (s.jeUlica) return { ...rub, weight: 0.3, fillColor: ULICA, fillOpacity: 0.5 };
      if (s.slobodnoNijeZaGradnju && u < 0.95) return { ...crtkano, fillColor: "#ffffff", fillOpacity: 0.85 };
      return { ...rub, weight: 0.4, fillColor: bojaSlobodnog(1 - u), fillOpacity: 0.9 };
    case "sklad":
      if (s.jeUlica) return { ...rub, weight: 0.3, fillColor: ULICA, fillOpacity: 0.5 };
      return { ...rub, weight: 0.4, fillColor: SKLAD[s.sklad].boja, fillOpacity: s.sklad === "nema" ? 0.45 : 0.85 };
    default: {
      const pruge = PRUGE[s.sklad];
      return {
        ...(s.slobodnoNijeZaGradnju && u < 0.95 ? crtkano : rub),
        // CanvasPattern kroz polje koje tipovi Leafleta opisuju kao niz znakova
        fillColor: (pruge ? srafura(boja, pruge) : boja) as unknown as string,
        fillOpacity: s.jeUlica ? 0.5 : pruge ? Math.max(0.6, ispunaIskoristenosti(u)) : ispunaIskoristenosti(u),
      };
    }
  }
}

function esc(v: unknown): string {
  return String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

const m2 = (v: number) => `${Math.round(v).toLocaleString("hr-HR")} m²`;

function popup(p: SvojstvaCestice, s: SudCestice, post: GupPostavke, o: Ostaci): string {
  const ppmin = o.ppmin;
  const inacica = INACICE.find((i) => i.id === post.inacica) ?? INACICE[0];
  const kodPravila = p.u?.[`${post.godina}`];
  const sivo = "color:#71717b";
  let h =
    `<b>k.č. ${esc(p.kc)}, k.o. ${esc(p.ko)}</b><br>` +
    `<span style="${sivo}">${m2(p.a)} u katastru · GUP ${post.godina}. · brojanje: ${esc(inacica.naziv)}</span>`;
  if (!s.komadi.length) {
    return h + `<br><span style="${sivo}">U ovoj godini plana čestica nije u obuhvatu GUP-a (ili je ispod krhotine od 5 %).</span>`;
  }
  h += sazetak(s) + `<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:600;color:#3f3f46">Pojedinosti računa</summary>`;
  h +=
    `<span style="${sivo}">iskorišteno ${m2(s.iskoristeno)} od ${m2(s.m2)} u zoni` +
    (s.uSuprotnosti > 0 ? `, protivno planu ${m2(s.uSuprotnosti)}` : "") +
    (s.ulica > 0 ? `; ulica izuzeta iz zone ${m2(s.ulica)}` : "") +
    (s.ostatak > 0 ? `; premali ili preuski ostatak ${m2(s.ostatak)}` : "") +
    (s.nijeZaGradnju > 0 ? `; slobodno, ali nije za gradnju ${m2(s.nijeZaGradnju)}` : "") +
    `</span>` +
    (kodPravila
      ? `<br><span style="${sivo}">područje urbanog pravila <b>${esc(kodPravila)}</b> (list „Urbana pravila” ${post.godina}.)` +
        (o.gradnja[kodPravila]
          ? `: ${esc(NOVA_STAMBENA[o.gradnja[kodPravila].nova_stambena] ?? o.gradnja[kodPravila].nova_stambena)}` +
            (o.gradnja[kodPravila].kig ? `, kig do ${String(o.gradnja[kodPravila].kig).replace(".", ",")}` : "") +
            (o.gradnja[kodPravila].kis ? `, kis do ${String(o.gradnja[kodPravila].kis).replace(".", ",")}` : "") +
            ` — ${esc(o.gradnja[kodPravila].izvor)}`
          : "") +
        `</span>`
      : "") +
    (p.r ? `<br><span style="${sivo}">ručni pregled ortofotom: <b>${esc(RUCNO[p.r] ?? p.r)}</b></span>` : "");
  for (const k of s.komadi) {
    h +=
      `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #e4e4e7">` +
      `<span style="display:inline-block;width:10px;height:10px;border:1px solid #52525c;background:${k.klasa.bojaPlana};margin-right:4px"></span>` +
      `<b>${esc(k.klasa.kod)}</b> ${esc(k.klasa.naziv)} — ${m2(k.m2)}` +
      (k.ulica > 0
        ? ` <span style="${sivo}">(+ ${m2(k.ulica)} ulice, izuzeto iz zone${k.m2 === 0 ? " — cijeli komad je ulica" : ""})</span>`
        : "") +
      `<br><span style="${sivo}">izmjereno: zgrada u katastru ${m2(k.mjereno.zk)}` +
      (k.g ? ` (${SKUPINA_ZGRADE[k.g]})` : "") +
      `, zgrada u 3D modelu ${m2(k.mjereno.z25)}, promet ${m2(k.mjereno.pr)}` +
      (k.mjereno.pa ? `, parkiralište ${m2(k.mjereno.pa)}` : "") +
      (k.mjereno.jv ? `, javna ustanova ${m2(k.mjereno.jv)}` : "") +
      (k.mjereno.os ? `, groblje/igralište/trg ${m2(k.mjereno.os)}` : "") +
      (k.mjereno.inf ? `, infrastruktura ${m2(k.mjereno.inf)}` : "") +
      (k.mjereno.ze ? `, zelenilo ${m2(k.mjereno.ze)}` : "") +
      (k.mjereno.gr ? `, gradilište ${m2(k.mjereno.gr)}` : "") +
      `</span>`;
    const racun = k.pokriveno.filter(([, v]) => v > 0);
    const okucnica = k.procjena.poVrsti.okucnica ?? 0;
    if (okucnica > 0) racun.push(["okucnica", okucnica]);
    if (racun.length) {
      h +=
        `<br>u računu: ` +
        racun
          .map(([v, x]) => {
            const protiv = k.protivneVrste.includes(v);
            return `<span style="${protiv ? "color:#b91c1c;font-weight:600" : ""}">${esc(VRSTE[v])} ${m2(x)}${protiv ? " ✗" : ""}</span>`;
          })
          .join(", ");
      h += `<br><span style="${sivo}">iskorišteno ${m2(k.procjena.iskoristeno)} · u skladu ${m2(k.procjena.uSkladu)} · protivno ${m2(k.procjena.uSuprotnosti)}</span>`;
    }
    const vrsta = VRSTA_ZA_KLASU[k.klasa.kod];
    const najmanja = vrsta && kodPravila ? ppmin[kodPravila]?.[vrsta] : undefined;
    if (najmanja) {
      h +=
        `<br><span style="${sivo}">najmanja građevna čestica prema odredbama: <b>${m2(najmanja.m2)}</b> ` +
        `(${esc(TIP_GRADNJE[najmanja.tip] ?? najmanja.tip)}) — ${esc(najmanja.izvor)}</span>`;
    }
    if (k.vrtSusjeda > 0) {
      h +=
        `<br><span style="color:#52525c">${m2(k.vrtSusjeda)} je okućnica zgrade na susjednoj čestici: njoj na vlastitoj ` +
        `nedostaje zemljišta koje traže odredbe, a ova čestica sama nije nova građevna čestica.</span>`;
    }
    if (k.usko > 0) {
      h +=
        `<br><span style="color:#52525c">slobodnih ${m2(k.usko)} je uski pojas (put, stube, rub uz među) — ` +
        `uži od ~9 m, a odredbe traže česticu široku barem 10 m; ne broji se kao slobodno.</span>`;
    }
    if (k.ostatak - k.usko > 0) {
      h +=
        `<br><span style="color:#52525c">slobodnih ${m2(k.ostatak - k.usko)} je premali ostatak: manje od ${najmanja ? m2(najmanja.m2) : "najmanje čestice"}, ` +
        `a nema slobodnog susjeda iste namjene s kojim bi to doseglo — ne broji se kao slobodno.</span>`;
    }
    if (k.nijeZaGradnju > 0) {
      h +=
        `<br><span style="color:#52525c">slobodnih ${m2(k.nijeZaGradnju)} nije za gradnju: ` +
        (p.r === "neizgradivo" ? "ručni pregled — teren se ne može graditi." : "odredbe u ovom području ne dopuštaju novu gradnju te namjene.") +
        `</span>`;
    }
    h += `</div>`;
  }
  h +=
    `<div style="margin-top:8px;${sivo}">Površine komada izmjerene su na rešetki od 2 m, pa se zbroj može razlikovati od katastarske. ` +
    `<a href="/gup?prikaz=grafikon#kako-je-izracunato" style="color:#047857">Kako se broji ↗</a></div></details>`;
  return h + obrazacIspravka(p, s, post);
}

const posto = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Tri osi čestice u tri retka, na vrhu skočnog prozora: namjena,
 * iskorištenost (broj i traka, slobodno po razlogu) i sklad s planom.
 */
function sazetak(s: SudCestice): string {
  const sivo = "color:#71717b";
  const red = (os: string, sadrzaj: string) =>
    `<div style="display:grid;grid-template-columns:92px 1fr;gap:8px;margin-top:6px"><span style="${sivo}">${os}</span><span>${sadrzaj}</span></div>`;
  const kvadrat = (bg: string, crtkano = false) =>
    `<span style="display:inline-block;width:11px;height:11px;border-radius:2px;border:1px ${crtkano ? "dashed" : "solid"} #52525c;background:${bg};margin-right:5px;vertical-align:-1px"></span>`;

  // 1 · namjena: pretežita zona, ostale zone čestice i ulica
  const drugi = s.komadi.filter((k) => k.klasa !== s.pretezita);
  const namjena = s.jeUlica
    ? `${kvadrat(ULICA)}<b>ulica</b> <span style="${sivo}">(${m2(s.ulica)}, izuzeto iz zone)</span>`
    : `${kvadrat(s.pretezita!.bojaPlana)}<b>${esc(s.pretezita!.kod)}</b> ${esc(s.pretezita!.kratko)}` +
      (drugi.length ? `<br><span style="${sivo}">i ${drugi.map((k) => `${m2(k.m2)} u ${esc(k.klasa.kod)}`).join(", ")}</span>` : "") +
      (s.ulica > 0 ? `<br><span style="${sivo}">+ ${m2(s.ulica)} ulice, izuzeto iz zone</span>` : "");
  if (s.jeUlica) return `<div style="margin-top:4px">${red("Namjena", namjena)}</div>`;

  // 2 · iskorištenost: broj, traka i slobodno po razlogu
  const u = s.iskoristenost ?? 0;
  const sl = s.slobodno;
  const nije = [
    [sl.usko, "preusko"],
    [sl.premalo, "premalo"],
    [sl.zabranjeno, "odredbe ne dopuštaju"],
    [sl.neizgradivo, "neizgradiv teren"],
  ].filter(([v]) => (v as number) >= 1) as [number, string][];
  const iskoristenost =
    `<b>${posto(u)}</b> <span style="${sivo}">(${m2(s.iskoristeno)} od ${m2(s.m2)})</span>` +
    `<div style="height:6px;border-radius:3px;background:${bojaSlobodnog(1)};overflow:hidden;margin-top:3px"><i style="display:block;height:100%;width:${Math.round(u * 100)}%;background:#71717a"></i></div>` +
    (sl.zaGradnju >= 1 ? `<span>slobodno za gradnju <b>${m2(sl.zaGradnju)}</b></span>` : "") +
    (nije.length
      ? `${sl.zaGradnju >= 1 ? "<br>" : ""}<span style="${sivo}">slobodno, ali nije za gradnju: ${nije.map(([v, n]) => `${n} ${m2(v)}`).join(", ")}</span>`
      : "");

  // 3 · sklad s planom
  const protivne = [...new Set(s.komadi.flatMap((k) => k.protivneVrste))];
  const pruge = PRUGE[s.sklad];
  const sklad =
    s.sklad === "nema"
      ? `<span style="${sivo}">nema što suditi — čestica nije iskorištena</span>`
      : `${pruge ? kvadrat(srafuraCss("#ffffff", pruge)) : ""}<b>${SKLAD[s.sklad].naziv}</b>` +
        (s.sklad !== "po-planu"
          ? ` <span style="${sivo}">(${m2(s.uSuprotnosti)} protivno: ${protivne.map((v) => esc(VRSTE[v])).join(", ")})</span>`
          : "");

  return (
    `<div style="margin-top:4px">` +
    red("Namjena", namjena) +
    red("Iskorišteno", iskoristenost) +
    red("Sklad s planom", sklad) +
    `</div>`
  );
}

/**
 * Prijedlog ispravka: posjetitelj kaže što na čestici stvarno jest. Obrazac
 * je HTML u skočnom prozoru Leafleta; slanje hvata `popupopen` u
 * GupProvjera i zove poslužiteljsku akciju predloziIspravak.
 */
function obrazacIspravka(p: SvojstvaCestice, s: SudCestice, post: GupPostavke): string {
  const skriveno = (ime: string, v: unknown) => `<input type="hidden" name="${ime}" value="${esc(v ?? "")}">`;
  const polje = "width:100%;margin-top:4px;border:1px solid #d4d4d8;border-radius:6px;padding:4px 6px;font-size:12px";
  return (
    `<details style="margin-top:8px;border-top:1px solid #e4e4e7;padding-top:6px">` +
    `<summary style="cursor:pointer;font-weight:600;color:#047857">Krivo svrstano? Predloži ispravak</summary>` +
    `<form data-ispravak style="margin-top:6px">` +
    skriveno("ko", p.ko) +
    skriveno("kc", p.kc) +
    skriveno("godina", post.godina) +
    skriveno("stanje", `${s.jeUlica ? "ulica" : posto(s.iskoristenost ?? 0)}, ${s.sklad}`) +
    skriveno("namjena", s.pretezita?.kod) +
    `<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">` +
    `<label style="display:block;font-size:12px">Što je na čestici stvarno?` +
    `<select name="vrsta" required style="${polje}"><option value="">— odaberi —</option>` +
    Object.entries(VRSTE_ISPRAVKA)
      .map(([v, naziv]) => `<option value="${v}">${esc(naziv)}</option>`)
      .join("") +
    `</select></label>` +
    `<label style="display:block;font-size:12px;margin-top:6px">Napomena (neobavezno)` +
    `<textarea name="napomena" rows="2" maxlength="${NAJDULJA_NAPOMENA}" style="${polje}" placeholder="npr. parkiralište trgovine iza zgrade"></textarea></label>` +
    `<button type="submit" style="margin-top:6px;border-radius:9999px;background:#047857;color:#fff;font-weight:600;font-size:12px;padding:4px 12px">Pošalji prijedlog</button>` +
    `<p data-poruka role="status" style="margin-top:4px;font-size:12px"></p>` +
    `<p style="margin-top:2px;font-size:11px;color:#71717a">Prijedlozi se pregledaju prije nego uđu u izračun.</p>` +
    `</form></details>`
  );
}

const naslov = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const gumb = (aktivan: boolean) =>
  `fokus meta-cip rounded-full border px-2.5 py-1 text-xs font-semibold ${
    aktivan ? "border-maslina bg-maslina text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
  }`;

/**
 * Postavke karte (lijeva ploča na /gup): godina plana, boja čestice, način
 * brojanja i slojevi. `children` dolaze na vrh — podloga, koju zna karta.
 */
export function GupProvjeraPostavke(props: {
  postavke: GupPostavke;
  onPostavke: (p: GupPostavke) => void;
  children?: ReactNode;
}) {
  const { postavke: p, onPostavke } = props;
  const postavi = (d: Partial<GupPostavke>) => onPostavke({ ...p, ...d });
  const inacica = INACICE.find((i) => i.id === p.inacica) ?? INACICE[0];
  return (
    <div className="space-y-4 text-sm">
      {props.children}
      <div>
        <p className={naslov}>Plan iz</p>
        <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Godina plana">
          {GODINE.map((g) => (
            <button key={g} type="button" aria-pressed={p.godina === g} onClick={() => postavi({ godina: g })} className={gumb(p.godina === g)}>
              {g}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={naslov}>Boja karte</p>
        <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-lg border border-zinc-300" role="group" aria-label="Boja karte">
          {BOJE_KARTE.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={p.prikaz === b.id}
              onClick={() => postavi({ prikaz: b.id })}
              className={`fokus px-2 py-1.5 text-xs font-semibold ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""} border-zinc-300 ${
                p.prikaz === b.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {b.naziv}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-500">{BOJE_KARTE.find((b) => b.id === p.prikaz)?.opis}</p>
      </div>
      {p.prikaz !== "namjena" && (
        <div>
          <p className={naslov}>Kako se broji iskorišteno</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Kako se broji">
            {INACICE.map((i) => (
              <button key={i.id} type="button" aria-pressed={p.inacica === i.id} onClick={() => postavi({ inacica: i.id })} className={gumb(p.inacica === i.id)}>
                {i.naziv}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{inacica.opis}</p>
        </div>
      )}
      <div className="space-y-1">
        <p className={naslov}>Slojevi</p>
        <label className="meta flex items-center gap-2">
          <input type="checkbox" checked={p.cestice} onChange={(e) => postavi({ cestice: e.target.checked })} />
          Čestice (od zuma {MIN_ZUM})
        </label>
        <label className="meta flex items-center gap-2">
          <input type="checkbox" checked={p.zgrade} onChange={(e) => postavi({ zgrade: e.target.checked })} />
          Zgrade (od zuma {MIN_ZUM_ZGRADA})
        </label>
        <label className="meta flex items-center gap-2">
          <input type="checkbox" checked={p.dijelovi} onChange={(e) => postavi({ dijelovi: e.target.checked })} />
          Dijelovi čestice — gdje je zauzeto, a gdje slobodno (od zuma {MIN_ZUM_REGIJA})
        </label>
        {p.dijelovi && p.inacica !== INACICE[0].id && (
          <p className="ml-6 text-xs text-zinc-500">Samo uz „{INACICE[0].naziv}”; ovdje se boji cijela čestica.</p>
        )}
        <label className="meta flex items-center gap-2">
          <input type="checkbox" checked={p.slika} onChange={(e) => postavi({ slika: e.target.checked })} />
          Naše razvrstavanje lista plana (boje legende)
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Klik na česticu pokazuje komade po namjeni, što je izmjereno i kako je presuđeno; ondje se može i predložiti
        ispravak.
      </p>
    </div>
  );
}

/** Jedan redak legende: uzorak, naziv i broj čestica u oknu. */
function RedLegende(props: { uzorak: React.CSSProperties; naziv: ReactNode; broj?: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="inline-block size-4 shrink-0 rounded-sm border border-zinc-600" style={props.uzorak} aria-hidden />
      <span className="flex-1">{props.naziv}</span>
      {props.broj !== undefined && <span className="tabular-nums text-zinc-500">{props.broj.toLocaleString("hr-HR")}</span>}
    </li>
  );
}

/**
 * Legenda karte (desna ploča na /gup): po jedan blok za svaku os koju boja
 * karte trenutačno pokazuje. Brojke su čestice u oknu; svaki blok se zbraja
 * na isti broj čestica.
 */
export function GupProvjeraLegenda(props: { postavke: GupPostavke; info: GupInfo }) {
  const { postavke: p, info } = props;
  const b = info.uOknu;
  const [sveNamjene, setSveNamjene] = useState(false);
  const sve = p.prikaz === "sve";
  // P („Ulice i infrastruktura”) broji i ulice izuzete iz drugih zona, pa je uvijek zadnja
  const namjene = [...KLASE.filter((k) => k.kod !== "P"), ...KLASE.filter((k) => k.kod === "P")].filter(
    (k) => sveNamjene || !b || (b.namjena[k.kod] ?? 0) > 0,
  );
  const skrivenih = KLASE.length - namjene.length;
  const bezUlica = b && b.ulice > 0 ? ` ${b.ulice.toLocaleString("hr-HR")} ulica izuzetih iz zona ovdje se ne broji.` : "";
  const osNaslov = (broj: number, naziv: string, kanal: string) => (
    <p className={`${naslov} flex justify-between`}>
      <span>
        {sve ? `${broj} · ` : ""}
        {naziv}
      </span>
      <span className="font-normal normal-case tracking-normal">{kanal}</span>
    </p>
  );
  return (
    <div className="space-y-4 text-sm">
      {info.zum > 0 && info.zum < MIN_ZUM && p.cestice && (
        <p className="rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">Približi kartu (zum {MIN_ZUM}+) da se učitaju čestice.</p>
      )}
      {info.stanje === "ucitava" && <p className="text-xs text-zinc-500">Učitavam čestice…</p>}
      {info.stanje === "greska" && <p className="text-xs text-rose-700">Dio podataka se nije učitao; pomakni kartu za novi pokušaj.</p>}
      {b && <p className="text-xs text-zinc-500">U oknu {b.n.toLocaleString("hr-HR")} čestica; brojke uz retke su čestice u oknu.</p>}

      {(sve || p.prikaz === "namjena") && (
        <div>
          {osNaslov(1, "Namjena", "nijansa")}
          <ul className="mt-1 space-y-1">
            {namjene.map((k) => (
              <RedLegende
                key={k.kod}
                uzorak={{ background: k.kod === "P" ? ULICA : k.bojaPlana }}
                naziv={
                  <>
                    {k.kratko} <span className="font-mono text-xs text-zinc-500">{k.kod}</span>
                    {k.kod === "P" && <span className="block text-xs text-zinc-500">i ulice izuzete iz drugih zona</span>}
                  </>
                }
                broj={b?.namjena[k.kod]}
              />
            ))}
          </ul>
          {b && (skrivenih > 0 || sveNamjene) && (
            <button type="button" onClick={() => setSveNamjene((v) => !v)} className="fokus mt-1 text-xs font-semibold text-maslina underline">
              {sveNamjene ? "Samo namjene u oknu" : `+ još ${skrivenih} namjena kojih nema u oknu`}
            </button>
          )}
          {p.prikaz === "namjena" && <p className="mt-1 text-xs text-zinc-500">Iscrtkan rub: čestica je u više namjena; boja je pretežita.</p>}
        </div>
      )}

      {(sve || p.prikaz === "iskoristenost") && (
        <div>
          {osNaslov(2, "Iskorištenost", sve ? "jačina ispune" : "boja")}
          <div
            className="mt-1 h-3 rounded-sm border border-zinc-400"
            style={{
              background: sve
                ? `linear-gradient(90deg, rgba(24,24,27,${ispunaIskoristenosti(0) * 0.8}), rgba(24,24,27,${ispunaIskoristenosti(1) * 0.8}))`
                : `linear-gradient(90deg, ${bojaSlobodnog(1)}, ${bojaSlobodnog(0)})`,
            }}
            aria-hidden
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>0 % iskorišteno</span>
            <span>100 %</span>
          </div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {RAZREDI_ISKORISTENOSTI.map((r, i) => (
              <li key={r.naziv} className="flex justify-between">
                <span>{r.naziv}</span>
                {b && <span className="tabular-nums text-zinc-500">{b.iskoristenost[i].toLocaleString("hr-HR")}</span>}
              </li>
            ))}
          </ul>
          <ul className="mt-2 space-y-1">
            <RedLegende uzorak={{ background: "#fff", borderStyle: "dashed" }} naziv="slobodno, ali nije za gradnju (preusko, premalo, odredbe, teren)" broj={b?.nijeZaGradnju} />
          </ul>
          <p className="mt-1 text-xs text-zinc-500">
            Iskorišteno uključuje i okućnicu — zemljište koje zgrada treba po odredbama — pa 100 % znači „nema mjesta za novu česticu”.
            {sve ? " Na karti u boji namjene čestice." : " Ulice su sive."}
            {bezUlica}
          </p>
        </div>
      )}

      {(sve || p.prikaz === "sklad") && (
        <div>
          {osNaslov(3, "Sklad s planom", sve ? "pruge" : "boja")}
          <ul className="mt-1 space-y-1">
            {(["po-planu", "djelomicno", "protivno", "nema"] as Sklad[])
              .filter((k) => !(sve && k === "nema"))
              .map((k) => (
                <RedLegende
                  key={k}
                  uzorak={{ background: sve ? srafuraCss("#ffffff", PRUGE[k]) : SKLAD[k].boja }}
                  naziv={sve && k === "po-planu" ? "po planu (bez pruga)" : SKLAD[k].naziv}
                  broj={b?.sklad[k]}
                />
              ))}
          </ul>
          <p className="mt-1 text-xs text-zinc-500">
            Sudi se samo iskorišteni dio čestice{sve && b ? `; ${b.sklad.nema.toLocaleString("hr-HR")} neiskorištenih nema suda` : ""}.
            {bezUlica}
          </p>
        </div>
      )}

      {regijeVrijede(p) && info.zum >= MIN_ZUM_REGIJA && <LegendaDijelova prikaz={p.prikaz} />}

      {p.zgrade && (
        <div>
          <p className={naslov}>Zgrade</p>
          <ul className="mt-1 space-y-1 text-xs text-zinc-600">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-4 shrink-0 rounded-[1px]" style={{ background: "rgba(24,24,27,0.55)" }} aria-hidden />
              tlocrt iz gradskog 3D modela (što stoji)
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-4 shrink-0 rounded-[1px] border-2 border-white bg-zinc-400" aria-hidden />
              zgrada upisana u katastar (bijeli obris)
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

const TOCKICE = "radial-gradient(circle, #3f3f46 1.2px, transparent 1.3px) 0 0 / 5px 5px, #ffffff";

/**
 * Ključ dijelova čestice (gup-regije.ts) za trenutačni način: što znači
 * boja UNUTAR obrisa čestice. Brojke u blokovima iznad ostaju po česticama.
 */
function LegendaDijelova({ prikaz }: { prikaz: BojaKarte }) {
  const redovi: [React.CSSProperties, string][] =
    prikaz === "iskoristenost"
      ? [
          [{ background: "rgba(82,82,91,.7)" }, "zgrada"],
          [{ background: "rgba(161,161,170,.65)" }, "parkiralište, ulica, park, igralište…"],
          [{ background: "rgba(212,212,216,.7)" }, "okućnica — zemljište koje zgrada treba"],
          [{ background: "rgba(2,132,199,.8)" }, "slobodno za gradnju"],
          [{ background: TOCKICE }, "slobodno, ali nije za gradnju"],
        ]
      : prikaz === "sklad"
        ? [
            [{ background: "rgba(22,163,74,.75)" }, "zauzeto po planu (okućnica svjetlije)"],
            [{ background: "rgba(220,38,38,.75)" }, "zauzeto protivno planu"],
            [{ background: "#ffffff" }, "slobodno — nema što suditi"],
          ]
        : [
            [{ background: "rgba(224,160,0,.85)" }, "zauzeto (zgrada, parkiralište, park…)"],
            [{ background: "rgba(224,160,0,.5)" }, "okućnica — zemljište koje zgrada treba"],
            [{ background: "rgba(224,160,0,.14)" }, "slobodno za gradnju"],
            [{ background: TOCKICE }, "slobodno, ali nije za gradnju"],
            [{ background: srafuraCss("#ffffff", PRUGE.protivno) }, "zauzeto protivno planu"],
          ];
  return (
    <div>
      <p className={naslov}>Dijelovi čestice</p>
      <ul className="mt-1 space-y-1">
        {redovi.map(([uzorak, naziv]) => (
          <RedLegende key={naziv} uzorak={uzorak} naziv={naziv} />
        ))}
      </ul>
      <p className="mt-1 text-xs text-zinc-500">
        Gdje je unutar čestice što, na rešetki od 2 m.{prikaz === "sve" ? " Uzorci su u boji mješovite namjene." : ""} Okućnica se
        crta na zemljištu najbližem zgradi — to je prikaz, ne međa građevne čestice.
      </p>
    </div>
  );
}
