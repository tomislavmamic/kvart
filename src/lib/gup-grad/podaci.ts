/**
 * Čitanje data/gup-grad/cestice.json (piše scripts/gup-grad/cestice.py).
 *
 * Samo na poslužitelju: datoteka ima ~4 MB mjerenja po česticama, a
 * pregledniku idu samo zbrojevi iz izracun.ts.
 */
import { readFile } from "fs/promises";
import path from "path";

import { GODINE, type Godina } from "./model";
import {
  izracunajGodinu,
  komadIzNiza,
  ostaciGodine,
  POLJA_KOMADA,
  type Komad,
  type RezultatKlase,
  type RucnaVrsta,
  type Susjedi,
  type UlazGodine,
} from "./izracun";
import type { Pravila } from "./pravila";
import { najmanjaCestica, uvjetiGradnje, VRSTA_ZA_KLASU, type NajmanjaCestica, type TablicaGradnje, type TablicaPpmin } from "./odredbe";
import { KLASA_PO_INDEKSU, KLASE } from "./model";
import { planskiRezim, type Rezim } from "./rezim";

export interface PlanGodine {
  id: string;
  godina: number;
  naziv: string;
  napomena: string;
}

export interface SirovaMjerenja {
  piksel_m2: number;
  komad_polja: string[];
  planovi: PlanGodine[];
  cestice: {
    ko_imena: string[];
    ko: number[];
    broj: string[];
    povrsina: number[];
    susjedi: Susjedi;
    /** 1-based indeks u `rucno_vrste`, 0 = nema ručnog ispravka */
    rucno?: number[];
  };
  rucno_vrste?: RucnaVrsta[];
  godine: Record<
    string,
    {
      id: string;
      klase_px: Record<string, number>;
      komadi: number[];
      urbano_pravilo: number[];
      /** Bitovi planskog režima po čestici (rezim.ts, REZIM); nema u starijim izvozima. */
      planski_rezim?: number[];
    }
  >;
  /** Kodovi urbanih pravila; `urbano_pravilo[i]` je 1-based indeks ovdje (0 = nema). */
  urbana_pravila_kodovi: string[];
  izvori: Record<string, string>;
}

const PUT = path.join(process.cwd(), "data", "gup-grad", "cestice.json");
const PUT_PPMIN = path.join(process.cwd(), "data", "gup-grad", "odredbe", "ppmin.json");
const PUT_GRADNJA = path.join(process.cwd(), "data", "gup-grad", "odredbe", "gradnja.json");

let predmemorija: Promise<SirovaMjerenja> | null = null;

export function ucitajMjerenja(): Promise<SirovaMjerenja> {
  predmemorija ??= readFile(PUT, "utf8").then((t) => {
    const d = JSON.parse(t) as SirovaMjerenja;
    if (d.komad_polja.join() !== POLJA_KOMADA.join()) {
      throw new Error(`cestice.json: neočekivana polja komada ${d.komad_polja.join()}`);
    }
    return d;
  });
  return predmemorija;
}

/** Komadi jedne godine iz ravnog niza (POLJA_KOMADA.length brojeva po komadu). */
export function komadiGodine(d: SirovaMjerenja, godina: Godina): Komad[] {
  const a = d.godine[String(godina)]?.komadi ?? [];
  const w = POLJA_KOMADA.length;
  const out: Komad[] = [];
  for (let i = 0; i + w - 1 < a.length; i += w) {
    const k = komadIzNiza(a, i);
    const r = d.cestice.rucno?.[k.cestica!] ?? 0;
    if (r > 0 && d.rucno_vrste) k.rucno = d.rucno_vrste[r - 1];
    out.push(k);
  }
  return out;
}

let predmemorijaPpmin: Promise<TablicaPpmin> | null = null;

/** Tablica najmanjih građevnih čestica iz odredbi (scripts/gup-grad/odredbe.py). */
export function ucitajPpmin(): Promise<TablicaPpmin> {
  predmemorijaPpmin ??= readFile(PUT_PPMIN, "utf8").then((t) => JSON.parse(t) as TablicaPpmin);
  return predmemorijaPpmin;
}

let predmemorijaGradnja: Promise<TablicaGradnje> | null = null;

/** Što odredbe dopuštaju graditi po području urbanog pravila (scripts/gup-grad/odredbe.py). */
export function ucitajGradnju(): Promise<TablicaGradnje> {
  predmemorijaGradnja ??= readFile(PUT_GRADNJA, "utf8").then((t) => JSON.parse(t) as TablicaGradnje);
  return predmemorijaGradnja;
}

export interface Odredbe {
  ppmin: TablicaPpmin;
  gradnja: TablicaGradnje;
}

export async function ucitajOdredbe(): Promise<Odredbe> {
  const [ppmin, gradnja] = await Promise.all([ucitajPpmin(), ucitajGradnju()]);
  return { ppmin, gradnja };
}

/** Planski režim čestice u godini plana (rezim.ts). */
export function rezimCestice(d: SirovaMjerenja, g: Godina, cestica: number): Rezim {
  const bitovi = d.godine[String(g)]?.planski_rezim?.[cestica] ?? 0;
  return planskiRezim(bitovi, g, kodPravila(d, g, cestica));
}

/** Kod urbanog pravila čestice u godini plana, ili null. */
export function kodPravila(d: SirovaMjerenja, g: Godina, cestica: number): string | null {
  const i = d.godine[String(g)]?.urbano_pravilo?.[cestica] ?? 0;
  return i > 0 ? d.urbana_pravila_kodovi[i - 1] : null;
}

export function ulazGodine(d: SirovaMjerenja, g: Godina, p: Pravila, o: Odredbe): UlazGodine {
  const klasePx = Object.fromEntries(
    Object.entries(d.godine[String(g)]?.klase_px ?? {}).map(([k, v]) => [Number(k), v]),
  );
  const pikselM2 = d.piksel_m2;
  const uvjeti = (k: Komad) => {
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    if (!kl || k.cestica === undefined) return { najmanjaPx: 0, kig: null, kis: null, novaGradnja: true, pikselM2 };
    const kod = kodPravila(d, g, k.cestica);
    const ug = uvjetiGradnje(o.gradnja, g, kod, kl.kod, p);
    return {
      najmanjaPx: (najmanjaCestica(o.ppmin, g, kod, kl.kod, p)?.m2 ?? 0) / pikselM2,
      kig: ug.kig,
      kis: ug.kis,
      novaGradnja: ug.novaGradnja,
      rezim: rezimCestice(d, g, k.cestica).rezim,
      pikselM2,
    };
  };
  return { klasePx, komadi: komadiGodine(d, g), pikselM2, susjedi: d.cestice.susjedi, uvjeti };
}

export function izracunaj(d: SirovaMjerenja, p: Pravila, o: Odredbe): Record<Godina, RezultatKlase[]> {
  const out = {} as Record<Godina, RezultatKlase[]>;
  for (const g of GODINE) out[g] = izracunajGodinu(ulazGodine(d, g, p, o), p);
  return out;
}

/** Ostaci i posuđene okućnice godine za kartu provjere (izracun.ts, `ostaciGodine`). */
export function ostaci(d: SirovaMjerenja, g: Godina, p: Pravila, o: Odredbe) {
  return ostaciGodine(ulazGodine(d, g, p, o), p);
}

/** Što odredbe dopuštaju graditi u području urbanog pravila (za stambene i mješovite zone), za kartu. */
export interface GradnjaKarte {
  novaGradnja: boolean;
  kig: number | null;
  kis: number | null;
  nova_stambena: string;
  izvor: string;
  citat: string;
}

/**
 * Odredbe jedne godine plana kako ih trebaju karte: najmanja građevna čestica
 * po području urbanog pravila i vrsti (stanovanje, gospodarska, javna) i što
 * se ondje smije graditi — izabrano po istim pravilima kao /gup.
 */
export function odredbeZaKartu(
  o: Odredbe,
  godina: Godina,
  p: Pravila,
): { ppmin: Record<string, Partial<Record<string, NajmanjaCestica>>>; gradnja: Record<string, GradnjaKarte> } {
  const ppmin: Record<string, Partial<Record<string, NajmanjaCestica>>> = {};
  for (const kod of Object.keys(o.ppmin.godine[String(godina)] ?? {})) {
    for (const kl of KLASE) {
      const vrsta = VRSTA_ZA_KLASU[kl.kod];
      if (!vrsta) continue;
      const n = najmanjaCestica(o.ppmin, godina, kod, kl.kod, p);
      if (n) (ppmin[kod] ??= {})[vrsta] = n;
    }
  }
  const gradnja: Record<string, GradnjaKarte> = {};
  for (const kod of Object.keys(o.gradnja.godine[String(godina)] ?? {})) {
    const u = uvjetiGradnje(o.gradnja, godina, kod, "S", p);
    if (u.pravilo) {
      gradnja[kod] = {
        novaGradnja: u.novaGradnja,
        kig: u.kig,
        kis: u.kis,
        nova_stambena: u.pravilo.nova_stambena,
        izvor: u.pravilo.izvor,
        citat: u.pravilo.citat,
      };
    }
  }
  return { ppmin, gradnja };
}
