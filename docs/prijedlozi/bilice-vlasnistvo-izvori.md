# Bilice II — ciljana provjera vlasništva za prvih 75 m

Provjera: 22. rujna 2026., 17:53:42–17:53:44 UTC. Obuhvat je osam katastarskih čestica presječenih radnom geometrijom širine 5 m. To nije utvrđena granica zahvata, dokaz javne ceste ni popis nekretnina za otkup.

## Rezultat

| k.o. | Katastarska čestica | Živi katastarski zapis | Veza na zemljišnu knjigu | Vlasnik i udio |
| --- | --- | --- | --- | --- |
| SPLIT | 250/11 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 247/2 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 532 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 13572/1 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 251/2 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 452/1 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 13571/1 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |
| SPLIT | 248/1 | Broj i k.o. potvrđeni | Nema izravne veze `lrUnit` | Nisu utvrđeni |

U ovom aktualnom OSS/ZK dohvatu nijedna osoba ni javno tijelo nije potvrđeno kao vlasnik ovih čestica. To ne poništava raniju GIS evidenciju opisanu ispod. Odsutnost veze ne znači odsutnost zemljišne knjige ili vlasnika. Katastarski posjednici nisu prepisani u stupac vlasništva. Pretraga zemljišne knjige jednakim brojem katastarske čestice nije izvršena: podudaranje broja samo po sebi nije identifikacija nekretnine.

### Naknadno uključena postojeća GIS evidencija

Prethodni rezultat odnosi se samo na aktualni OSS/ZK dohvat. Dostupni
`public/geo/analiza/javne-cestice.geojson` ipak čuva vlasničku evidenciju za
dvije zahvaćene čestice: **SPLIT:13571/1** i **SPLIT:251/2** imaju
`public_level: state` i `ownership_form: ownership`. Generator je te
vrijednosti preuzeo iz izričitih izvornih polja `zk_status: RH` i
`zk_oblik: Vlasništvo`; vlasnička razina označuje Republiku Hrvatsku.

Navedeni datum izvornog sloja je 3. listopada 2025., a datum izrade izvedenog
skupa 2. kolovoza 2026. Zapisi su sačuvani od izvornog commita `de18e09`.
To nije aktualna provjera lista B niti dokaz udjela 1/1; slobodni tekst
`zk_vlasnik` i pojedinačni udjeli nisu zadržani u tom javnom sloju. Preostalih
šest ciljanih čestica u dostupnim izvedenim skupovima nema podatak o vlasniku.

Bilice generator sada spaja tu povijesnu GIS evidenciju s odvojenim ishodom
novog pokušaja povezivanja sa ZK. Neuspjeh aktualnog dohvata više ne skriva
postojeći podatak o Republici Hrvatskoj. Datumi i izvori prikazani su u
tablici; isti opis putuje u GeoJSON i 3D prikaz.

## Izvori i što još nedostaje

- [Uređena zemlja — javni OSS](https://oss.uredjenazemlja.hr/): konfiguracija javne karte, GetFeatureInfo nad česticom i pojedinačni katastarski zapis dohvaćeni su bez prijave. Stvarni URL svakog uspješno dohvaćenog zapisa nalazi se u lokalnom i sanitiziranom izvještaju; nisu konstruirane poveznice na nedohvaćene ZK uloške.
- [Ministarstvo pravosuđa — zemljišne knjige](https://mpudt.gov.hr/gradjani-21417/najcesca-pitanja-i-odgovori/zemljisne-knjige/6668): vlasništvo se čita iz lista B. Ako se katastarske i zemljišnoknjižne oznake razlikuju, Ministarstvo upućuje na podatak o identifikaciji čestica nadležnog katastarskog ureda. Posjednik i vlasnik mogu biti različite osobe. Javni internetski uvid je informativan; e-Građani omogućuju ishođenje ovjerenog izvatka.
- [Grad Split — javno izlistana aplikacija Nekretnine](https://experience.arcgis.com/experience/2a21781e58f34a43bcaca4d0c6be0b30/): javni ArcGIS katalog navodi vlasnika aplikacije `Grad_Split`. Zahtjev za [podatke aplikacije](https://www.arcgis.com/sharing/rest/content/items/2a21781e58f34a43bcaca4d0c6be0b30/data?f=json) 22. rujna vratio je grešku 403: „Subscription is disabled, the item is not accessible”. Nije dohvaćen sadržaj katastarskog sloja niti službena identifikacija.
- [Split GIS REST katalog](https://split-gisportal.gdi.net/server/rest/services?f=pjson): veza nije uspostavljena unutar 25 sekundi. Taj tehnički neuspjeh nije dokaz da zapis ne postoji.

Sljedeći dokaz potreban za pouzdana imena i udjele je službena veza ovih katastarskih čestica sa ZK česticama/ulošcima (npr. podatak o identifikaciji nadležnog katastarskog ureda). Potom treba dohvatiti aktualni list B za svaku povezanu nekretninu. Prijava putem Certilije može omogućiti odgovarajuću uslugu ili naručivanje isprave, ali sama autentikacija ne dokazuje tu vezu. Ovim provjerama nije utvrđeno da privatni pristup OSS-u automatski sadrži identifikaciju za ove čestice.

## Stanje postojećih podataka projekta

- `public/geo/grad/katastar.geojson` sadrži geometriju, broj čestice, k.o. i površinu, bez vlasnika. Geometrija nije današnji zemljišnoknjižni izvadak.
- Postojeći manifest `ciljana-provjera-vlasnistva.manifest.json` nosi datum 2. kolovoza 2026. i odnosi se na drugi skup od 30 čestica. Nije dokaz za ovu osmeročlanu provjeru.
- Postojeći `verify-targeted-ownership.ts` može koristiti pohranjene odgovore uz nov datum generiranja i ima rezervnu pretragu jednakim brojem čestice. Takav datum ne smije se tumačiti kao novi dohvat vlasništva, a broj nije dovoljan dokaz veze. Novi Bilice helper to ne koristi.
- Uvoznik gradskog GIS-a poznaje polja `kat_cest_1`, `kat_opcina`, `zku_status` i `zku_vlasni`. Izvorni paket `SHP.zip` i izvedeni `katastar-vlasnistvo.geojson` nisu dostupni u ovom radnom prostoru. Sam naziv polja `zku_vlasni` ne potvrđuje aktualnost ili vezu sa ZK česticom.

## Ponovljivost i privatnost

Pokretanje: `node --import tsx scripts/verify-bilice-ownership.ts --targets .cache/bilice-ownership/targets.json`.

Ulaz navodi samo izabrane čestice i reprezentativne koordinate. Helper provjerava broj i k.o. u živom katastarskom zapisu te za vlasništvo prihvaća isključivo njegovu izravnu ZK referencu. Ako nema veze, rezultat ostaje neriješen. Neprepoznat suvlasnički udio ostaje nepoznat; zajednički udio ne dijeli se proizvoljno među osobama.

Sirovi odgovori, `owners-review.json` i samostalni `owners-review.html` ostaju u ignoriranom direktoriju `.cache/bilice-ownership`, s pravima direktorija 0700 i datoteka 0600. HTML ne prikazuje OIB, adresu, interne identifikatore ni terete. `public-summary.json` iz istog direktorija sadrži samo status, vrijeme stvarne provjere, opažene službene poveznice, eventualna potvrđena javna tijela i broj drugih vlasnika. Kad vlasništvo nije provjereno, broj vlasnika je `null`, a ne nula. Ništa se automatski ne zapisuje u javni direktorij.

Provjera helpera: četiri ciljana testa za list B, nepoznate udjele, odvajanje posjednika i vlasnika te uklanjanje privatnih imena iz javnog sažetka; ESLint.
