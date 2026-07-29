#!/usr/bin/env python3
"""Spaja sve prometne slojeve u jedan: public/geo/ceste-sve.geojson.

Ceste su do sada bile razasute po šest kvačica jer dolaze iz tri različita
cjevovoda — OSM (extract-geodata.ts), listovi GUP-a (trace-plans.py) i CAD
listovi DPU-a (vectorize-plans.py). Za korisnika je to jedna stvar: gdje se
vozi i hoda, sad i planirano. Zato ide u jedan sloj, a čime se razlikuju
nosi svojstvo `vrsta`, po kojem se i crta.

POKRETATI NAKON oba cjevovoda — čita njihove izlaze, ne izvore:
    npm run extract-geo
    /opt/homebrew/bin/python3 scripts/trace-plans.py
    /opt/homebrew/bin/python3 scripts/merge-roads.py
"""
from __future__ import annotations

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "public", "geo")
IZLAZ = os.path.join(GEO, "ceste-sve.geojson")

# (datoteka, vrsta, postojeće?, svojstva koja se zadržavaju)
# Sve ostalo se odbacuje — spojeni sloj se šalje pregledniku, pa nema smisla
# nositi CAD metapodatke koje karta nikad ne pokaže.
IZVORI: list[tuple[str, str, bool, tuple[str, ...]]] = [
    ("ulice.geojson", "ulica", True,
     ("highway", "name", "surface", "maxspeed", "lanes", "oneway")),
    ("pjesacke.geojson", "pjesacka", True, ("highway", "name", "surface")),
    ("ceste.geojson", "drzavna", True, ("id",)),
    ("planovi/gup-2024-promet.geojson", "koridor-nacrt", False, ("godina",)),
    ("planovi/gup-2015-promet.geojson", "koridor-vazeci", False, ("godina",)),
    ("planovi/promet.geojson", "dpu-povrsina", False, ("opis", "plan")),
]

OPIS = {
    "ulica": "postojeća ulica",
    "pjesacka": "pješačka staza",
    "drzavna": "državna cesta",
    "koridor-nacrt": "prometni koridor — nacrt GUP-a 2024.",
    "koridor-vazeci": "prometni koridor — GUP na snazi",
    "dpu-povrsina": "planirana prometna površina (DPU Dračevac)",
}


def main() -> int:
    spojeno: list[dict] = []
    for ime, vrsta, postojece, drzi in IZVORI:
        put = os.path.join(GEO, ime)
        if not os.path.exists(put):
            print(f"  ! preskačem {ime}: nema datoteke")
            continue
        with open(put, encoding="utf-8") as fh:
            fc = json.load(fh)
        n = 0
        for f in fc.get("features", []):
            if not f.get("geometry"):
                continue
            p = f.get("properties") or {}
            nova = {k: p[k] for k in drzi if p.get(k) is not None}
            nova["vrsta"] = vrsta
            nova["postojece"] = postojece
            nova["opis_vrste"] = OPIS[vrsta]
            spojeno.append({"type": "Feature", "properties": nova,
                            "geometry": f["geometry"]})
            n += 1
        print(f"  · {ime}: {n} objekata kao „{vrsta}”")

    with open(IZLAZ, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": spojeno},
                  fh, ensure_ascii=False)
    mb = os.path.getsize(IZLAZ) / 1e6
    print(f"\n{len(spojeno)} objekata, {mb:.1f} MB → {IZLAZ}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
