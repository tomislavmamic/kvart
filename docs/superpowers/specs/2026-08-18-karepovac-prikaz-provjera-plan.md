# Prikaz mirisa i provjera na ljudima — plan rada

- **Status:** nacrt, čeka odluku
- **Datum:** 2026-08-18
- **Projekt:** Praćenje zraka oko Karepovca
- **Nadovezuje se na:** `2026-08-10-karepovac-live-dispersion-map-design.md`

## Stanje

Kartica mirisa i uvod u praćenje zraka nose perjanicu koja se računa u
pregledniku, za **jedan** slučaj vremena: slab vjetar iz 112,5° pod plitkim
slojem. Prikaz je pošten — nosi oznaku „model, ne mjerenje” — ali pokazuje samo
jedno vrijeme i nijednu brojku.

Ranija specifikacija žive karte već je potvrđena i ovaj plan je nadopunjuje, ne
zamjenjuje.

## Koraci

### Što ljudi vide

1. **Dva slučaja vremena umjesto jednoga.** Prebacivanje između slučaja koji
   nosi miris na kvart i prevladavajućeg sjeveroistočnjaka koji ga nosi mimo.
   Vjerojatno najuvjerljiviji pojedinačni dodatak, jer ispravlja raširenu
   krivu predodžbu: **ne smrdi kad puše, nego kad ne puše.** Košta oko 17 kB po
   dodatnom slučaju.
2. **Karta „koliko sati godišnje”.** Godišnja slika iz računa raspršenja kao
   nepomičan sloj. Čeka bazdarenje izvora — dotad bi brojke bile pretpostavka
   prikazana kao nalaz.
3. **Kartica „sada”.** Trenutačni vjetar bira unaprijed izračunat otisak. Ovo je
   ono što potvrđena specifikacija žive karte već opisuje.
4. **Ručke za ritam i vrtloženje**, kao u pokusnom prikazu.

### Provjera na ljudima

5. **Obrazac za dojavu.** Mjesto, sat, jačina. Ovo je pučka inačica mrežne
   metode iz EN 16841-1 i jedino što se može skupljati bez ijednog uređaja.
6. **Ruža dojava.** Svaka dojava dobije sat, svaki sat ima svoj vjetar. Iz toga
   izlazi ruža koja ne ovisi ni o kakvom modelu — sama po sebi vrijedi.
7. **Model prema dojavama**, objavljeno i ondje gdje se ne slažu. Neslaganje je
   podatak, ne neuspjeh.

### Sitno

8. Zatvoriti ili osvježiti #14. Prikaz dima je sletio; zamisao o zapljuskivanju
   valova nije, i treba odlučiti odustaje li se od nje.
9. Spojiti granice okvira u `izvedi-karepovac-karticu.py` sa `scripts/okvir.py`.
   Provjera protiv razilaženja postoji, ali je to čuvar, a ne popravak.

## Redoslijed

Korak 1 stoji sam i može odmah. Koraci 2 i 3 čekaju bazdarenje izvora. Koraci
5–7 mogu teći usporedno jer ne ovise o modelu.

## Mjera uspjeha

Da čovjek iz kvarta otvori stranicu i prepozna vrijeme u kojem mu smrdi — i da
vidi da se ono što je prijavio poklapa s onim što model tvrdi.
