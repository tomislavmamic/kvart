# Bilice — prostorni probir cestovnog spoja

Izračun 22. rujna 2026. Kandidat za daljnju provjeru, **ne dokaz potpunog zakonitog
pristupa u oba smjera, izvedivosti bez rušenja ili najniže investicijske cijene**.

## Rezultat

Radna etapa vodi s Ulice Bilice II na kratki južni dio 4B, zapadni dio 4E i
postojeći istočni Dračevac. Novi zahvat ima 182,1 m, a zadržani postojeći dio
590,1 m (76,4 % prikazane trase). Ukupno je prikazano 772,2 m do postojećeg
ulaznog odvojka D1. Odvojak je u podacima OSM-a jednosmjeran **D1 → Dračevac**.
Linija nacrtana prema D1 stoga nije dozvoljeni smjer izlaska.

U dostupnoj mreži nije potvrđen zakonit izlaz koji istodobno zadovoljava
uvjete DPU-a i očuvanje svih zgrada. Sjeverni servisni putevi kroz radnu zonu
imaju neriješen status pristupa i sijeku buduću građevnu česticu 2B. Ne smatraju
se dokazanom alternativom izlaza. Kandidat se ne smije predstaviti kao završeno
rješenje korisnikova zahtjeva prije te provjere.

## Mjerilo i puni profil

Sve duljine i površine računaju se u HTRS96/TM, EPSG:3765. Nove osi su ručne
radne osi položene prema georeferenciranim ispunama prometnog lista DPU-a;
nisu preuzete kao projektirane osi. Ulazni zapis nalazi se u
`scripts/data/bilice-road-route.json`.

- 4B: kolnik 7 m; probir asimetričnog profila ukupne širine 22,75 m, uključujući
  nogostup i zelenilo iz presjeka 3–3.
- Zapadni 4E: kolnik 10,5 m (tri traka); ukupno 23 m ispod planiranog
  pješačkog nathodnika. Stvarne ispune lista 2a-1 određuju orijentaciju:
  sjeverni nogostup 8 m, južni 4,5 m. Na srednjem dijelu kolnik nije poravnan
  s osima postojećeg gradskog registra.
- Spoj iz Bilica: radni kolnik 7 m i dva nogostupa po 2 m. Radijusi i širenja
  križanja još nisu projektirani.
- Postojeći dio: radni omotač 6 m, jer su raspoložive osi, a ne snimljeni rubovi
  asfalta. Nije tvrdnja da cijela postojeća cesta ima tu širinu ili da ne treba
  rekonstrukciju. Prelazi između gradskih i OSM osi zabilježeni su kao mali
  spojevi na istom kartiranom raskrižju.

Puni radni omotač nove etape ima oko 3.802 m²; 98,6 % nove osi leži u izvornoj
ispuni kolnika DPU-a. Na zapadnom spoju 2,1 m osi i 40,2 m² omotača izlazi iz
obuhvata DPU-a. Tamo se spaja postojeća susjedna ulica; to nije dokaz da je
dopušteno graditi izvan cestovne čestice. Čestice i geodetski položaj valja
posebno utvrditi. Probni omotači uključuju puni navedeni presjek, ali nisu
zamjena za stvarne granice projektirane cestovne čestice.

## Zgrade i odbačeni koridori

Novi omotač i radni omotač postojećeg dijela ne preklapaju nijednu od 1.501
gradskih zgrada 2025. niti 528 OSM zgrada. Provjera starijih katastarskih
objekata otkriva tri neslaganja: objekt 15793, vrsta 101, preklapa postojeći
dio za 14,86 m²; objekti 12728 i 18525, vrsta 406, dotiču rub nove etape za
0,10 i 0,07 m². Nije dopušteno pretpostaviti da su ti objekti uklonjeni niti da
nisu prepreka. Usporedba novije snimke, katastarskog stanja i terena obvezna je
prije potvrde zahtjeva bez rušenja. Druga OSM os izbjegava stari objekt 15793,
ali rubno zahvaća drugu OSM zgradu; zato nije korištena kao način skrivanja
neslaganja izvora.

Puni alternativni koridori ispitani su pomoću **izvornih poligona kolnika i
nogostupa**, a ne samo osima. Broj sukoba odnosi se na navedeni usporedni dio,
ne na konačno projektno rješenje; dodatno zelenilo može povećati obuhvat.

| Koridor | Sukobi sa zgradama 2025. | Zašto nije preporučen |
| --- | ---: | --- |
| Sjeverni 4B → 4A | 1 | Duga postojeća zgrada preko cijelog kolnika |
| Središnji 4C → 4A | 2 | Postojeće zgrade preko središnjeg koridora |
| Puni istočni 4D | 4 | Širenje zahvaća postojeće zgrade |
| Puni južni 4G | 5 | Širenje zahvaća postojeće zgrade |

Od toga je različita naknadno ispitana sjeverna varijanta: zadržati postojeći
put zapadno od duge zgrade i ući u 4B tek sjeverno od nje, na N≈4.820.842 m.
Oko 64,1 m takvog spoja u radnoj širini 11 m prolazi bez dodira zgrada 2025.
Međutim, nastavak izvornog nogostupa 4A prema istoku preklapa drugu zgradu,
broj 1322, za 34,43 m²; kolnik je ne dotiče. Premještanje minimalnog nogostupa
u zeleni pojas može biti tema projekta, ali nije potvrđena korekcija punog
profila unutar čestice. Nadogradnja postojećeg puta izvan DPU-a također nije
potvrđena. Ovu kraću varijantu valja usporediti u daljnjoj studiji; 182 m etapa
zato se ne naziva najkraćom ili najjeftinijom cjelovitom vezom.

Sjeverni 4B dodatno je provjeren za pomak unutar čestice: zgrada broj 1320 iz
gradskog skupa preklapa kolnik 94,73 m² i nogostupe 96,79 m². Na presjeku
N=4.820.825 m zapadna granica DPU-a je E=499.629,18 m, a zgrada počinje oko
E=499.636,98 m. Preostali zapadni pojas od oko 7,8 m ne prima kolnik 7 m i
dva nogostupa po 2 m, ni prije zelenila. Istočni obilazak morao bi prijeći
E≈499.715 m u građevnu česticu 2B. Zato dopuštena tehnička korekcija **unutar
cestovne čestice** nije dokazano rješenje tog sukoba.

## Plan, konstrukcije, vlasništvo i cijena

Pročišćeni DPU 10/25, točka 3.1, dopušta samostalne prometne i tehničke etape
i opravdane korekcije unutar cestovnih čestica koje ne ometaju provedbu plana.
Iz toga ne slijedi dopuštenje za proizvoljan uski kolnik, neprovjereno spajanje
na D1 ili ukidanje planiranog nathodnika. Nova etapa na 4E prolazi ispod
planiranog pješačkog nathodnika; rampe, potporni zidovi, nivelete i odvodnja
moraju se projektirati. Sama današnja visina terena nije projektirana niveleta.

Na novi omotač pada 27 katastarskih poligona: 22 bez potvrđenog vlasništva,
4 s gradskim GIS zapisom javnosti i 1 s evidencijom `private_or_other`.
Katastarska pokrivenost omotača je potpuna, ali to nije dokaz prava građenja.
Podaci o stjecanju zemljišta, premještanju instalacija, zemljanim radovima i
konstrukcijama nisu dovoljni za vjerodostojan iznos u eurima. Usporedba
građevinskog opsega nije troškovnik. Najjeftinije potpuno izvedivo rješenje
nije utvrđeno zbog neriješenog izlaza, profila, vlasništva i konstrukcija.

## Reprodukcija i 3D

Pokretanje: `python3 scripts/generate-bilice-road.py`.
Provjera bez izmjene artefakata: `python3 scripts/generate-bilice-road.py --check`.
Generator provjerava kontinuitet susjednih segmenata s tolerancijom 1 mm,
primarnu provjeru zgrada, usklađenost duljina, dimenzije i konačne vrijednosti
mreže terena. `--check` uspoređuje cijeli deterministički izlaz s datotekama.
JSON izvještaj pohranjuje SHA-256 ključnih ulaznih geometrija.

Izlazi su `public/geo/prijedlozi/bilice-cesta.json`, `.geojson` i `-3d.json`.
Scena je 650 × 330 m, lokalni x raste prema istoku, z prema jugu, y je visina
iznad `origin[2]`. DMR je bilinearno uzorkovan svakih približno 5 m. Reljef
nije izravnan radi prikaza nove ceste. Tlocrtne zgrade ostaju na svom mjestu;
gdje postoji odgovarajući gradski poligon visine, koristi se ta visina,
inače je visina 6 m označena kao shematska. Pješački nathodnik, rampe i
projektirane kote nisu izmišljeni. `onewayInbound` je izričito označen na
istočnom odvojku da 3D prikaz ne sugerira dopušteni izlaz suprotnim smjerom.

## Prvih 75 m postojeće Ulice Bilice II

Dodatna radna pretpostavka: duljina se mjeri od predloženog spoja na DPU
(16,495436 E; 43,526393 N) prema zapadu u Bilice. Gradska dionica 18 vodi
69,137 m do središnjeg križanja; sljedećih 5,863 m nastavlja se dionicom 17.
Referentni završetak je 16,4945644 E; 43,5261653 N. Tako zadani obuhvat od
75 m razlikuje se od duljine prilagođene radne osi, **75,82 m**.

Simetrično širenje oko gradske osi nije prihvaćeno jer zahvaća postojeće
zgrade. Generator umjesto toga pretražuje bočne pomake u rasponu ±15 m, na
stacionaži svakih 1 m i koraku pomaka 0,25 m, uz najveću promjenu pomaka
0,75 m na koraku. Za prepreke istodobno uzima sve zgrade iz gradskog skupa
2025., OSM-a i sve katastarske objekte. Ni jedan mali objekt nije zanemaren.
Funkcija vrednuje kraću os, manje bočne pomake i blizinu postojećim cestovnim
česticama; nije troškovnik ni projektno oblikovanje krivina.

Kontinuiran radni profil **5 m bez zasebnog nogostupa** pronađen je s
pomakom do 2,25 m prema sjeveru i 0,5 m prema jugu. On ima 379,0 m² i ne
preklapa navedene tlocrte, ali najmanji računalni odmak iznosi samo **0,17 m**.
Tako mali odmak ne pokriva nepoznatu točnost izvora. Stoga taj rezultat nije
potvrda izvedivosti bez rušenja, dovoljne širine, dopuštenog prometnog
režima, pristupa pješaka ili interventnih vozila. Profili 5,5, 6, 7, 8 i 11 m
nisu pronađeni u toj ograničenoj pretrazi. To nije dokaz da ne postoji drugo
projektno rješenje izvan ispitanog modela.

Radni profil dodiruje osam katastarskih čestica k.o. Split:

| Čestica | Bruto preklapanje s radnim profilom |
| --- | ---: |
| 13571/1 | 253,7 m² |
| 248/1 | 34,7 m² |
| 247/2 | 32,8 m² |
| 250/11 | 31,4 m² |
| 452/1 | 21,0 m² |
| 251/2 | 2,4 m² |
| 532 | 2,3 m² |
| 13572/1 | 0,6 m² |

To su površine cijelog koridora, uključujući postojeću cestu. Rubovi asfalta
nisu geodetski snimljeni; tablica zato **ne predstavlja potreban otkup**.
Vlasništvo se učitava samo iz dodatne provjere u
`scripts/data/bilice-road-ownership.json`, u objektu `parcels` indeksiranom
identifikatorima poput `SPLIT:13571/1`. Dok zapis nije provjeren, prikazuje se
"ZK vlasništvo nije provjereno". Gradski GIS zapis javnosti, posjednik ili
jednak broj katastarske i zemljišnoknjižne čestice ne zamjenjuju dokaz
zemljišnoknjižnog vlasništva.

GeoJSON sadrži referentnu os, prilagođenu os, radni omotač i pune poligone
zahvaćenih čestica. Za scenu se čestice režu samo na granicu prikazanog
terena, a svi rubovi zgušnjavaju se na najviše 4 m prije određivanja visine.

## Prikaz u aplikaciji i provjera

Prijedlog je na `/prijedlozi/pristupna-cesta-bilice`, s karticom u popisu
prijedloga i filtrima Bilice, Dračevac i ceste. Three.js se učitava naknadno;
prikaz ima zakretanje, zumiranje, pogled odozgo, slojeve i odabir dionice.
Bez WebGL-a dostupan je SVG tlocrt istih podataka. Stalna napomena opisuje postojeći ulazni smjer D1 → naselje i neriješen izlaz. Strelice postojeće osi ne prenose se preko drugačije planirane geometrije raskrižja. Širine glavnih OSM cesta u pozadini služe orijentaciji, nisu
izmjerene i ne ulaze u izračun zahvata ili provjeru zgrada.

Kartica se obnavlja naredbom `python3 scripts/render-bilice-preview.py` iz iste
3D geometrije. Geometrija i opis nisu AI-generirana fotografija.

Provjereni su HTTP odgovor nove stranice i JSON scene, ESLint izmijenjenih
modula, tri testa kontinuiteta/valjanosti scene i smjera strelica te
deterministički generator. Statična karta vizualno je pregledana.
Interaktivna provjera WebGL-a u pregledniku ostala je nedostupna zbog
neriješenih dozvola za computer-use. Projektni TypeScript prijavljuje samo
zatečene pogreške u `src/lib/dim.test.ts:273–274`; postojeći testovi metapodataka
i navigacije imaju tri ranija neslaganja s izmjenama naziva i teksta.


## Raniji prikaz cijelog DPU koridora · 22. rujna 2026.

Ovaj način isticanja zamijenjen je prikazom postojećih cesta opisanim niže.
Ispravak izvornog otoka i preciznosti poligona ostaje u podacima.

`proposalFootprints` zamjenjuje vrpce stalne širine u 2D, Three.js-u i kartici.
Unutar obuhvata DPU-a istaknute su samo izvorne ispune kolnika lista 2a-1,
sa zavojima, proširenjima, razdjelnim otocima i odvojenim izvornim slojem
`upper`. `selectionRing` u ulaznom JSON-u služi izboru koridora i rezanju
krajeva ogranaka; ne određuje bočne rubove ceste. Semantički rezovi na dionice
služe odabiru na prikazu, a svi dijelovi DPU-a imaju istu boju.

Izvorni CAD hatch pokriva i središnji otok kružnog toka. Ekstraktor ga sada
izuzima prema zatvorenoj poliliniji istog sloja, uz kontrolnu točku
E=500049, N=4820853. Oblik nije zamijenjen idealnim krugom. Površina punog
istočnog DPU profila u usporedbi smanjena je za izuzeti dio otoka; broj sukoba
sa zgradama ostaje isti. Izvorni listovi dostupni su u popisu izvora.

Izvan obuhvata ostaju zasebni radni poligoni. U DPU-u se ne crtaju niti sivi
omotači starih osi, niti njihove strelice. Oba prikaza zadržavaju otvore
izvornih poligona, a zgrade u tlocrtu ostaju vidljive iznad istaknutog plana.
Ostali DPU koridori uključuju se kao dodatni planski kontekst.

Ovo mijenja način prikaza, ne radne osi kandidata ili geodetsku registraciju.
Duljine, probir radnih omotača i katastarske površine ne predstavljaju mjere
punog istaknutog DPU profila. Gornja razina zadržava izvorni tlocrt i oznaku
sloja; projektirane visine mosta, nathodnika ili rampi nisu pretpostavljene.

Provjera ove izmjene: usporedba s izvornim PDF-om i rasteriziranim tlocrtom,
prostorni podskup izvornog kolnika po slojevima, očuvanje središnjeg otoka,
izostanak radnih poligona unutar DPU-a te ESLint i TypeScript. Nisu dodani
ni pokretani testovi. Interaktivni WebGL nije vizualno provjeren.

Izvorni GeoJSON čuva geometriju isječenu iz DPU-a. Za 2D/3D scenu rubovi se zgušnjavaju do 4 m te topološki zaokružuju na postojeću preciznost scene od 1 cm. Time se uklanjaju mikroskopski CAD šavovi koji bi nakon običnog zaokruživanja stvarali samopresjeke. Svih 101 poligona prikaza je valjano; odstupanje od izvornog kolnika ostaje unutar 1,5 cm.


## Zadržavanje postojeće ceste u prikazu · 22. rujna 2026.

Na zahtjev korisnika, prijedlog slijedi postojeću trasu svugdje gdje je
odabran postojeći cestovni nastavak. Dionice `existing-59`, `existing-70`
i `existing-slip` prikazuju se zeleno po evidentiranim osima, i unutar
obuhvata DPU-a. Njihova prikazana širina 6 m ostaje radna, ne geodetski
potvrđen rub kolnika. DPU više ne zamjenjuje postojeću istočnu cestu budućim
širim profilom i kružnim tokom.

Narančasti obris DPU-a ograničen je na novu spojnu etapu `bilice-connection`,
`4b` i `4e`. Kratki dodiri postojeće ceste na oba kraja ostaju zeleni.
Rubni dio spoja izvan DPU-a koristi radni omotač. Cijeli DPU
ostaje zaseban, početno isključen sloj za usporedbu. Obični kontekst postojeće
cestovne mreže ponovno je vidljiv i unutar granice plana. Isto pravilo vrijedi
u Three.js-u, karti bez WebGL-a i kartici prijedloga.

Osi, duljine i probir zgrada nisu promijenjeni. Zadržani su radni koridor
proširenja prvih 75 m, osam katastarskih čestica i njihove dostupne vlasničke
napomene. Smjer na postojećem odvojku označuje samo ulaz D1 → Dračevac;
prikaz zadržavanja ceste nije potvrda dovoljne širine, javnog statusa ili
zakonitog izlaza na D1.

Neovisna prostorna provjera potvrđuje devet valjanih poligona prikaza koji
čine povezanu cjelinu. Sve osi pokrivene su unutar 2 cm preciznosti scene;
izvornih 20 GeoJSON objekata i podaci proširenja potpuno su nepromijenjeni.
Odabir planske etape reže krajeve neodabranih ogranaka; ne izostavlja izvorni
DPU kolnik unutar radne širine novog spoja. Blizina postojeće gradske osi
na 8,2 m nove etape odnosi se na dodire na njezinim krajevima.
