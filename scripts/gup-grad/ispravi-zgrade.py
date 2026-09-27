#!/usr/bin/env python3
"""Ručni ispravci skupine zgrade (data/gup-grad/pregled/zgrade.json) u već izvezenim podacima.

cestice.py ispravke primjenjuje sam. Ova ih skripta unosi u postojeći izvoz
bez ponovnog pokretanja cestice.py i regije.py, koji traže gradski GIS izvoz,
svježi OSM i maske iz .cache (a novi OSM promijenio bi brojke po cijelom
gradu). Za svaku ispravljenu zgradu, na česticama na kojima stoji:

  - skupina katastarske zgrade `g` u komadima (data/gup-grad/cestice.json i
    pločice čestica) i napomena `zn` u pločicama, kao što bi ih zapisao
    cestice.py
  - `g` u pločicama zgrada
  - sklad s planom (plavi kanal) u pločicama dijelova čestice: pikseli zgrade
    po tablici dopuštenog iz regije.ts, pikseli okućnice po udjelu protivnog
    u komadu, kao u regije.py

Pokretanje:  /opt/homebrew/bin/python3 scripts/gup-grad/ispravi-zgrade.py
Traži:       gradski izvoz (KO_*_objekti) za tlocrt zgrade, npx tsx za regije.ts
"""
from __future__ import annotations

import glob
import json
import os
import subprocess
import sys

import numpy as np
import shapely
from PIL import Image
from pyproj import Transformer
from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cestice as C  # noqa: E402
import rasteriziraj as R  # noqa: E402

KARTA = os.path.join(R.ROOT, "public", "geo", "gup-grad")
CESTICE_JSON = os.path.join(R.ROOT, "data", "gup-grad", "cestice.json")
PX_M2 = R.KORAK * R.KORAK
# regije.py: regije i imena vrsta po pikselu
ZGRADA, OKUCNICA = 1, 9
VRSTA_SKUPINE = {1: "stambena", 2: "gospodarska", 3: "javna", 4: "pomocna", 5: "ostala"}
KORAK_MERC, PLOCICA = 2.5, 512

U3765 = Transformer.from_crs(4326, 3765, always_xy=True)
U3857 = Transformer.from_crs(3765, 3857, always_xy=True)
U3765_IZ_3857 = Transformer.from_crs(3857, 3765, always_xy=True)
U4326 = Transformer.from_crs(3765, 4326, always_xy=True)


def preslikaj(g, tr):
    return shapely.transform(g, lambda xy: np.column_stack(tr.transform(xy[:, 0], xy[:, 1])))


def zapisi(put, d) -> None:
    with open(put, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))


def tlocrti(ispravci) -> dict[tuple[int, int], shapely.Geometry]:
    """Tlocrti ispravljenih zgrada iz gradskog izvoza (EPSG:3765), kao u cestice.py."""
    out = {}
    for put in sorted(glob.glob(os.path.join(C.BAZA, "ADMINISTRATIVNI_PODACI", "KO_*_objekti.shp"))):
        d = C.citaj(put, columns=["KO", "BROJ"])
        for kljuc in ispravci:
            g = d[(d.KO == kljuc[0]) & (d.BROJ == kljuc[1])].geometry
            if len(g):
                out[kljuc] = shapely.union_all(g.values)
    nema = set(ispravci) - set(out)
    if nema:
        raise SystemExit(f"nema u gradskom izvozu: {sorted(nema)}")
    return out


def main() -> None:
    ispravci = C.ispravci_zgrada()
    zgrade = tlocrti(ispravci)
    d = json.load(open(CESTICE_JSON, encoding="utf-8"))
    polja = d["komad_polja"]
    ig = polja.index("g") - 1  # u pločicama komad nema polja `cestica`

    # 1. čestice na kojima zgrada stoji: skupina u komadima i napomena
    promjene: dict[int, dict] = {}  # i → {"z": kljuc zgrade, "g": {(godina, klasa): nova}}
    cestice_geo: dict[int, shapely.Geometry] = {}
    for put in sorted(glob.glob(os.path.join(KARTA, "cestice", "*.json"))):
        fc = json.load(open(put, encoding="utf-8"))
        izmijenjeno = False
        for f in fc["features"]:
            geo = preslikaj(shape(f["geometry"]), U3765)
            for kljuc, tl in zgrade.items():
                pod = geo.intersection(tl).area
                if pod <= 1.0:
                    continue
                z, s = ispravci[kljuc], f["properties"]
                nove = {}
                for god, komadi in s["k"].items():
                    zk_m2 = sum(k[polja.index("zk") - 1] for k in komadi) * PX_M2
                    # zgrada je pretežita na čestici: skupina komada je njezina
                    if pod * 2 < zk_m2:
                        continue
                    for k in komadi:
                        if k[polja.index("zk") - 1] > 0:
                            izmijenjeno |= k[ig] != z["skupina"]
                            k[ig] = nove[(god, k[0])] = z["skupina"]
                if s.get("zn") != z["napomena"]:
                    # isti red svojstava kao u cestice.py (zapisi_plocice)
                    red = ["i", "ko", "kc", "a", "r", "zn", "k", "u", "p"]
                    s["zn"] = z["napomena"]
                    f["properties"] = {x: s[x] for x in red if x in s}
                    izmijenjeno = True
                promjene[s["i"]] = {"z": kljuc, "g": nove}
                cestice_geo[s["i"]] = geo
                print(f"  čestica {s['ko']} {s['kc']}: skupina zgrade {z['skupina']} u {sorted({g for g, _ in nove})}")
        if izmijenjeno:
            zapisi(put, fc)

    # 2. isto u data/gup-grad/cestice.json (komadi su ravni niz od len(polja) brojeva)
    if C.IZVOR_ISPRAVAKA not in d["izvori"]["zgrade_katastar"]:
        d["izvori"]["zgrade_katastar"] += "; " + C.IZVOR_ISPRAVAKA
    for god, g in d["godine"].items():
        a, w = g["komadi"], len(polja)
        for j in range(0, len(a), w):
            nova = promjene.get(a[j], {}).get("g", {}).get((god, a[j + 1]))
            if nova is not None:
                a[j + polja.index("g")] = nova
    zapisi(CESTICE_JSON, d)

    # 3. pločice zgrada
    for put in sorted(glob.glob(os.path.join(KARTA, "zgrade", "*.json"))):
        fc = json.load(open(put, encoding="utf-8"))
        izmijenjeno = False
        for f in fc["features"]:
            if f["properties"].get("s") != "k":
                continue
            geo = preslikaj(shape(f["geometry"]), U3765)
            for kljuc, tl in zgrade.items():
                if geo.intersection(tl).area > 0.9 * geo.area and f["properties"]["g"] != ispravci[kljuc]["skupina"]:
                    f["properties"]["g"] = ispravci[kljuc]["skupina"]
                    izmijenjeno = True
        if izmijenjeno:
            zapisi(put, fc)

    # 4. dijelovi čestice: tablica dopuštenog i udio protivnog po komadu iz regije.ts
    subprocess.run(["npx", "tsx", "scripts/gup-grad/regije.ts"], cwd=R.ROOT, check=True)
    # okućnica zgrade zna ležati i na susjednoj čestici (izracun.ts posuđuje zemljište),
    # pa se preračunava na čestici sa zgradom i na svim njezinim susjedima
    od, lista = d["cestice"]["susjedi"]["od"], d["cestice"]["susjedi"]["lista"]
    okolne = set(promjene) | {j for i in promjene for j in lista[od[i]:od[i + 1]]}
    geo_okolnih = {}
    for put in sorted(glob.glob(os.path.join(KARTA, "cestice", "*.json"))):
        for f in json.load(open(put, encoding="utf-8"))["features"]:
            if f["properties"]["i"] in okolne:
                geo_okolnih[f["properties"]["i"]] = preslikaj(shape(f["geometry"]), U3765)
    # piksel dijelova je ćelija rešetke od 2 m (regije.py, mercator()); čestice i zgrade
    # na njoj rasterizirane su kao u cestice.py
    ids = C.rasteriziraj(list(geo_okolnih.values()), [i + 1 for i in geo_okolnih], "int32")
    zgr = C.rasteriziraj([zgrade[pr["z"]] for pr in promjene.values()],
                         [ispravci[pr["z"]]["skupina"] for pr in promjene.values()])
    zgr[~np.isin(ids, [i + 1 for i in promjene])] = 0
    x0, y0, x1, y1 = R.MREZA_BBOX
    xs, ys = U3857.transform([x0, x1, x0, x1], [y0, y0, y1, y1])
    mx0, my1 = min(xs), max(ys)
    w, s_, e, n = shapely.union_all(list(geo_okolnih.values())).bounds
    (w, e), (s_, n) = U4326.transform([w, e], [s_, n])
    indeks = json.load(open(os.path.join(KARTA, "regije.json")))
    for inacica, godine in indeks["inacice"].items():
        for god, plocice in godine.items():
            ts = json.load(open(os.path.join(R.OUT, f"regije-{inacica}-{god}.json")))
            prot = {(k[0], k[1]): k[3] for k in ts["komadi"]}
            for p in plocice:
                (ps, pw), (pn, pe) = p["granice"]
                if w > pe or e < pw or s_ > pn or n < ps:
                    continue
                r, c = (int(v) for v in os.path.basename(p["url"])[:-4].split("_"))
                put = os.path.join(R.ROOT, "public", p["url"].lstrip("/"))
                t = np.array(Image.open(put))
                h, sirina = t.shape[:2]
                MX, MY = np.meshgrid(mx0 + (c * PLOCICA + np.arange(sirina) + 0.5) * KORAK_MERC,
                                     my1 - (r * PLOCICA + np.arange(h) + 0.5) * KORAK_MERC)
                X, Y = U3765_IZ_3857.transform(MX, MY)
                cc = np.floor((X - x0) / R.KORAK).astype(np.int64)
                rr = np.floor((y1 - Y) / R.KORAK).astype(np.int64)
                ok = (cc >= 0) & (rr >= 0) & (cc < ids.shape[1]) & (rr < ids.shape[0])
                ci, sk = np.zeros((h, sirina), np.int64), np.zeros((h, sirina), np.uint8)
                ci[ok], sk[ok] = ids[rr[ok], cc[ok]], zgr[rr[ok], cc[ok]]
                if not ci.any():
                    continue
                na = t[..., 3] == 255
                kod = np.array([ts["klase"].get(str(v), "") for v in range(256)], dtype=object)[t[..., 0]]
                b = t[..., 2].copy()
                # zgrada: sud po ispravljenoj vrsti
                m = na & (sk > 0) & (t[..., 1] == ZGRADA)
                b[m] = [1 if VRSTA_SKUPINE[int(g)] in ts["dopusteno"].get(k, []) else 2 for g, k in zip(sk[m], kod[m])]
                # okućnica: sud zgrade uz koju je, po udjelu protivnog u komadu (regije.py); ispravak
                # vrste može protivno samo ukloniti, pa se ne dira ono što je već po planu
                m = na & (ci > 0) & (t[..., 1] == OKUCNICA) & (t[..., 2] == 2)
                udio = np.array([prot.get((int(i) - 1, int(k)), 1.0) for i, k in zip(ci[m], t[..., 0][m])])
                b[m] = np.where(udio >= 0.5, 2, 1)
                if (b != t[..., 2]).any():
                    print(f"  {inacica} {god} {os.path.basename(put)}: sklad na {(b != t[..., 2]).sum()} piksela")
                    t[..., 2] = b
                    Image.fromarray(t, "RGBA").save(put, optimize=True)
    print("gotovo")


if __name__ == "__main__":
    main()
