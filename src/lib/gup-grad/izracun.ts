/**
 * Izračun površina po namjeni GUP-a: ukupno, iskorišteno, u skladu s
 * planom i u suprotnosti s njim.
 *
 * Čiste funkcije bez I/O-a: ulaz su mjerenja iz data/gup-grad/cestice.json
 * (vidi podaci.ts) i pravila (pravila.ts). Sve odluke o tome što se broji
 * žive u pravilima; ovdje je samo aritmetika nad komadima čestica.
 */
import { KLASE, KLASA_PO_INDEKSU, type Godina, type KodKlase } from "./model";
import type { Pravila, VrstaKoristenja } from "./pravila";

/** Jedan komad čestice (dio čestice u jednoj klasi), u pikselima. */
export interface Komad {
  klasa: number;
  /** površina komada */
  n: number;
  /** pod zgradom iz katastra */
  zk: number;
  /** pod zgradom iz gradskog 3D modela (Objekti_Split_2025) */
  z25: number;
  /** pod prometnom površinom */
  pr: number;
  /** pod grobljem ili športskim objektom */
  os: number;
  /** pod održavanim javnim zelenilom */
  ze: number;
  /** pretežita skupina katastarske zgrade (0 = nema) */
  g: number;
}

export interface Procjena {
  n: number;
  iskoristeno: number;
  uSkladu: number;
  uSuprotnosti: number;
  poVrsti: Partial<Record<VrstaKoristenja, number>>;
}

const VRSTA_ZGRADE: Record<number, VrstaKoristenja> = {
  1: "stambena",
  2: "gospodarska",
  3: "javna",
  4: "pomocna",
  5: "ostala",
};

/** Što na komadu stoji, bez preklapanja: redom zgrade, promet, uređeno, zelenilo. */
export function pokrivenost(k: Komad, p: Pravila): [VrstaKoristenja, number][] {
  const dijelovi: [VrstaKoristenja, number][] = [];
  let slobodno = k.n;
  const dodaj = (vrsta: VrstaKoristenja, px: number) => {
    const v = Math.min(Math.max(px, 0), slobodno);
    if (v <= 0) return;
    slobodno -= v;
    const i = dijelovi.findIndex(([x]) => x === vrsta);
    if (i >= 0) dijelovi[i][1] += v;
    else dijelovi.push([vrsta, v]);
  };

  if (p.racunaj.zgrade) {
    // Katastar zna vrstu zgrade, 3D model zna koliko je stvarno sagrađeno.
    const upisano = p.zgrade === "model3d" ? Math.min(k.zk, k.z25) : k.zk;
    const neupisano = p.zgrade === "katastar" ? 0 : Math.max(0, k.z25 - k.zk);
    // Katastarska zgrada bez pretežite skupine ne postoji (g > 0 kad je
    // zk > 0), ali krhotina na rubu može imati zk > 0 i g = 0.
    dodaj(VRSTA_ZGRADE[k.g] ?? "ostala", upisano);
    dodaj("neevidentirana", neupisano);
  }
  if (p.racunaj.promet) dodaj("promet", k.pr);
  if (p.racunaj.uredjeno) dodaj("uredjeno", k.os);
  if (p.racunaj.zelenilo) dodaj("zelenilo", k.ze);
  return dijelovi;
}

export function procijeniKomad(k: Komad, kod: KodKlase, p: Pravila): Procjena {
  const dijelovi = pokrivenost(k, p);
  const pokriveno = dijelovi.reduce((s, [, v]) => s + v, 0);
  const udio = k.n > 0 ? pokriveno / k.n : 0;

  let mnozitelj = 1;
  if (pokriveno > 0) {
    const cijeli =
      (p.nacin === "prag" && udio >= p.prag) ||
      (p.nacin === "cijela" && udio >= p.najmanjiTrag);
    if (cijeli) mnozitelj = k.n / pokriveno;
  }

  const dopusteno = p.dopusteno[kod];
  const out: Procjena = { n: k.n, iskoristeno: 0, uSkladu: 0, uSuprotnosti: 0, poVrsti: {} };
  for (const [vrsta, v] of dijelovi) {
    const px = v * mnozitelj;
    out.iskoristeno += px;
    out.poVrsti[vrsta] = (out.poVrsti[vrsta] ?? 0) + px;
    if (dopusteno.includes(vrsta)) out.uSkladu += px;
    else out.uSuprotnosti += px;
  }
  return out;
}

export interface RezultatKlase {
  kod: KodKlase;
  ukupnoM2: number;
  iskoristenoM2: number;
  uSkladuM2: number;
  uSuprotnostiM2: number;
  /** Iskorišteno po vrsti — za opis u tooltipu. */
  poVrstiM2: Partial<Record<VrstaKoristenja, number>>;
  /** Samo dio u suprotnosti, po vrsti. */
  suprotnoPoVrstiM2: Partial<Record<VrstaKoristenja, number>>;
}

export interface UlazGodine {
  /** Površina svake klase u obuhvatu, u pikselima (i izvan čestica). */
  klasePx: Record<number, number>;
  komadi: Iterable<Komad>;
  pikselM2: number;
}

export function izracunajGodinu(ulaz: UlazGodine, p: Pravila): RezultatKlase[] {
  const po = new Map<number, RezultatKlase>();
  for (const kl of KLASE) {
    po.set(kl.indeks, {
      kod: kl.kod,
      ukupnoM2: (ulaz.klasePx[kl.indeks] ?? 0) * ulaz.pikselM2,
      iskoristenoM2: 0,
      uSkladuM2: 0,
      uSuprotnostiM2: 0,
      poVrstiM2: {},
      suprotnoPoVrstiM2: {},
    });
  }
  for (const k of ulaz.komadi) {
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    const r = po.get(k.klasa);
    if (!kl || !r) continue;
    const pr = procijeniKomad(k, kl.kod, p);
    const m2 = ulaz.pikselM2;
    r.iskoristenoM2 += pr.iskoristeno * m2;
    r.uSkladuM2 += pr.uSkladu * m2;
    r.uSuprotnostiM2 += pr.uSuprotnosti * m2;
    for (const [vrsta, v] of Object.entries(pr.poVrsti) as [VrstaKoristenja, number][]) {
      r.poVrstiM2[vrsta] = (r.poVrstiM2[vrsta] ?? 0) + v * m2;
      if (!p.dopusteno[kl.kod].includes(vrsta)) {
        r.suprotnoPoVrstiM2[vrsta] = (r.suprotnoPoVrstiM2[vrsta] ?? 0) + v * m2;
      }
    }
  }
  // Komadi su izrezani čestičnom rešetkom, a ukupno klasom iz obuhvata;
  // na rubu obuhvata iskorišteno smije premašiti ukupno za piksel-dva.
  for (const r of po.values()) {
    if (r.iskoristenoM2 > r.ukupnoM2) {
      const f = r.ukupnoM2 / r.iskoristenoM2;
      r.iskoristenoM2 = r.ukupnoM2;
      r.uSkladuM2 *= f;
      r.uSuprotnostiM2 *= f;
    }
  }
  return [...po.values()].filter((r) => r.ukupnoM2 > 0);
}

export type RezultatiPoGodini = Record<Godina, RezultatKlase[]>;
