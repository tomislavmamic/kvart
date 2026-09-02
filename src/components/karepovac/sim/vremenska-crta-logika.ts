/**
 * Čista logika trake vremena: što se smije odabrati, kamo ide reprodukcija,
 * koji je sat noć. Bez DOM-a, da se provjerava u Nodeu.
 */

import { SATI_UNAPRIJED, type Kadar } from "@/lib/sim/kadrovi";

/** Koliko reprodukcija stoji na jednom satu. */
export const KORAK_REPRODUKCIJE_MS = 1500;

/** Koliko traje pretapanje između dvaju sati. */
export const PRIJELAZ_MS = 400;

const MJESNI_SAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zagreb",
  hour: "numeric",
  hourCycle: "h23",
});

/**
 * Mjesni sat u Splitu, 0–23, iz punog ISO zapisa.
 *
 * Ovdje se ne uzima `mjesniSat` iz `dim.ts`: onaj je namjerno gruba
 * aproksimacija ljetnog vremena kojom je izveden profil izvora, a traka mora
 * pokazati sat koji piše na zidu.
 */
export function mjesniSatBroj(iso: string): number {
  return Number(MJESNI_SAT.format(new Date(iso)));
}

/** Noć je od 21 do 6 po mjesnom satu — kad sloj padne i miris se drži tla. */
export function jeNoc(iso: string): boolean {
  const h = mjesniSatBroj(iso);
  return h >= 21 || h < 6;
}

/**
 * Pomak sljedećeg dostupnog kadra za reprodukciju, s vraćanjem na početak.
 *
 * Args:
 *   kadrovi: Kadrovi crte, rastuće po pomaku.
 *   pomak: Trenutačni pomak.
 *
 * Returns:
 *   Sljedeći dostupni pomak; prvi dostupni kad je kraj; `null` bez ijednog.
 */
export function sljedeciZaReprodukciju(kadrovi: readonly Kadar[], pomak: number): number | null {
  const dostupni = kadrovi.filter((k) => k.dostupnost !== "nedostupno");
  if (!dostupni.length) return null;
  const sljedeci = dostupni.find((k) => k.pomak > pomak);
  return (sljedeci ?? dostupni[0]).pomak;
}

/**
 * Pomak iz položaja na traci.
 *
 * Args:
 *   udio: Položaj 0–1 duž trake.
 *   prvi: Pomak prvog kadra.
 *   zadnji: Pomak zadnjeg kadra.
 *
 * Returns:
 *   Cijeli pomak između `prvi` i `zadnji`.
 */
export function pomakIzUdjela(udio: number, prvi: number, zadnji: number): number {
  const u = Math.max(0, Math.min(1, udio));
  return Math.round(prvi + u * (zadnji - prvi));
}

/**
 * Koliko je kadar nagađanje, 0–1: izmjeren i sadašnji 0, prognoza raste
 * s odmakom do 1 na zadnjem satu prognoze.
 */
export function nesigurnostKadra(kadar: Pick<Kadar, "vrsta" | "pomak">): number {
  if (kadar.vrsta !== "prognoza") return 0;
  return Math.max(0, Math.min(1, kadar.pomak / SATI_UNAPRIJED));
}

/** Na kojim satima traka nosi brojku: svaki šesti mjesni sat. */
export function nosiNatpis(iso: string): boolean {
  return mjesniSatBroj(iso) % 6 === 0;
}
