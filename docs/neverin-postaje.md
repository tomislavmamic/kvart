# Neverinove postaje: najbliži anemometri koje kvart ima

**Provjereno 28. 8. 2026.** Ponovljivo za geometriju:
`scripts/neverin_postaje.py`.

## Dopuštenje i priključenje (29. 8. 2026.)

Vlasnik Neverina dao je pisano dopuštenje za korištenje naslijeđenog API-ja
(`https://api.neverin.hr/v2/stations/last/?station=<oznaka>`) za četiri
postaje: **Solin, Split-Pujanke, Split-Vrboran i Žrnovnicu**, uz uvjet da se
izvor navede kao Neverin.hr. Novi je API u izradi, pa naslijeđena adresa može
prestati raditi bez najave — dohvat u `src/lib/vjetar.ts` zato podnosi i
tišinu s te strane.

Sve četiri su priključene u živi lanac (`dohvatiZrak`), s „Neverin.hr” u
imenu postaje svugdje gdje se ime prikaže. Vrboran vodi kartu — 1,1 km od
kvarta, korak od pet minuta — i to kao **izjava geometrije, ne provjere**:
kroz postupak iz `provjeri-izvore-vjetra.py` nije prošao, jer arhive nema
(API daje samo zadnje očitanje). Pujanke i Solin stoje iza svega provjerenog.
Odluka i obrazloženje stoje uz `REDOSLIJED` u `src/lib/vjetar.ts`, gdje se
jednom crtom i mijenja.

Dvije stvari izmjerene odmah po priključenju:

- **Žrnovnica ne javlja od 2. 2. 2025.** Dopuštenje je ima, provjera starosti
  je preskače; ako ikad proradi, uključit će se sama.
- Prvo živo očitanje (29. 8. 2026. 15:25): Vrboran 185°, 0,5 m/s dok Marjan
  javlja 225°, 4 m/s — postaja pod brdom mjeri bitno slabiji vjetar nego
  izložena. To je točno ograda „zavjetrina kuće” iz zadnjeg odjeljka: blizina
  nije vjernost, i ocjena na plinu ostaje nužna čim se nakupi arhiva.

Arhive i dalje nema ni za jednu (naslijeđeni `/last` ne vraća povijest), pa
sve u nastavku o ocjenjivanju i putovima do arhive ostaje na snazi.

Cijeli model raspršenja stoji na jednom izmjerenom ulazu — vjetru — a
`docs/provjera-izvora-vjetra.md` ga zaključuje ogradom: „Na samoj plohi
anemometra nema. Sve gore je zaključivanje s 4 do 16 km udaljenosti.” Ovdje se
provjeravalo može li se ta udaljenost skratiti postajama koje objavljuje
`neverin.hr`.

Odgovor je dvodijelan: **geometrijski da, pravno ne bez dopuštenja** — a
dopuštenje je u međuvremenu stiglo, vidi gore.

## Što tamo stoji

Šest postaja u okolici, uspoređeno s onima koje model danas koristi. Udaljenosti
su računate istom ravninskom formulom kao u `izvedi-karepovac-karticu.py`, od
središta kvarta (`KVART_CENTER`) i od težišta plohe; brojke za postojeće postaje
poklapaju se s onima u `src/generated/karepovac-karta.ts` na 0,05 km, pa je
postupak time i potvrđen.

| postaja | mreža | od kvarta | od plohe | visina | niz od |
| --- | --- | --- | --- | --- | --- |
| **Split-Vrboran** | Neverin | **1,09 km** 193° | 1,41 km 241° | 74 m | 7/2025 |
| **Split-Duilovo** | Wunderground | 2,20 km 183° | 2,11 km 211° | 7 m | 10/2021 |
| **Split-Pujanke** | Wunderground | 2,34 km 245° | 3,17 km 259° | 82 m | 7/2025 |
| **Solin** | Wunderground | 2,45 km 330° | 3,35 km 318° | 63 m | 10/2021 |
| **Stobreč** | Wunderground | 3,08 km 145° | 2,27 km 160° | 17 m | 10/2021 |
| Split-3 *(danas vodi kartu)* | AZO | 4,34 km 238° | 5,04 km 248° | — | |
| Split-2 | AZO | 4,64 km 261° | 5,58 km 267° | — | |
| Split-Marjan | DHMZ | 6,17 km 253° | 7,03 km 258° | — | |
| Kaštel Sućurac-HPD Kozjak | Neverin | 7,69 km 308° | 8,71 km 306° | 460 m | 8/2026 |
| Split-aerodrom / LDSP | DHMZ/METAR | 16,08 km 276° | 17,11 km 277° | — | |

Pet je postaja bliže kvartu nego išta što model danas koristi. **Vrboran je
četiri puta bliži** od dosad najbliže postaje i jedini je anemometar unutar
kilometra i pol od plohe. Sve javljaju `wavg`, `wgust` i `wdir`, u koraku od pet
minuta.

Dvije stvari koje se iz tablice ne vide, a mijenjaju sliku:

- **Stobreč, Duilovo i Solin imaju niz od listopada 2021.** — dulji od razdoblja
  na kojem je rađena postojeća provjera. To su jedini kandidati koje bi se
  uopće dalo ocijeniti postojećim postupkom.
- **HPD Kozjak je na 460 m** i zato je posve druga vrsta podatka — vidi niže.

## Zašto se ovo ne može samo priključiti

Podatci idu preko `core.neverin.hr`, koji odbija zahtjev bez zaglavlja
`Origin: https://www.neverin.hr` (`403 ORIGIN_BLOCKED`). To je namjerna brava, a
uvjeti korištenja (`/uvjeti-koristenja/`, na snazi od 21. 6. 2026.) je i
objašnjavaju. Obvezuju korisnika da neće:

> …sustavno dohvaćati, strugati (scrapeati), preuzimati ili redistribuirati
> podatke i Sadržaj — uključujući meteorološke podatke […] — odnosno od njih
> izrađivati zbirke ili baze podataka, bez našeg prethodnog pisanog dopuštenja;
> […] zaobilaziti, onemogućavati ili ometati sigurnosne značajke Usluga ili
> mjere koje ograničavaju pristup […] niti pristupati Uslugama neovlaštenim
> botovima ili skriptama.

Poslužitelj u `src/lib/vjetar.ts` koji svakih petnaest minuta poziva
`core.neverin.hr` je točno to. Zato ovdje nije priključena nijedna postaja, koliko
god blizu bile.

Uz to, i da dopuštenja ima, **arhiva se bez vlasništva nad postajom staje na 30
dana**: `?hours=` preko 720 vraća `403 STATION_OWNER_REQUIRED`, a
`?from=&to=` isto. Sedamsto sati ne prolazi prag postojeće provjere — noćni
podskup (21–06 h) bio bi oko 290 sati, a `ocijeni()` traži najmanje 500. Bez
dogovora s Neverinom ove se postaje ne mogu ni ocijeniti, a nekamoli pustiti da
vode kartu.

## HPD Kozjak nije vjetrokaz nego termometar za stabilnost

Postaju na 460 m ne treba gledati kao lošu postaju vjetra — kao takva je
beskorisna: 7,7 km daleko, na drugoj gori, mjeri strujanje koje nad kvartom ne
vrijedi (isti prigovor koji je zračnu luku strpao na začelje). Vrijedna je zbog
**visine**, ne unatoč njoj.

Model ima dva ulaza. Jedan je vjetar i on je izmjeren. Drugi je `dubina`, dubina
miješanog sloja, i `src/lib/vjetar.ts` o njemu kaže: „modelska, jer se ne mjeri
nigdje u blizini. Ona odlučuje hoće li se zrak s plohe razrijediti ili ostati
pri tlu.” Uzima se `boundary_layer_height` s Open-Metea — dakle broj iz modela,
u projektu koji je dvaput odbio ERA5 upravo zato što nije mjeren.

Razlika temperatura između dviju visina taj broj mjeri izravno. Suhoadijabatski
pad je 9,8 °C/km, pa na 444 m visinske razlike prema Split-aerodromu (16 m)
dobro izmiješan zrak daje oko **4,3 °C hladnije gore**. Što je razlika manja,
sloj je stabilniji; kad Kozjak ispadne **topliji** od obale, iznad kvarta stoji
inverzija i prizemni zrak nema kamo. To je točno stanje koje
`docs/provjera-izvora-vjetra.md` naziva noćnim zastojem zraka i za koje
`provjeri-vedre-noci.py` zaključuje da „zastoj zraka nosi, vedrina ne”.

Par se može složiti odmah, iz izvora koje projekt već dohvaća:

| visina | postaja | odakle temperatura |
| --- | --- | --- |
| 460 m | HPD Kozjak | Ecowitt, uz vlasnikove ključeve |
| 122 m | Split-Marjan | DHMZ `hrvatska_n.xml`, polje `Temp` — već se dohvaća |
| 16 m | Split-aerodrom | isti XML; ili METAR `temp` za LDSP, isto već dohvaćeno |

Provjereno 28. 8. 2026.: oba izvora doista nose temperaturu (Marjan 30,6 °C,
aerodrom 31,1 °C u 10 h), pa je jedini nedostajući dio gornja točka.

Ograda: 460 m je iznad noćnog inverzijskog sloja u većini slučajeva, što je
dobro za mjerenje njegove **jačine**, ali ne daje njegovu **visinu**. I Kozjak
je 7,7 km sjeverozapadno, pa mjeri stabilnost nad Kaštelanskim zaljevom, a ne
nad samom plohom. To je i dalje mjerenje umjesto modela, ali nije mjerenje na
pravom mjestu — i tako to treba i napisati na stranici.

Niz mu počinje 22. 8. 2026., pa se ništa od ovoga ne može ocijeniti postojećim
postupkom prije nego što se nakupi arhiva. Ecowittova povijest ide od
priključenja konzole, koje je moglo biti i puno ranije od Neverinova preuzimanja
— to je prvo što treba pitati.

## Putovi dalje

Zajedničko svima: **do postaje se ide preko njezina vlasnika, ne preko
Neverina.** Neverin je preprodavatelj tuđih očitanja i jedini dio lanca koji
brani pristup.

1. **Ecowitt, službenim API-jem — u tijeku za HPD Kozjak.** Te su postaje
   Ecowittove konzole, a Ecowitt ima otvoren i dokumentiran API:
   `api.ecowitt.net/api/v3/device/real_time` i `/history`, uz `application_key`
   i `api_key` koje **vlasnik uređaja** izradi u svojem profilu. Provjereno
   28. 8. 2026. — poslužitelj radi i na prazan ključ odgovara `40010 Invalid
   application Key`. Daje i živa očitanja i punu arhivu, bez ičijih uvjeta
   korištenja u sredini.

   Poveznica na dijeljenje koju vlasnik izda (`/home/share?authorize=…`) za ovo
   **nije dovoljna**: samo je za gledanje, a `getSharePanel` na nju vraća
   `403 You have no permission`. Trebaju sami ključevi.

   Što tražiti od vlasnika HPD Kozjaka:
   - `application_key` i `api_key` iz njegova Ecowittova profila (nisu lozinka,
     i može ih poništiti kad god);
   - MAC ili IMEI konzole, koji `/history` traži uz ključeve;
   - **od kada konzola šalje.** Ovo je najvažnije pitanje: na Neverinu niz počinje
     22. 8. 2026., ali to je datum kad ga je Neverin preuzeo, ne kad je postaja
     proradila. Ako Ecowittova povijest seže godinu ili dvije unatrag, mjerena
     stabilnost može odmah proći postupak iz `provjeri-izvore-vjetra.py`; ako ne,
     čeka se da se arhiva nakupi.
2. **Pisati Neverinu.** Uvjeti sami upućuju na e-poštu obrta (Neverin, vl. Alen
   Šterpin) za zahtjeve za dopuštenje. Kvart je nekomercijalan projekt praćenja
   zraka, pa zamolba ima izgledan ishod. Ovo je jedini put do **Vrborana**, koji
   je Neverinova vlastita postaja i geometrijski najvrjedniji od svih — ali bi i
   dalje ovisio o tuđem releju i o arhivi od 30 dana, osim ako se ne dogovori
   više.
3. **Wunderground izravno.** Duilovo, Pujanke, Solin i Stobreč Neverin preuzima
   s Wundergrounda (polje `source` u odgovoru). Njihovoj se arhivi može doći
   službenim PWS API-jem uz besplatan ključ, a nizovi im sežu do 10/2021 — jedini
   kandidati koji bi odmah prošli prag od 500 sati. Treba naći oznake postaja
   (`I……`); na neverinovoj stranici ne stoje.
4. **Ostaviti kako jest.** Model već nosi ogradu o udaljenosti i ona je istinita.
   Ništa se ne kvari time što se čeka.

## Što ovo ne mijenja

Blizina nije ista stvar kao vjernost. `docs/provjera-izvora-vjetra.md` je već
jednom pokazao da najbliža postaja ne mora biti najbolja — Marjan je na 6,2 km
nadmašio Split-2 na 4,6 km. Vrboran na 1,1 km je razlog za nadu, ne za
zaključak: dok ne prođe isti postupak na istom plinu, o njemu se ne zna ništa
osim gdje stoji.

Te su postaje k tome privatne, uglavnom kućne. Nitko ne jamči da im je
vjetrulja orijentirana, ni da anemometar nije u zavjetrini kuće. Postojeći
postupak (nizvjetar/uzvjetar, vrh po sektoru) upravo bi to i uhvatio — ali tek
kad bude podataka na kojima se može pokrenuti.

Za Kozjak vrijedi obrnuta ograda: njegova vrijednost ne ovisi o tome kako mu je
vjetrulja okrenuta, jer se od njega ne uzima vjetar nego temperatura, a nju je
teško krivo postaviti. Ovisi o tome je li mu senzor u hladu i prozračen. To se
vidi iz podataka — dnevni hod na 460 m ne bi smio biti veći nego na obali.
