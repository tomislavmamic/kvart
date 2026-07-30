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
  /**
   * Izvorni stupac → ime pod kojim ga karta prikazuje; ostalo otpada.
   * Kad izostane, stupci se probiru automatski (vidi ODBACI) — to je za
   * slojeve gdje su izvorna imena već razumljiva ili sadržaj sporedan.
   */
  polja?: Record<string, string>;
}

/**
 * Stupci koji ne opisuju stvar nego zapis o njoj: interni ključevi, tragovi
 * CAD izvoza i evidencija tko je i kad redak unio. Ispadaju iz automatskog
 * probira jer bi inače činili većinu ispisa.
 */
const ODBACI = new Set([
  // ključevi i sustavno
  "id", "fid_", "objectid", "objectid_1", "orig_fid", "orig_seq", "tip_id",
  "tip_fme", "fme_db_ope", "gdi_status", "veza_an", "globalid", "join_count",
  "join_cou_1", "target_fid", "target_f_1", "aj_di", "gridcode",
  // mjere koje ArcGIS sam računa (duljina/površina već su u geometriji)
  "shape_leng", "shape_area", "shape_le_1", "shape_le_2", "shape_length",
  // tragovi CAD-a
  "entity", "handle", "lyron", "lyrhandle", "color", "entcolor", "lyrcolor",
  "linetype", "subclasses", "entityhand", "simbol", "simbolrota",
  // evidencija unosa
  "podaciizvo", "podacitocn", "podacidatu", "podaciime", "izvor_geom",
  "metoda_izm", "unos_napra", "datum_unos", "promijenio", "datum_prom",
  "pridruzeni", "created_us", "created_da", "last_edite", "last_edi_1",
  // šifre organizacijske jedinice HEP-a — na svakom retku iste
  "organizaci", "organiza00",
]);

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

  // ---------- Zgrade, površine, sunce ----------
  {
    // Visine zgrada. Postoji i ST_3D_2024 s istim mjerama, ali je ondje
    // geometrija puno tijelo (šest ploha sa Z), što na 2D karti daje
    // preklopljene krpice zidova. Ovaj sloj nosi iste visine na pravom
    // tlocrtu, pa je za kartu ispravan izbor.
    ime: "zgrade-visine",
    izvor: "SPLIT_EXPORT_PORTAL/Objekti_SPLIT_objekti_2D_v1.shp",
    polja: {
      layer: "krov",
      h_objekt: "visina",
      z_min: "kota_dna",
      z_max: "kota_vrha",
      sarea: "tlocrt",
      volume: "obujam",
    },
  },
  {
    ime: "korisna-povrsina",
    izvor:
      "SPLIT_EXPORT_PORTAL/Korisna_povrsina_Split_2025_Korisna_povrsina_Split_2025.shp",
    polja: { layer: "krov", h_objekt: "visina", h_max: "kota_vrha" },
  },
  {
    // Razredi su rasponi kWh/m² godišnje; `mean_gridc` je sredina plohe.
    ime: "solar-krovovi",
    izvor:
      "SPLIT_EXPORT_PORTAL/Solarni_potencijal_SPLIT_SP_objekti_kWh_vec_Dissolve_2.shp",
    polja: {
      klasa: "razred",
      min_gridco: "kwh_min",
      max_gridco: "kwh_max",
      mean_gridc: "kwh_prosjek",
    },
  },

  // ---------- Katastar, adrese, popis ----------
  {
    // Jedina inačica čestica s vlasništvom i teretima. Stupci zku_* nose
    // imena vlasnika i bilješke o hipotekama i služnostima — vidi upozorenje
    // u README-u prije nego sloj ode na javnu stranicu.
    ime: "katastar-vlasnistvo",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/KatastarskeCestice.shp",
    polja: {
      kat_cest_1: "cestica",
      kat_opcina: "ko",
      zku_status: "zk_status",
      zku_suvlas: "zk_oblik",
      zku_vlasni: "zk_vlasnik",
      zku_teret: "zk_teret",
      zku_teret_: "zk_teret_vrsta",
    },
  },
  {
    ime: "katastar-objekti",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/KO_Split_objekti.shp",
    polja: { BROJ: "broj", VRSTA: "vrsta", POVRSINA_R: "povrsina" },
  },
  {
    ime: "granice-ko",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/KO_granice_ko.shp",
    polja: { KO_NAZIV: "naziv" },
  },
  {
    // Bogatija od `kucni-brojevi`: CENSUS_DIS i STATISTICA vežu adresu uz
    // popisni krug, što je spona prema podacima Popisa 2021.
    ime: "adrese",
    izvor: "SPLIT_EXPORT_BAZA/AR_V_HOUSENUMBERS_PT_HTRS.shp",
    polja: {
      HOUSENUM_1: "broj",
      STREETNAME: "ulica",
      CENSUS_DIS: "popisni_krug",
      STATISTICA: "statisticki_krug",
    },
  },
  {
    ime: "zgrade-adrese",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/Zgrade.shp",
    polja: { KB: "broj", UL_IME: "ulica", SRUSENO: "sruseno" },
  },
  {
    ime: "popisni-krugovi",
    izvor: "SPLIT_EXPORT_BAZA/SRPJ/PK.shp",
    polja: {
      PK_IME: "naziv", PK_JID: "sifra", SK_IME: "statisticki_krug",
      JMS_IME: "kotar", NA_IME: "naselje",
    },
  },
  {
    ime: "statisticki-krugovi",
    izvor: "SPLIT_EXPORT_BAZA/SRPJ/SK.shp",
    polja: { SK_IME: "naziv", SK_MB: "sifra", NA_IME: "naselje", KO_IME: "ko" },
  },
  {
    ime: "naselja",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/Naselja.shp",
    polja: { NA_IME: "naziv", JLS_IME: "grad" },
  },

  // ---------- Prostorni planovi ----------
  {
    // Za svaku točku kvarta: koji ga planovi pokrivaju, uz poveznicu na
    // dokument na split.hr.
    ime: "planovi-obuhvat",
    izvor: "SPLIT_EXPORT_BAZA/PM_UI_PLAN_COVERAGE_P.shp",
    polja: { PLAN_NAME: "naziv", PLAN_URL: "poveznica" },
  },
  {
    ime: "planovi-obuhvat-pp",
    izvor: "SPLIT_EXPORT_BAZA/OBUHVAT_PP/OBUHVATI_PP.shp",
    polja: { PLAN_NAME: "naziv", PLAN_URL: "poveznica" },
  },

  // ---------- Ceste, ulice, pješačko ----------
  {
    ime: "ceste-dionice",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Dionice_Cesta.shp",
    polja: { NAZIV: "naziv", DULJINA_DI: "duljina" },
  },
  {
    ime: "ulice-osi",
    izvor: "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/Ulice.shp",
    polja: { UL_IME: "naziv", UL_JID: "sifra", NA_IME: "naselje" },
  },
  {
    ime: "ulice-podrucja",
    izvor: "SPLIT_EXPORT_BAZA/ZELENILO_NOVI_PODACI/Ulice_Buffer.shp",
    polja: { UL_IME: "naziv", NA_IME: "naselje" },
  },
  {
    ime: "drzavne-ceste",
    izvor: "SPLIT_EXPORT_BAZA/DRZAVNA_CESTA/drzavna_cesta_UI.shp",
    polja: { NAZIV: "oznaka", VRSTA: "vrsta" },
  },
  // Uz Invalidske_Rampe izostaju i rub kolnika (89 dionica), pješačke ograde
  // (6) i gradski vrtić: sve leži u istom džepu jugozapadno od Bilica
  // (x ≈ 16,487 / y ≈ 43,520), unutar bbox-a ali izvan granice kvarta.
  // Vrtić „Čarobni pianino” je na Ul. 141. brigade, dakle doista u susjednom
  // kotaru. Prazan sloj čita se kao kvar, a ovo nije kvar nego međa.
  {
    ime: "odbojne-ograde",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Odbojne_Ograde.shp",
    polja: { DUZINA_OGR: "duljina" },
  },
  {
    ime: "stajalista-grad",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/JavniPrijevoz_pt.shp",
    polja: { naziv_obje: "naziv", d_vrsta: "vrsta" },
  },
  {
    ime: "nadstresnice",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/GradjJavneNamjene.shp",
    polja: { opisna_adr: "lokacija", d_vrsta: "vrsta", vlasnik: "vlasnik" },
  },
  {
    ime: "parkiraliste-grad",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/JavnaParkiralista.shp",
    polja: {
      naziv_obje: "naziv", upravitelj: "upravitelj",
      Zona: "zona", Lokacija: "polozaj",
    },
  },

  // ---------- Vodovod i odvodnja (dopuna) ----------
  {
    ime: "odvodnja-okna",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/odvodnja_okno.shp",
    polja: {
      medij: "medij", hteren_mnm: "kota_terena", hmin_mnm: "kota_dna",
      materijal: "materijal", oblik: "oblik",
    },
  },
  {
    ime: "odvodnja-slivnici",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/odvodnja_slivnik.shp",
    polja: { tip: "tip", tehnickacj: "sustav", lokalnaupr: "upravitelj" },
  },
  {
    ime: "odvodnja-tlacni",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA/tlacni_vod.shp",
    polja: { Tip: "tip", Sliv: "sliv" },
  },
  {
    ime: "odvodnja-gradevine",
    izvor:
      "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/odvodnja_podrucje_zgrada_poligon.shp",
    polja: { tip: "tip", ime: "naziv", lokacija: "lokacija" },
  },
  {
    ime: "vodovod-spojevi",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/vodovod_spoj.shp",
    polja: {
      tlacnazona: "tlacna_zona", tehnickacj: "sustav",
      lokalnaupr: "upravitelj", status: "status",
    },
  },
  {
    ime: "vodovod-zatvaraci",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/vodovod_zatvarac.shp",
    polja: { tip: "tip", tlacnazona: "tlacna_zona", status: "status" },
  },
  {
    ime: "vodovod-kanali",
    izvor: "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/vodovod_kanal.shp",
    polja: {
      ime: "naziv", profilsiri: "sirina", profilvisi: "visina",
      oblik: "oblik", lokalnaupr: "upravitelj",
    },
  },
  {
    ime: "vodovod-podrucja",
    izvor:
      "SPLIT_EXPORT_BAZA/VODOOPSKRBA_2022/mreza_vodoopskrbnog_sustava.shp",
    polja: { naziv: "naziv" },
  },

  // ---------- Elektro-mreža (HEP) ----------
  {
    ime: "struja-nn",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/nn_dionica_2022.shp",
    polja: {
      izvod: "izvod", vrsta: "vrsta", tip: "vodic",
      nazivni_na: "napon", broj_faza: "faze", status: "status",
    },
  },
  {
    ime: "struja-nn-stupovi",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/nn_stup_2021.shp",
    polja: {
      oznaka: "oznaka", izvod: "izvod", vrsta_stup: "vrsta",
      status: "status", funkcija_u: "funkcija",
    },
  },
  {
    ime: "struja-nn-ormarici",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/nn_ormaric_tocka_2022.shp",
    polja: { oznaka: "oznaka", izvod: "izvod", vrsta: "vrsta", status: "status" },
  },
  {
    ime: "struja-sn",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/vn_dionica_2022.shp",
    polja: {
      vn_vod: "vod", oznaka: "oznaka", vrsta: "vrsta",
      tip: "vodic", izvod: "izvod",
    },
  },
  {
    ime: "struja-vn-110",
    izvor:
      "SPLIT_EXPORT_PORTAL/Energetika_2022_Visokonaponska_110_kV_i_220_kV___dionica.shp",
    polja: { vn_vod: "vod", oznaka: "oznaka", vrsta: "vrsta", konstrukci: "napon" },
  },
  {
    ime: "struja-stupovi-vn",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA/vn_stup.shp",
    polja: {
      oznaka: "oznaka", vrsta_stup: "vrsta", konstrukci: "napon",
      datum_izgr: "izgraden", status: "status",
    },
  },
  {
    ime: "trafostanice-plohe",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/sn_trafostanica_poligon_2022.shp",
    polja: {
      oznaka: "oznaka", naziv: "naziv", adresa: "adresa",
      izvedba: "izvedba", nazivni_na: "napon",
    },
  },
  {
    ime: "trafostanica-110",
    izvor: "SPLIT_EXPORT_BAZA/ENERGETIKA_2022/vn_trafostanica_poligon_2022.shp",
    polja: { oznaka: "oznaka", naziv: "naziv", prijenosni: "prijenos" },
  },

  // ---------- Telekomunikacije ----------
  {
    ime: "telekom-sahte",
    izvor: "SPLIT_EXPORT_BAZA/DTK_TELEKOMUNIKACIJE_2022/DTK_sahte_2022.shp",
    polja: {},
  },
  {
    ime: "telekom-ht-podzemno",
    izvor:
      "SPLIT_EXPORT_BAZA/DTK_TELEKOMUNIKACIJE_HT_2023/Split_HT_podzemne_trase.shp",
    // `width` se ne preuzima: vrijednosti idu do nekoliko stotina, dakle
    // nisu metri, a izvoz nigdje ne kaže koja je mjera. Krivo označena
    // jedinica gora je od izostavljenog podatka.
    polja: { name: "oznaka" },
  },
  {
    ime: "telekom-ht-nadzemno",
    izvor:
      "SPLIT_EXPORT_BAZA/DTK_TELEKOMUNIKACIJE_HT_2023/Split_HT_nadzemne_trase.shp",
    polja: {},
  },
  {
    ime: "telekom-ht-zdenci",
    izvor:
      "SPLIT_EXPORT_BAZA/DTK_TELEKOMUNIKACIJE_HT_2023/Split_HT_zdenci.shp",
    polja: {
      label: "oznaka", spec_id: "tip", depth: "dubina", adresa: "adresa",
    },
  },
  {
    ime: "telekom-ht-stupovi",
    izvor:
      "SPLIT_EXPORT_BAZA/DTK_TELEKOMUNIKACIJE_HT_2023/Split_HT_stupovi.shp",
    polja: { usage: "namjena", uzemljenje: "uzemljenje" },
  },

  // ---------- Javna rasvjeta (dopuna) ----------
  {
    // Druga evidencija rasvjete: `rasvjeta` su stupovi, ovo su svjetleća
    // mjesta, s datumom ugradnje i imenom ulice.
    ime: "rasvjeta-mjesta",
    izvor: "SPLIT_EXPORT_BAZA/JAVNA_RASVJETA/PL_LIGHT_POS_PT.shp",
    polja: {
      LP_NOTE: "ulica", LP_STATUS: "status", LP_INSTALL: "ugradeno",
      ZONE_ID: "zona",
    },
  },
  {
    ime: "rasvjeta-zone",
    izvor: "SPLIT_EXPORT_BAZA/JAVNA_RASVJETA/PL_ZONE_P.shp",
    polja: { ZONECODE: "zona" },
  },
  {
    ime: "rasvjeta-trafostanice",
    izvor: "SPLIT_EXPORT_BAZA/JAVNA_RASVJETA/PL_TR_STAT_PT.shp",
    polja: { TS_NAME: "naziv", TS_STATUS: "status" },
  },

  // ---------- Zelenilo i javni sadržaji ----------
  {
    ime: "zelene-zone",
    izvor:
      "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Javne_zelene_povrsine_ZP.shp",
    polja: { NAZIV_ZP: "naziv", POVRSINA: "povrsina", d_GK_ID: "kotar" },
  },
  {
    ime: "zelenilo-oprema",
    izvor:
      "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Javne_zelene_povrsine_Komunalna_oprema.shp",
    polja: { d_VRSTA_OP: "vrsta", d_ZP_ID: "zelena_povrsina" },
  },
  {
    ime: "zelenilo-kosevi",
    izvor:
      "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Javne_zelene_povrsine_Kosevi.shp",
    polja: { d_vrsta_ko: "vrsta", d_ZP_ID: "zelena_povrsina" },
  },
  {
    ime: "zelenilo-vjezbaliste",
    izvor:
      "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Javne_zelene_povrsine_Vjezbalista.shp",
    polja: { d_VRSTA_VJ: "vrsta", d_ZP_ID: "zelena_povrsina" },
  },
  {
    ime: "zelenilo-stabla",
    izvor:
      "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Javne_zelene_povrsine_Stabla.shp",
    polja: { vrsta: "vrsta", VRSTA_STAB: "vrsta_stabla", PROMJER_DE: "promjer" },
  },
  {
    ime: "kiosci-plan",
    izvor: "SPLIT_EXPORT_BAZA/PLAN_KIOSKA_I_NAPRAVA/CM_KIOSK_PLAN.shp",
    polja: {
      NAMJENA: "namjena", ADRESA: "adresa", POVRSINA: "povrsina",
      PLAN_: "plan", G_KOTAR: "kotar",
    },
  },
  {
    ime: "kiosci-zone",
    izvor: "SPLIT_EXPORT_BAZA/PLAN_KIOSKA_I_NAPRAVA/CM_KIOSCI_ZONE.shp",
    polja: { NAZIV: "naziv", ZONE: "zona", VRSTA: "vrsta" },
  },
  {
    // Zaduženo prema naplaćenom po kotaru; POST1 je postotak naplate.
    ime: "komunalna-naknada",
    izvor: "SPLIT_EXPORT_BAZA/KOMUNALNA_NAKNADA/KOMUNALNA_NAKNADA_DEMO.shp",
    polja: {
      NAZIV: "naziv", SU_ZAD1: "zaduzeno", SU_UPL1: "naplaceno",
      POST1: "postotak_naplate",
    },
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

function ocisti(v: unknown): unknown {
  return typeof v === "string" ? popraviMojibake(v.trim()) : v;
}

/**
 * Boja čestice prema tome tko je vlasnik — karta koristi svojstvo `boja`
 * kad ga objekt ima. Bez toga bi pregled 1 292 čestica značio klikanje
 * jedne po jedne; ovako se odmah vidi gdje Grad ima svoje.
 *
 * Javnim vlasnikom smatra se ono što je zemljišna knjiga tako i označila
 * (`zku_status = JLS`) ili što se imenom svodi na javno tijelo. Sve ostalo
 * je privatno — uključujući imenovane fizičke osobe, zbog kojih ovaj sloj
 * i ne ide na javnu stranicu bez odluke.
 */
const JAVNI_VLASNIK =
  /^(GRAD SPLIT|JAVNO DOBRO|DRUŠTVENO VLASNIŠTVO|REPUBLIKA HRVATSKA|OPĆINA|ŽUPANIJA)/i;

function bojaVlasnistva(p: Record<string, unknown>): string | null {
  const vlasnik = typeof p.zk_vlasnik === "string" ? p.zk_vlasnik : "";
  if (!vlasnik && p.zk_status == null) return null; // nema zk podatka
  if (p.zk_teret === "Da") return "#b91c1c"; // teret — gleda se prvo
  if (p.zk_status === "JLS" || JAVNI_VLASNIK.test(vlasnik)) return "#15803d";
  return "#78716c";
}

function preslikajPolja(f: Feature, sloj: Sloj): Feature {
  const izlaz: Record<string, unknown> = {};
  if (sloj.polja) {
    for (const [izvorno, novo] of Object.entries(sloj.polja)) {
      const v = f.properties?.[izvorno];
      if (prazno(v)) continue;
      izlaz[novo] = ocisti(v);
    }
    if (sloj.ime === "katastar-vlasnistvo") {
      const boja = bojaVlasnistva(izlaz);
      if (boja) izlaz.boja = boja;
    }
    return { ...f, properties: izlaz };
  }
  // Bez izričite karte: uzmi sve što nije zapis o zapisu, imena ostaju
  // izvorna jer su ondje gdje se ovo koristi već čitljiva.
  for (const [k, v] of Object.entries(f.properties ?? {})) {
    if (prazno(v) || ODBACI.has(k.toLowerCase())) continue;
    izlaz[k.toLowerCase()] = ocisti(v);
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
      features: fc.features.map((f) => preslikajPolja(f, sloj)),
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
