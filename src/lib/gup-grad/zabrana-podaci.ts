/**
 * Podaci za /gup/zabrana na poslužitelju.
 *
 * Zabrana iz prijedloga GUP-a 2025. ne dira ono što je već izgrađeno, nego
 * slobodno zemljište na kojem bi se inače smjela graditi nova zgrada. Zato se
 * broji to zemljište, čestica po čestica, istim izračunom kao grafikon na
 * /gup (izracun.ts): slobodno je ono što nije pod zgradom s pripadajućom
 * česticom, ulicom, parkiralištem i sl., a za gradnju je samo ako na njega
 * (sa slobodnim susjedima) stane nova građevna čestica.
 *
 * cesticeZabrane() piše scripts/gup-grad/zabrana-cestice.ts u
 * data/gup-grad/zabrana-cestice.json; scripts/gup-grad/zabrana.py dodaje
 * oblike čestica i UPU u čijem su obuhvatu, pa zbrojevi stoje u
 * public/geo/gup-grad/zabrana-2025.geojson.
 */
import { readFile } from "fs/promises";
import path from "path";

import { procijeniGodinu } from "./izracun";
import { KLASA_PO_INDEKSU, type Godina } from "./model";
import { izracunaj, ucitajMjerenja, ucitajOdredbe, ulazGodine, type Odredbe, type SirovaMjerenja } from "./podaci";
import { INACICE } from "./pravila";
import type { Podrucje } from "./zabrana";

/** Zone u kojima zabrana priječi novu zgradu. Javne zgrade (D) smiju se graditi i prije UPU-a (čl. 105. st. 5.). */
export const ZONE_ZABRANE = { S: "stanovanje", "M/K5": "stanovanje", "I/K": "gospodarstvo", T: "turizam" } as const;
export type ZonaZabrane = (typeof ZONE_ZABRANE)[keyof typeof ZONE_ZABRANE];

/** Što na komadu čini česticu izgrađenom: zgrada bilo koje vrste, njezina okućnica ili gradilište. */
const IZGRADJENO = ["stambena", "gospodarska", "javna", "pomocna", "ostala", "neevidentirana", "okucnica", "gradiliste"];

export interface CesticaZabrane {
  /** indeks čestice u data/gup-grad/cestice.json */
  cestica: number;
  /** slobodno zemljište za novu zgradu koje bi čekalo UPU, m² */
  m2: number;
  /** isto, po zoni (čestica može biti u dvije zone) */
  poZoni: Partial<Record<ZonaZabrane, number>>;
  /** na čestici nema ničeg izgrađenog */
  neizgradjena: boolean;
  /** zona s najviše tog zemljišta na čestici */
  zona: ZonaZabrane;
}

/**
 * Čestice sa slobodnim zemljištem za gradnju u području koje bi po prijedlogu
 * 2025. čekalo UPU. Izračun ide bez pravila o obvezi plana, da i to zemljište
 * prođe istu provjeru najmanje građevne čestice i slobodnih susjeda kao
 * ostalo slobodno zemljište; premali ostaci se ne broje.
 */
export function cesticeZabrane(d: SirovaMjerenja, o: Odredbe, godina: Godina = 2025): CesticaZabrane[] {
  const osnovna = INACICE[0].pravila;
  // gospodarska i turistička zgrada troši česticu po kig/kis iz posebnih pravila, kao stambena
  const p = { ...osnovna, postujObvezuPlana: false, gradevna: { ...osnovna.gradevna, izvanStanovanja: true } };
  const u = ulazGodine(d, godina, p, o);
  const { procjene, ostaci, uvjeti } = procijeniGodinu(u, p);
  const izgradjena = new Set<number>();
  const po = new Map<number, Map<ZonaZabrane, number>>();
  u.komadi.forEach((k, i) => {
    const r = procjene[i];
    if (!r || k.cestica === undefined) return;
    if (IZGRADJENO.some((v) => (r.poVrsti[v as keyof typeof r.poVrsti] ?? 0) > 0)) izgradjena.add(k.cestica);
    const kod = KLASA_PO_INDEKSU.get(k.klasa)?.kod as keyof typeof ZONE_ZABRANE | undefined;
    if (!kod || !(kod in ZONE_ZABRANE) || uvjeti[i]?.rezim !== "ceka") return;
    const px = Math.max(0, r.n - r.iskoristeno - r.zabranjeno - r.neizgradivo) - (ostaci.get(i) ?? 0);
    if (px <= 0) return;
    const zone = po.get(k.cestica) ?? new Map<ZonaZabrane, number>();
    zone.set(ZONE_ZABRANE[kod], (zone.get(ZONE_ZABRANE[kod]) ?? 0) + px * u.pikselM2);
    po.set(k.cestica, zone);
  });
  return [...po].map(([cestica, zone]) => {
    const [zona] = [...zone].sort((a, b) => b[1] - a[1])[0];
    const m2 = [...zone.values()].reduce((a, b) => a + b, 0);
    return { cestica, m2, poZoni: Object.fromEntries(zone), neizgradjena: !izgradjena.has(cestica), zona };
  });
}

export interface RedUpu {
  /** 0 = crveno izvan svih obuhvata ucrtanih na listu 4.d */
  broj: number;
  naziv: string | null;
  sanacija_ha: number;
  preobrazba_ha: number;
  neuredeno_ha: number;
  /** slobodno zemljište za novu zgradu koje bi čekalo taj UPU */
  slobodno_ha: number;
  /** neizgrađene čestice među njima */
  neizgradjene: number;
  /** isto, samo za ono što karta boji (FokusZabrane) */
  fokus_ha: number;
  fokus_slobodno_ha: number;
  fokus_neizgradjene: number;
}

/**
 * Samo ono što karta na /gup/zabrana boji: urbana sanacija i urbana preobrazba
 * stambenih i mješovitih zona izvan gradskih projekata (zabrana.py, FOKUS).
 */
export interface FokusZabrane {
  gradnja_ha: { sanacija: number; preobrazba: number };
  gradnja_ukupno_ha: number;
  /** u zonama za gradnju, a karta ih ne boji */
  izvan_ha: { neuredeno: number; gradski_projekt: number; gospodarska_preobrazba: number };
  slobodno_ha: number;
  slobodno_po_zoni_ha: Partial<Record<ZonaZabrane, number>>;
  neizgradjene: { cestice: number; ha: number };
  djelomicno: { cestice: number; ha: number };
}

export interface ZbrojZabrane {
  /** sve što je na listu 4.d obojeno */
  ha: Record<Podrucje, number>;
  ukupno_ha: number;
  /** od toga u zonama za gradnju (S, M/K5, I/K, T) */
  gradnja_ha: Record<Podrucje, number>;
  gradnja_ukupno_ha: number;
  /** od toga na ulicama, javnoj, športskoj i zelenoj namjeni */
  negradivo_ha: Record<Podrucje, number>;
  slobodno_ha: number;
  slobodno_po_zoni_ha: Record<ZonaZabrane, number>;
  neizgradjene: { cestice: number; ha: number };
  djelomicno: { cestice: number; ha: number };
  fokus: FokusZabrane;
  po_upu: RedUpu[];
}

export async function ucitajZbrojZabrane(): Promise<ZbrojZabrane> {
  const put = path.join(process.cwd(), "public", "geo", "gup-grad", "zabrana-2025.geojson");
  return JSON.parse(await readFile(put, "utf8")).zbroj as ZbrojZabrane;
}

/** Broj čestica i slobodno zemljište na njima (ha). */
export interface BrojCestica {
  cestice: number;
  ha: number;
}

/** Zbrojevi iz scripts/gup-grad/sporne.py (sporne-2025.geojson). */
export interface ZbrojSpornih {
  /** čestice u neuređenom dijelu uz cestu čija je čestica široka barem 4 m */
  pristup: BrojCestica;
  /** od njih one uz koje na manje od 15 m prolazi i kanalizacija */
  pristup_kanal: number;
  /** čestice neuređenog dijela uz cestu izvan registra ili neizmjerene širine (moguće sporne) */
  cesta: BrojCestica;
  /** djelomično izgrađene čestice u neuređenom dijelu (na karti nisu sporne same po sebi) */
  izgradjena: BrojCestica;
  /** čestice u plohama urbane sanacije u kojima ozakonjene zgrade nisu većina */
  sanacija: BrojCestica;
  /** sporne na karti: pristup, cesta, sanacija ili ppug */
  ukupno: BrojCestica;
  /** sve čestice pod zabranom u neuređenom dijelu, odnosno u urbanoj sanaciji */
  neuredeno: BrojCestica;
  u_sanaciji: BrojCestica;
  /** prazne čestice u plohama urbane sanacije i koliko ih je uz postojeću cestu */
  prazne_u_sanaciji: BrojCestica;
  prazne_u_sanaciji_uz_cestu: number;
  plohe: { ha: number; zgrade: number; udio: number; upu: number; manjina: boolean }[];
  /** razred na listu PPUG-a (I izgrađeno, N neizgrađeno bez šrafure, U neuređeno) prema oznaci s lista 4.d,
   *  za čestice od 250 m² u obuhvatima propisanih UPU-a izvan važećih planova */
  ppug_4d: Record<"I" | "N" | "U", Record<"sanacija" | "preobrazba" | "neuredeno" | "bez", BrojCestica>>;
  po_upu: Record<string, { naziv: string | null; cestice: number; ha: number }>;
}

export async function ucitajSporne(): Promise<ZbrojSpornih> {
  const put = path.join(process.cwd(), "public", "geo", "gup-grad", "sporne-2025.geojson");
  return JSON.parse(await readFile(put, "utf8")).zbroj as ZbrojSpornih;
}

/** Zemljište stambenih i mješovitih zona jedne godine plana, u m². */
export interface ZemljisteZaStanovanje {
  ukupno: number;
  iskoristeno: number;
  /** ukupno − iskorišteno */
  neiskoristeno: number;
  /** Slobodno za novu zgradu, a čeka plan užeg područja koji nije donesen. */
  ceka: number;
  /** Pod planom užeg područja na snazi: gradi se po njemu. */
  poPlanu: number;
  /** Gradi se odmah, neposrednom provedbom GUP-a. */
  poGupu: number;
  /** Premali ostaci, zabrana iz odredbi zone, neizgradiv teren. */
  nijeZaGradnju: number;
}

/**
 * Zbrojevi kao infografika na /gup (nijeZaGradnju, cekaPlan, zaGradnju,
 * poPlanu u infografika.tsx), po zadanim pravilima („Po odredbama”). Za 2015.
 * i 2025. „čeka” je samo zemljište na koje stane nova zgrada (cesticeZabrane);
 * premali ostaci u područjima koja čekaju plan prelaze u „nije za gradnju”.
 */
export async function zemljisteZaStanovanje(): Promise<Record<Godina, ZemljisteZaStanovanje>> {
  const [d, o] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const r = izracunaj(d, INACICE[0].pravila, o);
  const zbroj = (g: Godina): ZemljisteZaStanovanje => {
    const z = { ukupno: 0, iskoristeno: 0, neiskoristeno: 0, ceka: 0, poPlanu: 0, poGupu: 0, nijeZaGradnju: 0 };
    for (const k of r[g]) {
      if (ZONE_ZABRANE[k.kod as keyof typeof ZONE_ZABRANE] !== "stanovanje") continue;
      const nije = k.ostatakM2 + k.zabranjenoM2 + k.neizgradivoM2;
      const ceka = k.cekaPlanM2 ?? 0;
      const zaGradnju = Math.max(0, k.ukupnoM2 - k.iskoristenoM2 - nije - ceka);
      const poPlanu = Math.min(zaGradnju, k.poPlanuM2 ?? 0);
      z.ukupno += k.ukupnoM2;
      z.iskoristeno += k.iskoristenoM2;
      z.neiskoristeno += k.ukupnoM2 - k.iskoristenoM2;
      z.ceka += ceka;
      z.poPlanu += poPlanu;
      z.poGupu += zaGradnju - poPlanu;
      z.nijeZaGradnju += nije;
    }
    return z;
  };
  const godine = { 2006: zbroj(2006), 2015: zbroj(2015), 2025: zbroj(2025) };
  for (const g of [2015, 2025] as const) {
    const gradivo = cesticeZabrane(d, o, g).reduce((s, c) => s + (c.poZoni.stanovanje ?? 0), 0);
    const z = godine[g];
    const visak = Math.max(0, z.ceka - gradivo);
    z.nijeZaGradnju += visak;
    z.ceka -= visak;
  }
  return godine;
}
