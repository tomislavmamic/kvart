# Plan: prijedlozi na karti

Nastao iz kritike `/karta` (2026-07-31). Nije izveden — ovo je plan, ne kod.

## Problem

Karta je najveća površina na stranici i nema nikakve veze s onim čime se
inicijativa bavi. Sto trinaest slojeva grada, države i EU-a, a nijedan ne
pokazuje što su susjedi prijavili, što je poslano Gradu i što je odgovoreno.
Shema već ima `lat`/`lng` na prijedlogu i nitko ih ne crta.

Posljedica je mjerljiva, ne estetska: `PRODUCT.md` kaže da je uspjeh **više
uključenih susjeda** i da je primarni korisnik onaj koji **prati**. Karta mu
trenutno ne nudi nijedan put ni u zapis ni u djelovanje. Onaj tko na njoj
nešto otkrije — da mu čestica leži pod dalekovodom, da je nacrt 2024. mijenja
— nema odande nijedan korak dalje.

## Što se dodaje

**1. Sloj `prijedlozi`.** Točke iz baze, boja po statusu iz postojećeg
rječnika (`STATUS_COLORS`), tako da je značenje isto kao na popisu i na
kartici. Nova boja se ne izmišlja.

- Ulazi u registar kao `type: "api"` (`/api/prijedlozi/geo`), jer je jedini
  sloj koji se mijenja između dva posjeta.
- Skupina: nova, „Naš kvart” — prva u popisu, iznad izvora podataka. Jedina
  skupina koja nije tuđa građa.
- Klaster kad ih bude više od pedesetak na jednom mjestu; do tada ne.

**2. Klik na oznaku → kartica prijedloga**, ne dosje čestice. Naslov, status,
zadnja promjena, poveznica na `/prijedlozi/<slug>`. Dosje odgovara na „što
ovdje vrijedi”; ovo odgovara na „što je ovdje već prijavljeno”, i to su dva
različita pitanja koja ne smiju dijeliti jednu ploču.

**3. „Prijavi problem ovdje” u dosjeu čestice.** Dosje već zna koordinatu i
često i k.č. Dodaje se jedna radnja na dnu koja vodi na `/prijavi` s
predpopunjenom lokacijom (`?lat=&lng=&kc=`). Ovo je cijeli lijevak: gledatelj
koji je nešto našao postaje prijavitelj bez prepisivanja adrese.

**4. Pogled „Što je prijavljeno”.** Sloj prijedloga + ceste kao orijentir.
Ulazi u traku pogleda kao drugi čip, odmah iza „Svi slojevi”.

## Što se NE radi

- **Ne dira se `/prijavi`** osim čitanja triju parametara iz upita. Obrazac
  ostaje isti, bez registracije, s istim moderiranjem.
- **Ne crta se točka bez koordinate.** Većina postojećih prijedloga je nema;
  oni ostaju samo na popisu. Karta ne smije sugerirati da je prijavljeno
  samo ono što na njoj piše — sloj nosi napomenu s brojem prijedloga bez
  lokacije.
- **Ne dodaje se odabir lokacije na karti unutar obrasca.** To je zaseban
  zadatak s vlastitim rubovima (povlačenje oznake, preciznost, mobilni unos)
  i ne treba mu se prišiti ovdje.

## Otvorena pitanja za odluku prije izvedbe

1. **Točka ili čestica?** Prijedlog s `lat/lng` je točka. Ako se veže na
   k.č., karta može osvijetliti cijelu česticu — čitljivije, ali tvrdi
   preciznost koju prijava nema („negdje u ovoj ulici” nije čestica).
   *Prijedlog: točka, dok prijava sama ne nosi k.č.*
2. **Vide li se riješeni?** Riješeno je dokaz da sustav radi i vrijedi ga
   pokazati; ali ako ih bude puno, zatrpavaju otvoreno. *Prijedlog: vide se,
   s mogućnošću gašenja, jer je „riješeno” najbolji argument koji
   inicijativa ima.*
3. **Smije li se prijaviti izvan granice kvarta?** Karta seže dalje od
   granice. *Prijedlog: radnja se nudi samo unutar granice, uz objašnjenje
   izvan nje.*

## Redoslijed

1. `/api/prijedlozi/geo` + registracija sloja (bez UI-ja) — vidi se u
   „Svi slojevi”.
2. Kartica prijedloga na klik.
3. „Prijavi problem ovdje” u dosjeu + čitanje parametara u `/prijavi`.
4. Pogled „Što je prijavljeno”.

Prva tri koraka su korisna i sami za sebe; četvrti ih samo pakira.
