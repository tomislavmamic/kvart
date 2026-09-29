# Nogostupi: tko je dužan saditi

29. 9. 2026. Uz prijedlog drvoreda na cestovnoj čestici 419/9, stranica
prijedloga navodi stabla koja su planovi i dozvole već propisali susjednim
građevinama, a nisu posađena. Na karti su ljubičasta
(`public/geo/prijedlozi/nogostupi-obveze.geojson`).

## Izvori

- Činjenice po obvezi (tko, zašto, akti, stanje na terenu):
  `scripts/data/sidewalk-planting-obligations.json`, ručno.
- Akti: ISPU, Registar dozvola/akata (javni sloj karte na ispu.mgipu.hr;
  identifikacija točke vraća vrstu akta, klasu, datume, čestice i namjenu).
  Registar ne daje projekt, pa se ne vidi koliko je stabala i gdje ucrtano u
  hortikulturnom rješenju. Arhiva akata od 1968. nije potpuna: to što
  uporabna dozvola nije pronađena ne dokazuje da ne postoji.
- Stanje na terenu: DGU DOF 2011., 2017., 2023. i 2025./26.
- DPU dijela područja Dračevac (DPU5): 19 stabala s listova 2. i 3.
  (`public/geo/gup-grad/elementi-planova.geojson`).
- GUP (Sl. gl. 1/06, pročišćeno 55/14), čl. 91.: za sve nove zahvate
  1 stablo na 200 m² neizgrađenog dijela čestice i 1 na 4 otvorena parkirna
  mjesta; hortikulturno rješenje je dio projekta, a njegova provedba uvjet za
  uporabnu dozvolu. Čl. 73. (urbano pravilo 3.1): 20 % zelenila u proizvodnoj
  i poslovnoj, 30 % u mješovitoj namjeni; pojas zaštitnog zelenila na rubnim
  česticama radne zone. Čl. 32.: ulice se uređuju s drvoredom gdje ima
  prostora.

## Izračun

`scripts/generate-sidewalk-obligations.py`:

- DPU: položaji su oni iz plana; čestica je obuhvat plana s ISPU-a, ne jedna
  katastarska čestica (građevna čestica DPU5 zahvaća 285/1 i dio 285/10).
- GUP: neizgrađeni dio = čestica (DGU katastar) minus tlocrti zgrada Grada
  iz 2025.; stabala = cijeli broj neizgrađenih m² / 200. GUP propisuje broj,
  ne mjesto: položaji na karti su prijedlog, raspoređeni uz pročelje prema
  ulici, 4 m od međe (2 m na uskim česticama) i 2,5 m od zgrada, kao drugi
  red iza stabala na nogostupu. Stabla uz parkirališta nisu uračunata jer se
  ne zna koliko je mjesta odobreno.
- Uvjetna obveza (291: pogon po dozvoli iz 2017. nije izgrađen) ima samo
  obris čestice; ne ulazi u zbroj.

Ostale zgrade uz cestu (Dračevac 6, 6A, 6B, 9, 9D, 11) u registru nemaju
dozvolu izdanu otkad GUP 2006. traži stabla (9 iz 1990., 11 iz 1997., 9D iz
2003.; za 6, 6A i 6B nema zapisa, vjerojatno su ozakonjene), pa za njih
obveza nije navedena. Dozvole za 288/3 (2 830 m²) i 291 (1 518 m²) izdane su
iako GUP čl. 105. do donošenja UPU-a proizvodnu gradnju dopušta tek na
česticama od 3 000 m² i uz natječaj; bez teksta dozvole ne zna se je li riječ
o rekonstrukciji ili drugoj osnovi.
