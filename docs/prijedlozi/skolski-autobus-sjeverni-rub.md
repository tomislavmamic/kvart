# R1, sjeverni rub rotora i ulaz u Bilice — prostorna dopuna

Provjereno 22. rujna 2026. Dopuna nakon promjene smjera prilaza R1: autobus
dolazi **iz radne zone s juga**, a zatim koristi izdvojeni desni skretač
prema istočnom kraku. Ne pretpostavlja se dolazak s kružnog kolnika.

R1 i N1 su **dvije mogućnosti za jedno stajalište Dračevca**, a B2 je
područje za uključivanje stajališta Bilica uz već nacrtani priključak.
Točke označuju područja za razradu, ne točno položene perone ili ugibališta.

## Točke i javno zemljište

| Oznaka | WGS84 (dužina, širina) | Čestica k.o. Split | Gradska GIS evidencija |
| --- | --- | --- | --- |
| R1 | 16.501000, 43.527360 | 419/1 | Grad Split, vlasništvo |
| N1 | 16.500700, 43.527800 | 276/1 | RH, vlasništvo |
| B2 | 16.495550, 43.526550 | 252/2 | RH, vlasništvo |
| Priključak Bilica u DPU-u | 16.495435053, 43.526393782 | 13571/1 | RH, vlasništvo |

Sve četiri točke prostorno leže unutar navedenih katastarskih poligona i
poligona `public/geo/analiza/javne-cestice.geojson`. Vlasnička evidencija
ima datum izvora 3. listopada 2025.; izvedeni skup datum 2. kolovoza 2026.
To nije aktualni zemljišnoknjižni izvadak niti potvrda udjela 1/1. Provjera
odnosi se na točku, a ne na još nepostojeći projektni obuhvat perona i
kolnog manevra.

## R1 — dolazak s juga iz radne zone

Planirani južni prilaz je **4D / Os 6**. Izdvojeni desni skretač vodi na
istočni krak bez prolaska kroz kružni kolnik. Time je korisnikova promjena
smjera prilaza prostorno utemeljena u DPU-u. R1 ne treba odbaciti zbog
pretpostavke dolaska s rotora.

Smjer dolaska na karti može se pokazati sljedećom polilinijom, u redoslijedu
vožnje s juga prema sjeveroistoku:

```json
[
  [16.500350, 43.526900],
  [16.500390, 43.527000],
  [16.500438, 43.527100],
  [16.500515, 43.527200],
  [16.500580, 43.527250],
  [16.500650, 43.527300],
  [16.500700, 43.527330],
  [16.500760, 43.527360],
  [16.500840, 43.527390],
  [16.500920, 43.527410]
]
```

Duljina je približno 76,9 m u EPSG:3765. Cijela polilinija nalazi se
unutar izvorno izdvojenoga **površinskog kolnika DPU-a**, bez presijecanja
otoka. Također se cijela nalazi unutar poligona s javnom GIS evidencijom:
419/2, 419/5, 419/7, 13905/4, 420/11 i 420/12 (Grad Split), te 419/9 (RH).
To potvrđuje podlogu za **shemu dolaska**, a ne izvedeni profil ili trajektoriju
autobusa. Polilinija ne prikazuje cjelovitu vožnju do škole ili povratak.

Linija namjerno završava prije zadnjeg manevra do R1. Radna točka R1 je
oko 5,1 m izvan ispunjenog kolnika i oko 1,8 m izvan ispunjenog nogostupa
na DPU listu. Izravno spajanje završetka polilinije s točkom R1 presjeklo bi
rub nogostupa i zelenila te bi lažno sugeriralo dokazanu trajektoriju.
Lokalni pristup, položaj vrata, peron i odlazak treba riješiti projektom uz
očuvanje rekreacijskog prostora. Ne dodavati okretište u parku kao
prešutni uvjet.

## N1 — sjeverni rub rotora

Točka N1 odabrana je na državnoj čestici 276/1, u zelenom prostoru između
sjevernog ruba rotora i ceste koja prolazi sjevernije. Nalazi se **izvan
kružnog kolnika**, približno 5,4 m od najbliže izdvojene površine
planiranog kolnika. Ovo nije prijedlog zaustavljanja autobusa u kružnom
toku.

DPU na tome području prikazuje zelenilo i drveće, a **ne već projektirano
autobusno ugibalište**. Najbliža izdvojena plošnička površina DPU-a udaljena
je od točke približno 30,8 m. Nije utvrđen dovoljan prostor za ugibalište,
siguran peron i pješački priključak; to treba provjeriti zajedno sa zaštitom
planiranog zelenila, preglednošću i udaljenošću od privoza/prijelaza.
Predstaviti N1 kao alternativno **područje za ugibalište izvan kolnika**,
a ne već potvrđeno mjesto za stajanje.

U susjedstvu se nalaze i javno evidentirane gradske čestice 282/2, 282/5 i
281/3. Velik dio njih zauzima sam planirani rotor i njegovi privozi; javno
vlasništvo tih čestica nije slobodan prostor za novi peron. Ne premještati
N1 istočnije bez ponovne provjere, jer male susjedne čestice 284/2, 283/1 i
druge nemaju potvrdu javnosti u ovom izvedenom skupu.

## B2 — uključiti u već planirani novi priključak Bilica

Na izvornom prometnom listu 2a-1 postoji zapadni otvor s 4B / Os 4 prema
Bilicama, sjeverno od raskrižja 4B/4E. Referentna koordinata otvora je
E499631, N4820719 u EPSG:3765. Dakle, **priključak je već nacrtan**; za
njega nije potrebno izmišljati novu prometnu vezu.

B2 označava područje neposredno sjeverno od tog otvora, uz zapadni profil
4B. Točka je na javno evidentiranoj državnoj čestici 252/2, oko 3,0 m od
kolnika te praktično na granici pločnika i pojasa zelenila (oko 0,2 m od
izdvojene plošničke površine). Ne označava slobodnu, već projektiranu
autobusnu nišu. Za ugibalište treba sačuvati potreban pješački profil,
provjeriti drveće, priključke i položaj u odnosu na križanje.

**U DPU-u nije potvrđeno već ucrtano školsko stajalište B2.** DPU §3.1.3
dopušta naknadna ugibališta uz tehničke uvjete. Zato je ispravno navesti
„uključiti stajalište uz već planirani priključak”, uz projektni uvjet, a
ne „DPU već planira ovo stajalište”. Autobus ostaje na profilu 4B/4E; ne
upućuje se ga u usku Bilice II. Zapadni peron odgovara vratima autobusa
koji vozi prema jugu; smjerovi za polazak i povratak moraju biti razrađeni
zajedno, prije zaključka o najkraćoj trasi.

## Jednako izračunata blizina adresa

| Kandidat | Skup ulica | Adrese | Do 300 m | Do 500 m | Medijan | Najdalja |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| R1 | Točan naziv DRAČEVAC | 186 | 96 | 168 | 290 m | 793 m |
| N1 | Točan naziv DRAČEVAC | 186 | 70 | 150 | 341 m | 848 m |
| B2 | Naziv sadrži BILICE | 93 | 69 | 90 | 215 m | 688 m |

Izvor je `public/geo/grad/adrese.geojson`. To su ravne udaljenosti u
EPSG:3765, izračunate od GIS adresa do gornjih točaka. Nisu hodne rute,
broj domova ni udio školaraca. R1 je prostorno bliži odabranim adresama
Dračevca od N1, ali konačno vrednovanje ovisi o sigurnom hodu i prolazu
autobusa. Broj točaka unutar dosega ne dokazuje „većinu djece”.

## Podloge i ponovljivost

- Katastarski položaj: `public/geo/grad/katastar.geojson`.
- GIS javnosti: `public/geo/analiza/javne-cestice.geojson`.
- Kolnici i nogostupi: `public/geo/planovi/dpu-kolnici.geojson` i
  `public/geo/planovi/dpu-nogostupi.geojson`, izdvojene CAD ispune izvornog
  lista, registrirane prema ISPU obuhvatu skriptom
  `scripts/extract-dpu-sidewalks.py`.
- Vizualno pregledan izvorni
  [DPU list 2a-1, usvojene izmjene 2024.](https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14243&PortalId=0&language=hr-HR),
  lokalna izvorna datoteka `/private/tmp/kvart-dpu-promet-2a1.pdf`.
- [Pročišćene odredbe 10/25](https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14341&PortalId=0&language=hr-HR),
  §3.1.3 za naknadno postavljanje ugibališta.

Udaljenosti do planiranih ploha su mjere dvodimenzionalne registracije
lista, nisu geodetska preciznost. Ne koristiti ih kao projektne razmake.
Prostorni probir provjerava `polygon.covers(point)` za točke, a
`surface_carriageway_union.covers(approach_line)` za shemu R1.
