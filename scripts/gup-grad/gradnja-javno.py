#!/usr/bin/env python3
"""Javno zemljište i gradski projekti za kartu /gup/gradnja.

Javno zemljište (Republika Hrvatska, Grad Split, Splitsko-dalmatinska
županija) nije zemljište na kojem stanar može graditi, pa ga karta vodi kao
zaseban odgovor, izgrađeno ili ne. Vlasnik je iz GIS izvoza Grada
(KatastarskeCestice.shp, stupac zku_status, stanje 3. 10. 2025.). Taj izvoz
nosi i osobne podatke, pa se ovdje iz njega uzima SAMO je li vlasnik RH, JLS
ili DNŽ, i ništa drugo ne izlazi. Izvoz vlasnika ne zna za većinu čestica
(~60 % zemljišta u obuhvatu GUP-a nema upisan status), pa javnog zemljišta
ima i više nego što karta pokazuje. Vojna zona (Lora) ondje nije upisana kao
državna; nju karta prepoznaje po namjeni N (gradnja.ts).

Gradski projekt (urbano pravilo GP s lista 4.c) gradi se tek po odobrenom
projektu i samo ono što projekt kaže, pa slobodno zemljište ondje nije za
gradnju dok projekta nema. Čestice s pravilom GP su iz pločica čestica
(cestice.py, `u`).

Oboje se precrta na istu mrežu kao pločice dijelova čestice (regije.py), po
obliku čestice — izvoz Grada ima svoju podjelu na čestice, pa se ne spaja
po broju nego po mjestu.

Ulaz:  Split Export/SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/KatastarskeCestice.shp
       (lokalno, nije u gitu), public/geo/gup-grad/regije.json i pločice,
       public/geo/gup-grad/cestice
Izlaz: data/gup-grad/javno-2025/<red>_<stupac>.png — bitovi 0–1 vlasnik
       (1 RH, 2 Grad, 3 županija), bit 2 gradski projekt; čita ih gradnja.ts

Pokretanje (prije gradnja.ts):  /opt/homebrew/bin/python3 scripts/gup-grad/gradnja-javno.py
"""
from __future__ import annotations

import glob
import json
import os
import shutil
import sys

import numpy as np
import pyogrio
from PIL import Image
from pyproj import Transformer
from rasterio import features
from rasterio.transform import Affine
from shapely.geometry import shape
from shapely.ops import transform as stransform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

JAVNO = os.path.join(R.ROOT, "public")
IZLAZ = os.path.join(R.ROOT, "data", "gup-grad", "javno-2025")
PLOCICA = 512
# isti izvoz kao cestice.py: u radnoj kopiji, inače u glavnoj
IZVOZ = os.path.join(R.ROOT, "data", "sources", "Split Export")
if not os.path.isdir(IZVOZ):
    IZVOZ = os.path.join(os.path.expanduser("~"), "projects", "kvart", "data", "sources", "Split Export")
VLASNISTVO = os.path.join(IZVOZ, "SPLIT_EXPORT_BAZA", "KOMUNALNA_INFRASTRUKTURA", "KatastarskeCestice.shp")
VLASNIK = {"RH": 1, "JLS": 2, "DNŽ": 3}
GRADSKI_PROJEKT = 4


def main() -> None:
    ind = json.load(open(os.path.join(JAVNO, "geo", "gup-grad", "regije.json")))
    korak = ind["korak"]
    plocice = []
    for p in ind["inacice"]["gradevna"]["2025"]:
        r, c = (int(x) for x in os.path.basename(p["url"]).removesuffix(".png").split("_"))
        h, w = Image.open(os.path.join(JAVNO, p["url"].lstrip("/"))).size[::-1]
        plocice.append((r, c, h, w, p))
    H = (max(r for r, *_ in plocice) + 1) * PLOCICA
    W = (max(c for _, c, *_ in plocice) + 1) * PLOCICA
    r0, c0, _, _, p0 = plocice[0]
    (_, zapad), (sjever, _) = p0["granice"]
    x, y = Transformer.from_crs(4326, 3857, always_xy=True).transform(zapad, sjever)
    transform = Affine(korak, 0, x - c0 * PLOCICA * korak, 0, -korak, y + r0 * PLOCICA * korak)

    # vlasnik: samo RH, JLS, DNŽ; ostali stupci se ne čitaju
    df = pyogrio.read_dataframe(VLASNISTVO, columns=["zku_status"])
    df = df[df["zku_status"].isin(list(VLASNIK))]
    u_3857 = Transformer.from_crs(int(df.crs.to_epsg()), 3857, always_xy=True).transform
    vlasnik = features.rasterize(
        ((stransform(u_3857, g), VLASNIK[s]) for g, s in zip(df.geometry, df["zku_status"]) if g is not None),
        out_shape=(H, W), transform=transform, fill=0, dtype="uint8",
    )

    # gradski projekt: čestice s urbanim pravilom GP 2025.
    u_4326 = Transformer.from_crs(4326, 3857, always_xy=True).transform
    gp, vidjene = [], set()
    for f in glob.glob(os.path.join(JAVNO, "geo", "gup-grad", "cestice", "*.json")):
        for ft in json.load(open(f))["features"]:
            p = ft["properties"]
            if p["i"] in vidjene or not ft["geometry"]:
                continue
            vidjene.add(p["i"])
            if (p.get("u") or {}).get("2025") == "GP":
                gp.append(stransform(u_4326, shape(ft["geometry"])))
    projekt = features.rasterize(((g, 1) for g in gp), out_shape=(H, W), transform=transform, fill=0, dtype="uint8") > 0

    oznaka = vlasnik | np.where(projekt, GRADSKI_PROJEKT, 0).astype(np.uint8)
    if os.path.isdir(IZLAZ):
        shutil.rmtree(IZLAZ)
    os.makedirs(IZLAZ)
    for r, c, h, w, p in plocice:
        t = oznaka[r * PLOCICA:r * PLOCICA + h, c * PLOCICA:c * PLOCICA + w]
        if t.any():
            Image.fromarray(t, "L").save(os.path.join(IZLAZ, os.path.basename(p["url"])), optimize=True)
    m2 = (korak * np.cos(np.radians(43.51))) ** 2
    print(f"javno: RH {(vlasnik == 1).sum() * m2 / 1e4:.1f} ha, Grad {(vlasnik == 2).sum() * m2 / 1e4:.1f} ha, "
          f"županija {(vlasnik == 3).sum() * m2 / 1e4:.1f} ha; gradski projekt {len(gp)} čestica, {projekt.sum() * m2 / 1e4:.1f} ha → {IZLAZ}")


if __name__ == "__main__":
    main()
