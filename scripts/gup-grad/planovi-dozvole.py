#!/usr/bin/env python3
"""Provjera planova na snazi: gdje novi GUP kaže „ne stambeno”, a stambene se
zgrade ipak grade ili traže, jer ondje vrijedi detaljniji plan (DPU, UPU).

Za svaki stambeni ili stambeno-poslovni akt s geoportala ISPU (ispu-akti.py,
isti CSV kao gradnja-dozvole.py), izdan ili u obradi, gleda se u kojem je planu
na snazi (planski-rezim-2025.geojson). Izdani od GUP-a 2006., zahtjevi u obradi od 2020. i što bi ondje bilo po namjeni GUP-a
(klasa namjene u pločicama gradnja.ts). Po planu ispisuje koliko je
takvih akata i koliko ih je ondje gdje GUP stambeno ne bi dopustio.

Izlaz: data/gup-grad/planovi-dozvole-2025.json i ispis.
Pokretanje (poslije gradnja-dozvole.py):  python3 scripts/gup-grad/planovi-dozvole.py
"""
from __future__ import annotations

import csv
import importlib.util
import json
import math
import os
import re

import numpy as np
from PIL import Image
from shapely.geometry import Point, shape

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JAVNO = os.path.join(ROOT, "public", "geo", "gup-grad")
CSV = os.environ.get("ISPU_AKTI") or os.path.join(ROOT, ".cache", "gup-grad", "ispu-akti-zelene.csv")
IZLAZ = os.path.join(ROOT, "data", "gup-grad", "planovi-dozvole-2025.json")
STAMBENO = re.compile(r"stamben", re.I)
# namjene GUP-a u kojima je stanovanje dopušteno (model.ts: S, M1–M3 i K5); sve druge ga ne dopuštaju
STAMBENE_KLASE = {"S", "M/K5"}

_spec = importlib.util.spec_from_file_location("ds", os.path.join(os.path.dirname(__file__), "dozvole-sanacija.py"))
ds = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ds)


def klase() -> dict[int, str]:
    src = open(os.path.join(ROOT, "src", "lib", "gup-grad", "model.ts")).read()
    return {int(m.group(2)): m.group(1) for m in re.finditer(r'kod: "([^"]+)",[^{}]*?indeks: (\d+)', src)}


def main() -> None:
    kl = klase()
    ind = json.load(open(os.path.join(JAVNO, "gradnja.json")))
    slike: dict[str, np.ndarray] = {}
    my = lambda la: math.log(math.tan(math.pi / 4 + la * math.pi / 360))

    def namjena(lon: float, lat: float) -> str | None:
        for p in ind["plocice"]:
            (j, z), (s, i) = p["granice"]
            if not (j <= lat <= s and z <= lon <= i):
                continue
            a = slike.setdefault(p["url"], np.array(Image.open(os.path.join(ROOT, "public", p["url"].lstrip("/")))))
            h, w = a.shape[:2]
            c = min(w - 1, int((lon - z) / (i - z) * w))
            r = min(h - 1, int((my(s) - my(lat)) / (my(s) - my(j)) * h))
            if a[r, c, 3] != 255:
                return None
            return kl.get(int(a[r, c, 0]))
        return None

    planovi = [(f["properties"], shape(f["geometry"])) for f in json.load(open(os.path.join(JAVNO, "planski-rezim-2025.geojson")))["features"]
               if f["properties"]["vrsta"] == "vazeci"]
    po_planu: dict[str, dict] = {}
    vidjeni = set()
    for r in csv.DictReader(open(CSV)):
        if r["klasa"] in vidjeni or not STAMBENO.search(r["namjena"]):
            continue
        vidjeni.add(r["klasa"])
        ish = ds.ishod(r["nacin_rjesavanja"] or None, r["status_predmeta"])
        # izdano po GUP-u na snazi (od 2006.), ili zahtjev u obradi koji nije zaostao iz prošlog stoljeća
        if ish == "izdana":
            datum = ds.iso(r["datum_rjesavanja"])
            if not datum or datum < ds.GUP_NA_SNAZI:
                continue
        elif ish == "u obradi":
            datum = ds.iso(r["datum_zaprimanja"])
            if not datum or datum < "2020-01-01":
                continue
        else:
            continue
        t = Point(float(r["lon"]), float(r["lat"]))
        plan = next((p for p, g in planovi if g.contains(t)), None)
        if not plan:
            continue
        nm = namjena(t.x, t.y)
        z = po_planu.setdefault(plan["ispu"], {"naziv": plan["naziv"], "glasnik": plan["glasnik"], "akata": 0, "gup_ne_stambeno": 0, "primjeri": []})
        z["akata"] += 1
        if nm and nm not in STAMBENE_KLASE:
            z["gup_ne_stambeno"] += 1
            if len(z["primjeri"]) < 3:
                z["primjeri"].append({"klasa": r["klasa"], "akt": r["naziv_akta"] or "zahtjev", "datum": ds.iso(r["datum_rjesavanja"]) or ds.iso(r["datum_zaprimanja"]),
                                      "namjena": r["namjena"], "kc": r["katastarske_cestice"], "namjena_gup": nm})
    redovi = sorted(po_planu.items(), key=lambda t: -t[1]["gup_ne_stambeno"])
    json.dump({"opis": __doc__.split("\n\n")[1].replace("\n", " "), "planovi": dict(redovi)}, open(IZLAZ, "w"), ensure_ascii=False, indent=1)
    for k, z in redovi:
        print(f"{k:6} {z['akata']:3} stambenih akata, {z['gup_ne_stambeno']:3} gdje GUP stambeno ne bi dopustio  {z['naziv'][:70]}")


if __name__ == "__main__":
    main()
