#!/usr/bin/env python3
"""Gdje stoje postaje s kojih uzimamo vjetar — jedno mjesto za njihove koordinate.

Vjetar je jedini ulaz modela raspršenja koji je doista **izmjeren**. Sve ostalo
je izvod: polje vjetra iz reljefa, dubina sloja iz modela, jačina izvora iz
regresije. Zato je važno gdje su ti anemometri, a odgovor je neugodan: nijedan
nije bliže od četiri kilometra, i svi su na zapadu, u gradu ili iza Kozjaka.

Na samom Karepovcu anemometra nema. Obje postaje uz plohu (`scripts/postaje.py`)
u AZO-ovoj bazi vraćaju prazno za brzinu i smjer vjetra — provjereno 19. 8. 2026.

Od 29. 8. 2026. tu su i četiri Neverinove postaje, s pisanim dopuštenjem
vlasnika za naslijeđeni API (`api.neverin.hr/v2`) — vidi
`docs/neverin-postaje.md`. Vrboran je prvi anemometar unutar kilometra i pol
od plohe. Uvjet dopuštenja je navođenje izvora, pa "Neverin.hr" stoji u
`mreza` i ide svugdje gdje se postaja imenuje.

Koordinate se ne prepisuju iz teksta nego imaju podrijetlo, po postaji:

- **Split-2 i Split-3** — nađene na terenu (22. 8. 2026.). Slažu se s AZO-ovim
  službenim popisom (`https://iszz.azo.hr/iskzl/koordinate.htm`, REST
  `/iskzl/rs/postaja/koordinate`) na 25 odnosno 22 m, pa se popis time i
  potvrđuje, a uzima se izmjereno.
- **Split-Marjan** — DHMZ-ov popis glavnih meteoroloških postaja, koji stoji u
  repozitoriju kao `data/sources/popis_osnovne_mreze_meteoroloskih_postaja.xlsx`
  (43° 30′ 30,0″ N, 16° 25′ 34,8″ E, 122 m).
- **Split-aerodrom i LDSP** — ista lokacija, Resnik. Koordinata dolazi iz istog
  METAR servisa iz kojega dolazi i vjetar (`aviationweather.gov`, polja `lat`,
  `lon`, `elev`), pa se izvor podatka i izvor položaja ne mogu raziću.

Udaljenosti se ovdje ne pišu nego računaju — vidi `izvedi-karepovac-karticu.py`,
koji ih izvodi prema središtu kvarta i prema težištu plohe. Dvije referentne
točke jer se u tekstu koriste obje: sučelje kaže „N km od kvarta”, a rasprava o
modelu mjeri od izvora.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PostajaVjetra:
    """Jedan anemometar i njegovo mjesto.

    Attributes:
        oznaka: Ključ kojim se postaja vodi u `src/lib/vjetar.ts`.
        naziv: Ime kako ga objavljuje vlasnik postaje.
        mreza: Tko je vodi.
        lat: Zemljopisna širina u stupnjevima, WGS84.
        lon: Zemljopisna dužina u stupnjevima, WGS84.
        visina: Nadmorska visina u metrima, ili `None` ako je izvor ne navodi.
        podrijetlo: Odakle koordinata, u jednoj rečenici.
    """

    oznaka: str
    naziv: str
    mreza: str
    lat: float
    lon: float
    visina: float | None
    podrijetlo: str


#: Redoslijed je isti kao `POSTAJE` u `src/lib/vjetar.ts`, od najbliže dalje.
POSTAJE_VJETRA = (
    PostajaVjetra(
        "vrboran",
        "Split-Vrboran",
        "Neverin.hr",
        43.515261,
        16.496216,
        74.0,
        "api.neverin.hr, polja lat/lon/alt postaje; Neverinova vlastita postaja",
    ),
    PostajaVjetra(
        "pujanke",
        "Split-Pujanke",
        "Neverin.hr",
        43.516,
        16.473,
        82.0,
        "api.neverin.hr, polja lat/lon/alt postaje",
    ),
    PostajaVjetra(
        "solin",
        "Solin",
        "Neverin.hr",
        43.544,
        16.484,
        63.0,
        "api.neverin.hr, polja lat/lon/alt postaje",
    ),
    PostajaVjetra(
        "split3",
        "Split-3",
        "AZO, državna mreža",
        43.50421139510805,
        16.453605895567744,
        None,
        "nađeno na terenu; AZO-ov popis daje 43,504167 / 16,453333 (22 m)",
    ),
    PostajaVjetra(
        "split2",
        "Split-2",
        "AZO, državna mreža",
        43.5184711569566,
        16.44246833781461,
        None,
        "nađeno na terenu; AZO-ov popis daje 43,518333 / 16,442222 (25 m)",
    ),
    PostajaVjetra(
        "zrnovnica",
        "Žrnovnica",
        "Neverin.hr",
        43.519,
        16.56,
        32.0,
        "api.neverin.hr, polja lat/lon/alt postaje; niz stoji od 2. 2. 2025.",
    ),
    PostajaVjetra(
        "marjan",
        "Split-Marjan",
        "DHMZ, glavna meteorološka postaja",
        43.508333,
        16.426333,
        122.0,
        "DHMZ-ov popis glavnih postaja, 43° 30′ 30,0″ N / 16° 25′ 34,8″ E",
    ),
    PostajaVjetra(
        "aerodrom",
        "Split-aerodrom",
        "DHMZ, glavna meteorološka postaja",
        43.539,
        16.301,
        16.0,
        "Resnik; koordinata iz METAR servisa za LDSP",
    ),
    PostajaVjetra(
        "ldsp",
        "LDSP, Zračna luka Split",
        "METAR",
        43.539,
        16.301,
        16.0,
        "aviationweather.gov, polja lat/lon/elev za LDSP",
    ),
)
