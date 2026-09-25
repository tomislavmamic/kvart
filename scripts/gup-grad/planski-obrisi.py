#!/usr/bin/env python3
"""Obrisi područja iz prijedloga GUP-a 2025. u kojima nova gradnja čeka UPU.

Prijedlog izmjena GUP-a (travanj 2025., čl. 103) na listu 4.d „Područja i
dijelovi primjene planskih mjera zaštite” ispunom označava tri vrste
područja u kojima se gradi tek na temelju urbanističkog plana uređenja:
urbanu sanaciju, urbanu preobrazbu i neuređeni dio neizgrađenog
građevinskog područja. planski-rezim.py ih je već nacrtao na rešetku od 2 m
(bitovi SANACIJA, PREOBRAZBA, NEUREDENO u pr-gup-2025.npy); ovdje se ta
rešetka pretvara u poligone za kartu /gup, da se vidi gdje ta područja jesu,
neovisno o česticama.

Izlaz: public/geo/gup-grad/planski-rezim-2025.geojson (EPSG:4326), svojstva
  vrsta  sanacija | preobrazba | neuredeno
  ha     površina poligona

Pokretanje:  python scripts/gup-grad/planski-obrisi.py   (poslije planski-rezim.py)
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import shapely
from affine import Affine
from pyproj import Transformer
from rasterio import features
from scipy import ndimage
from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

VRSTE = [("sanacija", 4), ("preobrazba", 8), ("neuredeno", 16)]
NAJMANJE_HA = 0.3      # sitnije mrlje su rubovi ispune, ne područja
POJEDNOSTAVI_M = 3.0
IZLAZ = os.path.join(R.ROOT, "public", "geo", "gup-grad", "planski-rezim-2025.geojson")


def main() -> None:
    g = np.load(os.path.join(R.OUT, "pr-gup-2025.npy"))
    transform = Affine(R.KORAK, 0, R.MREZA_BBOX[0], 0, -R.KORAK, R.MREZA_BBOX[3])
    u4326 = Transformer.from_crs(3765, 4326, always_xy=True)
    feats = []
    for vrsta, bit in VRSTE:
        m = (g & bit) > 0
        # spoji ispunu koju su šrafure i natpisi na listu rascjepkali, pa ukloni mrvice
        m = ndimage.binary_closing(m, iterations=2)
        m = ndimage.binary_opening(m, iterations=1)
        polig = [shape(geom) for geom, v in features.shapes(m.astype(np.uint8), mask=m, transform=transform) if v == 1]
        if not polig:
            continue
        spojeno = shapely.union_all(polig).buffer(0)
        dijelovi = list(getattr(spojeno, "geoms", [spojeno]))
        ukupno = 0.0
        for d in dijelovi:
            ha = d.area / 1e4
            if ha < NAJMANJE_HA:
                continue
            d = d.simplify(POJEDNOSTAVI_M, preserve_topology=True)
            d = shapely.transform(d, lambda xy: np.column_stack(u4326.transform(xy[:, 0], xy[:, 1])))
            d = shapely.set_precision(d, 1e-6)
            feats.append({
                "type": "Feature",
                "geometry": json.loads(shapely.to_geojson(d)),
                "properties": {"vrsta": vrsta, "ha": round(ha, 2)},
            })
            ukupno += ha
        print(vrsta, sum(1 for f in feats if f["properties"]["vrsta"] == vrsta), "poligona,", round(ukupno, 1), "ha")
    with open(IZLAZ, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "opis": "Izvedeno skriptom scripts/gup-grad/planski-obrisi.py iz lista 4.d prijedloga GUP-a (travanj 2025.).",
            "features": feats,
        }, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", IZLAZ, round(os.path.getsize(IZLAZ) / 1e3), "kB")


if __name__ == "__main__":
    main()
