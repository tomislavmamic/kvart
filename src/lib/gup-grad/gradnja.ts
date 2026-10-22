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

/**
 * Odgovor na pitanje „mogu li ovdje graditi?”, od najstrožeg. Neuređeni dio
 * (do UPU-a gradi se samo uz postojeću javnu cestu) dijeli se po namjeni:
 * gdje namjena ne dopušta stanovanje, ono je „nestambeno” kao i ostalo
 * takvo zemljište; gdje dopušta, stanovanje je moguće samo uz cestu.
 */
export type Skupina = "nista" | "nestambeno" | "uvjetno" | "stambeno";

export const SKUPINE_GRADNJE: Record<Skupina, { naslov: string; kratko: string; glavna: IdKategorije }> = {
  nista: { naslov: "Ne može se graditi ništa novo", kratko: "Ništa novo", glavna: "zgrada" },
  nestambeno: { naslov: "Može se graditi, ali ne stambeno", kratko: "Nije za stanovanje", glavna: "nestambeno" },
  uvjetno: { naslov: "Stambeno do UPU-a samo uz postojeću javnu cestu", kratko: "Stambeno samo uz cestu", glavna: "uz-cestu-stambeno" },
  stambeno: { naslov: "Stambena ili stambeno-poslovna gradnja moguća", kratko: "Stambeno moguće", glavna: "stambeno" },
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
}

/**
 * Boja nosi odgovor, ne razlog: četiri odgovora imaju četiri izgleda, a
 * razlog kaže klik i tumač. „Ništa novo” je bijela koprena koja izblijedi
 * snimku (osim čekanja na UPU, crvene pruge kao na /gup/zabrana); plavo je
 * nestambeno, jantar stambeno samo uz cestu, zeleno stambeno. Kose pruge znače
 * „ovisi o UPU-u”. Boje su provjerene validatorom (dataviz) i kako izgledaju
 * stopljene sa sivom snimkom (#747474–#cdcdcd), ne samo kao čiste boje.
 */
export const KATEGORIJE: readonly Kategorija[] = [
  {
    kod: 1,
    id: "zgrada",
    skupina: "nista",
    naziv: "Zgrada ili gradilište",
    razlog: "Na ovom mjestu već stoji zgrada (ili se gradi). Smije se obnoviti ili zamijeniti, ali nova se ne može dodati.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 2,
    id: "okucnica",
    skupina: "nista",
    naziv: "Dvorište postojeće zgrade",
    razlog:
      "Zemljište pripada postojećoj zgradi: odredbe joj propisuju ovoliko čestice (tlocrt kroz najveći koeficijent izgrađenosti, a ne manje od najmanje građevne čestice), pa nova zgrada ovdje ne stane.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 3,
    id: "koristeno",
    skupina: "nista",
    naziv: "Parkiralište, park, igralište, okoliš škole",
    razlog: "Mjesto je već uređeno za drugu upotrebu: parkiralište, održavani park, igralište, trg, groblje ili okoliš javne ustanove.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 4,
    id: "ulica",
    skupina: "nista",
    naziv: "Ulica, pruga ili infrastruktura",
    razlog: "Ovo je postojeća ulica, put, pruga ili infrastrukturna građevina (trafostanica, vodosprema, crpka).",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 5,
    id: "rezerva-prometa",
    skupina: "nista",
    naziv: "Rezervirano za ulicu, prugu ili groblje",
    razlog: "Zemljište je slobodno, ali ga GUP ne boji nijednom namjenom za gradnju: rezervirano je za ulicu, prugu, groblje ili infrastrukturni koridor.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 14,
    id: "koridor",
    skupina: "nista",
    naziv: "Koridor ulice između zona (neobojen na listu 1)",
    razlog:
      "Zemljište je slobodno, ali je na listu 1 novog GUP-a ovo neobojeni pojas između zona: koridor postojeće ili planirane ulice, na kojem se ne gradi.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 6,
    id: "bez-zgrada",
    skupina: "nista",
    naziv: "Zelenilo, rekreacija i plaže",
    razlog: "Namjena je park, zaštitno zelenilo, rekreacija ili plaža, gdje GUP ne predviđa zgrade (osim manjih pratećih).",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 7,
    id: "samo-rekonstrukcija",
    skupina: "nista",
    naziv: "Odredbe dopuštaju samo obnovu postojećeg",
    razlog: "Zemljište je slobodno i u stambenoj zoni, ali odredbe za ovo područje urbanog pravila ne dopuštaju novu stambenu zgradu, samo rekonstrukciju i zamjenu postojećih.",
    boja: "#ffffff",
    alfa: 0.55,
  },
  {
    kod: 8,
    id: "neizgradivo",
    skupina: "nista",
    naziv: "Teren se ne može graditi",
    razlog: "Pregled ortofota pokazao je da se ovaj teren ne može graditi (strmina, stijena, korito).",
    boja: "#ffffff",
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
  },
  {
    kod: 10,
    id: "ceka-upu",
    skupina: "nista",
    naziv: "Nova gradnja čeka UPU",
    razlog:
      "Područje urbane sanacije ili preobrazbe s lista 4.d: gradi se samo na temelju UPU-a, a do njega su dopuštene samo rekonstrukcija i zamjena postojećih zgrada.",
    boja: "#ffffff",
    alfa: 0.45,
    pruge: "#dc2626",
  },
  {
    kod: 11,
    id: "uz-cestu-stambeno",
    skupina: "uvjetno",
    naziv: "Neuređeni dio, stambena ili mješovita zona: do UPU-a samo uz postojeću cestu",
    razlog:
      "Neuređeni dio građevinskog područja u zoni koja dopušta stanovanje: GUP propisuje UPU, ali do njega se dozvola za novu stambenu zgradu može dobiti ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja.",
    boja: "#f59e0b",
    alfa: 0.8,
  },
  {
    kod: 15,
    id: "uz-cestu-nestambeno",
    skupina: "nestambeno",
    naziv: "Neuređeni dio, nestambena zona: do UPU-a samo uz postojeću cestu",
    razlog:
      "Neuređeni dio građevinskog područja u zoni koja ne dopušta stanovanje: stambena zgrada ne može se graditi ni poslije UPU-a, a nestambena do njega samo ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja.",
    boja: "#2563eb",
    alfa: 0.25,
    pruge: "#2563eb",
  },
  {
    kod: 12,
    id: "nestambeno",
    skupina: "nestambeno",
    naziv: "Slobodno za javnu, gospodarsku, turističku ili športsku gradnju",
    razlog: "Zemljište je slobodno i za gradnju, ali namjena ne dopušta stambenu zgradu.",
    boja: "#2563eb",
    alfa: 0.65,
  },
  {
    kod: 13,
    id: "stambeno",
    skupina: "stambeno",
    naziv: "Slobodno za stambenu ili stambeno-poslovnu zgradu",
    razlog: "Slobodno, dovoljno veliko i široko, u stambenoj ili mješovitoj zoni koja dopušta novu zgradu.",
    boja: "#15803d",
    alfa: 0.85,
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
 * (R, G), `neuredeno` je li mjesto u neuređenom dijelu s lista 4.d, a
 * `koridor` je li u neobojenom koridoru ulice s lista 1 koji je rasterizacija
 * upila u zonu (koridori.py). Vraća kod kategorije ili 0 kad piksel nije na
 * čestici u obuhvatu.
 */
export function kategorija(klasa: number, regija: number, neuredeno: boolean, koridor = false): number {
  const z = zonaKlase(klasa);
  const zona = z && koridor ? "promet" : z;
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
  if (zona === "promet") return koridor ? K.koridor.kod : K["rezerva-prometa"].kod;
  if (zona === "bez-zgrada") return K["bez-zgrada"].kod;
  // 3.–5. razlog iz izračuna po komadu
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
  return k.pruge
    ? { backgroundColor: ton, backgroundImage: `repeating-linear-gradient(45deg, ${k.pruge} 0 2px, transparent 2px 6px)` }
    : { backgroundColor: ton };
}

/** Isti izgled na karti: kategoriju nije potrebno posebno crtati u tumaču. */
export const istiIzgled = (a: Kategorija, b: Kategorija) => a.boja === b.boja && a.alfa === b.alfa && a.pruge === b.pruge;
