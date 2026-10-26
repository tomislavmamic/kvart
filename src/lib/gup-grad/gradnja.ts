/**
 * /gup/gradnja: gdje se po novom GUP-u (prijedlog izmjena 2025.) neće moći
 * graditi ništa novo, a gdje ništa stambeno ni stambeno-poslovno.
 *
 * Nema vlastitog izračuna. Svaki piksel od ~2 m u obuhvatu GUP-a već ima
 * namjenu i regiju iz pločica „dijelova čestice” (scripts/gup-grad/regije.py,
 * način brojanja „po odredbama”, isti kao zbrojevi na /gup): što na tom
 * mjestu stoji i, ako je slobodno, zašto nije za gradnju. Ovdje se to samo
 * svede na jedan razlog po pikselu, redom kojim bi ga pitao onaj tko želi
 * graditi:
 *
 *  1. je li mjesto već zauzeto (zgrada, dvorište zgrade, ulica, parkiralište,
 *     park, igralište, okoliš škole, infrastruktura)
 *  2. predviđa li namjena GUP-a ondje zgrade uopće (zelenilo, rekreacija,
 *     plaže ne; ulice, pruga i groblja su rezervirani za sebe, kao i
 *     koridori ulica koje list 1 ostavlja neobojenima između zona —
 *     scripts/gup-grad/koridori.py)
 *  3. dopuštaju li odredbe urbanog pravila novu zgradu (ili samo
 *     rekonstrukciju), je li teren izgradiv
 *  4. čeka li gradnja UPU (list 4.d, čl. 103.) — u neuređenom dijelu uz
 *     postojeću javnu cestu ne čeka, a javne i društvene zgrade (D) smiju se
 *     graditi i prije UPU-a (čl. 105. st. 5.)
 *  5. je li slobodno dovoljno veliko i široko za građevnu česticu, i nije li
 *     čestica u praksi put (scripts/gup-grad/gradnja-skupine.py)
 *  6. dopušta li namjena stanovanje (S, M1–M3, K5) ili samo drugo
 *
 * Isti modul koriste skripta koja piše pločice i zbrojeve
 * (scripts/gup-grad/gradnja.ts) i karta, pa ne mogu reći drugo.
 */
import type { KodKlase } from "./model";
import { KLASA_PO_INDEKSU } from "./model";
import { REGIJE } from "./regije";

/** Što namjena GUP-a na slobodnom zemljištu dopušta graditi. */
export type ZonaGradnje =
  /** stanovanje, samo ili uz poslovanje (S, M1–M3, K5) */
  | "stambena"
  /** zgrade, ali ne stambene: javne, gospodarske, turističke, šport, luke, vojska */
  | "nestambena"
  /** plan ondje ne predviđa zgrade (park, zaštitno zelenilo, rekreacija, plaže) */
  | "bez-zgrada"
  /** ulice, pruga, groblja i infrastrukturni koridori */
  | "promet";

/**
 * Prema dopuštenim vrstama u pravila.ts (`dopusteno`, s citatima odredbi):
 *  - D, I/K, T, L, R1, N: stambena zgrada nije dopuštena (u I/K stan samo
 *    uz posao na čestici od 2000 m², što ovdje nije stambena gradnja);
 *  - R5 golf: „golf igralište s 18 polja i prateći sadržaji bez smještajnih
 *    kapaciteta” (odredbe 2025.) — igralište, ne zemljište za zgrade, pa je
 *    kao rekreacija;
 *  - R2, R3: samo manji ugostiteljski i pomoćni sadržaji uz rekreaciju i
 *    kupalište, R4 prirodna plaža bez ikakve gradnje, Z1 park samo paviljoni
 *    i sanitarni čvorovi, Z5 ništa, Z6 samo postojeće kuće.
 */
export const ZONA_GRADNJE: Record<KodKlase, ZonaGradnje> = {
  S: "stambena",
  "M/K5": "stambena",
  D: "nestambena",
  "I/K": "nestambena",
  T: "nestambena",
  L: "nestambena",
  R1: "nestambena",
  R5: "bez-zgrada",
  N: "nestambena",
  R2: "bez-zgrada",
  R3: "bez-zgrada",
  R4: "bez-zgrada",
  Z1: "bez-zgrada",
  Z5: "bez-zgrada",
  Z6: "bez-zgrada",
  P: "promet",
};

/** Što namjena dopušta, rečenicom (za tumač klika). */
export const OPIS_ZONE: Record<ZonaGradnje, string> = {
  stambena: "stanovanje je dopušteno, u stambenim i u stambeno-poslovnim zgradama",
  nestambena: "smiju se graditi zgrade, ali ne stambene",
  "bez-zgrada": "zgrade se ne grade, osim manjih pratećih (paviljon, sanitarni čvor, kiosk)",
  promet: "zemljište se čuva za ulice, prugu, groblja i infrastrukturu",
};

/**
 * Odgovor na pitanje „mogu li ovdje graditi?”, od najstrožeg. Neuređeni dio
 * (do UPU-a gradi se samo uz postojeću javnu cestu) ide u skupinu svoje
 * namjene — nestambeno ili stambeno — istom bojom, ali šrafirano.
 */
export type Skupina = "nista" | "nestambeno" | "stambeno" | "javno";

export const SKUPINE_GRADNJE: Record<Skupina, { naslov: string; kratko: string; glavna: IdKategorije; uvjetna?: IdKategorije }> = {
  nista: { naslov: "Ne može se graditi ništa novo", kratko: "Ništa novo", glavna: "zgrada" },
  nestambeno: {
    naslov: "Može se graditi, ali ne stambena zgrada",
    kratko: "Može, ali ne stambena",
    glavna: "nestambeno",
    uvjetna: "uz-cestu-nestambeno",
  },
  stambeno: {
    naslov: "Može se graditi i stambena zgrada",
    kratko: "Može i stambena",
    glavna: "stambeno",
    uvjetna: "uz-cestu-stambeno",
  },
  // javno zemljište i vojska nisu zemljište na kojem građanin gradi, pa se ne broje ni u jedan od tri odgovora
  javno: { naslov: "Javno zemljište", kratko: "Javno zemljište", glavna: "javno" },
};

export type IdKategorije =
  | "zgrada"
  | "okucnica"
  | "koristeno"
  | "ulica"
  | "rezerva-prometa"
  | "koridor"
  | "bez-zgrada"
  | "samo-rekonstrukcija"
  | "neizgradivo"
  | "premalo"
  | "put"
  | "odmaci"
  | "odmak"
  | "ostatak-kuce"
  | "gradski-projekt"
  | "vojska"
  | "javno"
  | "javni-pojas"
  | "ceka-upu"
  | "uz-cestu-stambeno"
  | "uz-cestu-nestambeno"
  | "nestambeno"
  | "stambeno";

export interface Kategorija {
  /** Broj u kanalu B pločica public/geo/gup-grad/gradnja (1…). */
  kod: number;
  id: IdKategorije;
  skupina: Skupina;
  /** Za legendu. */
  naziv: string;
  /** Što priječi gradnju (ili što je dopušteno), jednom rečenicom. */
  razlog: string;
  boja: string;
  /** Neprozirnost ispune, 0–1. */
  alfa: number;
  /** Kose pruge te boje preko ispune: gradnja samo uz uvjet (neuređeni dio, uz postojeću cestu). */
  pruge?: string;
  /** Pruge u oba smjera (mreža): čeka UPU — drukčiji uzorak od uvjetne gradnje, ne samo drukčija boja. */
  mreza?: boolean;
  /** Neprozirnost pruga, 0–1 (zadano 0,9). */
  prugeAlfa?: number;
}

/**
 * Boja nosi odgovor, ne razlog: tri odgovora, tri boje, a razlog kaže klik i
 * tumač. „Ništa novo” je bijela koprena koja izblijedi snimku; plavo je
 * nestambeno, zeleno stambeno. Puna jaka boja: gradi se danas; blijeda
 * inačica iste boje s prugama: neuređeni dio, do UPU-a samo uz postojeću
 * cestu. Blijedo i jako razlikuju se svjetlinom (ΔE ~15 i stopljeno sa
 * snimkom), pa se razlikuju i izdaleka, gdje preglednik pruge zagladi; uz to
 * karta pruge izdaleka razmiče (gradnja-karta.tsx, prugeZaZum). Čekanje na UPU
 * je siva mreža na koprenama — crvena bi se daltonistima stopila sa zelenom
 * šrafurom. Provjereno validatorom na bojama stopljenim sa sivom snimkom
 * (#747474–#cdcdcd).
 */
export const KATEGORIJE: readonly Kategorija[] = [
  {
    kod: 1,
    id: "zgrada",
    skupina: "nista",
    naziv: "Zgrada ili gradilište",
    razlog:
      "Ovdje već stoji zgrada ili se gradi. Smjet će se obnoviti ili zamijeniti, ali uz nju se nova neće moći dodati.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 2,
    id: "okucnica",
    skupina: "nista",
    naziv: "Dvorište postojeće zgrade",
    razlog:
      "Ovo zemljište pripada postojećoj zgradi. Pravila svakoj zgradi propisuju koliko čestice mora imati oko sebe, pa nova zgrada ovdje ne stane.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 3,
    id: "koristeno",
    skupina: "nista",
    naziv: "Parkiralište, park, igralište ili okoliš škole",
    razlog:
      "Mjesto se već koristi za nešto drugo: parkiralište, park koji održava Grad, igralište, trg, groblje ili okoliš javne ustanove.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 4,
    id: "ulica",
    skupina: "nista",
    naziv: "Postojeća ulica, pruga ili infrastruktura",
    razlog:
      "Ovdje je postojeća ulica, put, pruga ili komunalna građevina (trafostanica, vodosprema, crpka).",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 5,
    id: "rezerva-prometa",
    skupina: "nista",
    naziv: "Čuva se za ulicu, prugu ili groblje",
    razlog:
      "Zemljište je slobodno, ali ga novi GUP ne daje za gradnju: čuva ga za ulicu, prugu, groblje ili infrastrukturu.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 14,
    id: "koridor",
    skupina: "nista",
    naziv: "Pojas ulice između blokova",
    razlog:
      "Zemljište je slobodno, ali je na karti namjene (list 1 novog GUP-a) ovo neobojeni pojas između zona: prostor za postojeću ili buduću ulicu. Na njemu se neće graditi.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 6,
    id: "bez-zgrada",
    skupina: "nista",
    naziv: "Park, zelenilo, rekreacija, golf ili plaža",
    razlog:
      "Novi GUP ovdje predviđa park, zaštitno zelenilo, rekreaciju, golf igralište ili plažu. Zgrade se neće graditi, osim manjih pratećih (paviljon, sanitarni čvor, kiosk, klupska kuća golfa).",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 7,
    id: "samo-rekonstrukcija",
    skupina: "nista",
    naziv: "Samo obnova postojećih zgrada",
    razlog:
      "Zemljište je slobodno i u zoni za stanovanje, ali pravila gradnje za ovaj dio grada neće dopustiti novu stambenu zgradu. Postojeće zgrade smiju se samo obnoviti ili zamijeniti (rekonstrukcija i zamjena).",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 8,
    id: "neizgradivo",
    skupina: "nista",
    naziv: "Teren nije za gradnju",
    razlog:
      "Na snimci iz zraka (ortofotu) vidi se da se ovdje ne može graditi: strmina, stijena ili korito.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 9,
    id: "premalo",
    skupina: "nista",
    naziv: "Premalo ili preusko za gradnju",
    razlog:
      "Slobodno je, ali nova zgrada ne stane. Komad je manji od najmanje čestice za gradnju koju ovdje traže pravila, ili je preuzak: ni sa slobodnim susjedima nema dijela širokog barem 10 m. Obično je to pojas uz put, stube ili rub uz među.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 23,
    id: "ostatak-kuce",
    skupina: "nista",
    naziv: "Ostatak čestice uz postojeću zgradu",
    razlog:
      "Na ovoj čestici već stoji zgrada, a ona troši česticu. Nova zgrada smjela bi se graditi samo kad bi se ostatak mogao odvojiti u vlastitu građevnu česticu od barem 400 m², široku barem 10 m. Ovaj ostatak to nije.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 21,
    id: "odmak",
    skupina: "nista",
    naziv: "Odmak od ulice i susjeda (dvorište nove zgrade)",
    razlog:
      "Ovo je dio slobodnog zemljišta na kojem se može graditi, ali zgrada ovdje ne smije stajati: mora biti 5 m od javne ulice i 3 m od susjednih čestica. Ovdje može biti dvorište, prilaz ili parkiralište nove zgrade.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 20,
    id: "odmaci",
    skupina: "nista",
    naziv: "Zgrada ne stane uz propisane odmake",
    razlog:
      "Slobodno je i dovoljno široko za česticu, ali zgrada mora biti 5 m od javne ulice i 3 m od susjednih čestica. Kad se ti odmaci oduzmu, ne ostaje 150 m² mjesta za zgradu široku barem 8 m.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 16,
    id: "put",
    skupina: "nista",
    naziv: "Uska duga čestica, zapravo put",
    razlog:
      "Čestica je uska i duga i služi kao put: njome prolazi ucrtani put (OpenStreetMap), ili graniči s mnogo čestica kojima služi kao prilaz, ili cijelom dugom stranom leži uz ulicu (rub ceste, nogostup). Na putu se neće graditi, a susjedne čestice ne mogu se preko njega spojiti.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 10,
    id: "ceka-upu",
    skupina: "nista",
    naziv: "Ništa novo dok se ne donese UPU",
    razlog:
      "Ovo je područje urbane sanacije ili preobrazbe (list 4.d novog GUP-a). Nova zgrada moći će se graditi tek po UPU-u, detaljnijem planu koji mora donijeti Grad. Do tada se postojeće zgrade smiju samo obnoviti ili zamijeniti.",
    boja: "#ffffff",
    alfa: 0.45,
    pruge: "#52525b",
    prugeAlfa: 0.8,
    mreza: true,
  },
  {
    kod: 17,
    id: "gradski-projekt",
    skupina: "nista",
    naziv: "Gradski projekt: ništa novo dok se ne odobri",
    razlog:
      "Ovo je područje gradskog projekta (urbano pravilo GP na listu 4.c novog GUP-a). Ondje se gradi samo po odobrenom projektu za cijelo područje, i samo ono što projekt predvidi. Dok projekta nema, na slobodnom zemljištu neće se moći graditi.",
    boja: "#ffffff",
    alfa: 0.45,
    pruge: "#52525b",
    prugeAlfa: 0.8,
    mreza: true,
  },
  {
    kod: 11,
    id: "uz-cestu-stambeno",
    skupina: "stambeno",
    naziv: "Stambena zgrada, ali samo ako do čestice vodi javna cesta",
    razlog:
      "Ovo je neuređeno područje: zemljište za gradnju na kojem još nema ulica i odvodnje koje plan predviđa. Novi GUP ovdje traži UPU. Dok ga nema, dozvola za novu stambenu zgradu moći će se dobiti samo ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja.",
    boja: "#a1ccb1",
    alfa: 0.65,
    pruge: "#15803d",
  },
  {
    kod: 15,
    id: "uz-cestu-nestambeno",
    skupina: "nestambeno",
    naziv: "Nestambena zgrada, ali samo ako do čestice vodi javna cesta",
    razlog:
      "Ovo je neuređeno područje u zoni bez stanovanja. Stambena zgrada neće se moći graditi ni nakon UPU-a. Nestambena će se do UPU-a moći graditi samo ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja.",
    boja: "#a8c1f7",
    alfa: 0.65,
    pruge: "#2563eb",
  },
  {
    kod: 12,
    id: "nestambeno",
    skupina: "nestambeno",
    naziv: "Mjesto za nestambenu zgradu",
    razlog:
      "Ovdje može stajati nova zgrada, dovoljno daleko od ulice (5 m) i susjeda (3 m), ali novi GUP ovdje predviđa javnu, gospodarsku, turističku ili športsku namjenu, pa stambena zgrada neće biti dopuštena.",
    boja: "#2563eb",
    alfa: 0.8,
  },
  {
    kod: 13,
    id: "stambeno",
    skupina: "stambeno",
    naziv: "Mjesto za stambenu zgradu",
    razlog:
      "Ovdje može stajati nova stambena ili stambeno-poslovna zgrada: zemljište je slobodno, dovoljno veliko, u zoni gdje novi GUP dopušta stanovanje, i dovoljno daleko od ulice (5 m) i susjeda (3 m). Vrijedi ako to dopuste i uvjeti koje karta ne provjerava.",
    boja: "#15803d",
    alfa: 0.85,
  },
  {
    kod: 19,
    id: "javno",
    skupina: "javno",
    naziv: "Zemljište Grada, države, županije ili njihovih ustanova i tvrtki",
    razlog:
      "Na javnom zemljištu ne gradi građanin, pa se ono ne broji ni u jedan od tri odgovora, bilo izgrađeno ili ne.",
    boja: "#ca8a04",
    alfa: 0.8,
  },
  {
    kod: 22,
    id: "javni-pojas",
    skupina: "javno",
    naziv: "Uski pojas javnog zemljišta (ulica, rub ceste, put)",
    razlog:
      "Ovo je javno zemljište uže od 10 m: ulica, rub ceste, put, prolaz ili ostatak uz cestu, u vlasništvu države, Grada ili njihovih tvrtki. Na njemu se ne gradi. Karta ga ne boji jantarno, da tanke trake ne prekriju kartu.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 18,
    id: "vojska",
    skupina: "javno",
    naziv: "Vojna zona (posebna namjena)",
    razlog:
      "Novi GUP ovdje predviđa posebnu namjenu: zemljište za potrebe obrane (npr. Lora). Ondje se ne gradi za stanovanje ni za tržište, pa se ne broji ni u jedan od tri odgovora.",
    boja: "#ca8a04",
    alfa: 0.8,
  },
];

/**
 * Bajt kategorije u pločici (kanal B): donjih 5 bitova je razlog
 * (`kod` kategorije), gornja tri vlasnik javnog zemljišta (VLASNIK_JAVNOG;
 * 0 nije javno ili se ne zna). Javno zemljište tako zadrži i razlog ispod
 * sebe, za tumač klika i kad se stavka „Javno” ugasi.
 */
export const VLASNIK_JAVNOG = {
  1: "Republika Hrvatska",
  2: "Grad Split",
  3: "Splitsko-dalmatinska županija",
  4: "javna ustanova ili tvrtka države ili Grada",
} as const;
export type KodVlasnika = keyof typeof VLASNIK_JAVNOG;
export const kodPiksela = (kategorija: number, vlasnik: number) => (kategorija & 31) | ((vlasnik & 7) << 5);
export const razlozi = (bajt: number) => ({ kategorija: bajt & 31, vlasnik: (bajt >> 5) & 7 });

export const KATEGORIJA_PO_KODU: ReadonlyMap<number, Kategorija> = new Map(KATEGORIJE.map((k) => [k.kod, k]));
export const KATEGORIJA_PO_ID: Record<IdKategorije, Kategorija> = Object.fromEntries(KATEGORIJE.map((k) => [k.id, k])) as Record<
  IdKategorije,
  Kategorija
>;

/** Zona gradnje za indeks klase iz pločice (R); null za nepoznatu klasu. */
export function zonaKlase(klasa: number): ZonaGradnje | null {
  const kl = KLASA_PO_INDEKSU.get(klasa);
  return kl ? ZONA_GRADNJE[kl.kod] : null;
}

/** Ono o pikselu što pločica dijelova čestice ne nosi, a izvedeno je iz drugih slojeva. */
export interface UvjetiPiksela {
  /** u neuređenom dijelu s lista 4.d (zabrana-2025.geojson) */
  neuredeno?: boolean;
  /** u neobojenom koridoru ulice s lista 1 koji je rasterizacija upila u zonu (koridori.py) */
  koridor?: boolean;
  /** na čestici koja je u praksi put (gradnja-skupine.py) */
  put?: boolean;
  /** slobodno, ali ni sa slobodnim susjedima u njega ne stane tlocrt (gradnja-skupine.py) */
  preusko?: boolean;
  /** slobodno i široko, ali zgrada uz odmake od ulice i međa ne stane (gradnja-skupine.py) */
  odmaci?: boolean;
  /** dio gradilišta u odmaku od ulice ili međa: zgrada ovdje ne smije stajati (gradnja-skupine.py) */
  odmak?: boolean;
  /** ostatak čestice s kućom koji se ne može odvojiti u svoju građevnu česticu (gradnja-skupine.py) */
  ostatakKuce?: boolean;
  /** na čestici s urbanim pravilom GP — gradski projekt (gradnja-javno.py) */
  gradskiProjekt?: boolean;
}

/** Ishodi u kojima bi se moglo graditi — samo njih poništava preusko zemljište. */
const GRADIVE: readonly IdKategorije[] = ["stambeno", "nestambeno", "uz-cestu-stambeno", "uz-cestu-nestambeno"];

/**
 * Jedan razlog za piksel: `klasa` i `regija` iz pločice dijelova čestice
 * (R, G) i `uvjeti` iz drugih slojeva (UvjetiPiksela). Vraća kod kategorije
 * ili 0 kad piksel nije na čestici u obuhvatu.
 */
export function kategorija(klasa: number, regija: number, uvjeti: UvjetiPiksela = {}): number {
  const {
    neuredeno = false,
    koridor = false,
    put = false,
    preusko = false,
    odmaci = false,
    odmak = false,
    ostatakKuce = false,
    gradskiProjekt = false,
  } = uvjeti;
  const z = zonaKlase(klasa);
  const zona = z && koridor ? "promet" : z;
  if (!zona || regija <= 0) return 0;
  const K = KATEGORIJA_PO_ID;
  // vojna zona cijela, izgrađena ili ne: u izvozu vlasnika Grada nije upisana kao državna
  if (KLASA_PO_INDEKSU.get(klasa)?.kod === "N") return K.vojska.kod;
  // 1. zauzeto
  switch (regija) {
    case REGIJE.zgrada:
    case REGIJE.gradiliste:
      return K.zgrada.kod;
    case REGIJE.okucnica:
      return K.okucnica.kod;
    case REGIJE.parkiraliste:
    case REGIJE.javna:
    case REGIJE.uredjeno:
    case REGIJE.zelenilo:
      return K.koristeno.kod;
    case REGIJE.ulica:
    case REGIJE.infrastruktura:
      return K.ulica.kod;
  }
  // 2. slobodno, ali namjena ne predviđa zgrade
  if (zona === "promet") return koridor ? K.koridor.kod : K["rezerva-prometa"].kod;
  if (zona === "bez-zgrada") return K["bez-zgrada"].kod;
  if (put) return K.put.kod;
  if (gradskiProjekt) return K["gradski-projekt"].kod;
  // 3.–5. razlog iz izračuna po komadu
  const k = razlogKomada(klasa, regija, zona, neuredeno);
  if (!GRADIVE.includes(KATEGORIJA_PO_KODU.get(k)!.id)) return k;
  return ostatakKuce ? K["ostatak-kuce"].kod : preusko ? K.premalo.kod : odmaci ? K.odmaci.kod : odmak ? K.odmak.kod : k;
}

function razlogKomada(klasa: number, regija: number, zona: ZonaGradnje, neuredeno: boolean): number {
  const K = KATEGORIJA_PO_ID;
  switch (regija) {
    case REGIJE.zabranjeno:
      return K["samo-rekonstrukcija"].kod;
    case REGIJE.neizgradivo:
      return K.neizgradivo.kod;
    case REGIJE.ceka:
      if (KLASA_PO_INDEKSU.get(klasa)?.kod === "D") return K.nestambeno.kod;
      if (!neuredeno) return K["ceka-upu"].kod;
      return zona === "stambena" ? K["uz-cestu-stambeno"].kod : K["uz-cestu-nestambeno"].kod;
    case REGIJE.usko:
    case REGIJE.premalo:
      return K.premalo.kod;
  }
  // 6. slobodno za gradnju
  return zona === "stambena" ? K.stambeno.kod : K.nestambeno.kod;
}

/** Srednje siva snimke pod kartom (siva podloga u globals.css): na njoj se boje gledaju u tumaču. */
const SIVA_SNIMKE = "#a6a6a6";

/**
 * Uzorak kategorije za tumač i brojke kakav je na karti: boja stopljena sa
 * sivom snimkom, i iste pruge. Vraća CSS svojstva (bez Reacta, za poslužitelj i klijent).
 */
export function uzorakKategorije(k: Kategorija): { backgroundColor: string; backgroundImage?: string } {
  const ton = `color-mix(in srgb, ${k.boja} ${Math.round(k.alfa * 100)}%, ${SIVA_SNIMKE})`;
  if (!k.pruge) return { backgroundColor: ton };
  const pruga = (kut: number) => `repeating-linear-gradient(${kut}deg, ${k.pruge} 0 2px, transparent 2px 6px)`;
  return { backgroundColor: ton, backgroundImage: k.mreza ? `${pruga(45)}, ${pruga(-45)}` : pruga(45) };
}

/**
 * „Što priječi gradnju”: razlozi zbog kojih se u zonama za stanovanje (S,
 * M1–M3, K5) ne može graditi nova stambena zgrada, složeni u skupine koje
 * čovjek razlikuje. Filtar karte boji jednu skupinu jakom ljubičastom,
 * samo unutar tih zona; boja je provjerena validatorom uz zelenu i jantarnu
 * stopljene sa sivom snimkom (deutan ΔE 24).
 */
export type IdPrepreke = "izgradjeno" | "zauzeto" | "javno" | "upu" | "pravila" | "velicina" | "odmak";

export const PREPREKE: readonly { id: IdPrepreke; naziv: string; opis: string; kategorije: readonly IdKategorije[] }[] = [
  {
    id: "izgradjeno",
    naziv: "Kuća ili zgrada sa svojim dvorištem",
    opis: "Već stoji zgrada; uz nju ide dvorište, a ostatak čestice premalen je za drugu zgradu.",
    kategorije: ["zgrada", "okucnica", "ostatak-kuce"],
  },
  {
    id: "zauzeto",
    naziv: "Ulica, put, parkiralište ili park",
    opis: "Mjesto se već koristi za nešto drugo ili je čestica zapravo put.",
    kategorije: ["ulica", "koridor", "put", "koristeno"],
  },
  {
    id: "javno",
    naziv: "Javno zemljište",
    opis: "Vlasnik je država, Grad, županija ili njihova ustanova ili tvrtka.",
    kategorije: ["javno", "javni-pojas"],
  },
  {
    id: "upu",
    naziv: "Čeka UPU ili gradski projekt",
    opis: "Nova gradnja čeka plan ili projekt koji Grad još nije donio.",
    kategorije: ["ceka-upu", "gradski-projekt"],
  },
  {
    id: "pravila",
    naziv: "Pravila dopuštaju samo obnovu",
    opis: "Pravila gradnje ovdje dopuštaju samo obnovu postojećih zgrada, ili teren nije za gradnju.",
    kategorije: ["samo-rekonstrukcija", "neizgradivo"],
  },
  {
    id: "velicina",
    naziv: "Premalo ili preusko za kuću",
    opis: "Slobodno, ali premalo, preusko ili zgrada ne stane uz odmake.",
    kategorije: ["premalo", "odmaci"],
  },
  {
    id: "odmak",
    naziv: "Odmak od ulice i susjeda",
    opis: "Dio gradilišta na kojem zgrada ne smije stajati: tu je dvorište ili prilaz.",
    kategorije: ["odmak"],
  },
];
export const PREPREKA_PO_ID = Object.fromEntries(PREPREKE.map((p) => [p.id, p])) as Record<IdPrepreke, (typeof PREPREKE)[number]>;
export const BOJA_PREPREKE = "#7c3aed";
export const ALFA_PREPREKE = 0.85;

/** Isti izgled na karti: kategoriju nije potrebno posebno crtati u tumaču. */
export const istiIzgled = (a: Kategorija, b: Kategorija) =>
  a.boja === b.boja && a.alfa === b.alfa && a.pruge === b.pruge && a.mreza === b.mreza;
