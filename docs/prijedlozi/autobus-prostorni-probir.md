# Školski autobus — aktualni prostorni probir

Revidirano 22. rujna 2026. prema pojašnjenju stanovnika. Za jedno stajalište
Dračevca uspoređuju se **R1 s dolaskom iz radne zone** i **N1 na sjevernom
rubu rotora**. Za Bilice predlaže se **B2 uz ulaz iz 4B koji je prikazan u
DPU-u**. Stajalište B2 samo nije ucrtano u DPU-u; novi je prijedlog pri
razradi već planiranog ulaza. Raniji B1 i D1 više nisu prvi izbor.

## Točke i javna evidencija

| Oznaka | WGS84 (dužina, širina) | Čestica, k.o. Split | GIS vlasništvo |
| --- | --- | --- | --- |
| R1 | 16.501000, 43.527360 | 419/1 | Grad Split |
| N1 | 16.500700, 43.527800 | 276/1 | Republika Hrvatska |
| B2 | 16.495550, 43.526550 | 252/2 | Republika Hrvatska |

Sve tri točke nalaze se unutar navedenih čestica s oblikom vlasništva u
javnom GIS sloju. Izvorni sloj nosi datum 3. listopada 2025.; izvedeni skup
2. kolovoza 2026. To nije aktualni zemljišnoknjižni izvadak, potvrda udjela
1/1 ni otisak cjelovitog perona i ugibališta.

R1 je izvan izvučenog planiranog kolnika. Dolazak po 4D / Os 6 i izdvojenom
desnom skretaču jug–istok podupiru izvorni prometni list i §3.1.1. Prikazani
smjer od oko 77 m cijelom duljinom leži u planiranom površinskom kolniku i
uniji javnih GIS čestica. Završava **prije** lokalnog ulaza u R1: nije
trajektorija autobusa niti dokaz izvedivog manevra do perona i dalje.

N1 je izvan kružnog kolnika, ali u planiranom zelenom pojasu. DPU nema
sjeverni privoz ni ucrtano ugibalište na toj točki. Usporedba mora uključiti
prostor za izdvojeno ugibalište, ulaz i izlaz, stabla i siguran pješački put.
Javna okolna zemljišta uključuju i 282/2, 282/5 i 281/3; dio zemljišta već
zauzima planirani rotor, pa nije slobodna površina za stajalište.

B2 je uz zapadni profil 4B, sjeverno od DPU-om nacrtanog ulaza prema
Bilicama II. Referentni položaj otvora je 16.495436, 43.526393, na javnoj
GIS čestici 13571/1. Predlaže se ostaviti autobus na planiranoj 4B, a
pješake dovesti kroz novi ulaz. Peron, ugibalište i povratnu vožnju treba
projektirati; §3.1.3 omogućuje kasnija ugibališta uz tehničke uvjete.

## Zračna blizina adresa

| Točka | Skup adresa | Ukupno | Do 300 m | Do 500 m | Medijan |
| --- | --- | ---: | ---: | ---: | ---: |
| R1 | Ulica Dračevac | 186 | 96 | 168 | 290 m |
| N1 | Ulica Dračevac | 186 | 70 | 150 | 341 m |
| B2 | Bilice I i Bilice II | 93 | 69 | 90 | 215 m |

Izvor: `public/geo/grad/adrese.geojson`. Račun u EPSG:3765 je zračna
udaljenost. To nisu duljine hodanja, kućanstva ni učenici. R1 je bliže većem
broju evidentiranih adresa od N1; kod N1 manje od polovice točaka leži u
krugu od 300 m. Nijedna brojka ne dokazuje siguran pješački pristup.

## Vožnja i ekonomičnost

Radni slijed za provjeru je B2 (4B) → 4E → 4D → desni skretač prema R1.
N1 je alternativa R1, a ne dodatno treće stajalište. Taj slijed ovisi o
izgradnji planiranih cesta, niveletama i dopuštenim smjerovima. Ulaz u R1,
nastavak prema školi i povratak nisu potvrđeni. Ne pretpostavlja se vožnja
u krivom smjeru po 4A ili postojećoj ulaznoj rampi DC1.

Usporediti cijelu vožnju, dodatne kilometre i radove na peronima. Nema
potvrđene uštede ili dovršenog autobusnog kruga bez uskih ulica. Stari ukrcaj
u parku ukida se tek kada zamjena bude spremna.

## Reprodukcija

- Autorski ulaz: `scripts/data/school-bus-stops.json`.
- `python3 scripts/generate-school-bus-screen.py`: JSON i GeoJSON s točkama,
  katastrom, postojećim i planiranim cestama, smjerom dolaska i ulazom Bilica.
- `python3 scripts/render-school-bus-preview.py`: kartica SVG iz istih podataka.
- Generator provjerava sadržavanje točaka u javnim česticama i valjanost
  svih 219 izvezenih geometrija. Potrebni su Shapely i pyproj.

Detaljniji izvori i geometrija: `skolski-autobus-dpu-revizija.md` i
`skolski-autobus-sjeverni-rub.md`. Ranije mogućnosti B1, D1 i Sud ostaju u
izbornom sloju i u JSON-u radi usporedbe, izvan aktualnog prvog izbora.
