# Hrvatski tekst za stranice o Karepovcu — urednički nacrt

- **Status:** potvrđen jezični smjer
- **Datum:** 2026-08-10
- **Obuhvat:** sve javne stranice pod `/karepovac`
- **Odabrani pristup:** standardni hrvatski, susjedski i izravan

## Cilj

Tekst na stranicama mora zvučati kao da ga je izvorno napisao stanovnik koji
drugim stanovnicima jasno objašnjava projekt. Ne smije zvučati kao mehanički
prijevod engleskog teksta, promotivna kampanja ni službeni obrazac.

Tehnička točnost ostaje obvezna. Jezično pojednostavnjenje ne smije zamagliti
razliku između izmjerenog podatka, službenog podatka i procjene na temelju
vjetra. Ne smije ni stvoriti dojam da postaje, mjerenja, primatelj donacija ili
prikupljeni novac već postoje.

## Glas i obraćanje

- O projektu govorimo u prvom licu množine: **postavit ćemo**, **provjeravamo**,
  **objavit ćemo**.
- Čitatelju se obraćamo pristojno i izravno: **možete pomoći**, **ponudite
  mjesto**, **pogledajte kako mjerimo**.
- Prednost imaju kratke izjavne rečenice. Jedna rečenica nosi jednu glavnu
  misao.
- Važne praznine izgovaramo bez ublažavanja: **Još nismo postavili nijednu
  postaju.** **Mjerenja još nisu počela.**
- Ton je topao, ali miran. Nema slogana, uskličnika, dijalekta ni uvjeravanja
  bez dokaza.

## Jezična pravila

### Glagol prije apstraktne imenice

Pišemo **provjerit ćemo senzor**, a ne **provest će se validacija senzora**.
Pišemo **objavit ćemo troškove**, a ne **provodit će se javno izvještavanje o
troškovima**.

### Aktivna rečenica prije pasiva

Pišemo **postaju ćemo prikazati nakon provjere**, a ne **postaja će biti
prikazana nakon što bude validirana**.

### Obična riječ prije stručne

Stručan izraz ostaje samo kada čuva značenje. Tada ga objašnjavamo pri prvom
spomenu. Primjer: **Ovo su orijentacijska mjerenja: mogu pokazati obrazac, ali
nisu službena ni sigurnosna mjerenja.**

### Hrvatski red riječi

Izbjegavamo naslove i rečenice građene po engleskom obrascu, poput **Podaci će
dolaziti s objašnjenjem, ne sami** ili **Put do javne mreže**. Naslov mora
izravno reći što odlomak objašnjava.

### Dosljedno nazivlje

| Izbjegavati | Rabiti |
| --- | --- |
| javna/građanska mreža, kada nije potrebno razlikovanje | naša mreža mjernih postaja / mreža postaja |
| domaćin postaje | stanovnik koji će ustupiti mjesto za postaju |
| podatak uživo | trenutačno mjerenje / nova mjerenja |
| mirisni događaj | pojava neugodnog mirisa |
| test na stolu | provjera uređaja prije postavljanja |
| izvedivost | možemo li projekt provesti |
| kvalitativni signal | pokazatelj pojave ili promjene |
| neovisni ulaz | zaseban podatak |
| otvoreni formati | datoteke za preuzimanje |
| javna evidencija trošenja | pregled prikupljenog i potrošenog novca |
| objavljivi trošak | trošak koji smijemo javno prikazati |
| gruba javna lokacija | približna lokacija |

Nazivi `H₂S`, `NH₃`, `CSV`, `JSON`, `GeoJSON`, `API`, `LoRa` i `Wi-Fi` ostaju
jer nemaju jasniju hrvatsku zamjenu ili su uobičajene tehničke oznake.

## Namjera pojedinih stranica

### Pregled

Prva stranica u nekoliko rečenica odgovara na tri pitanja: što želimo mjeriti,
zašto još nema mjerenja i kako se stanovnici mogu uključiti. Naslovi ne smiju
zvučati kao slogan. Trenutačno stanje mora biti vidljivo prije opisa budućih
mogućnosti.

### Uključi se

Jasno kažemo da prijave i donacije još nisu otvorene. Umjesto naziva uloga
objašnjavamo konkretne radnje: ustupiti mjesto, pomoći pri sastavljanju ili
održavanju, pratiti pripremu projekta.

### Kako mjerimo

Postupak objašnjavamo redom kojim se stvarno radi: sastavljanje, zajednička
provjera uređaja, usporedba s pouzdanim mjerenjem, određivanje potrebnih
ispravaka te pokusni rad. Ograničenja jeftinih senzora opisujemo bez
nepotrebnog stručnog žargona.

### Podaci i izvori

Objašnjavamo što će pratiti svako mjerenje: vrijeme, vrijednost, oznaka
pouzdanosti, podatak o uređaju i približna lokacija. Tehničke formate navodimo
tek nakon objašnjenja čemu služe.

### Novac i troškovi

Naslov stranice mijenjamo iz općenitog **Financije** u razumljiviji naziv
**Novac i troškovi**. Jasno kažemo da još nema potvrđenog cilja ni primatelja
uplata. Budući pregled mora odgovoriti koliko je prikupljeno, što je kupljeno i
koliko je novca preostalo.

### Postaje

Početna rečenica glasi da još nije postavljena nijedna postaja. Zatim
objašnjavamo kakvo mjesto tražimo i kako ćemo zaštititi adresu i kontakt
stanovnika koji ustupi lokaciju.

## Primjeri preoblikovanja

- **Mreža još nema javnih postaja** → **Još nismo postavili nijednu mjernu
  postaju.**
- **Pet vrata do javnog podatka** → **Što provjeravamo prije objave mjerenja.**
- **Podaci će dolaziti s objašnjenjem, ne sami** → **Uz svaki podatak objavit
  ćemo kada je i kako izmjeren.**
- **Bez podataka uživo** → **Mjerenja još nisu počela.**
- **Put do javne mreže** → **Što moramo napraviti prije početka mjerenja.**
- **Javna evidencija trošenja** → **Koliko smo prikupili i potrošili.**

## Provjera prije objave

Svaku stranicu čitamo naglas i provjeravamo:

1. zvuči li rečenica prirodno bez poznavanja engleskog izvornika;
2. može li se kraće izreći bez gubitka značenja;
3. zna li čitatelj tko nešto radi i kada;
4. je li stručna riječ potrebna i objašnjena;
5. ostaje li jasno što postoji, a što je tek planirano;
6. jesu li mjerenje, službeni podatak i procjena i dalje nedvosmisleno odvojeni;
7. stane li stvarni tekst u postojeći mobilni raspored bez sitnijeg sloga.

Uspješan prolaz znači da su svih šest stranica uređene, navigacija i metapodaci
koriste isto nazivlje, a testovi i produkcijska izgradnja prolaze bez pogreške.
