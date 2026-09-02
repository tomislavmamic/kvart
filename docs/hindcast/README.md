# Povijesna provjera modela (hindcast)

Kako se ponavlja svaka brojka u `docs/STATUS.json` i u `docs/hindcast/*.json`.

## Podatci

Sve leži u `.cache/hindcast/` (nije u repozitoriju):

| mapa | sadržaj | odakle |
| --- | --- | --- |
| `azo/` | satni izvoz AZO-a u komadima od 40 dana: 308/4 (H₂S Karepovac), 305/477+478 (Split-3 vjetar), 304/477+478 (Split-2) | `iszz.azo.hr/iskzl/rs/podatak/export/json`, ograda ≥ 5 s među pozivima |
| `zavod/` | mjesečne tablice `k1Tab<GGGGMM>.html`, `k2Tab…` | `zrak-zavod-split.info` |
| `meteo/` | ERA5 arhiva, arhivirana Open-Meteo prognoza (`historical-forecast-api`), LDSP METAR | Open-Meteo, mesonet.agron.iastate.edu |
| `../vjetar/meteostat-14445.csv.gz` | Split-Marjan satna opažanja | Meteostat bulk |
| `runs/<id>/` | ulazi, parametri, predikcije, ocjena, snimke i slike jedne vrtnje | `pokreni.ts` |

Dojave su u `data/dojave.json` (`npm run izvezi-dojave`).

## Vrtnja

```
npx tsx scripts/hindcast/pokreni.ts --id <ime> --od 2024-08-29 --do 2026-09-03 \
  [--pravilo proizvodnja|spoj|split3|marjan|ldsp|prognoza|era5] \
  [--nacin proizvodnja|lanac] [--uzoraka 6] [--azoKasni] \
  [--postavke docs/hindcast/postavke/<ime>.json] [--radnika 6] [--snimke epizode|nista]
```

- `--nacin proizvodnja` računa svaki sat iz hladnog starta kao stranica (vjerno, 4× skuplje); `lanac` vrti jedan neprekinut lanac. Poklapaju se tek uz `punjenje ≥ vijek` i `--uzoraka 6` (vidi `model.ts`).
- `--azoKasni` označuje AZO-ov vjetar sat kasnije, kao što stranica danas radi (P8).
- `--uzoraka 6` daje satni prosjek gustoće umjesto trenutka na kraju sata; mjerenja su satni prosjeci.
- Sažetak ide u `docs/hindcast/<id>.json` i u `docs/STATUS.json` → `pokusi`.

Epizode: `docs/hindcast/epizode.json` (39, izvedene pravilima iz `epizode.ts`; `--prepisi` za novu knjižnicu).

## Što je što u ocjeni

`ρ` je Spearman modela prema H₂S-u na k1 (Zavod), `bez hoda` isto nakon što se iz obiju serija izvadi medijan po satu dana, `nulti` je pojas Spearmana kad se mjerenja pomaknu za cijele dane (ispod toga brojka ne znači ništa), `AUC` je vjerojatnost da model sat iz gornjih 10 % rangira iznad običnoga, `POD`/`FAR` su pogodak i lažna uzbuna uz prag modela izjednačen po udjelu. Nulti modeli (`klimatologija`, `perzistencija`, `sektorski` = samo smjer vjetra, `zastoj` = samo 1/brzina) stoje uz svaku vrtnju.

Razdoblja: `ugadjanje` 2024-09-01 → 2025-09-01, `provjera` → 2026-08-18, `zadrzano` od 2026-08-18. Ništa se ne ugađa na `provjera` ni na `zadrzano`.
