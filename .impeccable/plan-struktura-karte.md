# Plan: struktura karte

Iz druge kritike `/karta` (2026-07-31, 19/40). Plan, ne kod.

## Nalaz koji se ponavlja

Karta ima tri usporedna sustava koji odgovaraju na isto pitanje — „što je na
karti?”:

1. **13 pogleda** u vodoravnoj traci bez kraja koji se vidi
2. **113 kvačica** u 14 skupina, bez pretraživanja
3. **čipovi podloge, namjene, usporedbe i prikaza** u desnoj ploči

Članstvo među njima nije izvedivo — šest pogleda nosi isto ime kao skupina, a
sadrže različite slojeve (pogled „Infrastruktura” pali 30 slojeva, skupina
„Infrastruktura” ima 3). Zato bočna traka mora napisati rečenicu koja objašnjava
vlastiti raspored: *„Namjena iz GUP-a nije među kvačicama nego je podloga —
bira se desno, uz ortofoto.”*

**Kad tekst mora zaobići raspored, raspored je pogrešan.** To je jedini nalaz
iz kritike koji se ne da popraviti mjerenjem.

## Pitanja s kojima se dolazi

Iz `PRODUCT.md` (susjed koji prati, telefon, poveznica iz WhatsAppa) i iz onoga
što je na stranici već izračunato:

1. **„Što vrijedi na mojoj čestici?”** — dosje. Sad ima odgovor.
2. **„Gdje se još može graditi?”** — izvedeni sloj slobodnih čestica.
3. **„Što nam mijenjaju?”** — nacrt GUP-a 2024. i njegove promjene.
4. **„Što je ovdje prijavljeno?”** — još ne postoji, vidi
   `plan-prijedlozi-na-karti.md`.

Sve četiri su pitanja o MJESTU. Nijedno nije „koje slojeve želiš vidjeti”.

## Predložena struktura

**Traka pogleda nosi četiri pitanja, ne trinaest tema.** Četiri stanu na jedan
zaslon telefona bez klizanja, i svako je rečenica koju susjed prepoznaje kao
svoju. Ostalih devet pogleda ne nestaje — sele pod „Više” na kraju trake, gdje
i pripadaju: to su načini gledanja, ne pitanja.

**Kvačice postaju ono što jesu — arhiv.** Skupine po izvoru ostaju, ali dobivaju
polje za pretraživanje na vrhu. S 113 slojeva „upiši dalekovod” mora biti jedan
potez, a ne prelistavanje četrnaest skupina. To ujedno rješava i nalaz da nema
nijednog načina da se sloj nađe po imenu.

**Desna ploča ostaje podloga, ali gubi ono što nije.** Usporedba i način prikaza
nisu podloga; oni pripadaju pogledu „Što nam mijenjaju”, gdje su i jedino
korisni. Time ploča postaje ono što joj ime kaže, a rečenica koja to objašnjava
postaje nepotrebna.

## Što se time gubi

Pogled „Svi slojevi” prestaje biti prvi. To je bila izričita odluka ranije
(„zadani pogled koji ostavlja slojeve grupirane po izvoru”) i ne mijenja se bez
dogovora — prijedlog je da ostane, ali kao posljednji čip uz „Više”, a ne kao
dolazna stranica. Registar od 113 slojeva je vrijedan; samo nije odgovor na
pitanje s kojim netko otvara kartu.

## Redoslijed

1. Pretraživanje slojeva (samostalno korisno, ne dira strukturu).
2. Usporedba i prikaz iz desne ploče u pogled „Nacrt GUP-a”.
3. Traka na četiri pitanja + „Više”.
4. Zadani pogled — tek nakon dogovora.

Prva dva koraka ne traže nijednu odluku i mogu odmah.

---

## Izvedeno 2026-07-31

Sva tri koraka. Uz jednu izmjenu prijedloga, u dogovoru:

- **Pitanja su tri, ne četiri.** „Što je prijavljeno?” traži sloj prijedloga
  koji još ne postoji — čip koji ne radi gori je od čipa kojeg nema. Ostaje u
  `plan-prijedlozi-na-karti.md` i ulazi u traku kad sloj postoji.
- **Pogledi se ne spajaju.** „Katastar i adrese” i „Koji plan vrijedi” su u
  prijedlogu išli u jedno pitanje; spajanje bi promijenilo skup slojeva, što
  je odluka o sadržaju, a ne o rasporedu. Umjesto toga je „Koji plan vrijedi”
  preimenovan u „Što vrijedi ovdje?” i podignut, a „Katastar i adrese” je
  ostao među načinima gledanja, cijel.
- **Ništa nije izbrisano.** Deset pogleda stoji pod „Više” (u bočnoj traci
  „Načini gledanja”), sa svojim ID-em i svojom adresom. Nijedna postojeća
  poveznica ne puca.

Dolazna stranica je „Gdje se može graditi?”. `?pogled=svi-slojevi` i dalje
vrijedi i vodi u registar.
