#!/usr/bin/env python3
"""Obrisi stambenih i mješovitih zona novog GUP-a za kartu /gup/gradnja.

Karta boji razlog po pikselu, a namjenu pokazuje samo tumač klika. Da se
vidi gdje je plan uopće predvidio stanovanje, ovdje se iz istih pločica
(public/geo/gup-grad/gradnja, kanal R = klasa namjene) izvuku obrisi zona
S (stambena) i M/K5 (mješovita i poslovna sa stanovanjem) — pa obris
točno prati boje karte.

Pločice pokrivaju samo katastarske čestice, pa se maska prije
vektorizacije zatvori za ~10 m (neupisani putovi i rubovi), a otočići i
rupe manji od praga izbace. Ulice koje plan ne boji (klasa P, i koridori
iz koridori.py) poslije zatvaranja opet se izrežu, da obris ide uz njih.

Uz to broji gradilišta: povezano mjesto za zgradu s pripadajućim odmakom
u stambenoj ili mješovitoj zoni (susjedne slobodne čestice spojene u jedno
gradilište), jer hektari ne kažu koliko je prilika za kuću.

Ulaz:   public/geo/gup-grad/gradnja.json i pločice (scripts/gup-grad/gradnja.ts)
Izlaz:  public/geo/gup-grad/gradnja-zone-2025.geojson
        data/gup-grad/gradnja-mjesta-2025.json   broj mjesta po veličini

Pokretanje:  /opt/homebrew/bin/python3 scripts/gup-grad/gradnja-zone.py
"""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image
from pyproj import Transformer
from rasterio import features
from rasterio.transform import Affine
from scipy import ndimage
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform as stransform, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JAVNO = os.path.join(ROOT, "public")
IZLAZ = os.path.join(JAVNO, "geo", "gup-grad", "gradnja-zone-2025.geojson")
PLOCICA = 512
# indeksi klasa u src/lib/gup-grad/model.ts
STAMBENE = (1, 2)  # S, M/K5
P = 15
ZATVORI_PX = 4  # ~10 m Web Mercatora
NAJMANJE_M2 = 400  # manji otočići i rupe su šum rešetke, ne zona
POJEDNOSTAVI_M = 2.5


def main() -> None:
    ind = json.load(open(os.path.join(JAVNO, "geo", "gup-grad", "gradnja.json")))
    korak = ind["korak"]
    u_3857 = Transformer.from_crs(4326, 3857, always_xy=True)
    u_4326 = Transformer.from_crs(3857, 4326, always_xy=True)

    plocice = []
    for p in ind["plocice"]:
        r, c = (int(x) for x in os.path.basename(p["url"]).removesuffix(".png").split("_"))
        plocice.append((r, c, p))
    # ishodište mreže iz sjeverozapadnog kuta prve pločice
    r0, c0, p0 = plocice[0]
    (_, zapad), (sjever, _) = p0["granice"]
    x, y = u_3857.transform(zapad, sjever)
    mx0, my1 = x - c0 * PLOCICA * korak, y + r0 * PLOCICA * korak
    h = (max(r for r, _, _ in plocice) + 1) * PLOCICA
    w = (max(c for _, c, _ in plocice) + 1) * PLOCICA
    maska = np.zeros((h, w), bool)
    ulica = np.zeros((h, w), bool)
    razlog = np.zeros((h, w), np.uint8)
    for r, c, p in plocice:
        a = np.array(Image.open(os.path.join(JAVNO, p["url"].lstrip("/"))))
        m = (a[..., 3] == 255) & np.isin(a[..., 0], STAMBENE)
        maska[r * PLOCICA:r * PLOCICA + m.shape[0], c * PLOCICA:c * PLOCICA + m.shape[1]] = m
        ulica[r * PLOCICA:r * PLOCICA + m.shape[0], c * PLOCICA:c * PLOCICA + m.shape[1]] = (a[..., 3] == 255) & (a[..., 0] == P)
        # razlog bez vlasnika (gradnja.ts, kodPiksela); javno zemljište nije mjesto za gradnju
        razlog[r * PLOCICA:r * PLOCICA + m.shape[0], c * PLOCICA:c * PLOCICA + m.shape[1]] = np.where(
            (a[..., 3] == 255) & ((a[..., 2] >> 5) == 0), a[..., 2] & 31, 0)

    m2 = (korak * np.cos(np.radians(43.51))) ** 2
    # gradilište = mjesto za zgradu i njegov odmak (gradnja-skupine.py), u stambenoj ili mješovitoj zoni;
    # broji se ono na kojem je barem jedno mjesto za zgradu, veličina je cijelo gradilište
    gradiliste = maska & np.isin(razlog, (11, 13, 21))
    oznake, n = ndimage.label(gradiliste, structure=np.ones((3, 3)))
    idx = np.arange(1, n + 1)
    vel = ndimage.sum_labels(np.ones_like(oznake), oznake, index=idx) * m2
    ima13 = ndimage.maximum(razlog == 13, oznake, index=idx).astype(bool)
    ima11 = ndimage.maximum(razlog == 11, oznake, index=idx).astype(bool)
    mjesta = {}
    for ime, koja in (("stambeno", ima13), ("uz-cestu-stambeno", ima11 & ~ima13)):
        v = vel[koja]
        mjesta[ime] = {**{f"od_{p}_m2": int((v >= p).sum()) for p in (250, 500, 1000)}, "ha": round(float(v.sum()) / 1e4, 1)}
    with open(os.path.join(ROOT, "data", "gup-grad", "gradnja-mjesta-2025.json"), "w") as f:
        json.dump({"opis": "Mjesta za gradnju: povezane mrlje kategorije na karti (gradnja-zone.py).", "mjesta": mjesta}, f, indent=1)
    print("mjesta:", mjesta)

    krug = ndimage.generate_binary_structure(2, 1)
    maska = ndimage.binary_closing(maska, krug, iterations=ZATVORI_PX) & ~ulica
    transform = Affine(korak, 0, mx0, 0, -korak, my1)
    oblici = [shape(g) for g, v in features.shapes(maska.astype("uint8"), mask=maska, transform=transform) if v == 1]
    zona = unary_union(oblici).buffer(0)

    # Web Mercator je na 43,5° razvučen za 1/cos φ: prag površine na tlu
    prag = NAJMANJE_M2 / np.cos(np.radians(43.51)) ** 2
    cisti = []
    for p in getattr(zona, "geoms", [zona]):
        if p.area < prag:
            continue
        rupe = [r for r in p.interiors if Polygon(r).area >= prag]
        cisti.append(Polygon(p.exterior, rupe).simplify(POJEDNOSTAVI_M / np.cos(np.radians(43.51)), preserve_topology=True))
    zona = MultiPolygon([p for p in cisti if not p.is_empty])

    def zaokruzi(g):
        return json.loads(json.dumps(mapping(g)), parse_float=lambda s: round(float(s), 6))

    geo = stransform(lambda xs, ys: u_4326.transform(xs, ys), zona)
    fc = {"type": "FeatureCollection",
          "features": [{"type": "Feature", "properties": {"vrsta": "stambena-mjesovita"}, "geometry": zaokruzi(geo)}]}
    with open(IZLAZ, "w") as f:
        json.dump(fc, f, separators=(",", ":"))
    print(len(zona.geoms), "poligona,", round(os.path.getsize(IZLAZ) / 1e3), "kB →", IZLAZ)


if __name__ == "__main__":
    main()
