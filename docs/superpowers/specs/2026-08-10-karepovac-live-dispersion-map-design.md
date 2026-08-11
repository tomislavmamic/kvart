# Karta trenutačnog širenja zraka oko Karepovca — specifikacija dizajna

- **Status:** simulirana prva verzija potvrđena za izvedbu
- **Datum:** 2026-08-10
- **Projekt:** Praćenje zraka oko Karepovca
- **Primarna površina:** `/karepovac`
- **Primarni uređaj:** mobitel

## Sažetak odluke

Izraditi ozbiljnu, javno razumljivu kartu koja prvenstveno odgovara na pitanje:

> **Je li moj dom trenutačno u mogućem smjeru širenja zraka s Karepovca?**

Karta ne tvrdi da je plin stigao do pojedine kuće. Ona jasno razdvaja:

1. procijenjeni smjer strujanja zraka;
2. događaje koje su zabilježile mjerne postaje; i
3. razinu pouzdanosti zajedničkog zaključka.

Na širokim zaslonima prikazuje se cijelo područje Dračevca i Bilica, s
Karepovcem u donjem desnom dijelu. Karta nema zumiranje. Na mobitelu zadržava
isto mjerilo i fiksnu visinu, ali je šira od zaslona i može se pomicati samo
vodoravno.

Buduća operativna verzija koristi 3D meteorološke i reljefne podatke u izračunu,
ali javnosti prikazuje čitljivu 2D kartu. Puni nagnuti 3D zemljovid nije dio
operativne verzije.

## Potvrđeni opseg simulirane prve verzije

Prva izvedba zamjenjuje postojeći statični `MonitoringField` na desnoj strani
uvodnog prikaza na `/karepovac`. Zadržava sadašnju kompoziciju uvoda, tamni
tekstualni blok, ozbiljan vizualni jezik i jasnu poruku da je riječ o
simulaciji. Ostatak stranice i postojeće Karepovac podstranice ne mijenjaju se.

Ova verzija nema veze sa stvarnim postajama, vremenom ni servisom disperzije.
Koristi tri lokalno definirana simulirana kadra — `Sada`, `Za 1 sat` i
`Za 3 sata` — kako bi pokazala buduće korisničko iskustvo. Promjena kadra
mijenja konture, smjer vjetra, ogledna očitanja postaja, vrijeme procjene i
tekstualni status doma.

Korisnik može klikom ili dodirom postaviti približan položaj doma. Položaj se
sprema samo u lokalnu pohranu preglednika; ako pohrana nije dostupna, karta i
dalje radi tijekom otvorene stranice. Položaj se ne šalje poslužitelju.

Na svim stanjima vidljivo piše `Simulirani prikaz` i `Nisu stvarna mjerenja`.
Generičke oznake `Postaja A`, `Postaja B` i `Postaja C` ne predstavljaju
stvarne lokacije. Simulirani status doma koristi isti oprezan rječnik kao
buduća operativna karta i nikada ne koristi riječi „sigurno” ili „opasno”.

Na širokim zaslonima karta ostaje u desnoj polovici postojećeg uvoda i cijeli
se obuhvat vidi bez zumiranja. Na mobitelu karta ima fiksnu vidljivu visinu i
šire unutarnje platno koje se može pomicati samo vodoravno. Kontrole vremena
imaju najmanje 44 px, rade tipkovnicom, a promjena statusa doma objavljuje se
pomoćnoj tehnologiji. Animacija strujanja poštuje `prefers-reduced-motion`.

Implementacija ostaje odvojena na:

1. tipizirane lokalne simulirane kadrove;
2. čistu funkciju koja položaj doma klasificira prema odabranom kadru;
3. klijentsku komponentu koja upravlja vremenom, položajem doma i lokalnom
   pohranom; i
4. prezentacijsku SVG kartu bez ovisnosti o Leafletu ili vanjskom API-ju.

Time se simulacija kasnije može zamijeniti stvarnim verzioniranim kadrovima bez
promjene glavnog korisničkog iskustva.

## Ciljevi

1. Omogućiti stanovniku da u nekoliko sekundi razumije je li njegov približni
   položaj u trenutačno procijenjenom smjeru.
2. Ne prikazivati model kao izmjereno stanje.
3. Prikazati cijeli kvart u stabilnom mjerilu koje se može uspoređivati iz sata
   u sat.
4. Spojiti operativnu prognozu, lokalno mjerenje vjetra, reljef i validirana
   mjerenja plinova.
5. Jasno pokazati kada nedostaju podaci ili kada su zastarjeli.
6. Sačuvati privatnost položaja doma.
7. Omogućiti kasniju zamjenu izvora vremena ili modela disperzije bez promjene
   javnog sučelja.

## Što nije cilj

- Prikazivanje regulatorno valjane koncentracije na svakoj kući.
- Proglašavanje pojedine lokacije sigurnom ili opasnom.
- Tvrdnja da obojena ploha dokazuje prisutnost H₂S-a ili drugog plina.
- Prikaz precizne granice između zahvaćenih i nezahvaćenih kuća.
- Zumiranje do razine zgrade ili balkona.
- Puni 3D prikaz terena u operativnoj verziji.
- Korištenje WeatherNexta kao glavnog lokalnog prognostičkog izvora.
- Objavljivanje točne kućne adrese ili privatnih koordinata korisnika.

## Glavno korisničko iskustvo

### Redoslijed informacija

1. **Odgovor za dom** — kratka rečenica razumljiva bez čitanja legende.
2. **Karta cijelog kvarta** — procjena, postaje, Karepovac i položaj doma.
3. **Vrijeme procjene** — sada, za jedan sat i za tri sata.
4. **Kako ovo znamo?** — izvor vremena, zadnje valjano mjerenje, korištene
   postaje i razina pouzdanosti.

Brojevi poput brzine vjetra i koncentracije nisu primarni sadržaj. Kada su
znanstveno opravdani, dostupni su u detaljima i otvorenim podacima.

### Status doma

Sučelje koristi samo sljedeća javna stanja:

- **Nema naznake prolaska prema vašem domu.**
- **Vaš dom je u mogućem smjeru, ali plin nije potvrđen mjerenjima.**
- **Vaš dom je u mogućem smjeru, a događaj je zabilježen na mjernim
  postajama.**
- **Procjena trenutačno nije dostupna.**

Nijedno stanje ne koristi izraze „sigurno”, „opasno” ili „plin je stigao”.

### Postavljanje doma

Korisnik približan položaj doma postavlja dodirom ili klikom na kartu. Položaj
se sprema samo u lokalnu pohranu preglednika. Ne šalje se poslužitelju i nije
vidljiv drugim posjetiteljima.

Karta uz oznaku doma uvijek prikazuje napomenu da je procjena prostorno gruba i
da obojeni rub nije granica između pojedinih kuća.

## Zemljovid

### Fiksni prostorni obuhvat

Prostorni okvir uvijek obuhvaća:

- Dračevac;
- Bilice;
- Karepovac u donjem desnom dijelu; i
- sve planirane javne i zajedničke mjerne postaje.

Podloga sadrži samo granice područja, glavne ceste i nužne toponime. Suvišni
detalji zgrada i parcela izostavljaju se jer bi sugerirali veću preciznost od
one koju model ima.

### Desktop i široki zasloni

- Cijeli prostorni obuhvat vidi se odjednom.
- Nema pomicanja ni zumiranja.
- Veličina oznaka ostaje stalna.

### Mobitel

- Vidljiva visina karte je fiksna na 420 px.
- Unutarnje platno zadržava isto mjerilo i široki omjer stranica.
- Omogućeno je samo vodoravno pomicanje dodirom.
- Okomito pomicanje, rotacija i zumiranje su isključeni.
- Početni položaj prikazuje Karepovac i Dračevac; Bilice su dostupne
  vodoravnim pomicanjem.
- Diskretna poruka „Povucite kartu lijevo ili desno” nestaje nakon prve
  interakcije.
- Nakon postavljanja doma karta ga automatski dovodi u vidljivo područje.

### Vizualni slojevi

Slojevi se crtaju ovim redoslijedom:

1. pojednostavljena podloga i reljefni kontekst;
2. glatke modelirane konture;
3. čestice ili strujnice vjetra;
4. mjerne postaje;
5. Karepovac;
6. dom korisnika.

Konture nemaju oštre trokutaste rubove. Oblikovane su kao glatke, ugniježđene
plohe s omekšanim vanjskim rubom.

Kada postoji samo model vjetra, područje se prikazuje neutralnim, prigušenim
slojem i tekstom da plin nije potvrđen. Žuto–narančasto–crveno–ljubičasti
pojasevi koriste se tek kada barem jedna kalibrirana postaja zabilježi valjano
odstupanje, a model vjetra podržava mogući transport s Karepovca. Ti pojasevi
znače relativnu procjenu prolaska, a ne izmjerenu koncentraciju niti dokaz
izvora.

Legenda koristi riječi:

- rubno područje;
- mogući prolazak;
- glavni procijenjeni tok; i
- mjerenje postaje.

Značenje nije prepušteno samo boji; razlikuju se i prozirnost, rub i oznaka.

### Vrijeme

Prva verzija nudi tri koraka:

- sada;
- za jedan sat;
- za tri sata.

Promjena vremena mijenja konture, čestice, tekst smjera i status doma. Vrijeme
valjanosti prikazuje se uz procjenu, a ne samo u skrivenim detaljima.

## Podaci i model

### Ulazi

1. **Operativni 3D vremenski model** — komponente vjetra, temperatura,
   stabilnost i visina sloja miješanja. Prednost ima ALADIN/HR zbog operativne
   razlučivosti od 2 km i satnih prognoza. Produkcija ne kreće dok pristup,
   licenca i pouzdan raspored preuzimanja nisu potvrđeni.
2. **Reljef** — Copernicus DEM GLO-30 ili drugi dokumentirani model jednake ili
   bolje prikladnosti.
3. **Lokalni vjetar** — najmanje jedan stručno postavljen anemometar na
   reprezentativnoj, otvorenoj lokaciji. Balkonski vjetromjer nije referentni
   izvor bez procjene utjecaja zgrade.
4. **Mjerne postaje plinova i mirisa** — samo podaci koji su prošli važeća
   pravila kalibracije i kvalitete.
5. **Izvor Karepovac** — modelira se kao područje, uz više mogućih visina i
   jačina ispuštanja. Bez validirane emisije izlaz je vjerojatnost transporta,
   ne koncentracija.

WeatherNext može kasnije poslužiti kao globalna pozadina ili rezervni ulaz, ali
njegova mreža nije dovoljna za lokalni prikaz kvarta.

### Model disperzije

Početni referentni engine je NOAA HYSPLIT ili drugi engine koji zadovoljava isti
ugovor ulaza i izlaza. Pokreće se ansambl simulacija s malim promjenama:

- smjera i brzine vjetra;
- visine ispuštanja;
- turbulencije i stabilnosti; i
- procijenjene jačine izvora.

Ansambl proizvodi relativnu vjerojatnost prolaska. Javni rezultat je skup
zaglađenih kontura, a ne jedna deterministička linija.

### Razina pouzdanosti

- **Niska:** dostupan je samo operativni vremenski model.
- **Srednja:** vremenski model i svježe lokalno mjerenje vjetra međusobno se
  slažu.
- **Viša:** slaganje vjetra prati valjan događaj zabilježen na prostorno
  odgovarajućim postajama.

Viša pouzdanost i dalje nije regulatorna potvrda izvora ni koncentracije.

## Arhitektura

Sustav je podijeljen na neovisne cjeline:

1. **Meteorološki adapter** dohvaća i normalizira odabrani operativni model.
2. **Ingestija postaja** prima mjerenja, čuva izvorne vrijednosti i dodaje
   oznake kvalitete.
3. **Servis lokalnog vjetra** održava zadnje valjano mjerenje i uspoređuje ga s
   prognozom.
4. **Servis disperzije** prima normalizirane ulaze i proizvodi verzionirani
   modelirani kadar.
5. **Servis procjene doma** lokalno uspoređuje položaj doma s konturama.
6. **Karta** prikazuje kadar bez poznavanja pojedinosti konkretnog
   meteorološkog ili disperzijskog enginea.

Modelirani kadar sadrži najmanje:

- vrijeme pokretanja modela;
- vrijeme za koje vrijedi;
- geometriju kontura;
- korištene izvore i njihove vremenske oznake;
- razinu pouzdanosti;
- stanje kvalitete; i
- verziju modela i konfiguracije.

## Tok podataka

1. Meteorološki adapter dohvaća novi model.
2. Lokalni vjetar i postaje prolaze provjeru svježine i kvalitete.
3. Servis disperzije pokreće ansambl za „sada”, `+1 h` i `+3 h`.
4. Rezultat se sprema kao nepromjenjiv, verzioniran kadar.
5. Javna stranica dohvaća zadnji valjani skup kadrova.
6. Preglednik lokalno određuje status doma za odabrano vrijeme.

Nova mjerenja ne mijenjaju stare kadrove. Ponovni izračun stvara novu verziju,
čime ostaje moguće naknadno provjeriti što je karta pokazivala u određenom
trenutku.

## Svježina, kvarovi i prazna stanja

- Bez svježeg vjetra ne prikazuje se aktivna kontura.
- Zastarjela kontura nikada se ne predstavlja kao trenutačna.
- Postaja sa zastarjelim ili nevaljanim podatkom ostaje na karti, ali je siva i
  ne sudjeluje u potvrdi događaja.
- Ako radi samo dio mreže, prikazuje se koliko je postaja sudjelovalo.
- Ako nedostaje model za `+1 h` ili `+3 h`, odgovarajući vremenski korak je
  onemogućen i navodi razlog.
- Pogreška jednog izvora ne smije izbrisati zadnje povijesne podatke ni stanje
  ostalih postaja.
- Svaka greška ima običan hrvatski opis; interni kod greške ostaje u
  zapisnicima.

## Privatnost

- Položaj doma postoji samo u pregledniku korisnika.
- Adresa nije potrebna za korištenje karte.
- Analitika ne smije bilježiti koordinate doma niti niz kliknutih lokacija.
- Javne lokacije postaja u privatnim vrtovima i na balkonima ostaju namjerno
  pomaknute ili grube u skladu s glavnom specifikacijom projekta.

## Pristupačnost

- Svaki status ima tekst, ne samo boju.
- Animacija čestica poštuje `prefers-reduced-motion`.
- Vremenski koraci dostupni su tipkovnicom.
- Status doma objavljuje se pomoćnoj tehnologiji nakon promjene položaja ili
  vremena.
- Kontrast oznaka i teksta zadovoljava WCAG AA.
- Vodoravno pomicanje na mobitelu ne zarobljava okomito pomicanje cijele
  stranice.

## Provjera modela

Model se prije javnog označavanja kao operativan provjerava na povijesnim i
pilotnim događajima:

1. za svaki događaj sprema se prognozirani slijed kontura;
2. uspoređuje se vrijeme prolaska konture preko postaje s vremenom valjanog
   odstupanja;
3. mjere se promašeni događaji, lažne procjene i vremensko odstupanje;
4. promjena konfiguracije dobiva novu verziju i ponovno prolazi isti skup
   provjera; i
5. rezultati provjere objavljuju se u metodologiji.

Model ne dobiva oznaku više pouzdanosti samo zato što vizualno izgleda uvjerljivo.

## Testiranje proizvoda

### Jedinični testovi

- klasifikacija doma u odnosu na svaku konturu;
- pravila svježine i kvalitete;
- izračun razine pouzdanosti;
- odabir zadnjeg valjanog kadra;
- pretvorba vremena i validnih vremenskih koraka.

### Integracijski testovi

- meteorološki ulaz do verzioniranog kadra;
- mjerenje postaje do potvrde događaja;
- kvar pojedinog izvora bez gubitka ostalih podataka;
- ponovni izračun bez prepisivanja povijesnog kadra.

### Testovi sučelja

- cijeli kvart vidljiv na širokom zaslonu bez pomicanja;
- na mobitelu je moguće samo vodoravno pomicanje karte;
- okomito pomicanje stranice ostaje prirodno;
- dom se nakon odabira dovodi u vidljivo područje;
- promjena vremena ažurira konture i status;
- zastarjeli podaci uklanjaju aktivnu procjenu;
- svi statusi ostaju razumljivi bez boje i animacije.

## Faze isporuke

1. **Interaktivni simulirani prikaz** s jasno označenim oglednim podacima,
   trima vremenskim koracima i lokalno postavljenim domom.
2. **Stvarna karta i reljef** u fiksnom prostornom obuhvatu.
3. **Operativni vjetar** i neutralni prikaz procijenjenog strujanja.
4. **Lokalni anemometar** i javna razina pouzdanosti.
5. **Kalibrirane plinske postaje** i potvrda događaja.
6. **Ansambl disperzije** i javno validirane konture.
7. **Povijesna provjera**, otvoreni podaci i objavljena metodologija.

Bočni presjek reljefa i visine toka razmatra se tek nakon što 2D karta i model
prođu javni pilot. Puni 3D prikaz nije planiran bez dokaza da poboljšava
razumijevanje stanovnika.
