# Nogostupi: gušći drvored i 3D plan

22. 9. 2026. Nova varijanta sadrži 46 radnih mjesta za sadnju (prije 19),
uz pet približno očitanih skupina postojeće sadnje i pet prekida za prilaze.
Pet položaja prolazi početni probir od vodova; 41 traži usklađivanje s
instalacijama. Nijedan položaj nije potvrđen za izvedbu bez snimke.

## Geometrija

Trasa ostaje ista gradska cesta zapad–istok, duljine 489,8 m. Cijeli sadni
krug polumjera 1 m svakog stabla stane unutar čestice 419/9, uz približno
350 m ceste. Na dijelu čestice 297/2 bez potvrđenog cestovnog statusa i na
nastavku bez dostupnog katastra nema novih stabala.

Položaji se traže na koracima 10 m, uz najmanje 8 m između novih stabala,
izvan postojećih nogostupa prema gradskoj evidenciji i širini, radnih
dopuna, kolnika, prometnih ploha DPU-a, očitane sadnje i prilaza. Dostupne
gradske i izdvojene DPU instalacije ostaju uključene u prostorni probir.
Odmak od vodova 3 m nije propisani zaštitni pojas.

Scenarij krošnji: 2 promjera 6 m, 41 promjera 8 m, 3 promjera 10 m.
Veće krošnje biraju se prema odmaku od zgrada i prostoru sadnje. To nije
potvrda izvedivosti vrste ili korijenskog prostora. Otvoreni krug nije
ukupan prostor korijena: projekt mora osigurati povezano tlo ispod zelenih
traka i propusnih površina, uz očuvanje pješačkog prolaza i instalacija.
Razvoj krošnje nije vezan uz broj godina.

Postojeća sadnja očitana je s DGU DOF 2023., ne iz potpunog inventara.
Izvorni pikseli, bbox EPSG:3765 i radni pojasevi čuvaju se u
`scripts/data/sidewalk-tree-retention.json`. Ne predstavljaju izmjerena
debla, zone zaštite korijena ni sve postojeće prilaze.

## 3D prikaz

`scripts/generate-proposal-geodata.py` iz iste geometrije generira kartu,
brojke i `public/geo/prijedlozi/nogostupi-3d.json`. Three.js se učitava
naknadno i koristi postojeću projektnu ovisnost; nema dodatnih paketa.
Renderira se na promjenu pogleda ili kontrola, bez stalne animacijske petlje.

Podloga: `public/prijedlozi/nogostupi-ortofoto.jpg`, DGU DOF 2023.,
1920 × 800 px, EPSG:3765 bbox
500025.3354100953,4820727.536115983,500565.70934278716,4820952.69192127.
Teren: postojeći DGU LiDAR DMR `public/geo/reljef/visine.json` i
`visine.bin.gz`, bilinearno uzorkovanje u približno 3 m mreži, bez
preuveličavanja visina. DGU izvori koriste Otvorenu dozvolu.

Nove krošnje i njihove sjene su shematske. Okolne zgrade i pojedinačna
postojeća stabla nemaju izmjerene visine i nisu izmišljeni 3D volumeni.
Zadržana sadnja označena je zelenim pojasevima na stvarnoj fotografiji.
Ortofoto već sadrži izvorne sjene; pomicanje svjetla nije stručni proračun
osunčanja ni mjera postotka hlada. Nema datuma, godišnjeg doba ili satnice.

Javni prikaz omogućuje zakretanje, zumiranje, pogled odozgo, usporedbu bez
nove sadnje, promjenu veličine krošnji i ilustrativnog smjera sunca.
Katastarska granica zadano je isključena. Bez WebGL-a ostaju stvarni
ortofoto, podaci i poveznica na kartu. Postojeći AI render sada se može koristiti kao detaljnija, približno
poravnata podloga. Njegovi nacrtani detalji nisu izvor geometrije. Izvorni
ortofoto ostaje dostupan. Zajednički prikaz, nove krošnje i registracija
opisani su u [rekreacija-3d.md](rekreacija-3d.md).
