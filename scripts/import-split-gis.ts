/**
 * Uvozi slojeve iz GIS izvoza Grada Splita (SHP.zip) u public/geo/grad/.
 * Pokretanje:  npm run import-grad-geo
 *
 * Arhiva se NE raspakirava. Puna raspakirana baza je ~2,3 GB, a čita se
 * kroz GDAL-ov /vsizip/ pa ogr2ogr otvara .shp izravno iz zipa. Zbog toga
 * skripta treba samo SHP.zip u korijenu (u .gitignore je, ~400 MB).
 *
 * Svaki sloj prolazi kroz četiri koraka:
 *   1. ogr2ogr — prostorni filtar na bbox kvarta + reprojekcija u EPSG:4326.
 *      Izvoz miješa tri sustava (3765, 3857, 4326), a ogr2ogr zna izvorni
 *      iz .prj, pa je reprojekcija po sloju jedini ispravan način.
 *   2. popravak dvostrukog kodiranja (vidi popraviMojibake).
 *   3. probir atributa — izvorne tablice nose i do 46 stupaca internih
 *      šifri; zadržavamo samo ono što se pokazuje čitatelju.
 *   4. rezanje na granicu kvarta (isti clip-lib kao ostali slojevi).
 */
import { writeFile, mkdir, stat } from "fs/promises";
import { readFileSync, existsSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import os from "os";
import { loadMask, clipToBoundary, type Mask } from "./clip-lib";
import type { Feature, FeatureCollection } from "geojson";

const ZIP = path.join(process.cwd(), "SHP.zip");
const OUT_DIR = path.join(process.cwd(), "public", "geo", "grad");
/** bbox maske (granica + 120 m) — dovoljno širok da rez ne izgubi rubove. */
const SPAT = ["16.486975", "43.519470", "16.511532", "43.530401"];

interface Sloj {
  /** Izlazno ime: public/geo/grad/<ime>.geojson */
  ime: string;
  /** Putanja unutar arhive, bez vodećeg "SHP/". */
  izvor: string;
  /** Izvorni stupac → ime pod kojim ga karta prikazuje. Ostalo otpada. */
  polja: Record<string, string>;
}

/**
 * Odabir je vođen pitanjem "vidi li stanar po tome nešto što prije nije
 * mogao", a ne time što je u izvozu najveće. Zato npr. ulaze nogostupi
 * (sa širinom) i vrsta kanalizacije, a ne interne šifre naplate.
 *
 * Gdje isti sadržaj postoji u BAZA i PORTAL inačici, uzima se ona s više
 * objekata u kvartu i punijim atributima — kod cesta je to PORTAL (128
 * dionica prema 12 u BAZA).
 */
const SLOJEVI: Sloj[] = [
  {
    ime: "kotar",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/Gradski_kotarevi_mjesni_odbori.shp",
    polja: { JMS_IME: "naziv", JMS_ST: "vrsta", JLS_IME: "grad" },
  },
  {
    ime: "ceste-nerazvrstane",
    izvor:
      "SPLIT_EXPORT_PORTAL/Nerazvrstane_ceste_Split_nerazvrstane_ceste_29112023.shp",
    polja: {
      ulica_nazi: "ulica",
      upravitelj: "upravitelj",
      vrsta_cest: "vrsta",
      cesta_opis: "cestice",
      duljina_m: "duljina",
      napomena: "napomena",
    },
  },
  {
    ime: "rasvjeta",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/JavnaRasvjeta.shp",
    polja: { vrsta: "vrsta", naziv_obje: "oznaka" },
  },
  {
    ime: "prometni-znakovi",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Prometni_Znakovi.shp",
    polja: { BROJ_ZNAKO: "broj", OPIS_ZNAKO: "opis" },
  },
  {
    ime: "pjesacki-prijelazi",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Pjesacki_Prijelazi.shp",
    polja: {},
  },
  {
    ime: "nogostupi",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Nogostupi.shp",
    polja: { Sirina_nog: "sirina", Duljina_no: "duljina" },
  },
  // Invalidske_Rampe namjerno nije ovdje: svih 8 zabilježenih rampi leži
  // zapadno od Bilica (oko Karepovca), nijedna unutar kvarta. Sloj bi uvijek
  // bio prazan, a prazan sloj se čita kao "podatak nedostaje" umjesto kao
  // "Grad ih ovdje nema evidentiranih" — što je zapravo nalaz, ne rupa.
  {
    ime: "izbocine",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Izbocine.shp",
    polja: {},
  },
  {
    ime: "vodovod",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/vodovod_vod.shp",
    polja: {
      tip: "tip",
      dn: "promjer",
      materijal: "materijal",
      godinaizgr: "godina",
      lokalnaupr: "upravitelj",
    },
  },
  {
    ime: "hidranti",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/vodovod_hidrant.shp",
    polja: { tip: "tip", ime: "oznaka", dn: "promjer" },
  },
  {
    ime: "odvodnja",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/odvodnja_kolektor.shp",
    polja: {
      tip: "tip",
      medij: "medij",
      materijal: "materijal",
      profilsiri: "profil",
    },
  },
  {
    ime: "trafostanice",
    izvor:
      "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/sn_trafostanica_tocka_2022.shp",
    polja: {
      oznaka: "oznaka",
      naziv: "naziv",
      izvedba: "izvedba",
      nazivni_na: "napon",
    },
  },
  {
    ime: "telekom-trase",
    izvor: "SPLIT_EXPORT_BAZA/DTK_TELEKOMUNIKACIJE_2022/DTK_trasa_2022.shp",
    polja: { SIMBOL: "vrsta" },
  },
  {
    ime: "katastar",
    izvor: "SPLIT_EXPORT_BAZA/KATASTAR/CADASTRAL_PARCELS_2024_P.shp",
    polja: { KO_NAZIV: "ko", KC_BROJ: "cestica", Shape_Area: "povrsina" },
  },
  {
    ime: "zgrade-2025",
    izvor: "SPLIT_EXPORT_PORTAL/Objekti_Split_2025_Objekti_Split_2025.shp",
    polja: { povrsina: "tlocrt", korisna_po: "korisna" },
  },
  {
    ime: "kucni-brojevi",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/Kucni_brojevi.shp",
    polja: { KB: "broj", UL_IME: "ulica", KC_BR: "cestica" },
  },
  {
    ime: "kulturno-dobro",
    izvor: "SPLIT_EXPORT_BAZA/KULTURNO_DOBRO/ST_KulturnoDobro.shp",
    polja: {
      naziv: "naziv",
      vrsta: "vrsta",
      datacija: "datacija",
      status_zas: "status",
      opis: "opis",
    },
  },
  {
    ime: "igralista",
    izvor:
      "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Javne_zelene_povrsine_Djecja_igralista.shp",
    polja: { vrsta: "vrsta", upravitelj: "upravitelj", opisna_adr: "adresa" },
  },
];

/**
 * Izvoz je mjestimično dvostruko kodiran: UTF-8 bajtovi pročitani kao
 * jednobajtna stranica pa opet spremljeni kao UTF-8, zbog čega "č" postaje
 * "Ä" ("Dračevac" → "DraÄevac"). Bajtovi u .dbf-u doista su takvi, dakle
 * kvar je u izvoru, ne u čitanju — .cpg uredno piše UTF-8.
 *
 * Vraćamo ga natrag samo kad je pretvorba sigurna: niz mora stati u jedan
 * bajt po znaku i natrag se dekodirati bez zamjenskog znaka. Sloj koji je
 * već ispravan (npr. "Mejaši") tako ostaje netaknut.
 */
function popraviMojibake(s: string): string {
  if (!/[ÂÃÄÅ]/.test(s)) return s;
  for (const ch of s) {
    if (ch.codePointAt(0)! > 0xff) return s;
  }
  const natrag = Buffer.from(s, "latin1").toString("utf-8");
  return natrag.includes("�") ? s : natrag;
}

/** Prazno = null, prazan niz, ili nula ondje gdje nula znači "neupisano". */
function prazno(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === 0;
}

function preslikajPolja(f: Feature, polja: Record<string, string>): Feature {
  const izlaz: Record<string, unknown> = {};
  for (const [izvorno, novo] of Object.entries(polja)) {
    const v = f.properties?.[izvorno];
    if (prazno(v)) continue;
    izlaz[novo] = typeof v === "string" ? popraviMojibake(v.trim()) : v;
  }
  return { ...f, properties: izlaz };
}

/** ogr2ogr iz /vsizip/ → GeoJSON u privremenoj datoteci. */
function izvuci(sloj: Sloj, tmp: string): FeatureCollection {
  execFileSync(
    "ogr2ogr",
    [
      "-f", "GeoJSON", tmp,
      `/vsizip/${ZIP}/SHP/${sloj.izvor}`,
      "-spat", ...SPAT,
      "-spat_srs", "EPSG:4326",
      "-t_srs", "EPSG:4326",
      // ~0,1 m — finije od toga je prividna točnost, a datoteka raste.
      "-lco", "COORDINATE_PRECISION=6",
    ],
    { stdio: "pipe" }
  );
  return JSON.parse(readFileSync(tmp, "utf-8")) as FeatureCollection;
}

async function main(): Promise<void> {
  if (!existsSync(ZIP)) {
    console.error(
      `Nema ${path.basename(ZIP)} u korijenu — arhiva nije u repozitoriju ` +
        "(prevelika je), pa je treba imati lokalno."
    );
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const mask: Mask = await loadMask();
  const tmp = path.join(os.tmpdir(), `kvart-grad-${process.pid}.geojson`);

  console.log("Uvozim slojeve iz GIS izvoza Grada Splita…");
  let ukupno = 0;
  for (const sloj of SLOJEVI) {
    let fc: FeatureCollection;
    try {
      fc = izvuci(sloj, tmp);
    } catch (e) {
      console.log(`  ✗ ${sloj.ime} — ogr2ogr nije uspio: ${String(e).slice(0, 80)}`);
      continue;
    }
    const prije = fc.features.length;
    const probrano: FeatureCollection = {
      ...fc,
      features: fc.features.map((f) => preslikajPolja(f, sloj.polja)),
    };
    const rezano = clipToBoundary(probrano, mask);
    const p = path.join(OUT_DIR, `${sloj.ime}.geojson`);
    await writeFile(p, JSON.stringify(rezano), "utf-8");
    const kb = ((await stat(p)).size / 1024).toFixed(1);
    ukupno += rezano.features.length;
    const upozorenje = rezano.features.length === 0 ? "  ⚠ nema podataka" : "";
    console.log(
      `  ✓ ${sloj.ime.padEnd(20)} ${String(prije).padStart(5)} → ` +
        `${String(rezano.features.length).padStart(5)}   ${kb.padStart(8)} KB${upozorenje}`
    );
  }
  rmSync(tmp, { force: true });
  console.log(`Gotovo — ${SLOJEVI.length} slojeva, ${ukupno} objekata.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
