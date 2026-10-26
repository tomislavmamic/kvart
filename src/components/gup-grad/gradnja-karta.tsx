"use client";

/**
 * Karta na /gup/gradnja: svaki piksel od ~2 m u obuhvatu GUP-a obojen
 * razlogom zbog kojeg se ondje po novom GUP-u ne može graditi ništa novo ili
 * ništa stambeno (src/lib/gup-grad/gradnja.ts), iz pločica
 * public/geo/gup-grad/gradnja (gradnja-plocice.ts). Pločice nose brojeve,
 * pa ih preglednik boji sam, u <canvas> po pločici, i prebojava kad se sloj
 * ugasi ili se odabere „Što priječi gradnju”.
 *
 * Uz to granica GUP-a (iscrtkano), obrisi stambenih i mješovitih zona
 * (scripts/gup-grad/gradnja-zone.py) — gdje je plan uopće predvidio
 * stanovanje — i obris čestice pod zadnjim klikom. Slojevi nisu
 * interaktivni: klik bilo gdje ide karti, a što je ondje kaže GradnjaPrikaz.
 * Podloga je siva, da se boje čitaju. Učitava se bez SSR-a.
 *
 * Upravljanje je kao na Google kartama: kotačić, povlačenje, dvoklik i
 * tipkovnica; zum dolje desno, mjerilo dolje lijevo. Dijelovi zaslona pod
 * tražilicom i karticom (`zaklon`) ne broje se kao vidljivi: odabrana
 * čestica pomakne se u ostatak, a gumbi karte izmaknu se kartici.
 */
import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection } from "geojson";

import { SIRI_OBUHVAT_KARTE } from "@/lib/map-views";
import {
  ALFA_PREPREKE,
  BOJA_PREPREKE,
  KATEGORIJA_PO_ID,
  KATEGORIJA_PO_KODU,
  kodNaKarti,
  PREPREKA_PO_ID,
  razlozi,
  zonaKlase,
  type IdKategorije,
  type IdPrepreke,
} from "@/lib/gup-grad/gradnja";
import type { Geometrija, Okvir } from "@/lib/gup-grad/zabrana";
import { PODLOGE, podloga, type CiljKarte } from "@/components/gup-grad/zabrana-karta";
import { procitaj, ucitajIndeks, type PlocicaGradnje } from "@/components/gup-grad/gradnja-plocice";
import type { PodaciDozvola } from "@/lib/gup-grad/gradnja-dozvole";

/** Ispod ovog zuma piksel rešetke manji je od piksela zaslona: slika se gladi (globals.css). */
export const ZUM_OSTRIH_PIKSELA = 15;
/**
 * Obris stambenih i mješovitih zona: tanka tamna crta, ne zelena — zelena je
 * odgovor „stambeno moguće”, a 244 obrisa preko grada čitala bi se kao on.
 */
export const BOJA_STAMBENE_ZONE = "#27272a";
/** Izdaleka bi obrisi blokova prekrili boje; vide se tek od ovog zuma. */
export const OBRISI_OD_ZUMA = 15;
/** Ostali slojevi uz odabranu zapreku: vide se, ali ne natječu se s njom. */
const ALFA_UZ_PREPREKU = 0.4;
/** Mrlja zemljišta za gradnju uža od ovoga na zaslonu (px) dobije točku, da se izdaleka ne izgubi. */
const MRLJA_VIDLJIVA_PX = 7;
/** Od ovog zuma vide se međe unutar skupine čestica jednog akta. */
const DOZVOLE_OBRISI_OD_ZUMA = 16;
/** Tinta dozvola: tamna, jer zelena, plava, jantarna i ljubičasta već nešto znače. */
export const BOJA_DOZVOLE = "#18181b";

/** Više učitanih pločica od ovoga: one daleko od pogleda se otpuste (mobitel ima malo memorije). */
const NAJVISE_PLOCICA = 48;

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** RGBA u jednom broju, kako ga Uint32Array vidi na little-endian strojevima (svi današnji preglednici). */
const rgba = ([r, g, b]: [number, number, number], a: number) => ((Math.round(a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
const BOJA_ISTAKNUTOG = rgba(hex(BOJA_PREPREKE), ALFA_PREPREKE * 255);
/** Po indeksu klase (kanal R): 1 gdje namjena dopušta stanovanje. */
const STAMBENE_KLASE = Uint8Array.from({ length: 256 }, (_, i) => (zonaKlase(i) === "stambena" ? 1 : 0));

/**
 * Uzorci (kose pruge, mreža, točke) ne crtaju se u pikselima pločice (~1,8 m), koji su izbliza veliki i
 * nazubljeni, nego ih preglednik iscrta CSS maskom u pikselima zaslona (globals.css, .gup-uzorak-N): pločica
 * ima platno pune boje i po jedno platno boje pruge za svaku vrstu uzorka, koje maska pretvori u pruge. Maska
 * je pomaknuta za položaj pločice u sloju (maskaNaMjestu), pa se pruge nastavljaju preko šavova pločica, a
 * razmak im je na zaslonu isti na svakom zumu.
 */
export const VRSTE_UZORKA = [1, 2, 3] as const;
export type VrstaUzorka = (typeof VRSTE_UZORKA)[number];

/** Što je na karti vidljivo i istaknuto. */
export interface Prikaz {
  skrivene: ReadonlySet<IdKategorije>;
  prepreka: IdPrepreke | null;
}

/**
 * Boje po bajtu kategorije (kanal B, razlog i vlasnik): puna boja, boja pruge i
 * vrsta pruge (0 nema, 1 kose, 2 mreža, 3 točke), te je li razlog istaknuta zapreka.
 * Računa se jednom po prikazu, pa je bojenje piksela samo čitanje iz tablice.
 */
interface Paleta {
  boja: Uint32Array;
  pruga: Uint32Array;
  vrsta: Uint8Array;
  istaknuto: Uint8Array;
}

const palete = new WeakMap<Prikaz, Paleta>();
function paletaZa(prikaz: Prikaz): Paleta {
  let p = palete.get(prikaz);
  if (p) return p;
  const istaknute = prikaz.prepreka ? new Set(PREPREKA_PO_ID[prikaz.prepreka].kategorije.map((id) => KATEGORIJA_PO_ID[id].kod)) : null;
  const blijedi = istaknute ? ALFA_UZ_PREPREKU : 1;
  p = { boja: new Uint32Array(256), pruga: new Uint32Array(256), vrsta: new Uint8Array(256), istaknuto: new Uint8Array(256) };
  for (let bajt = 0; bajt < 256; bajt++) {
    // javno zemljište boji se kao javno, a kad je ta stavka ugašena, nestane s karte: razlog
    // ispod njega nije prošao provjere širine i odmaka (javno se ne spaja u gradilište), pa
    // bi se ondje pokazale tanke „zelene” trake uz ceste. Isto i slobodno pod planom na snazi.
    const { kategorija, vlasnik } = razlozi(bajt);
    const kod = kodNaKarti(kategorija, vlasnik);
    if (istaknute?.has(kod)) p.istaknuto[bajt] = 1;
    const k = KATEGORIJA_PO_KODU.get(kod);
    if (!k || prikaz.skrivene.has(k.id)) continue;
    p.boja[bajt] = rgba(hex(k.boja), k.alfa * 255 * blijedi);
    if (k.pruge) {
      p.pruga[bajt] = rgba(hex(k.pruge), (k.prugeAlfa ?? 0.9) * 255 * blijedi);
      p.vrsta[bajt] = k.tocke ? 3 : k.mreza ? 2 : 1;
    }
  }
  palete.set(prikaz, p);
  return p;
}

/**
 * Oboji pločicu: puna boja u `platna[0]`, boja pruge za uzorak vrste N u `platna[N]` (na pikselima koji ga imaju).
 * Vraća vrste uzoraka koje na pločici postoje.
 */
function obojaj(platna: HTMLCanvasElement[], kodovi: ImageData, prikaz: Prikaz): Set<VrstaUzorka> {
  const { width: w, height: h, data: d } = kodovi;
  const { boja, pruga, vrsta, istaknuto } = paletaZa(prikaz);
  const ulaz = new Uint32Array(d.buffer, d.byteOffset, w * h);
  const puna = new ImageData(w, h);
  const izlaz = new Uint32Array(puna.data.buffer);
  const uzorci: (Uint32Array | null)[] = [null, null, null, null];
  const slike: (ImageData | null)[] = [null, null, null, null];
  for (let i = 0; i < w * h; i++) {
    const v = ulaz[i];
    if (v >>> 24 !== 255) continue;
    const bajt = (v >>> 16) & 255;
    if (istaknuto[bajt] && STAMBENE_KLASE[v & 255]) {
      izlaz[i] = BOJA_ISTAKNUTOG;
      continue;
    }
    izlaz[i] = boja[bajt];
    const vr = vrsta[bajt];
    if (vr === 0) continue;
    if (!uzorci[vr]) {
      slike[vr] = new ImageData(w, h);
      uzorci[vr] = new Uint32Array(slike[vr]!.data.buffer);
    }
    uzorci[vr]![i] = pruga[bajt];
  }
  const ima = new Set<VrstaUzorka>();
  for (let n = 0; n < 4; n++) {
    const platno = platna[n];
    if (!platno) continue;
    if (platno.width !== w) platno.width = w;
    if (platno.height !== h) platno.height = h;
    const ctx = platno.getContext("2d")!;
    if (n === 0) ctx.putImageData(puna, 0, 0);
    else if (slike[n]) ctx.putImageData(slike[n]!, 0, 0);
    else ctx.clearRect(0, 0, w, h);
  }
  for (const vr of VRSTE_UZORKA) if (slike[vr]) ima.add(vr);
  return ima;
}

interface Ucitana {
  granice: LeafletNS.LatLngBounds;
  /** [puna boja, kose pruge, mreža, točke]; platno uzorka postoji samo ako je ikad trebalo */
  platna: (HTMLCanvasElement | null)[];
  slojevi: (LeafletNS.SVGOverlay | null)[];
}

/** Maska uzorka počinje u ishodištu sloja, ne u kutu pločice: pruge se nastavljaju preko šavova. */
function maskaNaMjestu(map: LeafletNS.Map, u: Ucitana) {
  const nw = map.latLngToLayerPoint(u.granice.getNorthWest()).round();
  for (let n = 1; n < 4; n++) {
    const el = u.platna[n];
    if (!el) continue;
    el.style.maskPosition = `${-nw.x}px ${-nw.y}px`;
    el.style.setProperty("-webkit-mask-position", `${-nw.x}px ${-nw.y}px`);
  }
}

/** Pločica s karte: platno pune boje i, po potrebi, platna uzoraka iznad njega. */
function dodajPlocicu(L: typeof LeafletNS, map: LeafletNS.Map, granice: LeafletNS.LatLngBounds, kodovi: ImageData, prikaz: Prikaz): Ucitana {
  const u: Ucitana = { granice, platna: [document.createElement("canvas"), null, null, null], slojevi: [null, null, null, null] };
  osvjeziPlocicu(L, map, u, kodovi, prikaz);
  return u;
}

/** Prebojaj pločicu i dodaj platna uzoraka koja su postala potrebna. */
function osvjeziPlocicu(L: typeof LeafletNS, map: LeafletNS.Map, u: Ucitana, kodovi: ImageData, prikaz: Prikaz) {
  // najprije vidi koje vrste trebaju, pa platna za njih
  const ima = obojaj(u.platna as HTMLCanvasElement[], kodovi, prikaz);
  let novo = false;
  for (const vr of ima)
    if (!u.platna[vr]) {
      u.platna[vr] = document.createElement("canvas");
      novo = true;
    }
  if (novo) obojaj(u.platna as HTMLCanvasElement[], kodovi, prikaz);
  for (let n = 0; n < 4; n++) {
    const el = u.platna[n];
    if (!el || u.slojevi[n]) continue;
    // svgOverlay drži bilo koji element: ovdje platno, koje se prebojava bez kodiranja u PNG
    u.slojevi[n] = L.svgOverlay(el as unknown as SVGElement, u.granice, {
      pane: "gradnja",
      interactive: false,
      className: n === 0 ? "gup-regije" : `gup-regije gup-uzorak gup-uzorak-${n}`,
    }).addTo(map);
  }
  maskaNaMjestu(map, u);
}

function ukloniPlocicu(u: Ucitana) {
  for (const s of u.slojevi) s?.remove();
  for (const p of u.platna) if (p) p.width = 0;
}

/**
 * Ponovno oboji učitane pločice, one u pogledu prve, nekoliko po sličici, da
 * karta ostane živa; prekida se kad ga stigne novije bojenje (`jos` vrati false).
 */
async function prebojaj(
  L: typeof LeafletNS,
  map: LeafletNS.Map,
  ucitane: Map<string, Ucitana>,
  prikaz: Prikaz,
  jos: () => boolean,
) {
  const pogled = map.getBounds();
  const red = [...ucitane].sort(([, a], [, b]) => Number(pogled.intersects(b.granice)) - Number(pogled.intersects(a.granice)));
  let pocetak = performance.now();
  for (const [kljuc, u] of red) {
    const kodovi = await procitaj(kljuc);
    if (!jos()) return;
    osvjeziPlocicu(L, map, u, kodovi, prikaz);
    // pusti preglednik da iscrta i odgovori na dodir kad se nakupi posla za jednu sličicu
    if (performance.now() - pocetak > 12) {
      await new Promise((r) => setTimeout(r));
      pocetak = performance.now();
    }
  }
}

const uGranice = (o: Okvir): [[number, number], [number, number]] => [
  [o[1], o[0]],
  [o[3], o[2]],
];

/** Dijelovi karte prekriveni tražilicom i karticom, u pikselima zaslona. */
export interface Zaklon {
  gore: number;
  dolje: number;
  lijevo: number;
  desno: number;
}

export interface Pogled {
  zum: number;
  lat: number;
  lng: number;
}

export function GradnjaKarta(props: {
  /** granica GUP-a */
  gup: Feature | null;
  /** stambene i mješovite zone (S, M1–M3, K5) */
  zone: FeatureCollection;
  /** detaljni planovi na snazi (DPU, PUP): iscrtkana granica, jer ondje odlučuje plan */
  dpu: FeatureCollection;
  prikaz: Prikaz;
  cilj: CiljKarte | null;
  oznaka: { lng: number; lat: number } | null;
  /** čestica pod zadnjim klikom */
  cestica: Geometrija | null;
  zaklon: Zaklon;
  /** pogled iz poveznice; inače cijeli GUP */
  pocetak: Pogled | null;
  /** dozvole na zelenim česticama i pod planom na snazi; null dok se ne učitaju */
  dozvole: PodaciDozvola | null;
  /** je li koja kategorija dozvole na karti (tada i tanke međe unutar skupina) */
  vidiDozvole: boolean;
  /** čestice (indeksi u dozvole.cestice) akata odabranog mjesta: obrubljuju se kao skupina */
  skupina: readonly number[];
  onKlik: (lng: number, lat: number) => void;
  onPomak: (p: Pogled) => void;
  /** karta je spremna (za sliku za dijeljenje) */
  onSpremna: (map: LeafletNS.Map | null) => void;
}) {
  const { gup, zone, dpu, prikaz, cilj, oznaka, cestica, zaklon, pocetak, dozvole, vidiDozvole, skupina, onKlik, onPomak, onSpremna } = props;
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const tocka = useRef<LeafletNS.CircleMarker | null>(null);
  const obris = useRef<LeafletNS.LayerGroup | null>(null);
  const ucitane = useRef(new Map<string, Ucitana>());
  const prikazRef = useRef(prikaz);
  const zaklonRef = useRef(zaklon);
  /** Redni broj bojenja: starije bojenje stane kad krene novije. */
  const bojenje = useRef(0);
  /** Leaflet se učitava asinkrono: što stigne prije (cilj tražilice, čestica iz poveznice) primijeni se kad karta postoji. */
  const [spremna, setSpremna] = useState(false);
  const povratni = useRef({ onKlik, onPomak, onSpremna });
  useEffect(() => {
    povratni.current = { onKlik, onPomak, onSpremna };
  }, [onKlik, onPomak, onSpremna]);

  useEffect(() => {
    let otkazano = false;
    const mapaPlocica = ucitane.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (otkazano || !div.current) return;
      LRef.current = L;
      const map = L.map(div.current, {
        minZoom: 12,
        maxZoom: 19,
        maxBounds: SIRI_OBUHVAT_KARTE,
        maxBoundsViscosity: 1,
        preferCanvas: true,
        // zum bez stepenica; kotačić i dodirnik vodi glatkiKotacic (dolje), ne Leafletov korak po korak
        zoomSnap: 0,
        zoomDelta: 0.5,
        scrollWheelZoom: false,
        bounceAtZoomLimits: false,
        zoomControl: false,
        // dvoklik zumira; odabir čeka da se vidi je li bio dvoklik
        doubleClickZoom: true,
        keyboard: true,
      });
      mapa.current = map;
      const promatrac = new ResizeObserver(() => map.invalidateSize());
      promatrac.observe(div.current);
      map.on("unload", () => promatrac.disconnect());
      const podloge = Object.fromEntries(
        PODLOGE.map((p) => {
          const sloj = podloga(L, p.id);
          // snimka se ne dohvaća za svaku razinu kroz koju zum prođe, nego za onu na kojoj stane:
          // nepohranjena pločica s državnog servisa traje i sekundu i pol
          sloj.options.updateWhenZooming = false;
          return [p.naziv, sloj];
        }),
      );
      podloge[PODLOGE[0].naziv].addTo(map);
      // dolje desno, odozdo prema gore kao na Google kartama: mjerilo, zum (na mobitelu skriven, ondje su prsti),
      // moja lokacija, podloga; dolje lijevo je tumač
      L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
      L.control.zoom({ position: "bottomright", zoomInTitle: "Približi", zoomOutTitle: "Udalji" }).addTo(map);
      dodajMojuLokaciju(L, map);
      glatkiKotacic(L, map);
      dodajPodlogu(L, map, PODLOGE.map((p) => ({ naziv: p.naziv, sloj: podloge[p.naziv] })));
      map.attributionControl.setPrefix(false);

      // kategorije ispod obrisa, iznad podloge
      const okno = map.createPane("gradnja");
      okno.style.zIndex = "390";
      okno.style.pointerEvents = "none";

      const netaknuto = { interactive: false } as const;
      // tanak bijeli rub ispod tamne crte, da se vidi i na tamnoj snimci
      const obrisiZona = L.layerGroup([
        L.geoJSON(zone, { ...netaknuto, style: { color: "#ffffff", weight: 2, opacity: 0.5, fill: false } }),
        L.geoJSON(zone, { ...netaknuto, style: { color: BOJA_STAMBENE_ZONE, weight: 1, opacity: 0.7, fill: false } }),
      ]);
      const obrisiPoZumu = () => {
        if (map.getZoom() >= OBRISI_OD_ZUMA) obrisiZona.addTo(map);
        else obrisiZona.remove();
      };
      map.on("zoomend", obrisiPoZumu);
      // granica GUP-a puna, s bijelim rubom; iscrtkane su samo granice DPU-a
      if (gup) {
        L.geoJSON(gup, { ...netaknuto, style: { color: "#ffffff", weight: 3.5, opacity: 0.8, fill: false } }).addTo(map);
        L.geoJSON(gup, { ...netaknuto, style: { color: "#18181b", weight: 1.25, fill: false } }).addTo(map);
      }
      // granice DPU-a: bijeli rub ispod tamne iscrtkane crte
      L.geoJSON(dpu, { ...netaknuto, style: { color: "#ffffff", weight: 3, opacity: 0.6, fill: false } }).addTo(map);
      L.geoJSON(dpu, { ...netaknuto, style: { color: "#18181b", weight: 1.5, dashArray: "5 4", fill: false } }).addTo(map);
      const z = zaklonRef.current;
      // prvi pogled: istok grada, gdje je najviše zemljišta za stambenu gradnju, a ne cijeli GUP, na kojem se zeleno ne vidi
      if (pocetak) map.setView([pocetak.lat, pocetak.lng], pocetak.zum);
      else map.fitBounds(map.getSize().x < 640 ? PRVI_POGLED_MOBITEL : PRVI_POGLED, { paddingTopLeft: [z.lijevo + 8, z.gore + 8], paddingBottomRight: [z.desno + 8, z.dolje + 8] });
      obrisiPoZumu();
      povratni.current.onSpremna(map);
      setSpremna(true);

      // klik bira mjesto tek kad se vidi da nije prvi dio dvoklika (koji zumira)
      let odgoda: ReturnType<typeof setTimeout> | null = null;
      map.on("click", (e: LeafletNS.LeafletMouseEvent) => {
        if (odgoda) {
          clearTimeout(odgoda);
          odgoda = null;
          return;
        }
        odgoda = setTimeout(() => {
          odgoda = null;
          povratni.current.onKlik(e.latlng.lng, e.latlng.lat);
        }, 250);
      });
      map.on("dblclick", () => {
        if (odgoda) clearTimeout(odgoda);
        odgoda = null;
      });
      // Enter ili razmaknica na karti s fokusom bira sredinu karte
      map.on("keypress", (e: LeafletNS.LeafletKeyboardEvent) => {
        if (e.originalEvent.key !== "Enter" && e.originalEvent.key !== " ") return;
        const c = map.getCenter();
        povratni.current.onKlik(c.lng, c.lat);
      });

      const ind = await ucitajIndeks().catch(() => null);
      if (otkazano || !ind) return;
      const osvjezi = async () => {
        if (otkazano) return;
        const sredina = map.getCenter();
        povratni.current.onPomak({ zum: map.getZoom(), lat: sredina.lat, lng: sredina.lng });
        okno.classList.toggle("gup-regije-daleko", map.getZoom() < ZUM_OSTRIH_PIKSELA);
        const vidi = map.getBounds().pad(0.25);
        // otpusti pločice daleko od pogleda
        if (mapaPlocica.size > NAJVISE_PLOCICA) {
          const daleko = map.getBounds().pad(1.5);
          for (const [url, u] of mapaPlocica)
            if (!daleko.intersects(u.granice)) {
              ukloniPlocicu(u);
              mapaPlocica.delete(url);
            }
        }
        const trebaju: PlocicaGradnje[] = ind.plocice.filter((p) => vidi.intersects(L.latLngBounds(p.granice)));
        for (const p of trebaju) {
          if (mapaPlocica.has(p.url)) continue;
          try {
            const kodovi = await procitaj(p.url);
            if (otkazano || mapaPlocica.has(p.url)) continue;
            mapaPlocica.set(p.url, dodajPlocicu(L, map, L.latLngBounds(p.granice), kodovi, prikazRef.current));
          } catch {
            // pločica se nije učitala; pokušat će se pri sljedećem pomaku karte
          }
        }
      };
      map.on("moveend", osvjezi);
      // nova razina zuma: pločice su na novom mjestu u sloju, pa i maske uzoraka
      map.on("zoomend viewreset", () => {
        for (const u of mapaPlocica.values()) maskaNaMjestu(map, u);
      });
      void osvjezi();
    })();
    return () => {
      otkazano = true;
      for (const u of mapaPlocica.values()) ukloniPlocicu(u);
      mapaPlocica.clear();
      povratni.current.onSpremna(null);
      mapa.current?.remove();
      mapa.current = null;
    };
    // podaci stižu jednom, prije prvog crtanja karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sloj ugašen ili upaljen, ili odabrana zapreka: učitane pločice samo se prebojaju
  useEffect(() => {
    if (prikazRef.current === prikaz) return;
    prikazRef.current = prikaz;
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    const n = ++bojenje.current;
    void prebojaj(L, map, ucitane.current, prikaz, () => n === bojenje.current);
  }, [prikaz]);

  // gumbi karte izmiču tražilici i kartici
  useEffect(() => {
    zaklonRef.current = zaklon;
    const el = div.current;
    if (!el) return;
    for (const c of el.querySelectorAll<HTMLElement>(".leaflet-top")) c.style.top = `${zaklon.gore}px`;
    for (const c of el.querySelectorAll<HTMLElement>(".leaflet-bottom")) c.style.bottom = `${zaklon.dolje}px`;
    for (const c of el.querySelectorAll<HTMLElement>(".leaflet-left")) c.style.left = `${zaklon.lijevo}px`;
  }, [zaklon, spremna]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || !cilj) return;
    const z = zaklonRef.current;
    const okvir = cilj.okvir ? L.latLngBounds(uGranice(cilj.okvir)) : L.latLng(cilj.tocka![1], cilj.tocka![0]).toBounds(120);
    map.flyToBounds(okvir, {
      paddingTopLeft: [z.lijevo + 24, z.gore + 24],
      paddingBottomRight: [z.desno + 24, z.dolje + 24],
      maxZoom: 18,
      duration: 0.6,
    });
  }, [cilj, spremna]);

  // odabrana čestica i točka moraju biti u dijelu karte koji tražilica i kartica ne prekrivaju
  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || (!cestica && !oznaka)) return;
    const z = zaklon;
    const okvir = cestica
      ? L.geoJSON({ type: "Feature", properties: {}, geometry: cestica } as Feature).getBounds()
      : L.latLng(oznaka!.lat, oznaka!.lng).toBounds(10);
    // i sve čestice akta (skupina), da se vidi cijela građevna čestica
    if (dozvole) for (const i of skupina) okvir.extend(L.geoJSON({ type: "Feature", properties: {}, geometry: dozvole.cestice[i].oblik } as Feature).getBounds());
    const vel = map.getSize();
    const a = map.latLngToContainerPoint(okvir.getNorthWest());
    const b = map.latLngToContainerPoint(okvir.getSouthEast());
    const unutra = a.x >= z.lijevo + 8 && a.y >= z.gore + 8 && b.x <= vel.x - z.desno - 8 && b.y <= vel.y - z.dolje - 8;
    if (unutra) return;
    const slobodno = { x: vel.x - z.lijevo - z.desno - 32, y: vel.y - z.gore - z.dolje - 32 };
    // premalo mjesta (npr. kartica raširena na niskom zaslonu): ne skači
    if (slobodno.x < 80 || slobodno.y < 80) return;
    map.flyToBounds(okvir, {
      paddingTopLeft: [z.lijevo + 16, z.gore + 16],
      paddingBottomRight: [z.desno + 16, z.dolje + 16],
      maxZoom: Math.max(map.getZoom(), 17),
      duration: 0.4,
    });
    // skupina stiže s kartom i čestica: ne mijenja se bez nove čestice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cestica, oznaka, zaklon, spremna]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    obris.current?.remove();
    if (!cestica) {
      obris.current = null;
      return;
    }
    // bijeli rub ispod pune crne crte: vidi se i na tamnoj zgradi i na svijetloj ulici
    const f = { type: "Feature", properties: {}, geometry: cestica } as Feature;
    obris.current = L.layerGroup([
      L.geoJSON(f, { interactive: false, style: { color: "#ffffff", weight: 5, opacity: 0.9, fill: false } }),
      L.geoJSON(f, { interactive: false, style: { color: "#111111", weight: 2.5, fill: false } }),
    ]).addTo(map);
  }, [cestica, spremna]);

  // izdaleka su mala gradilišta manja od piksela: točka u boji kategorije pokaže da postoje
  // (mrlje iz gradnja-zone.py; samo upaljene kategorije, i ne dok se ističe zapreka)
  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || prikaz.prepreka) return;
    let otkazano = false;
    const sloj = L.layerGroup().addTo(map);
    let mrlje: [number, number, number, number][] = [];
    const crtaj = () => {
      sloj.clearLayers();
      const zum = map.getZoom();
      for (const [lng, lat, kod, m2] of mrlje) {
        const k = KATEGORIJA_PO_KODU.get(kod);
        if (!k || prikaz.skrivene.has(k.id)) continue;
        // promjer mrlje na zaslonu: krug iste površine, u pikselima na ovom zumu
        const mPoPx = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zum;
        if ((2 * Math.sqrt(m2 / Math.PI)) / mPoPx >= MRLJA_VIDLJIVA_PX) continue;
        sloj.addLayer(
          L.circleMarker([lat, lng], { radius: 3.5, weight: 1, color: "#ffffff", fillColor: k.boja, fillOpacity: 1, interactive: false }),
        );
      }
    };
    fetch("/geo/gup-grad/gradnja-mrlje-2025.json")
      .then((r) => (r.ok ? (r.json() as Promise<{ mrlje: [number, number, number, number][] }>) : { mrlje: [] }))
      .then((d) => {
        if (otkazano) return;
        mrlje = d.mrlje;
        crtaj();
      })
      .catch(() => {});
    map.on("zoomend", crtaj);
    return () => {
      otkazano = true;
      map.off("zoomend", crtaj);
      sloj.remove();
    };
  }, [prikaz, spremna]);

  // čestice zahtjeva i dozvola: tanka međa unutar skupine, izbliza, dok je koja kategorija dozvole na karti
  // (sama površina je u pločicama: „zatražena dozvola”, „izdana dozvola”)
  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || !dozvole || !vidiDozvole) return;
    const obrisi = L.layerGroup(
      dozvole.cestice
        .filter((c) => c.akti.length)
        .map((c) =>
          L.geoJSON({ type: "Feature", properties: {}, geometry: c.oblik } as Feature, {
            interactive: false,
            style: { color: BOJA_DOZVOLE, weight: 1, opacity: 0.55, fill: false },
          }),
        ),
    );
    const poZumu = () => {
      if (map.getZoom() >= DOZVOLE_OBRISI_OD_ZUMA) obrisi.addTo(map);
      else obrisi.remove();
    };
    poZumu();
    map.on("zoomend", poZumu);
    return () => {
      map.off("zoomend", poZumu);
      obrisi.remove();
    };
  }, [dozvole, vidiDozvole, spremna]);

  // odabrana skupina čestica jednog akta: bijeli rub i tamna crta oko svake, kao odabrana čestica
  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || !dozvole || !skupina.length) return;
    const g = L.layerGroup(
      skupina.flatMap((i) => {
        const f = { type: "Feature", properties: {}, geometry: dozvole.cestice[i].oblik } as Feature;
        return [
          L.geoJSON(f, { interactive: false, style: { color: "#ffffff", weight: 4.5, opacity: 0.9, fill: false } }),
          L.geoJSON(f, { interactive: false, style: { color: BOJA_DOZVOLE, weight: 2, fill: false } }),
        ];
      }),
    ).addTo(map);
    return () => {
      g.remove();
    };
  }, [dozvole, skupina, spremna]);

  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L) return;
    tocka.current?.remove();
    tocka.current = oznaka
      ? L.circleMarker([oznaka.lat, oznaka.lng], {
          radius: 7,
          weight: 2.5,
          color: "#ffffff",
          fillColor: "#18181b",
          fillOpacity: 1,
          interactive: false,
          pane: "markerPane",
        }).addTo(map)
      : null;
  }, [oznaka, spremna]);

  return (
    <div
      ref={div}
      className="h-full w-full"
      role="application"
      aria-label="Karta: gdje se po novom GUP-u može graditi. Strelicama pomakni kartu, plus i minus zumiraju, Enter odabire sredinu karte."
    />
  );
}

/**
 * Zum kotačićem i dodirnikom kao na Google kartama (prema Leaflet.SmoothWheelZoom, MIT): svaki pomak kotačića
 * pomakne ciljani zum, a karta mu se svake sličice približi oko točke pod mišem, bez animacije. Leaflet bi inače
 * pokrete skupljao 40 ms i zumirao korak po korak, svaki put s cijelim krajem zuma (pločice, obrisi, točke, maske),
 * pa je zum dodirnikom bio spor i trzav. Kraj zuma (zoomend, moveend) ovdje je jednom, kad kotačić stane; dok
 * se vrti, uzorci su skriveni (globals.css, .gup-zumira).
 */
function glatkiKotacic(L: typeof LeafletNS, map: LeafletNS.Map) {
  const kontejner = map.getContainer();
  /** Razina zuma po pikselu pomaka: zarez kotačića miša (~100 px) je pola razine; dodirnik daje male pomake. */
  const PO_PIKSELU = 1 / 200;
  /** Pinch na dodirniku (ctrl + kotačić) daje male pomake, pa je jači. */
  const PINCH = 8;
  let cilj = 0;
  let tocka = L.point(0, 0);
  // karta još nema pogled kad se ovo poziva: točka se postavi na prvi pomak kotačića
  let latlngPodMisem = L.latLng(0, 0);
  let okvir = 0;
  let kraj: ReturnType<typeof setTimeout> | null = null;
  let pokrenuto = false;

  const korak = () => {
    const z = map.getZoom();
    const novi = Math.abs(cilj - z) < 0.002 ? cilj : z + (cilj - z) * 0.35;
    // točka pod mišem ostaje pod mišem
    const pomak = tocka.subtract(map.getSize().divideBy(2));
    const sredina = map.unproject(map.project(latlngPodMisem, novi).subtract(pomak), novi);
    if (!pokrenuto) {
      (map as unknown as { _moveStart: (z: boolean, n: boolean) => void })._moveStart(true, false);
      pokrenuto = true;
    }
    (map as unknown as { _move: (c: LeafletNS.LatLng, z: number) => void })._move(sredina, novi);
    okvir = novi === cilj ? 0 : requestAnimationFrame(korak);
  };

  const zavrsi = () => {
    kraj = null;
    if (okvir) cancelAnimationFrame(okvir);
    okvir = 0;
    kontejner.classList.remove("gup-zumira");
    if (pokrenuto) (map as unknown as { _moveEnd: (z: boolean) => void })._moveEnd(true);
    pokrenuto = false;
  };

  L.DomEvent.on(kontejner, "wheel", (e) => {
    const ev = e as WheelEvent;
    L.DomEvent.preventDefault(ev);
    L.DomEvent.stopPropagation(ev);
    if (!kraj) {
      // početak okretaja: zaustavi animacije, zapamti točku pod mišem
      (map as unknown as { _stop: () => void })._stop();
      cilj = map.getZoom();
      kontejner.classList.add("gup-zumira");
    }
    tocka = map.mouseEventToContainerPoint(ev);
    latlngPodMisem = map.containerPointToLatLng(tocka);
    // pomak u pikselima (redci i stranice preračunati), prema gore je približavanje
    const px = ev.deltaY * (ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 800 : 1);
    const d = -px * PO_PIKSELU * (ev.ctrlKey ? PINCH : 1);
    cilj = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), cilj + Math.max(-1, Math.min(1, d))));
    if (!okvir) okvir = requestAnimationFrame(korak);
    if (kraj) clearTimeout(kraj);
    kraj = setTimeout(zavrsi, 180);
  });
}

/** Prvi pogled karte: istok grada (Žnjan, Sirobuja, Stobreč, Dračevac), gdje je najviše zemljišta za stambenu gradnju. */
const PRVI_POGLED: [[number, number], [number, number]] = [
  [43.5005, 16.468],
  [43.5285, 16.526],
];
/** Na uskom zaslonu uži pogled istoka, bez mora, da zelenog bude dovoljno izbliza. */
const PRVI_POGLED_MOBITEL: [[number, number], [number, number]] = [
  [43.5095, 16.482],
  [43.5295, 16.512],
];

/** Gumb podloge iznad „Moja lokacije”: izmjenjuje ortofoto i satelitsku snimku (umjesto Leafletova popisa). */
function dodajPodlogu(L: typeof LeafletNS, map: LeafletNS.Map, podloge: { naziv: string; sloj: LeafletNS.TileLayer }[]) {
  let i = 0;
  const Kontrola = L.Control.extend({
    onAdd() {
      const okvir = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const gumb = L.DomUtil.create("a", "gup-lokacija gup-podloga", okvir);
      gumb.href = "#";
      gumb.role = "button";
      const opis = () => `Podloga: ${podloge[i].naziv} (promijeni u ${podloge[(i + 1) % podloge.length].naziv})`;
      gumb.title = opis();
      gumb.setAttribute("aria-label", opis());
      gumb.innerHTML =
        '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M2.5 13.5l4.5-4.5 4 4 2.5-2.5 4 4"/><circle cx="13.5" cy="7.5" r="1.3"/></svg>';
      L.DomEvent.disableClickPropagation(okvir);
      L.DomEvent.on(gumb, "click", (e) => {
        L.DomEvent.preventDefault(e);
        map.removeLayer(podloge[i].sloj);
        i = (i + 1) % podloge.length;
        podloge[i].sloj.addTo(map);
        gumb.title = opis();
        gumb.setAttribute("aria-label", opis());
      });
      return okvir;
    },
  });
  new Kontrola({ position: "bottomright" }).addTo(map);
}

/** Gumb „Moja lokacija” iznad zuma: plava točka i karta na mjestu gdje je korisnik. */
function dodajMojuLokaciju(L: typeof LeafletNS, map: LeafletNS.Map) {
  let tocka: LeafletNS.CircleMarker | null = null;
  const Kontrola = L.Control.extend({
    onAdd() {
      const okvir = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const gumb = L.DomUtil.create("a", "gup-lokacija", okvir);
      gumb.href = "#";
      gumb.role = "button";
      gumb.title = "Moja lokacija";
      gumb.setAttribute("aria-label", "Moja lokacija");
      gumb.innerHTML =
        '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="4"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>';
      L.DomEvent.disableClickPropagation(okvir);
      L.DomEvent.on(gumb, "click", (e) => {
        L.DomEvent.preventDefault(e);
        map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
      });
      return okvir;
    },
  });
  new Kontrola({ position: "bottomright" }).addTo(map);
  map.on("locationfound", (e: LeafletNS.LocationEvent) => {
    tocka?.remove();
    tocka = L.circleMarker(e.latlng, { radius: 8, weight: 3, color: "#ffffff", fillColor: "#2563eb", fillOpacity: 1, interactive: false }).addTo(map);
  });
  map.on("locationerror", () => {
    window.alert("Lokacija nije dostupna. Dopusti pregledniku pristup lokaciji ili potraži adresu.");
  });
}
