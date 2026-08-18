# Mjerne postaje na Karepovcu i bazdarenje izvora — plan rada

- **Status:** nacrt, čeka odluku
- **Datum:** 2026-08-18
- **Projekt:** Praćenje zraka oko Karepovca
- **Prethodi mu:** godišnji račun raspršenja (`scripts/izvedi-raspesenje.py`)

## Zašto

Stranica danas kaže da nemamo vlastita mjerenja. To je točno za naše senzore,
ali netočno kao slika stanja: na Karepovcu već stoje dvije službene postaje, a
podatci su javni i satni.

| Postaja | Gdje | Mjeri | Podatci |
| --- | --- | --- | --- |
| **Karepovac 1** | istočna strana, 200 m od radne plohe, 43°30′59,89″ N 16°31′0,83″ E | H₂S, NH₃, SO₂, NO₂, PM₁₀ | satne tablice po mjesecima, `k1Tab<GGGGMM>.html` |
| **Karepovac 2** | južna strana, prema Kamenu | merkaptani, hlapivi spojevi, ozon, CO, benzen, PM₂,₅ | isti oblik pod `/k2/`; i u državnoj mreži (postaja 309) |

Obje vodi Nastavni zavod za javno zdravstvo SDŽ. Adrese su predvidive, pa se
cijela godina povuče u jednom prolazu.

Studija u `docs/` ove postaje **ne spominje**. Predlaže naručivanje
olfaktometrije po EN 13725 ili postavljanje vlastitih H₂S senzora — a mjerenje
već postoji, 200 m od radne plohe.

## Što se time otključava

Jačina izvora jedina je slobodna brojka u godišnjem računu i zasad je
pretpostavka iz literature. S H₂S-om se može izračunati unatrag: pusti se model
s jediničnom emisijom, očita se modelirana vrijednost u ćeliji postaje i traži
mjerilo koje se poklapa s izmjerenim. Tek tada karta prestaje biti pretpostavka.

## Koraci

1. **Skidanje.** `scripts/skini-postaje.py` — obje postaje, sve dostupne mjesece,
   s predmemorijom u `.cache/`. Zapis: sat, tvar, vrijednost, oznaka valjanosti.
2. **Objava mjerenja.** Kartica i stranica s pravim satnim nizom. Prvi put da
   projekt pokazuje mjereno, a ne procijenjeno. Označiti izvorom „službeno”.
3. **Bazdarenje izvora.** Obrnuti račun opisan gore; rezultat je tok u ouE/m²/s
   s rasponom nesigurnosti, a ne jedna brojka.
4. **Pretvorba H₂S u ouE.** Stevensov zakon potencije, s koeficijentom izvedenim
   iz mjerenja umjesto preuzetim.
5. **Provjera modela na mjerenju.** Sat po sat, ne samo po smjeru.
6. **Prekoračenja merkaptana.** 82 prekoračenja dnevne granične vrijednosti u
   2025. stoje u godišnjim izvješćima Zavoda — službeno, objavljeno, a nigdje ne
   iskorišteno.
7. **Regulatorni zaključak.** Prelazi li 98. percentil prag od 1,5 ouE/m³ češće
   nego 175 sati godišnje. To je tvrdnja prema kojoj studija cijelo vrijeme ide.
8. **Zdravstveni rizik.** Kvocijent opasnosti za benzen i srodne spojeve; K2 mjeri
   benzen, dakle ulaz postoji.

## Poznata prepreka

Prva provjera nije dobro prošla. Uz 5 160 sati H₂S-a iz 2025., kad vjetar puše s
plohe prema postaji medijan je 1,24 µg/m³, inače 1,07. Smjer se vidi, ali slabo.

Uzrok gotovo sigurno nije mjerenje nego vjetar: ERA5 ima ćeliju od 25 km i
opisuje vrijeme nad Splitom, ne nad Karepovcem. Zato mjerenje vjetra na samoj
plohi (ili barem u kvartu) vjerojatno vrijedi više od svakog daljnjeg posla na
modelu. To ide u plan o fizici modela.

## Mjera uspjeha

Objavljena karta koja kaže koliko sati godišnje miris prijeđe prag, s brojkom
izvedenom iz mjerenja i s poštenim rasponom nesigurnosti.
