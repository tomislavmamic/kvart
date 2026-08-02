/**
 * Dosje čestice: sve što slojevi karte znaju o jednom komadu zemlje.
 *
 * Karta ima 70 slojeva i klik je dosad davao samo onaj po kojem se kliknulo.
 * Stanaru to ne odgovara na pitanje koje zapravo ima — „što je sve ovdje?” —
 * pa ovaj modul okreće postupak: pođe od čestice i skupi sve što je u njoj,
 * kroz nju ili nad njom.
 *
 * Račun ide na poslužitelju namjerno. Slojevi zajedno teže 7,6 MB; poslati
 * ih pregledniku da bi odgovorio na jedan klik bilo bi skuplje od samog
 * odgovora, koji je nekoliko kilobajta. Datoteke se čitaju s diska i drže
 * u memoriji između poziva.
 */
import { readFile } from "fs/promises";
import path from "path";
import {
  booleanIntersects,
  booleanPointInPolygon,
  bbox as turfBbox,
  pointOnFeature,
} from "@turf/turf";
import type { Feature, FeatureCollection, Position } from "geojson";
import { OVERLAY_LAYERS } from "./map-views";
import { NA_SNAZI, PRETHODNI } from "./plan-status";
import { opisObjekta, vrijednostPolja } from "./polja";
import {
  validatePublicParcelProperties,
  type PublicParcelProperties,
} from "./public-parcels";
import {
  TEME,
  type Dosje,
  type Namjena,
  type Odnos,
  type Stavka,
  type Tema,
} from "./dosje-oblik";

export type { Dosje } from "./dosje-oblik";

const GEO = path.join(process.cwd(), "public", "geo");

/**
 * Jedna tablica za oboje — tema i odnos po sloju. Dva odvojena popisa istih
 * id-eva razišla bi se prvom izmjenom. Sloja kojeg ovdje nema u dosjeu nema:
 * tako ispadaju druge inačice istih čestica, koje bi samo ponovile redak.
 */
const U_DOSJEU: Record<string, { tema: Tema; odnos: Odnos }> = {
  // Uprava i planovi.
  //
  // Ovdje NEMA kotara, naselja, granice k.o., popisnog i statističkog kruga,
  // zone kioska, zone rasvjete, vodoopskrbnog područja, zelene zone ni
  // naplate komunalne naknade. Mjereno na 40 nasumičnih čestica: svaki od
  // tih redaka pojavljuje se na 39/40 čestica i ima jednu do tri različite
  // vrijednosti — dakle opisuje kvart, a ne česticu na koju je netko
  // kliknuo. Slojevi su i dalje na karti; samo ne troše dosje.
  //
  // Planovi ostaju iako su slično stalni: oni odgovaraju na pitanje po
  // kojem se planu ovdje gradi i nose poveznicu na sam dokument.
  "planovi-obuhvat": { tema: "uprava", odnos: "nad" },
  "planovi-obuhvat-pp": { tema: "uprava", odnos: "nad" },
  "kiosci-plan": { tema: "uprava", odnos: "na" },
  "kulturno-dobro": { tema: "uprava", odnos: "nad" },

  // zemljište i zgrade
  "zgrade-2025": { tema: "zemljiste", odnos: "na" },
  "zgrade-visine": { tema: "zemljiste", odnos: "na" },
  "korisna-povrsina": { tema: "zemljiste", odnos: "na" },
  "zgrade-adrese": { tema: "zemljiste", odnos: "na" },
  "kucni-brojevi": { tema: "zemljiste", odnos: "na" },
  adrese: { tema: "zemljiste", odnos: "na" },
  "solar-krovovi": { tema: "zemljiste", odnos: "na" },

  // promet
  "ceste-nerazvrstane": { tema: "promet", odnos: "kroz" },
  "ceste-dionice": { tema: "promet", odnos: "kroz" },
  "ulice-osi": { tema: "promet", odnos: "kroz" },
  "drzavne-ceste": { tema: "promet", odnos: "kroz" },
  nogostupi: { tema: "promet", odnos: "kroz" },
  "odbojne-ograde": { tema: "promet", odnos: "kroz" },
  "pjesacki-prijelazi": { tema: "promet", odnos: "na" },
  izbocine: { tema: "promet", odnos: "na" },
  "prometni-znakovi": { tema: "promet", odnos: "na" },
  "stajalista-grad": { tema: "promet", odnos: "na" },
  nadstresnice: { tema: "promet", odnos: "na" },
  "parkiraliste-grad": { tema: "promet", odnos: "na" },

  // voda i odvodnja
  vodovod: { tema: "voda", odnos: "kroz" },
  "vodovod-kanali": { tema: "voda", odnos: "kroz" },
  "vodovod-spojevi": { tema: "voda", odnos: "na" },
  "vodovod-zatvaraci": { tema: "voda", odnos: "na" },
  hidranti: { tema: "voda", odnos: "na" },
  odvodnja: { tema: "voda", odnos: "kroz" },
  "odvodnja-tlacni": { tema: "voda", odnos: "kroz" },
  "odvodnja-okna": { tema: "voda", odnos: "na" },
  "odvodnja-slivnici": { tema: "voda", odnos: "na" },
  "odvodnja-gradevine": { tema: "voda", odnos: "na" },

  // struja
  "struja-nn": { tema: "struja", odnos: "kroz" },
  "struja-sn": { tema: "struja", odnos: "kroz" },
  "struja-vn-110": { tema: "struja", odnos: "kroz" },
  "struja-nn-stupovi": { tema: "struja", odnos: "na" },
  "struja-nn-ormarici": { tema: "struja", odnos: "na" },
  "struja-stupovi-vn": { tema: "struja", odnos: "na" },
  trafostanice: { tema: "struja", odnos: "na" },
  "trafostanice-plohe": { tema: "struja", odnos: "na" },
  "trafostanica-110": { tema: "struja", odnos: "na" },

  // telekom i rasvjeta
  "telekom-trase": { tema: "veze", odnos: "kroz" },
  "telekom-ht-podzemno": { tema: "veze", odnos: "kroz" },
  "telekom-ht-nadzemno": { tema: "veze", odnos: "kroz" },
  "telekom-sahte": { tema: "veze", odnos: "na" },
  "telekom-ht-zdenci": { tema: "veze", odnos: "na" },
  "telekom-ht-stupovi": { tema: "veze", odnos: "na" },
  rasvjeta: { tema: "veze", odnos: "na" },
  "rasvjeta-mjesta": { tema: "veze", odnos: "na" },
  "rasvjeta-trafostanice": { tema: "veze", odnos: "na" },

  // zelenilo i javni prostor
  "zelenilo-oprema": { tema: "zelenilo", odnos: "na" },
  "zelenilo-kosevi": { tema: "zelenilo", odnos: "na" },
  "zelenilo-vjezbaliste": { tema: "zelenilo", odnos: "na" },
  "zelenilo-stabla": { tema: "zelenilo", odnos: "na" },
  igralista: { tema: "zelenilo", odnos: "na" },
};

/** Najviše stavki po sloju u odgovoru — ostatak se izbroji, ne nabraja. */
const NAJVISE_PO_SLOJU = 6;

/**
 * Polja koja u dosjeu ne idu, iako ih skočni prozor sloja pokazuje.
 *
 * Dosje odgovara na „što je ovdje”, a ne „kako je zavedeno”. Šifra izvoda
 * iz trafostanice, oznaka vodiča ili broj popisnog kruga stanaru ne znače
 * ništa, a zauzmu redak. Isto vrijedi za grad, naselje i kotar — to je
 * cijeli kvart, pa ne govori o čestici.
 */
const BEZ_U_DOSJEU = new Set([
  "grad", "naselje", "kotar", "sifra", "popisni_krug", "statisticki_krug",
  "izvod", "vodic", "sustav", "tlacna_zona", "status", "ko", "zona",
  "funkcija", "faze", "sliv", "uzemljenje", "namjena", "plan",
  // pogonske oznake (1KV733/3, 4DV1481/123, stup 9922) — šifre kojima se
  // vodi mreža, ne podatak o mjestu
  "oznaka", "vod",
]);

/**
 * Namjene koje dopuštaju stanovanje.
 *
 * Isti popis kojim računa scripts/slobodne-parcele.py — mora biti isti,
 * inače bi dosje i izvedeni sloj tvrdili različito o istoj čestici. K5 je
 * „poslovna namjena i stanovanje”, M/K5 je nerazlučena klasa čije obje
 * članice stanovanje dopuštaju.
 */
const STANOVANJE = new Set(["S", "M1", "M2", "M3", "M/K5", "K5"]);

/** Nesigurnost precrtanih listova GUP-a, u metrima. Vidi /plan. */
const NESIGURNOST_M = 6;

/**
 * Preživljava li razlika između dva lista vlastitu nesigurnost precrtavanja?
 *
 * Uzima osam točaka na krugu od 6 m oko pogotka i traži da SVE daju istu
 * razliku. Ako ijedna ne da, točka leži na rubu plohe i razlika je artefakt
 * precrtavanja, ne odluka plana — pa se ne izriče.
 *
 * Erozija umjesto praga na površini: pitanje dosjea je „što vrijedi na ovoj
 * točki”, pa i provjera mora biti o točki. Površinski prag bi tražio presjek
 * s česticom, a to je drugo pitanje i drugi sloj.
 */
async function stabilnaRazlika(
  tocka: Feature,
  kodPrije: string,
  kodSad: string
): Promise<boolean> {
  const a = await ucitaj(PRETHODNI.url);
  const b = await ucitaj(NA_SNAZI.url);
  if (!a || !b) return false;
  if (tocka.geometry.type !== "Point") return false;
  const [lng, lat] = tocka.geometry.coordinates as [number, number];
  const dLat = NESIGURNOST_M / 111320;
  const dLng = NESIGURNOST_M / (111320 * Math.cos((lat * Math.PI) / 180));
  const kodNa = (fc: typeof a.fc, t: [number, number]) => {
    for (const f of fc.features) {
      try {
        if (booleanPointInPolygon(t as never, f as never))
          return String(f.properties?.kod ?? "");
      } catch {
        /* neispravna geometrija — preskoči */
      }
    }
    return null;
  };
  for (let i = 0; i < 8; i++) {
    const kut = (i * Math.PI) / 4;
    const t: [number, number] = [
      lng + dLng * Math.cos(kut),
      lat + dLat * Math.sin(kut),
    ];
    if (kodNa(a.fc, t) !== kodPrije || kodNa(b.fc, t) !== kodSad) return false;
  }
  return true;
}

/**
 * Namjena na točki, po planu na snazi, uz nacrt i izvedeni sloj.
 *
 * Ide preko točke, ne preko preklopa površina: dosje odgovara „što vrijedi
 * ovdje”, a ne „koliko posto čestice je u kojoj zoni”. Za drugo pitanje
 * postoji izvedeni sloj, koji upravo tako i računa.
 */
async function namjenaNaTocki(
  tocka: Feature,
  cestica: Feature | null
): Promise<Namjena | null> {
  const uzmi = async (put: string) => {
    const u = await ucitaj(put);
    if (!u) return null;
    for (const f of u.fc.features) {
      try {
        if (booleanPointInPolygon(tocka as never, f as never)) return f;
      } catch {
        /* neispravna geometrija — preskoči */
      }
    }
    return null;
  };

  const prijeF = await uzmi(PRETHODNI.url);

  // List na snazi ima rupa, pa se pada natrag na prethodni — i to se KAŽE.
  //
  // Izmjereno na 56 slobodnih čestica: tri (k.č. 517, 603/1, 612/3) nemaju
  // plohu na listu 2024., a na listu 2015. su K5. Bez ovoga bi im dosje
  // odgovorio „nema plohe namjene na praćenom listu” — dakle šutnjom, i to
  // baš na česticama na kojima netko misli graditi. Namjena po starijem
  // listu, jasno označena kao takva, bolja je od nikakve.
  const naSnazi = await uzmi(NA_SNAZI.url);
  const sad = naSnazi ?? prijeF;
  if (!sad) return null;
  const saPrethodnog = naSnazi === null;
  const p = sad.properties ?? {};
  const kod = String(p.kod ?? "");

  const prijeKod = String(prijeF?.properties?.kod ?? "");
  // Nacrt se navodi samo kad doista mijenja. Inače bi svaka čestica nosila
  // redak „nacrt: isto”, što je šum na 24 od 24 mjesta koja se ne mijenjaju.
  //
  // I samo kad razlika preživi vlastitu nesigurnost lista. Oba lista su
  // PRECRTANA iz PDF-a i točna su na ±5 m (vidi /plan). Na granici dviju
  // namjena to znači da razlika ne mora biti promjena plana nego pomak ruba:
  // izmjereno na cijelom kvartu, 98,4 % površine se poklapa, a od 2,48 ha
  // koje se razilaze najveći dio čine SIMETRIČNI parovi — K5→K 0,51 ha uz
  // K→K5 0,50 ha, K5→Z5 0,20 ha uz Z5→K5 0,20 ha. Promjena plana nije
  // simetrična; pomaknut rub jest.
  //
  // Provjereno na 56 slobodnih čestica: pet ih je nosilo redak „nacrt
  // predlaže”, a nijedan nije preživio pomak od 6 m. Tri su glasila
  // K5/M/K5 → Z5, dakle „nacrt ti od gradive čestice radi zaštitno
  // zelenilo” — najteža rečenica koju ova stranica može izreći, i bila je
  // šum. Slaže se i s time da nijedna od 24 plohe promjena ne pada u kvart.
  const prije =
    !saPrethodnog &&
    prijeF &&
    prijeKod &&
    prijeKod !== kod &&
    (await stabilnaRazlika(tocka, prijeKod, kod))
      ? { kod: prijeKod, opis: String(prijeF.properties?.namjena ?? "") }
      : null;

  // Izvedeni sloj nosi svoju geometriju po čestici, pa se traži pogodak u
  // njoj, a ne u točki — čestica je ono što je taj sloj i računao.
  //
  // Kad čestice NEMA u sloju, to se mora reći, a ne prešutjeti: zeleni
  // okvir bez ijedne ograde na K5 čestici s četiri zgrade čita se kao
  // dopuštenje. Razlog se izvodi iz istih podataka po kojima ga je i
  // slobodne-parcele.py izbacio.
  let slobodna: Namjena["slobodna"] = null;
  let izvan: string | null = null;
  const u = await ucitaj("/geo/analiza/stambeno-slobodno.geojson");
  let udioKoridora = 0;
  if (u && cestica) {
    const br = String((cestica.properties ?? {}).cestica ?? "");
    const ko = String((cestica.properties ?? {}).ko ?? "");
    const f = u.fc.features.find(
      (x) =>
        String(x.properties?.cestica ?? "") === br &&
        String(x.properties?.ko ?? "") === ko
    );
    if (f) {
      slobodna = {
        slobodno_m2: Number(f.properties?.slobodno_m2 ?? 0),
        bez_pristupa: Boolean(f.properties?.bez_pristupa),
      };
      udioKoridora = Number(f.properties?.udio_koridora ?? 0);
    } else if (STANOVANJE.has(kod)) izvan = await zastoNije(cestica);
  }

  return {
    kod,
    opis: String(p.namjena ?? ""),
    godina: Number(p.godina ?? NA_SNAZI.godina),
    stanovanje: STANOVANJE.has(kod),
    saPrethodnog,
    prije,
    slobodna,
    izvan,
    zapreke: await zapreke(cestica, udioKoridora),
  };
}

/**
 * Što fizički stoji na putu gradnji na ovoj čestici.
 *
 * Postoji zato što je dosje umio reći „ova namjena dopušta stanovanje” i
 * „2.945 m² stvarno slobodne površine” u zelenom okviru, a onda četiri
 * zaslona niže, pod naslovom „Struja”, istim slovima kao okno telekoma,
 * spomenuti da preko čestice prolaze dva dalekovoda od 110 kV. Provjereno na
 * k.č. 401/1: točno to. Uz to je `udio_koridora` — koliko čestice pada u
 * planirani cestovni koridor — bio izračunat, poslan pregledniku i nigdje
 * ispisan, a nije mali: 42 od 56 slobodnih čestica ima koridor, do 57 %.
 *
 * Presuda u boji radnje uz prešućene zapreke gora je od nikakve presude.
 * Ovo ih diže uz presudu i gasi zeleni okvir.
 */
const ZAPREKE_SLOJEVI: { id: string; url: string; opis: (n: number) => string }[] = [
  {
    id: "struja-vn-110",
    url: "/geo/grad/struja-vn-110.geojson",
    opis: (n) =>
      n === 1
        ? "preko čestice prolazi dalekovod visokog napona"
        : `preko čestice prolaze ${n} ${brojnica(n, "dalekovod", "dalekovoda", "dalekovoda")} visokog napona`,
  },
];

/** Hrvatska brojnica: 1 / 2–4 / 5+. */
function brojnica(n: number, jedan: string, dva: string, pet: string): string {
  const z = n % 10;
  const z2 = n % 100;
  if (z === 1 && z2 !== 11) return jedan;
  if (z >= 2 && z <= 4 && (z2 < 12 || z2 > 14)) return dva;
  return pet;
}

async function zapreke(
  cestica: Feature | null,
  udioKoridora: number
): Promise<Namjena["zapreke"]> {
  const out: Namjena["zapreke"] = [];
  if (cestica) {
    for (const s of ZAPREKE_SLOJEVI) {
      const u = await ucitaj(s.url);
      if (!u) continue;
      let n = 0;
      for (const f of u.fc.features) {
        try {
          if (booleanIntersects(cestica as never, f as never)) n++;
        } catch {
          /* neispravna geometrija — preskoči */
        }
      }
      if (n > 0)
        out.push({
          vrsta: s.id,
          opis: s.opis(n),
          izvor: "elektroenergetska mreža, GIS Grada Splita",
        });
    }
  }
  // Koridor se ne broji ispod 5 %: ispod toga je najčešće rub koridora koji
  // dotakne ugao čestice, a ne prepreka gradnji.
  if (udioKoridora >= 0.05)
    out.push({
      vrsta: "koridor",
      opis: `planirani cestovni koridor zauzima ${Math.round(udioKoridora * 100)} % čestice`,
      izvor: "koridori iz GUP-a",
    });
  return out;
}

/**
 * Zašto čestica nije u sloju slobodnih.
 *
 * Sloj je presjek uvjeta i izbacuje bez objašnjenja; ovdje se pogađa onaj
 * koji je najvjerojatnije presudio, po istim podacima. Formulacija je
 * namjerno oprezna („najvjerojatnije”): točan razlog zna samo skripta, a
 * lažna preciznost je gora od poštene nesigurnosti.
 */
async function zastoNije(cestica: Feature): Promise<string> {
  const zgrade = await ucitaj("/geo/grad/zgrade-2025.geojson");
  if (zgrade) {
    for (const f of zgrade.fc.features) {
      try {
        if (booleanIntersects(cestica as never, f as never))
          return "na njoj već stoji zgrada";
      } catch {
        /* neispravna geometrija — preskoči */
      }
    }
  }
  const povrsina = Number((cestica.properties ?? {}).povrsina ?? 0);
  if (povrsina > 0 && povrsina < 300)
    return "manja je od najmanje građevne čestice (300 m² po Odredbama)";
  return "ne prolazi jedan od uvjeta iz analize (cesta, koridor ili premala nakupina)";
}

/** Godine izvan ovoga su očita greška u izvoru (nalazi se i „3974”). */
const NAJRANIJA_GODINA = 1850;
/** Isto za datume: rasvjeta ima ugradnje zavedene kao „1111-01-01”. */
const BESMISLEN_DATUM = /^(0{4}|1{4}|1[0-7]\d\d)-/;

/**
 * Naziv plana bez oznake objave. „PPUG Splita (Sl.gl. Grada Splita 31/05,
 * 38/20 i 46/20 - pt)” je kao redak u dosjeu tri četvrtine šifre; broj
 * službenog glasnika treba onome tko plan traži, a ne onome tko gleda što
 * mu vrijedi na čestici. Puni naziv i dalje stoji iza poveznice.
 */
function skratiNaziv(v: string): string {
  return v.replace(/\s*\(\s*(sl\.?\s*gl|služb).*$/i, "").trim();
}

/**
 * Duljina iznad koje se vrijednost krati. Opis prometnog znaka je cijeli
 * odlomak pravilnika („Sadrži pobliže objašnjenje prometnog znaka riječima
 * ili simbolom…”) i sam bi progutao stupac. Krati se, a ne izbacuje, jer
 * ista rubrika kod kulturnog dobra nosi ono najzanimljivije.
 */
const NAJDULJI_ISPIS = 72;

/** Očisti svojstva prije ispisa u dosjeu. */
function zaDosje(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (BEZ_U_DOSJEU.has(k) || v === null || v === "") continue;
    if (k === "godina" && (typeof v !== "number" || v < NAJRANIJA_GODINA))
      continue;
    if (typeof v !== "string") {
      out[k] = v;
      continue;
    }
    if (BESMISLEN_DATUM.test(v)) continue;
    const cisto = k === "naziv" ? skratiNaziv(v) : v;
    out[k] =
      cisto.length > NAJDULJI_ISPIS
        ? cisto.slice(0, NAJDULJI_ISPIS).trimEnd() + "…"
        : cisto;
  }
  return out;
}

interface Ucitano {
  fc: FeatureCollection;
  okviri: [number, number, number, number][];
}

const spremnik = new Map<string, Ucitano | null>();

/** Učitaj sloj s diska i zapamti okvire objekata (za brzo predfiltriranje). */
async function ucitaj(url: string): Promise<Ucitano | null> {
  const spremljeno = spremnik.get(url);
  if (spremljeno !== undefined) return spremljeno;
  try {
    const tekst = await readFile(path.join(GEO, url.replace("/geo/", "")), "utf-8");
    const fc = JSON.parse(tekst) as FeatureCollection;
    const okviri = fc.features.map(
      (f) => turfBbox(f) as [number, number, number, number]
    );
    const u = { fc, okviri };
    spremnik.set(url, u);
    return u;
  } catch {
    // Sloj koji nije izrađen (ili je namjerno samo lokalan) nije greška —
    // dosje se sastavlja od onoga što postoji.
    spremnik.set(url, null);
    return null;
  }
}

function okviriSijeku(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

/**
 * Sastavi dosje za točku. Čestica se traži u sloju katastra; ako je nema
 * (rub kvarta, more, neobuhvaćeno), dosje se svejedno sastavlja oko točke,
 * jer je i tada korisno vidjeti što je ondje.
 */
/**
 * Čestice i adrese koje odgovaraju upisanom nizu.
 *
 * Traži se i po broju čestice („392/3”, „392”) i po adresi („Mostine 12”),
 * jer susjed jedno od toga sigurno zna, a rijetko oboje. Vraća se točka po
 * pogotku, pa je karta može otvoriti kao i svaki drugi dosje.
 *
 * Točka je `pointOnFeature`, ne centroid: centroid udubljene čestice zna
 * pasti izvan nje, a onda bi dosje opisao susjedovu zemlju.
 */
export async function nadiCestice(upit: string): Promise<
  { naziv: string; opis: string; lat: number; lng: number }[]
> {
  const q = upit.toLocaleLowerCase("hr-HR").trim();
  const out: { naziv: string; opis: string; lat: number; lng: number }[] = [];

  const kat = await ucitaj("/geo/grad/katastar.geojson");
  if (kat) {
    for (const f of kat.fc.features) {
      const br = String(f.properties?.cestica ?? "");
      if (!br) continue;
      const brl = br.toLocaleLowerCase("hr-HR");
      // Točan pogodak, pa početak — „392” ne smije dati „1392”.
      if (brl !== q && !brl.startsWith(q + "/") && !brl.startsWith(q)) continue;
      const t = pointOnFeature(f as Feature<never>);
      const [lng, lat] = t.geometry.coordinates as [number, number];
      out.push({
        naziv: `k.č. ${br}`,
        opis: `k.o. ${f.properties?.ko ?? ""} · ${Math.round(
          Number(f.properties?.povrsina ?? 0)
        ).toLocaleString("hr-HR")} m²`,
        lat,
        lng,
      });
      if (out.length >= 8) return out;
    }
  }

  if (out.length === 0) {
    const adr = await ucitaj("/geo/grad/adrese.geojson");
    if (adr) {
      // Isti kućni broj zna imati više točaka (ulaz, zgrada, parcela), pa se
      // ponavljanja izbacuju — osam puta „Mostine 1” nije osam rezultata.
      const vidjeno = new Set<string>();
      for (const f of adr.fc.features) {
        const ul = String(f.properties?.ulica ?? "");
        const br = String(f.properties?.broj ?? "");
        if (!ul) continue;
        const puna = `${ul} ${br}`.trim();
        if (!puna.toLocaleLowerCase("hr-HR").includes(q)) continue;
        const naziv = vrijednostPolja(puna);
        if (vidjeno.has(naziv)) continue;
        vidjeno.add(naziv);
        const t = pointOnFeature(f as Feature<never>);
        const [lng, lat] = t.geometry.coordinates as [number, number];
        out.push({ naziv, opis: "adresa", lat, lng });
        if (out.length >= 8) break;
      }
    }
  }
  return out;
}

export async function dosjeZaTocku(lng: number, lat: number): Promise<Dosje> {
  const tocka = { type: "Point", coordinates: [lng, lat] as Position } as const;

  const katastar = await ucitaj("/geo/grad/katastar.geojson");
  let cestica: Feature | null = null;
  if (katastar) {
    for (let i = 0; i < katastar.fc.features.length; i++) {
      const f = katastar.fc.features[i];
      const o = katastar.okviri[i];
      if (lng < o[0] || lng > o[2] || lat < o[1] || lat > o[3]) continue;
      try {
        if (booleanPointInPolygon(tocka, f as Feature<never>)) {
          cestica = f;
          break;
        }
      } catch {
        /* neispravna geometrija — preskoči */
      }
    }
  }

  // Bez čestice se ispituje sama točka; s česticom njezin puni oblik.
  const meta: Feature = cestica ?? ({ type: "Feature", properties: {}, geometry: tocka } as Feature);
  const metaOkvir = turfBbox(meta) as [number, number, number, number];
  const sredina = cestica ? pointOnFeature(cestica as Feature<never>) : null;

  let javnaCestica: PublicParcelProperties | null = null;
  const javniSloj = await ucitaj("/geo/analiza/javne-cestice.geojson");
  if (javniSloj) {
    for (let i = 0; i < javniSloj.fc.features.length; i++) {
      const okvir = javniSloj.okviri[i];
      if (lng < okvir[0] || lng > okvir[2] || lat < okvir[1] || lat > okvir[3]) continue;
      const feature = javniSloj.fc.features[i];
      try {
        if (!booleanPointInPolygon(tocka, feature as Feature<never>)) continue;
        validatePublicParcelProperties(feature.properties);
        javnaCestica = feature.properties;
        break;
      } catch {
        /* neispravan ili nesiguran javni zapis ne ide u dosje */
      }
    }
  }

  const poTemi = new Map<Tema, Stavka[]>();
  let pretrazeno = 0;

  for (const sloj of OVERLAY_LAYERS) {
    const upis = U_DOSJEU[sloj.id];
    if (!upis || sloj.type !== "geojson") continue;
    const { tema, odnos } = upis;
    const u = await ucitaj(sloj.url);
    if (!u) continue;
    pretrazeno++;

    const pogodci: Feature[] = [];
    for (let i = 0; i < u.fc.features.length; i++) {
      if (!okviriSijeku(metaOkvir, u.okviri[i])) continue;
      const f = u.fc.features[i];
      try {
        // „nad” pita gdje čestica leži, pa je dovoljna jedna njezina točka —
        // inače bi čestica na međi ispala u dva kotara i dvije zone.
        const pogodak =
          odnos === "nad"
            ? booleanPointInPolygon(
                (sredina ?? tocka) as Feature<never>,
                f as Feature<never>
              )
            : booleanIntersects(meta, f);
        if (pogodak) pogodci.push(f);
      } catch {
        /* geometrija koju turf ne probavi — preskoči objekt, ne sloj */
      }
    }
    if (pogodci.length === 0) continue;

    const poveznica = pogodci
      .map((f) => f.properties?.poveznica)
      .find((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
    // Jednaki opisi se sažimaju: tri „Tlačni vod” jedan ispod drugoga
    // zauzimaju tri retka, a kažu ono što brojka uz naslov već kaže.
    // Praznog opisa nema smisla ispisivati — broj objekata je sve što o
    // takvom sloju znamo.
    const primjeri: string[] = [];
    for (const f of pogodci) {
      const opis = opisObjekta(
        zaDosje((f.properties ?? {}) as Record<string, unknown>),
        2
      );
      if (opis === "objekt" || primjeri.includes(opis)) continue;
      primjeri.push(opis);
      if (primjeri.length === NAJVISE_PO_SLOJU) break;
    }

    const stavke = poTemi.get(tema) ?? [];
    stavke.push({
      sloj: sloj.label,
      broj: pogodci.length,
      odnos,
      primjeri,
      ...(poveznica ? { poveznica } : {}),
    });
    poTemi.set(tema, stavke);
  }

  return {
    cestica: cestica ? ((cestica.properties ?? {}) as Record<string, unknown>) : null,
    javnaCestica,
    namjena: await namjenaNaTocki(
      { type: "Feature", properties: {}, geometry: tocka } as Feature,
      cestica
    ),
    // Redoslijed tema je zadan, ne po broju pogodaka: dosje se čita više
    // puta i mora svaki put izgledati isto, inače se ne pamti gdje što stoji.
    skupine: TEME.filter((t) => (poTemi.get(t.id)?.length ?? 0) > 0).map((t) => ({
      naslov: t.naslov,
      stavke: poTemi.get(t.id)!,
    })),
    pretrazeno,
  };
}
