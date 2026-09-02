# Izvješće o provjeri modela perjanice s Karepovca

Stanje: 2. 9. 2026. Model i inačica: `ff00376` + promjene u radnom stablu
(nije predano), oznaka fizike `dfbdd21f1f`. Ponovljivo: `docs/hindcast/README.md`.

## 1. Što je provjeravano

Proizvodni čestični model (`src/lib/dim.ts`) nad poljem vjetra iz LiDAR
reljefa (`sim-polje.bin`), vrtjen kroz **17 640 sati** (29. 8. 2024. – 3. 9.
2026.) s ulazima koje bi stranica u tom satu imala: izmjereni vjetar Split-3
(AZO; 99 % sati), arhivirana Open-Meteo prognoza za dubinu sloja, zračenje i
naoblaku (od 7/2025; prije ERA5), bez ikakvog mjerenja kao ulaza.

Istina: satni H₂S s postaje Karepovac 1 (Zavod, 11 974 zajednička sata),
merkaptani s Karepovca 2, i 15 satnih opažanja iz dojava (26.–29. 8. 2026.,
jedan dojavitelj na Dračevcu, jedan u Solinu).

Razdoblja: ugađanje 9/2024–8/2025 (7 104 h), provjera 9/2025–17. 8. 2026.
(4 509 h), zadržano od 18. 8. 2026. (359 h). Ništa nije ugađano na
provjeri ni na zadržanom.

## 2. Brojke

Spearman ρ modela prema H₂S-u na k1; `nulti` je pojas kad se mjerenja
pomaknu za cijele dane; AUC = vjerojatnost da model sat iz gornjih 10 %
rangira iznad običnog; POD/FAR uz prag izjednačen po udjelu.

| vrtnja | ugađanje ρ / AUC | provjera ρ / AUC | zadržano AUC / POD | odluka |
| --- | --- | --- | --- | --- |
| polazno (stranica kakva jest) | 0,108 / 0,583 | 0,132 / 0,539 | 0,446 / 0,28 | osnova |
| E1 AZO na pravi sat | 0,091 / 0,574 | 0,135 / 0,538 | 0,433 / 0,26 | ne |
| E3 spremnik za vijek + satni prosjek | 0,108 / 0,589 | 0,139 / 0,537 | 0,526 / 0,41 | da (bez gubitka) |
| E2 spoj (brzina s otvorenih postaja) | 0,056 / 0,560 | 0,162 / 0,543 | 0,546 / 0,36 | ne (nedosljedno) |
| E4 raspad po razredu stabilnosti | 0,114 / 0,594 | 0,141 / 0,538 | 0,534 / 0,38 | ne (ispod šuma) |
| **E5 difuzija po razredu** | **0,156 / 0,610** | **0,141 / 0,564** | **0,558 / 0,49** | **da** |
| E6 E5 + otjecanje niz padinu | 0,160 / 0,613 | 0,144 / 0,563 | 0,559 / 0,49 | ne (= E5) |
| E7 E5 + raspad po razredu | 0,160 / 0,610 | 0,143 / 0,558 | 0,570 / 0,48 | ne (= E5) |

Nulti pojas na ugađanju je −0,02…+0,05, na provjeri −0,05…+0,13. Nulti
modeli na ugađanju: samo smjer vjetra (sektorski) ρ 0,04; samo 1/brzina
(zastoj) ρ 0,18; perzistencija (prethodni sat mjerenja) 0,85.

Merkaptani: ρ −0,05 na ugađanju (uređaj na granici određivanja), 0,14 na
provjeri. Dojave: AUC 0,24–0,49 u svim vrtnjama — bez razlučivanja.

Bazdarenje (E5): nagib 0,024 µg/m³ po jedinici gustoće (95 % po danima
0,012–0,037), pozadina 1,48 µg/m³; sidro ljestvice 47,2.

## 3. Što je ušlo u proizvodnju

- spremnik čestica dostatan za vijek (`punjenje` 45 → 160 s), pa izvor
  curi jednoliko i pri tišini (prije: 18–100 % nazivne u naletima);
- satni prosjek kadra umjesto trenutka na kraju sata (faza vijuganja je
  pri stalnom vjetru mijenjala gustoću na 700 m i stotinu puta);
- slučajni hod s vrtloženjem po razredu stabilnosti (1/1/1/6/45/120 m²/s,
  Turner iz Open-Meteo zračenja i naoblake) — E5;
- sidro ljestvice 76,2 → 47,2; ponoćni redci u tri parsera.

Po satu i lancu se model sad poklapa (`model.test.ts`), pa je provjera u
lancu 4× jeftinija i vjerna stranici. Potvrda u proizvodnom načinu
(`e5-proizvodnja`) prekinuta je izvana i nije ponovljena.

## 4. Najjači slučajevi

- Noćne epizode uz vjetar s plohe prema k1: sektor niz vjetar ima stopu
  epizoda 17 % naspram 9 % uz vjetar, a model ondje ρ 0,20–0,24
  (`docs/hindcast/polazno.json` → `rezimi.smjer`).
- Tišina (<1 m/s) na provjeri: ρ 0,17, AUC 0,66 — najbolji režim, i onaj u
  kojem E5 najviše dobiva.
- Zima i jesen: ρ 0,16–0,22; ljeto 0,05–0,13.

## 5. Najgori promašaji

Iz `docs/hindcast/kritika-e5.md` i slika u `.cache/hindcast/epizode/`:

1. **22.–23. 5. 2026.**, 8 sati s 27–40 µg/m³ (70× prag) uz ENE vjetar
   3–4 m/s, razred C–E: model daje 0,0 — perjanica ide na zapad. Ili je
   smjer sa Split-3 pogrešan ili izvor nije glavna ploha
   (`promasaj-2026-05-22/`).
2. **Dojave 27.–28. 8. 2026.**: „jako” na Dračevcu u 20 h uz 250° 0,8 m/s —
   model Dračevac 0, k1 4–7; k1 istodobno mjeri 1,9. Zrak je te večeri bio
   na obje strane plohe, model na jednoj (`dojave-2026-08-27/`).
3. **Lažne uzbune** uz zapadnjak 240–300° pri ~1 m/s pod slojem od 25 m
   (razredi B i F): model puni k1 (25–50), k1 mjeri pozadinu.

## 6. Sustavne pristranosti

- **Smjer**: 62 % sati iznad praga na k1 događa se uz vjetar iz sektora u
  kojem k1 stoji uz vjetar (istok–jug); model u 88 % njih daje < 1.
  Model je smjerno prestrog za ono što k1 doista vidi.
- **Doba dana**: model bolji noću (ρ 0,17–0,22) nego danju (0,08–0,12);
  danju uz ≥2 m/s najviše propusta (razredi C/D) — stalan izvor ne
  objašnjava dnevne vrhove.
- **Mjerilo**: nagib na zadržanom razdoblju negativan (−0,01, 95 % −0,04…
  +0,02) — dva tjedna su prekratka za mjerilo.

## 7. Nesigurnost

- Meteorološka: smjer pri <1,5 m/s je šum (P2); Split-3 brzina 2,0 naspram
  3,1 m/s na otvorenim postajama — E2 pokazuje da izbor mijenja ρ za ±0,05
  ovisno o godini.
- Izvora: stalna emisija, 95 % 0,5–2× (`karepovac-bazdarenje.ts`);
  hot-spotovi izmišljeni; sjeverna ploha nije izvor.
- Modela: E3/E5/E7 razlike ±0,005 na 7 000 sati — ispod šuma; ono što nije
  u modelu (lokalni vjetar, otjecanje na SZ strani) ne da se ocijeniti s k1.
- Opažanja: k1 je jedan prijemnik na krivoj strani; AZO-ov izvoz istog
  uređaja nosi 3 696 sati s nulom (kvar) — uzet je Zavodov niz.

Riječi pouzdanosti na stranici (`situacija.ts`): prognoza i modelski vjetar
nikad „visoka”, tišina „niska” — to prati ovdje izmjerene režime.

## 8. Što ostaje nepoznato

- Stvarni vjetar na plohi i na padini prema kvartu (#28, stavke 1–2).
- Koliko H₂S-a na k1 uopće dolazi s glavne plohe (stavka 5 u #28).
- Bilo što o sjeverozapadnoj strani izvan 15 dojava (stavke 4 i 6).
- Vrijedi li E5 i za merkaptane (uređaj se promijenio 10/2025).

## 9. Vrata

- **Znanstvena**: E5 nadmašuje polazni model na ugađanju, provjeri i
  zadržanom razdoblju po ρ, AUC i POD uz istu FAR — prolazi, uz ogradu da je
  vještina i dalje niska (ρ ≈ 0,15) i ograničena ulazima, ne numerikom.
- **Proizvodna**: vidi §10 (UI traka).

## 10. UX provjera

Snimke (proizvodna gradnja, 1280 × 860, `?scenarij=…&snimka=1`) u
`.cache/hindcast/ux/poslije/`: `jak-sada`, `jak-minus6`, `jak-plus3`,
`nesiguran-sada`, `okret-sada`, `nista-sada`. Prije: `.cache/hindcast/ux/prije/`.

Pitanje: razumije li netko u Splitu situaciju u pet sekundi?

- **Sada (jak)**: kartica gore lijevo: „Moguć miris — Dračevac moguće,
  Bilice moguće; nosi prema zapadu; jača; pouzdanost visoka”; ispod vjetar
  i izvor; legenda moguće/osjetno/jako. Karta: podloga (OpenFreeMap), ploha
  crtkano, perjanica blijeda prema zapadu, tragovi vjetra. **Da.**
- **−6 h**: „Nema naznaka mirisa u naseljima — perjanica ne dotiče nijedno
  naselje”, uz „oko 20 h: jače (moguće)” — sljedeća promjena je vidljiva
  bez pomicanja klizača. **Da.**
- **+3 h (prognoza)**: natpis „prognoza +3 h”, pouzdanost **niska** s
  razlogom (model, ne postaja), perjanica sivlja i prošarana. Prognoza se
  razlikuje od prošlosti bez čitanja. **Da.**
- **Nesiguran**: „Ne znamo pouzdano — model za ovaj sat nema pouzdan
  vjetar, pa ‚ništa' ne znači ‚čisto'”, oznaka „vjetar iz modela”, tišina.
  „Ne znamo” je razdvojeno od „ne smrdi”. **Da.**
- **Ništa**: „Nema naznaka mirisa u naseljima”, vjetar 4,5 m/s prema
  istoku, pouzdanost visoka. **Da.**
- **Okret**: kartica za 19 h: „Sirobuja moguće, nosi prema jugu, jača,
  oko 20 h slabije”. Traka pokazuje gdje je bilo žuto. **Da.**
- **Crta**: −24 h … sada … +3 h s pločicama po satu obojenima razinom,
  noćni sati označeni, prognoza prošarana, gumb za reprodukciju. **Da.**

Što ne prolazi ili nije provjereno:

1. **Mobilni prikaz (390 × 844) nije snimljen** — alat ne da prozor uži od
   ~500 px. Kod ima raspored za uske zaslone (kartica gore, traka dolje,
   ploča kao donja ploha), ali bez slike ostaje neprovjereno.
2. **Perjanica pri razini „moguće” je vrlo blijeda** (žuta uz 33 %
   neprozirnosti nad sivom podlogom čita se kao sivkasta mrlja). Kartica
   nosi poruku, karta jedva. Vrijedi podići dno ljestvice ili obrubiti
   pojas „moguće”.
3. **Prvi crtež karte u skrivenoj kartici** kasni desetke sekundi — ne tiče
   se korisnika (rAF u pozadini), ali automatska snimka mora čekati i
   „dodirnuti” kartu; zapisano u `simulator.tsx` uz `?snimka=1`.
4. Scenarij „jak” daje samo „moguće” na 1 km: to je nalaz modela (E5 uz
   sidro 47,2), ne greška prikaza — ali znači da „jako” na kartici nitko
   još nije vidio; treba stvarni jak sat (npr. 22. 5. 2026.) kao scenarij.

**Proizvodna vrata: prolaze uz ograde 1 i 2.** Popravci koji su ušli
usput: podloga bez API ključa (OpenFreeMap), MapLibreov radnik se poslužuje
iz `public/` (Turbopackov paket radnika visi), `?snimka=1` za ponovljive
snimke.

## 11. Drugi krug sučelja (2. 9. 2026., popodne)

- Tragovi vjetra preko cijelog zadanog pogleda (okvir roja 2× polja; izvan
  polja rubna vrijednost, dakle vjetar na otvorenom bez reljefa).
- Vjetar koji vodi kartu je Neverinov Vrboran; rok dohvata spušten na pet
  minuta i stranica se osvježava svakih pet, pa je očitanje isto kao na
  neverin.hr (provjereno: 148°, 0,7 m/s, nalet 1,5, 15:25).
- Klik na kartu daje karticu za to mjesto (razina, trend, pouzdanost, traka
  po satima) i gumb za dojavu s mjestom već upisanim.
  Snimke: `jak-sada-1280-tragovi.jpg`, `jak-sada-1280-tocka.jpg`.

## 12. Predložene postaje na karti

Devet mjesta iz #28 kao crtkane oznake (faza A tikvina, B modra, C siva);
klik otvara karticu s veličinama, opremom, okvirnom cijenom stavke i cijele
faze, razlogom za to mjesto i što treba dogovoriti. Snimka:
`prijedlog-jarbol-1280.jpg`.
