# Fizika modela raspršenja — plan rada

- **Status:** nacrt, čeka odluku
- **Datum:** 2026-08-18
- **Projekt:** Praćenje zraka oko Karepovca
- **Mjerilo prema:** `docs/Karepovac Odour Dispersion Modeling.md`

## Stanje

Model danas radi ovako: iz DGU-ova LiDAR reljefa računa se debljina sloja zraka
nad terenom, pa se traži polje kojemu je protok masa dosljedan. Kroz to polje se
puštaju Lagrangeove čestice. To pokriva prijenos i skretanje oko padine — i to
je sve.

Usporedba s okvirom iz studije, po njezinim točkama:

| Točka studije | Stanje |
| --- | --- |
| 1. Nestacionarni model s pamćenjem | **djelomično** — čestice da, pamćenje ne |
| 2. Reljef 1 m + CORINE hrapavost | reljef da, CORINE **ne** |
| 3. WRF + CALMET + DHMZ | **ne** — umjesto toga ERA5 od 25 km |
| 4. Izvor po fazi sanacije, EN 13725 | **ne** |
| 5. H₂S kao zamjena, LandGEM, PMR | PMR da, ostalo **ne** |

## Najveći nedostatak

**Model nema pamćenje.** Svaki razred vremena računa se kao ustaljeno stanje.
Nema zastoja, nema vraćanja mirisa, nema izmjene kopnenog i morskog povjetarca
koja miris ispuhan popodne vrati nad iste kuće preko noći.

Studija tu pojavu opisuje kao glavni razlog zašto ustaljeni modeli na ovoj
obali ne valjaju, i izričito ih odbija za ovu lokaciju. Naš model ima točno tu
manu. Sve ostalo na ovom popisu manje je važno od ovoga.

## Koraci, poredani po važnosti

1. **Račun sat po satu s prijenosom stanja.** Polje se ne resetira između sati
   nego se nosi dalje. Time se pojavljuju zastoj i vraćanje. Procjena: oko pola
   sata računa za godinu, i usput nestaju stepenice koje ostavlja razvrstavanje
   po razredima.
2. **Mjerenje vjetra na plohi ili u kvartu.** Ne kod, nego oprema. Provjera na
   postaji K1 pokazala je da je vjetar usko grlo, a ne mjerenje tvari: ERA5
   opisuje vrijeme nad Splitom. Ovo vjerojatno vrijedi više od svega ostalog na
   popisu.
3. **Inverzija kao poklopac.** Rast perjanice zaustaviti na visini graničnog
   sloja umjesto puštati ga dalje. ERA5 tu visinu već daje.
4. **Hrapavost podloge iz CORINE-a.** Sloj već stoji u `src/lib/datasets.ts`,
   samo se ne koristi u računu.
5. **Morski i kopneni povjetarac.** Izvesti dnevni hod iz ERA5-a i provjeriti
   vidi li se izmjena; ako se vidi, zaslužuje vlastitu karticu jer objašnjava
   noćne epizode.
6. **Baklja kao uzdignut izvor.** Vruća baklja podigne miris i razrijedi ga;
   ugašena ga pusti pri tlu, gdje je gušći od zraka i razlijeva se. Razlika je
   velika i vezuje se uz postojeću karticu o baklji.
7. **Treća dimenzija.** Slojevi po visini, da perjanica može ići **preko**
   grebena, a ne samo oko njega.
8. **Zavjetrina zgrada.** Navedeno radi potpunosti; na ovom mjerilu ne isplati se.

## Mjera uspjeha

Model koji pri istom vremenu daje bitno drukčiju sliku noću nego danju, i koji
na postaji K1 pogađa satni niz bolje nego sadašnji.
