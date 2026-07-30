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
import { opisObjekta } from "./polja";

const GEO = path.join(process.cwd(), "public", "geo");

/**
 * Kako se sloj odnosi prema čestici. Razlika je u čitanju, ne u računu:
 * „nad” su područja u kojima čestica leži, „na” je ono što na njoj stoji,
 * „kroz” je ono što je presijeca. Slojevi kojih ovdje nema ne ulaze u dosje
 * — npr. druge inačice istih čestica, koje bi samo ponovile isti redak.
 */
type Odnos = "nad" | "na" | "kroz";

const ODNOSI: Record<string, Odnos> = {
  // područja u kojima čestica leži
  kotar: "nad",
  naselja: "nad",
  "granice-ko": "nad",
  "popisni-krugovi": "nad",
  "statisticki-krugovi": "nad",
  "planovi-obuhvat": "nad",
  "planovi-obuhvat-pp": "nad",
  "komunalna-naknada": "nad",
  "rasvjeta-zone": "nad",
  "zelene-zone": "nad",
  "vodovod-podrucja": "nad",
  "kiosci-zone": "nad",
  "kulturno-dobro": "nad",

  // što stoji na čestici
  "zgrade-2025": "na",
  "zgrade-visine": "na",
  "korisna-povrsina": "na",
  "katastar-objekti": "na",
  "kucni-brojevi": "na",
  adrese: "na",
  "zgrade-adrese": "na",
  "solar-krovovi": "na",
  rasvjeta: "na",
  "rasvjeta-mjesta": "na",
  "rasvjeta-trafostanice": "na",
  "prometni-znakovi": "na",
  "pjesacki-prijelazi": "na",
  izbocine: "na",
  hidranti: "na",
  trafostanice: "na",
  "trafostanice-plohe": "na",
  "trafostanica-110": "na",
  "struja-nn-stupovi": "na",
  "struja-nn-ormarici": "na",
  "struja-stupovi-vn": "na",
  "odvodnja-okna": "na",
  "odvodnja-slivnici": "na",
  "odvodnja-gradevine": "na",
  "vodovod-spojevi": "na",
  "vodovod-zatvaraci": "na",
  "telekom-sahte": "na",
  "telekom-ht-zdenci": "na",
  "telekom-ht-stupovi": "na",
  igralista: "na",
  "zelenilo-oprema": "na",
  "zelenilo-kosevi": "na",
  "zelenilo-vjezbaliste": "na",
  "zelenilo-stabla": "na",
  "stajalista-grad": "na",
  nadstresnice: "na",
  "parkiraliste-grad": "na",
  "kiosci-plan": "na",

  // što česticu presijeca
  vodovod: "kroz",
  "vodovod-kanali": "kroz",
  odvodnja: "kroz",
  "odvodnja-tlacni": "kroz",
  "struja-nn": "kroz",
  "struja-sn": "kroz",
  "struja-vn-110": "kroz",
  "telekom-trase": "kroz",
  "telekom-ht-podzemno": "kroz",
  "telekom-ht-nadzemno": "kroz",
  "ceste-nerazvrstane": "kroz",
  "ceste-dionice": "kroz",
  "ulice-osi": "kroz",
  "drzavne-ceste": "kroz",
  nogostupi: "kroz",
  "odbojne-ograde": "kroz",
};

/** Najviše stavki po sloju u odgovoru — ostatak se izbroji, ne nabraja. */
const NAJVISE_PO_SLOJU = 6;

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

export interface Stavka {
  sloj: string;
  broj: number;
  primjeri: string[];
  /** Poveznica na dokument, ako je objekt nosi (obuhvati planova). */
  poveznica?: string;
}

export interface Skupina {
  naslov: string;
  stavke: Stavka[];
}

export interface Dosje {
  cestica: Record<string, unknown> | null;
  skupine: Skupina[];
  /** Slojevi koji su pretraženi — da se vidi da prazno znači „nema”. */
  pretrazeno: number;
}

const NASLOVI: Record<Odnos, string> = {
  nad: "Čestica leži u",
  na: "Na čestici",
  kroz: "Kroz česticu prolazi",
};

/**
 * Sastavi dosje za točku. Čestica se traži u sloju katastra; ako je nema
 * (rub kvarta, more, neobuhvaćeno), dosje se svejedno sastavlja oko točke,
 * jer je i tada korisno vidjeti što je ondje.
 */
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

  const skupine: Record<Odnos, Stavka[]> = { nad: [], na: [], kroz: [] };
  let pretrazeno = 0;

  for (const sloj of OVERLAY_LAYERS) {
    const odnos = ODNOSI[sloj.id];
    if (!odnos || sloj.type !== "geojson") continue;
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
    skupine[odnos].push({
      sloj: sloj.label,
      broj: pogodci.length,
      primjeri: pogodci
        .slice(0, NAJVISE_PO_SLOJU)
        .map((f) =>
          opisObjekta((f.properties ?? {}) as Record<string, unknown>, 3)
        ),
      ...(poveznica ? { poveznica } : {}),
    });
  }

  return {
    cestica: cestica ? ((cestica.properties ?? {}) as Record<string, unknown>) : null,
    skupine: (["nad", "na", "kroz"] as const)
      .filter((o) => skupine[o].length > 0)
      .map((o) => ({ naslov: NASLOVI[o], stavke: skupine[o] })),
    pretrazeno,
  };
}
