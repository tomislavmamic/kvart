/**
 * Satni niz vjetra i dubine miješanog sloja, za cijelu vremensku crtu.
 *
 * `src/lib/vjetar.ts` odgovara na pitanje „kakav je zrak **sada**” i zato uzima
 * samo najnovije očitanje sa svakog izvora. Simulator pita drugo: kakav je bio
 * svakoga od zadnja 24 sata i kakav će biti kroz tri. Za to treba niz, ne točka.
 *
 * Izvori se ne miješaju nasumično nego po istom redoslijedu koji je u
 * `vjetar.ts` već provjeren prema izmjerenom H₂S-u:
 *
 * 1. **AZO, Split-3 pa Split-2** — izmjereni satni niz, za satove unatrag.
 *    Isti izvoz koji `azoAdresa` već gradi vraća cijeli dan, ne samo zadnji sat.
 * 2. **model (Open-Meteo)** — za satove koje mjerenje ne pokriva i za sve
 *    satove unaprijed, jer izmjerene budućnosti nema.
 *
 * Dubina miješanog sloja uvijek je modelska: ne mjeri se nigdje u blizini, pa
 * je i za prošle satove najbolje što postoji.
 *
 * Svaki sat nosi oznaku odakle mu vjetar dolazi. Bez toga bi prognozirani sat
 * na crti izgledao jednako kao izmjeren, a to je jedina razlika koju prikaz ne
 * smije zamutiti.
 */

import type { StanjeZraka } from "@/lib/polje-dima";
import { NEUTRALNO, razredStabilnosti } from "@/lib/sim/stabilnost";
import { POSTAJE, PRETPOSTAVLJENO, type Postaja } from "@/lib/vjetar";

/** Otkud vjetar za pojedini sat. */
export type IzvorVjetra = Postaja | "model";

export type SatniVjetar = {
  /** Početak sata, puni ISO 8601 u UTC-u. */
  readonly sat: string;
  /** Meteorološki smjer iz kojega puše, u stupnjevima. */
  readonly smjerOd: number;
  /** Brzina u m/s. */
  readonly brzina: number;
  /** Vjetra praktički nema; smjer tada ništa ne znači. */
  readonly tisina: boolean;
  readonly izvor: IzvorVjetra;
};

/** Ispod ovoga smjer prestaje išta značiti. */
const TISINA = 0.5;

/** Model spušta sloj i na 15 m; ispod ovoga razlika više nije razlučiva. */
const NAJPLICI_SLOJ = 25;

function broj(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Zaokružuje trenutak na početak sata. */
export function vrhSata(kad: Date): Date {
  return new Date(Math.floor(kad.getTime() / 3600000) * 3600000);
}

/**
 * Adresa satnog niza vjetra i dubine sloja, unatrag i unaprijed.
 *
 * Args:
 *   unatrag: Koliko dana unatrag treba pokriti.
 *   unaprijed: Koliko dana unaprijed treba pokriti.
 *
 * Returns:
 *   Adresa Open-Meteova satnog niza u UTC-u.
 */
export function adresaModela(unatrag: number, unaprijed: number): string {
  return (
    "https://api.open-meteo.com/v1/forecast?latitude=43.522&longitude=16.499" +
    "&hourly=wind_speed_10m,wind_direction_10m,boundary_layer_height,shortwave_radiation,cloud_cover" +
    "&wind_speed_unit=ms" +
    `&past_days=${unatrag}&forecast_days=${unaprijed}&timezone=UTC`
  );
}

type SatniNiz = Record<string, (number | null)[]>;

/** Razlaže Open-Meteov `hourly` blok u niz po satu. */
function satniBlok(odgovor: unknown): { vremena: string[]; polja: SatniNiz } | null {
  if (typeof odgovor !== "object" || odgovor === null) return null;
  const satno = (odgovor as Record<string, unknown>).hourly;
  if (typeof satno !== "object" || satno === null) return null;
  const vremena = (satno as Record<string, unknown>).time;
  if (!Array.isArray(vremena)) return null;
  const polja: SatniNiz = {};
  for (const [kljuc, vrijednost] of Object.entries(satno as Record<string, unknown>)) {
    if (kljuc === "time" || !Array.isArray(vrijednost)) continue;
    polja[kljuc] = vrijednost.map(broj);
  }
  return { vremena: vremena.map((t) => (typeof t === "string" ? t : "")), polja };
}

/**
 * Čita satni niz dubine miješanog sloja iz modela.
 *
 * Args:
 *   odgovor: Razložen JSON s `api.open-meteo.com`, u UTC-u.
 *
 * Returns:
 *   Dubina po satu, u metrima; ključ je puni ISO 8601.
 */
export function procitajDubine(odgovor: unknown): Map<string, number> {
  const blok = satniBlok(odgovor);
  const izlaz = new Map<string, number>();
  if (!blok) return izlaz;
  const dubine = blok.polja.boundary_layer_height;
  if (!dubine) return izlaz;
  for (let i = 0; i < blok.vremena.length; i += 1) {
    const d = dubine[i];
    if (d === null || d === undefined || !blok.vremena[i]) continue;
    // Open-Meteo vraća "2026-08-19T14:00" bez oznake zone, uz timezone=UTC.
    const ms = Date.parse(`${blok.vremena[i]}Z`);
    if (Number.isNaN(ms)) continue;
    izlaz.set(new Date(ms).toISOString(), Math.max(NAJPLICI_SLOJ, Math.round(d)));
  }
  return izlaz;
}

/** Okolnosti sata koje određuju razred stabilnosti; vidi `sim/stabilnost.ts`. */
export type OkolnostiSata = {
  /** Kratkovalno zračenje na tlu, W/m². */
  readonly sunce: number;
  /** Naoblaka, %. */
  readonly oblaci: number;
};

/**
 * Čita satni niz zračenja i naoblake iz modela.
 *
 * Args:
 *   odgovor: Razložen JSON s `api.open-meteo.com`, u UTC-u.
 *
 * Returns:
 *   Okolnosti po satu; ključ je puni ISO 8601. Sat bez oba podatka izostaje.
 */
export function procitajOkolnosti(odgovor: unknown): Map<string, OkolnostiSata> {
  const blok = satniBlok(odgovor);
  const izlaz = new Map<string, OkolnostiSata>();
  if (!blok) return izlaz;
  const sunce = blok.polja.shortwave_radiation;
  const oblaci = blok.polja.cloud_cover;
  if (!sunce || !oblaci) return izlaz;
  for (let i = 0; i < blok.vremena.length; i += 1) {
    const s = sunce[i];
    const o = oblaci[i];
    if (s === null || s === undefined || o === null || o === undefined || !blok.vremena[i]) continue;
    const ms = Date.parse(`${blok.vremena[i]}Z`);
    if (Number.isNaN(ms)) continue;
    izlaz.set(new Date(ms).toISOString(), { sunce: s, oblaci: o });
  }
  return izlaz;
}

/**
 * Čita satni niz vjetra iz modela.
 *
 * Args:
 *   odgovor: Razložen JSON s `api.open-meteo.com`, u UTC-u.
 *
 * Returns:
 *   Vjetar po satu; ključ je puni ISO 8601.
 */
export function procitajModelskiVjetar(odgovor: unknown): Map<string, SatniVjetar> {
  const blok = satniBlok(odgovor);
  const izlaz = new Map<string, SatniVjetar>();
  if (!blok) return izlaz;
  const brzine = blok.polja.wind_speed_10m;
  const smjerovi = blok.polja.wind_direction_10m;
  if (!brzine || !smjerovi) return izlaz;
  for (let i = 0; i < blok.vremena.length; i += 1) {
    const brzina = brzine[i];
    const smjer = smjerovi[i];
    if (brzina === null || brzina === undefined || brzina < 0 || !blok.vremena[i]) continue;
    const ms = Date.parse(`${blok.vremena[i]}Z`);
    if (Number.isNaN(ms)) continue;
    const sat = new Date(ms).toISOString();
    izlaz.set(sat, {
      sat,
      smjerOd: smjer === null || smjer === undefined ? PRETPOSTAVLJENO.smjerOd : ((smjer % 360) + 360) % 360,
      brzina: Number(brzina.toFixed(2)),
      tisina: brzina < TISINA,
      izvor: "model",
    });
  }
  return izlaz;
}

type AzoZapis = { vrijednost: number; vrijeme: number };

function azoNiz(odgovor: unknown): AzoZapis[] {
  if (!Array.isArray(odgovor)) return [];
  const niz: AzoZapis[] = [];
  for (const zapis of odgovor) {
    if (typeof zapis !== "object" || zapis === null) continue;
    const v = broj((zapis as Record<string, unknown>).vrijednost);
    const t = broj((zapis as Record<string, unknown>).vrijeme);
    if (v !== null && t !== null) niz.push({ vrijednost: v, vrijeme: t });
  }
  return niz;
}

/**
 * Slaže izmjereni satni niz vjetra s jedne AZO-ove postaje.
 *
 * Brzina i smjer stižu kao dva odvojena niza, pa se spajaju po satu — bez toga
 * bi se pri kvaru jednog analizatora smjer iz jednog sata spojio s brzinom iz
 * drugog. Sat bez smjera se odbacuje: model za taj sat ima i jedno i drugo, pa
 * nema razloga graditi polje na pola očitanja.
 *
 * Args:
 *   postaja: Koja je postaja u pitanju.
 *   brzine: Odgovor za brzinu vjetra.
 *   smjerovi: Odgovor za smjer vjetra.
 *
 * Returns:
 *   Vjetar po satu; ključ je puni ISO 8601.
 */
export function procitajAzoNiz(
  postaja: Postaja,
  brzine: unknown,
  smjerovi: unknown,
): Map<string, SatniVjetar> {
  const poSatu = new Map(azoNiz(smjerovi).map((z) => [z.vrijeme, z.vrijednost]));
  const izlaz = new Map<string, SatniVjetar>();
  for (const zapis of azoNiz(brzine)) {
    if (zapis.vrijednost < 0) continue;
    const smjer = poSatu.get(zapis.vrijeme);
    if (smjer === undefined) continue;
    const sat = vrhSata(new Date(zapis.vrijeme)).toISOString();
    izlaz.set(sat, {
      sat,
      smjerOd: Number((((smjer % 360) + 360) % 360).toFixed(1)),
      brzina: Number(zapis.vrijednost.toFixed(2)),
      tisina: zapis.vrijednost < TISINA,
      izvor: postaja,
    });
  }
  return izlaz;
}

/**
 * Bira vjetar za svaki sat, po provjerenom redoslijedu izvora.
 *
 * Args:
 *   satovi: Satovi koje treba pokriti, puni ISO 8601.
 *   izvori: Nizovi po izvoru, od najpouzdanijeg prema najslabijem.
 *
 * Returns:
 *   Vjetar po satu; sat koji nijedan izvor ne pokriva izostaje.
 */
export function slozeniVjetar(
  satovi: readonly string[],
  izvori: readonly Map<string, SatniVjetar>[],
): Map<string, SatniVjetar> {
  const izlaz = new Map<string, SatniVjetar>();
  for (const sat of satovi) {
    for (const izvor of izvori) {
      const v = izvor.get(sat);
      if (v) {
        izlaz.set(sat, v);
        break;
      }
    }
  }
  return izlaz;
}

/** Ime izvora kako stoji uz sat na prikazu. */
export function imeIzvora(izvor: IzvorVjetra): string {
  return izvor === "model" ? "Model (Open-Meteo)" : POSTAJE[izvor].ime;
}

/**
 * Slaže stanje za model iz satnog vjetra, dubine sloja i okolnosti.
 *
 * Razred stabilnosti se izvodi iz brzine, zračenja i naoblake (Turner);
 * bez okolnosti sat je neutralan (D) i model se ponaša kao prije.
 */
export function stanjeSata(
  vjetar: SatniVjetar | undefined,
  dubina: number | undefined,
  okolnosti?: OkolnostiSata,
): StanjeZraka | null {
  if (!vjetar || dubina === undefined) return null;
  const stabilnost = okolnosti
    ? razredStabilnosti(vjetar.brzina, okolnosti.sunce, okolnosti.oblaci)
    : NEUTRALNO;
  return { smjerOd: vjetar.smjerOd, brzina: vjetar.brzina, dubina, stabilnost };
}
