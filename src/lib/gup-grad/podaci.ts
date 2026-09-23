/**
 * Čitanje data/gup-grad/cestice.json (piše scripts/gup-grad/cestice.py).
 *
 * Samo na poslužitelju: datoteka ima ~4 MB mjerenja po česticama, a
 * pregledniku idu samo zbrojevi iz izracun.ts.
 */
import { readFile } from "fs/promises";
import path from "path";

import { GODINE, type Godina } from "./model";
import { izracunajGodinu, ostaciGodine, type Komad, type RezultatKlase, type Susjedi, type UlazGodine } from "./izracun";
import type { Pravila } from "./pravila";

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
  cestice: { ko_imena: string[]; ko: number[]; broj: string[]; povrsina: number[]; susjedi: Susjedi };
  godine: Record<string, { id: string; klase_px: Record<string, number>; komadi: number[] }>;
  izvori: Record<string, string>;
}

const PUT = path.join(process.cwd(), "data", "gup-grad", "cestice.json");
const POLJA = ["cestica", "klasa", "n", "zk", "z25", "pr", "os", "ze", "g"];

let predmemorija: Promise<SirovaMjerenja> | null = null;

export function ucitajMjerenja(): Promise<SirovaMjerenja> {
  predmemorija ??= readFile(PUT, "utf8").then((t) => {
    const d = JSON.parse(t) as SirovaMjerenja;
    if (d.komad_polja.join() !== POLJA.join()) {
      throw new Error(`cestice.json: neočekivana polja komada ${d.komad_polja.join()}`);
    }
    return d;
  });
  return predmemorija;
}

/** Komadi jedne godine iz ravnog niza (9 brojeva po komadu). */
export function komadiGodine(d: SirovaMjerenja, godina: Godina): Komad[] {
  const a = d.godine[String(godina)]?.komadi ?? [];
  const out: Komad[] = [];
  for (let i = 0; i + 8 < a.length; i += 9) {
    out.push({
      cestica: a[i],
      klasa: a[i + 1],
      n: a[i + 2],
      zk: a[i + 3],
      z25: a[i + 4],
      pr: a[i + 5],
      os: a[i + 6],
      ze: a[i + 7],
      g: a[i + 8],
    });
  }
  return out;
}

export function ulazGodine(d: SirovaMjerenja, g: Godina): UlazGodine {
  const klasePx = Object.fromEntries(
    Object.entries(d.godine[String(g)]?.klase_px ?? {}).map(([k, v]) => [Number(k), v]),
  );
  return { klasePx, komadi: komadiGodine(d, g), pikselM2: d.piksel_m2, susjedi: d.cestice.susjedi };
}

export function izracunaj(d: SirovaMjerenja, p: Pravila): Record<Godina, RezultatKlase[]> {
  const out = {} as Record<Godina, RezultatKlase[]>;
  for (const g of GODINE) out[g] = izracunajGodinu(ulazGodine(d, g), p);
  return out;
}

/** Ostaci godine za kartu provjere: [čestica, klasa]. */
export function ostaci(d: SirovaMjerenja, g: Godina, p: Pravila): [number, number][] {
  return ostaciGodine(ulazGodine(d, g), p);
}
