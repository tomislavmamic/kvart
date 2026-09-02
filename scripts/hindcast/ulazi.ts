/**
 * Ulazi i opažanja za povijesnu provjeru (hindcast) modela perjanice.
 *
 * Provjera treba dvije stvari koje stranica nikad nema odjednom: satni niz
 * ulaza (vjetar, dubina sloja, okolnosti) za dvije godine unatrag, i satna
 * opažanja prema kojima se model ocjenjuje (H₂S i merkaptani uz plohu,
 * dojave iz kvarta). Sve to leži u `.cache/`, skinuto jednom; ovaj modul ga
 * čita, svodi na oblike iz `tipovi.ts` i **ne izmišlja ništa**: sat koji nijedan
 * izvor ne pokriva ostaje `null`, a svaki dio sata nosi odakle je.
 *
 * Što treba znati o izvorima, jer im se zapisi razlikuju u sitnicama koje
 * pomiču sat:
 *
 * - **AZO** (`iszz.azo.hr`): `vrijeme` je epoha u ms, ali označuje **kraj**
 *   sata, ne početak. Provjereno usporedbom H₂S-a s postaje 308 prema Zavodovoj
 *   tablici k1 (gdje `sat` izričito jest kraj sata): uz pomak od −1 h vrijednosti
 *   su identične u 9 528 od 9 529 preklopljenih sati (r = 1,000); bez pomaka
 *   poklapa se 0,2 %. Isti uređaj, isti brojevi, samo drukčije označen sat.
 *   Zato je početak sata `vrijeme − 1 h`. (`procitajAzoNiz` u
 *   `src/lib/sim/vrijeme-satno.ts` i `split3()` u `scripts/vjetar.py` uzimaju
 *   `vrijeme` kao početak — pomaknuti su za sat unaprijed; vidi izvješće.)
 * - **Zavod** (`zrak-zavod-split.info`): čita se postojećim `procitajTablicu`,
 *   koji mjesno vrijeme pretvara u UTC. Njegov `uUtc` je do 2. 9. 2026. gubio
 *   mjesnu ponoć (`hour12: false` na Nodeu 21 ispiše „24” umjesto „00”), pa je
 *   iz svakog dana ispadao redak 0–1 h; ispravljeno s `hourCycle: "h23"`.
 * - **Open-Meteo**: `time` bez zone, ali u UTC-u; `boundary_layer_height` se
 *   spušta na pod od 25 m isto kao u proizvodnji (`procitajDubine`).
 * - **Meteostat** (Split-Marjan): brzina u km/h, dan i sat u UTC-u odvojeno.
 * - **METAR LDSP**: više očitanja u satu usrednjuju se vektorski, kao u
 *   `scripts/vjetar.py`.
 * - **Dojave**: razlažu se na sate istim pravilima kao ruža u `src/lib/dojave.ts`
 *   (svaki puni sat od početka do kraja − 1 ms, najviše šest; isti nos u istom
 *   satu broji se jednom, uzima se jače).
 *
 * Pokretanje kao alat:
 *   npx tsx scripts/hindcast/ulazi.ts --od 2024-09-01 --do 2026-09-02 \
 *     --pravilo proizvodnja --izlaz .cache/hindcast/ulazi.json
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import type { OdourStrength } from "@/lib/constants";
import { NAJDULJI_RASPON_SATI, TEZINA } from "@/lib/dojave";
import { procitajTablicu } from "@/lib/sim/postaje-satno";

import type {
  DojavaSat,
  DubinaSata,
  IzvorVjetraHindcast,
  OkolnostiSata,
  Opazanja,
  Opazanje,
  PraviloVjetra,
  Prijemnik,
  Razdoblje,
  SatUlaza,
  VjetarSata,
} from "./tipovi";

// ---------------------------------------------------------------------------
// Gdje što leži

export const KORIJEN = path.resolve(import.meta.dirname, "../..");
const PREDMEMORIJA = path.join(KORIJEN, ".cache");
export const MAPA_AZO = path.join(PREDMEMORIJA, "hindcast", "azo");
export const MAPA_ZAVOD = path.join(PREDMEMORIJA, "hindcast", "zavod");
export const MAPA_METEO = path.join(PREDMEMORIJA, "hindcast", "meteo");
export const MAPA_VJETAR = path.join(PREDMEMORIJA, "vjetar");
export const DATOTEKA_DOJAVA = path.join(KORIJEN, "data", "dojave.json");

/** AZO-ove oznake postaja; 308 je postaja uz plohu, 305 i 304 gradske. */
export const AZO_POSTAJE = { split3: 305, split2: 304, karepovac: 308 } as const;
/** AZO-ove oznake veličina. */
export const AZO_VELICINE = { h2s: 4, brzina: 477, smjer: 478 } as const;

const SAT_MS = 3_600_000;
/** Isti pod kao `NAJPLICI_SLOJ` u `src/lib/sim/vrijeme-satno.ts`. */
const NAJPLICI_SLOJ = 25;
const CVOR_U_MS = 0.514444;

export type Vjetar = { readonly smjerOd: number; readonly brzina: number };
export type NizVjetra = Map<string, Vjetar>;
export type OkolnostiBezIzvora = Omit<OkolnostiSata, "izvor">;

export type OpenMeteoNiz = {
  readonly vjetar: NizVjetra;
  readonly dubine: Map<string, number>;
  readonly okolnosti: Map<string, OkolnostiBezIzvora>;
};

/** Svi nizovi koje `sloziUlaze` može tražiti. */
export type IzvoriUlaza = {
  readonly vjetar: Record<IzvorVjetraHindcast, NizVjetra>;
  readonly dubine: { readonly prognoza: Map<string, number>; readonly era5: Map<string, number> };
  readonly okolnosti: {
    readonly prognoza: Map<string, OkolnostiBezIzvora>;
    readonly era5: Map<string, OkolnostiBezIzvora>;
  };
};

// ---------------------------------------------------------------------------
// Vrijeme

/** Početak sata u kojem leži trenutak, kao `toISOString()`. */
export function satIso(ms: number): string {
  return new Date(Math.floor(ms / SAT_MS) * SAT_MS).toISOString();
}

/**
 * Početak sata na koji se odnosi AZO-ov zapis.
 *
 * AZO-ov `vrijeme` označuje kraj sata (vidi zaglavlje modula), pa je početak
 * sat ranije.
 */
export function satAzo(vrijemeMs: number): string {
  return satIso(vrijemeMs - SAT_MS);
}

function broj(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function smjerUKrug(smjer: number): number {
  return ((smjer % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Čitanje pojedinih zapisa (čisto, bez diska — ovo se testira)

/**
 * Čita AZO-ov izvoz u niz po satu.
 *
 * Args:
 *   odgovor: Razložen JSON, niz `{vrijednost, vrijeme}`.
 *
 * Returns:
 *   Vrijednost po početku sata; zapisi bez broja se preskaču, predznak se
 *   ovdje ne gleda (o negativnim brojevima odlučuje onaj tko zna što mjeri).
 */
export function procitajAzo(odgovor: unknown): Map<string, number> {
  const izlaz = new Map<string, number>();
  if (!Array.isArray(odgovor)) return izlaz;
  for (const zapis of odgovor) {
    if (typeof zapis !== "object" || zapis === null) continue;
    const v = broj((zapis as Record<string, unknown>).vrijednost);
    const t = broj((zapis as Record<string, unknown>).vrijeme);
    if (v === null || t === null) continue;
    izlaz.set(satAzo(t), v);
  }
  return izlaz;
}

/**
 * Spaja AZO-ove nizove brzine i smjera u vjetar po satu.
 *
 * Sat bez smjera ili s negativnom brzinom (AZO tako označuje kvar) izostaje.
 */
export function spojiAzoVjetar(
  brzine: ReadonlyMap<string, number>,
  smjerovi: ReadonlyMap<string, number>,
): NizVjetra {
  const izlaz: NizVjetra = new Map();
  for (const [sat, brzina] of brzine) {
    if (brzina < 0) continue;
    const smjer = smjerovi.get(sat);
    if (smjer === undefined) continue;
    izlaz.set(sat, { smjerOd: smjerUKrug(smjer), brzina });
  }
  return izlaz;
}

/**
 * Čita Meteostatov skupni CSV izmjerenih satnih vrijednosti.
 *
 * Stupci su po položaju: dan, sat (UTC), …, smjer na mjestu 7, brzina u km/h
 * na mjestu 8. Isto kao `marjan()` u `scripts/vjetar.py`.
 */
export function procitajMarjan(csv: string): NizVjetra {
  const izlaz: NizVjetra = new Map();
  for (const redak of csv.split("\n")) {
    const polja = redak.replace(/\r$/, "").split(",");
    if (polja.length < 9 || !polja[7] || !polja[8]) continue;
    const [dan, sat] = polja;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dan)) continue;
    const h = Number(sat);
    const smjer = Number(polja[7]);
    const kmh = Number(polja[8]);
    if (!Number.isInteger(h) || h < 0 || h > 23) continue;
    if (!Number.isFinite(smjer) || !Number.isFinite(kmh) || kmh < 0) continue;
    izlaz.set(`${dan}T${String(h).padStart(2, "0")}:00:00.000Z`, {
      smjerOd: smjerUKrug(smjer),
      brzina: kmh / 3.6,
    });
  }
  return izlaz;
}

/**
 * Čita METAR-ov CSV s mesoneta (`station,valid,drct,sknt`) i usrednjuje po satu.
 *
 * Više očitanja unutar sata usrednjuju se vektorski — smjerovi se ne smiju
 * zbrajati kao brojevi — pa je brzina duljina srednjeg vektora, kao u
 * `ldsp()` u `scripts/vjetar.py`. `M` je nedostajuća vrijednost.
 */
export function procitajLdsp(csv: string): NizVjetra {
  const redci = csv.split("\n").filter((r) => r.trim() && !r.startsWith("#"));
  if (!redci.length) return new Map();
  const zaglavlje = redci[0].replace(/\r$/, "").split(",").map((s) => s.trim());
  const iValid = zaglavlje.indexOf("valid");
  const iSmjer = zaglavlje.indexOf("drct");
  const iBrzina = zaglavlje.indexOf("sknt");
  if (iValid < 0 || iSmjer < 0 || iBrzina < 0) return new Map();

  const zbroj = new Map<string, { u: number; v: number; n: number }>();
  for (const redak of redci.slice(1)) {
    const polja = redak.replace(/\r$/, "").split(",");
    const smjer = Number(polja[iSmjer]);
    const cvorova = Number(polja[iBrzina]);
    const kad = Date.parse(`${(polja[iValid] ?? "").trim().replace(" ", "T")}Z`);
    if (!Number.isFinite(smjer) || !Number.isFinite(cvorova) || Number.isNaN(kad)) continue;
    if (!polja[iSmjer]?.trim() || !polja[iBrzina]?.trim() || cvorova < 0) continue;
    const sat = satIso(kad);
    const brzina = cvorova * CVOR_U_MS;
    const kut = (smjer * Math.PI) / 180;
    const s = zbroj.get(sat) ?? { u: 0, v: 0, n: 0 };
    s.u += brzina * Math.sin(kut);
    s.v += brzina * Math.cos(kut);
    s.n += 1;
    zbroj.set(sat, s);
  }

  const izlaz: NizVjetra = new Map();
  for (const [sat, { u, v, n }] of zbroj) {
    const su = u / n;
    const sv = v / n;
    izlaz.set(sat, {
      smjerOd: smjerUKrug((Math.atan2(su, sv) * 180) / Math.PI),
      brzina: Math.hypot(su, sv),
    });
  }
  return izlaz;
}

/**
 * Čita Open-Meteov `hourly` blok (ERA5 arhiva ili arhivirana prognoza).
 *
 * Vjetar traži i smjer i brzinu; dubina se zaokružuje i spušta na pod od 25 m
 * kao u proizvodnji; okolnosti zadržavaju `null` gdje ga model ima.
 */
export function procitajOpenMeteo(odgovor: unknown): OpenMeteoNiz {
  const vjetar: NizVjetra = new Map();
  const dubine = new Map<string, number>();
  const okolnosti = new Map<string, OkolnostiBezIzvora>();
  const satno = (odgovor as { hourly?: Record<string, unknown> } | null)?.hourly;
  const vremena = satno?.time;
  if (!satno || !Array.isArray(vremena)) return { vjetar, dubine, okolnosti };

  const stupac = (ime: string): readonly unknown[] =>
    Array.isArray(satno[ime]) ? (satno[ime] as unknown[]) : [];
  const brzine = stupac("wind_speed_10m");
  const smjerovi = stupac("wind_direction_10m");
  const slojevi = stupac("boundary_layer_height");
  const sunce = stupac("shortwave_radiation");
  const oblaci = stupac("cloud_cover");
  const temperatura = stupac("temperature_2m");
  const oborina = stupac("precipitation");

  for (let i = 0; i < vremena.length; i += 1) {
    const t = vremena[i];
    if (typeof t !== "string") continue;
    const ms = Date.parse(`${t}Z`);
    if (Number.isNaN(ms)) continue;
    const sat = satIso(ms);

    const brzina = broj(brzine[i]);
    const smjer = broj(smjerovi[i]);
    if (brzina !== null && smjer !== null && brzina >= 0) {
      vjetar.set(sat, { smjerOd: smjerUKrug(smjer), brzina });
    }
    const sloj = broj(slojevi[i]);
    if (sloj !== null) dubine.set(sat, Math.max(NAJPLICI_SLOJ, Math.round(sloj)));

    const o: OkolnostiBezIzvora = {
      sunce: broj(sunce[i]),
      oblaci: broj(oblaci[i]),
      temperatura: broj(temperatura[i]),
      oborina: broj(oborina[i]),
    };
    if (o.sunce !== null || o.oblaci !== null || o.temperatura !== null || o.oborina !== null) {
      okolnosti.set(sat, o);
    }
  }
  return { vjetar, dubine, okolnosti };
}

/**
 * H₂S s AZO-ove postaje kao opažanja.
 *
 * Negativno je kvar, ne koncentracija. Točna nula također: AZO-ov niz s
 * postaje 308 ima 3 696 sati s vrijednošću 0,000 (20 %), u nizovima i po 470
 * sati zaredom, a nijedan od njih ne postoji u Zavodovoj tablici istog
 * uređaja — Zavod ih briše kao nevaljane (najmanja stvarna vrijednost mu je
 * 0,101, AZO-ova 0,001). Zadržati ih značilo bi ocjenjivati model prema
 * „čistom zraku” koji nitko nije izmjerio.
 */
export function opazanjaAzo(odgovor: unknown, izvor: Opazanje["izvor"] = "azo308"): Opazanje[] {
  const izlaz: Opazanje[] = [];
  for (const [sat, vrijednost] of procitajAzo(odgovor)) {
    if (vrijednost <= 0) continue;
    izlaz.push({ sat, vrijednost, ispodGranice: false, izvor });
  }
  return izlaz.sort((a, b) => a.sat.localeCompare(b.sat));
}

/** Jedan stupac Zavodove mjesečne tablice kao opažanja; `-` (null) izostaje. */
export function opazanjaZavoda(
  html: string,
  stupac: string,
  izvor: "zavod-k1" | "zavod-k2",
): Opazanje[] {
  const izlaz: Opazanje[] = [];
  for (const o of procitajTablicu(html, stupac)) {
    if (o.vrijednost === null || o.vrijednost < 0) continue;
    izlaz.push({ sat: o.sat, vrijednost: o.vrijednost, ispodGranice: o.ispodGranice, izvor });
  }
  return izlaz;
}

// ---------------------------------------------------------------------------
// Dojave

/** Redak iz `data/dojave.json`, samo polja koja provjera treba. */
export type RedDojave = {
  readonly id: number;
  readonly occurredAt: string;
  readonly endedAt?: string | null;
  readonly smelled?: boolean;
  readonly strength?: OdourStrength | null;
  readonly place?: string | null;
  readonly reporterId?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly hidden?: boolean;
  readonly durationMin?: number | null;
};

/**
 * Mjesta dojava bez koordinate, po adresi (isto kao `scripts/provjeri-dojave.ts`).
 *
 * Matoševa je sredina ulice, jer Nominatim ne zna broj 59; ulica je duga
 * ~1,5 km, pa je to ±0,7 km — dovoljno za smjer prema plohi, ne i za više.
 */
export const ADRESE_DOJAVA: Record<string, { lat: number; lon: number; ime: string }> = {
  "Dračevac 7B": { lat: 43.527789, lon: 16.50401, ime: "dracevac-7b" },
  "Matoševa ulica 59, Solin": { lat: 43.5312, lon: 16.4995, ime: "matoseva-59" },
};

/** Postaja uz plohu; koordinate su terenske, ne AZO-ove (vidi `postaje-satno.ts`). */
export const PRIJEMNIK_K1: Prijemnik = {
  ime: "k1",
  lat: 43.5166505,
  lon: 16.5169123,
  opis: "Karepovac 1/2 postaja, udolina JI od plohe",
};

/** Ime prijemnika iz teksta: bez dijakritika, mala slova, crtice. */
export function slug(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Prijemnik na koji se dojava odnosi.
 *
 * Dojava s koordinatom postaje `dojava-<lat>-<lon>` na četiri decimale (≈ 10 m),
 * pa se dojave s istoga mjesta slažu u isti prijemnik. Bez koordinate se gleda
 * adresa; nepoznata adresa nema prijemnika i dojava ispada.
 */
export function prijemnikDojave(red: RedDojave): Prijemnik | null {
  if (typeof red.lat === "number" && typeof red.lng === "number") {
    const lat = Number(red.lat.toFixed(4));
    const lon = Number(red.lng.toFixed(4));
    return {
      ime: `dojava-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      lat,
      lon,
      opis: red.place?.trim() || "dojava s koordinatom",
    };
  }
  const adresa = red.place ? ADRESE_DOJAVA[red.place.trim()] : undefined;
  if (!adresa) return null;
  return { ime: adresa.ime, lat: adresa.lat, lon: adresa.lon, opis: red.place!.trim() };
}

/**
 * Sati koje dojava pokriva — isti raspis kao `satiDojave` u `src/lib/dojave.ts`.
 *
 * Kraj se umanjuje za trenutak (epizoda 14–15 h leži u satu 14), raspon se reže
 * na `NAJDULJI_RASPON_SATI`, kraj prije početka svodi se na jedan sat.
 */
export function satiDojave(red: RedDojave): number[] {
  const pocetak = Math.floor(Date.parse(red.occurredAt) / SAT_MS);
  const kraj = red.endedAt ? Math.floor((Date.parse(red.endedAt) - 1) / SAT_MS) : pocetak;
  if (!(kraj > pocetak)) return [pocetak];
  const zadnji = Math.min(kraj, pocetak + NAJDULJI_RASPON_SATI - 1);
  const sati: number[] = [];
  for (let h = pocetak; h <= zadnji; h += 1) sati.push(h);
  return sati;
}

/**
 * Razlaže dojave na satna opažanja po prijemniku.
 *
 * Skrivene dojave i dojave bez mjesta ispadaju. Isti dojavitelj u istom satu
 * broji se jednom: „smrdi” nadjačava „ne smrdi”, jače nadjačava slabije —
 * točno kao ruža u `src/lib/dojave.ts`. Dojava bez oznake dojavitelja dobiva
 * vlastitu oznaku, jer se ne zna je li isti nos.
 */
export function dojaveUSate(redovi: readonly RedDojave[]): DojavaSat[] {
  const poKljucu = new Map<string, DojavaSat>();
  for (const red of redovi) {
    if (red.hidden) continue;
    if (!Number.isFinite(Date.parse(red.occurredAt))) continue;
    const prijemnik = prijemnikDojave(red);
    if (!prijemnik) continue;
    const smrdi = red.smelled ?? true;
    const tezina = smrdi ? TEZINA[red.strength ?? "osjetno"] : 0;
    const dojavitelj = red.reporterId ?? `bez-oznake-${red.id}`;
    for (const h of satiDojave(red)) {
      const sat = new Date(h * SAT_MS).toISOString();
      const kljuc = `${dojavitelj}@${sat}`;
      const dosad = poKljucu.get(kljuc);
      const jace =
        !dosad ||
        (smrdi && !dosad.smrdi) ||
        (smrdi === dosad.smrdi && tezina > dosad.tezina);
      if (jace) {
        poKljucu.set(kljuc, {
          sat,
          prijemnik: prijemnik.ime,
          smrdi,
          tezina,
          dojavitelj,
          idDojave: red.id,
        });
      }
    }
  }
  return [...poKljucu.values()].sort(
    (a, b) =>
      a.sat.localeCompare(b.sat) ||
      a.prijemnik.localeCompare(b.prijemnik) ||
      a.idDojave - b.idDojave,
  );
}

let memoPrijemniciPoImenu: Map<string, Prijemnik> | null = null;

/** Prijemnici iz `data/dojave.json`, po imenu — za satna opažanja koja nose samo ime. */
function prijemniciPoImenu(): Map<string, Prijemnik> {
  if (!memoPrijemniciPoImenu) {
    memoPrijemniciPoImenu = new Map(prijemniciDojava(ucitajDojave()).map((p) => [p.ime, p]));
  }
  return memoPrijemniciPoImenu;
}

/**
 * Prijemnici svih mjesta s kojih je stigla bar jedna vidljiva dojava.
 *
 * Prima sirove redke dojava ili već razložena satna opažanja (`DojavaSat`);
 * potonja nose samo ime prijemnika, pa se koordinate traže među mjestima iz
 * `data/dojave.json`.
 */
export function prijemniciDojava(dojave: readonly (RedDojave | DojavaSat)[]): Prijemnik[] {
  const poImenu = new Map<string, Prijemnik>();
  for (const d of dojave) {
    let p: Prijemnik | null | undefined;
    if ("prijemnik" in d) {
      p = prijemniciPoImenu().get(d.prijemnik);
    } else {
      if (d.hidden) continue;
      p = prijemnikDojave(d);
    }
    if (p && !poImenu.has(p.ime)) poImenu.set(p.ime, p);
  }
  return [...poImenu.values()].sort((a, b) => a.ime.localeCompare(b.ime));
}

/** Čita `data/dojave.json`; bez datoteke nema dojava, ne ruši se. */
export function ucitajDojave(datoteka = DATOTEKA_DOJAVA): RedDojave[] {
  if (!existsSync(datoteka)) return [];
  const sadrzaj = JSON.parse(readFileSync(datoteka, "utf8"));
  return Array.isArray(sadrzaj) ? (sadrzaj as RedDojave[]) : [];
}

/** Svi prijemnici provjere: postaja uz plohu i svako mjesto dojave. */
export const PRIJEMNICI: Prijemnik[] = [PRIJEMNIK_K1, ...prijemniciDojava(ucitajDojave())];

// ---------------------------------------------------------------------------
// Slaganje ulaza po pravilu

/** Odakle smjer, redom; prazno mjesto u redu znači „nema vjetra” za taj sat. */
const LANAC_SMJERA: Record<PraviloVjetra, readonly IzvorVjetraHindcast[]> = {
  // Kao stranica: izmjereni AZO niz, pa arhivirani model. ERA5 tek kad ni
  // arhivirane prognoze nema (prije srpnja 2025.), i tada tako i piše.
  proizvodnja: ["split3", "split2", "prognoza", "era5"],
  // Kao `LANAC` u `scripts/vjetar.py`.
  spoj: ["split3", "marjan", "ldsp"],
  split3: ["split3"],
  marjan: ["marjan"],
  ldsp: ["ldsp"],
  prognoza: ["prognoza"],
  era5: ["era5"],
};

/** Odakle brzina u spoju; kao `LANAC_BRZINE` u `scripts/vjetar.py`. */
const LANAC_BRZINE_SPOJA: readonly IzvorVjetraHindcast[] = ["marjan", "ldsp", "era5"];

/** Početci svih punih sati od `od` (uključivo) do `do` (isključivo). */
export function satiRazdoblja(razdoblje: Razdoblje): string[] {
  const od = Date.parse(razdoblje.od);
  const do_ = Date.parse(razdoblje.do);
  if (Number.isNaN(od) || Number.isNaN(do_)) {
    throw new Error(`razdoblje nije valjano: ${razdoblje.od} – ${razdoblje.do}`);
  }
  const sati: string[] = [];
  for (let ms = Math.floor(od / SAT_MS) * SAT_MS; ms < do_; ms += SAT_MS) {
    sati.push(new Date(ms).toISOString());
  }
  return sati;
}

function prviKojiIma<T>(
  sat: string,
  redoslijed: readonly IzvorVjetraHindcast[],
  nizovi: Record<IzvorVjetraHindcast, ReadonlyMap<string, T>>,
): { izvor: IzvorVjetraHindcast; vrijednost: T } | null {
  for (const izvor of redoslijed) {
    const v = nizovi[izvor]?.get(sat);
    if (v !== undefined) return { izvor, vrijednost: v };
  }
  return null;
}

/** Vjetar jednog sata po pravilu; `null` kad nijedan izvor u lancu nema sat. */
export function vjetarSata(
  pravilo: PraviloVjetra,
  sat: string,
  vjetar: Record<IzvorVjetraHindcast, NizVjetra>,
): VjetarSata | null {
  const smjer = prviKojiIma(sat, LANAC_SMJERA[pravilo], vjetar);
  if (!smjer) return null;
  if (pravilo !== "spoj") {
    return { smjerOd: smjer.vrijednost.smjerOd, brzina: smjer.vrijednost.brzina, izvor: smjer.izvor };
  }
  // Spoj: smjer s najbliže postaje, brzina s otvorenih — Split-3 stoji u
  // zaklonu i brzinu podcjenjuje. Ako nijedna otvorena nema sat, ostaje
  // brzina s iste postaje s koje je smjer, i to se tako i označi.
  const brzina = prviKojiIma(sat, LANAC_BRZINE_SPOJA, vjetar);
  return {
    smjerOd: smjer.vrijednost.smjerOd,
    brzina: brzina ? brzina.vrijednost.brzina : smjer.vrijednost.brzina,
    izvor: smjer.izvor,
    izvorBrzine: brzina ? brzina.izvor : smjer.izvor,
  };
}

export type OpcijeSlaganja = {
  /**
   * Označi AZO-ov vjetar kao što ga stranica označuje: sat **kasnije** nego
   * što je izmjeren.
   *
   * `procitajAzoNiz` u proizvodnji uzima AZO-ov `vrijeme` (kraj sata) kao
   * početak sata, pa svaki sat vozi vjetrom prethodnog sata. Polazna se
   * vrtnja mora poklopiti s onim što stranica doista crta, pa je ovo tu —
   * kao pokus s ispravkom, a ne kao tiha promjena ulaza.
   */
  readonly azoKasni?: boolean;
};

/** Kopija nizova sa Split-3 i Split-2 pomaknutih za sat unaprijed. */
function sAzoKasnjenjem(
  vjetar: Record<IzvorVjetraHindcast, NizVjetra>,
): Record<IzvorVjetraHindcast, NizVjetra> {
  const pomakni = (niz: NizVjetra): NizVjetra => {
    const izlaz: NizVjetra = new Map();
    for (const [sat, v] of niz) izlaz.set(satIso(Date.parse(sat) + SAT_MS), v);
    return izlaz;
  };
  return { ...vjetar, split3: pomakni(vjetar.split3), split2: pomakni(vjetar.split2) };
}

/**
 * Slaže po jedan `SatUlaza` za svaki sat razdoblja.
 *
 * Vjetar se bira po pravilu; dubina i okolnosti uvijek iz arhivirane prognoze,
 * a iz ERA5-a gdje nje nema. Sat bez izvora nosi `null`, nikad izmišljen broj.
 */
export function sloziUlaze(
  pravilo: PraviloVjetra,
  razdoblje: Razdoblje,
  izvori: IzvoriUlaza,
  opcije: OpcijeSlaganja = {},
): SatUlaza[] {
  if (!(pravilo in LANAC_SMJERA)) throw new Error(`nepoznato pravilo vjetra: ${pravilo}`);
  const vjetar = opcije.azoKasni ? sAzoKasnjenjem(izvori.vjetar) : izvori.vjetar;
  return satiRazdoblja(razdoblje).map((sat) => {
    let dubina: DubinaSata | null = null;
    const dp = izvori.dubine.prognoza.get(sat);
    const de = izvori.dubine.era5.get(sat);
    if (dp !== undefined) dubina = { m: dp, izvor: "prognoza" };
    else if (de !== undefined) dubina = { m: de, izvor: "era5" };

    let okolnosti: OkolnostiSata | null = null;
    const op = izvori.okolnosti.prognoza.get(sat);
    const oe = izvori.okolnosti.era5.get(sat);
    if (op) okolnosti = { ...op, izvor: "prognoza" };
    else if (oe) okolnosti = { ...oe, izvor: "era5" };

    return { sat, vjetar: vjetarSata(pravilo, sat, vjetar), dubina, okolnosti };
  });
}

/**
 * Koliko je sati vjetar došao s kojega izvora.
 *
 * Spoj sa smjerom s jedne, a brzinom s druge postaje broji se pod
 * `smjer+brzina`, da se vidi koliko je sati doista „spojeno”.
 */
export function pokrivenost(ulazi: readonly SatUlaza[]): {
  poIzvoru: Record<string, number>;
  bezVjetra: number;
  ukupno: number;
} {
  const poIzvoru: Record<string, number> = {};
  let bezVjetra = 0;
  for (const u of ulazi) {
    if (!u.vjetar) {
      bezVjetra += 1;
      continue;
    }
    const { izvor, izvorBrzine } = u.vjetar;
    const kljuc = izvorBrzine && izvorBrzine !== izvor ? `${izvor}+${izvorBrzine}` : izvor;
    poIzvoru[kljuc] = (poIzvoru[kljuc] ?? 0) + 1;
  }
  return { poIzvoru, bezVjetra, ukupno: ulazi.length };
}

// ---------------------------------------------------------------------------
// Usporedba dvaju nizova opažanja (AZO 308 prema Zavodu k1)

export type Usporedba = {
  /** Pomak u satima dodan nizu `a` prije sparivanja. */
  readonly pomak: number;
  /** Koliko je sati oba niza imalo. */
  readonly n: number;
  /** Koliko od njih s brojčano istom vrijednošću. */
  readonly identicnih: number;
  /** Pearsonov r; `null` kad ga nema iz čega izračunati. */
  readonly korelacija: number | null;
};

/**
 * Sparuje dva satna niza uz zadane pomake i mjeri koliko se slažu.
 *
 * Služi da se otkrije je li neki izvor pomaknut za sat (početak naspram kraja
 * sata) i jesu li dva izvora zapravo isti uređaj.
 */
export function usporediNizove(
  a: readonly Opazanje[],
  b: readonly Opazanje[],
  pomaci: readonly number[] = [-1, 0, 1],
): Usporedba[] {
  const poSatuB = new Map(b.map((o) => [o.sat, o.vrijednost]));
  return pomaci.map((pomak) => {
    let n = 0;
    let identicnih = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const o of a) {
      const y = poSatuB.get(new Date(Date.parse(o.sat) + pomak * SAT_MS).toISOString());
      if (y === undefined) continue;
      const x = o.vrijednost;
      n += 1;
      if (Math.abs(x - y) < 1e-9) identicnih += 1;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
    }
    const nazivnik = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
    const korelacija = n > 1 && nazivnik > 0 ? (n * sxy - sx * sy) / nazivnik : null;
    return { pomak, n, identicnih, korelacija };
  });
}

/** Pomak s najviše identičnih vrijednosti, pa s najvećom korelacijom. */
export function najboljaUsporedba(usporedbe: readonly Usporedba[]): Usporedba | null {
  let najbolja: Usporedba | null = null;
  for (const u of usporedbe) {
    if (
      !najbolja ||
      u.identicnih > najbolja.identicnih ||
      (u.identicnih === najbolja.identicnih &&
        (u.korelacija ?? -Infinity) > (najbolja.korelacija ?? -Infinity))
    ) {
      najbolja = u;
    }
  }
  return najbolja;
}

/**
 * Sažetak kakvoće jednog niza po mjesecu: koliko sati, koliko ispod granice,
 * najdulji niz jednakih uzastopnih vrijednosti (zaglavljen uređaj).
 */
export function kakvocaNiza(
  opazanja: readonly Opazanje[],
): Record<string, { sati: number; ispodGranice: number; najduljiIsti: number }> {
  const izlaz: Record<string, { sati: number; ispodGranice: number; najduljiIsti: number }> = {};
  const poredano = [...opazanja].sort((a, b) => a.sat.localeCompare(b.sat));
  let prethodna: number | null = null;
  let niz = 0;
  for (const o of poredano) {
    const mjesec = o.sat.slice(0, 7);
    const m = (izlaz[mjesec] ??= { sati: 0, ispodGranice: 0, najduljiIsti: 0 });
    m.sati += 1;
    if (o.ispodGranice) m.ispodGranice += 1;
    niz = prethodna !== null && Math.abs(o.vrijednost - prethodna) < 1e-9 ? niz + 1 : 1;
    prethodna = o.vrijednost;
    if (niz > m.najduljiIsti) m.najduljiIsti = niz;
  }
  return izlaz;
}

// ---------------------------------------------------------------------------
// Čitanje s diska; sve se čita jednom i pamti

function datoteke(mapa: string, prefiks: string, nastavak: string): string[] {
  if (!existsSync(mapa)) return [];
  return readdirSync(mapa)
    .filter((ime) => ime.startsWith(prefiks) && ime.endsWith(nastavak))
    .sort()
    .map((ime) => path.join(mapa, ime));
}

function ucitajJson(datoteka: string): unknown {
  try {
    return JSON.parse(readFileSync(datoteka, "utf8"));
  } catch (greska) {
    // Datoteka koju skidač još piše, ili odgovor koji nije JSON: ne ruši sve.
    process.stderr.write(`preskačem ${path.basename(datoteka)}: ${String(greska)}\n`);
    return null;
  }
}

/** Sve komade jedne AZO-ove veličine spaja u niz po satu; kasniji komad prevlada. */
function azoNiz(postaja: number, velicina: number): Map<string, number> {
  const izlaz = new Map<string, number>();
  for (const d of datoteke(MAPA_AZO, `azo-${postaja}-${velicina}-`, ".json")) {
    for (const [sat, v] of procitajAzo(ucitajJson(d))) izlaz.set(sat, v);
  }
  return izlaz;
}

function azoVjetar(postaja: number): NizVjetra {
  return spojiAzoVjetar(azoNiz(postaja, AZO_VELICINE.brzina), azoNiz(postaja, AZO_VELICINE.smjer));
}

let memoOpenMeteo: { prognoza: OpenMeteoNiz; era5: OpenMeteoNiz } | null = null;

function spojiOpenMeteo(datoteke_: readonly string[]): OpenMeteoNiz {
  const vjetar: NizVjetra = new Map();
  const dubine = new Map<string, number>();
  const okolnosti = new Map<string, OkolnostiBezIzvora>();
  for (const d of datoteke_) {
    const niz = procitajOpenMeteo(ucitajJson(d));
    for (const [k, v] of niz.vjetar) vjetar.set(k, v);
    for (const [k, v] of niz.dubine) dubine.set(k, v);
    for (const [k, v] of niz.okolnosti) okolnosti.set(k, v);
  }
  return { vjetar, dubine, okolnosti };
}

function ucitajOpenMeteo(): { prognoza: OpenMeteoNiz; era5: OpenMeteoNiz } {
  if (!memoOpenMeteo) {
    memoOpenMeteo = {
      prognoza: spojiOpenMeteo(datoteke(MAPA_METEO, "historical-forecast-", ".json")),
      era5: spojiOpenMeteo(datoteke(MAPA_METEO, "era5-", ".json")),
    };
  }
  return memoOpenMeteo;
}

let memoVjetar: Record<IzvorVjetraHindcast, NizVjetra> | null = null;

/**
 * Satni vjetar po izvoru, iz svega što leži u predmemoriji.
 *
 * Returns:
 *   Za svaki izvor niz „početak sata → smjer, brzina”; izvor bez podataka ima
 *   prazan niz (Vrboran zasad uvijek).
 */
export async function ucitajVjetar(): Promise<Record<IzvorVjetraHindcast, NizVjetra>> {
  if (!memoVjetar) {
    const meteo = ucitajOpenMeteo();
    const marjan: NizVjetra = new Map();
    for (const d of datoteke(MAPA_VJETAR, "meteostat-", ".csv.gz")) {
      for (const [k, v] of procitajMarjan(gunzipSync(readFileSync(d)).toString("utf8"))) {
        marjan.set(k, v);
      }
    }
    // Stariji, kraći METAR niz prvi; dulji iz `hindcast/meteo` prevlada.
    const ldsp: NizVjetra = new Map();
    for (const d of [
      ...datoteke(MAPA_VJETAR, "ldsp-", ".csv"),
      ...datoteke(MAPA_METEO, "ldsp-", ".csv"),
    ]) {
      for (const [k, v] of procitajLdsp(readFileSync(d, "utf8"))) ldsp.set(k, v);
    }
    memoVjetar = {
      split3: azoVjetar(AZO_POSTAJE.split3),
      split2: azoVjetar(AZO_POSTAJE.split2),
      marjan,
      ldsp,
      vrboran: new Map(),
      era5: meteo.era5.vjetar,
      prognoza: meteo.prognoza.vjetar,
    };
  }
  return memoVjetar;
}

/** Dubina miješanog sloja po satu, iz arhivirane prognoze i iz ERA5-a. */
export async function ucitajDubine(): Promise<{
  prognoza: Map<string, number>;
  era5: Map<string, number>;
}> {
  const meteo = ucitajOpenMeteo();
  return { prognoza: meteo.prognoza.dubine, era5: meteo.era5.dubine };
}

/** Okolnosti (sunce, oblaci, temperatura, oborina) po satu, iz obaju modela. */
export async function ucitajOkolnosti(): Promise<{
  prognoza: Map<string, OkolnostiBezIzvora>;
  era5: Map<string, OkolnostiBezIzvora>;
}> {
  const meteo = ucitajOpenMeteo();
  return { prognoza: meteo.prognoza.okolnosti, era5: meteo.era5.okolnosti };
}

/** Sve što `sloziUlaze` treba, odjednom. */
export async function ucitajIzvore(): Promise<IzvoriUlaza> {
  const [vjetar, dubine, okolnosti] = await Promise.all([
    ucitajVjetar(),
    ucitajDubine(),
    ucitajOkolnosti(),
  ]);
  return { vjetar, dubine, okolnosti };
}

let memoOpazanja: Opazanja | null = null;

/**
 * Opažanja prema kojima se model ocjenjuje.
 *
 * H₂S dolazi iz dvaju zapisa istog uređaja (AZO 308 i Zavod k1), oba se
 * zadržavaju jer se ne preklapaju posve: AZO ima cijelu 2024., Zavod ima
 * nalaze „< granica” označene kao takve. Merkaptani su samo Zavodovi (k2).
 */
export async function ucitajOpazanja(): Promise<Opazanja> {
  if (!memoOpazanja) {
    const h2s: Opazanje[] = [];
    for (const d of datoteke(MAPA_AZO, `azo-${AZO_POSTAJE.karepovac}-${AZO_VELICINE.h2s}-`, ".json")) {
      h2s.push(...opazanjaAzo(ucitajJson(d), "azo308"));
    }
    for (const d of datoteke(MAPA_ZAVOD, "k1Tab", ".html")) {
      h2s.push(...opazanjaZavoda(readFileSync(d, "utf8"), "H2S", "zavod-k1"));
    }
    const merkaptani: Opazanje[] = [];
    for (const d of datoteke(MAPA_ZAVOD, "k2Tab", ".html")) {
      merkaptani.push(...opazanjaZavoda(readFileSync(d, "utf8"), "metil+etilmerkaptan", "zavod-k2"));
    }
    memoOpazanja = {
      h2s: bezDvostrukih(h2s),
      merkaptani: bezDvostrukih(merkaptani),
      dojave: dojaveUSate(ucitajDojave()),
    };
  }
  return memoOpazanja;
}

/** Isti sat i izvor samo jednom (komadi se preklapaju na rubnim danima). */
function bezDvostrukih(opazanja: readonly Opazanje[]): Opazanje[] {
  const poKljucu = new Map<string, Opazanje>();
  for (const o of opazanja) poKljucu.set(`${o.izvor}@${o.sat}`, o);
  return [...poKljucu.values()].sort(
    (a, b) => a.sat.localeCompare(b.sat) || a.izvor.localeCompare(b.izvor),
  );
}

// ---------------------------------------------------------------------------
// Alat

function argument(ime: string, zadano: string): string {
  const i = process.argv.indexOf(`--${ime}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : zadano;
}

/**
 * Čeka da skidač AZO-ovih nizova završi, ako još radi.
 *
 * Skidač piše `AZO-DONE` na kraj `download.log`; bez toga se čeka najviše
 * `najviseMin` minuta, pa se nastavlja s onim što ima — uz upozorenje.
 */
async function pricekajAzo(najviseMin: number): Promise<void> {
  const dnevnik = path.join(MAPA_AZO, "download.log");
  const gotovo = () =>
    !existsSync(dnevnik) || readFileSync(dnevnik, "utf8").trimEnd().endsWith("AZO-DONE");
  const rok = Date.now() + najviseMin * 60_000;
  while (!gotovo()) {
    if (Date.now() > rok) {
      process.stderr.write("AZO skidanje nije završilo; nastavljam s onim što ima\n");
      return;
    }
    process.stderr.write("čekam AZO skidanje…\n");
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

function postotak(dio: number, cjelina: number): string {
  return cjelina ? `${((100 * dio) / cjelina).toFixed(1)} %` : "–";
}

async function glavni(): Promise<void> {
  const razdoblje: Razdoblje = {
    od: argument("od", "2024-09-01"),
    do: argument("do", "2026-09-02"),
  };
  const pravilo = argument("pravilo", "proizvodnja") as PraviloVjetra;
  const izlaz = argument("izlaz", path.join(PREDMEMORIJA, "hindcast", `ulazi-${pravilo}.json`));
  await pricekajAzo(Number(argument("cekaj", "30")));

  const izvori = await ucitajIzvore();
  const opazanja = await ucitajOpazanja();
  const ulazi = sloziUlaze(pravilo, razdoblje, izvori);
  const pokriveno = pokrivenost(ulazi);

  mkdirSync(path.dirname(izlaz), { recursive: true });
  writeFileSync(
    izlaz,
    JSON.stringify({ ulazi, opazanja, prijemnici: PRIJEMNICI, pokrivenost: pokriveno }),
  );

  const e = process.stderr;
  const sati = new Set(ulazi.map((u) => u.sat));
  e.write(`razdoblje ${razdoblje.od} – ${razdoblje.do}: ${ulazi.length} sati, pravilo ${pravilo}\n`);
  e.write("vjetar po izvoru, sirovo u razdoblju:\n");
  for (const izvor of Object.keys(izvori.vjetar) as IzvorVjetraHindcast[]) {
    const n = [...izvori.vjetar[izvor].keys()].filter((s) => sati.has(s)).length;
    e.write(`  ${izvor.padEnd(9)} ${String(n).padStart(6)}  ${postotak(n, ulazi.length)}\n`);
  }
  e.write(`vjetar odabran po pravilu ${pravilo}:\n`);
  for (const [k, n] of Object.entries(pokriveno.poIzvoru).sort((a, b) => b[1] - a[1])) {
    e.write(`  ${k.padEnd(16)} ${String(n).padStart(6)}  ${postotak(n, ulazi.length)}\n`);
  }
  e.write(`  bez vjetra       ${String(pokriveno.bezVjetra).padStart(6)}  ${postotak(pokriveno.bezVjetra, ulazi.length)}\n`);
  const dubina = ulazi.filter((u) => u.dubina).length;
  const dubinaPrognoza = ulazi.filter((u) => u.dubina?.izvor === "prognoza").length;
  e.write(`dubina: ${dubina} sati (prognoza ${dubinaPrognoza}, era5 ${dubina - dubinaPrognoza}), bez ${ulazi.length - dubina}\n`);

  e.write("opažanja u razdoblju:\n");
  const brojPoIzvoru = (niz: readonly Opazanje[]) => {
    const b: Record<string, number> = {};
    for (const o of niz) if (sati.has(o.sat)) b[o.izvor] = (b[o.izvor] ?? 0) + 1;
    return b;
  };
  for (const [k, n] of Object.entries(brojPoIzvoru(opazanja.h2s))) e.write(`  H2S ${k}: ${n}\n`);
  for (const [k, n] of Object.entries(brojPoIzvoru(opazanja.merkaptani))) e.write(`  merkaptani ${k}: ${n}\n`);
  const dojaveU = opazanja.dojave.filter((d) => sati.has(d.sat));
  e.write(`  dojave: ${dojaveU.length} satnih opažanja (${dojaveU.filter((d) => d.smrdi).length} smrdi), prijemnici: ${PRIJEMNICI.map((p) => p.ime).join(", ")}\n`);

  const azo = opazanja.h2s.filter((o) => o.izvor === "azo308");
  const zavod = opazanja.h2s.filter((o) => o.izvor === "zavod-k1");
  e.write("AZO 308 prema Zavodu k1 (pomak dodan AZO-u, u satima):\n");
  for (const u of usporediNizove(azo, zavod)) {
    e.write(`  pomak ${String(u.pomak).padStart(2)}: n=${u.n} identičnih=${u.identicnih} r=${u.korelacija?.toFixed(4) ?? "–"}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  glavni().catch((greska) => {
    process.stderr.write(`${String(greska)}\n`);
    process.exit(1);
  });
}
