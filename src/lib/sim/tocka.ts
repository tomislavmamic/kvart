/**
 * Situacija u jednoj točki karte — „što model kaže za moje dvorište”.
 *
 * Kartica situacije govori o naseljima; ova govori o mjestu na koje je
 * netko kliknuo. Račun je isti (`ocijeniPodrucja`, `izvediSituaciju`), samo
 * je „područje” krug od 200 m oko točke: manje bi bilo jedna ćelija (32 m)
 * i šum čestica, više bi već bilo susjedstvo, a ne mjesto. Riječi razina,
 * trenda i pouzdanosti su iste kao na kartici naselja, da čovjek ne uči
 * dva rječnika.
 *
 * Točka se ne pamti nigdje osim u adresi (`?t=lat,lng`), da se dade
 * podijeliti; obrazac za dojavu je dobiva istim brojevima.
 */

import {
  izvediSituaciju,
  ocijeniPodrucja,
  PODRUCJA,
  type Podrucje,
  type Razina,
  type Situacija,
  type SusjedniSat,
  type UlazSituacije,
} from "@/lib/sim/situacija";

/** Polumjer kruga oko točke, u metrima. */
export const POLUMJER_TOCKE_M = 200;

/** Do koje se udaljenosti točka imenuje po najbližem naselju. */
const BLIZU_NASELJA_M = 700;

export type Tocka = { readonly lat: number; readonly lng: number };

/** Metara između dviju točaka, ravninski; dovoljno za nekoliko kilometara. */
export function udaljenostM(a: Tocka, b: { lat: number; lon: number }): number {
  const dy = (b.lat - a.lat) * 110_574;
  const dx = (b.lon - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/**
 * Ime mjesta za točku: najbliže naselje ako je blizu, inače smjer i
 * udaljenost od plohe.
 *
 * Args:
 *   tocka: Kliknuto mjesto.
 *   ploha: Težište plohe.
 *
 * Returns:
 *   Kratak natpis, npr. „kod Dračevca” ili „1,3 km sjeverozapadno od plohe”.
 */
export function imeTocke(tocka: Tocka, ploha: { lat: number; lon: number }): string {
  let najblize: Podrucje | null = null;
  let najmanje = Number.POSITIVE_INFINITY;
  for (const p of PODRUCJA) {
    const d = udaljenostM(tocka, p);
    if (d < najmanje) {
      najmanje = d;
      najblize = p;
    }
  }
  if (najblize && najmanje <= BLIZU_NASELJA_M) return `kod naselja ${najblize.naziv}`;
  const d = udaljenostM(tocka, ploha);
  const dy = (tocka.lat - ploha.lat) * 110_574;
  const dx = (tocka.lng - ploha.lon) * 111_320 * Math.cos((tocka.lat * Math.PI) / 180);
  const azimut = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  const strane = ["sjeverno", "sjeveroistočno", "istočno", "jugoistočno", "južno", "jugozapadno", "zapadno", "sjeverozapadno"];
  const strana = strane[Math.round(azimut / 45) % 8];
  const km = d >= 950 ? `${(d / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(d / 50) * 50} m`;
  return `${km} ${strana} od plohe`;
}

/** Točka kao područje za `ocijeniPodrucja`. */
export function tockaKaoPodrucje(tocka: Tocka): Podrucje {
  return { id: "tocka", naziv: "odabrano mjesto", lat: tocka.lat, lon: tocka.lng, polumjerM: POLUMJER_TOCKE_M };
}

/**
 * Razina u točki za jednu sliku sata.
 *
 * Args:
 *   slika: Bajtovi gustoće sata.
 *   granice: Okvir slike.
 *   tvar: Tvar koja se gleda.
 *   jacina: Jačina izvora.
 *   tocka: Kliknuto mjesto.
 *
 * Returns:
 *   Razina; `nema` i kad je točka izvan okvira polja.
 */
export function razinaUTocki(
  slika: UlazSituacije["slika"],
  granice: UlazSituacije["granice"],
  tvar: UlazSituacije["tvar"],
  jacina: number,
  tocka: Tocka,
): Razina {
  if (!slika) return "nema";
  return ocijeniPodrucja(slika, granice, tvar, jacina, [tockaKaoPodrucje(tocka)])[0]?.razina ?? "nema";
}

/**
 * Situacija u točki: isti sažetak kao za naselja, samo s jednim područjem.
 *
 * Args:
 *   ulaz: Sve što i `izvediSituaciju`, bez `podrucja`; susjedni sati moraju
 *     nositi razinu **u točki**, ne nad naseljima.
 *   tocka: Kliknuto mjesto.
 *
 * Returns:
 *   Situacija čija `razina` i `podrucja[0]` govore o točki.
 */
export function izvediTocku(ulaz: Omit<UlazSituacije, "podrucja">, tocka: Tocka): Situacija {
  return izvediSituaciju({ ...ulaz, podrucja: [tockaKaoPodrucje(tocka)] });
}

/**
 * Adresa obrasca za dojavu s mjestom već upisanim.
 *
 * Args:
 *   tocka: Kliknuto mjesto.
 *   sat: Sat koji gledatelj gleda, puni ISO 8601; obrazac ga smije uzeti
 *     kao vrijeme dojave, jer dojava opisuje ono što je na karti.
 */
export function adresaDojave(tocka: Tocka, sat?: string): string {
  const z = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
  const osnova = `/karepovac/dojava?lat=${z(tocka.lat)}&lng=${z(tocka.lng)}`;
  return sat ? `${osnova}&sat=${encodeURIComponent(sat)}` : osnova;
}

/** Adresa obrasca za dojavu bez mjesta, samo sa satom s karte. */
export function adresaDojaveZaSat(sat: string): string {
  return `/karepovac/dojava?sat=${encodeURIComponent(sat)}`;
}

/** Točka iz adrese (`t=lat,lng`), ili ništa. */
export function tockaIzAdrese(vrijednost: string | null): Tocka | null {
  if (!vrijednost) return null;
  const [a, b] = vrijednost.split(",").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
}

export type { SusjedniSat };
