#!/usr/bin/env python3
"""Izvoz čestica iz spremišta (osvjezi.py) kao GeoJSON u EPSG:4326.

Zamjena za `ogr2ogr -spat … -t_srs EPSG:4326` nad cestice.gpkg, za stroj
bez GDAL-ovih alata: dovoljan je pyogrio, koji GDAL nosi u sebi.

  izvezi.py --bbox 16.48 43.51 16.52 43.54 --polja KO_NAZIV:ko,KC_BROJ:cestica

Uzima čestice koje sijeku okvir (zadan u WGS84), zadržava samo navedena
polja pod novim imenima i piše GeoJSON na stdout (ili u --izlaz), s
koordinatama na 6 decimala (~0,1 m), kao import-split-gis.
"""
from __future__ import annotations

import argparse
import json
import sys

import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.geometry import box

from spremiste import cestice, jednodijelne


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--bbox", nargs=4, type=float, required=True, metavar=("ZAPAD", "JUG", "ISTOK", "SJEVER"))
    ap.add_argument("--polja", required=True, help="IZVORNO:novo,… (ostala polja otpadaju)")
    ap.add_argument("--izlaz", help="datoteka; bez nje stdout")
    args = ap.parse_args()

    polja = dict(p.split(":", 1) for p in args.polja.split(","))
    okvir = box(*args.bbox)
    # Okvir u sustav sloja; rub se progušćuje da zakrivljenje ne odreže kut.
    rub = np.asarray(okvir.segmentize(0.001).exterior.coords)
    x, y = Transformer.from_crs(4326, 3765, always_xy=True).transform(rub[:, 0], rub[:, 1])

    c = pyogrio.read_dataframe(cestice(), layer="cestice", columns=list(polja),
                               bbox=(min(x), min(y), max(x), max(y))).to_crs(4326)
    c = c[c.intersects(okvir)]
    geometrije = shapely.transform(jednodijelne(c.geometry.values), lambda k: np.round(k, 6))
    svojstva = c[list(polja)]
    svojstva = svojstva.astype(object).where(svojstva.notna(), None).rename(columns=polja)

    znacajke = [
        {"type": "Feature", "properties": p, "geometry": json.loads(shapely.to_geojson(g))}
        for p, g in zip(svojstva.to_dict("records"), geometrije)
    ]
    tekst = json.dumps({"type": "FeatureCollection", "features": znacajke},
                       ensure_ascii=False, separators=(",", ":"))
    if args.izlaz:
        with open(args.izlaz, "w", encoding="utf-8") as f:
            f.write(tekst)
    else:
        sys.stdout.write(tekst)


if __name__ == "__main__":
    main()
