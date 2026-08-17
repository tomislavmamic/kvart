# Podloge, vremeplov i reljef — specifikacija dizajna

- **Status:** za izvedbu
- **Datum:** 2026-08-14
- **Površina:** `/karta` (podloga, dosje), `/podaci`
- **Izvor:** DGU geoportal (WMS) i DGU LiDAR DMR (WCS), `.cache/dmr.tif`

## Odluka

Podloga prestaje biti popis od tri stavke i postaje **tri pitanja o tome na
čemu se gleda**: što je danas, što je bilo, i kakav je teren. Uz to karta
dobiva dvije stvari koje se iz podloge izvode, a nisu podloga: **vremeplov**
(rez između dviju godina snimke) i **reljef u dosjeu** (visina, nagib,
ekspozicija za kliknutu točku).

Provjereno 14. 8. 2026. stvarnim `GetMap` upitom nad kvartom — sve tri nove
podloge vraćaju sadržaj, ne prazninu:

| Servis | Sloj | Rezultat |
|---|---|---|
| `geoportal.dgu.hr/services/dof/wms` | `DOF5_2011` | 510 kB, snimka |
| `geoportal.dgu.hr/services/tk/wms` | `TK25` | 170 kB, karta s toponimima |
| `geoportal.dgu.hr/services/dmr/wms` | `Hillshade` | 315 kB, sjenčani reljef |
| `.../services/dof/wms` | `DOF05_VPI_2024` | 13 kB — **prazno nad kvartom, odbačeno** |

Sjenčani reljef se **ne uzima s WMS-a** nego se izrađuje iz DMR-a koji je već
skinut (`.cache/dmr.tif`, 6 × 5 km, 1 m, Float32). Razlog nije estetika: DGU-ov
anonimni pristup nosi vodeni žig „GEOPORTAL” preko sredine svake pločice, a
reljef je jedina podloga na kojoj se gleda sitan oblik terena — potporni zid,
usjek ceste, rub kamenoloma — pa žig preko sredine pojede upravo ono zbog čega
se sloj pali. Kod snimaka žig ostaje, jer ondje nema izbora i jer ga zatečena
podloga (DOF 2023) ionako već nosi; to nije nazadovanje nego zatečeno stanje.

## Ciljevi

1. Susjed može vidjeti **svoju ulicu 2011. i danas**, jednim povlačenjem.
2. Susjed može doznati **na kojoj je visini i koliko strma** njegova čestica,
   iz istog klika kojim već otvara dosje.
3. Reljef se vidi **bez zgrada** — DMR je bare-earth — pa se ispod radne zone
   čita stari krajobraz: terase, suhozidi, usjeci, nasipi.
4. Ništa od toga ne smije pogoršati prizor iz `PRODUCT.md`: telefon, slaba
   veza, jedna ruka.

## Što se NE radi, i zašto

- **Nema klizača kroz niz godina.** Provjerene su tri epohe (HOK ~1970-e,
  DOF 2011., DOF 2023.), neravnomjerno razmaknute. Klizač kroz njih obećava
  gustoću podataka koje nema, a to je izravno protiv „ništa bez izvora”.
  Vremeplov je zato **rez između dvije odabrane godine**, ne vremenska crta.
- **Nema Sentinela-2.** 10 m po pikselu ne opisuje česticu.
- **Nema Habsburških karata (Mapire/Arcanum).** Pločice vraćaju 403 na svaki
  zahtjev koji nije preglednik, a licencija nije razriješena.
- **Nema ponikvi ni depresija.** Već provjereno u `izvedi-tokove.py`: svih 15
  u kvartu dodiruje cestu, devet se do 95 % preklapa sa zgradama — to su rupe
  u interpolaciji, ne krški oblici.
- **Nema sloja „tijelo odlagališta Karepovac”.** Ovo je bilo u opsegu i
  ispalo iz njega, pa razlog stoji zapisan: **za granicu odlagališta nema
  izvora.** Pretraženi su `public/geo/`, gradski GIS izvoz i vektorizirani
  planovi — Karepovac se pojavljuje isključivo kao toponim i kao ime ulice,
  nigdje kao ploha. Izvesti granicu iz oblika terena (visina iznad okolne
  ovojnice) dalo bi poligon koji izgleda službeno, a nije ničiji podatak nego
  naš prag. To je točno ono što `PRODUCT.md` zabranjuje: „Ništa bez izvora…
  Nikad ne izmišljaj broj, status, citat.”

  Ono što je od te zamisli **ostalo, i mjereno je**: tijelo se na karti vidi
  samo od sebe. Izohipse ga crtaju kao niz zatvorenih krivulja, a sjenčani
  reljef kao nasip — bez ijedne tvrdnje o tome što to jest i dokle seže.
  Visinski odnos kvarta i Karepovca čita se iz dosjea, iz izmjerenih brojeva.
- **Simulirana karta disperzije na `/karepovac` se ne dira.** Ona je izrijekom
  simulacija; ubaciti u nju stvarni reljef značilo bi pomiješati izmjereno i
  izmišljeno.

## Podloge

`BaseLayer` dobiva `skupina`, i time ploča „Podloga i plan” dobiva naslove.
Šest ravnopravnih čipova bez podjele je isti kvar koji je već jednom riješen
u traci pogleda (vidi `razina` u `MapView`).

| Skupina | Podloga | Izvor |
|---|---|---|
| **Danas** | Ortofoto (DOF 2023) | DGU INSPIRE — zatečeno, ostaje zadano |
| | Ulična karta | CARTO / OSM — zatečeno |
| **Nekad** | Ortofoto 2011. | DGU `dof/wms`, `DOF5_2011` — **novo** |
| | Topografska karta (TK25) | DGU `tk/wms`, `TK25` — **novo** |
| | Stara topografska karta (HOK 1:5000) | zatečeno, seli iz korijena u „Nekad” |
| **Reljef** | Sjenčani reljef (LiDAR) | vlastite pločice iz DMR-a — **novo** (`sjencanje`) |

Id nove podloge je `sjencanje`, a ne `reljef`: `reljef` je već zauzet
poluprozirnim preklopnikom iste stvari u skupini „Krajobraz”. Oboje ostaje —
kao podloga se teren gleda sam, kao preklopnik se gleda što na njemu stoji —
ali istim imenom za dvoje bi se prva sljedeća izmjena spotakla. Preklopnik uz
to prestaje ići na DGU-ov WMS i uzima naše pločice, čime i ondje nestaje žig.

TK25 ulazi zbog jedne stvari koju nijedna druga podloga u registru nema:
**toponime**. Turnjevac, Karepovac, Sv. Spas, Meterize — imena kojima susjedi
zovu mjesta, a kojih na ortofotu i u katastru nema.

## Vremeplov

Rez između dviju podloga, s pomičnim razdjelnikom. Mehanika **već postoji** —
klizač usporedbe dviju godina GUP-a (`sbs-lijevo` / `sbs-desno` okna, `clip`,
razdjelnik s punom tipkovničkom podrškom po WCAG 2.1.1). Umjesto druge kopije
tih 120 redaka, kod se vadi u `src/lib/karta-klizac.ts` i koriste ga oba.

- Podloge idu u vlastita okna `podloga-lijevo` / `podloga-desno`.
- Zadano: lijevo **2011.**, desno **2023.** — razdoblje u kojem je radna zona
  i nastala.
- Vremeplov i klizač namjene **isključuju se međusobno**. Dva razdjelnika na
  istoj karti nisu usporedba nego zbrka, a i `aria-valuetext` bi lagao.
- Adresa: `vremeplov=dof-2011,dof`. Bez parametra nema vremeplova.

## Reljef

Jedna skripta, `scripts/izvedi-reljef.py`, iz istog DMR-a koji već koristi
`izvedi-tokove.py` (zajednički dohvat seli u `scripts/dmr.py`). Izlazi:

### 1. Pločice sjenčanog reljefa — `public/geo/reljef/{z}/{x}/{y}.png`

Zumovi 12–17. Na z17 je 0,87 m po pikselu, dakle točno izvorna gustoća DMR-a;
z18 i z19 bi bili napuhani isti podatak, pa se dobivaju `maxNativeZoom: 17` i
Leafletovim rastezanjem. To nije ušteda nego istina o razlučivosti.
Izrađeno: **585 pločica, 12,9 MB** (sive s alfom, ne RGBA — sjenčanje je sivo,
pa bi tri jednaka kanala isti bajt nosila tri puta).

### 2. Izohipse — `public/geo/izohipse.geojson`

2 m ekvidistancija. Sirovi LiDAR na 1 m daje 21.437 crta i 6,4 MB nečitljive
kaše — svaki potporni zid postane zatvorena krivulja. DMR se zato prije
crtanja **zagladi na ~9 m**, a crte se **režu na kvart + 120 m**, isto kao svi
ostali vektorski slojevi (BUFFER_KM u `clip-lib.ts`). Rezultat: **161 crta
(26 glavnih), 0,11 MB**, raspon 12–108 m n.v.

Rezanje nije sitnica nego glavnina veličine. Reljef se računa na cijelom
obuhvatu karte, jer sjenčanje i mreža visina to trebaju, i prva izvedba je
izohipse ostavila jednake — 18,0 km² crta za kvart od 1,7 km², dakle deset
puta više nego što itko gleda. Kod pločica to ne bi smetalo, jer se dohvaća
samo ono u oknu, ali izohipse su JEDNA datoteka koju preglednik povuče
cijelu, pri svakom učitavanju: 1,24 MB → 0,11 MB.

Tokovi su svjesna iznimka od rezanja (ista bujica ne postaje drugi objekt kad
prijeđe granicu). Izohipsa nema takav razlog — teren izvan kvarta ne
objašnjava ništa o kvartu. Zaglađivanje se navodi na sloju: izohipsa je ovdje
crta za čitanje karte, ne geodetski podatak.

### 3. Mreža visina — `public/geo/reljef/visine.bin.gz` + `visine.json`

`int16` decimetri, korak ~3 m, po `MAP_MAX_BOUNDS`, u pravilnoj lon/lat mreži.
1641 × 1225 ćelija = 4,0 MB sirovo, 1,6 MB gzipano u gitu; poslužitelj ga
raspakira jednom i drži u memoriji, isto kao GeoJSON slojeve dosjea.

Korak 3 m nije popuštanje nego izbor: nagib računat na 1 m LiDAR-u mjeri šum
snimke, a ne teren. Lon/lat mreža umjesto EPSG:3765 zato što je onda očitanje
aritmetika, bez reprojekcije po kliku.

## Reljef u dosjeu

Dosje dobiva `teren`: nadmorska visina, nagib u postocima, ekspozicija (strana
svijeta), a za česticu i raspon visina. Stoji uz namjenu, ne među temama —
kao i `zapreke`, to je svojstvo zemljišta, a ne nešto što se na njemu zateklo.

Ako točka padne izvan mreže, `teren` je `null` i dosje o njemu šuti. Odsutnost
se izriče, ne popunjava.

## Što je vađenje klizača usput otkrilo

Dva kvara koja su ondje stajala od prije, oba nevidljiva pri isprobavanju
rukom jer se drška obično hvata mišem i pušta:

1. **Klik na dršku otvarao je dosje.** Drška je dijete Leafletova spremnika,
   pa joj je `click` dobubblao do karte. Povučeš razdjelnik — otvori se ploča
   čestice koja se zatekla pod njim, preko pola zaslona.
2. **Drška nije zadržavala fokus nakon hvatanja mišem.** `preventDefault` na
   `pointerdown` (ondje je zbog označavanja teksta) usput ukida i dodjelu
   fokusa, a Leaflet na `mousedown` fokus uzima za sebe. Tko dršku uhvati
   mišem pa htjedne dovršiti strelicama, tipkao je u prazno. Tabom se do nje
   dolazilo, pa je WCAG provjera prolazila.

Oboje je popravljeno u `karta-klizac.ts` i vrijedi za oba klizača.

## Provjere

- `tests/vremeplov.test.ts` — stanje ↔ adresa, zamjena strana, odbacivanje
  nepostojećih i istih podloga.
- `tests/reljef.test.ts` — očitanje mreže (kutovi, izvan obuhvata, bilinearno,
  uz prazninu), nagib i ekspozicija na poznatoj kosini, raspon po poligonu, te
  nad STVARNOM mrežom: obuhvat protiv `MAP_MAX_BOUNDS`, rast prema istoku, i
  more kao praznina umjesto nule.
- `tests/karta-klizac.test.ts` — račun reza u dva koordinatna sustava, korak
  tipke, stezanje na 0–1, i to da tipke koje nisu za klizač vraćaju `null`.
- `tests/podloge.test.ts` — svaka podloga ima skupinu, id-evi su jedinstveni i
  ne sudaraju se s preklopnicima, zadana podloga postoji, svaka nosi
  atribuciju (uvjet dozvole), lokalne pločice imaju `maxNativeZoom`.

Mjereno pri izradi (`npm run izvedi-reljef`): mreža 1641 × 1225, 4,0 MB sirovo
i 1,6 MB na disku; izohipse 161 crta (26 glavnih), 0,11 MB, rezano na kvart
+ 120 m; sjenčanje 585
pločica, 12,9 MB. Očitanje iz mreže protiv izvornog DMR-a na 1.889 nasumičnih
točaka: medijan 0,07 m, 95. percentil 0,60 m, najgore 3,70 m.
