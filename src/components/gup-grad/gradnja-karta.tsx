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
import { najjaciAkt, type PodaciDozvola } from "@/lib/gup-grad/gradnja-dozvole";

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
/** Dozvole: izdaleka točke (čestica je manja od piksela), izbliza obrisi čestica. */
const DOZVOLE_OBRISI_OD_ZUMA = 15;
/** Boja dozvola: tamna, jer zelena, plava, jantarna i ljubičasta već nešto znače. */
export const BOJA_DOZVOLE = "#111111";
/** Treptanje: dozvola je ono što se sada mijenja na terenu. */
const TREPTAJ_MS = 700;
/** Događaj prije slike za dijeljenje: treptanje stane na nekoliko sekundi. */
export const DOGADAJ_SLIKE = "gradnja-slika";

/** Više učitanih pločica od ovoga: one daleko od pogleda se otpuste (mobitel ima malo memorije). */
const NAJVISE_PLOCICA = 48;

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** RGBA u jednom broju, kako ga Uint32Array vidi na little-endian strojevima (svi današnji preglednici). */
const rgba = ([r, g, b]: [number, number, number], a: number) => ((Math.round(a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
const BOJA_ISTAKNUTOG = rgba(hex(BOJA_PREPREKE), ALFA_PREPREKE * 255);
/** Po indeksu klase (kanal R): 1 gdje namjena dopušta stanovanje. */
const STAMBENE_KLASE = Uint8Array.from({ length: 256 }, (_, i) => (zonaKlase(i) === "stambena" ? 1 : 0));
/** Strana pločice u pikselima (scripts/gup-grad/regije.py, PLOCICA). */
const PLOCICA = 512;

/**
 * Razmak i debljina pruga u pikselima pločice (~1,8 m) za zum. Pruge od 6 px
 * izdaleka su uže od piksela zaslona i preglednik ih zagladi u jednoličnu
 * boju, pa se šrafirano ne bi razlikovalo od punog. Zato razmak raste s
 * udaljenošću, da pruge na zaslonu ostanu ~6 px jedna od druge.
 */
export function prugeZaZum(zum: number): { razmak: number; debljina: number; debljinaMreze: number; razina: number } {
  const razina = Math.min(16, Math.max(13, Math.round(zum)));
  const razmak = 6 * 2 ** (16 - razina);
  return { razmak, debljina: Math.max(2, Math.round(razmak / 3)), debljinaMreze: Math.max(2, Math.round(razmak / 4)), razina };
}

/** Red i stupac pločice iz njezina imena (`…/<red>_<stupac>.png`): pruge se crtaju u koordinatama cijele mreže, bez šava. */
function polozaj(url: string): [number, number] {
  const m = /(\d+)_(\d+)\.png$/.exec(url);
  return m ? [Number(m[1]) * PLOCICA, Number(m[2]) * PLOCICA] : [0, 0];
}


/** Što je na karti vidljivo i istaknuto. */
export interface Prikaz {
  skrivene: ReadonlySet<IdKategorije>;
  prepreka: IdPrepreke | null;
}

/**
 * Boje po bajtu kategorije (kanal B, razlog i vlasnik): puna boja, boja pruge i
 * vrsta pruge (0 nema, 1 kose, 2 mreža), te je li razlog istaknuta zapreka.
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
      p.vrsta[bajt] = k.mreza ? 2 : 1;
    }
  }
  palete.set(prikaz, p);
  return p;
}

/** Oboji pločicu u njezino platno; vraća ima li na njoj pruga (samo takve se prebojavaju kad se promijeni zum). */
function obojaj(platno: HTMLCanvasElement, url: string, kodovi: ImageData, prikaz: Prikaz, zum: number): boolean {
  const { width: w, height: h, data: d } = kodovi;
  const { razmak, debljina, debljinaMreze } = prugeZaZum(zum);
  const [y0, x0] = polozaj(url);
  const { boja, pruga, vrsta, istaknuto } = paletaZa(prikaz);
  const ulaz = new Uint32Array(d.buffer, d.byteOffset, w * h);
  const out = new ImageData(w, h);
  const izlaz = new Uint32Array(out.data.buffer);
  const pomak = razmak * 1e4;
  let imaPruga = false;
  for (let y = 0, i = 0; y < h; y++) {
    const gy = y0 + y;
    for (let x = 0; x < w; x++, i++) {
      const v = ulaz[i];
      if (v >>> 24 !== 255) continue;
      const bajt = (v >>> 16) & 255;
      if (istaknuto[bajt] && STAMBENE_KLASE[v & 255]) {
        izlaz[i] = BOJA_ISTAKNUTOG;
        continue;
      }
      const vr = vrsta[bajt];
      if (vr === 0) {
        izlaz[i] = boja[bajt];
        continue;
      }
      imaPruga = true;
      const gx = x0 + x;
      const naPrugi = vr === 1 ? (gx + gy) % razmak < debljina : (gx + gy) % razmak < debljinaMreze || (gx - gy + pomak) % razmak < debljinaMreze;
      izlaz[i] = naPrugi ? pruga[bajt] : boja[bajt];
    }
  }
  if (platno.width !== w) platno.width = w;
  if (platno.height !== h) platno.height = h;
  platno.getContext("2d")!.putImageData(out, 0, 0);
  return imaPruga;
}

interface Ucitana {
  sloj: LeafletNS.SVGOverlay;
  platno: HTMLCanvasElement;
  granice: LeafletNS.LatLngBounds;
  imaPruga: boolean;
}

/**
 * Ponovno oboji učitane pločice, one u pogledu prve, nekoliko po sličici, da
 * karta ostane živa; prekida se kad ga stigne novije bojenje (`jos` vrati
 * false). `samoPruge`: promijenio se samo razmak pruga, pa pločice bez pruga ostaju.
 */
async function prebojaj(
  ucitane: Map<string, Ucitana>,
  prikaz: Prikaz,
  zum: number,
  jos: () => boolean,
  pogled: LeafletNS.LatLngBounds | null,
  samoPruge = false,
) {
  const red = [...ucitane].filter(([, u]) => !samoPruge || u.imaPruga);
  if (pogled) red.sort(([, a], [, b]) => Number(pogled.intersects(b.granice)) - Number(pogled.intersects(a.granice)));
  let pocetak = performance.now();
  for (const [kljuc, u] of red) {
    const kodovi = await procitaj(kljuc);
    if (!jos()) return;
    u.imaPruga = obojaj(u.platno, kljuc, kodovi, prikaz, zum);
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
  vidiDozvole: boolean;
  /** čestice (indeksi u dozvole.cestice) akata odabranog mjesta: obrubljuju se kao skupina */
  skupina: readonly number[];
  onKlik: (lng: number, lat: number) => void;
  onPomak: (p: Pogled) => void;
  /** karta je spremna (za sliku za dijeljenje) */
  onSpremna: (map: LeafletNS.Map | null) => void;
}) {
  const { gup, zone, prikaz, cilj, oznaka, cestica, zaklon, pocetak, dozvole, vidiDozvole, skupina, onKlik, onPomak, onSpremna } = props;
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const tocka = useRef<LeafletNS.CircleMarker | null>(null);
  const obris = useRef<LeafletNS.LayerGroup | null>(null);
  const ucitane = useRef(new Map<string, Ucitana>());
  const prikazRef = useRef(prikaz);
  const zaklonRef = useRef(zaklon);
  /** Razina pruga po kojoj su pločice obojane (prugeZaZum) i redni broj bojenja. */
  const razinaRef = useRef(0);
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
        zoomSnap: 0.25,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 80,
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
      L.control.zoom({ position: "bottomright", zoomInTitle: "Približi", zoomOutTitle: "Udalji" }).addTo(map);
      dodajMojuLokaciju(L, map);
      L.control.layers(podloge, undefined, { position: "bottomleft" }).addTo(map);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
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
      const granica = gup
        ? L.geoJSON(gup, { ...netaknuto, style: { color: "#18181b", weight: 1.5, dashArray: "7 5", fill: false } }).addTo(map)
        : null;
      const z = zaklonRef.current;
      if (pocetak) map.setView([pocetak.lat, pocetak.lng], pocetak.zum);
      else if (granica)
        map.fitBounds(granica.getBounds(), { paddingTopLeft: [z.lijevo + 8, z.gore + 8], paddingBottomRight: [z.desno + 8, z.dolje + 8] });
      else map.setView([43.515, 16.47], 13);
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
        // druga razina pruga: učitane pločice prebojaju se s novim razmakom
        const razina = prugeZaZum(map.getZoom()).razina;
        if (razina !== razinaRef.current) {
          const prva = razinaRef.current === 0;
          razinaRef.current = razina;
          if (!prva) {
            const n = ++bojenje.current;
            void prebojaj(mapaPlocica, prikazRef.current, razina, () => !otkazano && n === bojenje.current, map.getBounds(), true);
          }
        }
        const vidi = map.getBounds().pad(0.25);
        // otpusti pločice daleko od pogleda
        if (mapaPlocica.size > NAJVISE_PLOCICA) {
          const daleko = map.getBounds().pad(1.5);
          for (const [url, u] of mapaPlocica)
            if (!daleko.intersects(u.granice)) {
              u.sloj.remove();
              u.platno.width = 0;
              mapaPlocica.delete(url);
            }
        }
        const trebaju: PlocicaGradnje[] = ind.plocice.filter((p) => vidi.intersects(L.latLngBounds(p.granice)));
        for (const p of trebaju) {
          if (mapaPlocica.has(p.url)) continue;
          try {
            const kodovi = await procitaj(p.url);
            if (otkazano || mapaPlocica.has(p.url)) continue;
            const platno = document.createElement("canvas");
            const imaPruga = obojaj(platno, p.url, kodovi, prikazRef.current, razinaRef.current);
            const granice = L.latLngBounds(p.granice);
            // svgOverlay drži bilo koji element: ovdje platno, koje se prebojava bez kodiranja u PNG
            const sloj = L.svgOverlay(platno as unknown as SVGElement, granice, {
              pane: "gradnja",
              interactive: false,
              className: "gup-regije",
            }).addTo(map);
            mapaPlocica.set(p.url, { sloj, platno, granice, imaPruga });
          } catch {
            // pločica se nije učitala; pokušat će se pri sljedećem pomaku karte
          }
        }
      };
      map.on("moveend", osvjezi);
      void osvjezi();
    })();
    return () => {
      otkazano = true;
      for (const u of mapaPlocica.values()) u.platno.width = 0;
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
    const n = ++bojenje.current;
    void prebojaj(ucitane.current, prikaz, razinaRef.current, () => n === bojenje.current, mapa.current?.getBounds() ?? null);
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

  // dozvole: obrisi čestica izbliza, točke izdaleka; izdana puna crta, zahtjev u obradi iscrtkan; trepću
  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || !dozvole || !vidiDozvole) return;
    const obrisi = L.layerGroup();
    const tocke = L.layerGroup();
    const svi: { sloj: LeafletNS.Path; izdana: boolean }[] = [];
    dozvole.cestice.forEach((c) => {
      // čestice akta koje nisu zelene (prilaz) vide se tek kao dio odabrane skupine
      if (!c.akti.length || (c.zeleno_m2 === 0 && c.plan_m2 === 0)) return;
      const a = najjaciAkt(dozvole, c.akti);
      const izdana = a?.ishod === "izdana";
      const obris = L.geoJSON({ type: "Feature", properties: {}, geometry: c.oblik } as Feature, {
        interactive: false,
        style: { color: BOJA_DOZVOLE, weight: 2.5, dashArray: izdana ? undefined : "5 4", fillColor: BOJA_DOZVOLE, fillOpacity: izdana ? 0.18 : 0.06 },
      });
      const t = L.circleMarker([c.tocka[1], c.tocka[0]], {
        radius: 5.5,
        weight: 2,
        color: izdana ? "#ffffff" : BOJA_DOZVOLE,
        fillColor: izdana ? BOJA_DOZVOLE : "#ffffff",
        fillOpacity: 1,
        interactive: false,
      });
      obrisi.addLayer(obris);
      tocke.addLayer(t);
      obris.eachLayer((l) => svi.push({ sloj: l as LeafletNS.Path, izdana }));
      svi.push({ sloj: t, izdana });
    });
    const poZumu = () => {
      if (map.getZoom() >= DOZVOLE_OBRISI_OD_ZUMA) {
        tocke.remove();
        obrisi.addTo(map);
      } else {
        obrisi.remove();
        tocke.addTo(map);
      }
    };
    poZumu();
    map.on("zoomend", poZumu);
    let upaljeno = true;
    const mirno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stanka = 0;
    const treptaj = mirno
      ? null
      : setInterval(() => {
          upaljeno = !upaljeno || Date.now() < stanka;
          for (const { sloj } of svi) sloj.setStyle({ opacity: upaljeno ? 1 : 0.25 });
        }, TREPTAJ_MS);
    // slika za dijeljenje (gradnja-slika.ts): dozvole pune, ne usred treptaja
    const slika = () => {
      stanka = Date.now() + 5000;
      upaljeno = true;
      for (const { sloj } of svi) sloj.setStyle({ opacity: 1 });
    };
    window.addEventListener(DOGADAJ_SLIKE, slika);
    return () => {
      window.removeEventListener(DOGADAJ_SLIKE, slika);
      if (treptaj) clearInterval(treptaj);
      map.off("zoomend", poZumu);
      obrisi.remove();
      tocke.remove();
    };
  }, [dozvole, vidiDozvole, spremna]);

  // odabrana skupina čestica jednog akta: deblji obrub oko svake, bez treptanja
  useEffect(() => {
    const map = mapa.current, L = LRef.current;
    if (!map || !L || !dozvole || !skupina.length) return;
    const g = L.layerGroup(
      skupina.flatMap((i) => {
        const f = { type: "Feature", properties: {}, geometry: dozvole.cestice[i].oblik } as Feature;
        return [
          L.geoJSON(f, { interactive: false, style: { color: "#ffffff", weight: 6, opacity: 0.9, fill: false } }),
          L.geoJSON(f, { interactive: false, style: { color: BOJA_DOZVOLE, weight: 3, fill: false } }),
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
