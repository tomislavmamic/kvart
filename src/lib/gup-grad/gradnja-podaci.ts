/**
 * Podaci za /gup/gradnja na poslužitelju: zbrojevi po kategoriji
 * (data/gup-grad/gradnja-2025.json, scripts/gup-grad/gradnja.ts) i odredbe
 * GUP-a 2025. koje tumač klika navodi — što se u kojem području urbanog
 * pravila smije graditi i najmanja građevna čestica, iste kao na /gup.
 */
import { readFile } from "fs/promises";
import path from "path";

import { imenaNavoda } from "@/lib/gup-dokument/navodi";
import type { IdKategorije, Skupina, ZonaGradnje } from "./gradnja";
import type { KodKlase } from "./model";
import type { NajmanjaCestica } from "./odredbe";
import { odredbeZaKartu, ucitajOdredbe, type GradnjaKarte } from "./podaci";
import { INACICE } from "./pravila";

export interface ZbrojGradnje {
  ukupno_ha: number;
  po_kategoriji_ha: Record<IdKategorije, number>;
  po_skupini_ha: Record<Skupina, number>;
  po_namjeni_ha: Partial<Record<KodKlase, Partial<Record<IdKategorije, number>>>>;
  /** u zonama za stanovanje (S, M1–M3, K5), po kategoriji kakva je na karti: javno se broji kao javno */
  u_stambenim_zonama_ha: Partial<Record<IdKategorije, number>>;
  /** razlog po GUP-u na slobodnom zemljištu pod planom na snazi */
  ispod_plana_ha: Partial<Record<IdKategorije, number>>;
  zona_gradnje: Record<KodKlase, ZonaGradnje>;
}

export function ucitajZbrojGradnje(): Promise<ZbrojGradnje> {
  return readFile(path.join(process.cwd(), "data", "gup-grad", "gradnja-2025.json"), "utf8").then((t) => JSON.parse(t) as ZbrojGradnje);
}

/** Broj mjesta za gradnju (spojenih slobodnih čestica) po veličini, iz scripts/gup-grad/gradnja-zone.py. */
export type MjestaGradnje = Record<"stambeno" | "uz-cestu-stambeno", Record<"od_250_m2" | "od_500_m2" | "od_1000_m2" | "ha", number>>;

export function ucitajMjestaGradnje(): Promise<MjestaGradnje> {
  return readFile(path.join(process.cwd(), "data", "gup-grad", "gradnja-mjesta-2025.json"), "utf8").then(
    (t) => (JSON.parse(t) as { mjesta: MjestaGradnje }).mjesta,
  );
}

/** Odredbe 2025. za tumač klika na /gup/gradnja. */
export interface OdredbeGradnje {
  /** po kodu urbanog pravila: najmanja građevna čestica po vrsti (stanovanje, gospodarska, javna) */
  ppmin: Record<string, Partial<Record<string, NajmanjaCestica>>>;
  /** po kodu urbanog pravila: što se smije graditi u stambenoj i mješovitoj zoni */
  gradnja: Record<string, GradnjaKarte>;
  /** po kodu urbanog pravila: naziv područja („Nisko konsolidirano – …”) */
  nazivi: Record<string, string>;
  /** navodi GUP-a 2025. koji postoje (ppmin-, gradnja-, namjena-…), da se izvor poveže samo kad ima kamo */
  navodi: string[];
}

export async function ucitajOdredbeGradnje(): Promise<OdredbeGradnje> {
  const [o, imena] = await Promise.all([ucitajOdredbe(), imenaNavoda()]);
  const { ppmin, gradnja } = odredbeZaKartu(o, 2025, INACICE[0].pravila);
  const nazivi = Object.fromEntries(Object.entries(o.ppmin.godine["2025"] ?? {}).map(([kod, p]) => [kod, p.naziv]));
  const navodi = imena.filter((id) => /^(ppmin|gradnja|namjena)-2025-/.test(id));
  return { ppmin, gradnja, nazivi, navodi };
}
