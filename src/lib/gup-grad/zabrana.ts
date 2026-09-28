/**
 * /gup/zabrana: gdje bi prijedlog GUP-a 2025. zabranio novu gradnju dok se
 * ne donese UPU (čl. 103. st. 1 i čl. 105. st. 5 prijedloga).
 *
 * Čiste funkcije za kartu i tražilicu adrese: u kojem je režimu točka
 * (zabrana, plan na snazi, samo obuhvat propisanog UPU-a, GUP, izvan GUP-a)
 * i traženje kućnog broja. Podatke piše scripts/gup-grad/zabrana.py
 * (public/geo/gup-grad/zabrana-2025.geojson, kucni-brojevi.json); obuhvate
 * planova planski-obrisi.py (planski-rezim-2025.geojson), a sporne čestice i
 * plohe urbane sanacije scripts/gup-grad/sporne.py (sporne-2025.geojson).
 */

import type { FeatureCollection } from "geojson";

export type Podrucje = "sanacija" | "preobrazba" | "neuredeno";
const PODRUCJA: readonly string[] = ["sanacija", "preobrazba", "neuredeno"];

/**
 * Boje karte i legende. Tri oznake koje zaustavljaju gradnju nose boje lista
 * 4.d GUP-a (sanacija zelena, preobrazba narančasta, neuređeno žuto), nešto
 * zasićenije da se vide na sivoj snimci. Sve sporno je ljubičasto, a rubovi
 * su samo granice: plan na snazi, obuhvat UPU-a i (jedini iscrtkan) GUP.
 */
export const BOJE_ZABRANE = {
  /** list 4.d sanaciju crta zeleno, ali i ona priječi novu gradnju, pa je ovdje crvena */
  sanacija: "#ef4444",
  preobrazba: "#fb923c",
  neuredeno: "#fde047",
  vazeci: "#71717a",
  upu: "#2563eb",
  gup: "#18181b",
  cestica: "#3f3f46",
  sporno: "#c026d3",
  /** cesta: jednaki obrub cijelom duljinom, a sredina kaže širinu njezine čestice */
  cesta: "#18181b",
  cestaSiroka: "#ffffff",
  cestaUska: "#991b1b",
  cestaNepoznata: "#a1a1aa",
} as const;

/** Koji plan je odredio oznaku na listu 4.d. */
export const IZVOR_OZNAKE: Record<Podrucje, string> = {
  sanacija: "oznaka GUP-a",
  preobrazba: "oznaka GUP-a",
  neuredeno: "oznaka PPUG-a, GUP je preuzima",
};

/** [prsten][točka][lng, lat]; prvi prsten je vanjski, ostali rupe. */
export type Poligon = number[][][];
export type Geometrija = { type: "Polygon"; coordinates: Poligon } | { type: "MultiPolygon"; coordinates: Poligon[] };
/** [zapad, jug, istok, sjever] */
export type Okvir = [number, number, number, number];

export interface Oblik {
  geometrija: Geometrija;
  okvir: Okvir;
}

/** Kako se područje zove u rečenici „Ovo je …”. */
export const NAZIV_PODRUCJA: Record<Podrucje, string> = {
  sanacija: "područje urbane sanacije",
  preobrazba: "područje urbane preobrazbe",
  neuredeno: "neuređeni dio građevinskog područja",
};

/**
 * Oblik imenice uz broj: [jednina, dvojina (2–4), množina] — 1 zgrada,
 * 23 zgrade, 486 zgrada; 11–14 uvijek traže množinu (12 zgrada).
 */
export function imenicaUz(n: number, [jednina, dvojina, mnozina]: [string, string, string]): string {
  const d = Math.abs(n) % 10, s = Math.abs(n) % 100;
  if (s >= 11 && s <= 14) return mnozina;
  if (d === 1) return jednina;
  if (d >= 2 && d <= 4) return dvojina;
  return mnozina;
}

const poligoniOd = (g: Geometrija): Poligon[] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

export function okvirOd(g: Geometrija): Okvir {
  let z = Infinity, j = Infinity, i = -Infinity, s = -Infinity;
  for (const p of poligoniOd(g))
    for (const [x, y] of p[0]) {
      if (x < z) z = x;
      if (x > i) i = x;
      if (y < j) j = y;
      if (y > s) s = y;
    }
  return [z, j, i, s];
}

export const oblik = (geometrija: Geometrija): Oblik => ({ geometrija, okvir: okvirOd(geometrija) });

export function spojiOkvire(okviri: Okvir[]): Okvir | null {
  if (!okviri.length) return null;
  return okviri.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
}

const uOkviru = (o: Okvir, lng: number, lat: number, rub = 0) =>
  lng >= o[0] - rub && lng <= o[2] + rub && lat >= o[1] - rub && lat <= o[3] + rub;

/** Je li točka u obliku (parno-neparno po prstenovima svakog poligona). */
export function uObliku(o: Oblik, lng: number, lat: number): boolean {
  if (!uOkviru(o.okvir, lng, lat)) return false;
  for (const p of poligoniOd(o.geometrija)) {
    let unutra = false;
    for (const prsten of p)
      for (let a = 0, b = prsten.length - 1; a < prsten.length; b = a++) {
        const [xa, ya] = prsten[a];
        const [xb, yb] = prsten[b];
        if (ya > lat !== yb > lat && lng < ((xb - xa) * (lat - ya)) / (yb - ya) + xa) unutra = !unutra;
      }
    if (unutra) return true;
  }
  return false;
}

/** Udaljenost od točke do najbližeg ruba oblika, u metrima (ravna aproksimacija, dovoljna za grad). */
export function doRuba(o: Oblik, lng: number, lat: number): number {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  let najbliza = Infinity;
  for (const p of poligoniOd(o.geometrija))
    for (const prsten of p)
      for (let a = 1; a < prsten.length; a++) {
        const ax = (prsten[a - 1][0] - lng) * kx, ay = (prsten[a - 1][1] - lat) * ky;
        const bx = (prsten[a][0] - lng) * kx, by = (prsten[a][1] - lat) * ky;
        const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
        const t = d2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / d2)) : 0;
        const ex = ax + t * dx, ey = ay + t * dy;
        najbliza = Math.min(najbliza, Math.hypot(ex, ey));
      }
  return najbliza;
}

export interface Komad extends Oblik {
  podrucje: Podrucje;
  /** Broj propisanog UPU-a s lista 4.d; 0 = ni u jednom ucrtanom obuhvatu. */
  upu: number;
}

export interface PlanNaSnazi extends Oblik {
  naziv: string;
  glasnik?: string;
}

export interface PropisaniUpu extends Oblik {
  broj: number;
  naziv: string;
}

/** Čestica sa slobodnim zemljištem za novu zgradu koje bi čekalo UPU (zabrana-cestice-2025.geojson). */
export interface CesticaZabrane extends Oblik {
  kc: string;
  ko: string;
  /** slobodno zemljište za novu zgradu, m² */
  m2: number;
  neizgradjena: boolean;
}

/** Zašto je oznaka čestice sporna (scripts/gup-grad/sporne.py). */
export type RazlogSpora = "pristup" | "cesta" | "izgradjena" | "sanacija" | "ppug";

/** Čestica pod zabranom kojoj oznaka ne odgovara kriteriju Grada ili zakona. */
export interface SpornaCestica extends Oblik {
  kc: string;
  ko: string;
  m2: number;
  podrucje: "neuredeno" | "sanacija";
  razlozi: RazlogSpora[];
  /** širina čestice ceste uz koju je, m (razlog „pristup”) */
  sirina?: number;
  /** kanalizacija na manje od 15 m */
  kanal?: boolean;
  /** udio zgrada s rješenjem o izvedenom stanju u plohi, % (razlog „sanacija”) */
  udio?: number;
  /** razred čestice na listu građevinskih područja PPUG-a: neuređeno, izgrađeno, neizgrađeno */
  ppug?: "U" | "I" | "N";
}

/** List građevinskih područja PPUG-a (1:5000) i kako se na nj preslika točka. */
export interface ListPpug {
  id: string;
  /** „4.4” */
  broj: string;
  /** (lng, lat) → udio lista: x = a·lng + b·lat + c, y = d·lng + e·lat + f */
  udio: [number, number, number, number, number, number];
  /** desno od ovoga je legenda */
  kartaDo: number;
}

/** Pločica čestica (public/geo/gup-grad/cestice-indeks.json): id i okvir [[jug, zapad], [sjever, istok]]. */
export interface PlocicaCestica {
  id: string;
  granice: [[number, number], [number, number]];
}

/** Pločice čiji okvir sadrži točku (čestica na rubu pločice može biti u susjednoj). */
export function plociceZaTocku(plocice: PlocicaCestica[], lng: number, lat: number): string[] {
  return plocice
    .filter(({ granice: [[j, z], [s, i]] }) => lat >= j && lat <= s && lng >= z && lng <= i)
    .map((p) => p.id);
}

/** Katastarska čestica u kojoj je točka; null ako je nema u učitanim pločicama. */
export function cesticaUTocki(plocice: FeatureCollection[], lng: number, lat: number): { kc: string; ko: string } | null {
  for (const fc of plocice) {
    for (const f of fc.features) {
      const p = (f.properties ?? {}) as { kc?: string; ko?: string };
      if (!p.kc || !f.geometry || (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")) continue;
      const o = oblik(f.geometry as Geometrija);
      if (uOkviru(o.okvir, lng, lat, 0) && uObliku(o, lng, lat)) return { kc: p.kc, ko: p.ko ?? "" };
    }
  }
  return null;
}

/** Mjesto na listu PPUG-a za točku; null ako nije ni na jednom listu. */
export function mjestoNaPpugu(listovi: ListPpug[], lng: number, lat: number): { list: ListPpug; tocka: [number, number] } | null {
  for (const l of listovi) {
    const [a, b, c, d, e, f] = l.udio;
    const x = a * lng + b * lat + c;
    const y = d * lng + e * lat + f;
    if (x > 0 && x < l.kartaDo && y > 0 && y < 1) return { list: l, tocka: [x, y] };
  }
  return null;
}

/** Ploha urbane sanacije s barem 10 zgrada i udjelom ozakonjenih. */
export interface PlohaSanacije extends Oblik {
  ha: number;
  zgrade: number;
  sRjesenjem: number;
  udio: number;
  /** ozakonjene zgrade nisu većina */
  manjina: boolean;
}

export interface Slojevi {
  komadi: Komad[];
  cestice: CesticaZabrane[];
  sporne: SpornaCestica[];
  plohe: PlohaSanacije[];
  ppug: ListPpug[];
  /** razred čestice pod zabranom po PPUG-u, po „k.o.|k.č.” */
  ppugCestice: Record<string, "U" | "I" | "N">;
  /** Cijelo područje zabrane kao jedan oblik — za udaljenost do ruba. */
  obris: Oblik | null;
  vazeci: PlanNaSnazi[];
  propisani: PropisaniUpu[];
  gup: Oblik | null;
}

export type Stanje =
  | {
      rezim: "zabrana";
      podrucje: Podrucje;
      upu: PropisaniUpu | null;
      cestica: CesticaZabrane | null;
      sporna: SpornaCestica | null;
      ploha: PlohaSanacije | null;
      doRuba: number;
    }
  | { rezim: "vazeci"; plan: PlanNaSnazi; doRuba: number }
  | { rezim: "preporuka"; upu: PropisaniUpu; doRuba: number }
  | { rezim: "gup"; doRuba: number }
  | { rezim: "izvan" };

/**
 * Slojevi iz zabrana-2025.geojson (komadi, obris, gup),
 * planski-rezim-2025.geojson (vazeci, propisan) i sporne-2025.geojson.
 */
export function slojeviIzGeojsona(
  zabrana: FeatureCollection,
  planovi: FeatureCollection,
  cestice?: FeatureCollection,
  sporne?: FeatureCollection,
): Slojevi {
  const svojstva = (f: FeatureCollection["features"][number]) => (f.properties ?? {}) as Record<string, unknown>;
  const geo = (f: FeatureCollection["features"][number]) => f.geometry as Geometrija;
  const jedan = (vrsta: string) => {
    const f = zabrana.features.find((x) => svojstva(x).vrsta === vrsta);
    return f ? oblik(geo(f)) : null;
  };
  return {
    komadi: zabrana.features
      .filter((f) => PODRUCJA.includes(svojstva(f).vrsta as string))
      .map((f) => ({ ...oblik(geo(f)), podrucje: svojstva(f).vrsta as Podrucje, upu: Number(svojstva(f).upu) })),
    cestice: (cestice?.features ?? []).map((f) => ({
      ...oblik(geo(f)),
      kc: String(svojstva(f).kc),
      ko: String(svojstva(f).ko),
      m2: Number(svojstva(f).m2),
      neizgradjena: Boolean(svojstva(f).neizgradjena),
    })),
    sporne: (sporne?.features ?? [])
      .filter((f) => svojstva(f).vrsta === "cestica")
      .map((f) => {
        const p = svojstva(f);
        return {
          ...oblik(geo(f)),
          kc: String(p.kc),
          ko: String(p.ko),
          m2: Number(p.m2),
          podrucje: p.podrucje as SpornaCestica["podrucje"],
          razlozi: (p.razlozi ?? []) as RazlogSpora[],
          sirina: p.sirina === undefined ? undefined : Number(p.sirina),
          kanal: p.kanal === undefined ? undefined : Boolean(p.kanal),
          udio: p.udio === undefined ? undefined : Number(p.udio),
          ppug: p.ppug as SpornaCestica["ppug"],
        };
      }),
    plohe: (sporne?.features ?? [])
      .filter((f) => svojstva(f).vrsta === "ploha")
      .map((f) => {
        const p = svojstva(f);
        return {
          ...oblik(geo(f)),
          ha: Number(p.ha),
          zgrade: Number(p.zgrade),
          sRjesenjem: Number(p.s_rjesenjem),
          udio: Number(p.udio),
          manjina: Boolean(p.manjina),
        };
      }),
    ppug: Object.entries(((sporne as unknown as { ppug?: Record<string, { broj: string; udio: number[]; karta_do: number }> })?.ppug) ?? {}).map(
      ([id, l]) => ({ id, broj: l.broj, udio: l.udio as ListPpug["udio"], kartaDo: l.karta_do }),
    ),
    ppugCestice: ((sporne as unknown as { ppug_cestice?: Record<string, "U" | "I" | "N"> })?.ppug_cestice) ?? {},
    obris: jedan("obris"),
    gup: jedan("gup"),
    vazeci: planovi.features
      .filter((f) => svojstva(f).vrsta === "vazeci")
      .map((f) => ({ ...oblik(geo(f)), naziv: String(svojstva(f).naziv), glasnik: svojstva(f).glasnik as string | undefined })),
    propisani: planovi.features
      .filter((f) => svojstva(f).vrsta === "propisan")
      .map((f) => ({ ...oblik(geo(f)), broj: Number(svojstva(f).broj), naziv: String(svojstva(f).naziv) })),
  };
}

/** Rub područja zabrane bliži od ovoga: karta je precrtana sa skeniranog lista, pa neka se provjeri list. */
export const BLIZU_RUBA_M = 15;

/** U kojem je režimu točka po prijedlogu 2025. */
export function stanjeTocke(s: Slojevi, lng: number, lat: number): Stanje {
  // ~60 m: komad zabrane se ne gleda ako mu okvir nije ni blizu
  const blizu = (o: Oblik) => uOkviru(o.okvir, lng, lat, 0.0006);
  const rub = s.obris && blizu(s.obris) ? doRuba(s.obris, lng, lat) : Infinity;
  const komad = s.komadi.find((k) => blizu(k) && uObliku(k, lng, lat));
  if (komad) {
    return {
      rezim: "zabrana",
      podrucje: komad.podrucje,
      upu: s.propisani.find((u) => u.broj === komad.upu) ?? null,
      cestica: s.cestice.find((c) => blizu(c) && uObliku(c, lng, lat)) ?? null,
      sporna: s.sporne.find((c) => blizu(c) && uObliku(c, lng, lat)) ?? null,
      ploha: komad.podrucje === "sanacija" ? (s.plohe.find((p) => uObliku(p, lng, lat)) ?? null) : null,
      doRuba: rub,
    };
  }
  if (s.gup && !uObliku(s.gup, lng, lat)) return { rezim: "izvan" };
  const plan = s.vazeci.find((p) => uObliku(p, lng, lat));
  if (plan) return { rezim: "vazeci", plan, doRuba: rub };
  const upu = s.propisani.find((u) => uObliku(u, lng, lat));
  if (upu) return { rezim: "preporuka", upu, doRuba: rub };
  return { rezim: "gup", doRuba: rub };
}

// ---------------------------------------------------------------- adrese

/** kucni-brojevi.json: ulice [naziv, kotar] i brojevi [ulica, broj, lng, lat]. */
export interface SiroveAdrese {
  ulice: [string, string][];
  brojevi: [number, string, number, number][];
}

export interface Adresa {
  ulica: number;
  broj: string;
  lng: number;
  lat: number;
}

export interface Adrese {
  ulice: { naziv: string; kotar: string; kljuc: string }[];
  brojevi: Adresa[];
}

export type Prijedlog =
  | { vrsta: "adresa"; naziv: string; kotar: string; adresa: Adresa }
  | { vrsta: "ulica"; naziv: string; kotar: string; ulica: number };

/** Mala slova, bez dijakritika, bez interpunkcije: „Put Mostina” = „put mostina”. */
export function normaliziraj(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** „SPLIT”, „KAMEN” (katastarska općina) → „Split”, „Kamen”. */
export const naslovno = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** „GK Lovret”, „MO Stobreč” → „Lovret”, „Stobreč”. */
export const kotar = (s: string) => s.replace(/^(GK|MO)\s+/, "");

export function pripremiAdrese(a: SiroveAdrese): Adrese {
  return {
    ulice: a.ulice.map(([naziv, k]) => ({ naziv, kotar: kotar(k), kljuc: normaliziraj(naziv) })),
    brojevi: a.brojevi.map(([ulica, broj, lng, lat]) => ({ ulica, broj, lng, lat })),
  };
}

/**
 * Prijedlozi za upit: „mostina 12” daje kućne brojeve (prvo točan), „mostina”
 * ulice. Svaka riječ ulice mora se pojaviti u nazivu.
 */
export function trazi(a: Adrese, upit: string, najvise = 8): Prijedlog[] {
  const t = normaliziraj(upit);
  if (t.length < 2) return [];
  const m = t.match(/^(.*?)(?:\s+(\d+\s*[a-z]?))?$/);
  const rijeci = (m?.[1] || t).split(" ").filter(Boolean);
  const broj = m?.[2]?.replace(/\s/g, "") ?? null;
  const ulice = new Set<number>();
  a.ulice.forEach((u, i) => {
    if (rijeci.every((r) => u.kljuc.includes(r))) ulice.add(i);
  });
  if (!ulice.size) return [];
  if (broj) {
    const nadjeni = a.brojevi.filter((b) => ulice.has(b.ulica) && b.broj.startsWith(broj));
    nadjeni.sort(
      (x, y) =>
        Number(y.broj === broj) - Number(x.broj === broj) || parseInt(x.broj) - parseInt(y.broj) || x.broj.localeCompare(y.broj),
    );
    return nadjeni.slice(0, najvise).map((adresa) => ({
      vrsta: "adresa",
      naziv: `${a.ulice[adresa.ulica].naziv} ${adresa.broj}`,
      kotar: a.ulice[adresa.ulica].kotar,
      adresa,
    }));
  }
  return [...ulice]
    .sort((x, y) => a.ulice[x].naziv.length - a.ulice[y].naziv.length)
    .slice(0, najvise)
    .map((i) => ({ vrsta: "ulica", naziv: a.ulice[i].naziv, kotar: a.ulice[i].kotar, ulica: i }));
}
