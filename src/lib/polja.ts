/**
 * Imena polja u slojevima iz gradskog GIS-a.
 *
 * Uvoz (scripts/import-split-gis.ts) preimenuje izvorne stupce u kratke
 * ključeve; ovdje im stoje natpisi za čitatelja. Rječnik je zajednički jer
 * ga trebaju dvije strane — skočni prozor u pregledniku i dosje čestice na
 * poslužitelju — a dva popisa istih polja razišla bi se prvom izmjenom.
 *
 * Polje kojega ovdje nema ne prikazuje se. To je namjerno: uvoz propušta i
 * interne šifre, pa je ovaj popis ujedno odluka što je vrijedno pokazati.
 */
export const IME_POLJA: Record<string, string> = {
  broj: "broj",
  vrsta: "vrsta",
  tip: "tip",
  medij: "sadržaj",
  materijal: "materijal",
  promjer: "promjer (mm)",
  profil: "profil (mm)",
  napon: "napon (kV)",
  izvedba: "izvedba",
  godina: "godina izgradnje",
  sirina: "širina (m)",
  duljina: "duljina (m)",
  povrsina: "površina (m²)",
  tlocrt: "tlocrt (m²)",
  korisna: "korisna površina (m²)",
  upravitelj: "upravitelj",
  grad: "grad",
  ko: "katastarska općina",
  cestica: "čestica",
  cestice: "čestice",
  datacija: "datacija",
  status: "status",
  adresa: "adresa",
  napomena: "napomena",
  // zgrade i površine
  krov: "krov",
  visina: "visina (m)",
  kota_dna: "kota dna (m n.m.)",
  kota_vrha: "kota vrha (m n.m.)",
  kota_terena: "kota terena (m n.m.)",
  obujam: "obujam (m³)",
  // sunce
  razred: "razred",
  kwh_min: "najmanje (kWh/m²)",
  kwh_max: "najviše (kWh/m²)",
  kwh_prosjek: "prosjek (kWh/m²)",
  // katastar i zemljišna knjiga
  zk_status: "zemljišnoknjižno stanje",
  zk_oblik: "oblik vlasništva",
  zk_vlasnik: "vlasnik",
  zk_teret: "teret",
  zk_teret_vrsta: "vrsta tereta",
  // adrese i popis
  ulica: "ulica",
  naselje: "naselje",
  kotar: "kotar",
  sifra: "šifra",
  popisni_krug: "popisni krug",
  statisticki_krug: "statistički krug",
  sruseno: "srušeno",
  // mreže
  sustav: "sustav",
  tlacna_zona: "tlačna zona",
  izvod: "izvod",
  vodic: "vodič",
  faze: "broj faza",
  funkcija: "funkcija",
  vod: "vod",
  prijenos: "prijenosni odnos",
  oblik: "oblik",
  sliv: "sliv",
  dubina: "dubina (mm)",
  namjena: "namjena",
  uzemljenje: "uzemljenje",
  zona: "zona",
  ugradeno: "ugrađeno",
  izgraden: "izgrađen",
  // zelenilo i komunalno
  zelena_povrsina: "zelena površina",
  vrsta_stabla: "vrsta stabla",
  lokacija: "lokacija",
  vlasnik: "vlasnik",
  polozaj: "položaj",
  plan: "plan",
  zaduzeno: "zaduženo (EUR)",
  naplaceno: "naplaćeno (EUR)",
  postotak_naplate: "naplata (%)",
  opis: "opis",
};
/** Vrijednost u obliku za prikaz — brojevi hrvatski, bez suvišnih decimala. */
/**
 * Šifrarnici iz izvoza koji nisu na hrvatskom.
 *
 * Gradski GIS ponegdje nosi engleske enume iz izvorne baze — `ROOF_NOT_FLAT`
 * je doslovno ono što piše u sloju zgrada. Stranica je na hrvatskom bez
 * iznimke, uključujući i vrijednosti, ne samo natpise: „krov: ROOF_NOT_FLAT”
 * susjedu ne znači ništa, a odaje da ispod stoji nečiji izvoz.
 *
 * Vrijednost koje ovdje nema ispisuje se kako jest — bolje sirovo nego
 * pogrešno prevedeno.
 */
const VRIJEDNOSTI: Record<string, string> = {
  ROOF_NOT_FLAT: "kosi",
  ROOF_FLAT: "ravni",
  NOT_FLAT: "kosi",
  FLAT: "ravni",
  UNDEFINED: "nepoznato",
  UNKNOWN: "nepoznato",
  TRUE: "da",
  FALSE: "ne",
};

/**
 * Popravci koje izvoz nosi u sebi, a stanar ih ne bi trebao vidjeti.
 *
 * Dio vrijednosti je UTF-8 pročitan kao Latin-1 negdje uzvodno, pa u dosjeu
 * osvane dvostruko kodirano slovo umjesto našega. Ne da se popraviti u
 * izvoru (arhiva je takva), pa se ispravlja na izlazu: podatku kojemu je
 * vjerodostojnost jedina imovina ne pristaje krivo kodiran prvi redak.
 */
function popraviKodiranje(s: string): string {
  if (!/\u00c3|\u00c4|\u00c5/.test(s)) return s;
  try {
    // Vrati niz u bajtove po Latin-1 pa ga pročitaj kao UTF-8 — to je točno
    // obrnuto od pogreške koja ga je i napravila.
    const bajtovi = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
    const natrag = new TextDecoder("utf-8", { fatal: true }).decode(bajtovi);
    return natrag;
  } catch {
    return s; // nije bila dvostruka kodna greška
  }
}

/**
 * Kratice koje ostaju velike. Bez ovoga „GUP SPLITA” postane „Gup Splita”,
 * što je gore od izvornog vikanja — plan se zove GUP i tako se piše.
 */
const KRATICE = new Set([
  "GUP", "PPUG", "PPUGS", "UPU", "DPU", "ID", "KO", "HEP", "HT", "DTK",
  "NN", "SN", "VN", "TS", "KRO", "DOF", "EU", "RH",
]);

/** VELIKA IMENA IZ IZVORA („PUT MOSTINA”) u čitljiv oblik. */
function izVelikih(s: string): string {
  if (s.length < 4) return s;
  if (s !== s.toLocaleUpperCase("hr-HR")) return s;
  if (!/\p{L}/u.test(s)) return s;
  return s
    .split(/(\s+)/)
    .map((rijec) => {
      if (/^\s+$/.test(rijec) || KRATICE.has(rijec)) return rijec;
      // Oznake namjene (K5, M1, Z5, D4) također ostaju kakve jesu.
      if (/^[A-ZČĆŽŠĐ]\d+$/.test(rijec)) return rijec;
      return rijec
        .toLocaleLowerCase("hr-HR")
        .replace(/(^|[(/-])(\p{L})/gu, (_m, p1: string, c: string) =>
          p1 + c.toLocaleUpperCase("hr-HR")
        );
    })
    .join("");
}

export function vrijednostPolja(v: unknown, kljuc?: string): string {
  if (typeof v === "number")
    return v.toLocaleString("hr-HR", { maximumFractionDigits: 1 });
  let s = popraviKodiranje(String(v));
  const poznato = VRIJEDNOSTI[s.toUpperCase()];
  if (poznato) return poznato;
  // Natpis polja već nosi mjernu jedinicu („napon (kV)”), pa je vrijednost
  // ne ponavlja — prije je ispisivalo „0.4 kV kV”.
  const natpis = kljuc ? (IME_POLJA[kljuc] ?? "") : "";
  const jed = natpis.match(/\((.+?)\)\s*$/);
  if (jed) s = s.replace(new RegExp("\\s*" + jed[1] + "\\s*$", "i"), "").trim();
  // Decimalna točka iz izvora u hrvatski zarez, ali samo za čisti broj.
  if (/^-?\d+\.\d+$/.test(s))
    return Number(s).toLocaleString("hr-HR", { maximumFractionDigits: 2 });
  return izVelikih(s);
}

/**
 * Kratak opis objekta: prvo ono što se čita kao ime, pa najviše `najvise`
 * označenih polja. Bez natpisa bi „GK Mejaši · 286.129,5 · 190.511,5” bio
 * niz brojeva bez značenja, pa se dopune ispisuju kao „naplata: 66,6 %”.
 */
const NASLOVNA_POLJA = ["naziv", "ulica", "oznaka", "broj", "vrsta", "tip"];
const BEZ_OPISA = new Set(["boja", "poveznica"]);

export function opisObjekta(
  p: Record<string, unknown>,
  najvise = 2
): string {
  const kljuc = NASLOVNA_POLJA.find((k) => p[k] != null && p[k] !== "");
  const glava = kljuc ? vrijednostPolja(p[kljuc], kljuc) : null;
  const dopune = Object.entries(p)
    .filter(
      ([k, v]) =>
        k !== kljuc && !BEZ_OPISA.has(k) && IME_POLJA[k] && v != null && v !== ""
    )
    .slice(0, najvise)
    .map(([k, v]) => `${IME_POLJA[k]}: ${vrijednostPolja(v, k)}`);
  return [glava, ...dopune].filter(Boolean).join(" · ") || "objekt";
}
