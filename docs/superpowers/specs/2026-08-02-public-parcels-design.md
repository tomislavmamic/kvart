# Evidentirane javne čestice — specifikacija dizajna

- **Status:** Odobren revidirani dizajn
- **Datum:** 2026-08-02
- **Površina:** `/karta`
- **Izvor:** lokalni GIS izvoz Grada Splita (`SHP.zip`)

## Odluka

Karta dobiva pitanje **„Što je javno evidentirano?”**. Prikazuje samo čestice
u Dračevcu i Bilicama kojima dostupni GIS izvoz izričito dodjeljuje status
`JLS`, `RH` ili `DNŽ`. To je djelomična evidencija, a ne potpuni popis javne
imovine niti zemljišnoknjižni izvadak.

U trenutačnom lokalnom izvodu postoji 1.292 čestica u obuhvatu: 81 ima jedan
od ta tri javna statusa (52 JLS, 28 RH, 1 DNŽ), 151 ima drugi izričiti status,
a 1.060 nema status vlasništva. Nepoznate čestice ne smiju se nazivati
privatnima.

## Ciljevi

1. Javno evidentirane čestice učiniti vidljivima bez poznavanja GIS slojeva.
2. Omogućiti filtriranje prema javnoj razini, namjeni iz nacrta GUP-a 2024. i
   prisutnosti evidentiranog tlocrta zgrade.
3. Uz svaki rezultat pokazati izvor, oblik vlasništva/suvlasništva i ograničenje
   pokrivenosti.
4. U repozitorij i preglednik isporučiti samo sanitizirani izvedeni sloj.

## Izvan opsega

- tvrdnja da su prikazane sve javne čestice;
- zaključivanje da je čestica privatna zato što nema javni status;
- objava imena privatnih vlasnika, OIB-a, tereta, udjela ili sirovih zapisa;
- javno dohvaćanje podataka s Uređene zemlje ili Katice;
- klasifikacija javnih tvrtki i ustanova samo prema slobodnom tekstu imena;
- pravna tvrdnja o izgrađenosti ili mogućnosti gradnje.

## Korisnički tok

1. Stanar otvara `/karta` i bira **„Što je javno evidentirano?”**.
2. Uključuje se sanitizirani sloj, a panel odmah pokazuje broj rezultata i
   ukupnu površinu.
3. Korisnik po želji filtrira javnu razinu, namjenu ili izgrađenost.
4. Rezultati i sažetak mijenjaju se bez gumba za potvrdu.
5. Klik na česticu otvara postojeći dosje s javnim statusom, oblikom upisa,
   namjenom, dokazom tlocrta i izvorom.

## Panel i kopija

Na vrhu fokusiranog pogleda stoji kratka oznaka **„Djelomična evidencija”** i
objašnjenje:

> Prikazane su samo čestice koje dostupni GIS izvoz izričito označava kao
> Grad/JLS, Republiku Hrvatsku ili Županiju. 1.060 čestica bez statusa nije
> klasificirano.

Kontrole slijede ovim redom:

1. sažetak `n čestica · x ha`;
2. **Javna razina:** Sve, Grad/JLS, Republika Hrvatska, Županija;
3. **Namjena prema GUP-u 2024. (nacrt):** višestruki izbor samo prisutnih
   kategorija, uključujući „Namjena nije određena”;
4. **Evidentirani tlocrt:** Sve, Ima tlocrt, Nema evidentirani tlocrt;
5. akcija **„Poništi filtre”** samo kada je barem jedan filtar aktivan.

Prazno stanje glasi **„Nema evidentiranih javnih čestica za odabrane
filtre.”** i nudi poništavanje. Pogreška učitavanja imenuje problem i nudi
ponovni pokušaj. Kontrole su onemogućene tijekom učitavanja.

## Prikaz na karti

- JLS: maslinasta ispuna i tamni puni obrub.
- RH: zagasito plava ispuna i tamni puni obrub.
- DNŽ: oker ispuna i tamni puni obrub.
- `Suvlasništvo`: crtkani obrub; `Vlasništvo`: puni obrub.
- Neodgovarajući rezultati nakon filtriranja su skriveni.
- Odabrana čestica koristi postojeći istaknuti stil.

Boja nikada nije jedini nositelj značenja: legenda i dosje izričito imenuju
javnu razinu i oblik upisa. Na mobilnom se zadržava postojeći jedan bočni
panel, s dodirnim metama od najmanje 44 px.

## Podatkovni tok

Ulaz je lokalni, ignorirani
`public/geo/grad/katastar-vlasnistvo.geojson`, nastao iz sloja
`SHP/SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/KatastarskeCestice.shp`.
Generator radi isključivo lokalno i:

1. zadržava samo statuse `JLS`, `RH`, `DNŽ`;
2. odbacuje sva svojstva osim broja čestice, katastarske općine, javnog statusa
   i oblika upisa;
3. prostorno pridružuje dominantnu namjenu iz
   `gup-2024-namjena.geojson`, uz prag od 1 % površine;
4. označava `built: true` ako bilo koji od postojeća četiri izvora tlocrta
   preklapa česticu za najmanje 1 m²;
5. provjerava dopuštenu shemu i zabranjene ključeve;
6. zapisuje `public/geo/analiza/javne-cestice.geojson`.

Javni zapis sadrži samo:

| Polje | Tip | Značenje |
| --- | --- | --- |
| `parcel_id` | string | stabilan spoj `KO:broj` |
| `parcel_number` | string | broj čestice |
| `cadastral_municipality` | string | katastarska općina |
| `public_level` | `city` \| `state` \| `county` | izričiti javni status |
| `ownership_form` | `ownership` \| `coownership` \| `unknown` | oblik upisa |
| `purpose_primary_code` | string \| null | dominantna namjena nacrta 2024. |
| `purpose_primary_label` | string \| null | razumljiv naziv namjene |
| `built` | boolean | postoji li evidentirani tlocrt ≥1 m² |
| `area_m2` | number | površina geometrije |
| `source_updated_at` | ISO datum | datum SHP sloja |
| `generated_at` | ISO datum | datum izrade izvedenog sloja |

Nikakvo izvorno polje s vlasnikom, teretom, pravom, OIB-om ili napomenom ne
smije prijeći u izlaz. Validacija mora pasti zatvoreno ako se pojavi
nedopušteni ključ ili status.

## Tumačenje namjene i tlocrta

Namjena dolazi iz dostupne rekonstrukcije **nacrta GUP-a 2024.**, ne iz plana
na snazi. Dominantna je kategorija s najvećim zbrojenim preklopom koja pokriva
najmanje 1 % čestice. Bez takvog preklopa vrijednost je nepoznata.

Izgrađenost koristi postojeće slojeve: gradske zgrade 2025., zgrade s
visinama, katastarske objekte i OSM zgrade. `built: false` znači samo da u tim
izvorima nije pronađen tlocrt ≥1 m²; korisnička kopija zato kaže **„Nema
evidentirani tlocrt”**, a ne „neizgrađeno” bez ograde.

## Izvor i ograda

Panel i dosje navode **GIS izvoz Grada Splita, ažuriranje izvornog sloja
3. 10. 2025.** te prikazuju:

> Informativni, djelomični prikaz. Status, vlasništvo i namjena mogu se
> promijeniti. Za službeni podatak provjerite Uređenu zemlju i važeću plansku
> dokumentaciju. Prikazana namjena je iz nacrta GUP-a 2024., koji nije plan na
> snazi.

## Prihvatni kriteriji

1. Novo pitanje radi na desktopu i telefonu u postojećem vizualnom svijetu.
2. Izlaz sadrži točno javne statuse iz lokalnog izvoda i nijedno privatno
   svojstvo.
3. Sažetak i filtri mijenjaju stvarno nacrtanu geometriju.
4. Namjena je uvijek označena kao nacrt 2024.; tlocrt kao evidencija.
5. Nepoznate čestice nisu prikazane kao privatne.
6. Učitavanje, pogreška, prazno stanje, reset, tipkovnica i fokus rade.
7. `lint`, testovi, provjera slojeva i produkcijski build prolaze.
8. Ego Browser potvrđuje desktop i mobilni prikaz, filtre, klik i dosje.
