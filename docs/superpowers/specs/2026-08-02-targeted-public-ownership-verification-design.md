# Ciljana provjera javnog vlasništva — specifikacija dizajna

- **Status:** Odobren dizajn
- **Datum:** 2026-08-02
- **Površina:** lokalni generator i `/karta`
- **Izvori:** lokalni katastar i GUP, javni OSS Uređena zemlja, službeni registar javnih tijela i gradskih društava

## Odluka

Postojeća djelomična evidencija iz gradskog SHP izvoza dopunjuje se ciljanom,
ponovljivom provjerom vlasništva za dvije skupine čestica:

1. svih 18 čestica koje sijeku potvrđeni istočno-zapadni prometni koridor na
   sjevernom rubu Dračevca;
2. svih 14 čestica površine najmanje 10.000 m² unutar postojećeg obuhvata
   projekta.

Skupine se preklapaju na dvije čestice, pa početni skup ima 30 jedinstvenih
čestica. Brojevi su kontrolne vrijednosti za trenutačni GIS izvoz, a generator
mora prijaviti promjenu ulaza umjesto da je neprimjetno prihvati.

Provjera se pokreće isključivo lokalno. Za svaku ciljanu česticu prati se veza
od geometrije i OSS identifikatora čestice do katastarskog zapisa i pripadajućeg
zemljišnoknjižnog uloška. U javni artefakt ulaze samo klasifikacija, prepoznata
javna pravna osoba i tehnički podaci potrebni za prikaz. Sirovi odgovori i
podaci fizičkih osoba nikada se ne spremaju u repozitorij niti šalju klijentu.

## Ciljevi

1. Pronaći javno vlasništvo koje nedostaje u gradskom SHP statusu, osobito na
   koridoru ceste i velikim zemljišnim cjelinama.
2. Razlikovati zemljišnoknjižni dokaz, slabiji katastarski dokaz i neriješene
   slučajeve.
3. Prepoznati Grad Split, RH, županiju i službeno popisana gradska društva i
   ustanove bez slobodnog zaključivanja iz imena.
4. Omogućiti filtriranje rezultata prema vlasniku, namjeni, evidentiranom
   tlocrtu, ciljnoj skupini i statusu provjere.
5. Ostaviti jasan, lokalni revizijski trag bez osobnih podataka.

## Izvan opsega

- automatska provjera svih 1.292 čestica u projektu;
- dohvaćanje vlasništva iz javnog preglednika pri otvaranju `/karta`;
- objava imena, adrese, OIB-a, udjela ili tereta fizičkih osoba;
- tvrdnja da `private_or_other` znači da je čestica sigurno privatna;
- tvrdnja da katastarski posjednik ima istu dokaznu snagu kao ZK vlasnik;
- automatsko razrješavanje neusklađenih brojeva čestica bez provjere veze koju
  vraća OSS;
- pravna interpretacija vlasništva, mogućnosti gradnje ili izvlaštenja.

## Definicija ciljnog skupa

### Prometni koridor

Odabrani koridor sprema se kao mali, verzionirani GeoJSON izrez iz
`gup-2024-promet.geojson`. Sastoji se od šest povezanih poligona nacrta GUP-a
2024. oko koordinata 43.52835, 16.49615. Ciljane čestice dobivaju se prostornim
presjekom s `public/geo/grad/katastar.geojson`; dodir samo u točki ili duž ruba
ne računa se. Minimalna površina presjeka je 1 m², čime se odbacuje i slučajni
rubni presjek `SPLIT:280/4` od približno 0,68 m².

Trenutačna kontrolna lista sadrži:

`SPLIT:264/1`, `SPLIT:264/2`, `SPLIT:264/3`, `SPLIT:268/1`, `SPLIT:273/1`,
`SPLIT:273/3`, `SPLIT:273/4`, `SPLIT:273/5`, `SPLIT:275/3`, `SPLIT:276/1`,
`SPLIT:276/2`, `SPLIT:279/5`, `SPLIT:279/7`, `SPLIT:280/6`, `SPLIT:280/7`,
`SPLIT:281/1`, `SPLIT:281/2` i `SPLIT:13902/1`.

### Velike čestice

Druga skupina obuhvaća čestice kojima izvorni atribut pune površine čestice
ima vrijednost `povrsina >= 10000` u istom projektnom obuhvatu. Geometrije su
na rubu projekta mjestimice izrezane, pa izračun površine prikazane geometrije
ne smije izbaciti veliku česticu čiji je samo manji dio u obuhvatu. Generator
zasebno računa prikazanu površinu i prijavljuje neuobičajeno odstupanje od pune
površine. Prag je konfiguracijska konstanta i zapisuje se u manifest.

Svaki cilj nosi `cohorts: [road_corridor | large_parcel]`; čestica može biti u
obje skupine.

## Tok provjere vlasništva

Generator obrađuje konačni skup uz najviše tri paralelna zahtjeva, ograničeno
ponavljanje i vremenska ograničenja:

1. Iz geometrije izrađuje centroid, sigurnu unutarnju točku i nekoliko
   determinističkih rezervnih točaka.
2. Preko OSS WMS `GetFeatureInfo` sloja `oss:BZP_CESTICE` traži aktualni
   `CESTICA_ID`. Rezultat prihvaća samo ako se katastarska općina i broj mogu
   povezati s ciljnom česticom; inače zapis ide na ručni pregled.
3. Poziva `/oss/public/cad/parcel-info?parcelId=...` i koristi vezu prema
   `lrUnitNumber` i `mainBookId` koju je vratio OSS. Broj uloška ili čestice ne
   nagađa se iz lokalnog SHP-a.
4. Ako veza postoji, dohvaća `/oss/public/lr/lr-unit` i vlasnike iz lista B.
5. Samo kada ZK veza ne postoji, koristi katastarske posjednike kao izričito
   slabiji rezervni dokaz.
6. Svakog nositelja uspoređuje sa verzioniranim registrom javnih subjekata po
   normaliziranom nazivu i, kada je službeno dostupan, OIB-u. Neuspoređeni
   nositelji ostaju `other`; privatni identitet se odmah odbacuje iz izvedenog
   zapisa.

Sirovi mrežni odgovori mogu se privremeno spremiti samo u ignorirani lokalni
cache radi nastavka prekinutog rada. Cache se ne kopira u `public/`, testne
fixtureove, zapisnik naredbe ni Git.

## Registar javnih subjekata

Registar je mali verzionirani podatkovni dokument s izvorom, datumom provjere,
kanonskim nazivom, dopuštenim varijantama naziva, kategorijom i javno
objavljenim identifikatorom gdje postoji. Početne kategorije su:

- `city` — Grad Split i druge jedinice lokalne samouprave;
- `state` — Republika Hrvatska i izričito navedena državna tijela;
- `county` — Splitsko-dalmatinska županija;
- `municipal_company` — službeno popisana gradska društva;
- `public_institution` — službeno popisane gradske ustanove;
- `other_public` — drugi javni subjekt uz zaseban službeni izvor.

Slobodni regex nad imenom nije dokaz. Nova varijanta imena mora imati ručnu
potvrdu i izvor u registru.

## Klasifikacija

Svaka ciljana čestica dobiva jedan status:

| Status | Pravilo |
| --- | --- |
| `confirmed_public` | ZK list B postoji i svi pronađeni nositelji odgovaraju registru javnih subjekata. |
| `mixed_public` | ZK list B sadrži najmanje jednog javnog i najmanje jednog drugog ili neprepoznatog nositelja. |
| `cadastre_public` | Nema razrješive ZK veze, a svi katastarski posjednici odgovaraju javnom registru; prikazuje se kao slabiji dokaz. |
| `private_or_other` | Razrješivi ZK zapis nema prepoznatog javnog nositelja; ne objavljuje se tko je nositelj. |
| `unresolved` | Nema pouzdane veze, podaci su prazni/proturječni ili je obrada trajno pogriješila. |

Prazan popis vlasnika nikada nije dokaz državnog vlasništva. `mixed_public` ne
pretpostavlja udio javnog vlasništva ako ga parser nije mogao sigurno sažeti.

## Javni podatkovni ugovor

Generator zapisuje sanitizirani
`public/geo/analiza/ciljana-provjera-vlasnistva.geojson` i manifest sa
sažecima. Svojstva značajke su:

| Polje | Tip | Značenje |
| --- | --- | --- |
| `parcel_id` | string | `KO:broj` iz lokalnog sloja |
| `parcel_number` | string | broj čestice |
| `cadastral_municipality` | string | katastarska općina |
| `cohorts` | string[] | koridor, velika čestica ili oboje |
| `verification_status` | enum | jedna od pet klasifikacija |
| `evidence_source` | `land_register \| cadastre \| none` | najjači korišteni dokaz |
| `public_entities` | `{id,label,category}[]` | samo prepoznati javni subjekti |
| `purpose_primary_code` | string \| null | dominantna namjena nacrta GUP-a 2024. |
| `purpose_primary_label` | string \| null | razumljiv naziv namjene |
| `built` | boolean | postoji li evidentirani tlocrt ≥1 m² |
| `parcel_area_m2` | number | puna površina čestice iz izvornog atributa |
| `mapped_area_m2` | number | površina geometrije prikazane u obuhvatu |
| `verified_at` | ISO datum \| null | datum uspješne provjere |
| `source_updated_at` | ISO datum | datum lokalnog GIS izvora |

Strogi validator dopušta samo navedena polja i odbija ključeve ili vrijednosti
koje izgledaju kao privatno ime, adresa, OIB, teret, pravo ili sirovi OSS
odgovor. Javni identifikatori ostaju isključivo u registru i ne moraju se
slati pregledniku.

## Prikaz na karti

Postojeće pitanje **„Što je javno evidentirano?”** dobiva zaseban preklopni
sloj **„Ciljana provjera vlasništva”**. Kada je uključen, panel prikazuje:

1. sažetak 30 ciljanih čestica i datum zadnje provjere;
2. status provjere: potvrđeno javno, mješovito, katastarski javno, drugo ili
   neriješeno;
3. javni subjekt/kategoriju, bez privatnih imena;
4. ciljnu skupinu: koridor ceste ili velika čestica;
5. postojeće filtre namjene GUP-a 2024. i evidentiranog tlocrta.

`confirmed_public` ima najizraženiju javnu ispunu, `mixed_public` crtkani
obrub, `cadastre_public` blažu ispunu i oznaku slabijeg dokaza, a
`private_or_other` i `unresolved` neutralne stilove. Boja nije jedini nositelj
značenja. Klik na česticu otvara dosje sa statusom, javnim subjektom, izvorom
dokaza, datumom i ogradom. Privatni nositelj nikada se ne prikazuje.

Kopija jasno kaže da je ovo **ciljana provjera 30 čestica**, ne cjelovit popis
javne imovine.

## Ručni pregled i pogreške

Generator izrađuje lokalni izvještaj samo s brojem čestice, fazom kvara i
razlogom bez osobnih podataka. Ručni pregled obavezan je za:

- neusklađen broj ili katastarsku općinu;
- više mogućih OSS identifikatora;
- više ZK uložaka bez jasne veze;
- `mixed_public`, katastarski rezervni dokaz i neprepoznatu pravnu osobu;
- prazne vlasničke listove i trajne mrežne pogreške.

Ponovno pokretanje nastavlja iz lokalnog cachea, ali završni artefakt nastaje
tek nakon validacije svih 30 ciljeva. Neriješeni cilj ostaje vidljiv kao
`unresolved`; ne nestaje iz rezultata.

## Prihvatni kriteriji

1. Prostorni odabir uz prag presjeka od 1 m² daje 18 koridorskih čestica, a
   izvorna puna površina daje 14 velikih čestica, odnosno 30 jedinstvenih
   ciljeva na trenutačnom izvoru.
2. Pilot slučajevi `SPLIT:273/1` i `SPLIT:281/1` završavaju kao javni i više
   nisu skriveni samo zato što SHP nema status.
3. Nijedan privatni identitet, adresa, OIB, teret ili sirovi OSS zapis nije u
   Git diffu, javnom GeoJSON-u, testovima, konzolnom ispisu ni klijentskom
   odgovoru.
4. Svaki status je deterministički izveden prema gornjoj tablici i ima
   najjači korišteni izvor dokaza.
5. Prekid mreže se može sigurno nastaviti; ograničenje paralelizma ne zagušuje
   OSS mapu.
6. Karta filtrira stvarno nacrtane rezultate prema statusu, javnom subjektu,
   skupini, namjeni i tlocrtu te radi na desktopu i telefonu.
7. Panel i dosje razlikuju ZK dokaz, katastarski dokaz i neriješen slučaj.
8. Testovi, lint, provjera slojeva, produkcijski build i Ego Browser pregled
   prolaze prije commita javnog artefakta.
