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
export function vrijednostPolja(v: unknown): string {
  return typeof v === "number"
    ? v.toLocaleString("hr-HR", { maximumFractionDigits: 1 })
    : String(v);
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
  const glava = kljuc ? vrijednostPolja(p[kljuc]) : null;
  const dopune = Object.entries(p)
    .filter(
      ([k, v]) =>
        k !== kljuc && !BEZ_OPISA.has(k) && IME_POLJA[k] && v != null && v !== ""
    )
    .slice(0, najvise)
    .map(([k, v]) => `${IME_POLJA[k]}: ${vrijednostPolja(v)}`);
  return [glava, ...dopune].filter(Boolean).join(" · ") || "objekt";
}
