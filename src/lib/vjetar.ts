/**
 * Trenutačno stanje zraka nad kvartom, iz javnih izvora.
 *
 * Prikaz širenja na `/karepovac` više ne stoji na zapečenom slučaju vremena
 * nego na dvjema veličinama koje se ovdje dohvaćaju:
 *
 * 1. **vjetar** — izmjeren, s najbliže postaje koja ga u tom trenutku objavljuje.
 *    Redom: AZO-ove postaje Split-3 (4,3 km) i Split-2 (4,6 km), pa DHMZ-ov
 *    Split-Marjan (6 km) i Split-aerodrom, pa METAR iste zračne luke (LDSP,
 *    16 km). Nijedan izvor sam nije dovoljan: Marjanu vjetar u javnom
 *    izvještaju često stoji kao „−” iako ga postaja mjeri, AZO daje sirova
 *    satna očitanja, a METAR je jedini koji uvijek stigne i jedini na kojem je
 *    veza s plinom provjerena.
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

import type { StanjeZraka } from "@/lib/polje-dima";

/**
 * Postaje s kojih uzimamo vjetar, od najbliže prema najdaljoj.
 *
 * Koordinate su ondje gdje ih izvor sam objavljuje: DHMZ ih piše uz svaku
 * postaju u satnom izvještaju (`<Lat>`, `<Lon>`), a METAR ih vraća uz
 * očitanje. AZO ih ne objavljuje ni na jednom otvorenom putu — provjereno
 * 22. 8. 2026. — pa za Split-3 ovdje i dalje stoji `null`. Karta tu postaju
 * ne zabada nego je navodi bez mjesta; izmišljena bi točka bila gora od
 * nijedne, jer na karti izgleda jednako pouzdano kao izmjerena.
 *
 * `udaljenostKm` se mjeri **od kvarta**, ne od plohe. To se dade provjeriti na
 * postajama kojima mjesto znamo: Marjan ispadne 6,2 km (zapisano 6), zračna
 * luka 16,1 km (zapisano 16). Po istoj mjeri je i Split-2 na 4,64 km, što se
 * poklapa sa zapisanih 4,6 — tako je i prepoznat kad je koordinata stigla bez
 * imena.
 */
export const POSTAJE = {
  split3: {
    oznaka: "Split-3",
    ime: "AZO, postaja Split-3",
    udaljenostKm: 4.3,
    lat: null,
    lon: null,
  },
  split2: {
    oznaka: "Split-2",
    ime: "AZO, postaja Split-2",
    udaljenostKm: 4.6,
    lat: 43.5184712,
    lon: 16.4424683,
  },
  marjan: {
    oznaka: "Split-Marjan",
    ime: "DHMZ, Split-Marjan",
    udaljenostKm: 6,
    lat: 43.508,
    lon: 16.426,
  },
  aerodrom: {
    oznaka: "Split-aerodrom",
    ime: "DHMZ, Split-aerodrom",
    udaljenostKm: 16,
    lat: 43.539,
    lon: 16.301,
  },
  // METAR mjeri na istoj zračnoj luci kao i DHMZ-ova postaja, pa im se točke
  // poklapaju; karta ih zato prikazuje kao jedno mjesto s dva izvora.
  ldsp: {
    oznaka: "LDSP",
    ime: "METAR, Zračna luka Split",
    udaljenostKm: 16,
    lat: 43.539,
    lon: 16.301,
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
 */
const REDOSLIJED: readonly Postaja[] = [
  "split3",
  "marjan",
  "split2",
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

const METAR_URL =
  "https://aviationweather.gov/api/data/metar?ids=LDSP&format=json&hours=3";

const MIJESANJE_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=43.522&longitude=16.499" +
  "&hourly=boundary_layer_height&forecast_days=1&past_days=1&timezone=UTC";

/** METAR se objavljuje na pola sata; kraći rok ne bi donio noviji podatak. */
const ROK_VJETRA = 900;

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

  return {
    postaja: "ldsp",
    // Kod tišine i kod promjenjivog vjetra smjer ostaje zapisan samo da polje
    // ima os; prikaz ga u tim slučajevima ne tvrdi.
    smjerOd: smjer === null ? PRETPOSTAVLJENO.smjerOd : smjer % 360,
    brzina: Number(brzina.toFixed(2)),
    tisina: brzina < 0.5,
    promjenjiv,
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
    hour12: false,
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
  const [b3, s3, b2, s2, dhmz, metar, meteo] = await Promise.all([
    uzmi(azoAdresa("split3", AZO.brzina, sada), ROK_VJETRA),
    uzmi(azoAdresa("split3", AZO.smjer, sada), ROK_VJETRA),
    uzmi(azoAdresa("split2", AZO.brzina, sada), ROK_VJETRA),
    uzmi(azoAdresa("split2", AZO.smjer, sada), ROK_VJETRA),
    uzmi(DHMZ_URL, ROK_VJETRA, "tekst"),
    uzmi(METAR_URL, ROK_VJETRA),
    uzmi(MIJESANJE_URL, ROK_MIJESANJA),
  ]);

  // Sve se čita, pa i ono što neće voditi kartu: tek kad se postaje usporede
  // vidi se koliko je vjetar nad gradom uopće jednoznačan.
  const ocitanja = [
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
