# Prijedlozi: vizuali i podloge, 22. 9. 2026.

Javni prikaz vodi slikom, prijedlogom koristi i ključnim brojkama. Katastar,
instalacije, dimenzije i ograničenja nalaze se u zatvorenim detaljima provedbe.
Primijenjene su smjernice Impeccable `distill` i `craft-floor` iz službenog
repozitorija https://github.com/pbakaus/impeccable, uz postojeći PRODUCT.md i
DESIGN.md. CLI provjera nije izvršena: lokalna predmemorija nije bila dostupna.

## Vizuali

Oba prijedloga sada vode interaktivni Three.js prikazi. Park prati tri
radne razine i sadržaje, a nogostupi 46 mjesta za stabla. Detalji zajedničkog
prikaza i podloga: [rekreacija-3d.md](rekreacija-3d.md). Izvori i ograničenja: [nogostupi-3d.md](nogostupi-3d.md).

- `public/prijedlozi/rekreacija-render-hlad.png`: ugrađeni `image_gen`, konačna
  izmjena prema korisnikovu pogledu sa sjeveroistoka. Cijela donja terasa za
  djecu, veći cageball u sredini, teretana gore, zapadna bočna cesta kao
  šetnica i tri parkirna mjesta zapadno od donje terase. Promjena hlada i očuvanja stabala: konačan prompt
  [shade-render-prompt.txt](shade-render-prompt.txt), ugrađeni `image_gen`.
  Prethodni raspored dokumentira [render-revision-prompt.txt](render-revision-prompt.txt).
- `public/prijedlozi/nogostupi-render.png`: prethodna varijanta sada ponovno
  korištena kao približno registrirana vizualna podloga u 3D prikazu. Ugrađeni `image_gen`, DGU ortofoto
  stvarne ceste i radni prikaz položaja sadnje na katastarskim česticama.
  Prikazuje mogući izgled nakon rješavanja uvjeta uz instalacije.

Slike su idejni prikazi, ne izvedbeni nacrti. Ne potvrđuju točne kote, položaj
instalacija, broj postojećih stabala ili izvedivost zahvata. Položaji na karti
radni su prijedlozi koji zahtijevaju geodetsku i projektantsku provjeru.
Korisnikove fotografije nisu kopirane u javne datoteke.

## Teren i prostorni raspored

Podloga je postojeći DGU LiDAR DMR u `public/geo/reljef/visine.json` i
`visine.bin.gz`: približno 3 m mreža, visine u decimetrima. Uzorkovanje daje
oko 46 m na donjoj terasi, 47–48 m oko srednje, 48–49 m prema gornjem dijelu
parka te 50–52 m uz južnu cestu. Fotografije sa sjeveroistoka potvrđuju
odnos terasa i višeg kolnika iza potpornog zida. Mreža ne određuje visinu
zida ni precizne prijelome terena. Stoga nisu izmišljene precizne kote zida.

Radne plohe u EPSG:3765, relativno donjem lijevom kutu R2:

- dječja terasa: x 5–54 m, y 41–54 m, 637 m²;
- cageball: x 14–36 m, y 25,5–34,5 m, 198 m²; prethodna ploha povučena od vidljive sadnje;
- teretana: x 18–26 m, y 18–24 m, 48 m²; sačuvan zeleni otok uz vježbalište;
- parking: x −12 do −3 m, y 44–55 m, izvan R2, dijelovi 419/1 i 419/9;
- bočna šetnica: staza 2,4 m, prati zapadni rub i nagib.

Svi glavni sadržaji su unutar R2 i dostupnih katastarskih čestica; parkiranje
je zaseban povezani zahvat zapadno od R2. Plohe se ne preklapaju sa zgradama.
Pješačka staza ne prelazi kroz sportske i dječje plohe. Četiri nova mjesta za platane ostaju izvan sportskih ploha, staze i
približno očitanih postojećih zelenih pojaseva. Tri su na dječjoj terasi,
gdje se sprave raspoređuju oko stabala; četvrto je uz šetnicu. Za bočnu cestu
predviđena je prenamjena, uz uvjet zadržavanja potrebnog službenog pristupa.

Padel nije uključen: teren 20 × 10 m nije stao u preostali radni obuhvat
srednje terase uz veći cageball i prolaze, u obje provjerene orijentacije
usporedne s postojećim igralištem. To je prostorni probir, ne potpuna analiza
svih mogućih rotacija i građevinskih zahvata. Dimenzije:
https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf

## Podloga nogostupa

DGU DOF 2023., Otvorena dozvola. WMS `OI.OrthoimageCoverage`, EPSG:3765,
bbox 500025.3354100953,4820727.536115983,500565.70934278716,4820952.69192127,
1920 × 800 px. Datoteka: `public/prijedlozi/nogostupi-ortofoto.jpg`.

## Prompt za nogostupe

```text
Use case: stylized-concept. Create a new landscape architectural bird's-eye render, 1536x1024, for the Dračevac sidewalk proposal in Split, Croatia. Reference 1 is the actual north-up DGU aerial of the chosen approximately 490-metre EAST-WEST business-zone road. Reference 2 is a geometry drawing: the green outlined corridor is cadastral road parcel 419/9, blue is the ACTUAL existing sidewalk alignment, dots are proposed planting locations. Use both references to preserve the real route and narrow road-corridor geometry.
Show an elevated oblique drone view of this curved east-west street, with its west junction near the recreation zone and large commercial building, its middle sweeping south, and eastern bend turning north then southeast. Do not substitute the separate north-south residential road or the highway across the top. Preserve all neighbouring buildings, private yard boundaries, driveway openings, gradients and retaining walls, keeping the present modest two-lane carriageway. Upgrade the existing narrow sidewalks and connect missing pieces with light limestone-toned paving, accessible crossings and lowered kerbs; never widen into surrounding private plots. Show proposed medium-canopy Mediterranean street trees in discrete soil beds ONLY inside the outlined public road corridor along the west/central approximately 350 metres. Leave the eastern continuation beyond that corridor without a new row of trees. In this illustrative completed scenario utility conflicts are assumed resolved; no exposed utility trenches, maps or coloured engineering lines. The goal is a believable walkable street, not a broad boulevard or a forest. Show a few people walking, one person with a pushchair, limited ordinary traffic, warm Adriatic daylight and realistic local low-rise commercial architecture. A polished, restrained photorealistic urban design visualization with clear sidewalks, legible road edge and sensible tree spacing. No text, no logos, no graphic overlays.
```

## Postojeća sadnja i novi hlad

`scripts/data/recreation-tree-retention.json` sadrži približno očitane
postojeće skupine i četiri radna mjesta za novu sadnju. Koordinate imaju
stalni izvor u EPSG:3765. Podloga je DGU DOF 2023. (WMS
https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms,
OI.OrthoimageCoverage, bbox 500088,4820774,500163,4820840, 1500 × 1320 px)
i korisnikove fotografije sa sjeveroistoka. Gradska datoteka stabala nema
nijedno stablo u R2, pa oznake nisu predstavljene kao službeni inventar.

Zadržavaju se stablo uz sjevernu kućicu, sadnja između parkiranja i
sportskog platoa te zapadni zeleni otoci. Skupine su namjerno prikazane
kao približni pojasevi, bez izmišljanja točnog broja debala ili vrste.
Njihovi pojasevi ne sijeku nove tvrde sportske plohe. Granice prikaza
nisu izmjerene zone zaštite korijena.

Za nova mjesta predviđena je otvorena površina polumjera 2 m, u cijelosti
na česticama rekreacijske zone. Nije riječ o dovoljnoj ukupnoj zoni
korijena: potrebna je projektna razrada povezanog tla i instalacija.
Položaji su lokalno pomaknuti od vodova; tri od četiri i dalje padaju
unutar radnog probira 5 m (2 m otvorenog tla + 3 m), jasno označena
kao uvjetna. Ni četvrto nije odobreno za sadnju bez snimke.

Krošnje promjera 10 m prikazuju scenarij budućeg razvoja, ne trenutačnu
veličinu sadnica, maksimalnu veličinu vrste ni simuliranu sjenu po satima.
RHS za Platanus × hispanica navodi širinu veću od 8 m i snažan korijen;
odabir vrste i izvedivost na ovoj lokaciji ostaju projektantska provjera.
https://www.rhs.org.uk/plants/96764/platanus-%C3%97-hispanica/details
