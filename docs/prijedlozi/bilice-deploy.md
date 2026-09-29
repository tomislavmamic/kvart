# Bilice — objava 22. rujna 2026.

- Produkcija: https://dracevac.vercel.app/prijedlozi/pristupna-cesta-bilice
- Vercel: `dpl_FMigXCnyvuhmGzM9cSKGUoWpteEB`, status `READY`.
- Izdanje: https://kvart-of960udk1-tomo-projects.vercel.app
- Izolirani izvor izdanja: `/private/tmp/kvart-bilice-deploy-20260922`.
- Osnova: prethodno produkcijsko izdanje `dpl_BJH8JwyUhQMC2Aueqe2muhi2k7tn`;
  dodani su Bilice moduli, podaci, kartica, poveznice, testovi i dokumentacija.
  Sačuvani su postojeći 3D prikazi rekreacije i nogostupa.

Zatečena TypeScript pogreška u testu `dim.test.ts` popravljena je zamjenom
pretraživanja literalnog tuplea tipno sigurnim `findIndex`. TypeScript i svih
32 testa u tom modulu i Bilice sceni prolaze. Produkcijski Next.js build,
uključujući TypeScript i generiranje stranica, uspješno je dovršen na Vercelu.

Provjeren je HTTP 200 za novu stranicu i filtrirani popis prijedloga. Javni
Bilice JSON, GeoJSON, 3D scena i SVG kartica odgovaraju izdanju po SHA-256;
ista provjera potvrđuje očuvane scene rekreacije i nogostupa. To nije provjera
interaktivnog WebGL-a u pregledniku, za koju nedostaju computer-use dozvole.

Upload je provjeren prije objave: 857 datoteka, približno 68,9 MB prije
kompresije. Lokalni katastar s vlasništvom, izvodi dojava, tajne, predmemorije,
radna stabla i sesije alata nisu uključeni. Pravila `.vercelignore` dopunjena
su za `.claude`, `.codex`, `.superpowers` i lokalni `output`.

Objava zadržava sve oznake uvjetnog kandidata i neriješenog izlaza na D1.

## Dopuna: prvih 75 m Bilica II

Novo produkcijsko izdanje: `dpl_EXVJ2zGpELq6UZpQG5ZNNjP5FNsV`, status `READY`,
https://kvart-ko3u0fikv-tomo-projects.vercel.app, s istom javnom adresom
https://dracevac.vercel.app/prijedlozi/pristupna-cesta-bilice.

Izolirani izvor: `/private/tmp/kvart-bilice-widening-deploy-20260922`, osnova
je prethodno Bilice izdanje. Dodan je probir prvih 75 m od DPU spoja prema
unutrašnjosti Bilica II, radni koridor 5 m (prilagođena os 75,82 m), osam
katastarskih čestica te odabir, granice i poseban pogled u Three.js-u i SVG-u.
To nije odobren cestovni profil. Najmanji računalni odmak od objekta je
0,17 m; taj iznos nije dovoljan za potvrdu izvedivosti bez rušenja.

Svih osam čestica potvrđeno je ciljanim živim OSS dohvatom, ali nijedna nema
izravnu ZK referencu. Vlasnici i udjeli ostaju neutvrđeni. Javni podaci nose
samo taj status, datum provjere i stvarne poveznice na katastarski zapis.
Sirovi odgovori i lokalni pregled nisu u izdanju. Pojedinosti:
`docs/prijedlozi/bilice-vlasnistvo-izvori.md`.

Provjere: 11 testova scene i tumačenja vlasništva, ESLint, TypeScript,
deterministički generator `--check` i produkcijski Next.js build prolaze.
Sedam produkcijskih resursa vraća HTTP 200; Bilice JSON, GeoJSON, scena i
SVG odgovaraju provjerenom izdanju po SHA-256. Rekreacija i nogostupi ostaju
neizmijenjeni. Interaktivni prikaz nije provjeren u pregledniku jer browser
control nije dostupan. Zapis provjere:
`/private/tmp/kvart-bilice-widening-production-checks.json`.

## Dopuna: sačuvana ranija vlasnička evidencija

Produkcija `dpl_2etkizJPZXNZ5fMJjtMhVk5z8zgY`:
https://kvart-kdl1e9ec0-tomo-projects.vercel.app, isti alias `dracevac.vercel.app`.
Izolirani izvor je `/private/tmp/kvart-bilice-ownership-corrected-20260922`.

Čestice 13571/1 i 251/2 sada prikazuju Republiku Hrvatsku prema ranijem
GIS statusu RH i obliku Vlasništvo, s navedenim datumom izvora 3. 10. 2025.
Aktualni pokušaj povezivanja sa ZK ostaje zasebno označen kao neriješen.
Ostalih šest čestica nema vlasnički podatak u dostupnim izvedenim skupovima.

Izvor izdanja namjerno je rekonstruiran iz prethodnog provjerenog izdanja
i vlasničke dopune: paralelne promjene DPU prikaza u zajedničkom radnom
prostoru nisu dio ove objave. Neovisna usporedba potvrđuje potpuno jednake
geometrije svih 20 GeoJSON objekata i svih elemenata scene, uz promjenu
samo vlasničkih opisa. Izdanje sadrži 67 izvornih površina scene. Prolaze
sedam testova scene, ESLint, produkcijski TypeScript i Next.js build.
Provjera produkcijskih datoteka: `/private/tmp/kvart-bilice-ownership-production-checks.json`.


## Izvorni obris DPU-a u 2D i 3D

Produkcija: `dpl_DbLeWcB4QaEa4mB7s7jGULopuqw1`, `READY`,
https://kvart-2n0jwmna8-tomo-projects.vercel.app, alias
https://dracevac.vercel.app/prijedlozi/pristupna-cesta-bilice.

Izolirani izvor `/private/tmp/kvart-dpu-highlight-deploy-20260922` nadograđuje
najnovije izdanje vlasništva `dpl_GUS7Hh4q1cxd2v4Lzr28VZ4nTsaA`.
Unutar DPU-a sve tri prezentacije — 2D, Three.js i kartica — koriste izvorne
poligone umjesto vrpci stalne širine. Popravljen je izostavljeni središnji
otok prema zatvorenoj poliliniji izvornog CAD sloja. Ne uvode se nove
projektirane kote niti se mijenjaju raniji radni omotači kandidata.

Prolaze ciljane provjere ESLint i TypeScript te produkcijski Next.js build.
Nisu pisani ni pokretani testovi. Pregledani su izvorni PDF i statični tlocrt;
interaktivni WebGL nije vizualno provjeren. Svih 101 poligona prikaza je
valjano. Prostorna usporedba potvrđuje izvorni kolnik unutar 1,5 cm tolerancije
za scenu, praznu sredinu kružnog toka i radne obrise samo izvan DPU-a.

Zapis produkcijskih HTTP i SHA-256 provjera:
`/private/tmp/kvart-dpu-highlight-production-checks.json`.


## Zadržavanje postojećih cesta · 22. rujna 2026.

Produkcija: `dpl_3vAQK9BKr1th4ZHTM8xpnaD1qFCz`, `READY`,
https://kvart-5zk9tbz1g-tomo-projects.vercel.app, alias
https://dracevac.vercel.app/prijedlozi/pristupna-cesta-bilice.

Izolirani izvor `/private/tmp/kvart-bilice-existing-roads-deploy-20260922`
nadograđuje najnovije izdanje `dpl_8b4aWhPQZvnQwAMmhW2dSP7mUqtH` iz
`/private/tmp/kvart-recreation-hero-deploy-20260922`. Sačuvana je nova velika
slika rekreacije, ispravljeni izvorni DPU otok i ostali produkcijski sadržaj.
Promijenjeno je samo 12 pregledanih Bilice datoteka.

Three.js, karta i kartica prikazuju postojeći nastavak od 590,1 m zeleno po
zatečenim osima, i unutar DPU-a. Narančasti DPU obris ostaje na nedostajućoj
zapadnoj etapi; buduće istočno proširenje i rotor nisu istaknuti. Cijeli plan
početno je isključen i dostupan zasebno za usporedbu. Vraćeno je pet strelica
jednosmjernog ulaza s D1. Proširenje 75 m, osam čestica i vlasničke napomene
potpuno su sačuvani.

Devet testova scene, ESLint, TypeScript, deterministički generator i
produkcijski Next.js build prolaze. Neovisno su provjereni valjanost i
povezanost devet poligona prikaza te očuvanje izvornih osi i podataka.
Rasterizirani SVG vizualno je pregledan; interaktivni WebGL nije provjeren
u pregledniku. Osam produkcijskih resursa vraća HTTP 200 i sve javne
provjerene datoteke odgovaraju izdanju po SHA-256. Zapis provjere:
`/private/tmp/kvart-bilice-existing-roads-production-checks.json`.
