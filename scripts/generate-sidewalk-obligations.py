#!/usr/bin/env python3
"""Who owes trees along the Dračevac road, and where: map layer and page data.

Run: python3 scripts/generate-sidewalk-obligations.py
Requires pyproj and Shapely.

Facts (who, why, permits, what is planted today) are hand-kept in
scripts/data/sidewalk-planting-obligations.json. This script adds what follows
from geometry:
  - DPU obligations: the tree positions drawn on the plan's own sheets
    (public/geo/gup-grad/elementi-planova.geojson, scripts/gup-grad/elementi-planova.py);
  - GUP obligations (čl. 91: 1 tree per 200 m² of the plot's unbuilt part): the
    plot, its unbuilt area from the city's 2025 building footprints, the quota,
    and as many illustrative positions along the plot's street frontage. The
    GUP sets the number, not the place; the positions show where the owed
    trees would also shade the sidewalk, and are labelled as such.

Writes public/geo/prijedlozi/nogostupi-obveze.geojson (extra layer of the
sidewalk proposal map) and src/generated/sidewalk-obligations.json (page data).
"""
import json
import math
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import MultiLineString, Point, mapping, shape
from shapely.ops import linemerge, nearest_points, transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "public/geo"
DATA = ROOT / "scripts/data/sidewalk-planting-obligations.json"
TO_METRES = Transformer.from_crs(4326, 3765, always_xy=True).transform
TO_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform
ROAD_PARCEL = "419/9"
FRONTAGE_TOLERANCE_M = 0.5
IN_FRONT_M = 8  # proposal trees this close to a plot count as in front of it
# Owed trees go 4 m inside the plot: a second row behind the sidewalk trees,
# which is also the green buffer toward the houses that GUP rule 3.1 asks of
# edge plots of the work zone. Narrow plots fall back to 2 m.
BOUNDARY_SETBACKS_M = (4.0, 2.0)
BUILDING_SETBACK_M = 2.5
# Crown radius drawn on the map: DPU5 sheets draw ~3.8 m crowns; a GUP tree is
# one "expected to grow ~10 m tall" (čl. 91), shown with a ~6 m crown.
CROWN_RADIUS_M = {"dpu": 1.9, "gup": 3.0}


def read(name):
    return json.loads((GEO / name).read_text())["features"]


def metres(feature):
    return transform(TO_METRES, shape(feature["geometry"]))


def write(path, value, indent=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=indent,
                               separators=None if indent else (",", ":")) + "\n")


def mapped_feature(geometry, **properties):
    return {"type": "Feature", "geometry": mapping(transform(TO_WGS, geometry)),
            "properties": properties}


def frontage(plot, road):
    """The plot's edge on the road parcel, as one line where possible."""
    edge = plot.boundary.intersection(road.buffer(FRONTAGE_TOLERANCE_M))
    lines = [g for g in getattr(edge, "geoms", [edge]) if g.geom_type == "LineString"]
    if not lines:
        return None
    merged = linemerge(MultiLineString(lines))
    return max(getattr(merged, "geoms", [merged]), key=lambda g: g.length)


def illustrative_positions(plot, built, road, count):
    """`count` spots on the unbuilt part, spread along the street frontage."""
    if count == 0:
        return []
    for setback in BOUNDARY_SETBACKS_M:
        room = plot.buffer(-setback)
        if not built.is_empty:
            room = room.difference(built.buffer(BUILDING_SETBACK_M))
        if room.area >= 4:
            break
    else:
        return []
    edge = frontage(plot, road)
    if edge is None or edge.length < 4:
        anchors = [nearest_points(plot, road)[0]]
    else:
        anchors = [edge.interpolate((i + 0.5) / count, normalized=True) for i in range(count)]
    return [nearest_points(room, anchor)[0] for anchor in anchors]


def label(item):
    return f"{item.get('adresa') or 'Ulica Dračevac'} · k.č. {item.get('cestice') or item['cestica']}"


def main():
    facts = json.loads(DATA.read_text())
    parcels = {f["properties"]["cestica"]: metres(f) for f in read("grad/katastar.geojson")
               if f["properties"].get("ko") == "SPLIT"}
    footprints = [metres(f) for f in read("grad/zgrade-2025.geojson")]
    proposal = read("prijedlozi/nogostupi.geojson")
    proposed_trees = [metres(f) for f in proposal if f["properties"].get("role") == "proposed-tree"]
    road = parcels[ROAD_PARCEL]
    plan_trees = {(f["properties"]["ispu"], f["properties"]["odredba"]): [Point(TO_METRES(*xy)) for xy in f["geometry"]["coordinates"]]
                  for f in read("gup-grad/elementi-planova.geojson")}
    # A DPU's building plot is the plan's own boundary, not one cadastral parcel.
    plan_bounds = {f["properties"]["ispu"]: metres(f) for f in read("gup-grad/planski-rezim-2025.geojson")
                   if f["properties"].get("ispu")}

    features, summary = [], []
    for item in facts["obveze"]:
        plot = plan_bounds[item["plan"]] if item["vrsta"] == "dpu" else parcels[item["cestica"]]
        computed = {"cestica_m2": round(plot.area)}
        if item["vrsta"] != "ulica":
            built = unary_union([f.intersection(plot) for f in footprints if f.intersects(plot)])
            unbuilt = plot.area - built.area
            edge = frontage(plot, road)
            computed |= {
                "izgradeno_m2": round(built.area),
                "neizgradeno_m2": round(unbuilt),
                "procelje_m": round(edge.length) if edge is not None else 0,
                "predlozenih_ispred": sum(t.distance(plot) <= IN_FRONT_M for t in proposed_trees),
            }
        conditional = bool(item.get("uvjetno"))
        if item["vrsta"] == "dpu":
            positions = [p for key in item["odredbe"] for p in plan_trees[(item["plan"], key)]]
            computed["stabala"] = len(positions)
            placement = "plan"
        elif item["vrsta"] == "gup":
            computed["stabala"] = math.floor(computed["neizgradeno_m2"] / facts["gup"]["kvota_m2_po_stablu"])
            computed["zelenilo_m2"] = round(item["zelenilo_udio"] * plot.area)
            # A conditional quota is not owed yet, and the building that sets it is not drawn.
            positions = [] if conditional else illustrative_positions(plot, built, road, computed["stabala"])
            placement = "ilustracija"
        else:
            positions, placement = [], None

        if item["vrsta"] != "ulica":
            owed = f"{'Uvjetno: ' if conditional else ''}{item['tko']} duguje {computed['stabala']} stabala"
            features.append(mapped_feature(
                plot, role="obligation-plot", obligation=item["id"],
                conditional=conditional, label=label(item), action=owed,
                purpose=" · ".join(z["tekst"] for z in item["zasto"]),
                evidence=f"Danas: {item['posadeno']}"))
        for index, position in enumerate(positions, 1):
            what = ("Stablo ucrtano u DPU-u, nije posađeno kao visoka stablašica" if placement == "plan"
                    else "Dugovano stablo po GUP-u · broj propisuje plan, položaj je prijedlog")
            features.append(mapped_feature(
                position, role="obligation-tree", obligation=item["id"], placement=placement,
                crown_radius_m=CROWN_RADIUS_M[item["vrsta"]], label=f"{label(item)} · {index}/{len(positions)}",
                action=what, purpose=item["tko"]))
        summary.append({**item, "izracun": computed, "polozaja_na_karti": len(positions)})

    due = sum(o["izracun"]["stabala"] for o in summary if o["vrsta"] != "ulica" and not o.get("uvjetno"))
    write(GEO / "prijedlozi/nogostupi-obveze.geojson", {"type": "FeatureCollection", "features": features})
    write(ROOT / "src/generated/sidewalk-obligations.json", {
        "opis": "Izvedeno skriptom scripts/generate-sidewalk-obligations.py — ne uređivati ručno.",
        "provjereno": facts["provjereno"], "registar": facts["registar"], "gup": facts["gup"],
        "dugovano_stabala": due, "obveze": summary,
    }, indent=2)
    for o in summary:
        print(f"{o['id']:<14} k.č. {o['cestica']:<6} {o['izracun']}")
    print(f"dugovano (bez uvjetnih): {due} stabala · {len(features)} značajki")


if __name__ == "__main__":
    main()
