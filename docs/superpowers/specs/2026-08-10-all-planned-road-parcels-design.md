# Sve čestice na planiranim cestama — specifikacija dizajna

- **Status:** Odobren dizajn
- **Datum:** 2026-08-10
- **Površina:** lokalni generator i `/karta`
- **Izvori:** nacrt GUP-a Split 2024., lokalni katastar, postojeća sanitizirana ciljana provjera vlasništva i postojeći sanitizirani GIS izvoz javnih čestica

## Odluka

Karta dobiva zasebno pitanje **„Koje su čestice na planiranim cestama?”**.
Pogled prikazuje svaku katastarsku česticu u postojećem projektnom obuhvatu
koja siječe bilo koji prometni poligon iz nacrta GUP-a 2024. za najmanje
1 m². Na trenutačnim ulazima to je 338 čestica.

Pogled nije popis javne imovine. Svih 338 čestica ostaje vidljivo bez obzira
na to postoji li dokaz o vlasništvu. Vlasnički status dodaje se samo kada ga
već sadrži jedan od dva javna, sanitizirana artefakta u repozitoriju. U ovom
koraku nema novih upita prema OSS-u niti objave privatnih identiteta.

## Ciljevi

1. Pokazati cijeli prostorni utjecaj planiranih prometnih koridora nacrta
   GUP-a 2024. na katastarske čestice u obuhvatu.
2. Omogućiti da se planirani koridor i zahvaćena čestica razumiju na istom
   prikazu.
3. Označiti raspoloživi vlasnički dokaz bez zaključivanja iz nedostatka
   podataka.
4. Jasno prikazati izvor, snagu i moguće neslaganje vlasničkih evidencija.
5. Očuvati zatvorenu javnu shemu bez privatnih imena, adresa, OIB-a, udjela,
   tereta ili sirovih odgovora.

## Izvan opsega

- nova ili masovna provjera vlasništva za 338 čestica;
- dohvaćanje vlasništva pri otvaranju karte;
- prikaz privatnog vlasnika ili drugih osobnih podataka;
- tvrdnja da nepostojanje zapisa znači privatno vlasništvo;
- tvrdnja da gradski GIS ima istu dokaznu snagu kao zemljišna knjiga;
- prometnice iz GUP-a 2015., DPU-a ili postojećeg cestovnog stanja;
- pravna procjena izvlaštenja, gradivosti ili prava prolaza.

## Prostorni obuhvat

Ulaz planiranih prometnica je
`public/geo/planovi/gup-2024-promet.geojson`, koji na trenutačnom izvoru ima
532 poligona. Ulaz čestica je `public/geo/grad/katastar.geojson`, koji ima
1.314 geometrija u projektnom obuhvatu.

Generator za svaku česticu zbraja stvarnu površinu presjeka sa svim prometnim
poligonima. Čestica ulazi u rezultat kada je zbroj najmanje 1 m². Dodir samo
u točki ili po rubu ne ulazi u rezultat. Kontrolna vrijednost je 338 čestica;
promjena broja mora prekinuti generiranje jasnom porukom, osim kada se
izričito dopusti prihvat novog izvora.

Planirani prometni poligoni ostaju zaseban, neinteraktivan sloj ispod obrisa
čestica. Time se vidi odnos koridora i cijele čestice bez rezanja geometrije
čestice na sam presjek.

## Spajanje postojećeg vlasničkog dokaza

Generator spaja podatke po kanonskom ključu `KO:broj čestice` iz:

1. `ciljana-provjera-vlasnistva.geojson`, koja može sadržavati ZK dokaz,
   katastarski dokaz, negativan rezultat ciljane provjere ili neriješen
   rezultat;
2. `javne-cestice.geojson`, gradskog GIS izvoza koji izričito označava javnu
   razinu i oblik vlasništva.

Na trenutačnim ulazima 25 od 338 cestovnih čestica ima zapis ciljane provjere,
35 ih ima javni GIS zapis, a šest je u oba skupa. To daje 54 čestice s barem
jednim raspoloživim vlasničkim zapisom; preostalih 284 dobiva `no_data`.

Najjači raspoloživi dokaz određuje primarni status ovim redom:

1. zemljišna knjiga — potvrđeno javno ili nije potvrđeno javno;
2. katastar — javno prema katastarskom posjedniku;
3. gradski GIS — javno prema GIS izvozu;
4. neriješena ciljana provjera;
5. nema podataka o vlasništvu.

Izvor slabije snage ne nestaje. Ako se gradski GIS i jači ciljani rezultat ne
slažu, značajka dobiva oznaku neslaganja i klik prikazuje oba sanitizirana
zaključka. ZK rezultat ima prvenstvo u stilu i primarnom natpisu. Neriješena
ciljana provjera ne poništava izričit javni GIS zapis; primarni natpis tada
glasi **„Javno prema GIS izvozu”**, uz napomenu da ciljana provjera nije
razriješena.

## Javni podatkovni ugovor

Generator zapisuje novi GeoJSON pod `public/geo/analiza/`. Svaka značajka
sadrži samo:

| Polje | Tip | Značenje |
| --- | --- | --- |
| `parcel_id` | string | kanonski ključ `KO:broj` |
| `parcel_number` | string | broj čestice |
| `cadastral_municipality` | string | katastarska općina |
| `parcel_area_m2` | number | puna površina prema katastarskom atributu |
| `mapped_area_m2` | number | površina geometrije prikazane u obuhvatu |
| `road_overlap_m2` | number | zbrojena površina presjeka s koridorima |
| `road_overlap_percent` | number | udio pune površine čestice zahvaćen koridorom |
| `ownership_status` | enum | primarni javni status opisan niže |
| `ownership_evidence` | enum | `land_register`, `cadastre`, `city_gis` ili `none` |
| `public_entities` | sanitizirano polje | samo već dopušteni javni subjekti |
| `has_evidence_conflict` | boolean | postoji li neslaganje izvora |
| `secondary_evidence_labels` | string[] | kratki, sanitizirani zaključci slabijih izvora |
| `source_updated_at` | ISO datum | datum prostornog izvora |
| `ownership_checked_at` | ISO datum ili null | postojeći datum ciljane provjere, bez novog upita |

`ownership_status` ima vrijednosti:

- `confirmed_public` — javno potvrđeno u ZK;
- `cadastre_public` — javno prema katastarskom posjedniku;
- `city_gis_public` — javno samo prema gradskom GIS izvozu;
- `not_confirmed_public` — ciljanim ZK rezultatom nije potvrđen javni subjekt;
- `unresolved` — ciljana provjera postoji, ali nije razriješena i nema
  upotrebljivog javnog GIS zapisa;
- `no_data` — nema raspoloživog vlasničkog dokaza.

Strogi validator odbija sva druga polja i svaku vrijednost koja izgleda kao
privatno ime, adresa, OIB, teret, udio ili sirovi odgovor.

## Prikaz na karti

Novo pitanje otvara pogled s:

1. neinteraktivnom plohom svih planiranih prometnih koridora GUP-a 2024.;
2. interaktivnim obrisima svih 338 zahvaćenih čestica;
3. sažetkom broja vidljivih čestica i zahvaćene površine;
4. jednostavnim filtrom vlasničkog statusa.

Statusi se razlikuju bojom, uzorkom obruba i tekstom. Potvrđeno javno ima
najjaču javnu ispunu; katastarski i GIS dokaz imaju slabije, međusobno
različite stilove; negativan i neriješen rezultat imaju neutralne stilove;
`no_data` je vidljiv svijetlim ispunjenjem i jasnim natpisom **„Nema podataka
o vlasništvu”**. Neslaganje izvora dobiva dodatni crtkani obrub. Boja nikada
nije jedini nositelj značenja.

Klik na česticu otvara postojeći dosje i u njemu prikazuje:

- broj i katastarsku općinu;
- površinu čestice te površinu i udio zahvaćen planiranom cestom;
- primarni vlasnički status i izvor;
- prepoznati javni subjekt, samo kada je već sanitiziran;
- sekundarni zaključak i upozorenje kada se izvori ne slažu;
- napomenu da je prikaz informativan i da nije provedena nova provjera.

Pogled i filtri moraju raditi na desktopu i telefonu. U početnom stanju svih
338 čestica je vidljivo; filtar nikada ne skriva `no_data` bez korisnikova
izričitog odabira.

## Pogreške i promjene izvora

Neispravna geometrija, neispravan parcelni ključ, privatno polje ili promjena
kontrolnog broja prekidaju generiranje. Karta pri pogrešci učitavanja zadržava
osnovnu kartu i prikazuje poruku s mogućnošću ponovnog pokušaja.

Nedostatak vlasničkog zapisa nije pogreška. Takva čestica ulazi u rezultat sa
statusom `no_data`. Nedostatak cijelog vlasničkog artefakta smije proizvesti
svih 338 čestica bez vlasničkog dokaza samo kada generator to izričito prijavi
u manifestu; ne smije neprimjetno promijeniti već postojeće rezultate.

## Provjera i prihvatni kriteriji

1. Presjek 532 prometna poligona i 1.314 katastarskih geometrija uz prag od
   1 m² daje 338 jedinstvenih čestica na trenutačnim ulazima.
2. Svaka izlazna čestica ima `road_overlap_m2 >= 1`, a nijedna nezahvaćena
   čestica nije u rezultatu.
3. Svih 338 čestica prikazuje se u početnom stanju, uključujući one bez
   vlasničkog podatka.
4. Spajanje trenutačnih artefakata daje 54 čestice s barem jednim vlasničkim
   zapisom i 284 sa statusom `no_data`.
5. Postojeći ZK i katastarski rezultat ima prednost pred GIS izvozom, ali se
   neslaganje izvora ne skriva.
6. Ne izvodi se nijedan mrežni zahtjev za vlasništvo tijekom generiranja,
   builda ili korištenja karte.
7. Izlaz, testovi, konzolni ispis i klijentski odgovor ne sadrže privatna
   imena, adrese, OIB, udjele, terete ni sirove odgovore.
8. Filtar mijenja stvarno nacrtane čestice, sažetak i stanje praznog rezultata.
9. Klik prikazuje zahvat planirane ceste, raspoloživi vlasnički dokaz i izvor,
   a za `no_data` izričito kaže da podataka nema.
10. Testovi, lint, provjera tipova, produkcijski build i pregled u pregledniku
   prolaze prije završnog commita implementacije.
