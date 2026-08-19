# Koja postaja smije voditi kartu zraka

**Provjereno 19. 8. 2026.** Ponovljivo: `npm run provjeri-vjetar`
(`scripts/provjeri-izvore-vjetra.py`).

Karta na `/karepovac` uzima smjer i brzinu s najbliže postaje koja ih u tom satu
objavljuje. Pitanje je bilo je li „najbliža” ujedno i „najbolja”, pa su četiri
izvora ocijenjena na izmjerenom H₂S-u uz samu plohu.

## Kako je mjereno

Postaja **Karepovac** (AZO 308, mreža Čistoće d.d.) leži 737 m od središta
plohe, na azimutu 144°. Zrak s plohe dolazi na nju kad vjetar puše iz
sjeverozapadnog kvadranta, pa se svaki izvor vjetra može ocijeniti bez ijedne
pretpostavke o jačini izvora: pogađa li **kada** je postaja nizvjetar i **kada**
se zrak ne razrjeđuje.

- razdoblje: 1. 1. 2024. – 19. 8. 2026., **9 904 sata** na kojima sva četiri
  izvora i plin imaju podatak;
- H₂S: medijan 1,08 µg/m³, 90. percentil 2,43 (pozadina se poklapa s ranije
  izvedenih 1,07 µg/m³);
- epizoda = sat iznad 90. percentila; epizode su **2,5× češće u 21 h nego u
  13 h**, što potvrđuje da je riječ o noćnom zastoju zraka;
- dnevni hod se vadi iz obiju serija (medijan po satu dana) prije računanja
  veze — inače se mjeri doba dana, a ne prijenos;
- **nulti model:** sve mjere ponovljene su na plinu pomaknutom u vremenu za
  višekratnik 24 sata. Bez tog pojasa ρ = 0,08 zvuči kao nalaz;
- vjetar s Marjana i zračne luke uzet je iz Meteostatova niza **`hourly/obs`**,
  dakle isključivo izmjereno. Spojeni niz rupe popunjava modelom i time bi u
  usporedbu vratio ERA5, koji je već jednom bio odbačen.

## Rezultat

Noć (21–06 h), 2 513 sati — kad se epizode i događaju:

| izvor | medijan brzine | ρ(H₂S, brzina) bez dnevnog hoda | nulti pojas | nizvjetar/uzvjetar | AUC epizode |
| --- | --- | --- | --- | --- | --- |
| Split-3 (AZO, 4,3 km) | 1,8 m/s | **−0,140** | ±0,07 | 1,43 | 0,537 |
| Split-2 (AZO, 4,6 km) | 1,4 m/s | **−0,153** | −0,09 do 0,11 | 1,19 | 0,510 |
| Split-Marjan (6 km) | 3,1 m/s | **−0,154** | −0,08 do 0,06 | 1,38 | **0,592** |
| Zračna luka LDSP (16 km) | 2,5 m/s | −0,028 | ±0,07 | 1,07 | 0,505 |

Na svim satima smjer prolazi bolje nego što se očekivalo: **Split-3, Marjan i
LDSP svi stavljaju vrh H₂S-a u sektor 315°**, a geometrija traži 324° — dakle
promašaj od 9°. Potpis plohe stvarno se vidi u smjeru vjetra. Split-2 promašuje
za 69°, ali mu se smjer od Split-3 razlikuje medijanom samo 24°, pa je vjerojatnije
da je vrh šumovit (svega 2,2 % sati mu je nizvjetar) nego da mu je vjetrulja kriva.

## Što iz toga slijedi

1. **Zračna luka noću ne zna ništa.** ρ = −0,03 i AUC 0,505 leže usred nultog
   pojasa; njezina 1/brzina je čak ispod 0,5. Sat po sat, njezin vjetar ne
   opisuje zastoj zraka nad kvartom. Noću tvrdi da je postaja nizvjetar u 54 %
   sati (Marjan 18 %, Split-3 5 %) — to je vlastito noćno strujanje s Kozjaka
   niz otvorenu ravnicu, koje nad kvartom ne vrijedi.
2. **Gradske postaje i Marjan znaju nešto.** ρ ≈ −0,15, dvostruko izvan nultog
   pojasa; Marjan je najbolji na epizodama (AUC 0,592).
3. **Ali „nešto” je i dalje malo.** Najbolji izvor pogađa epizodu s 0,59 —
   jedva iznad bacanja novčića. Ovo ostaje slaganje sa zastojem zraka, ne s
   mirisom, točno kako je ranije i utvrđeno.

Zato redoslijed u `src/lib/vjetar.ts` glasi **Split-3 → Marjan → Split-2 →
Split-aerodrom → LDSP**: zračna luka je posljednja iako je jedina koja uvijek
javi, a Marjan je iznad Splita-2 iako je dalje. Kad kartu ipak vodi zračna luka,
uz nju stoji ograda da joj noćni vjetar nije prošao ovu provjeru.

## Što ovo ne rješava

Marjan je najbolji, a njegov vjetar DHMZ **ne objavljuje** u satnom izvještaju
(stoji „−” iako postaja mjeri i šalje u SYNOP). Uživo ga se može dobiti samo
preko tuđeg releja, što nije za pogon. Vrijedi ga zatražiti od DHMZ-a.

Na samoj plohi anemometra i dalje nema — obje postaje uz Karepovac vraćaju
prazno za brzinu i smjer. Sve gore je zaključivanje s 4 do 16 km udaljenosti.
