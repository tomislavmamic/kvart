/**
 * Trenutačno stanje zraka nad kvartom, iz javnih izvora.
 *
 * Prikaz širenja na `/karepovac` više ne stoji na zapečenom slučaju vremena
 * nego na dvjema veličinama koje se ovdje dohvaćaju:
 *
 * 1. **vjetar** — izmjeren, s najbliže postaje koja ga u tom trenutku objavljuje.
 *    Redom: Neverinov Split-Vrboran (1,1 km, korak od pet minuta), pa AZO-ove
 *    postaje Split-3 (4,3 km) i Split-2 (4,6 km), DHMZ-ov Split-Marjan (6 km)
 *    i Split-aerodrom, pa METAR iste zračne luke (LDSP, 16 km). Nijedan izvor
 *    sam nije dovoljan: Marjanu vjetar u javnom izvještaju često stoji kao „−”
 *    iako ga postaja mjeri, AZO daje sirova satna očitanja, a METAR je jedini
 *    koji uvijek stigne i jedini na kojem je veza s plinom provjerena.
 *
 *    Neverinove postaje (Vrboran, Pujanke, Solin, Žrnovnica) idu preko
 *    naslijeđenog API-ja `api.neverin.hr/v2`, uz pisano dopuštenje vlasnika
 *    (29. 8. 2026.) i uz uvjet da se izvor navede — zato „Neverin.hr” stoji u
 *    imenu postaje i ide svugdje gdje se ime prikaže. Vidi
 *    `docs/neverin-postaje.md`.
 *
 *    Na samom Karepovcu anemometra nema: obje postaje uz plohu (Karepovac,
 *    Karepovac 2) u AZO-ovoj bazi vraćaju prazno za brzinu i smjer vjetra.
 *    Provjereno 19. 8. 2026.
 * 2. **dubina miješanog sloja** — modelska, jer se ne mjeri nigdje u blizini.
 *    Ona odlučuje hoće li se zrak s plohe razrijediti ili ostati pri tlu, pa
 *    je bez nje smjer sam za sebe slab pokazatelj.
 *
 * ## Zašto ovo ne zatrpava izvore
 *
 * Dohvat ne visi o posjetitelju nego o vremenu. Odgovori se drže u
 * predmemoriji podataka (`next.revalidate`), zajedničkoj za sve posjetitelje,
 * a same stranice još su i statički predgotovljene s istim rokom. Zato broj
 * poziva prema izvoru ovisi samo o roku, ne o prometu: METAR najviše
 * 96 puta na dan, dubina sloja najviše 24. Kad rok istekne, prvi posjetitelj
 * dobiva stari zapis, a osvježavanje ide u pozadini — nema navale ni čekanja.
 *
 * Ako izvor padne ili zakasni, stranica ne ostaje prazna: vraća se na
 * pretpostavljeni slučaj i to piše.
 */

import { POSTAJE_VJETRA } from "@/generated/karepovac-karta";
import type { StanjeZraka } from "@/lib/polje-dima";

/**
 * Postaje s kojih uzimamo vjetar, od najbliže prema najdaljoj.
 *
 * Udaljenosti su dugo stajale ovdje kao ručno upisane brojke (4,3 / 4,6 / 6 /
 * 16 / 16). Ispale su točne, ali nisu bile provjerljive: nigdje nije pisalo od
 * koje se točke mjere ni gdje postaje stoje. Sada se računaju iz koordinata u
 * `scripts/postaje_vjetra.py` — Split-2 i Split-3 nađeni su na terenu, Marjan
 * je iz DHMZ-ova popisa, a zračna luka iz istog METAR servisa iz kojega dolazi
 * i sam vjetar. Mjeri se od središta kvarta, jer sučelje kaže „N km od kvarta”;
 * generirani modul nosi i udaljenost od plohe, koja je oko kilometar veća.
 */
const MJESTA = Object.fromEntries(
  POSTAJE_VJETRA.map((p) => [p.oznaka, p]),
) as Record<string, (typeof POSTAJE_VJETRA)[number]>;

export const POSTAJE = {
  vrboran: {
    oznaka: "Split-Vrboran (Neverin.hr)",
    ime: "Neverin.hr, Split-Vrboran",
    udaljenostKm: MJESTA.vrboran.odKvartaKm,
  },
  pujanke: {
    oznaka: "Split-Pujanke (Neverin.hr)",
    ime: "Neverin.hr, Split-Pujanke",
    udaljenostKm: MJESTA.pujanke.odKvartaKm,
  },
  solin: {
    oznaka: "Solin (Neverin.hr)",
    ime: "Neverin.hr, Solin",
    udaljenostKm: MJESTA.solin.odKvartaKm,
  },
  split3: {
    oznaka: "Split-3",
    ime: "AZO, postaja Split-3",
    udaljenostKm: MJESTA.split3.odKvartaKm,
  },
  split2: {
    oznaka: "Split-2",
    ime: "AZO, postaja Split-2",
    udaljenostKm: MJESTA.split2.odKvartaKm,
  },
  marjan: {
    oznaka: "Split-Marjan",
    ime: "DHMZ, Split-Marjan",
    udaljenostKm: MJESTA.marjan.odKvartaKm,
  },
  aerodrom: {
    oznaka: "Split-aerodrom",
    ime: "DHMZ, Split-aerodrom",
    udaljenostKm: MJESTA.aerodrom.odKvartaKm,
  },
  zrnovnica: {
    oznaka: "Žrnovnica (Neverin.hr)",
    ime: "Neverin.hr, Žrnovnica",
    udaljenostKm: MJESTA.zrnovnica.odKvartaKm,
  },
  ldsp: {
    oznaka: "LDSP",
    ime: "METAR, Zračna luka Split",
    udaljenostKm: MJESTA.ldsp.odKvartaKm,
  },
} as const;

export type Postaja = keyof typeof POSTAJE;

/**
 * Redoslijed nije samo po udaljenosti nego po tome što je prošlo provjeru.
 *
 * Na 9 904 zajednička sata (2024.–2026.) svaki je izvor ocijenjen prema
 * izmjerenom H₂S-u na postaji uz plohu — vidi `scripts/provjeri-izvore-vjetra.py`.
 * Noću, kad se epizode i događaju, zračna luka nema nikakvu moć razlučivanja
 * (AUC 0,51), a gradske i marjanska postaja imaju (0,54–0,59). Zato je zračna
 * luka posljednja iako je jedina koja uvijek javi, a Marjan je iznad Splita-2
 * iako je dalje.
 *
 * Vrboran je iznimka od tog pravila i to treba reći otvoreno: kroz provjeru
 * nije prošao, jer arhive nema — naslijeđeni API daje samo zadnje očitanje.
 * Vodi zato što je četiri puta bliži od svega provjerenog (1,1 km od kvarta,
 * 1,4 km od plohe) i javlja svakih pet minuta, a provjera je mjerila koliko
 * satni niz objašnjava H₂S unatrag, ne tko bolje zna što puše sada. Ako se
 * pokaže lošim, prvi je kandidat za spuštanje — jedna crta u ovom popisu.
 * Pujanke i Solin stoje iza svega provjerenog, jer za njih ni taj argument
 * blizine nije tako jak; Žrnovnica je s nizom stalim 2. 2. 2025. ionako
 * mrtva i preskače je provjera starosti.
 */
const REDOSLIJED: readonly Postaja[] = [
  "vrboran",
  "split3",
  "marjan",
  "split2",
  "pujanke",
  "solin",
  "zrnovnica",
  "aerodrom",
  "ldsp",
];

/** Postaje koje DHMZ objavljuje u satnom izvještaju. */
const DHMZ_POSTAJE: readonly Postaja[] = ["marjan", "aerodrom"];

const DHMZ_URL = "https://vrijeme.hr/hrvatska_n.xml";

/** AZO-ove oznake postaja i veličina u bazi kvalitete zraka. */
const AZO = {
  split3: 305,
  split2: 304,
  brzina: 477,
  smjer: 478,
} as const;

/**
 * Neverinove oznake postaja u naslijeđenom API-ju.
 *
 * Dopuštenje vlasnika (29. 8. 2026.) vrijedi baš za ove četiri; novi je API u
 * izradi, pa adresa može prestati raditi bez najave — svaki dohvat zato mora
 * podnijeti i tišinu s ove strane.
 */
const NEVERIN = {
  vrboran: "split-vrboran",
  pujanke: "split-pujanke",
  solin: "solin",
  zrnovnica: "zrnovnica",
} as const;

type NeverinPostaja = keyof typeof NEVERIN;

function neverinAdresa(postaja: NeverinPostaja): string {
  return `https://api.neverin.hr/v2/stations/last/?station=${NEVERIN[postaja]}`;
}

const METAR_URL =
  "https://aviationweather.gov/api/data/metar?ids=LDSP&format=json&hours=3";

const MIJESANJE_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=43.522&longitude=16.499" +
  "&hourly=boundary_layer_height&forecast_days=1&past_days=1&timezone=UTC";

/** METAR se objavljuje na pola sata; kraći rok ne bi donio noviji podatak. */
const ROK_VJETRA = 900;

/**
 * Neverinove postaje javljaju svakih pet minuta, a upravo je Vrboran ono što
 * vodi kartu. S rokom od petnaest minuta stranica bi do deset minuta
 * pokazivala stariji vjetar nego neverin.hr za istu postaju — a tko usporedi,
 * vidi razliku i prestane vjerovati. Provjereno 2. 9. 2026.: uz ovaj rok
 * očitanje na kartici i Neverinov `last` su isti (148°, 0,7 m/s, 15:25).
 */
const ROK_NEVERINA = 300;

/** Dubina sloja dolazi iz modela sa satnim korakom. */
const ROK_MIJESANJA = 3600;

/** Stariji podatak od ovoga više ne opisuje sadašnjost. */
const NAJSTARIJE_MS = 3 * 3600 * 1000;

/** Poziv koji ne smije držati prikaz stranice. */
const ISTEK_MS = 4000;

// Bez dijakritike: zaglavlje HTTP-a nosi samo znakove do 255, pa bi „praćenje”
// srušilo poziv prije nego što ode.
const ZAGLAVLJA = {
  "user-agent": "kvart (Karepovac air watch; +https://kvart-sage.vercel.app)",
} as const;

/**
 * Slučaj na koji se vraćamo kad izvori šute: slab jugoistočnjak pod plitkim
 * slojem. To je slučaj o kojem ljudi javljaju, a ne prosjek godine.
 */
export const PRETPOSTAVLJENO: StanjeZraka = {
  smjerOd: 112.5,
  brzina: 1.2,
  dubina: 80,
};

export type Vjetar = {
  /** Postaja s koje očitanje dolazi. */
  readonly postaja: Postaja;
  /** Meteorološki smjer iz kojega puše, u stupnjevima. */
  readonly smjerOd: number;
  /** Brzina u m/s. */
  readonly brzina: number;
  /** Vjetra praktički nema; smjer tada ništa ne znači. */
  readonly tisina: boolean;
  /** METAR je javio promjenjiv smjer (VRB). */
  readonly promjenjiv: boolean;
  /** Najjači nalet u m/s; javljaju ga samo Neverin i METAR. */
  readonly naleti?: number;
  /** Vrijeme opažanja, ISO 8601. */
  readonly opazeno: string;
};

export type Mijesanje = {
  /** Debljina sloja u kojem se zrak miješa, u metrima. */
  readonly dubina: number;
  /** Vrijeme na koje se odnosi, ISO 8601. */
  readonly vrijeme: string;
};

export type StanjeIzvora = "uzivo" | "djelomicno" | "pretpostavka";

export type ZrakSada = {
  /** Ono što ide u model. */
  readonly stanje: StanjeZraka;
  /** Očitanje koje vodi kartu; najbliža postaja koja je javila vjetar. */
  readonly vjetar: Vjetar | null;
  /** Sva očitanja, uključujući ono koje vodi kartu. */
  readonly ocitanja: readonly Vjetar[];
  readonly mijesanje: Mijesanje | null;
  readonly izvor: StanjeIzvora;
};

const CVOROVI_U_MS = 0.514444;

function broj(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Čita najnovije opažanje iz METAR odgovora.
 *
 * Args:
 *   odgovor: Razložen JSON s `aviationweather.gov`.
 *   sada: Trenutak prema kojem se prosuđuje starost.
 *
 * Returns:
 *   Vjetar, ili ništa ako opažanja nema, ako je prestaro ili ako mu
 *   nedostaje brzina.
 */
export function procitajVjetar(odgovor: unknown, sada: Date): Vjetar | null {
  if (!Array.isArray(odgovor)) return null;
  let najnovije: Record<string, unknown> | null = null;
  let vrijeme = 0;
  for (const zapis of odgovor) {
    if (typeof zapis !== "object" || zapis === null) continue;
    const t = broj((zapis as Record<string, unknown>).obsTime);
    if (t !== null && t > vrijeme) {
      vrijeme = t;
      najnovije = zapis as Record<string, unknown>;
    }
  }
  if (!najnovije) return null;

  const opazeno = new Date(vrijeme * 1000);
  if (sada.getTime() - opazeno.getTime() > NAJSTARIJE_MS) return null;

  const cvorovi = broj(najnovije.wspd);
  if (cvorovi === null || cvorovi < 0) return null;
  const brzina = cvorovi * CVOROVI_U_MS;

  const sirovSmjer = najnovije.wdir;
  const promjenjiv = sirovSmjer === "VRB" || broj(sirovSmjer) === null;
  const smjer = broj(sirovSmjer);
  const nalet = broj(najnovije.wgst);

  return {
    postaja: "ldsp",
    // Kod tišine i kod promjenjivog vjetra smjer ostaje zapisan samo da polje
    // ima os; prikaz ga u tim slučajevima ne tvrdi.
    smjerOd: smjer === null ? PRETPOSTAVLJENO.smjerOd : smjer % 360,
    brzina: Number(brzina.toFixed(2)),
    tisina: brzina < 0.5,
    promjenjiv,
    ...(nalet !== null && nalet > 0
      ? { naleti: Number((nalet * CVOROVI_U_MS).toFixed(2)) }
      : {}),
    opazeno: opazeno.toISOString(),
  };
}

/**
 * Pretvara Neverinov mjesni zapis vremena u trenutak.
 *
 * API piše „2026-08-29 15:10:00” u zoni Europe/Zagreb, bez oznake pomaka.
 * Umjesto računanja ljetnog vremena isprobaju se oba pomaka koja ta zona
 * ima, pa se zadrži onaj koji se, formatiran natrag u istu zonu, poklopi sa
 * zapisom — isti pristup kao `trenutakIzTermina` za DHMZ, samo s minutama.
 *
 * Args:
 *   zapis: Vrijeme kako ga API piše, „GGGG-MM-DD HH:MM:SS”.
 *
 * Returns:
 *   Trenutak, ili ništa ako zapis nije vrijeme.
 */
export function trenutakNeverina(zapis: string): Date | null {
  const pogodak = zapis.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/);
  if (!pogodak) return null;
  const kalendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (const pomak of ["+02:00", "+01:00"]) {
    const kad = new Date(`${pogodak[1]}T${pogodak[2]}:00${pomak}`);
    if (Number.isNaN(kad.getTime())) continue;
    const dijelovi = kalendar.formatToParts(kad);
    const dio = (tip: string) => dijelovi.find((d) => d.type === tip)?.value ?? "";
    const natrag = `${dio("year")}-${dio("month")}-${dio("day")} ${dio("hour")}:${dio("minute")}`;
    if (natrag === `${pogodak[1]} ${pogodak[2]}`) return kad;
  }
  return null;
}

/**
 * Čita zadnje očitanje s Neverinove postaje.
 *
 * Brzina je `wavg` — prosjek, ne `wgust`: model uzima vjetar koji nosi, a ne
 * najjači nalet. Postaja koja je prestala javljati (Žrnovnica stoji od
 * 2. 2. 2025.) otpada na istoj provjeri starosti kao i svi ostali izvori.
 *
 * Args:
 *   postaja: Koja je postaja u pitanju.
 *   odgovor: Razložen JSON s `api.neverin.hr`.
 *   sada: Trenutak prema kojem se prosuđuje starost.
 *
 * Returns:
 *   Vjetar, ili ništa ako očitanja nema, ako je prestaro ili bez brzine.
 */
export function procitajNeverin(
  postaja: NeverinPostaja,
  odgovor: unknown,
  sada: Date,
): Vjetar | null {
  if (typeof odgovor !== "object" || odgovor === null) return null;
  const data = (odgovor as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null) return null;
  const zadnje = (data as Record<string, unknown>).last;
  if (typeof zadnje !== "object" || zadnje === null) return null;
  const z = zadnje as Record<string, unknown>;

  const opazeno = typeof z.datetime === "string" ? trenutakNeverina(z.datetime) : null;
  if (!opazeno || sada.getTime() - opazeno.getTime() > NAJSTARIJE_MS) return null;

  const brzina = broj(z.wavg) ?? broj(z.wspeed);
  if (brzina === null || brzina < 0) return null;

  const smjer = broj(z.wdir);
  const nalet = broj(z.wgust);
  return {
    postaja,
    smjerOd: smjer === null ? PRETPOSTAVLJENO.smjerOd : ((smjer % 360) + 360) % 360,
    brzina: Number(brzina.toFixed(2)),
    tisina: brzina < 0.5,
    promjenjiv: smjer === null,
    ...(nalet !== null && nalet >= 0 ? { naleti: Number(nalet.toFixed(2)) } : {}),
    opazeno: opazeno.toISOString(),
  };
}

/**
 * Bira sat koji je najbliži sadašnjosti iz Open-Meteova niza.
 *
 * Args:
 *   odgovor: Razložen JSON s `api.open-meteo.com`, u UTC-u.
 *   sada: Trenutak za koji se traži dubina sloja.
 *
 * Returns:
 *   Dubina miješanog sloja, ili ništa ako niza nema.
 */
export function procitajMijesanje(odgovor: unknown, sada: Date): Mijesanje | null {
  if (typeof odgovor !== "object" || odgovor === null) return null;
  const satno = (odgovor as Record<string, unknown>).hourly;
  if (typeof satno !== "object" || satno === null) return null;
  const vremena = (satno as Record<string, unknown>).time;
  const dubine = (satno as Record<string, unknown>).boundary_layer_height;
  if (!Array.isArray(vremena) || !Array.isArray(dubine)) return null;

  let najbolji = -1;
  let razmak = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vremena.length; i += 1) {
    const t = typeof vremena[i] === "string" ? vremena[i] : null;
    if (t === null || broj(dubine[i]) === null) continue;
    // Open-Meteo vraća "2026-08-19T14:00" bez oznake zone, uz timezone=UTC.
    const ms = Date.parse(`${t}Z`);
    if (Number.isNaN(ms)) continue;
    const d = Math.abs(ms - sada.getTime());
    if (d < razmak) {
      razmak = d;
      najbolji = i;
    }
  }
  if (najbolji < 0 || razmak > NAJSTARIJE_MS) return null;

  const dubina = broj(dubine[najbolji]) ?? 0;
  return {
    // Model spušta sloj i na 15 m; ispod stotinjak metara razlika za širenje
    // nad ovim reljefom više nije razlučiva, pa se ne pretvaramo da jest.
    dubina: Math.max(25, Math.round(dubina)),
    vrijeme: `${vremena[najbolji]}Z`,
  };
}

/** Osmerokut smjerova kakav DHMZ objavljuje; „C” je tišina, „-” nedostaje. */
const SMJEROVI: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function polje(blok: string, ime: string): string | null {
  const pogodak = blok.match(new RegExp(`<${ime}>([^<]*)</${ime}>`));
  return pogodak ? pogodak[1].trim() : null;
}

/**
 * Nalazi trenutak koji u Splitu pokazuje zadani datum i sat.
 *
 * DHMZ piše mjesno vrijeme bez oznake zone, a razlika prema UTC-u ovisi o
 * dobu godine. Umjesto računanja ljetnog vremena traži se sat unatrag koji
 * mjesno ispadne baš tako — po istom kalendaru koji ionako crta stranicu.
 *
 * Args:
 *   datum: Zapis „19.08.2026”.
 *   termin: Sat u mjesnom vremenu, 0–23.
 *   sada: Trenutak od kojeg se traži unatrag.
 *
 * Returns:
 *   Trenutak, ili ništa ako ga nema u zadnja dva dana.
 */
export function trenutakIzTermina(
  datum: string,
  termin: number,
  sada: Date,
): Date | null {
  const [dan, mjesec, godina] = datum.split(".").map((d) => Number(d.trim()));
  if (!dan || !mjesec || !godina) return null;
  const kalendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const trazeno = `${godina}-${String(mjesec).padStart(2, "0")}-${String(dan).padStart(2, "0")}`;
  const vrh = Math.floor(sada.getTime() / 3600000) * 3600000;
  for (let h = 0; h < 48; h += 1) {
    const kad = new Date(vrh - h * 3600000);
    const dijelovi = kalendar.formatToParts(kad);
    const uzmiDio = (tip: string) =>
      dijelovi.find((d) => d.type === tip)?.value ?? "";
    const dan2 = `${uzmiDio("year")}-${uzmiDio("month")}-${uzmiDio("day")}`;
    if (dan2 === trazeno && Number(uzmiDio("hour")) === termin) return kad;
  }
  return null;
}

/**
 * Čita vjetar s najbliže DHMZ-ove postaje koja ga objavljuje.
 *
 * Args:
 *   xml: Sadržaj `hrvatska_n.xml`.
 *   sada: Trenutak prema kojem se prosuđuje starost.
 *
 * Returns:
 *   Vjetar, ili ništa ako nijedna od naših postaja nema brzinu.
 */
export function procitajDhmz(xml: unknown, sada: Date): Vjetar | null {
  if (typeof xml !== "string") return null;
  const datum = polje(xml, "Datum");
  const termin = polje(xml, "Termin");
  if (!datum || termin === null) return null;
  const kada = trenutakIzTermina(datum, Number(termin), sada);
  if (!kada || sada.getTime() - kada.getTime() > NAJSTARIJE_MS) return null;

  const blokovi = xml.match(/<Grad\b[\s\S]*?<\/Grad>/g) ?? [];
  for (const postaja of DHMZ_POSTAJE) {
    const trazeno = POSTAJE[postaja].oznaka;
    const blok = blokovi.find((b) => polje(b, "GradIme") === trazeno);
    if (!blok) continue;

    const sirovaBrzina = polje(blok, "VjetarBrzina");
    const sirovSmjer = polje(blok, "VjetarSmjer");
    // Postaja koja ne javi brzinu preskače se; „−” ovdje znači da podatka
    // nema, a ne da nema vjetra.
    if (!sirovaBrzina || !/^[\d.]+$/.test(sirovaBrzina)) continue;
    const brzina = Number(sirovaBrzina);
    if (!Number.isFinite(brzina)) continue;

    const smjer = sirovSmjer === null ? null : SMJEROVI[sirovSmjer];
    return {
      postaja,
      smjerOd: smjer ?? PRETPOSTAVLJENO.smjerOd,
      brzina: Number(brzina.toFixed(2)),
      tisina: brzina < 0.5,
      promjenjiv: smjer === undefined || smjer === null,
      opazeno: kada.toISOString(),
    };
  }
  return null;
}

/** Datum u obliku koji AZO-ova baza traži. */
function azoDatum(kad: Date): string {
  const d = new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(kad);
  return d.replace(/\s/g, "").replace(/\.$/, "");
}

/** Adresa satnog niza jedne veličine s jedne AZO-ove postaje. */
export function azoAdresa(postaja: Postaja, velicina: number, sada: Date): string {
  const jucer = new Date(sada.getTime() - 24 * 3600 * 1000);
  const id = postaja === "split3" ? AZO.split3 : AZO.split2;
  return (
    "https://iszz.azo.hr/iskzl/rs/podatak/export/json" +
    `?postaja=${id}&polutant=${velicina}&tipPodatka=0` +
    `&vrijemeOd=${azoDatum(jucer)}&vrijemeDo=${azoDatum(sada)}`
  );
}

type AzoZapis = { vrijednost: number; vrijeme: number };

function azoNiz(odgovor: unknown): AzoZapis[] {
  if (!Array.isArray(odgovor)) return [];
  const niz: AzoZapis[] = [];
  for (const zapis of odgovor) {
    if (typeof zapis !== "object" || zapis === null) continue;
    const v = broj((zapis as Record<string, unknown>).vrijednost);
    const t = broj((zapis as Record<string, unknown>).vrijeme);
    if (v !== null && t !== null) niz.push({ vrijednost: v, vrijeme: t });
  }
  return niz.sort((a, b) => a.vrijeme - b.vrijeme);
}

/**
 * Slaže očitanje s AZO-ove postaje iz dvaju satnih nizova.
 *
 * Brzina i smjer stižu kao dva odvojena niza, pa se spajaju po satu — bez toga
 * bi se pri kvaru jednog analizatora smjer iz jednog sata spojio s brzinom iz
 * drugog.
 *
 * Args:
 *   postaja: Koja je postaja u pitanju.
 *   brzine: Odgovor za brzinu vjetra.
 *   smjerovi: Odgovor za smjer vjetra.
 *   sada: Trenutak prema kojem se prosuđuje starost.
 *
 * Returns:
 *   Očitanje, ili ništa ako zadnji sat nema oba podatka.
 */
export function procitajAzo(
  postaja: Postaja,
  brzine: unknown,
  smjerovi: unknown,
  sada: Date,
): Vjetar | null {
  const nizBrzina = azoNiz(brzine);
  const poSatu = new Map(azoNiz(smjerovi).map((z) => [z.vrijeme, z.vrijednost]));
  const zadnji = nizBrzina[nizBrzina.length - 1];
  if (!zadnji) return null;
  if (sada.getTime() - zadnji.vrijeme > NAJSTARIJE_MS) return null;

  const smjer = poSatu.get(zadnji.vrijeme);
  const brzina = zadnji.vrijednost;
  if (brzina < 0) return null;

  return {
    postaja,
    smjerOd:
      smjer === undefined
        ? PRETPOSTAVLJENO.smjerOd
        : Number(((((smjer % 360) + 360) % 360)).toFixed(1)),
    brzina: Number(brzina.toFixed(2)),
    tisina: brzina < 0.5,
    promjenjiv: smjer === undefined,
    opazeno: new Date(zadnji.vrijeme).toISOString(),
  };
}

async function uzmi(
  url: string,
  rok: number,
  oblik: "json" | "tekst" = "json",
): Promise<unknown | null> {
  try {
    const odgovor = await fetch(url, {
      headers: ZAGLAVLJA,
      signal: AbortSignal.timeout(ISTEK_MS),
      next: { revalidate: rok },
    });
    if (!odgovor.ok) return null;
    return oblik === "json" ? await odgovor.json() : await odgovor.text();
  } catch {
    // Izvor koji ne odgovori ne smije srušiti stranicu; prikaz se vraća na
    // pretpostavljeni slučaj i to piše.
    return null;
  }
}

/**
 * Dohvaća trenutačno stanje zraka nad kvartom.
 *
 * Args:
 *   sada: Trenutak za koji se traži stanje; zadano je sadašnji.
 *
 * Returns:
 *   Stanje za model, izvorna očitanja i oznaka koliko je od toga živo.
 */
export async function dohvatiZrak(sada: Date = new Date()): Promise<ZrakSada> {
  const neverinske = Object.keys(NEVERIN) as NeverinPostaja[];
  const [b3, s3, b2, s2, dhmz, metar, meteo, ...neverin] = await Promise.all([
    uzmi(azoAdresa("split3", AZO.brzina, sada), ROK_VJETRA),
    uzmi(azoAdresa("split3", AZO.smjer, sada), ROK_VJETRA),
    uzmi(azoAdresa("split2", AZO.brzina, sada), ROK_VJETRA),
    uzmi(azoAdresa("split2", AZO.smjer, sada), ROK_VJETRA),
    uzmi(DHMZ_URL, ROK_VJETRA, "tekst"),
    uzmi(METAR_URL, ROK_VJETRA),
    uzmi(MIJESANJE_URL, ROK_MIJESANJA),
    ...neverinske.map((p) => uzmi(neverinAdresa(p), ROK_NEVERINA)),
  ]);

  // Sve se čita, pa i ono što neće voditi kartu: tek kad se postaje usporede
  // vidi se koliko je vjetar nad gradom uopće jednoznačan.
  const ocitanja = [
    ...neverinske.map((p, i) => procitajNeverin(p, neverin[i], sada)),
    procitajAzo("split3", b3, s3, sada),
    procitajAzo("split2", b2, s2, sada),
    procitajDhmz(dhmz, sada),
    procitajVjetar(metar, sada),
  ].filter((o): o is Vjetar => o !== null);

  const vjetar =
    REDOSLIJED.map((p) => ocitanja.find((o) => o.postaja === p)).find(Boolean) ?? null;
  const mijesanje = procitajMijesanje(meteo, sada);

  const izvor: StanjeIzvora =
    vjetar && mijesanje ? "uzivo" : vjetar || mijesanje ? "djelomicno" : "pretpostavka";

  return {
    stanje: {
      smjerOd: vjetar?.smjerOd ?? PRETPOSTAVLJENO.smjerOd,
      brzina: vjetar?.brzina ?? PRETPOSTAVLJENO.brzina,
      dubina: mijesanje?.dubina ?? PRETPOSTAVLJENO.dubina,
    },
    vjetar,
    ocitanja,
    mijesanje,
    izvor,
  };
}
