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
 *     plaže ne; ulice, pruga i groblja su rezervirani za sebe)
 *  3. dopuštaju li odredbe urbanog pravila novu zgradu (ili samo
 *     rekonstrukciju), je li teren izgradiv
 *  4. čeka li gradnja UPU (list 4.d, čl. 103.) — u neuređenom dijelu uz
 *     postojeću javnu cestu ne čeka, a javne i društvene zgrade (D) smiju se
 *     graditi i prije UPU-a (čl. 105. st. 5.)
 *  5. je li slobodno dovoljno veliko i široko za građevnu česticu
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
 *  - R5 golf je izdvojeno građevinsko područje za golf i njegove sadržaje;
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
  R5: "nestambena",
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
  stambena: "dopušta stambene i stambeno-poslovne zgrade",
  nestambena: "dopušta zgrade, ali ne stambene",
  "bez-zgrada": "ne predviđa zgrade, osim manjih pratećih (paviljon, sanitarni čvor, kiosk)",
  promet: "rezervirana je za ulice, prugu, groblja i infrastrukturu",
};

/** Odgovor na pitanje „mogu li ovdje graditi?”, od najstrožeg. */
export type Skupina = "nista" | "uvjetno" | "nestambeno" | "stambeno";

export const SKUPINE_GRADNJE: Record<Skupina, { naslov: string; kratko: string }> = {
  nista: { naslov: "Ne može se graditi ništa novo", kratko: "Ništa novo" },
  uvjetno: { naslov: "Do UPU-a samo uz postojeću javnu cestu", kratko: "Samo uz cestu" },
  nestambeno: { naslov: "Može se graditi, ali ne stambeno", kratko: "Nije za stanovanje" },
  stambeno: { naslov: "Stambena ili stambeno-poslovna gradnja moguća", kratko: "Stambeno moguće" },
};

export type IdKategorije =
  | "zgrada"
  | "okucnica"
  | "koristeno"
  | "ulica"
  | "rezerva-prometa"
  | "bez-zgrada"
  | "samo-rekonstrukcija"
  | "neizgradivo"
  | "premalo"
  | "ceka-upu"
  | "uz-cestu"
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
  /** Točkice preko boje: slobodno, ali premalo ili preusko. */
  tockice?: boolean;
}

/**
 * Boje su provjerene za razlučivost i daltonizam (dataviz validator, svih pet
 * obojenih parova): zeleno stambeno, cijan nestambeno, jantar uz cestu,
 * crveno čeka UPU (kao na /gup/zabrana), ljubičasto plan ne dopušta.
 * Zauzeto je sivo: tamno zgrada, svjetlije ono što ide uz nju i ulice.
 */
export const KATEGORIJE: readonly Kategorija[] = [
  {
    kod: 1,
    id: "zgrada",
    skupina: "nista",
    naziv: "Zgrada ili gradilište",
    razlog: "Na ovom mjestu već stoji zgrada (ili se gradi). Smije se obnoviti ili zamijeniti, ali nova se ne može dodati.",
    boja: "#27272a",
    alfa: 0.72,
  },
  {
    kod: 2,
    id: "okucnica",
    skupina: "nista",
    naziv: "Dvorište postojeće zgrade",
    razlog:
      "Zemljište pripada postojećoj zgradi: odredbe joj propisuju ovoliko čestice (tlocrt kroz najveći koeficijent izgrađenosti, a ne manje od najmanje građevne čestice), pa nova zgrada ovdje ne stane.",
    boja: "#52525b",
    alfa: 0.5,
  },
  {
    kod: 3,
    id: "koristeno",
    skupina: "nista",
    naziv: "Parkiralište, park, igralište, okoliš škole",
    razlog: "Mjesto je već uređeno za drugu upotrebu: parkiralište, održavani park, igralište, trg, groblje ili okoliš javne ustanove.",
    boja: "#52525b",
    alfa: 0.5,
  },
  {
    kod: 4,
    id: "ulica",
    skupina: "nista",
    naziv: "Ulica, pruga ili infrastruktura",
    razlog: "Ovo je postojeća ulica, put, pruga ili infrastrukturna građevina (trafostanica, vodosprema, crpka).",
    boja: "#a1a1aa",
    alfa: 0.6,
  },
  {
    kod: 5,
    id: "rezerva-prometa",
    skupina: "nista",
    naziv: "Rezervirano za ulicu, prugu ili groblje",
    razlog: "Zemljište je slobodno, ali ga GUP ne boji nijednom namjenom za gradnju: rezervirano je za ulicu, prugu, groblje ili infrastrukturni koridor.",
    boja: "#a1a1aa",
    alfa: 0.6,
  },
  {
    kod: 6,
    id: "bez-zgrada",
    skupina: "nista",
    naziv: "Zelenilo, rekreacija i plaže",
    razlog: "Namjena je park, zaštitno zelenilo, rekreacija ili plaža, gdje GUP ne predviđa zgrade (osim manjih pratećih).",
    boja: "#7e22ce",
    alfa: 0.55,
  },
  {
    kod: 7,
    id: "samo-rekonstrukcija",
    skupina: "nista",
    naziv: "Odredbe dopuštaju samo obnovu postojećeg",
    razlog: "Zemljište je slobodno i u stambenoj zoni, ali odredbe za ovo područje urbanog pravila ne dopuštaju novu stambenu zgradu, samo rekonstrukciju i zamjenu postojećih.",
    boja: "#7e22ce",
    alfa: 0.55,
  },
  {
    kod: 8,
    id: "neizgradivo",
    skupina: "nista",
    naziv: "Teren se ne može graditi",
    razlog: "Pregled ortofota pokazao je da se ovaj teren ne može graditi (strmina, stijena, korito).",
    boja: "#7e22ce",
    alfa: 0.55,
  },
  {
    kod: 9,
    id: "premalo",
    skupina: "nista",
    naziv: "Premalo ili preusko za novu česticu",
    razlog:
      "Slobodno je, ali premalo za najmanju građevnu česticu koju odredbe ovdje traže, ili uže od ~9 m (put, stube, pojas uz među), a nema slobodnog susjeda s kojim bi se spojilo.",
    boja: "#ffffff",
    alfa: 0.55,
    tockice: true,
  },
  {
    kod: 10,
    id: "ceka-upu",
    skupina: "nista",
    naziv: "Nova gradnja čeka UPU",
    razlog:
      "Područje urbane sanacije ili preobrazbe s lista 4.d: gradi se samo na temelju UPU-a, a do njega su dopuštene samo rekonstrukcija i zamjena postojećih zgrada.",
    boja: "#dc2626",
    alfa: 0.6,
  },
  {
    kod: 11,
    id: "uz-cestu",
    skupina: "uvjetno",
    naziv: "Neuređeni dio: do UPU-a samo uz postojeću cestu",
    razlog:
      "Neuređeni dio građevinskog područja: GUP propisuje UPU, ali do njega se dozvola za novu zgradu može dobiti ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja.",
    boja: "#ca8a04",
    alfa: 0.62,
  },
  {
    kod: 12,
    id: "nestambeno",
    skupina: "nestambeno",
    naziv: "Slobodno za javnu, gospodarsku, turističku ili športsku gradnju",
    razlog: "Zemljište je slobodno i za gradnju, ali namjena ne dopušta stambenu zgradu.",
    boja: "#0891b2",
    alfa: 0.6,
  },
  {
    kod: 13,
    id: "stambeno",
    skupina: "stambeno",
    naziv: "Slobodno za stambenu ili stambeno-poslovnu zgradu",
    razlog: "Slobodno, dovoljno veliko i široko, u stambenoj ili mješovitoj zoni koja dopušta novu zgradu.",
    boja: "#15803d",
    alfa: 0.68,
  },
];

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

/**
 * Jedan razlog za piksel: `klasa` i `regija` iz pločice dijelova čestice
 * (R, G), `neuredeno` je li mjesto u neuređenom dijelu s lista 4.d. Vraća
 * kod kategorije ili 0 kad piksel nije na čestici u obuhvatu.
 */
export function kategorija(klasa: number, regija: number, neuredeno: boolean): number {
  const zona = zonaKlase(klasa);
  if (!zona || regija <= 0) return 0;
  const K = KATEGORIJA_PO_ID;
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
  if (zona === "promet") return K["rezerva-prometa"].kod;
  if (zona === "bez-zgrada") return K["bez-zgrada"].kod;
  // 3.–5. razlog iz izračuna po komadu
  switch (regija) {
    case REGIJE.zabranjeno:
      return K["samo-rekonstrukcija"].kod;
    case REGIJE.neizgradivo:
      return K.neizgradivo.kod;
    case REGIJE.ceka:
      if (KLASA_PO_INDEKSU.get(klasa)?.kod === "D") return K.nestambeno.kod;
      return neuredeno ? K["uz-cestu"].kod : K["ceka-upu"].kod;
    case REGIJE.usko:
    case REGIJE.premalo:
      return K.premalo.kod;
  }
  // 6. slobodno za gradnju
  return zona === "stambena" ? K.stambeno.kod : K.nestambeno.kod;
}
