/**
 * Vremenska crta simulatora: 24 sata unatrag, sadašnji sat i tri unaprijed.
 *
 * Jedan **kadar** je jedan sat: vjetar koji ga vodi, dubina sloja pod kojim se
 * zrak miješa i ono što su postaje u tom satu izmjerile. Simulacija iz kadra
 * uzima samo prve dvije stvari; mjerenja stoje uz njih da se vidi gdje se
 * model i stvarnost sreću.
 *
 * Zašto sve prolazi kroz jedan oblik: prošlost, sadašnjost i prognoza dolaze
 * iz triju različitih izvora s trima različitim oblicima odgovora. Da svaki od
 * njih putuje do karte svojim putem, prvo bi se izgubila razlika između
 * izmjerenog i prognoziranog sata — a to je jedina razlika koju prikaz ne smije
 * zamutiti. Zato kadar uvijek nosi `vrsta` i `izvor`, i zato prognozirani sat
 * **nema** mjerenja: postaje budućnost ne mjere, pa se ondje ne izmišlja.
 *
 * Sat koji nema vjetar nije kadar nego rupa: `vrsta` mu ostaje, ali
 * `dostupnost` je „nedostupno” i na crti se ne može odabrati.
 */

import type { StanjeZraka } from "@/lib/polje-dima";
import {
  type IzvorVjetra,
  type SatniVjetar,
  stanjeSata,
} from "@/lib/sim/vrijeme-satno";
import type { OznakaPostaje } from "@/lib/sim/postaje-satno";

/** Koliko sati unatrag crta pokazuje. */
export const SATI_UNATRAG = 24;

/** Koliko sati unaprijed crta pokazuje kad prognoza stigne. */
export const SATI_UNAPRIJED = 3;

/**
 * Koliko sati prije crte simulacija tiho odradi, da prvi vidljivi sat ne
 * počne od čistog zraka.
 *
 * Perjanica pri slabom vjetru prijeđe okvir od 6,4 km za oko sat i pol, pa bi
 * bez zaleta prvi sat na crti izgledao kao da je ploha tog trena proradila.
 * Šest sati je s viškom: i pri 0,3 m/s zrak dotad prijeđe okvir.
 */
export const SATI_ZALETA = 6;

export type VrstaKadra = "izmjereno" | "sada" | "prognoza";

export type Dostupnost = "spreman" | "djelomicno" | "nedostupno";

export type OcitanjePostaje = {
  readonly postaja: OznakaPostaje;
  readonly tvar: string;
  /** Izmjereno, u µg/m³; `null` kad uređaj nije radio ili sat još nije prošao. */
  readonly vrijednost: number | null;
  readonly jedinica: string;
  /** Nalaz je bio ispod granice određivanja. */
  readonly ispodGranice: boolean;
};

export type Kadar = {
  /** Početak sata, puni ISO 8601 u UTC-u. */
  readonly sat: string;
  /** Pomak od sadašnjeg sata; −24 do +3. */
  readonly pomak: number;
  readonly vrsta: VrstaKadra;
  readonly dostupnost: Dostupnost;
  /** Ono što ide u model; `null` kad za taj sat nema vjetra. */
  readonly stanje: StanjeZraka | null;
  readonly vjetar: SatniVjetar | null;
  readonly izvor: IzvorVjetra | null;
  /** Prazno za prognozirane satove: budućnost se ne mjeri. */
  readonly ocitanja: readonly OcitanjePostaje[];
};

export type Crta = {
  /** Sadašnji sat, na koji se pomaci odnose. */
  readonly sada: string;
  /** Kadrovi crte, od najstarijeg prema najnovijem. */
  readonly kadrovi: readonly Kadar[];
  /** Kadrovi zaleta; ne prikazuju se, ali simulacija kroz njih prođe. */
  readonly zalet: readonly Kadar[];
  /** Kadar koji nosi sadašnji sat, ako je dostupan. */
  readonly pomakSada: number;
};

/**
 * Nabraja satove crte, od zaleta do zadnjeg prognoziranog.
 *
 * Args:
 *   sada: Sadašnji sat, već zaokružen na vrh sata.
 *   unaprijed: Koliko sati prognoze stvarno postoji; 0 kad prognoza ne stigne.
 *
 * Returns:
 *   Par (satovi zaleta, satovi crte), oboje puni ISO 8601, rastuće.
 */
export function satoviCrte(
  sada: Date,
  unaprijed: number = SATI_UNAPRIJED,
): { zalet: string[]; crta: string[] } {
  const vrh = sada.getTime();
  const sat = (pomak: number) => new Date(vrh + pomak * 3600000).toISOString();
  const zalet: string[] = [];
  for (let i = SATI_UNATRAG + SATI_ZALETA; i > SATI_UNATRAG; i -= 1) zalet.push(sat(-i));
  const crta: string[] = [];
  for (let i = -SATI_UNATRAG; i <= Math.min(unaprijed, SATI_UNAPRIJED); i += 1) {
    crta.push(sat(i));
  }
  return { zalet, crta };
}

/**
 * Slaže jedan kadar iz onoga što je za taj sat stiglo.
 *
 * Args:
 *   sat: Početak sata, puni ISO 8601.
 *   pomak: Pomak od sadašnjeg sata.
 *   vjetar: Vjetar za taj sat, ako ga ima.
 *   dubina: Dubina miješanog sloja za taj sat, ako je ima.
 *   ocitanja: Mjerenja s postaja; zanemaruju se za prognozirane satove.
 *
 * Returns:
 *   Kadar; bez vjetra ili dubine ostaje „nedostupno”.
 */
export function slozKadar(
  sat: string,
  pomak: number,
  vjetar: SatniVjetar | undefined,
  dubina: number | undefined,
  ocitanja: readonly OcitanjePostaje[] = [],
): Kadar {
  const vrsta: VrstaKadra = pomak > 0 ? "prognoza" : pomak === 0 ? "sada" : "izmjereno";
  const stanje = stanjeSata(vjetar, dubina);
  // Postaje ne mjere budućnost. Kad bi prognozirani sat nosio mjerenje,
  // to bi bilo mjerenje nekog drugog sata pod krivom oznakom.
  const mjerenja = vrsta === "prognoza" ? [] : ocitanja;
  const imaMjerenje = mjerenja.some((o) => o.vrijednost !== null);
  return {
    sat,
    pomak,
    vrsta,
    dostupnost: stanje === null ? "nedostupno" : imaMjerenje || vrsta === "prognoza" ? "spreman" : "djelomicno",
    stanje,
    vjetar: vjetar ?? null,
    izvor: vjetar?.izvor ?? null,
    ocitanja: mjerenja,
  };
}

/**
 * Slaže cijelu crtu iz satnih nizova.
 *
 * Args:
 *   sada: Sadašnji sat, zaokružen na vrh sata.
 *   vjetrovi: Vjetar po satu, već složen po redoslijedu izvora.
 *   dubine: Dubina miješanog sloja po satu.
 *   ocitanja: Mjerenja po satu, po postaji.
 *
 * Returns:
 *   Crta s kadrovima zaleta i kadrovima prikaza.
 */
export function slozCrtu(
  sada: Date,
  vjetrovi: Map<string, SatniVjetar>,
  dubine: Map<string, number>,
  ocitanja: Map<string, readonly OcitanjePostaje[]>,
): Crta {
  // Prognoza se ne obećava nego broji: crta seže dokle model doista ima i
  // vjetar i dubinu, a ne dokle bi trebao imati.
  let unaprijed = 0;
  for (let i = 1; i <= SATI_UNAPRIJED; i += 1) {
    const sat = new Date(sada.getTime() + i * 3600000).toISOString();
    if (!vjetrovi.has(sat) || !dubine.has(sat)) break;
    unaprijed = i;
  }

  const { zalet, crta } = satoviCrte(sada, unaprijed);
  const uKadar = (sat: string, pomak: number) =>
    slozKadar(sat, pomak, vjetrovi.get(sat), dubine.get(sat), ocitanja.get(sat) ?? []);

  return {
    sada: sada.toISOString(),
    zalet: zalet.map((sat, i) => uKadar(sat, -(SATI_UNATRAG + SATI_ZALETA) + i)),
    kadrovi: crta.map((sat, i) => uKadar(sat, i - SATI_UNATRAG)),
    pomakSada: 0,
  };
}

/**
 * Zadnji kadar koji se doista može odabrati, gledano od zadanog pomaka unatrag.
 *
 * Args:
 *   crta: Crta sa svim kadrovima.
 *   pomak: Željeni pomak.
 *
 * Returns:
 *   Kadar koji je dostupan, ili `null` ako nijedan nije; pri jednakoj
 *   udaljenosti bira noviji.
 */
export function najbliziDostupan(crta: Crta, pomak: number): Kadar | null {
  const dostupni = crta.kadrovi.filter((k) => k.dostupnost !== "nedostupno");
  if (!dostupni.length) return null;
  let najbolji = dostupni[0];
  for (const k of dostupni) {
    const razmak = Math.abs(k.pomak - pomak);
    const dosad = Math.abs(najbolji.pomak - pomak);
    // Kad su rupi obje strane jednako blizu, ide se prema sadašnjosti:
    // noviji sat je ono što gledatelj traži kad klikne u prazno.
    if (razmak < dosad || (razmak === dosad && k.pomak > najbolji.pomak)) najbolji = k;
  }
  return najbolji;
}

/**
 * Satovi čije kadrove treba računati iznova nakon promjene vjetra.
 *
 * Promjena jednog sata ne mijenja samo njegov kadar: svaki se kadar računa
 * iz svog zaleta, pa promjena povlači i sljedećih `zaletSati` sati. Vraćaju
 * se samo satovi crte (zalet nema kadra), redom.
 *
 * Args:
 *   stari: Crta prije promjene.
 *   novi: Crta poslije promjene.
 *   zaletSati: Koliko sati zaleta kadar nosi.
 *
 * Returns:
 *   Satove crte kojima kadar više ne vrijedi.
 */
export function zahvaceniSati(
  stari: Crta,
  novi: Crta,
  zaletSati: number,
): string[] {
  const prijePoSatu = new Map(
    [...stari.zalet, ...stari.kadrovi].map((k) => [k.sat, k.stanje]),
  );
  const redom = [...novi.zalet, ...novi.kadrovi].filter((k) => k.stanje !== null);
  const promijenjeni = new Set<string>();
  for (const k of redom) {
    const prije = prijePoSatu.get(k.sat);
    if (
      prije &&
      k.stanje &&
      (prije.smjerOd !== k.stanje.smjerOd || prije.brzina !== k.stanje.brzina)
    ) {
      promijenjeni.add(k.sat);
    }
  }
  if (!promijenjeni.size) return [];
  const satiCrte = new Set(
    novi.kadrovi.filter((k) => k.stanje !== null).map((k) => k.sat),
  );
  const zahvaceni: string[] = [];
  redom.forEach((k, i) => {
    if (!satiCrte.has(k.sat)) return;
    for (let d = 0; d <= zaletSati && i - d >= 0; d += 1) {
      if (promijenjeni.has(redom[i - d].sat)) {
        zahvaceni.push(k.sat);
        break;
      }
    }
  });
  return zahvaceni;
}
