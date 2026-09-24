#!/usr/bin/env python3
"""OpenStreetMap: parkirališta, škole, igrališta, parkovi, gradilišta u Splitu.

Gradski GIS izvoz zna javna parkirališta (8 ha) i održavano zelenilo, ali
ne zna parkirališta trgovina, zgrada i tvrtki, školska dvorišta ni
gradilišta. Sve to na tlu JEST korištenje zemljišta — na parkiralištu se ne
gradi stan. OSM ih u Splitu ima dobro ucrtane (~500 parkirališta).

Ceste: gradski slojevi (Ceste, NerazvrstaneCeste, registar nerazvrstanih
cesta 2023.) nemaju kolne prilaze, prometnice kroz naselja višestambenih
zgrada ni mnoge stambene ulice; OSM ih ima (~3 000 highway=service).

Izlaz: .cache/gup-grad/osm.json i osm-ceste.json (sirovi odgovori
Overpassa); cestice.py iz njih gradi poligone. Podaci © OpenStreetMap
contributors, ODbL.

Pokretanje:  python3 scripts/gup-grad/osm.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

PUT = os.path.join(R.OUT, "osm.json")
PUT_CESTE = os.path.join(R.OUT, "osm-ceste.json")
POSLUZITELJ = "https://overpass-api.de/api/interpreter"
# jug, zapad, sjever, istok — obuhvat GUP-a s rubom
OKVIR = (43.487, 16.376, 43.545, 16.551)

UPIT = """[out:json][timeout:180][bbox:{okvir}];
(
  nwr["amenity"~"^(parking|school|kindergarten|college|university|hospital|clinic|place_of_worship|grave_yard|fuel|marketplace)$"];
  nwr["leisure"~"^(park|playground|pitch|sports_centre|stadium|track|dog_park)$"];
  nwr["landuse"~"^(construction|cemetery|garages|religious|education|village_green|railway)$"];
  nwr["highway"]["area"="yes"];
  nwr["place"="square"];
  nwr["power"~"^(substation|plant)$"];
  nwr["man_made"~"^(reservoir_covered|water_tower|wastewater_plant)$"];
);
out geom;"""

UPIT_CESTE = """[out:json][timeout:180][bbox:{okvir}];
way["highway"];
out tags geom;"""


def dohvati(upit: str, put: str) -> None:
    zahtjev = urllib.request.Request(
        POSLUZITELJ,
        data=urllib.parse.urlencode({"data": upit.format(okvir=",".join(str(x) for x in OKVIR))}).encode(),
        headers={"User-Agent": "kvart-gup-grad/1.0"},
    )
    with urllib.request.urlopen(zahtjev, timeout=300) as r:
        d = json.load(r)
    os.makedirs(R.OUT, exist_ok=True)
    with open(put, "w") as f:
        json.dump(d, f)
    print(os.path.basename(put), len(d["elements"]), "elemenata, stanje", d.get("osm3s", {}).get("timestamp_osm_base"))


def main() -> None:
    dohvati(UPIT, PUT)
    dohvati(UPIT_CESTE, PUT_CESTE)


if __name__ == "__main__":
    main()
