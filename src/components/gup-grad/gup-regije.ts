"use client";

/**
 * Sloj „dijelovi čestice” na karti /gup: GDJE je unutar čestice zauzeto, a
 * gdje slobodno, na rešetki od 2 m (scripts/gup-grad/regije.py).
 *
 * Pločice nose brojeve, ne boje: R = klasa namjene, G = regija (zgrada,
 * ulica, parkiralište… okućnica, slobodno i razlog zbog kojeg nije za
 * gradnju), B = sklad s planom. Preglednik ih boji prema načinu „Boja
 * karte”, pa jedan komplet pločica služi svim načinima boje. Za svaki
 * način brojanja postoji svoj komplet (okućnica „po odredbama”, cijela
 * čestica „sve s gradnjom”, samo tlocrt).
 */
import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";

import { KLASA_PO_INDEKSU } from "@/lib/gup-grad/model";
import type { BojaKarte, GupPostavke } from "@/components/gup-grad/gup-provjera";

export const MIN_ZUM_REGIJA = 15;

/** Regije kako ih piše regije.py. */
export const REGIJE = {
  zgrada: 1,
  gradiliste: 2,
  ulica: 3,
  parkiraliste: 4,
  javna: 5,
  uredjeno: 6,
  infrastruktura: 7,
  zelenilo: 8,
  okucnica: 9,
  slobodno: 10,
  usko: 11,
  premalo: 12,
  zabranjeno: 13,
  neizgradivo: 14,
} as const;

/** Vrijede li dijelovi čestice za ove postavke. */
export function regijeVrijede(p: GupPostavke): boolean {
  return p.dijelovi && p.cestice && p.prikaz !== "namjena";
}

type Rgba = [number, number, number, number];
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SIVA_ULICA: Rgba = [161, 161, 170, 90];
const CRVENA: [number, number, number] = [208, 59, 59];
const nijeZaGradnju = (r: number) => r >= REGIJE.usko;

/**
 * Boja piksela za način karte. `x`, `y` su koordinate u pločici — za
 * uzorke: crvene kose pruge preko protivnog i točkice preko slobodnog koje
 * nije za gradnju (isti jezik kao rubovi čestica).
 */
function boja(mod: BojaKarte, klasa: number, r: number, sklad: number, x: number, y: number): Rgba | null {
  if (r === REGIJE.ulica) return SIVA_ULICA;
  const tocka = nijeZaGradnju(r) && x % 3 === 0 && y % 3 === 0;
  if (mod === "iskoristenost") {
    if (r === REGIJE.slobodno) return [2, 132, 199, 205];
    if (nijeZaGradnju(r)) return tocka ? [63, 63, 70, 200] : [255, 255, 255, 170];
    if (r === REGIJE.okucnica) return [212, 212, 216, 150];
    if (r === REGIJE.zgrada) return [82, 82, 91, 175];
    return [161, 161, 170, 160];
  }
  if (mod === "sklad") {
    if (r >= REGIJE.slobodno) return null;
    const a = r === REGIJE.okucnica ? 110 : 195;
    return sklad === 2 ? [220, 38, 38, a] : [22, 163, 74, a];
  }
  // sve tri: nijansa = namjena, jačina = zauzeto/okućnica/slobodno, pruge = protivno
  if (sklad === 2 && (x + y) % 5 === 0) return [...CRVENA, 240];
  const kl = KLASA_PO_INDEKSU.get(klasa);
  const [cr, cg, cb] = hex(kl?.kod === "P" ? "#a1a1aa" : (kl?.bojaPlana ?? "#ffffff"));
  if (tocka) return [63, 63, 70, 190];
  const a = r === REGIJE.okucnica ? 125 : r >= REGIJE.slobodno ? 35 : 215;
  return [cr, cg, cb, a];
}

interface Plocica {
  url: string;
  granice: [[number, number], [number, number]];
}
interface Ucitana {
  kodovi: ImageData;
  sloj: LeafletNS.ImageOverlay;
  url: string | null;
}

async function obojaj(kodovi: ImageData, mod: BojaKarte): Promise<string | null> {
  const { width: w, height: h, data: d } = kodovi;
  const out = new ImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] !== 255 || d[i + 1] === 0) continue;
      const c = boja(mod, d[i], d[i + 1], d[i + 2], x, y);
      if (!c) continue;
      o[i] = c[0];
      o[i + 1] = c[1];
      o[i + 2] = c[2];
      o[i + 3] = c[3];
    }
  }
  const platno = document.createElement("canvas");
  platno.width = w;
  platno.height = h;
  platno.getContext("2d")!.putImageData(out, 0, 0);
  const blob = await new Promise<Blob | null>((r) => platno.toBlob(r));
  return blob ? URL.createObjectURL(blob) : null;
}

async function procitaj(url: string): Promise<ImageData> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const platno = document.createElement("canvas");
  platno.width = bmp.width;
  platno.height = bmp.height;
  const ctx = platno.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

/**
 * Drži pločice dijelova čestice za okno: učitava one koje su u oknu (od
 * zuma MIN_ZUM_REGIJA), boji ih za trenutačni način i prebojava kad se on
 * promijeni. Vraća ništa — sloj živi na karti.
 */
export function useRegije(opts: {
  mapRef: { current: LeafletNS.Map | null };
  LRef: { current: typeof LeafletNS | null };
  spremno: boolean;
  postavke: GupPostavke;
}) {
  const { mapRef, LRef, spremno, postavke } = opts;
  const aktivno = regijeVrijede(postavke);
  const mod = postavke.prikaz;
  const godina = postavke.godina;
  const inacica = postavke.inacica;
  const indeks = useRef<Record<string, Record<string, Plocica[]>> | null>(null);
  const ucitane = useRef(new Map<string, Ucitana>());
  const modRef = useRef(mod);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno) return;
    let ziv = true;
    if (!map.getPane("gup-regije")) {
      // ispod čestica (overlayPane, 400), iznad podloge
      const okno = map.createPane("gup-regije");
      okno.style.zIndex = "390";
      okno.style.pointerEvents = "none";
    }
    const mapa = ucitane.current;

    const osvjezi = async () => {
      if (!ziv) return;
      const vidljivo = map.getZoom() >= MIN_ZUM_REGIJA;
      indeks.current ??= await fetch("/geo/gup-grad/regije.json")
        .then((r) => r.json())
        .then((d: { inacice: Record<string, Record<string, Plocica[]>> }) => d.inacice)
        .catch(() => ({}));
      if (!ziv) return;
      const okno = map.getBounds().pad(0.25);
      const trebaju = vidljivo
        ? (indeks.current![inacica]?.[String(godina)] ?? []).filter((p) => okno.intersects(L.latLngBounds(p.granice)))
        : [];
      const trebajuUrl = new Set(trebaju.map((p) => p.url));
      for (const [url, u] of mapa) {
        if (!trebajuUrl.has(url)) {
          u.sloj.remove();
          if (u.url) URL.revokeObjectURL(u.url);
          mapa.delete(url);
        }
      }
      for (const p of trebaju) {
        if (mapa.has(p.url)) continue;
        try {
          const kodovi = await procitaj(p.url);
          if (!ziv || mapa.has(p.url)) continue;
          const url = await obojaj(kodovi, modRef.current);
          if (!ziv || !url) continue;
          const sloj = L.imageOverlay(url, p.granice, { pane: "gup-regije", interactive: false, className: "gup-regije" }).addTo(map);
          mapa.set(p.url, { kodovi, sloj, url });
        } catch {
          // pločica se nije učitala; pokušat će se pri sljedećem pomaku karte
        }
      }
    };
    map.on("moveend", osvjezi);
    void osvjezi();
    return () => {
      ziv = false;
      map.off("moveend", osvjezi);
      for (const u of mapa.values()) {
        u.sloj.remove();
        if (u.url) URL.revokeObjectURL(u.url);
      }
      mapa.clear();
    };
  }, [mapRef, LRef, spremno, aktivno, godina, inacica]);

  // promjena načina „Boja karte” samo prebojava učitane pločice
  useEffect(() => {
    modRef.current = mod;
    let ziv = true;
    void (async () => {
      for (const u of ucitane.current.values()) {
        const url = await obojaj(u.kodovi, mod);
        if (!ziv || !url) return;
        if (u.url) URL.revokeObjectURL(u.url);
        u.url = url;
        u.sloj.setUrl(url);
      }
    })();
    return () => {
      ziv = false;
    };
  }, [mod]);
}
