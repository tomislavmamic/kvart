/**
 * Satna mjerenja s postaja na Karepovcu, za vremensku crtu simulatora.
 *
 * Zavod za javno zdravstvo SDŽ objavljuje satne tablice mjesec po mjesec, na
 * `zrak-zavod-split.info`. Isti izvor iz kojega `scripts/postaje.py` slaže
 * dvogodišnji niz za bazdarenje; ovdje se čita samo tekući mjesec, jer
 * simulator gleda unatrag 24 sata.
 *
 * Oblik tablice, i zamke u njemu:
 *
 * - `datum` je `dd.mm.gggg`, `sat` je **kraj** sata: `1:00` znači 00–01 h.
 * - Vrijeme je mjesno (Europe/Zagreb), pa se pretvara u UTC.
 * - `< 0,1` znači ispod granice određivanja; uzima se polovica granice.
 * - `-` znači da uređaj nije radio — i to ostaje `null`, ne nula.
 * - Postaje ne slažu redke istim redoslijedom: k1 piše najnoviji sat prvi,
 *   k2 najstariji. Zato se ne smije uzeti „zadnji redak” nego se traži po
 *   vremenu.
 *
 * Podatci su nevalidirani, automatski objavljeni — Zavod ih naknadno provjeri
 * i objavi u godišnjem izvješću. Prikaz ih zato tako i označuje.
 */

/** Postaje i tvar koju svaka od njih nosi u simulatoru. */
export const SIM_POSTAJE = [
  {
    oznaka: "k1",
    naziv: "Karepovac 1",
    opis: "jugoistočni rub plohe",
    lat: 43.516,
    lon: 16.517,
    tvar: "sumporovodik",
    /** Ime stupca u tablici Zavoda. */
    stupac: "H2S",
    jedinica: "µg/m³",
  },
  {
    oznaka: "k2",
    naziv: "Karepovac 2",
    opis: "južna strana plohe",
    lat: 43.516,
    lon: 16.517,
    tvar: "merkaptani",
    stupac: "metil+etilmerkaptan",
    jedinica: "µg/m³",
  },
] as const;

export type SimPostaja = (typeof SIM_POSTAJE)[number];
export type OznakaPostaje = SimPostaja["oznaka"];

/** Udio granice određivanja koji se pripisuje nalazu „< granica”. */
const UDIO_ISPOD_GRANICE = 0.5;

export type Ocitanje = {
  /** Početak sata na koji se odnosi, puni ISO 8601 u UTC-u. */
  readonly sat: string;
  /** Izmjereno, u µg/m³; `null` kad uređaj nije radio. */
  readonly vrijednost: number | null;
  /** Nalaz je bio ispod granice određivanja. */
  readonly ispodGranice: boolean;
};

const BROJ = /^-?\d+(?:[.,]\d+)?$/;
const ISPOD = /^<\s*(\d+(?:[.,]\d+)?)$/;
const DATUM = /^\d{2}\.\d{2}\.\d{4}$/;

/**
 * Pretvara jednu ćeliju tablice u broj.
 *
 * Args:
 *   tekst: Sadržaj ćelije.
 *
 * Returns:
 *   Par (vrijednost, je li nalaz bio ispod granice određivanja).
 */
export function celija(tekst: string): [number | null, boolean] {
  const t = tekst.trim().replace(/ /g, " ");
  if (BROJ.test(t)) return [Number(t.replace(",", ".")), false];
  const ispod = ISPOD.exec(t);
  if (ispod) return [Number(ispod[1].replace(",", ".")) * UDIO_ISPOD_GRANICE, true];
  return [null, false];
}

/** Razlaže HTML tablicu na redke gole od oznaka. */
function redci(html: string): string[][] {
  const izlaz: string[][] = [];
  for (const red of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const celije = (red.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
      c
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim(),
    );
    if (celije.length) izlaz.push(celije);
  }
  return izlaz;
}

/**
 * Nalazi UTC trenutak koji u Splitu pokazuje zadani dan i sat.
 *
 * Zavod piše mjesno vrijeme bez oznake zone, a razlika prema UTC-u ovisi o
 * dobu godine. Umjesto računanja ljetnog vremena traži se pomak koji mjesno
 * ispadne baš tako — po istom kalendaru kojim se ionako ispisuje stranica.
 *
 * Args:
 *   dan: Zapis „21.08.2026”.
 *   sat: Sat u mjesnom vremenu, 0–23; početak razdoblja.
 *
 * Returns:
 *   Početak sata u UTC-u, ili ništa ako zapis nije valjan.
 */
export function uUtc(dan: string, sat: number): Date | null {
  const [d, m, g] = dan.split(".").map(Number);
  if (!d || !m || !g || !Number.isInteger(sat)) return null;
  const kalendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const trazeno = `${g}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // Split je UTC+1 ili UTC+2; oba pomaka se probaju, a bira se onaj koji
  // mjesno doista pokaže traženi sat.
  for (const pomak of [1, 2]) {
    const kad = new Date(Date.UTC(g, m - 1, d, sat - pomak));
    const dijelovi = kalendar.formatToParts(kad);
    const dio = (tip: string) => dijelovi.find((x) => x.type === tip)?.value ?? "";
    const mjesno = `${dio("year")}-${dio("month")}-${dio("day")}`;
    if (mjesno === trazeno && Number(dio("hour")) === sat) return kad;
  }
  return null;
}

/**
 * Čita satni niz jedne tvari iz mjesečne tablice.
 *
 * Args:
 *   html: Sadržaj `k1Tab202608.html` ili slične stranice.
 *   stupac: Ime stupca kako stoji u zaglavlju tablice.
 *
 * Returns:
 *   Očitanja po satu, poredana po vremenu; sat bez podatka ima `null`.
 */
export function procitajTablicu(html: unknown, stupac: string): Ocitanje[] {
  if (typeof html !== "string") return [];
  const sve = redci(html);
  if (!sve.length) return [];

  // Zaglavlje je prvi redak; prva dva stupca su datum i sat.
  const zaglavlje = sve[0];
  const kojiStupac = zaglavlje.indexOf(stupac);
  if (kojiStupac < 2) return [];

  const poSatu = new Map<string, Ocitanje>();
  for (const red of sve.slice(1)) {
    if (red.length <= kojiStupac || !DATUM.test(red[0])) continue;
    // „1:00” je kraj sata, dakle razdoblje 00–01 h; „24:00” je 23–24 h.
    const kraj = Number(red[1].split(":")[0]);
    if (!Number.isFinite(kraj) || kraj < 1 || kraj > 24) continue;
    const kad = uUtc(red[0], kraj - 1);
    if (!kad) continue;
    const [vrijednost, ispodGranice] = celija(red[kojiStupac]);
    const sat = kad.toISOString();
    poSatu.set(sat, { sat, vrijednost, ispodGranice });
  }
  return [...poSatu.values()].sort((a, b) => a.sat.localeCompare(b.sat));
}

/** Adresa mjesečne tablice jedne postaje. */
export function adresaTablice(oznaka: OznakaPostaje, mjesec: string): string {
  return `http://www.zrak-zavod-split.info/${oznaka}Tab${mjesec}.html`;
}

/**
 * Mjeseci koje treba dohvatiti da bi razdoblje bilo pokriveno.
 *
 * Na prijelazu mjeseca zadnja 24 sata leže u dvama mjesecima, pa se traže oba.
 *
 * Args:
 *   od: Početak razdoblja.
 *   do_: Kraj razdoblja.
 *
 * Returns:
 *   Mjeseci u obliku `GGGGMM`, rastuće; mjesno vrijeme, jer su tablice takve.
 */
export function mjeseci(od: Date, do_: Date): string[] {
  const kalendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
  });
  const skup = new Set<string>();
  for (const kad of [od, do_]) {
    const dijelovi = kalendar.formatToParts(kad);
    const dio = (tip: string) => dijelovi.find((x) => x.type === tip)?.value ?? "";
    skup.add(`${dio("year")}${dio("month")}`);
  }
  return [...skup].sort();
}
