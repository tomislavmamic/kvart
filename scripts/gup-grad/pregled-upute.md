# Pregled čestica na ortofotu — upute za pregledatelja

Ove upute dobiva svaki pregledatelj (čovjek ili model) zajedno sa serijom
slika iz `.cache/gup-grad/pregled/slike/` (vidi scripts/gup-grad/pregled.py).

Svaka slika je ortofoto (DGU 2023, pogled odozgo) jedne katastarske čestice u Splitu:

- **debeli crveni obris** = čestica koju ocjenjuješ
- tanki bijeli obrisi = susjedne čestice
- **cijan obrisi** = zgrade koje su VEĆ u podacima (3D model grada)
- mogući vodeni žig „GEOPORTAL” preko sredine — zanemari ga

Naš model tvrdi da je na toj čestici velik dio zemljišta **slobodan za gradnju**
(neizgrađen, bez ceste, parkirališta, parka…). Tvoj posao: pogledati što
se STVARNO vidi UNUTAR crvenog obrisa i reći je li to točno.

## Najčešće pogreške — pazi

- **Prirodna vegetacija NIJE `zelenilo`.** Makija, šikara, šuma, maslinik,
  voćnjak, vinograd, livada, oranica, zapušteni vrt → `slobodno`. `zelenilo`
  je samo UREĐENO: park sa stazama, pokošeni travnjaci i drvoredi između
  stambenih zgrada, uređeno blokovsko zelenilo.
- **`izgradjeno` samo ako unutar crvenog obrisa stoje krovovi BEZ cijan
  obrisa** (zgrade koje u podacima nedostaju). Zgrade s cijan obrisom su već
  uračunate — ne ocjenjuj njih nego PROSTOR IZMEĐU njih.
- Prostor između stambenih zgrada na istoj čestici (naselja višestambenih
  zgrada): parkirališta → `parkiraliste`, uređeni travnjaci/staze/igrališta
  → `zelenilo` ili `uredjeno`.
- Ocjenjuj SAMO ono unutar crvenog obrisa, ne cijelu sliku.

## Kategorije (za PRETEŽITI neizgrađeni dio unutar crvenog obrisa)

| kategorija | kad |
|---|---|
| `slobodno` | doista neizgrađeno zemljište: livada, makija, šikara, šuma, maslinik, vinograd, oranica, zapušteno, golo tlo, prazna parcela, veliki privatni vrt bez zgrade |
| `parkiraliste` | asfaltirana/šljunčana površina s parkiranim autima ili iscrtanim mjestima |
| `zelenilo` | uređeni park, uređene travnate površine između zgrada, drvoredi, šetnice kroz zelenilo |
| `uredjeno` | igralište, športski teren, dječje igralište, trg, pješačka popločana površina |
| `javna` | dvorište/okoliš škole, vrtića, bolnice, crkve |
| `gradiliste` | gradilište: iskop, dizalica, temelji, zgrada u izgradnji |
| `izgradjeno` | unutar obrisa stoje zgrade/krovovi koji NISU obrubljeni cijan bojom i pokrivaju veći dio slobodnog dijela |
| `promet` | cesta, put, okretište, prilazni asfalt, dvorište s asfaltom bez parkiranja |
| `infrastruktura` | trafostanica, vodosprema, benzinska, pruga, kanal |
| `neizgradivo` | stijena, strma litica, kamenolom, korito potoka/bujice, plaža/more |
| `nejasno` | ne može se procijeniti (sjena, oblak, preveliko/premalo) |

Ako je neizgrađeni dio mješavina, odaberi kategoriju koja pokriva NAJVIŠE
neizgrađenog dijela čestice i u `udio` procijeni koliki je to dio
neizgrađenog dijela (0.0–1.0). U `drugo` napiši drugu kategoriju ako
postoji i pokriva barem ~25 %.

## Izlaz

Za svaku sliku jedan JSON objekt u zasebnom retku (JSON Lines):

```json
{"n": 17, "kategorija": "parkiraliste", "udio": 0.7, "drugo": "zelenilo", "sigurnost": "visoka", "opis": "veliko parkiralište između stambenih zgrada, uz rub travnjak"}
```

`sigurnost`: `visoka` (očito), `srednja`, `niska`. `opis`: najviše 15 riječi, hrvatski.
