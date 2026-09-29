# Prijedlog školskih stajališta — izvedba i provjere

Stranica: `/prijedlozi/skolski-autobus-bilice-dracevac`.
Prijedlog je dodan u postojeći registar istaknutih prijedloga, kategoriju
„Ceste”, za oba naselja. Ne zahtijeva unos u bazu.

## Podaci i prikazi

- `scripts/generate-school-bus-screen.py` računa zračne udaljenosti do
  gradskih adresnih točaka i izvozi JSON/GeoJSON. Potrebni su Shapely i pyproj.
- `scripts/render-school-bus-preview.py` izrađuje karticu SVG iz istog
  GeoJSON-a i postojećeg sloja zgrada. Ona prikazuje lokacije, ne autobusnu
  trasu. Ponovno je pokrenuti nakon promjene probira.
- `school-bus-map.tsx` učitava Leaflet samo u klijentu. Prikazuje R1/N1 za Dračevac i B2 za Bilice,
  rezervne točke, stari ukrcaj, relevantne javne čestice te postojeće i
  planirane ceste. Evidentirani nogostupi i prijelazi su dodatni slojevi.
- `skolski-autobus-rotor.png` je detalj izvornog lista DPU 2a-1, EntryId
  14243, s otvorom na južnom rubu istočnog privoza. Izvadak nema dodanu
  autobusnu putanju.

## Provjereno 22. rujna 2026.

- TypeScript `npx tsc --noEmit --incremental false`: prolazi.
- ESLint novih komponenti, registra prijedloga i rute: prolazi.
- HTTP stranice i filtriranog popisa (Bilice/Ceste): uspješan prikaz nove
  stranice i poveznice na nju; GIS endpoint vraća svih 219 značajki.
- Neovisni geometrijski probir: svih 219 geometrija valjano i neprazno;
  sva tri glavna kandidata unutar navedenih čestica;
  udaljenosti do adresa reproduciraju prikazane brojke.
- Kartica SVG renderirana u PNG i vizualno pregledana.
- Provjere metapodataka i početne navigacije: 7/9 prolazi. Dva postojeća
  testa traže staru kopiju stranice `prijavi/page.tsx` i staru vrijednost
  `PROBLEMS_SHARE_DESCRIPTION`; obje su izmijenjene u radnom prostoru prije
  ovog zadatka i ovim radom nisu dirane.
- Vizualna provjera cijele stranice u pregledniku nije dovršena: nijedan
  povezani preglednik nije dostupan, a nativni pristup čeka dozvole
  Accessibility/Screen Recording. Uspješno renderiranje HTML-a ne potvrđuje
  stvarno ponašanje interaktivne karte u pregledniku.

Prijedlog nije objavljen na produkciju. Zaključak ostaje prostorni odabir
kandidata: javna GIS evidencija, blizina adresa i evidentirano stajalište
ne dokazuju riješeno pravo korištenja, siguran pješački put, prohodan autobusni
krug ni ostvarenu uštedu.

## Revizija prema pojašnjenju stanovnika

Autorski ulaz izdvojen u `scripts/data/school-bus-stops.json`. R1 i N1 su
alternative za jedno stajalište Dračevca, B2 zaseban kandidat Bilica uz
ulaz koji je doista nacrtan u DPU-u. Izvorni izvadci za 4D i 4B zamjenjuju
raniji uski izvadak istočnog prilaza. Smjer po 4D/desnom skretaču završava
prije lokalnog manevra u R1. Ranije točke su isključene u početnom prikazu.
Podaci i kartica generiraju se iz istih kandidata; izvoz ima 219 značajki.
