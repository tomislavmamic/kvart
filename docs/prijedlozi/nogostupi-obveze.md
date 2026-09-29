# Nogostupi: tko sadi

29. 9. 2026. Stranica prijedloga nogostupa ide ulicom od zapada prema istoku:
za svaki potez kaže tko je dužan saditi, zašto i gdje, što je danas na terenu
i što tražimo. Uz tekst su slike (list plana ili ortofoto s oznakama) i gumb
koji pomiče kartu na taj potez. Na karti su dugovana stabla ljubičasta
(`public/geo/prijedlozi/nogostupi-obveze.geojson`).

## Izvori

- Činjenice po obvezi (tko, izvori, akti, stanje): ručno, u
  `scripts/data/sidewalk-planting-obligations.json`. Tekst stranice je u
  `src/components/proposals/planting-obligations.tsx`.
- Akti: ISPU, Registar dozvola/akata (javni sloj karte na ispu.mgipu.hr).
  Registar ne daje projekt, pa se ne vidi koliko je stabala i gdje ucrtano u
  hortikulturnom rješenju. Arhiva akata nije potpuna: to što uporabna dozvola
  ili prijava početka građenja nije pronađena ne dokazuje da ne postoji.
  Brojevi čestica 30xx u aktima nisu katastarske čestice uz ulicu (vjerojatno
  zemljišnoknjižne), pa ih ne navodimo.
- Teren: DGU DOF 2011., 2017., 2019./20., 2021./22., 2023. i 2025./26.;
  Google Street View, travanj 2024. (ulazi, ograde, živica, masline). Slike
  Street Viewa se ne prenose; na stranici su samo DGU-ove snimke i list plana.
- Vlasništvo cestovne čestice 419/9: Republika Hrvatska, prema vlasničkom
  sloju gradskog GIS-a (`public/geo/analiza/javne-cestice.geojson`); cestom
  kao nerazvrstanom upravlja Grad.
- Planovi: DPU dijela područja Dračevac (DPU5, Sl. gl. 23/04), 19 stabala s
  listova 2. i 3. (`public/geo/gup-grad/elementi-planova.geojson`); GUP
  (Sl. gl. 1/06, pročišćeno 55/14) i nacrt izmjena iz 2025.:
  - čl. 91.: za sve nove zahvate 1 stablo na 200 m² neizgrađenog dijela
    čestice i 1 na 4 otvorena parkirna mjesta, vrste očekivane visine oko
    10 m; hortikulturno rješenje je dio projekta, njegova provedba uvjet
    uporabne dozvole. Nacrt 2025. (čl. 49.e st. 7.): 1 stablo na 200 m²
    cijele čestice; parkirališta 1 na 3 mjesta.
  - čl. 73. (urbano pravilo 3.1): poslovna namjena K najmanje 20 % zelenila,
    K5 prema M1 30 %. Uz ulicu je sjeverna strana K, južna K5 (GUP 2015.);
    pravilo o zaštitnom pojasu na rubu radne zone vrijedi za proizvodnu
    namjenu (I), pa se ovdje ne primjenjuje.
  - čl. 32.: ulice se uređuju s drvoredom gdje ima prostora; nacrt 2025.
    (čl. 36. st. 18.) to izričito proteže na sve postojeće ceste.
  - Nijedno pravilo na snazi ne kaže da se stabla na česticama sade uz ulicu.
    Zato za građevine bez dozvole nakon 2006. ne crtamo stabla, nego tražimo
    da ih Grad u budućim dozvolama i UPU-u Dračevac 2 smjesti uz ulicu.

## Izračun (`scripts/generate-sidewalk-obligations.py`)

- DPU: položaji su oni iz plana; čestica je obuhvat plana s ISPU-a.
- GUP: neizgrađeni dio = čestica (DGU katastar) minus tlocrti zgrada Grada iz
  2025.; stabala = cijeli broj neizgrađenih m² / 200.
- Položaj GUP-ovih stabala je naš prijedlog: red odmah iza ulične ograde
  (1,5–2,5 m od međe), izvan kolnih ulaza (prilazi očitani za prijedlog
  nogostupa, otvor najmanje 8 m + 1,5 m) i 2,5 m od zgrada, najmanje 7 m
  međusobno.
- Mjesto na nogostupu ispred dugovanog stabla: ako je uz podzemni vod
  („conflict” u probiru prijedloga), dugovano stablo iza ograde ga zamjenjuje
  i na karti je sivo zaokruženo; ako je slobodno, ostaje i ulica dobiva
  dvostruki red (dugovana stabla stoje najmanje 4 m od njega).
- Uvjetna obveza (291: pogon po dozvoli iz 2017. nije izgrađen) ima samo
  obris čestice i ne ulazi u zbroj.
- Red maslina uz 291 (skupina U4 prijedloga nogostupa, koja je bila
  označena „zadržati”) na karti je zamijenjen oznakom „zamijeniti visokim
  stablima” (`overrides`). Udio krošnji na cestovnoj čestici: po pojasu U4
  oko 70 %, po masci vegetacije s DOF 2021./22. oko dvije trećine (medijan
  oko 1 m preko međe). Građevna čestica iz dozvole iz 2017. (ISPU) je
  katastarska čestica 291, bez tog pojasa. Na DOF 2011., prije maslina, rub
  dvorišta je na međi ili do 1 m izvan nje, unutar točnosti katastra; zato
  tražimo geodetsko mjerenje, a ne tvrdimo zauzimanje.
- Dalekovod 110 kV (D118, gradski GIS) prelazi zapadni kraj čestice 4d i
  zavoj na istoku; stabla u njegovoj blizini (< 10 m) su označena, visinu
  treba uskladiti s HOPS-om.

## Slike (`scripts/generate-sidewalk-figures.py`)

Podloge se dohvaćaju jednom u `public/prijedlozi/nogostupi-obveze/`: list 2.
DPU5 s ISPU-a kako ga plan tiska, DGU DOF 2025./26. i za maslinik DOF
2019./20. (obje bez žiga). Oznake su u `src/generated/sidewalk-figures.json`
u pikselima slike; stranica ih crta kao SVG, a natpise kao HTML, da ostanu
oštri na mobitelu. Brojevi mjesta na nogostupu na mobitelu su skriveni (ima
ih karta).
