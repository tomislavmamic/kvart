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
  Google Street View, travanj 2024. (ulazi, ograde, živica, masline); Google
  Karte, 3D prikaz ruba dvorišta Dračevac 15 prije nove građevine (snimka
  zaslona, uz navod „© Google”). Slike Street Viewa se ne prenose.
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
  (1,5–2,5 m od međe), izvan kolnih ulaza (otvor najmanje 8 m + 1,5 m) i
  2,5 m od zgrada; unutar svakog slobodnog dijela ograde jednoliko, najmanje
  6 m međusobno, a prednost imaju mjesta iza uličnih mjesta uz vodove.
- Kolni ulazi su prilazi očitani za prijedlog nogostupa
  (`scripts/data/sidewalk-tree-retention.json`). Dva ulaza hale 7A bila su
  očitana krivo; ispravljeni su prema Google Street Viewu (travanj 2024.),
  triangulacijom s dvije panorame i prema rasvjetnom stupu 9688 i ormariću
  KRO2363 iz gradskog GIS-a: kamionski ulaz je 9–17 m, glavni 60–69 m od
  zapadnog kraja pročelja. Mjesta prijedloga D18 i D25 pala su u te ulaze i
  otpadaju (sloj karte `street-tree-in-driveway`); izlazi prijedloga
  nogostupa nisu ponovno generirani, pa ih 3D prikaz i popis položaja još
  sadrže. Ostali prilazi provjereni su na Street Viewu i nisu mijenjani.
- Mjesto na nogostupu ispred dugovanog stabla: ako je uz podzemni vod
  („conflict” u probiru prijedloga), dugovano stablo iza ograde ga zamjenjuje
  i na karti je sivo zaokruženo; ako je slobodno, ostaje i ulica dobiva
  dvostruki red (dugovana stabla stoje najmanje 4 m od njega).
- Uvjetna obveza (291: pogon po dozvoli iz 2017. nije izgrađen) ima samo
  obris čestice i ne ulazi u zbroj.
- Red maslina uz 291 (skupina U4 prijedloga nogostupa, koja je bila
  označena „zadržati”) na karti je zamijenjen oznakom „zamijeniti visokim
  stablima” (`overrides`), s obrisom krošnji s Googleova 3D prikaza.
  Građevna čestica iz dozvole iz 2017. (ISPU) je katastarska čestica 291.
- Zid i masline uz 291 mjere se na Googleovu 3D prikazu
  (`scripts/data/dracevac-15-google.json`, `scripts/nogostupi_google.py`).
  Snimka je poravnata sličnošću prema tri okna i četiri slivnika gradske
  odvodnje koji se na njoj vide, na oba ruba ceste; odstupanje 0,26 m, a bez
  bilo koje točke najviše 0,54 m. Na tlu se s DOF 2019./20. slaže na oko pola
  metra. Rezultat: ulični zid s ogradom, gdje se vidi (istočnih 28 m), stoji
  1,3–2,4 m sjeverno od katastarske međe i po planu ograđuje oko 53 m²
  cestovne čestice; mjesto D27 prijedloga nogostupa je iza njega. Zapadni zid,
  prema privatnoj k.č. 292, je oko metar od svoje međe, pa plan nije grubo
  pomaknut. Oko 45 % krošnji maslina je preko međe. Zauzimanje ipak ne
  tvrdimo: tražimo geodetsko mjerenje.
- DGU-ovi ortofoti ovdje visoke predmete naginju na sjever: krošnje maslina
  2–3 m, krov nove građevine oko 2,4 m prema tlocrtu Grada. Raniji izračun
  „oko dvije trećine krošnji preko međe” s DOF 2021./22. zato je bio
  precijenjen, a na današnjem DOF-u slika ne crta među. Google crta 3D prikaz
  iz kamere iznad sredine snimke, pa visoko naginje malo od sredine (krošnje
  do 1 m, zid ispod 0,1 m poprijeko).
- Dalekovod 110 kV (D118, gradski GIS) prelazi zapadni kraj čestice 4d i
  zavoj na istoku; stabla u njegovoj blizini (< 10 m) su označena, visinu
  treba uskladiti s HOPS-om.

## Slike (`scripts/generate-sidewalk-figures.py`)

Podloge se dohvaćaju jednom u `public/prijedlozi/nogostupi-obveze/`: list 2.
DPU5 s ISPU-a kako ga plan tiska i DGU DOF 2025./26. (bez žiga). Za zid uz
291 podloga je izrez Googleova 3D prikaza, spremljen u repozitoriju jer se ne
može ponovno dohvatiti; oznake na njemu računa poravnanje iz
`scripts/nogostupi_google.py`. Oznake su u `src/generated/sidewalk-figures.json`
u pikselima slike; stranica ih crta kao SVG, a natpise kao HTML, da ostanu
oštri na mobitelu. Brojevi mjesta na nogostupu na mobitelu su skriveni (ima
ih karta).
