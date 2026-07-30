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
import { TEME, type Dosje, type Odnos, type Stavka, type Tema } from "./dosje-oblik";

export type { Dosje } from "./dosje-oblik";

const GEO = path.join(process.cwd(), "public", "geo");

/**
 * Jedna tablica za oboje — tema i odnos po sloju. Dva odvojena popisa istih
 * id-eva razišla bi se prvom izmjenom. Sloja kojeg ovdje nema u dosjeu nema:
 * tako ispadaju druge inačice istih čestica, koje bi samo ponovile redak.
 */
const U_DOSJEU: Record<string, { tema: Tema; odnos: Odnos }> = {
  // uprava i planovi
  kotar: { tema: "uprava", odnos: "nad" },
  naselja: { tema: "uprava", odnos: "nad" },
  "granice-ko": { tema: "uprava", odnos: "nad" },
  "popisni-krugovi": { tema: "uprava", odnos: "nad" },
  "statisticki-krugovi": { tema: "uprava", odnos: "nad" },
  "planovi-obuhvat": { tema: "uprava", odnos: "nad" },
  "planovi-obuhvat-pp": { tema: "uprava", odnos: "nad" },
  "komunalna-naknada": { tema: "uprava", odnos: "nad" },
  "kiosci-zone": { tema: "uprava", odnos: "nad" },
  "kiosci-plan": { tema: "uprava", odnos: "na" },
  "kulturno-dobro": { tema: "uprava", odnos: "nad" },

  // zemljište i zgrade
  "katastar-objekti": { tema: "zemljiste", odnos: "na" },
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
  "vodovod-podrucja": { tema: "voda", odnos: "nad" },
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
  "rasvjeta-zone": { tema: "veze", odnos: "nad" },

  // zelenilo i javni prostor
  "zelene-zone": { tema: "zelenilo", odnos: "nad" },
  "zelenilo-oprema": { tema: "zelenilo", odnos: "na" },
  "zelenilo-kosevi": { tema: "zelenilo", odnos: "na" },
  "zelenilo-vjezbaliste": { tema: "zelenilo", odnos: "na" },
  "zelenilo-stabla": { tema: "zelenilo", odnos: "na" },
  igralista: { tema: "zelenilo", odnos: "na" },
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
        (f.properties ?? {}) as Record<string, unknown>,
        3
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
    // Redoslijed tema je zadan, ne po broju pogodaka: dosje se čita više
    // puta i mora svaki put izgledati isto, inače se ne pamti gdje što stoji.
    skupine: TEME.filter((t) => (poTemi.get(t.id)?.length ?? 0) > 0).map((t) => ({
      naslov: t.naslov,
      stavke: poTemi.get(t.id)!,
    })),
    pretrazeno,
  };
}
