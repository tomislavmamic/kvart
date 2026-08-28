# Neverinove postaje: najbliži anemometri koje kvart ima

**Provjereno 28. 8. 2026.** Ponovljivo za geometriju:
`scripts/neverin_postaje.py`.

Cijeli model raspršenja stoji na jednom izmjerenom ulazu — vjetru — a
`docs/provjera-izvora-vjetra.md` ga zaključuje ogradom: „Na samoj plohi
anemometra nema. Sve gore je zaključivanje s 4 do 16 km udaljenosti.” Ovdje se
provjeravalo može li se ta udaljenost skratiti postajama koje objavljuje
`neverin.hr`.

Odgovor je dvodijelan: **geometrijski da, pravno ne bez dopuštenja.**

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
- **HPD Kozjak je na 460 m.** Ne mjeri prizemno strujanje nad kvartom nego zrak
  iznad sloja miješanja. Za `dubina` u modelu bi mogao vrijediti više nego za
  `smjerOd`, ali niz mu počinje 22. 8. 2026. — za sada nema što ocijeniti.

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

## Putovi dalje

Zajedničko svima: **do postaje se ide preko njezina vlasnika, ne preko
Neverina.** Neverin je preprodavatelj tuđih očitanja i jedini dio lanca koji
brani pristup.

1. **Ecowitt, službenim API-jem.** Ove su postaje uglavnom Ecowittove konzole, a
   Ecowitt ima otvoren i dokumentiran API: `api.ecowitt.net/api/v3/device/
   real_time` i `/history`, uz `application_key` i `api_key` koje **vlasnik
   uređaja** izradi u svojem profilu. Provjereno 28. 8. 2026. — poslužitelj radi
   i odgovara `40010 Invalid application Key` na prazan ključ. Ovo je jedini put
   koji daje i živa očitanja i punu arhivu, bez ičijih uvjeta korištenja u
   sredini, i traži samo da vlasnik postaje pošalje dva ključa.
2. **Pisati Neverinu.** Uvjeti sami upućuju na e-poštu obrta (Neverin, vl. Alen
   Šterpin) za zahtjeve za dopuštenje. Kvart je nekomercijalan projekt praćenja
   zraka, pa zamolba ima izgledan ishod — ali i dalje bi ovisila o tuđem releju
   i o arhivi od 30 dana, osim ako se ne dogovori više.
3. **Wunderground izravno.** Duilovo, Pujanke, Solin i Stobreč Neverin preuzima
   s Wundergrounda (polje `source` u odgovoru). Njihovoj se arhivi može doći
   službenim PWS API-jem uz besplatan ključ. Treba naći oznake postaja (`I……`);
   na neverinovoj stranici ne stoje.
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
