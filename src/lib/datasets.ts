/**
 * Katalog otvorenih prostornih podataka za područje Dračevca i Bilica
 * (bbox ~16.47–16.52 E / 43.51–43.54 N). Istraženo i provjereno 8. 7. 2026.
 * — status "ok" znači da je endpoint tada odgovorio na stvarni upit.
 */

export type DatasetStatus = "ok" | "warn" | "bad";

export interface Dataset {
  name: string;
  desc: string;
  endpoints?: string[];
  format: string;
  license: string;
  coverage: string;
  status: DatasetStatus;
  statusLabel: string;
  note?: string;
}

export interface DatasetSection {
  title: string;
  intro?: string;
  items: Dataset[];
}

export const CATALOG_DATE = "8. srpnja 2026.";
export const CATALOG_BBOX = "16.47–16.52 E / 43.51–43.54 N";

export const DATASET_SECTIONS: DatasetSection[] = [
  {
    title: "Podloge i snimke",
    items: [
      {
        name: "DGU digitalni ortofoto (DOF) — 2023. + serija 2011.–2024.",
        desc: "Službene zračne snimke države, 0,5 m. Dostupne godine: 2011., 2014.–16., 2017., 2018., 2021., 2022., 2023., 2024. i LIDAR 2022./23. — omogućuje usporedbu kvarta kroz vrijeme.",
        endpoints: [
          "https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms  (sloj OI.OrthoimageCoverage)",
          "https://geoportal.dgu.hr/services/dof/wms  (slojevi DOF05_VPI_2024, DOF5_2011, DOF_LIDAR_2022_2023)",
        ],
        format: "WMS 1.3.0",
        license: "Otvorena dozvola (uz navođenje DGU)",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
        note: "Anonimni pristup nosi vodeni žig „GEOPORTAL”. Starije godine imaju drugačije ime sloja (OI.OrthoImagery); 2019.–20. ne postoji.",
      },
      {
        name: "DGU topografske karte (TK25/TK100/TK200, HOK 1:5000)",
        desc: "Skenirane službene topografske karte; HOK je klasična osnovna karta 1:5000.",
        endpoints: [
          "https://geoportal.dgu.hr/services/tk/wms  (TK25, TK25_NOVI, TK100, TK200)",
          "https://geoportal.dgu.hr/services/hok/wms  (hok:HOK5)",
        ],
        format: "WMS 1.3.0",
        license: "Otvorena dozvola",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "DGU reljef — DMR / hillshade",
        desc: "Državni digitalni model reljefa kao sjenčani i obojeni prikaz; sirovi DEM GeoTIFF dostupan preko ATOM servisa za preuzimanje.",
        endpoints: [
          "https://geoportal.dgu.hr/services/dmr/wms  (DMR_BW, DMR_COLOR, Hillshade)",
          "https://geoportal.dgu.hr/services/atom/el-cov/xml  (GeoTIFF DEM)",
        ],
        format: "WMS + ATOM/GeoTIFF",
        license: "Otvorena dozvola",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "OpenStreetMap podloge (OpenFreeMap / Protomaps)",
        desc: "Ulična kartografska podloga iz OSM podataka; OpenFreeMap nudi besplatne vektorske pločice bez ključa, Protomaps samostalno hostanu PMTiles datoteku područja.",
        format: "vektorske pločice / PMTiles",
        license: "ODbL — obavezno „© OpenStreetMap contributors”",
        coverage: "potpuna",
        status: "warn",
        statusLabel: "nije provjereno",
        note: "Javni tile.openstreetmap.org poslužitelj nije za produkcijsku upotrebu (pravila korištenja).",
      },
    ],
  },
  {
    title: "Prostorni planovi",
    intro:
      "Državni ISPU sustav već poslužuje službene listove planova koji pokrivaju upravo Dračevac i Bilice.",
    items: [
      {
        name: "ISPU prostorni planovi (GUP, PPUG, UPU, DPU) — rasterski WMS",
        desc: "Georeferencirani službeni listovi planova. Za kvart postoje: GUP Splita (namjena HR_ISPU_GUP1_04090_R07_KN_1_1, infrastruktura …_IS_*, zaštita …_ZP_*), PPUG Splita (…PPGO_04090_R02…, građevinska područja …_GP_4_1), UPU Bilice sjever (…UPU2_04090_R01_*), UPU Bilice II–Mostine (…UPU1_04090_R01_*), DPU radne zone Dračevac (…DPU36_04090_R03/R04_*) i DPU dijela područja Dračevac (…DPU5_04090_R01_*).",
        endpoints: [
          "https://gis1.mgipu.hr/srv1/PPRasterZ17_Public/wms  (zrcala gis2/gis3; Split JLS = 04090)",
        ],
        format: "WMS 1.3.0, prozirni PNG; oznake listova: KN = namjena, IS = infrastruktura, ZP = zaštita, GP = građevinska područja",
        license: "javni državni servis",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
        note: "Servis ne podržava EPSG:3857 (web-mercator); GetFeatureInfo ne radi — samo prikaz. Legenda preko GetLegendGraphic.",
      },
      {
        name: "split.hr „GIS podatci” — zapravo PDF dokumentacija planova",
        desc: "Unatoč nazivu, sekcija NE sadrži GIS pakete. Cijela biblioteka pregledana 26. 7. 2026.: 210 mapa i 759 datoteka, od toga 755 PDF i 4 Word — nijedan ZIP, SHP, DWG ni GML. Ista je dokumentacija dostupna i pod „Planovi na snazi”. Ukupno ~2,1 GB; za Dračevac i Bilice relevantna je 51 datoteka (~94 MB), plus cijeli GUP (43 datoteke, ~184 MB).",
        endpoints: [
          "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci",
          "…/gis-podatci?EntryId={id}&Command=Core_Download  (izravno preuzimanje)",
        ],
        format: "PDF (755) + DOC/DOCX (4)",
        license: "javni gradski dokumenti",
        coverage: "GUP obuhvat — potpuna",
        status: "ok",
        statusLabel: "provjereno",
        note: "Poveznice NISU vezane uz sesiju — obični GET s User-Agentom i Refererom radi, bez prijave. Popis preuzetih datoteka: data/sources/planovi-manifest.json.",
      },
      {
        name: "split.hr kartografski prikazi — vektorski PDF-ovi",
        desc: "Ključan nalaz: većina grafičkih listova nisu skenovi nego vektorski PDF izvozi iz CAD-a, pa se iz njih može izvući prava geometrija. Provjereno brojanjem PDF path-operatora: GUP Splita 30 listova (do 8,4 mil. točaka, bez ijedne rasterske slike), DPU radne zone Dračevac 11 listova, UPU Bilice sjever 8, UPU Šine–Vidovac 9. Iznimka je DPU dijela područja Dračevac (2004.) — 7 listova, svaki jedna slika od 11,1 MP, čisti skenovi.",
        endpoints: [
          "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi",
        ],
        format: "PDF s vektorskom geometrijom (bez georeference)",
        license: "javni gradski dokumenti",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "vektorizirano",
        note: "Nijedan list nije GeoPDF (nema /LGIDict, /Measure, /GPTS ni /VP ni u jednoj od 94 preuzete datoteke), pa se georeferencira uklapanjem u službeni ISPU obuhvat. Izvučeno u public/geo/planovi/ skriptom scripts/vectorize-plans.py: svih 11 listova DPU-a radne zone Dračevac s izvornim imenima CAD slojeva i namjena iz UPU-a Bilice sjever razvrstana po boji. GUP zasad nije — nema otisnutog mjerila, a ISPU sloj za usporedbu pokriva drugi obuhvat.",
      },
    ],
  },
  {
    title: "Katastar, zemljište i granice",
    items: [
      {
        name: "Administrativne granice (DGU INSPIRE AU)",
        desc: "Granice države, županija i gradova/općina — uključuje granicu Grada Splita.",
        endpoints: [
          "https://geoportal.dgu.hr/services/inspire/au/wms  (AU.AdministrativeUnit)",
          "https://geoportal.dgu.hr/services/atom/au/xml  (GML cijele Hrvatske, 219 MB)",
        ],
        format: "WMS + ATOM/GML",
        license: "Otvorena dozvola",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Registar geografskih imena (toponimi)",
        desc: "Službena geografska imena — WFS upit vratio je objekte unutar samog Dračevca (npr. arheološko nalazište „Dvorine”).",
        endpoints: [
          "https://rgi.dgu.hr/geoserver/wfshr/wfs  (typeName wfshr:nippimenovanomjesto, izlaz GeoJSON)",
        ],
        format: "WFS 2.0 / GeoJSON",
        license: "Otvorena dozvola",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Katastarske čestice (OSS WMS)",
        desc: "Slojevi čestica, zgrada i načina uporabe postoje (dkp_cestice, dkp_zgrade, dkp_nacini_uporabe…), ali GetMap traži token registriranog korisnika. Javno ostaje pretraživanje pojedinačne čestice na oss.uredjenazemlja.hr.",
        endpoints: ["https://oss.uredjenazemlja.hr/OssWebServices/wms  (traži ?token=…)"],
        format: "WMS 1.3.0 (uz token)",
        license: "registrirani pristup",
        coverage: "potpuna (uz token)",
        status: "bad",
        statusLabel: "zatvoreno bez tokena",
        note: "Vlasništvo: samo pojedinačni uvid po čestici, nema skupnog otvorenog pristupa.",
      },
      {
        name: "Središnji registar državne imovine",
        desc: "Registar je pod Otvorenom dozvolom, ali objavljen samo kao HTML tražilica (imovina po k.o. i broju čestice) — bez strojno čitljivog geo-preuzimanja.",
        endpoints: ["https://registarimovine.gov.hr/web/guest/javni-preglednik"],
        format: "HTML tražilica",
        license: "Otvorena dozvola (podaci), bez geo-izvoza",
        coverage: "—",
        status: "warn",
        statusLabel: "polu-zatvoreno",
      },
    ],
  },
  {
    title: "Zelenilo i okoliš",
    intro: "Slojevi koji stvarno razlučuju detalje unutar kvarta (≤10 m).",
    items: [
      {
        name: "Javne zelene površine Grada Splita (INSPIRE WFS/WMS)",
        desc: "Poligoni javnih zelenih površina (travnjaci, živice, cvjetnjaci…) — otvoreni par zelenog katastra. GetFeature vraća GeoJSON MultiPolygone.",
        endpoints: [
          "https://transformiraj.nipp.hr/ows/services/org.5.59bbbf71-e456-4838-8cff-e368eaf92acb_wfs  (lcv:LandCoverUnit)",
        ],
        format: "WFS 2.0 / GeoJSON + WMS",
        license: "otvoreni podaci (data.gov.hr)",
        coverage: "djelomična — obuhvat završava na ~16,486° E (zapadni rub kvarta)",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Zeleni katastar Splita (ArcGIS REST — stabla)",
        desc: "Pravi katastar zelenila na razini pojedinog stabla (Parkovi i nasadi): stabla, grmovi, travnjaci, parkovna oprema. REST servisi su javno indeksirani (KOMUNALNA_INFRASTRUKTURA/KATASTAR, ST_OPCI_PODACI1 s katastarskim česticama).",
        endpoints: ["https://split-gisportal.gdi.net/server/rest/services"],
        format: "ArcGIS REST (MapServer/FeatureServer)",
        license: "nije navedena",
        coverage: "vjerojatno djelomična (održavano javno zelenilo)",
        status: "warn",
        statusLabel: "host nedostupan — pokušati ponovno",
        note: "Poslužitelj je tijekom istraživanja odbijao veze s dviju mreža; endpointi su prema Google indeksu javni.",
      },
      {
        name: "Copernicus HRL — gustoća krošanja i nepropusnost tla (10 m)",
        desc: "Postotak pokrivenosti krošnjama i postotak zabetoniranosti po pikselu od 10 m — „koliko je zelena / koliko popločena moja ulica”.",
        endpoints: [
          "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/WMSServer",
          "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_ImperviousnessDensity_2018/ImageServer/WMSServer",
        ],
        format: "WMS / ArcGIS ImageServer",
        license: "Copernicus, otvoreno uz navođenje",
        coverage: "potpuna, 10 m",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Copernicus Urban Atlas 2018 — Split FUA",
        desc: "Detaljno korištenje zemljišta (~10 m), sloj uličnog drveća i visine zgrada. Splitsko funkcionalno urbano područje (HR005C1) potvrđeno uključuje kvart.",
        endpoints: [
          "https://image.discomap.eea.europa.eu/arcgis/rest/services/UrbanAtlas/UA_UrbanAtlas_2018/MapServer",
        ],
        format: "ArcGIS REST / WMS; GeoPackage uz besplatnu prijavu na land.copernicus.eu",
        license: "Copernicus, otvoreno",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Sentinel-2 NDVI (10 m indeks vegetacije)",
        desc: "Indeks „zelenila” iz satelitskih snimaka — omogućuje i usporedbe prije/poslije.",
        format: "raster (Google Earth Engine ili Sentinel Hub, potreban račun)",
        license: "Copernicus, otvoreno",
        coverage: "potpuna, 10 m",
        status: "warn",
        statusLabel: "traži račun",
      },
      {
        name: "CORINE Land Cover 2018",
        desc: "Paneuropski pokrov zemljišta — 100 m / jedinice od 25 ha, pregrub za kvart; Urban Atlas je bolji izbor.",
        endpoints: [
          "https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer",
        ],
        format: "WMS",
        license: "Copernicus, otvoreno",
        coverage: "potpuna, ali gruba",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Hrvatske šume — šumske gospodarske jedinice",
        desc: "Jedinice državnih šuma na brdima oko kvarta; unutar urbanog dijela malo sadržaja.",
        endpoints: ["https://gis.hrsume.hr/geoserver/hrsume/wms  (usp, sum, gj, odj, ods)"],
        format: "WMS",
        license: "javni servis",
        coverage: "djelomična",
        status: "ok",
        statusLabel: "provjereno",
      },
    ],
  },
  {
    title: "Infrastruktura i mobilnost",
    items: [
      {
        name: "OpenStreetMap (Overpass) — izmjereno u kvartu",
        desc: "Stvarno stanje OSM-a u bboxu (8. 7. 2026.): 2.770 cestovnih segmenata (uklj. 693 pješačke staze), 4.858 zgrada, 339 sadržaja (109 parkirališta, 28 kafića, 9 škola…), 97 elektro-objekata (56 stupova, 17 trafostanica, 110 kV vodovi), 12 hidranata, 808 poligona namjene; JANAF naftovod prolazi područjem.",
        endpoints: ["https://overpass-api.de/api/interpreter"],
        format: "Overpass QL → JSON/GeoJSON",
        license: "ODbL (obavezna atribucija)",
        coverage: "vrlo dobra za ceste/zgrade/POI/struju",
        status: "ok",
        statusLabel: "provjereno",
        note: "U OSM-u ovdje NEMA: vodovoda, kanalizacije, javne rasvjete ni telekom vodova (0 objekata).",
      },
      {
        name: "Promet Split — GTFS, stajališta i živa vozila",
        desc: "Nedokumentirani ali funkcionalni API: GTFS paket, svih 1.589 stajališta s koordinatama (112 unutar kvarta — Bilice Zatvor, Brda okretište, Bašini, Čučini…) i pozicije autobusa uživo.",
        endpoints: [
          "https://api.promet-split.hr/Fleet/api/v1/gtfs/latest → …/gtfs/download/{id}",
          "https://api.promet-split.hr/Fleet/api/v1/stop/all  ·  …/live/vehicles  (uz besplatni session cookie)",
        ],
        format: "GTFS (zip) + REST/JSON",
        license: "⚠ nije objavljena — javno dostupno, ali zahtjev za otvaranjem GTFS-a odbijen 2023.",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "HAKOM — dostupnost širokopojasnog interneta",
        desc: "Poligoni dostupnih brzina fiksnog interneta (7 razreda do 10 Gbit), pokrivenost mobilnim mrežama, objedinjeni plan gradnje svjetlovodne mreže i EMP mjerenja. 93 poligona razreda 30–100 Mbit siječe kvart.",
        endpoints: [
          "https://ekarta.hakom.hr/server/rest/services  → DOSTUPNOST_SPP/Dostupnost_SPP (slojevi 91–97)",
        ],
        format: "ArcGIS REST (upiti vraćaju GeoJSON)",
        license: "nije navedena (javni preglednik regulatora)",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Hrvatske ceste — javne ceste (WMS + WFS)",
        desc: "Osi javnih cesta (državne/županijske/lokalne) — korisno i za utvrđivanje nadležnosti nad pojedinom cestom. Uz WMS radi i WFS 2.0 s pravom vektorskom geometrijom: tipovi Road, RoadLink, RoadLinkSequence i RoadNode; 22.940 RoadLinkova u RH, 128 unutar bboxa kvarta.",
        endpoints: [
          "https://geoportal.hrvatske-ceste.hr/inspire/tn-ro/wms  (TN.RoadTransportNetwork.RoadLink)",
          "https://geoportal.hrvatske-ceste.hr/inspire/tn-ro/wfs  (GML 3.2, EPSG:3765)",
        ],
        format: "WMS + WFS 2.0 / GML 3.2",
        license: "INSPIRE javni servis",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
        note: "WFS obavezno tražiti u izvornom EPSG:3765 — pri izlazu u EPSG:4326 ili 4258 poslužitelj zaokružuje koordinate na 2 decimale (~1 km), što je neupotrebljivo. Reprojekcija se radi lokalno. Nema GeoJSON izlaza, samo GML. Stranica vraća najviše 50 objekata po upitu (startIndex za listanje).",
      },
      {
        name: "Ookla Speedtest otvoreni podaci",
        desc: "Izmjerene (ne deklarirane) brzine interneta po pločicama od ~610 m, kvartalno, fiksno + mobilno — provjera stvarnosti uz HAKOM-ove poligone dostupnosti.",
        endpoints: [
          "https://ookla-open-data.s3.amazonaws.com/parquet/performance/…",
        ],
        format: "Parquet / Shapefile",
        license: "CC BY-NC-SA 4.0 (nekomercijalno)",
        coverage: "pločice gdje postoje mjerenja",
        status: "ok",
        statusLabel: "provjereno",
      },
    ],
  },
  {
    title: "Hazardi, klima i onečišćenje",
    items: [
      {
        name: "Hrvatske vode — karte opasnosti i rizika od poplava",
        desc: "Službene karte opasnosti (velika/srednja/mala vjerojatnost) i rizika od poplava — bujični koridori oko Splita vidljivi su u kvartu.",
        endpoints: [
          "https://servisi.voda.hr/poplave_opasnosti/wms",
          "https://servisi.voda.hr/poplave_rizici/wms",
        ],
        format: "WMS (podržava EPSG:3857)",
        license: "javni državni servis",
        coverage: "djelomična (koridori gdje opasnost postoji)",
        status: "ok",
        statusLabel: "provjereno",
        note: "Samo raster: WFS na istom hostu je izričito ugašen (odgovara „Service WFS is disabled”), pa se poligoni opasnosti ne mogu dobiti kao vektor.",
      },
      {
        name: "Landsat 8/9 — površinska temperatura (toplinska karta)",
        desc: "Ljetna kompozitna temperatura površine 30–100 m — pokazuje koje se ulice i blokovi pregrijavaju. Gotov sloj za Split ne postoji, izrađuje se jednokratno iz otvorenih Landsat podataka.",
        format: "raster (Landsat Collection 2, kanal ST_B10; obrada u npr. Google Earth Engineu)",
        license: "USGS javna domena",
        coverage: "potpuna, 30–100 m",
        status: "warn",
        statusLabel: "traži izradu",
      },
      {
        name: "Kvaliteta zraka — državna mreža + EEA",
        desc: "Najbliže postaje su u gradu Splitu (~3–6 km): Split-1/2/3 i Poljud — kontekst na razini grada. Hrvatski portal nema javni API (interni JSON + Excel izvoz, ograničenja); iste postaje dostupne su i kroz EEA Parquet servis.",
        endpoints: [
          "https://iszz.azo.hr/iskzl/  (izvoz)",
          "https://eeadmz1-downloads-api-appservice.azurewebsites.net/  (EEA Parquet, country=HR)",
        ],
        format: "HTML/Excel izvoz · Parquet REST",
        license: "otvoreno uz navođenje",
        coverage: "samo najbliže postaje",
        status: "warn",
        statusLabel: "bez čistog API-ja",
      },
      {
        name: "Solarni potencijal — PVGIS + Global Solar Atlas",
        desc: "PVGIS API vraća osunčanost i procjenu prinosa fotonapona za bilo koju točku (provjereno za koordinate Splita). Global Solar Atlas nudi GHI/PVOUT rastere (~250 m — gotovo ujednačeno preko kvarta).",
        endpoints: [
          "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=43.52&lon=16.49&peakpower=1&loss=14&outputformat=json",
          "https://globalsolaratlas.info/download/croatia  (GeoTIFF)",
        ],
        format: "REST/JSON · GeoTIFF",
        license: "PVGIS: EU, uz navođenje · GSA: CC BY 4.0",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "DHMZ — vrijeme uživo",
        desc: "XML sa svim hrvatskim postajama (Split Marjan ~5 km zapadno). Otvorene mrežne klimatologije (normale) ne postoje; za kontekst oborina postoji CHELSA (CC0, ~1 km).",
        endpoints: ["https://vrijeme.hr/hrvatska_n.xml"],
        format: "XML",
        license: "Otvorena dozvola",
        coverage: "najbliža postaja",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Seizmički hazard (ESHM20) i industrijske emisije (E-PRTR)",
        desc: "ESHM20 daje jednu PGA vrijednost za cijeli Split (~10 km mreža). E-PRTR popisuje velike industrijske onečišćivače kao točke — u samom kvartu ih gotovo nema.",
        format: "web servisi + GeoPackage/CSV",
        license: "CC BY 4.0 · EEA otvoreno",
        coverage: "regionalni kontekst",
        status: "warn",
        statusLabel: "kontekst",
      },
      {
        name: "Strateška karta buke Splita",
        desc: "Listovi Lden/Lnight iz projekta 2009.–2011. dostupni kao PDF; krug iz 2022. izrađen je, ali nikad javno objavljen, a EEA mozaik buke nema podataka za Split.",
        endpoints: ["https://split.hr/lgs.axd?t=16&id=2673 … 2681  (PDF listovi)"],
        format: "PDF (bez georeference)",
        license: "javni gradski dokument",
        coverage: "gradsko područje (podaci 2011.)",
        status: "warn",
        statusLabel: "samo stari PDF-ovi",
      },
    ],
  },
  {
    title: "Stanovništvo i zgrade",
    items: [
      {
        name: "Eurostat Census Grid 2021 (1 km, pravi popis)",
        desc: "Stvarno stanovništvo Popisa 2021. (dob, spol, zaposlenost) po ćelijama od 1 km — kvart pokriva ~12–16 ćelija. Najbolji stvarni (nemodelirani) otvoreni podaci ispod razine naselja.",
        endpoints: [
          "https://gisco-services.ec.europa.eu/census/2021/Eurostat_Census-GRID_2021_V2.2.zip",
        ],
        format: "GeoPackage + CSV (EPSG:3035)",
        license: "Eurostat, uz navođenje",
        coverage: "potpuna (1 km)",
        status: "ok",
        statusLabel: "provjereno",
        note: "Za finiji uzorak od 100 m postoji GHS-POP (modeliran, © EU).",
      },
      {
        name: "Overture Maps — zgrade i sadržaji",
        desc: "Mjesečna izdanja: zgrade (spoj OSM + Microsoft, dijelom s visinama) i POI podaci šireg opsega od OSM-a.",
        endpoints: ["s3://overturemaps-us-west-2/release/  (GeoParquet, mjesečno)"],
        format: "GeoParquet",
        license: "zgrade ODbL · mjesta CDLA-Permissive-2.0",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
      {
        name: "Visinske pločice (AWS Terrarium)",
        desc: "Globalne visine kodirane u RGB pločicama — pločica nad kvartom dohvaćena bez problema; ~30–90 m razlučivost.",
        endpoints: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        format: "XYZ raster (terrarium kodiranje)",
        license: "otvoreno, uz navođenje izvora",
        coverage: "potpuna",
        status: "ok",
        statusLabel: "provjereno",
      },
    ],
  },
];

export const DEAD_ENDS: { name: string; reason: string }[] = [
  { name: "ViK Split (vodovod i kanalizacija)", reason: "GIS je interni; „Moj ViK” služi samo računima, a gradski prikaz mreže vuče iz zaštićenih servisa." },
  { name: "HEP ODS (elektro-mreža)", reason: "nema otvorene karte mreže; prekidi samo kao HTML popisi bez koordinata. Jedini otvoreni sloj struje su OSM-ova 97 objekta." },
  { name: "OSM: vodovod, kanalizacija, rasvjeta, telekom", reason: "0 objekata ucrtano u kvartu." },
  { name: "OSS katastar bez tokena i skupno vlasništvo", reason: "namjerno zatvoreno; javno je samo pojedinačno pretraživanje čestica." },
  { name: "ArcGIS Online servisi Grada Splita (uklj. gradsku imovinu)", reason: "javno izlistani, ali svi FeatureServeri traže token (499)." },
  { name: "Grad Split na data.gov.hr", reason: "3 skupa podataka, nijedan prostorni; data.split.hr ne postoji." },
  { name: "Karta buke Splita — krug 2022.", reason: "izrađena, nikad objavljena; EEA mozaik nema podataka za Split." },
  { name: "ISPU vektorski planovi / eDozvola javni WMS", reason: "404 — javni su samo rasterski listovi." },
  { name: "Google Open Buildings", reason: "ne pokriva Europu." },
  { name: "DZS GeoSTAT preglednik", reason: "bez API-ja/WMS-a/preuzimanja; koristiti Eurostat mrežu." },
  { name: "nPerf", reason: "vlasnički podaci, bez otvorenog pristupa." },
  { name: "WorldClim", reason: "NC licenca bez redistribucije — koristiti CHELSA (CC0)." },
];
