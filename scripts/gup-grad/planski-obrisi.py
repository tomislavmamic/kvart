#!/usr/bin/env python3
"""Obuhvati propisanih UPU-a iz prijedloga GUP-a 2025. (list 4.d), s imenima.

Prijedlog izmjena GUP-a (travanj 2025.) na listu 4.d „Područja i dijelovi
primjene planskih mjera zaštite” debelom plavom crtom omeđuje 34 plana užeg
područja „za koje je propisana obveza izrade”, a u legendi ih nabraja po
broju. Unutar obuhvata ispuna kaže gdje nova gradnja stoji do plana
(urbana sanacija, preobrazba, neuređeni dio; čl. 103) — to na kartu /gup
nosi planski režim čestice (rezim.ts), a ova skripta crta sam obuhvat
svakog plana, s imenom iz legende, kako ga je planer nacrtao.

Kako:
  1. Debele plave crte su na listu ispunjene vrpce (plohe), a rešetka unutar
     obuhvata su tanke crte. Vrpce su zidovi.
  2. Plava rešetka (bit OBVEZA u pr-gup-2025.npy, planski-rezim.py) bez
     zidova raspada se na plohe; svaka dobiva broj plana iz plavog broja
     otisnutog u njoj, a plohe bez broja (dio obuhvata koji je presjekla
     cesta) najbliži broj.
  3. Zidovi se dijele između susjednih plana, pa se plohe istog broja spoje,
     izglade za koji metar i pojednostave.

Izlaz: public/geo/gup-grad/planski-rezim-2025.geojson (EPSG:4326), svojstva
  broj, naziv    iz legende lista
  tocka          [lng, lat] za natpis, unutar obuhvata
  ha             površina obuhvata
  sanacija_ha, preobrazba_ha, neuredeno_ha
                 koliko obuhvata je u području u kojem nova gradnja čeka plan

Pokretanje:  python scripts/gup-grad/planski-obrisi.py   (poslije planski-rezim.py)
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys

import numpy as np
import pymupdf
import shapely
import shapely.ops
from affine import Affine
from pyproj import Transformer
from rasterio import features
from scipy import ndimage
from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

_spec = importlib.util.spec_from_file_location("planski_rezim", os.path.join(os.path.dirname(__file__), "planski-rezim.py"))
PR = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(PR)  # type: ignore[union-attr]

IZLAZ = os.path.join(R.ROOT, "public", "geo", "gup-grad", "planski-rezim-2025.geojson")
NAJMANJE_HA = 0.2          # mrvice uz rub zida nisu dio obuhvata
IZGLADI_M = 4.0            # zatvaranje pa otvaranje ruba, u metrima
POJEDNOSTAVI_M = 2.5
# legenda s popisom planova: desni stupac lista (pt, nezakrenuto; list 2025. nema zakreta)
LEGENDA_X = (3830, 4200)
LEGENDA_Y = (780, 1210)
BROJ_VELICINA = (16.0, 21.0)  # plavi brojevi u kružićima na karti


def popis(p: pymupdf.Page) -> dict[int, str]:
    """Broj → naziv iz „Popis planova užeg područja za koje je propisana obveza izrade”."""
    redovi: dict[tuple, list] = {}
    for w in p.get_text("words"):
        if LEGENDA_X[0] < w[0] < LEGENDA_X[1] and LEGENDA_Y[0] < w[1] < LEGENDA_Y[1]:
            redovi.setdefault((round(w[1])), []).append(w)
    out: dict[int, str] = {}
    for _, ws in sorted(redovi.items()):
        t = " ".join(x[4] for x in sorted(ws, key=lambda x: x[0]))
        m = re.match(r"^(\d+)\.\s*(UPU.*)$", t)
        if m:
            out[int(m.group(1))] = m.group(2).strip()
    return out


def brojevi_na_karti(p: pymupdf.Page, sirina_karte: float) -> list[tuple[int, float, float]]:
    """Plavi brojevi planova na karti: (broj, x, y) u pt lista."""
    out = []
    for b in p.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for s in ln["spans"]:
                t = s["text"].strip()
                x0, y0, x1, y1 = s["bbox"]
                if (t.isdigit() and "%06x" % s["color"] == PR.PLAVA[1:] and BROJ_VELICINA[0] <= s["size"] <= BROJ_VELICINA[1]
                        and x0 < sirina_karte):
                    out.append((int(t), (x0 + x1) / 2, (y0 + y1) / 2))
    return out


def main() -> None:
    lst = next(x for x in PR.LISTOVI if x["id"] == "pr-2025")
    plan = dict(next(p for p in R.PLANOVI if p["id"] == lst["plan"]))
    plan["pdf"], plan["url"] = lst["pdf"], lst["url"]
    put = R.preuzmi(plan)
    dpi = 72.0 * plan["afin"][0] / R.KORAK
    d = pymupdf.open(put)
    p = d[0]
    vis = p.mediabox.width if p.rotation in (90, 270) else p.mediabox.height
    nazivi = popis(p)
    print("planova u legendi:", len(nazivi))

    # 1. zidovi: debele plave vrpce (plohe), na rešetku
    vrpce = PR.crtez(put, dpi, PR.PLAVA, "ispuna")
    zid = R.na_rescetku(vrpce.astype(np.uint8), plan, dpi, vis) > 0
    zid = ndimage.binary_dilation(zid, iterations=1)

    # 2. plohe obuhvata i njihovi brojevi
    g = np.load(os.path.join(R.OUT, "pr-gup-2025.npy"))
    # samo unutar obuhvata GUP-a: izvan njega su legenda i okvir lista
    u_gupu = np.load(os.path.join(R.OUT, "klase-gup-2025.npy")) > 0
    u_gupu = ndimage.binary_dilation(u_gupu, iterations=4)  # zid na rubu obuhvata ostaje
    zid &= u_gupu
    obuhvat = (((g & PR.OBVEZA) > 0) | zid) & u_gupu
    oz, n = ndimage.label(obuhvat & ~zid)
    sc, ox, oy = plan["afin"]
    kljuc = np.zeros(n + 1, np.int32)
    for broj, x, y in brojevi_na_karti(p, LEGENDA_X[0] - 40):
        E, N = ox + x * sc, oy + (vis - y) * sc
        c = int((E - R.MREZA_BBOX[0]) / R.KORAK)
        r = int((R.MREZA_BBOX[3] - N) / R.KORAK)
        if 0 <= r < oz.shape[0] and 0 <= c < oz.shape[1]:
            # broj stoji u kružiću; ploha je ona s najviše piksela u okolini od ~20 m
            okolina = oz[max(0, r - 10):r + 11, max(0, c - 10):c + 11]
            ids, cnt = np.unique(okolina[okolina > 0], return_counts=True)
            if len(ids):
                kljuc[ids[np.argmax(cnt)]] = broj
    oznaceno = kljuc[oz]
    # plohe bez broja i zidovi: broj najbliže označene plohe
    if (oznaceno > 0).any():
        _, (ri, ci) = ndimage.distance_transform_edt(oznaceno == 0, return_indices=True)
        oznaceno = np.where(obuhvat, oznaceno[ri, ci], 0)

    # 3. poligoni po planu
    transform = Affine(R.KORAK, 0, R.MREZA_BBOX[0], 0, -R.KORAK, R.MREZA_BBOX[3])
    u4326 = Transformer.from_crs(3765, 4326, always_xy=True)
    px_ha = R.KORAK ** 2 / 1e4
    feats = []
    for broj in sorted(set(np.unique(oznaceno)) - {0}):
        m = oznaceno == broj
        polig = [shape(geom) for geom, v in features.shapes(m.astype(np.uint8), mask=m, transform=transform) if v == 1]
        geom = shapely.union_all(polig)
        geom = geom.buffer(IZGLADI_M).buffer(-2 * IZGLADI_M).buffer(IZGLADI_M)
        dijelovi = [x for x in getattr(geom, "geoms", [geom]) if x.area / 1e4 >= NAJMANJE_HA]
        if not dijelovi:
            continue
        geom = shapely.union_all(dijelovi).simplify(POJEDNOSTAVI_M, preserve_topology=True)
        ha = geom.area / 1e4
        # točka za natpis: unutar najvećeg dijela, što dalje od ruba
        najveci = max(getattr(geom, "geoms", [geom]), key=lambda x: x.area)
        t = shapely.ops.polylabel(najveci, tolerance=2.0)
        tocka = [round(v, 6) for v in u4326.transform(t.x, t.y)]
        geom = shapely.transform(geom, lambda xy: np.column_stack(u4326.transform(xy[:, 0], xy[:, 1])))
        geom = shapely.set_precision(geom, 1e-6)
        svojstva = {
            "broj": int(broj),
            "naziv": nazivi.get(int(broj), f"UPU br. {broj}"),
            "ha": round(ha, 1),
            "tocka": tocka,
            **{f"{ime}_ha": round(float(((g & bit) > 0)[m].sum()) * px_ha, 1)
               for ime, bit in (("sanacija", PR.SANACIJA), ("preobrazba", PR.PREOBRAZBA), ("neuredeno", PR.NEUREDENO))},
        }
        feats.append({"type": "Feature", "geometry": json.loads(shapely.to_geojson(geom)), "properties": svojstva})
    nedostaje = sorted(set(nazivi) - {f["properties"]["broj"] for f in feats})
    print("obuhvata:", len(feats), "nedostaje:", nedostaje)
    for f in feats:
        s = f["properties"]
        print(f"  {s['broj']:>2} {s['naziv'][:48]:48} {s['ha']:>6} ha  san {s['sanacija_ha']:>5} pre {s['preobrazba_ha']:>5} neu {s['neuredeno_ha']:>5}")
    with open(IZLAZ, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "opis": "Izvedeno skriptom scripts/gup-grad/planski-obrisi.py iz lista 4.d prijedloga GUP-a (travanj 2025.).",
            "features": feats,
        }, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", IZLAZ, round(os.path.getsize(IZLAZ) / 1e3), "kB")


if __name__ == "__main__":
    main()
