#!/usr/bin/env python3
"""Ono što plan na snazi propisuje na točno određenom mjestu, s lista samog plana.

Obuhvat plana (ispu.py) kaže samo da se ondje gradi po planu. Neke odredbe
plana vežu se uz mjesto koje se na terenu da provjeriti — drvored uz rub
čestice, pojedina stabla — i nacrtane su na grafičkom dijelu plana. Ovdje se
čitaju s istog georeferenciranog lista na ISPU-u i spremaju kao točke. Tekst
odredbe i gdje stoji u odluci je u src/lib/gup-grad/planovi-na-snazi.ts, pod
istim ključem.

DPU dijela područja Dračevac (Sl. gl. 23/04), čl. 6., t. 2.6: „Uz južnu
granicu parcele zasaditi drvored visokih stablašica (zelenilo u potezu)”.
Listovi 2. Promet (ISPU IS_1_1) i 3. Uvjeti korištenja (KN_2_2) crtaju ista
19 stabala, svako svojom krošnjom promjera ~3,8 m: 11 u drvoredu uz južnu
granicu i 8 uz građevinu 2, na istoku čestice. List 4. Uvjeti gradnje isti
drvored crta shematski, kao 13 zelenih krugova jedan do drugoga.

Krošnje su nazubljeni krugovi preko drugih crta (međe, kote), pa ih
automatsko traženje krugova ne razlikuje pouzdano od sjecišta crta. Zato su
središta u STABLA očitana s lista ručno, na pola metra, a skripta svako
primiče središtu nacrtane krošnje (najtamniji prsten polumjera krošnje
unutar PRIMICANJE_M) — tako je točka na krošnji i kad se list na ISPU-u
pomakne za koji metar.

Izlaz: public/geo/gup-grad/elementi-planova.geojson (EPSG:4326), po jedna
MultiPoint značajka za svaku odredbu, svojstva
  ispu      oznaka plana na ISPU-u (DPU5), kao u planski-rezim-2025.geojson
  odredba   ključ odredbe u planovi-na-snazi.ts

Pokretanje:  python scripts/gup-grad/elementi-planova.py
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import shapely
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ispu  # noqa: E402

IZLAZ = os.path.join(ispu.ROOT, "public", "geo", "gup-grad", "elementi-planova.geojson")
KORAK_M = 0.05
KROSNJA_M = (1.4, 2.1)  # prsten nazubljenog ruba krošnje, od središta
JEZGRA_M = 1.1          # unutrašnjost krošnje je prazna
PRIMICANJE_M = 1.25

# (E, N) u EPSG:3765, očitano s lista 2. Promet, od zapada prema istoku
ELEMENTI = [
    {"ispu": "DPU5", "list": "IS_1_1", "odredba": "drvored", "stabla": [
        (500107.5, 4820843.0), (500112.5, 4820843.0), (500118.5, 4820842.5), (500123.0, 4820842.5),
        (500127.5, 4820843.0), (500132.0, 4820843.0), (500136.5, 4820843.0), (500141.5, 4820843.0),
        (500146.0, 4820843.0), (500151.0, 4820843.0), (500156.0, 4820843.5),
    ]},
    # uz južnu i istočnu stranu građevine 2, od juga prema sjeveru
    {"ispu": "DPU5", "list": "IS_1_1", "odredba": "stabla-gradevina-2", "stabla": [
        (500174.0, 4820845.0), (500180.0, 4820845.5), (500184.0, 4820845.5), (500184.0, 4820850.5),
        (500184.5, 4820855.5), (500184.5, 4820860.5), (500184.5, 4820866.0), (500184.0, 4820870.5),
    ]},
]


def stabla(e: dict) -> list[tuple[float, float]]:
    """Središta krošanja (EPSG:3765), primaknuta crtežu na listu."""
    ime, okvir = ispu.slojevi()[e["ispu"]]
    a, tf = ispu.slika(ime.replace(ispu.LIST, e["list"]), okvir, korak=KORAK_M)
    tamno = ((a[..., :3] < 110).all(axis=2) & (a[..., 3] >= 128)).astype(float)
    r = int(KROSNJA_M[1] / KORAK_M) + 2
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1] * KORAK_M
    rr = np.hypot(xx, yy)
    prsten = ((rr >= KROSNJA_M[0]) & (rr <= KROSNJA_M[1])).astype(float)
    jezgra = (rr <= JEZGRA_M).astype(float)
    # tamno na rubu krošnje, a svijetlo u njoj (jezgra kažnjava crte i natpise)
    ocjena = (fftconvolve(tamno, prsten[::-1, ::-1] / prsten.sum(), mode="same")
              - 2 * fftconvolve(tamno, jezgra[::-1, ::-1] / jezgra.sum(), mode="same"))
    d = int(PRIMICANJE_M / KORAK_M)
    out = []
    for E, N in e["stabla"]:
        c, rd = int((E - tf.c) / tf.a), int((N - tf.f) / tf.e)
        prozor = ocjena[rd - d:rd + d + 1, c - d:c + d + 1]
        j, i = np.unravel_index(np.argmax(prozor), prozor.shape)
        out.append((tf.c + (c - d + i + 0.5) * tf.a, tf.f + (rd - d + j + 0.5) * tf.e))
    pomak = [np.hypot(x - E, y - N) for (x, y), (E, N) in zip(out, e["stabla"])]
    print(f"  {e['ispu']} {e['odredba']}: {len(out)} stabala, primaknuto najviše {max(pomak):.2f} m")
    return out


def main() -> None:
    feats = []
    for e in ELEMENTI:
        tocke = ispu.u_4326(shapely.MultiPoint(stabla(e)))
        feats.append({"type": "Feature", "geometry": json.loads(shapely.to_geojson(tocke)),
                      "properties": {"ispu": e["ispu"], "odredba": e["odredba"]}})
    with open(IZLAZ, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "opis": "Izvedeno skriptom scripts/gup-grad/elementi-planova.py "
                   "s listova planova na ISPU-u.", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", IZLAZ)


if __name__ == "__main__":
    main()
