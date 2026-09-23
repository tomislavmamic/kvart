/**
 * Pravila po kojima se čestica broji kao „iskorištena” i „u skladu s GUP-om”.
 *
 * Ovo je jedino mjesto koje treba dirati kad se mijenja način brojanja.
 * Mjerenja (koliko je piksela komada pod zgradom, cestom, zelenilom…)
 * dolaze gotova iz scripts/gup-grad/cestice.py; ovdje se samo odlučuje što
 * ta mjerenja znače. Izračun je u izracun.ts i čita isključivo ovaj objekt.
 *
 * Pojmovi:
 *  - komad   dio jedne katastarske čestice koji pada u jednu klasu namjene
 *            jedne godine plana (čestica na granici dviju zona ima dva komada)
 *  - vrsta   što na komadu stoji: skupina zgrade, promet, groblje/šport,
 *            održavano zelenilo — vidi VrstaKoristenja
 */
import type { KodKlase } from "./model";

/** Što na komadu stvarno stoji, iz mjerenja. */
export type VrstaKoristenja =
  | "stambena" // katastarska zgrada 1xx
  | "gospodarska" // 2xx — poslovne, industrijske, skladišta
  | "javna" // 3xx — škole, bolnice, crkve, uprava
  | "pomocna" // 4xx — garaže, spremišta
  | "ostala" // 6xx–9xx — nadstrešnice, trafostanice, objekti uz ceste
  | "neevidentirana" // zgrada iz gradskog 3D modela koje nema u katastru
  | "promet" // ulice i nogostupi (u namjeni P; u ostalim zonama se izuzimaju, vidi `ulice`)
  | "uredjeno" // groblja, športski objekti, parkirališta
  | "zelenilo"; // javno zelenilo koje održavaju Parkovi i nasadi

export type NacinBrojanja =
  /** Iskorišten je samo stvarno pokriveni dio (zgrada + promet + …). */
  | "udio"
  /** Komad je cijeli iskorišten čim je pokriven barem `prag` svoje površine. */
  | "prag"
  /** Komad je cijeli iskorišten čim na njemu išta stoji (najblaže). */
  | "cijela";

export type IzvorZgrada =
  /** Samo zgrade upisane u katastar (KO_*_objekti). */
  | "katastar"
  /**
   * Samo zgrade iz gradskog 3D modela (sloj Objekti_Split_2025, isti tlocrti
   * kao Zgrade_3D/ST_3D_2024) — vidi i neupisane, ali bez vrste.
   */
  | "model3d"
  /** Veće od to dvoje po komadu; vrstu daje katastar gdje je ima. */
  | "oba";

export interface Pravila {
  nacin: NacinBrojanja;
  /** Za `prag`: udio komada (0–1) koji mora biti pokriven. */
  prag: number;
  /**
   * Za `cijela`: najmanji pokriveni udio da se komad uopće računa kao
   * iskorišten. Štiti od krhotina — rub susjedne zgrade koji uklapanje
   * prebaci 2 m preko međe nije gradnja na čestici.
   */
  najmanjiTrag: number;
  zgrade: IzvorZgrada;
  /** Koja mjerenja uopće znače „iskorišteno”. */
  racunaj: {
    zgrade: boolean;
    promet: boolean;
    uredjeno: boolean;
    zelenilo: boolean;
  };
  /**
   * Ulice unutar obojene zone. GUP boji namjenom cijele blokove, a crta
   * samo glavne prometnice; nerazvrstane ceste, ulice i nogostupi unutar
   * stambene zone nisu stanovanje ni slobodno zemljište te zone. Kad je
   * `izuzmi`, površina ulice oduzima se od zone i pribraja „Ulicama i
   * infrastrukturi” (P).
   */
  ulice: {
    izuzmi: boolean;
    /**
     * Komad čestice pokriven ulicom barem ovolikim udjelom je sama ulica
     * (katastarska čestica puta) i izuzima se cijeli, ne samo traka od 7 m
     * oko osi ceste.
     */
    pragUlicneCestice: number;
  };
  /**
   * Premali ostaci. Slobodan dio čestice manji od najmanje površine koja
   * može služiti namjeni zone ne broji se kao slobodan — osim ako se
   * dodiruje sa slobodnom česticom iste namjene i zajedno dosežu tu
   * površinu (mogu se spojiti u građevnu česticu). Takav dio je „ostatak”:
   * ni iskorišten ni slobodan.
   */
  ostaci: {
    ukljuci: boolean;
    /** Najmanja površina (m²) koja može služiti namjeni; 0 = bez najmanje. */
    najmanjaPovrsina: Record<KodKlase, number>;
    /**
     * Čestica je „slobodna” (pa može spasiti susjedni ostatak) ako je na
     * njoj iskorišteno manje od ovog udjela.
     */
    slobodnaUdio: number;
  };
  /**
   * Koje vrste korištenja plan u pojedinoj klasi dopušta. Kombinirane
   * namjene (M1–M3 mješovita, K5 poslovna sa stanovanjem) dopuštaju više
   * vrsta odjednom. Kad je komad prema `prag`/`cijela` iskorišten, a
   * pokriven tek djelomično, nepokriveni ostatak dijeli sud pretežite vrste.
   */
  dopusteno: Record<KodKlase, readonly VrstaKoristenja[]>;
}

const SVE: readonly VrstaKoristenja[] = [
  "stambena",
  "gospodarska",
  "javna",
  "pomocna",
  "ostala",
  "neevidentirana",
  "promet",
  "uredjeno",
  "zelenilo",
];

/** Promet, pomoćne građevine i infrastruktura prolaze kroz svaku zonu. */
const UVIJEK: readonly VrstaKoristenja[] = ["promet", "ostala", "zelenilo"];

/**
 * Zadana pravila.
 *
 * `dopusteno` slijedi odredbe GUP-a na razini skupine namjene, ne pojedine
 * odredbe: stanovanje u M i S, gospodarstvo u I/K i M, javne zgrade u D i
 * mješovitim zonama. Za zgradu koje nema u katastru (`neevidentirana`) ne
 * znamo čemu služi, pa je u suprotnosti samo ondje gdje plan ne predviđa
 * nikakvu zgradu (zelenilo, rekreacija, plaže); u građevnim zonama je
 * dopuštena. Da se broji kao kuća, industrijske hale Sjeverne luke koje
 * nisu upisane ispale bi „stanovanje u gospodarskoj zoni”.
 *
 * Svjesno stroge točke, koje se lako olabave:
 *  - T (turizam): stambena zgrada je u suprotnosti (apartmanizacija
 *    turističkih zona je upravo ono što se želi vidjeti).
 *  - Z1/Z5, R2–R5: svaka zgrada osim pomoćne i infrastrukturne je u
 *    suprotnosti.
 *  - P (neobojeno: ulice, pruga, groblja): plan ondje ne propisuje namjenu
 *    zgrade, pa se ništa ne proglašava suprotnim.
 */
export const ZADANA_PRAVILA: Pravila = {
  nacin: "udio",
  prag: 0.2,
  najmanjiTrag: 0.03,
  zgrade: "oba",
  racunaj: { zgrade: true, promet: true, uredjeno: true, zelenilo: false },
  ulice: { izuzmi: true, pragUlicneCestice: 0.6 },
  ostaci: {
    ukljuci: true,
    // Pretpostavke, ne prepisane odredbe: 300 m² je red veličine najmanje
    // građevne čestice za obiteljsku kuću, a gospodarske i javne građevine
    // traže više. Zelenilo, rekreacija i plaže nemaju najmanju površinu —
    // tamo je i mala neizgrađena čestica upravo ono što plan hoće.
    najmanjaPovrsina: {
      S: 300,
      "M/K5": 300,
      D: 500,
      "I/K": 1000,
      T: 1000,
      L: 500,
      R1: 1000,
      R2: 0,
      R3: 0,
      R4: 0,
      R5: 0,
      Z1: 0,
      Z5: 0,
      N: 0,
      P: 0,
    },
    slobodnaUdio: 0.05,
  },
  dopusteno: {
    S: [...UVIJEK, "stambena", "pomocna", "neevidentirana", "javna"],
    // kombinirana: M1 pretežito stambena, M2 stambena i poslovna, M3
    // stanovanje i turizam, K5 poslovna sa stanovanjem — list ih boji istom
    // bojom, pa dopušta i stanovanje i poslovanje
    "M/K5": [...UVIJEK, "stambena", "gospodarska", "javna", "pomocna", "neevidentirana", "uredjeno"],
    D: [...UVIJEK, "javna", "pomocna", "uredjeno", "neevidentirana"],
    "I/K": [...UVIJEK, "gospodarska", "pomocna", "uredjeno", "neevidentirana"],
    T: [...UVIJEK, "gospodarska", "pomocna", "uredjeno", "neevidentirana"],
    L: [...UVIJEK, "gospodarska", "pomocna", "uredjeno", "neevidentirana"],
    R1: [...UVIJEK, "uredjeno", "javna", "pomocna", "gospodarska", "neevidentirana"],
    R2: [...UVIJEK, "uredjeno", "pomocna"],
    R3: [...UVIJEK, "uredjeno", "pomocna"],
    R4: [...UVIJEK, "uredjeno"],
    R5: [...UVIJEK, "uredjeno", "pomocna"],
    Z1: [...UVIJEK, "uredjeno"],
    Z5: [...UVIJEK, "pomocna"],
    N: SVE,
    P: SVE,
  },
};

/**
 * Nekoliko gotovih načina brojanja koje stranica nudi na izbor. Brojke za
 * svaki računaju se unaprijed na poslužitelju, pa preglednik ne dobiva
 * podatke o česticama nego samo zbrojeve.
 */
export const INACICE: readonly {
  id: string;
  naziv: string;
  opis: string;
  pravila: Pravila;
}[] = [
  {
    id: "udio",
    naziv: "Pokriveni dio",
    opis:
      "Iskorišteno je samo ono što je stvarno pokriveno: tlocrt zgrade, cesta, parkiralište, groblje ili športski objekt. Dvorište i vrt ostaju slobodni.",
    pravila: ZADANA_PRAVILA,
  },
  {
    id: "prag",
    naziv: "Iznad 20 %",
    opis:
      "Komad čestice je cijeli iskorišten ako je pokriven barem petinom — kuća s dvorištem broji se kao cijela čestica.",
    pravila: { ...ZADANA_PRAVILA, nacin: "prag", prag: 0.2 },
  },
  {
    id: "cijela",
    naziv: "Sve s gradnjom",
    opis:
      "Komad čestice je cijeli iskorišten čim na njemu išta stoji. Najširi mogući odgovor na „koliko je potrošeno”.",
    pravila: { ...ZADANA_PRAVILA, nacin: "cijela" },
  },
];
