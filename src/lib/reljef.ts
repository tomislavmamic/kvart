/**
 * Očitanje reljefa iz mreže visina koju izrađuje scripts/izvedi-reljef.py.
 *
 * Mreža je `int16` u decimetrima, u pravilnoj lon/lat mreži po MAP_MAX_BOUNDS,
 * s korakom ~3 m (vidi zaglavlje u public/geo/reljef/visine.json). Zapisana je
 * gzipana — 4,0 MB sirovo, 1,6 MB na disku — i raspakira se jednom po procesu,
 * isto kao GeoJSON slojevi dosjea.
 *
 * Zašto ne WCS po kliku: DGU-ov servis vraća 50 MB za prozor kvarta i traži
 * 22 s. Zašto ne 1 m: nagib računat na sirovom LiDAR-u mjeri šum snimke, a ne
 * teren — korak od 3 m je izbor, ne ušteda.
 *
 * Sve funkcije upita primaju mrežu kao argument i ne diraju disk, pa se mogu
 * ispitati nad izmišljenom mrežom (vidi tests/reljef.test.ts). Datoteku čita
 * samo `ucitajMrezu()`.
 */
import { readFile } from "fs/promises";
import { gunzipSync } from "zlib";
import path from "path";
import type { Feature, Position } from "geojson";
import { bbox as turfBbox, booleanPointInPolygon } from "@turf/turf";
import type { Strana, Teren } from "./reljef-oblik";

export type { Strana, Teren } from "./reljef-oblik";

const RELJEF = path.join(process.cwd(), "public", "geo", "reljef");

/** Vrijednost kojom skripta označava ćeliju bez izmjerene visine. */
const PRAZNO = -32768;

/**
 * Ispod ovog nagiba se strana svijeta ne izriče.
 *
 * Na ravnom smjer pada određuje šum mjerenja, pa bi „pada prema jugoistoku”
 * bila tvrdnja o zaokruživanju, ne o terenu. Prag od 2 % je otprilike
 * razlika od 6 cm preko jedne ćelije od 3 m — ispod praga same izmjere.
 */
const NAGIB_BEZ_STRANE = 2;

/** Koliko se ćelija najviše očitava kad se mjeri raspon preko čestice. */
const MAX_CELIJA_CESTICE = 20_000;

export interface MrezaZaglavlje {
  zapad: number;
  jug: number;
  istok: number;
  sjever: number;
  stupaca: number;
  redaka: number;
  prviRedakJe: "sjever";
  jedinica: "dm";
  prazno: number;
  korakM: number;
  izvor: string;
}

export interface Mreza {
  zaglavlje: MrezaZaglavlje;
  /** Redak po redak, od sjevera prema jugu; duljina = stupaca × redaka. */
  podaci: Int16Array;
}

/**
 * Korak mreže u metrima po osi.
 *
 * Vodoravni korak ovisi o zemljopisnoj širini, okomiti ne. Na 43,5° je
 * razlika oko 27 %, pa bi jedan korak za obje osi izobličio nagib za
 * četvrtinu — a nagib je ovdje broj koji netko čita, ne ukras.
 */
export function korakMetara(z: MrezaZaglavlje): { x: number; y: number } {
  const sredina = ((z.jug + z.sjever) / 2) * (Math.PI / 180);
  const dLon = (z.istok - z.zapad) / z.stupaca;
  const dLat = (z.sjever - z.jug) / z.redaka;
  return {
    x: dLon * 111_320 * Math.cos(sredina),
    y: dLat * 110_540,
  };
}

/**
 * Visina u pojedinoj ćeliji.
 *
 * Args:
 *   mreza: Učitana mreža.
 *   red: Redak, 0 = najsjeverniji.
 *   stupac: Stupac, 0 = najzapadniji.
 *
 * Returns:
 *   Visina u metrima ili `null` izvan mreže i na praznim ćelijama.
 */
export function celija(mreza: Mreza, red: number, stupac: number): number | null {
  const { stupaca, redaka } = mreza.zaglavlje;
  if (red < 0 || red >= redaka || stupac < 0 || stupac >= stupaca) return null;
  const v = mreza.podaci[red * stupaca + stupac];
  return v === PRAZNO ? null : v / 10;
}

/** Razlomljeni položaj točke u mreži, mjeren u središtima ćelija. */
function polozaj(z: MrezaZaglavlje, lon: number, lat: number) {
  const dLon = (z.istok - z.zapad) / z.stupaca;
  const dLat = (z.sjever - z.jug) / z.redaka;
  return {
    x: (lon - z.zapad) / dLon - 0.5,
    y: (z.sjever - lat) / dLat - 0.5,
  };
}

/**
 * Visina u točki, bilinearno između četiri susjedne ćelije.
 *
 * Bez interpolacije bi visina preskakala po 3 m široj stepenici, pa bi dva
 * klika unutar iste čestice znala dati razliku od pola metra bez ikakvog
 * terena između njih.
 *
 * Args:
 *   mreza: Učitana mreža.
 *   lon: Zemljopisna dužina.
 *   lat: Zemljopisna širina.
 *
 * Returns:
 *   Visina u metrima ili `null` izvan obuhvata / nad praznim ćelijama.
 */
export function visinaUTocki(
  mreza: Mreza,
  lon: number,
  lat: number,
): number | null {
  const { x, y } = polozaj(mreza.zaglavlje, lon, lat);
  const c0 = Math.floor(x);
  const r0 = Math.floor(y);
  const fx = x - c0;
  const fy = y - r0;

  const a = celija(mreza, r0, c0);
  const b = celija(mreza, r0, c0 + 1);
  const c = celija(mreza, r0 + 1, c0);
  const d = celija(mreza, r0 + 1, c0 + 1);
  // Na rubu mreže i uz prazninu susjed nedostaje. Ondje se ne izmišlja
  // nastavak nego se uzima najbliža izmjerena ćelija.
  if (a === null || b === null || c === null || d === null) {
    return celija(mreza, Math.round(y), Math.round(x));
  }
  const gore = a + (b - a) * fx;
  const dolje = c + (d - c) * fx;
  return gore + (dolje - gore) * fy;
}

/**
 * Nagib i strana svijeta u koju teren pada.
 *
 * Središnja razlika preko susjednih ćelija — isti postupak kao `gdaldem
 * slope`, samo na ovoj mreži. Vraća `null` kad nedostaje ijedan od četiri
 * susjeda, jer je nagib računat preko ruba mreže izmišljen.
 */
export function nagibUTocki(
  mreza: Mreza,
  lon: number,
  lat: number,
): { nagib: number; ekspozicija: Strana | null } | null {
  const { x, y } = polozaj(mreza.zaglavlje, lon, lat);
  const c = Math.round(x);
  const r = Math.round(y);
  const zapad = celija(mreza, r, c - 1);
  const istok = celija(mreza, r, c + 1);
  const sjever = celija(mreza, r - 1, c);
  const jug = celija(mreza, r + 1, c);
  if (zapad === null || istok === null || sjever === null || jug === null)
    return null;

  const korak = korakMetara(mreza.zaglavlje);
  // Prema istoku i prema sjeveru raste; pad je suprotan predznak.
  const dzdx = (istok - zapad) / (2 * korak.x);
  const dzdy = (sjever - jug) / (2 * korak.y);
  const nagib = Math.hypot(dzdx, dzdy) * 100;
  return {
    nagib: Math.round(nagib * 10) / 10,
    ekspozicija: nagib < NAGIB_BEZ_STRANE ? null : strana(-dzdx, -dzdy),
  };
}

/** Smjer pada u stranu svijeta; `x` je prema istoku, `y` prema sjeveru. */
function strana(x: number, y: number): Strana {
  const stupnjeva = (Math.atan2(x, y) * 180) / Math.PI;
  const normirano = ((stupnjeva % 360) + 360) % 360;
  const strane: Strana[] = ["S", "SI", "I", "JI", "J", "JZ", "Z", "SZ"];
  return strane[Math.round(normirano / 45) % 8];
}

/**
 * Raspon visina preko plohe čestice.
 *
 * Prolazi ćelije unutar okvira i zadržava one koje padnu u sam poligon —
 * okvir bi kod kose čestice uhvatio i susjedni usjek. Vrlo velika ploha se
 * uzorkuje s korakom, jer dosje čeka jedan klik, a ne potpuni popis.
 */
export function rasponCestice(
  mreza: Mreza,
  cestica: Feature,
): { najniza: number; najvisa: number } | null {
  const [zapad, jug, istok, sjever] = turfBbox(cestica) as [
    number,
    number,
    number,
    number,
  ];
  const z = mreza.zaglavlje;
  const dLon = (z.istok - z.zapad) / z.stupaca;
  const dLat = (z.sjever - z.jug) / z.redaka;

  const c0 = Math.max(0, Math.floor((zapad - z.zapad) / dLon));
  const c1 = Math.min(z.stupaca - 1, Math.ceil((istok - z.zapad) / dLon));
  const r0 = Math.max(0, Math.floor((z.sjever - sjever) / dLat));
  const r1 = Math.min(z.redaka - 1, Math.ceil((z.sjever - jug) / dLat));
  if (c1 < c0 || r1 < r0) return null;

  const celija_ukupno = (c1 - c0 + 1) * (r1 - r0 + 1);
  const korak = Math.max(1, Math.ceil(Math.sqrt(celija_ukupno / MAX_CELIJA_CESTICE)));

  let najniza = Infinity;
  let najvisa = -Infinity;
  for (let r = r0; r <= r1; r += korak) {
    for (let c = c0; c <= c1; c += korak) {
      const v = celija(mreza, r, c);
      if (v === null) continue;
      const tocka: Position = [
        z.zapad + (c + 0.5) * dLon,
        z.sjever - (r + 0.5) * dLat,
      ];
      try {
        if (!booleanPointInPolygon(tocka, cestica as Feature<never>)) continue;
      } catch {
        continue; // neispravna geometrija — ploha se preskače
      }
      if (v < najniza) najniza = v;
      if (v > najvisa) najvisa = v;
    }
  }
  if (najniza === Infinity) return null;
  return {
    najniza: Math.round(najniza * 10) / 10,
    najvisa: Math.round(najvisa * 10) / 10,
  };
}

/**
 * Cijeli reljefni nalaz za jedan klik.
 *
 * Args:
 *   mreza: Učitana mreža.
 *   lon: Zemljopisna dužina.
 *   lat: Zemljopisna širina.
 *   cestica: Ploha čestice, ako je klik u nju pao.
 *
 * Returns:
 *   Nalaz ili `null` kad točka nije pokrivena mrežom — odsutnost se izriče,
 *   ne popunjava.
 */
export function terenUTocki(
  mreza: Mreza,
  lon: number,
  lat: number,
  cestica: Feature | null,
): Teren | null {
  const visina = visinaUTocki(mreza, lon, lat);
  if (visina === null) return null;
  const pad = nagibUTocki(mreza, lon, lat);
  return {
    visina: Math.round(visina * 10) / 10,
    nagib: pad?.nagib ?? 0,
    ekspozicija: pad?.ekspozicija ?? null,
    cestica: cestica ? rasponCestice(mreza, cestica) : null,
  };
}

let ucitana: Promise<Mreza | null> | null = null;

/**
 * Čita mrežu s diska i drži je do kraja procesa.
 *
 * Vraća `null` ako datoteka nedostaje — mreža je izlaz skripte koja se ne
 * vrti pri gradnji, pa njezin izostanak ne smije srušiti dosje. Tada se
 * reljef jednostavno ne spominje.
 */
export async function ucitajMrezu(): Promise<Mreza | null> {
  ucitana ??= (async () => {
    try {
      const [zaglavljeTekst, stisnuto] = await Promise.all([
        readFile(path.join(RELJEF, "visine.json"), "utf8"),
        readFile(path.join(RELJEF, "visine.bin.gz")),
      ]);
      const zaglavlje = JSON.parse(zaglavljeTekst) as MrezaZaglavlje;
      const sirovo = gunzipSync(stisnuto);
      const podaci = new Int16Array(
        sirovo.buffer,
        sirovo.byteOffset,
        sirovo.byteLength / 2,
      );
      if (podaci.length !== zaglavlje.stupaca * zaglavlje.redaka) {
        throw new Error(
          `mreža visina ne odgovara zaglavlju: ${podaci.length} ≠ ` +
            `${zaglavlje.stupaca} × ${zaglavlje.redaka}`,
        );
      }
      return { zaglavlje, podaci };
    } catch (e) {
      console.error("Mreža visina nije učitana:", e);
      return null;
    }
  })();
  return ucitana;
}
