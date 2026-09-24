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
  | "parkiraliste" // javna i privatna parkirališta, garažni nizovi (Grad, OSM)
  | "uredjeno" // groblja, športski tereni, igrališta, trgovi i pješačke površine
  | "zelenilo" // javno zelenilo koje održavaju Parkovi i nasadi, parkovi iz OSM-a
  | "gradiliste" // gradilište (OSM) — gradi se, ne zna se što
  /**
   * Neizgrađeni dio građevne čestice postojeće zgrade: dvorište, vrt,
   * prilaz. Nije pokriven, ali ne može primiti novu zgradu — vidi
   * `nacin: "gradevna"`. Sud (u skladu / protivno) dijeli sa zgradom.
   */
  | "okucnica";

export type NacinBrojanja =
  /**
   * Kao građevna čestica po odredbama: zgrada troši onoliko čestice koliko
   * joj plan propisuje (tlocrt / kig, a ne manje od Ppmin), a ostatak je
   * slobodan samo ako je dovoljno velik za novu građevnu česticu i ako
   * plan ondje uopće dopušta novu gradnju.
   */
  | "gradevna"
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
    parkiralista: boolean;
    /** okoliš škola, vrtića, bolnica, crkava — broji se kao javna */
    javneUstanove: boolean;
    uredjeno: boolean;
    /** trafostanice, vodospreme, benzinske postaje, pruga */
    infrastruktura: boolean;
    zelenilo: boolean;
    gradilista: boolean;
    /** ispravci iz ručnog pregleda ortofotom (data/gup-grad/pregled/rucno.json) */
    rucniPregled: boolean;
  };
  /** Za `gradevna`. */
  gradevna: {
    /**
     * Najveći koeficijent izgrađenosti (kig) kad ga odredbe za područje
     * ne propisuju. null = tada se cijeli komad sa zgradom broji kao
     * njezina građevna čestica.
     */
    zadaniKig: number | null;
    /**
     * Tlocrt glavne zgrade (m²) ispod kojeg komad nema zgradu nego
     * krhotinu susjedne — rub tuđeg krova koji uklapanje prebaci preko međe.
     */
    najmanjaZgradaM2: number;
    /**
     * Građevna čestica preko međe: kad zgradi na vlastitoj čestici
     * nedostaje zemljišta koje traže kig/kis/Ppmin, uzima ga sa susjednih
     * čestica bez zgrade koje same nisu nova građevna čestica (vrt uz kuću
     * upisan kao zasebna čestica). Izracun.ts, `posudiOkucnice`.
     */
    prekoMede: boolean;
  };
  /**
   * Slobodno zemljište u području urbanog pravila u kojem odredbe ne
   * dopuštaju novu stambenu gradnju („dovršena naselja”: samo
   * rekonstrukcija postojećih) nije slobodno za stanovanje. Broji se
   * odvojeno, kao „plan ne dopušta gradnju”.
   */
  postujZabraneGradnje: boolean;
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
   * Premali ostaci. Slobodan dio čestice manji od najmanje građevne čestice
   * koju odredbe GUP-a propisuju za njegovo područje urbanog pravila i
   * namjenu (Ppmin, odredbe.ts) ne broji se kao slobodan — osim ako se
   * dodiruje sa slobodnom česticom iste namjene i zajedno dosežu tu
   * površinu (mogu se spojiti u građevnu česticu). Takav dio je „ostatak”:
   * ni iskorišten ni slobodan. Gdje odredbe Ppmin ne propisuju, pravila
   * nema.
   */
  ostaci: {
    ukljuci: boolean;
    /**
     * Koje vrste gradnje iz odredbi određuju najmanju česticu za
     * stanovanje. Uzima se najmanja od uključenih; interpolacija (nova
     * čestica između dvije izgrađene) je upravo slučaj praznine u
     * izgrađenom nizu, a niz (180 m²) odredbe dopuštaju samo kroz UPU.
     */
    tipovi: {
      slobodnostojeca: boolean;
      dvojna: boolean;
      interpolacija: boolean;
      /** Ppmin bez navedene vrste građevine (npr. 2.3: 500 m²). */
      opcenito: boolean;
      niz: boolean;
    };
    /**
     * Čestica je „slobodna” (pa može spasiti susjedni ostatak) ako je na
     * njoj iskorišteno manje od ovog udjela.
     */
    slobodnaUdio: number;
    /**
     * Slobodno zemljište uže od ~9 m (put, stube, pojas uz nogostup, rub
     * uz zgradu) je ostatak. Odredbe traže građevnu česticu široku barem
     * 10 m (dvojna; slobodnostojeća 12–16 m; niz od 6 m samo kroz UPU).
     * Širina se mjeri na slobodnom zemljištu, ne na čestici (cestice.py,
     * polje `us`), pa mala čestica usred livade ostaje slobodna.
     */
    uski: boolean;
    /**
     * Najmanja čestica za stanovanje gdje je odredbe za područje ne
     * propisuju, a gradnju dopuštaju (1.2, 3.3, gradski projekti): najmanja
     * koju plan igdje propisuje za stanovanje — dvojna u 1.3 i 1.5, 250 m².
     */
    bezPpminM2: number;
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
  "parkiraliste",
  "uredjeno",
  "zelenilo",
  "gradiliste",
  "okucnica",
];

/**
 * Promet, javna parkirališta, komunalna infrastruktura i zelenilo prolaze
 * kroz svaku zonu (čl. 8).
 */
const UVIJEK: readonly VrstaKoristenja[] = ["promet", "parkiraliste", "ostala", "zelenilo"];

/**
 * Zadana pravila.
 *
 * `dopusteno` slijedi odredbe za provođenje (izvadak s citatima:
 * data/gup-grad/odredbe/izvor/dopusteno.json; str. = Sl. gl. 55/14). U
 * skladu je ono što odredbe dopuštaju OPĆENITO; ono što dopuštaju samo pod
 * posebnim uvjetom koji zgrada iz katastra ne može pokazati (stan uz
 * poslovni prostor u K na čestici od 2000 m²) broji se kao protivno. Čl. 8: ulice, javna parkirališta i komunalne građevine
 * grade se na površinama svih namjena. Za zgradu koje nema u katastru (`neevidentirana`) ne
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
  nacin: "gradevna",
  prag: 0.2,
  najmanjiTrag: 0.03,
  zgrade: "oba",
  racunaj: {
    zgrade: true,
    promet: true,
    parkiralista: true,
    javneUstanove: true,
    uredjeno: true,
    infrastruktura: true,
    zelenilo: true,
    gradilista: true,
    rucniPregled: true,
  },
  gradevna: { zadaniKig: null, najmanjaZgradaM2: 20, prekoMede: true },
  postujZabraneGradnje: true,
  ulice: { izuzmi: true, pragUlicneCestice: 0.6 },
  ostaci: {
    ukljuci: true,
    tipovi: { slobodnostojeca: true, dvojna: true, interpolacija: true, opcenito: true, niz: false },
    slobodnaUdio: 0.05,
    uski: true,
    bezPpminM2: 250,
  },
  dopusteno: {
    // str. 3: stanovanje, uz njega javni i poslovni sadržaji (trgovine na
    // zasebnoj čestici do 1000 m²); pomoćne samo uz stambenu građevinu
    // str. 3: stanovanje, uz njega javni i poslovni sadržaji, manji
    // športsko-rekreacijski sadržaji i igrališta
    S: [...UVIJEK, "stambena", "pomocna", "neevidentirana", "gradiliste", "javna", "gospodarska", "uredjeno"],
    // kombinirana: M1 pretežito stambena, M2 stambena i poslovna, M3
    // stanovanje i turizam, K5 poslovna sa stanovanjem — list ih boji istom
    // bojom, pa dopušta i stanovanje i poslovanje
    "M/K5": [...UVIJEK, "stambena", "gospodarska", "javna", "pomocna", "neevidentirana", "gradiliste", "uredjeno"],
    // str. 5: u D se ne grade stambene ni poslovne građevine
    D: [...UVIJEK, "javna", "pomocna", "uredjeno", "neevidentirana", "gradiliste"],
    // str. 5: I/K gospodarske i prateće javne; stan samo uz posao na ≥2000 m²
    "I/K": [...UVIJEK, "gospodarska", "javna", "pomocna", "uredjeno", "neevidentirana", "gradiliste"],
    // str. 5: u T nije dopušteno stanovanje (ni povremeno); 2025. samo hoteli
    T: [...UVIJEK, "gospodarska", "javna", "pomocna", "uredjeno", "neevidentirana", "gradiliste"],
    L: [...UVIJEK, "gospodarska", "pomocna", "uredjeno", "neevidentirana", "gradiliste"],
    R1: [...UVIJEK, "uredjeno", "javna", "pomocna", "gospodarska", "neevidentirana", "gradiliste"],
    // str. 6: rekreacija i kupališta — manji ugostiteljski i pomoćni sadržaji
    R2: [...UVIJEK, "uredjeno", "pomocna", "gospodarska"],
    R3: [...UVIJEK, "uredjeno", "pomocna", "gospodarska"],
    // 2025.: prirodne plaže — odredbe ne predviđaju gradnju
    R4: [...UVIJEK, "uredjeno"],
    R5: [...UVIJEK, "uredjeno", "pomocna"],
    // str. 6 (čl. 71): u parku manje pomoćne građevine u funkciji parka,
    // paviljoni, sanitarni čvorovi; stambene i poslovne ne (kuće na Marjanu
    // su do 2025. tolerirane „do prenamjene ili uklanjanja”, ne u skladu)
    Z1: [...UVIJEK, "uredjeno", "pomocna", "javna"],
    // str. 7: zaštitno zelenilo — javne i rekreacijske građevine samo gdje
    // pravila područja to kažu; privatne garaže i spremišta ne
    Z5: [...UVIJEK],
    // str. 7: Z6 (Meje, Bačvice) — postojeće građevine dio su zaštićenog
    // krajobraza, pa su postojeće kuće s pomoćnim građevinama u skladu.
    // Odvaja se od Z5 po natpisima na listu 2025. (scripts/gup-grad/z6.py).
    Z6: [...UVIJEK, "stambena", "pomocna", "neevidentirana"],
    // str. 7: posebna namjena — ne stambene ni poslovne
    N: [...UVIJEK, "javna", "pomocna", "uredjeno", "neevidentirana", "gradiliste"],
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
    id: "gradevna",
    naziv: "Po odredbama",
    opis:
      "Zgrada troši onoliko čestice koliko joj odredbe propisuju (tlocrt kroz najveći koeficijent izgrađenosti, a ne manje od najmanje građevne čestice). Vrt uz kuću slobodan je samo ako na njega stane nova građevna čestica i ako plan ondje dopušta novu gradnju.",
    pravila: ZADANA_PRAVILA,
  },
  {
    id: "udio",
    naziv: "Samo tlocrt",
    opis:
      "Iskorišteno je samo ono što je stvarno pokriveno: tlocrt zgrade, cesta, parkiralište, igralište, park. Svako dvorište i vrt broje se kao slobodni — najstroži odgovor.",
    pravila: { ...ZADANA_PRAVILA, nacin: "udio" },
  },
  {
    id: "cijela",
    naziv: "Sve s gradnjom",
    opis:
      "Komad čestice je cijeli iskorišten čim na njemu išta stoji. Najširi mogući odgovor na „koliko je potrošeno”.",
    pravila: { ...ZADANA_PRAVILA, nacin: "cijela" },
  },
];
