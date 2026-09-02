/**
 * Zadani prizori za snimke zaslona i za provjeru prikaza bez mreže.
 *
 * Živa crta ovisi o tome što AZO, Open-Meteo i Zavod baš tada javljaju, pa
 * dvije snimke istog zaslona nikad nisu iste — a pregled „razumije li se
 * karta u pet sekundi” traži da se uspoređuje isto s istim. Scenarij zato
 * zamjenjuje `dohvatiCrtu()` crtom složenom iz izmišljenih, ali vjerodostojnih
 * satnih ulaza: vjetra, dubine sloja i očitanja s postaja.
 *
 * Kadrovi prolaze isti račun kao živi (isti radnici, isti model), pa karta
 * pokazuje **model** za te ulaze, a ne nacrtanu perjanicu. Mijenja se samo
 * ulaz; sve nizvodno ostaje netaknuto. Time snimka ne može laskati modelu.
 *
 * Scenariji, po imenu koje ide u `?scenarij=`:
 *
 * - **jak** — noćni jugoistočnjak (1–1,6 m/s) pod plitkim slojem (35–60 m),
 *   nosi prema Dračevcu i Bilicama; popodne prije toga zapadnjak s mora,
 *   dubok sloj. Sada je 20 h, prognoza drži jugoistok uz slabljenje.
 * - **slab** — dnevni slučaj: isti smjer prema naseljima, ali 1,4 m/s pod
 *   slojem od 900 m — razrjeđenje odnese većinu. Sada je 13 h.
 * - **nesiguran** — tišina i vjetar koji luta po smjeru, sve iz modela, nijedna
 *   postaja ne javlja: pouzdanost mora pasti na nisku, a kartica ne smije
 *   reći ni „čisto” ni „smrdi”. Sada je 5 h ujutro.
 * - **okret** — vjetar se kroz popodne okreće za 180°: s mora (JZ) na kopneni
 *   (SI). Sada je 19 h, usred okreta; prošli satovi nose sjeveroistok, a
 *   sljedeći jugozapad. Crta mora pokazati da se perjanica premješta.
 * - **nista** — stalan zapadnjak od 4,5 m/s uz dubok sloj nosi prema
 *   brdima na istoku; nad naseljima nema naznaka. Kartica smije reći
 *   „nema” jer je vjetar izmjeren i jasan.
 *
 * Svaki scenarij ima svoje `sada`, da mjesni sat na traci odgovara priči
 * (noć je noć, podne je podne). Očitanja s postaja Karepovac 1 i 2 stoje uz
 * prošle sate kao što bi i u živoj crti — zadnja dva sata su prazna jer
 * Zavodove tablice kasne.
 */

import { mjesniSat } from "@/lib/dim";
import {
  SATI_UNAPRIJED,
  SATI_UNATRAG,
  SATI_ZALETA,
  slozCrtu,
  type Crta,
  type OcitanjePostaje,
} from "@/lib/sim/kadrovi";
import type { IzvorVjetra, OkolnostiSata, SatniVjetar } from "@/lib/sim/vrijeme-satno";

export type ImeScenarija = "jak" | "slab" | "nesiguran" | "okret" | "nista";

export const IMENA_SCENARIJA: readonly ImeScenarija[] = [
  "jak",
  "slab",
  "nesiguran",
  "okret",
  "nista",
];

/** Jedan sat scenarija, prije nego postane kadar. */
type SatScenarija = {
  readonly smjerOd: number;
  readonly brzina: number;
  readonly dubina: number;
  readonly izvor: IzvorVjetra;
  /** H₂S na Karepovcu 1, µg/m³; `null` kad tablica još nije objavljena. */
  readonly k1: number | null;
  /** Merkaptani na Karepovcu 2, µg/m³. */
  readonly k2: number | null;
  /**
   * Zračenje i naoblaka, iz kojih model bira razred stabilnosti: vedra noć
   * uz slab vjetar daje F (miris se drži tla), ljetno podne A–B. Kad
   * scenarij ne kaže, uzima se vedro nebo po mjesnom satu.
   */
  readonly okolnosti?: OkolnostiSata;
};

export type Scenarij = {
  readonly ime: ImeScenarija;
  readonly naziv: string;
  readonly opis: string;
  /** Sadašnji sat, puni ISO 8601 u UTC-u. */
  readonly sada: string;
  /** Ulaz za pomak od `−(24+6)` do `+3`; `mjesni` je sat u Splitu, 0–23. */
  sat(pomak: number, mjesni: number): Omit<SatScenarija, "izvor" | "k1" | "k2" | "okolnosti"> &
    Partial<Pick<SatScenarija, "izvor" | "k1" | "k2" | "okolnosti">>;
};

/** Vedro nebo: sunce po mjesnom satu ljetnog dana, noću nula. */
function vedro(mjesni: number): OkolnostiSata {
  const sunce = mjesni >= 6 && mjesni <= 20 ? Math.round(850 * Math.sin(((mjesni - 6) / 14) * Math.PI)) : 0;
  return { sunce, oblaci: 10 };
}

/** Ispod ove brzine `SatniVjetar` nosi tišinu — isto pravilo kao u `vrijeme-satno.ts`. */
const TISINA = 0.5;

/** Glatki prijelaz između dviju vrijednosti po satu; `t` je 0–1. */
function mjesaj(od: number, do_: number, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return od + (do_ - od) * (u * u * (3 - 2 * u));
}

/** Pseudo-slučajan broj iz sata: isti sat, isti broj, na svakom stroju. */
function sum(pomak: number, sjeme: number): number {
  const x = Math.sin((pomak + 31) * 12.9898 + sjeme * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Očitanja koja prate noć: H₂S raste kad sloj padne, merkaptani prate rad. */
function ocitanjaNoci(mjesni: number, noc: number): { k1: number; k2: number } {
  const nocno = mjesni >= 21 || mjesni <= 6;
  return {
    k1: Number((nocno ? 1.5 + noc * 6 : 0.6 + noc * 0.8).toFixed(3)),
    k2: Number((mjesni >= 8 && mjesni <= 17 ? 3.2 : 1.1).toFixed(3)),
  };
}

const SCENARIJI_POPIS: readonly Scenarij[] = [
  {
    ime: "jak",
    naziv: "Jak noćni slučaj",
    opis: "Jugoistočnjak pod plitkim slojem nosi prema Dračevcu i Bilicama.",
    sada: "2026-08-27T18:00:00.000Z",
    sat(pomak, mjesni) {
      // Popodne s mora, večer se okreće na jugoistok, noć ga drži.
      if (mjesni >= 11 && mjesni <= 17) {
        return { smjerOd: 225 + sum(pomak, 1) * 10, brzina: 3.1, dubina: 950, ...ocitanjaNoci(mjesni, 0) };
      }
      if (mjesni >= 7 && mjesni <= 10) {
        const t = (mjesni - 7) / 3;
        return { smjerOd: mjesaj(130, 200, t), brzina: 1.6, dubina: mjesaj(150, 700, t), ...ocitanjaNoci(mjesni, 0.4) };
      }
      if (mjesni >= 18 && mjesni <= 19) {
        const t = (mjesni - 18) / 2;
        return { smjerOd: mjesaj(200, 135, t), brzina: 1.9, dubina: mjesaj(400, 120, t), ...ocitanjaNoci(mjesni, 0.5) };
      }
      // Noćni vjetar je lagan (1–1,6 m/s): jači bi razrijedio perjanicu prije
      // naselja. Pri kalibriranom sidru model naseljima daje najviše „moguće”
      // i to upravo pri ovakvom vjetru; provjereno `scripts`-om u bilješci uz
      // `situacija.ts` (2. 9. 2026.), a fizika se mijenja odvojeno.
      const nocni = pomak > 0 ? Math.max(1, 1.4 - 0.1 * pomak) : 1.1 + sum(pomak, 2) * 0.5;
      return {
        smjerOd: 100 + sum(pomak, 3) * 12,
        brzina: Number(nocni.toFixed(2)),
        dubina: 35 + Math.round(sum(pomak, 4) * 25),
        ...ocitanjaNoci(mjesni, 1),
      };
    },
  },
  {
    ime: "slab",
    naziv: "Slab dnevni slučaj",
    opis: "Isti smjer prema naseljima, ali slab vjetar pod dubokim slojem.",
    sada: "2026-08-27T11:00:00.000Z",
    sat(pomak, mjesni) {
      if (mjesni >= 21 || mjesni <= 6) {
        return { smjerOd: 105 + sum(pomak, 5) * 10, brzina: 1.8, dubina: 90, ...ocitanjaNoci(mjesni, 0.4) };
      }
      const t = mjesni <= 12 ? (mjesni - 6) / 6 : 1;
      return {
        smjerOd: 115 + sum(pomak, 6) * 12,
        brzina: Number(mjesaj(1.8, 1.4, t).toFixed(2)),
        dubina: Math.round(mjesaj(90, 950, t)),
        ...ocitanjaNoci(mjesni, 0.2),
      };
    },
  },
  {
    ime: "nesiguran",
    naziv: "Nesiguran slučaj",
    opis: "Tišina, vjetar luta po smjeru, sve iz modela — pouzdanost je niska.",
    sada: "2026-08-28T03:00:00.000Z",
    sat(pomak, mjesni) {
      if (mjesni >= 11 && mjesni <= 18) {
        return { smjerOd: 230, brzina: 2.4, dubina: 800, izvor: "model", k1: null, k2: null };
      }
      return {
        // Smjer skače od sata do sata, a brzina nikad ne prijeđe tišinu.
        smjerOd: Math.round(sum(pomak, 7) * 360),
        brzina: Number((0.15 + sum(pomak, 8) * 0.3).toFixed(2)),
        dubina: 30 + Math.round(sum(pomak, 9) * 25),
        izvor: "model",
        k1: null,
        k2: null,
      };
    },
  },
  {
    ime: "okret",
    naziv: "Okret vjetra",
    opis: "S mora na kopneni vjetar kroz popodne; perjanica se premješta za 180°.",
    sada: "2026-08-27T17:00:00.000Z",
    sat(pomak, mjesni) {
      if (mjesni >= 10 && mjesni <= 16) {
        return { smjerOd: 220 + (mjesni - 10) * 2, brzina: 3, dubina: 900, ...ocitanjaNoci(mjesni, 0) };
      }
      if (mjesni >= 17 && mjesni <= 19) {
        // Tri sata okreta preko sjevera: 250° → 320° → 20°.
        const t = (mjesni - 17) / 2;
        const smjer = (mjesaj(250, 380, t) + 360) % 360;
        return { smjerOd: Math.round(smjer), brzina: Number(mjesaj(2, 1.2, t).toFixed(2)), dubina: Math.round(mjesaj(600, 150, t)), ...ocitanjaNoci(mjesni, 0.3) };
      }
      if (mjesni >= 20 || mjesni <= 2) {
        const h = mjesni >= 20 ? mjesni - 20 : mjesni + 4;
        return { smjerOd: 30 + h * 5, brzina: Number(Math.min(2.6, 1.6 + h * 0.3).toFixed(2)), dubina: 80, ...ocitanjaNoci(mjesni, 0.6) };
      }
      return { smjerOd: 40, brzina: 1.6, dubina: 70, ...ocitanjaNoci(mjesni, 0.5) };
    },
  },
  {
    ime: "nista",
    naziv: "Ništa u naseljima",
    opis: "Stalan zapadnjak uz dubok sloj nosi prema istočnim brdima.",
    sada: "2026-08-27T14:00:00.000Z",
    sat(pomak, mjesni) {
      const noc = mjesni >= 21 || mjesni <= 6;
      return {
        smjerOd: 250 + sum(pomak, 10) * 8,
        brzina: noc ? 3.2 : 4.5,
        dubina: noc ? 220 : 900,
        ...ocitanjaNoci(mjesni, 0.1),
      };
    },
  },
];

export const SCENARIJI: ReadonlyMap<ImeScenarija, Scenarij> = new Map(
  SCENARIJI_POPIS.map((s) => [s.ime, s]),
);

/** Je li niz slova ime scenarija; `?scenarij=` je slobodan tekst. */
export function jeScenarij(ime: string | null | undefined): ime is ImeScenarija {
  return ime !== null && ime !== undefined && SCENARIJI.has(ime as ImeScenarija);
}

/**
 * Slaže crtu scenarija istim putem kojim se slaže i živa.
 *
 * Args:
 *   ime: Ime scenarija.
 *
 * Returns:
 *   Crta s 24 sata unatrag, sadašnjim i tri unaprijed, ili `null` za
 *   nepoznato ime.
 */
export function crtaScenarija(ime: string): Crta | null {
  if (!jeScenarij(ime)) return null;
  const scenarij = SCENARIJI.get(ime)!;
  const sada = new Date(scenarij.sada);
  const vjetrovi = new Map<string, SatniVjetar>();
  const dubine = new Map<string, number>();
  const ocitanja = new Map<string, readonly OcitanjePostaje[]>();
  const okolnosti = new Map<string, OkolnostiSata>();

  for (let pomak = -(SATI_UNATRAG + SATI_ZALETA); pomak <= SATI_UNAPRIJED; pomak += 1) {
    const ms = sada.getTime() + pomak * 3600000;
    const sat = new Date(ms).toISOString();
    const u = scenarij.sat(pomak, mjesniSat(ms));
    // Prognoza je uvijek iz modela; prošlost s postaje, osim kad scenarij
    // izričito kaže da postaje šute. Sadašnji sat nosi Vrboran, kao uživo.
    const izvor: IzvorVjetra = pomak > 0 ? "model" : (u.izvor ?? (pomak === 0 ? "vrboran" : "split3"));
    const brzina = Number(u.brzina.toFixed(2));
    vjetrovi.set(sat, {
      sat,
      smjerOd: Number((((u.smjerOd % 360) + 360) % 360).toFixed(1)),
      brzina,
      tisina: brzina < TISINA,
      izvor,
    });
    dubine.set(sat, Math.max(25, Math.round(u.dubina)));
    okolnosti.set(sat, u.okolnosti ?? vedro(mjesniSat(ms)));

    // Tablice kasne dva sata; prognoza se ne mjeri (slozKadar to i sam pazi).
    const objavljeno = pomak <= -2;
    ocitanja.set(sat, [
      {
        postaja: "k1",
        tvar: "sumporovodik",
        vrijednost: objavljeno ? (u.k1 ?? null) : null,
        jedinica: "µg/m³",
        ispodGranice: false,
      },
      {
        postaja: "k2",
        tvar: "merkaptani",
        vrijednost: objavljeno ? (u.k2 ?? null) : null,
        jedinica: "µg/m³",
        ispodGranice: false,
      },
    ]);
  }

  return slozCrtu(sada, vjetrovi, dubine, ocitanja, okolnosti);
}
