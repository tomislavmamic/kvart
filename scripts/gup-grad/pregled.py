#!/usr/bin/env python3
"""Ručni pregled najvećih slobodnih čestica na ortofotu.

Model slobodnim broji sve što na čestici nije zgrada, cesta, parkiralište,
park… iz slojeva koje ima. Slojevi nisu potpuni (dvorišta škola, privatna
parkirališta, uređeno zelenilo između zgrada, petlje cesta), pa se najveće
slobodne čestice gledaju i na snimci. Tri koraka:

  1. npx tsx scripts/gup-grad/slobodne.ts
       slobodno po čestici BEZ dosadašnjih ispravaka → .cache/gup-grad/slobodne.json
  2. python3 scripts/gup-grad/pregled.py isjecci [PRAG_M2=1000]
       za svaku česticu s barem PRAG_M2 slobodnog: isječak ortofota DGU 2023
       (WMS) s obrisom čestice (crveno), susjeda (bijelo) i zgrada iz 3D
       modela (cijan) → .cache/gup-grad/pregled/slike/NNNN.jpg, popis.json,
       i serije za pregledatelje serija-NN.txt
     Pregledatelji po scripts/gup-grad/pregled-upute.md pišu
       .cache/gup-grad/pregled/rez-*.jsonl        (prvi prolaz, sve slike)
       .cache/gup-grad/pregled/drugi-rez-*.jsonl  (drugi prolaz: svaki
          „nije slobodno” iz prvog i nasumični uzorak „slobodno”, bez uvida u
          prvi sud; njegov sud vrijedi)
  3. python3 scripts/gup-grad/pregled.py rucno
       → data/gup-grad/pregled/rucno.json, koji čita cestice.py

2026-09: pregledano 614 čestica (≥ 1000 m² slobodnog, 125 ha). Prvi prolaz
Claude Haiku, drugi Claude Sonnet; drugi je vratio u „slobodno” 111 od 259
Haikuovih „iskorišteno” (većinom prirodna vegetacija proglašena parkom), a
od 40 nasumičnih Haikuovih „slobodno” potvrdio 36.
"""
from __future__ import annotations

import collections
import concurrent.futures as cf
import glob
import io
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

MAPA = os.path.join(R.OUT, "pregled")
RUCNO = os.path.join(R.ROOT, "data", "gup-grad", "pregled", "rucno.json")
WMS = ("https://geoportal.dgu.hr/services/inspire/orthophoto_2023/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
       "&LAYERS=OI.OrthoimageCoverage&STYLES=&CRS=EPSG:3765&BBOX={x0},{y0},{x1},{y1}&WIDTH={w}&HEIGHT={w}&FORMAT=image/jpeg")
SIRINA_PX = 800
SERIJA = 51  # slika po pregledatelju

VRSTE = {"slobodno", "parkiraliste", "zelenilo", "uredjeno", "javna", "gradiliste", "izgradjeno", "promet",
         "infrastruktura", "neizgradivo"}
KORISTENJE = VRSTE - {"slobodno", "neizgradivo"}


def isjecci(prag: float) -> None:
    import cestice as C
    import shapely
    from PIL import Image, ImageDraw

    slob = [x for x in json.load(open(os.path.join(R.OUT, "slobodne.json"))) if x["m2"] >= prag]
    ob = C.obuhvat_gupa()
    cc = C.citaj_cestice()
    cc = cc[cc.geometry.intersects(ob)].reset_index(drop=True)  # isti redoslijed kao cestice.py
    z = C.citaj(os.path.join(C.PORTAL, "Objekti_Split_2025_Objekti_Split_2025.shp"), columns=[])
    zt, ct = shapely.STRtree(z.geometry.values), shapely.STRtree(cc.geometry.values)
    os.makedirs(os.path.join(MAPA, "slike"), exist_ok=True)

    def jedna(i_x):
        i, x = i_x
        c = x["c"]
        g = cc.geometry.iloc[c]
        bx0, by0, bx1, by1 = g.bounds
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        r = max(max(bx1 - bx0, by1 - by0) / 2 + 30, 50)
        x0, y0, x1, y1 = cx - r, cy - r, cx + r, cy + r
        m = 2 * r / SIRINA_PX
        url = WMS.format(x0=x0, y0=y0, x1=x1, y1=y1, w=SIRINA_PX)
        for _ in range(3):
            try:
                zahtjev = urllib.request.Request(url, headers={"User-Agent": "kvart-gup-grad/1.0"})
                img = Image.open(io.BytesIO(urllib.request.urlopen(zahtjev, timeout=60).read())).convert("RGB")
                break
            except Exception:  # noqa: BLE001 — geoportal zna vratiti 5xx; pokušaj opet
                continue
        else:
            return None
        dr = ImageDraw.Draw(img, "RGBA")
        P = lambda xy: [((a - x0) / m, (y1 - b) / m) for a, b in xy]  # noqa: E731
        okvir = shapely.box(x0, y0, x1, y1)
        for j in ct.query(okvir):
            if j != c:
                for p in getattr(cc.geometry.iloc[j], "geoms", [cc.geometry.iloc[j]]):
                    dr.line(P(p.exterior.coords), fill=(255, 255, 255, 110), width=1)
        for j in zt.query(okvir):
            for p in getattr(z.geometry.iloc[j], "geoms", [z.geometry.iloc[j]]):
                if p.geom_type == "Polygon":
                    dr.line(P(p.exterior.coords), fill=(0, 230, 255, 230), width=2)
        for p in getattr(g, "geoms", [g]):
            dr.line(P(p.exterior.coords), fill=(255, 30, 30, 255), width=4)
        ime = f"{i + 1:04d}.jpg"
        img.save(os.path.join(MAPA, "slike", ime), quality=80)
        return {"n": i + 1, "slika": ime, "cestica": c, "ko": cc.KO_NAZIV.iloc[c], "kc": cc.KC_BROJ.iloc[c],
                "povrsina_m2": round(g.area), "slobodno_m2": x["m2"], "zona": x["kod"], "sirina_m": round(2 * r)}

    with cf.ThreadPoolExecutor(6) as ex:
        popis = [p for p in ex.map(jedna, enumerate(slob)) if p]
    json.dump(popis, open(os.path.join(MAPA, "popis.json"), "w"), ensure_ascii=False)
    n_serija = max(1, -(-len(popis) // SERIJA))
    for b in range(n_serija):
        with open(os.path.join(MAPA, f"serija-{b + 1:02d}.txt"), "w") as f:
            for p in popis[b::n_serija]:
                f.write(f"{p['n']}\t{os.path.join(MAPA, 'slike', p['slika'])}\t"
                        f"cestica {p['povrsina_m2']} m2, sirina slike {p['sirina_m']} m\n")
    print(f"{len(popis)} slika od {len(slob)} čestica, {n_serija} serija; "
          f"{sum(p['slobodno_m2'] for p in popis) / 1e4:.1f} ha slobodnog")


def ucitaj(uzorak: str, popis: dict) -> dict:
    out = {}
    for f in sorted(glob.glob(os.path.join(MAPA, uzorak))):
        for red in open(f):
            try:
                x = json.loads(red)
            except ValueError:
                continue
            if isinstance(x.get("n"), int) and x["n"] in popis:
                out[x["n"]] = x
    return out


def primjenjivo(x: dict) -> bool:
    """Sud se primjenjuje ako je siguran i vrsta pokriva većinu slobodnog dijela."""
    k, udio = x.get("kategorija"), float(x.get("udio") or 0)
    if k not in VRSTE or x.get("sigurnost") == "niska":
        return False
    if k == "slobodno" or udio >= 0.5:
        return True
    # mješavina dviju vrsta korištenja (npr. parkiralište i park) je ipak pretežito iskorištena
    return udio >= 0.4 and x.get("drugo") in KORISTENJE


def rucno() -> None:
    popis = {x["n"]: x for x in json.load(open(os.path.join(MAPA, "popis.json")))}
    prvi = ucitaj("rez-*.jsonl", popis)
    drugi = ucitaj("drugi-rez-*.jsonl", popis)
    slaganje = collections.Counter()
    konacno = {}
    for n, x in prvi.items():
        if n in drugi:
            slaganje[(x.get("kategorija") == "slobodno", drugi[n].get("kategorija") == "slobodno")] += 1
            konacno[n] = drugi[n]
        elif x.get("kategorija") == "slobodno":
            konacno[n] = x
        # „iskorišteno” iz prvog prolaza bez potvrde drugog se ne primjenjuje
    out, stat, m2 = [], collections.Counter(), collections.Counter()
    for n, x in sorted(konacno.items()):
        if not primjenjivo(x):
            stat["neprimijenjeno"] += 1
            continue
        p, k = popis[n], x["kategorija"]
        stat[k] += 1
        m2[k] += p["slobodno_m2"]
        out.append({"ko": p["ko"], "kc": p["kc"], "vrsta": k, "opis": x.get("opis", ""),
                    "sigurnost": x.get("sigurnost", ""), "udio": x.get("udio"), "slobodno_prije_m2": p["slobodno_m2"]})
    os.makedirs(os.path.dirname(RUCNO), exist_ok=True)
    json.dump({
        "opis": "Ručni pregled najvećih slobodnih čestica u stambenim i mješovitim zonama na ortofotu DGU 2023 "
                "(scripts/gup-grad/pregled.py, upute u pregled-upute.md). Vrsta vrijedi za neiskorišteni dio cijele "
                "čestice (RucnaVrsta u src/lib/gup-grad/izracun.ts). Svaku sliku pregledao je Claude Haiku; svako "
                "„iskorišteno” i nasumičnih 40 „slobodno” ponovno, bez uvida u prvi sud, Claude Sonnet, čiji sud vrijedi.",
        "pregledano": len(prvi),
        "cestice": out,
    }, open(RUCNO, "w"), ensure_ascii=False, indent=1)
    print("prvi/drugi prolaz (slobodno?, slobodno?):", dict(slaganje))
    print("pregledano", len(prvi), "od", len(popis), dict(stat))
    print({k: round(v / 1e4, 1) for k, v in m2.items()}, "ha")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "isjecci":
        isjecci(float(sys.argv[2]) if len(sys.argv) > 2 else 1000)
    elif len(sys.argv) > 1 and sys.argv[1] == "rucno":
        rucno()
    else:
        raise SystemExit(__doc__)
