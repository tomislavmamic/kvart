#!/usr/bin/env python3
"""Who owes trees along the Dračevac road, and where: map layer and page data.

Run: python3 scripts/generate-sidewalk-obligations.py
Requires pyproj and Shapely.

Facts (who, why, permits, what is there today) are hand-kept in
scripts/data/sidewalk-planting-obligations.json. This script adds what follows
from geometry:

  - DPU obligations: the tree positions drawn on the plan's own sheets
    (public/geo/gup-grad/elementi-planova.geojson).
  - GUP obligations (čl. 91: 1 tree per 200 m² of the plot's unbuilt part): the
    quota, from the city's 2025 building footprints, and positions for it. The
    GUP sets the number, not the place. We put the trees where they also shade
    the street: in a row just behind the street fence, clear of the driveways
    (the access gaps read for the sidewalk proposal) and of buildings.
  - Street trees of the sidewalk proposal in front of an owed tree: where the
    street spot clashes with a utility line, the owed tree behind the fence
    replaces it ("zamjenjivo"); where the street spot is clear, both stay and
    the street gets a double row.
  - An olive row on a plot boundary that the proposal marked "keep", when the
    facts say it should be replaced (feature "olive-row", which overrides the
    retained-trees feature of the same id on the map).

Writes public/geo/prijedlozi/nogostupi-obveze.geojson (extra layer of the
sidewalk proposal map) and src/generated/sidewalk-obligations.json (page data).
"""
import json
import math
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point, mapping, shape
from shapely.ops import linemerge, nearest_points, transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "public/geo"
DATA = ROOT / "scripts/data/sidewalk-planting-obligations.json"
RETENTION = ROOT / "scripts/data/sidewalk-tree-retention.json"
TO_METRES = Transformer.from_crs(4326, 3765, always_xy=True).transform
TO_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform
ROAD_PARCEL = "419/9"
FRONTAGE_TOLERANCE_M = 0.5
IN_FRONT_M = 5         # a street tree this close to a plot stands in front of it
FENCE_SETBACK_M = 1.5  # owed trees: just behind the street fence, in the planting strip
ROW_DEPTH_M = 2.5      # ... and no deeper than this from the plot's street edge
BUILDING_SETBACK_M = 2.5
GAP_MIN_RADIUS_M = 4.0  # driveway kept clear: at least 8 m, lorries use the west gate of 7A
GAP_CLEARANCE_M = 1.5
REPLACE_WITHIN_M = 4.0  # owed tree this close behind a clashing street spot replaces it
MIN_SPACING_M = 6.0     # between owed trees: a continuous row, crowns touching when grown
KEEP_FROM_STREET_M = 4.0  # an owed tree next to a kept street tree, for a staggered double row
POWER_LINE_NEAR_M = 10.0
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


def retention():
    """Access gaps and retained planting groups of the sidewalk proposal, in EPSG:3765."""
    data = json.loads(RETENTION.read_text())
    x0, y0, x1, y1 = data["bbox_3765"]
    width, height = data["image_size"]

    def line(pixels):
        points = [(x0 + px * (x1 - x0) / width, y1 - py * (y1 - y0) / height) for px, py in pixels]
        return LineString(points) if len(points) > 1 else Point(points[0])

    gaps = {g["label"]: line(g["pixels"]).buffer(max(g["buffer_m"], GAP_MIN_RADIUS_M) + GAP_CLEARANCE_M)
            for g in data["access_gaps"]}
    driveways = {g["label"]: line(g["pixels"]).buffer(g["buffer_m"]) for g in data["access_gaps"]}
    groups = {g["id"]: (g, line(g["pixels"]).buffer(g["buffer_m"])) for g in data["groups"]}
    return gaps, driveways, groups


def place_owed(plot, built, road, count, gaps, street_trees):
    """Positions for `count` owed trees along the street fence, and street spots they replace."""
    edge = frontage(plot, road)
    room = plot.buffer(-FENCE_SETBACK_M)
    if not built.is_empty:
        room = room.difference(built.buffer(BUILDING_SETBACK_M))
    for gap in gaps:
        room = room.difference(gap)
    if edge is not None and edge.length >= 4:
        room = room.intersection(edge.buffer(ROW_DEPTH_M))
    if room.is_empty:
        return [], {}
    in_front = [t for t in street_trees if t["point"].distance(plot) <= IN_FRONT_M]
    kept = [t["point"] for t in in_front if not t["conflict"]]

    def spot(chainage):
        anchor = edge.interpolate(chainage)
        point = nearest_points(room, anchor)[0]
        usable = point.distance(anchor) <= ROW_DEPTH_M + 0.5 and all(point.distance(k) >= KEEP_FROM_STREET_M for k in kept)
        return point if usable else None

    if edge is None or edge.length < 4:
        candidates = [nearest_points(room, road)[0]]
    else:
        # usable stretches of the fence line, then trees evenly spaced in each
        step = 0.5
        usable = [i * step for i in range(int(edge.length / step) + 1) if spot(i * step) is not None]
        stretches, start = [], None
        for a, b in zip(usable, usable[1:] + [None]):
            start = a if start is None else start
            if b is None or b - a > step + 1e-6:
                stretches.append((start, a))
                start = None
        candidates = []
        for a, b in stretches:
            n = int((b - a) // MIN_SPACING_M) + 1
            chainages = [(a + b) / 2] if n == 1 else [a + i * (b - a) / (n - 1) for i in range(n)]
            candidates += [spot(c) for c in chainages]
    # prefer spots right behind a street spot that clashes with a utility: there the owed tree replaces it
    clashes = [t["point"] for t in in_front if t["conflict"]]
    candidates.sort(key=lambda c: min([c.distance(p) for p in clashes] or [math.inf]))
    chosen = []
    for c in candidates:
        if len(chosen) == count:
            break
        if all(c.distance(o) >= MIN_SPACING_M - 0.01 for o in chosen):
            chosen.append(c)
    replaces = {}
    for tree in in_front:
        near = [i for i, c in enumerate(chosen) if c.distance(tree["point"]) <= REPLACE_WITHIN_M]
        if tree["conflict"] and near:
            replaces[tree["id"]] = min(near, key=lambda i: chosen[i].distance(tree["point"]))
    return chosen, replaces


def bounds(geometry, margin=15):
    """[west, south, east, north] in degrees, for the map's fitBounds."""
    x0, y0, x1, y1 = geometry.buffer(margin).bounds
    (w, s), (e, n) = TO_WGS(x0, y0), TO_WGS(x1, y1)
    return [round(w, 6), round(s, 6), round(e, 6), round(n, 6)]


def main():
    facts = json.loads(DATA.read_text())
    parcels = {f["properties"]["cestica"]: metres(f) for f in read("grad/katastar.geojson")
               if f["properties"].get("ko") == "SPLIT"}
    footprints = [metres(f) for f in read("grad/zgrade-2025.geojson")]
    power_lines = [metres(f) for f in read("grad/struja-vn-110.geojson")]
    road = parcels[ROAD_PARCEL]
    plan_trees = {(f["properties"]["ispu"], f["properties"]["odredba"]): [Point(TO_METRES(*xy)) for xy in f["geometry"]["coordinates"]]
                  for f in read("gup-grad/elementi-planova.geojson")}
    plan_bounds = {f["properties"]["ispu"]: metres(f) for f in read("gup-grad/planski-rezim-2025.geojson")
                   if f["properties"].get("ispu")}
    street_trees = [{"id": f["properties"]["candidate_id"], "point": metres(f),
                     "conflict": f["properties"]["screen_result"] == "conflict",
                     "chainage": f["properties"].get("chainage_m", 0),
                     "utility": f["properties"]["nearest_utility"]["label"],
                     "utility_m": f["properties"]["nearest_utility_distance_m"]}
                    for f in read("prijedlozi/nogostupi.geojson") if f["properties"].get("role") == "proposed-tree"]
    gaps, driveways, groups = retention()
    # Street spots of the proposal that fall in a driveway (the proposal read two
    # gates of hall 7A in the wrong place); they are dropped, whoever plants.
    in_driveway = {t["id"]: name for t in street_trees for name, way in driveways.items() if way.contains(t["point"])}
    street_trees_all = street_trees
    street_trees = [t for t in street_trees if t["id"] not in in_driveway]

    features, summary = [], []
    for item in facts["obveze"]:
        conditional = bool(item.get("uvjetno"))
        computed, positions, replaces, placement = {}, [], {}, None
        if item["vrsta"] == "ulica":
            computed["mjesta_u_prijedlogu"] = len(street_trees_all)
            computed["u_kolnim_ulazima"] = sorted(in_driveway, key=lambda i: int(i[1:]))
            computed["mjesta_na_nogostupu"] = len(street_trees)
            computed["ulicna_uz_instalacije"] = sum(t["conflict"] for t in street_trees)
            computed["okvir"] = bounds(unary_union([t["point"] for t in street_trees]), 20)
            # the east bend, where the street trees meet the 110 kV line
            under = [t for t in street_trees if min(line.distance(t["point"]) for line in power_lines) < POWER_LINE_NEAR_M]
            computed["uz_dalekovod"] = sorted((t["id"] for t in under), key=lambda i: int(i[1:]))
            computed["okvir_dalekovod"] = bounds(unary_union([t["point"] for t in under]), 25) if under else None
            summary.append({**item, "izracun": computed, "polozaji": []})
            continue
        plot = plan_bounds[item["plan"]] if item["vrsta"] == "dpu" else parcels[item["cestica"]]
        built = unary_union([f.intersection(plot) for f in footprints if f.intersects(plot)])
        unbuilt = plot.area - built.area
        edge = frontage(plot, road)
        computed |= {"okvir": bounds(plot), "cestica_m2": round(plot.area), "izgradeno_m2": round(built.area),
                     "neizgradeno_m2": round(unbuilt), "procelje_m": round(edge.length) if edge is not None else 0}
        if item["vrsta"] == "dpu":
            positions = [p for key in item["odredbe"] for p in plan_trees[(item["plan"], key)]]
            placement = "plan"
            for tree in street_trees:
                if tree["conflict"] and min(tree["point"].distance(p) for p in positions) <= IN_FRONT_M:
                    replaces[tree["id"]] = min(range(len(positions)), key=lambda i: positions[i].distance(tree["point"]))
            computed["stabala"] = len(positions)
        else:
            computed["stabala"] = math.floor(unbuilt / facts["gup"]["kvota_m2_po_stablu"])
            computed["zelenilo_m2"] = round(item["zelenilo_udio"] * plot.area)
            if not conditional:
                own_gaps = [gaps[name] for name in item.get("prilazi", [])] or list(gaps.values())
                positions, replaces = place_owed(plot, built, road, computed["stabala"], own_gaps, street_trees)
            placement = "ilustracija"
        computed["na_karti"] = len(positions)
        computed["ostatak_na_cestici"] = max(0, computed["stabala"] - len(positions)) if not conditional else 0
        computed["zamjenjuje"] = sorted(replaces, key=lambda i: int(i[1:]))
        in_front = sorted((t for t in street_trees if t["point"].distance(plot) <= IN_FRONT_M), key=lambda t: t["chainage"])
        computed["ulicna_ispred"] = [t["id"] for t in in_front]
        computed["ulicna_u_ulazu"] = sorted((t["id"] for t in street_trees_all if t["id"] in in_driveway and t["point"].distance(plot) <= IN_FRONT_M),
                                            key=lambda i: int(i[1:]))
        computed["ulicna_dvostruki_red"] = [t["id"] for t in in_front if t["id"] not in replaces]
        near_power = [i for i, p in enumerate(positions) if min((line.distance(p) for line in power_lines), default=math.inf) < POWER_LINE_NEAR_M]
        computed["uz_dalekovod"] = len(near_power)

        features.append(mapped_feature(
            plot, role="obligation-plot", obligation=item["id"], conditional=conditional,
            label=f"{item['adresa']} · k.č. {item['cestica']}",
            action=f"{'Uvjetno: ' if conditional else ''}{item['tko']} · {computed['stabala']} stabala",
            purpose=" · ".join(z["tekst"] for z in item["izvori"]), evidence=f"Danas: {item['danas']}"))
        for index, position in enumerate(positions):
            replaced = [tid for tid, i in replaces.items() if i == index]
            what = ("Stablo ucrtano u planu, nije posađeno" if placement == "plan"
                    else "Dugovano stablo po GUP-u · broj propisuje plan, položaj je naš prijedlog")
            if replaced:
                what += f" · zamjenjuje mjesto {', '.join(replaced)} na nogostupu"
            if index in near_power:
                what += " · uz dalekovod 110 kV: visinu uskladiti s HOPS-om"
            features.append(mapped_feature(
                position, role="obligation-tree", obligation=item["id"], placement=placement,
                crown_radius_m=CROWN_RADIUS_M[item["vrsta"]], label=f"{item['adresa']} · {index + 1}/{len(positions)}",
                action=what, purpose=item["tko"]))
        for tree in street_trees:
            if tree["id"] in replaces:
                features.append(mapped_feature(
                    tree["point"], role="street-tree-replaceable", obligation=item["id"], candidate_id=tree["id"],
                    action=f"Mjesto {tree['id']} na nogostupu otpada ako {item['tko'].lower()} posadi stablo iza ograde",
                    evidence=f"{tree['utility']} na {tree['utility_m']:.1f} m".replace(".", ",")))
        if item.get("masline"):
            group, area = groups[item["masline"]]
            features.append(mapped_feature(
                area, role="olive-row", obligation=item["id"], overrides=item["masline"],
                label="Masline uz rub čestice " + item["cestica"],
                action="Zamijeniti visokim stablima; masline presaditi",
                evidence=f"Danas: {item['danas']}"))
            computed["masline_na_cesti_m2"] = round(area.intersection(road).area)
            computed["masline_na_cestici_m2"] = round(area.intersection(plot).area)
        summary.append({**item, "izracun": computed,
                        "polozaji": [list(TO_WGS(p.x, p.y)) for p in positions]})

    for tree in street_trees_all:
        if tree["id"] in in_driveway:
            features.append(mapped_feature(
                tree["point"], role="street-tree-in-driveway", candidate_id=tree["id"],
                action=f"Mjesto {tree['id']} je u kolnom ulazu ({in_driveway[tree['id']]}) i otpada"))
    due = sum(o["izracun"]["stabala"] for o in summary if o["vrsta"] != "ulica" and not o.get("uvjetno"))
    write(GEO / "prijedlozi/nogostupi-obveze.geojson", {"type": "FeatureCollection", "features": features})
    write(ROOT / "src/generated/sidewalk-obligations.json", {
        "opis": "Izvedeno skriptom scripts/generate-sidewalk-obligations.py — ne uređivati ručno.",
        "provjereno": facts["provjereno"], "registar": facts["registar"], "teren": facts["teren"], "gup": facts["gup"],
        "dugovano_stabala": due, "obveze": summary,
    }, indent=2)
    for o in summary:
        print(f"{o['id']:<14} k.č. {o['cestica']:<6} {o['izracun']}")
    print(f"dugovano (bez uvjetnih): {due} stabala · {len(features)} značajki")


if __name__ == "__main__":
    main()
