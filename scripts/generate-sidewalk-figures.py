#!/usr/bin/env python3
"""Figures for "Tko je dužan saditi" on the sidewalk proposal page.

Run after scripts/generate-sidewalk-obligations.py:
    python3 scripts/generate-sidewalk-figures.py
Requires pyproj, Shapely and Pillow, and network access to DGU and ISPU.

Each figure is a base image of one stretch of the street, fetched once into
public/prijedlozi/nogostupi-obveze/ — the plan sheet as the plan prints it, or
DGU's DOF 2025./26. (Otvorena dozvola, no watermark) — and the marks drawn over
it (owed trees, street trees, driveways, boundary lines) as pixel coordinates in
src/generated/sidewalk-figures.json. The page draws the marks as SVG, so labels
stay sharp and the base images stay untouched evidence.

The Dračevac 15 wall is measured on Google's 3D view instead, a screenshot kept
in the same folder and aligned by scripts/nogostupi_google.py: DGU's
orthophotos lean the olive crowns and the new roof some 2 m north, over the
boundary, so on today's DOF the page names what is there and draws no boundary.
"""
import io
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image
from pyproj import Transformer
from shapely.geometry import LineString, box, shape
from shapely.ops import nearest_points, transform

import nogostupi_google

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "public/geo"
OUT = ROOT / "public/prijedlozi/nogostupi-obveze"
TO_METRES = Transformer.from_crs(4326, 3765, always_xy=True).transform
STEP_M = 0.1
DOF = ("https://geoportal.dgu.hr/services/inspire/orthophoto_2025_2026/wms", "OI.OrthoimageCoverage",
       "DGU, DOF 2025./26., Otvorena dozvola")
ISPU = [f"https://gis{i}.mgipu.hr/srv1/PPRasterZ17_Public/wms" for i in (1, 2, 3)]
DPU5_SHEET = ("HR_ISPU_DPU5_04090_R01_IS_1_1",
              "DPU dijela područja Dračevac (Sl. gl. 23/04), list 2. Promet; ISPU")

# (id, bbox EPSG:3765 or None for the aligned Google view, base, obligations whose marks are drawn)
FIGURES = [
    ("dracevac-4d-plan", (500095, 4820836, 500195, 4820886), "plan", []),
    ("dracevac-4d-danas", (500095, 4820836, 500195, 4820886), "dof", ["dracevac-4d"]),
    ("hala-7a", (500222, 4820803, 500332, 4820866), "dof", ["hala-7a"]),
    ("dracevac-15-google", None, "google", ["dracevac-15"]),
    ("dracevac-15", (500245, 4820794, 500315, 4820836), "dof", ["dracevac-15"]),
]
# Driveways the figures label, by the access-gap names of the sidewalk proposal.
GAP_LABELS = {
    "Prilaz kod hale": "kolni ulaz",
    "Kamionski ulaz hale Dračevac 7A": "kamionski ulaz",
    "Glavni ulaz hale Dračevac 7A": "glavni ulaz",
    "Južni poslovni prilaz": "kolni ulaz",
}


def get(urls, query, attempts=6):
    for attempt in range(attempts):
        url = urls[attempt % len(urls)]
        try:
            request = urllib.request.Request(url + "?" + query, headers={"User-Agent": "Mozilla/5.0 (kvart)"})
            with urllib.request.urlopen(request, timeout=120) as response:
                body = response.read()
            if body[:4] == b"\x89PNG" or body[:2] == b"\xff\xd8":
                return body
        except OSError:
            pass
        time.sleep(2 + 2 * attempt)
    raise SystemExit(f"slika nije dohvaćena: {query[:120]}")


def base_image(kind, bbox, width, height):
    x0, y0, x1, y1 = bbox
    common = {"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "STYLES": "", "CRS": "EPSG:3765",
              "BBOX": f"{x0},{y0},{x1},{y1}", "WIDTH": width, "HEIGHT": height}
    if kind == "dof":
        url, layer, source = DOF
        body = get([url], urllib.parse.urlencode({**common, "LAYERS": layer, "FORMAT": "image/jpeg"}))
        return Image.open(io.BytesIO(body)).convert("RGB"), source
    body = get(ISPU, urllib.parse.urlencode({**common, "LAYERS": DPU5_SHEET[0], "FORMAT": "image/png", "TRANSPARENT": "true"}))
    sheet = Image.open(io.BytesIO(body)).convert("RGBA")
    paper = Image.new("RGBA", sheet.size, "white")
    return Image.alpha_composite(paper, sheet).convert("RGB"), DPU5_SHEET[1]


def main():
    obligations = json.loads((GEO / "prijedlozi/nogostupi-obveze.geojson").read_text())["features"]
    summary = {o["id"]: o for o in json.loads((ROOT / "src/generated/sidewalk-obligations.json").read_text())["obveze"]}
    proposal = json.loads((GEO / "prijedlozi/nogostupi.geojson").read_text())["features"]
    parcels = {f["properties"]["cestica"]: transform(TO_METRES, shape(f["geometry"]))
               for f in json.loads((GEO / "grad/katastar.geojson").read_text())["features"] if f["properties"].get("ko") == "SPLIT"}
    power = [transform(TO_METRES, shape(f["geometry"])) for f in json.loads((GEO / "grad/struja-vn-110.geojson").read_text())["features"]]
    retention = json.loads((ROOT / "scripts/data/sidewalk-tree-retention.json").read_text())
    rx0, ry0, rx1, ry1 = retention["bbox_3765"]
    rw, rh = retention["image_size"]
    gap_lines = {g["label"]: LineString([(rx0 + px * (rx1 - rx0) / rw, ry1 - py * (ry1 - ry0) / rh) for px, py in g["pixels"]])
                 for g in retention["access_gaps"]}
    gaps = {g["label"]: gap_lines[g["label"]].buffer(g["buffer_m"]) for g in retention["access_gaps"]}
    road_axis = next(transform(TO_METRES, shape(f["geometry"])) for f in proposal if f["properties"].get("role") == "road")
    OUT.mkdir(parents=True, exist_ok=True)
    figures = {}
    view = nogostupi_google.load()
    new_building = max((transform(TO_METRES, shape(f["geometry"])) for f in json.loads((GEO / "grad/zgrade-2025.geojson").read_text())["features"]),
                       key=lambda g: g.intersection(view["canopy"].buffer(3)).area)
    for fid, bbox, kind, owners in FIGURES:
        path = OUT / f"{fid}.jpg"
        if kind == "google":
            # a screenshot, kept in the repo; it cannot be fetched again
            width, height, source, step, px, frame = (view["width"], view["height"], view["source"],
                                                      view["metres_per_px"], view["to_px"], view["frame"])
        else:
            x0, y0, x1, y1 = bbox
            width, height, step = round((x1 - x0) / STEP_M), round((y1 - y0) / STEP_M), STEP_M
            if path.exists():
                source = DOF[2] if kind == "dof" else DPU5_SHEET[1]
            else:
                image, source = base_image(kind, bbox, width, height)
                image.save(path, quality=82, optimize=True, progressive=True)

            def px(x, y, x0=x0, y1=y1):
                return [round((x - x0) / STEP_M, 1), round((y1 - y) / STEP_M, 1)]

            frame = box(x0, y0, x1, y1)
        marks, lines, areas = [], [], []
        if kind != "plan":
            # spots given up: for an owed tree of this stretch, or because they are in a driveway
            replaced = {f["properties"]["candidate_id"] for f in obligations
                        if (f["properties"]["role"] == "street-tree-replaceable" and f["properties"]["obligation"] in owners)
                        or f["properties"]["role"] == "street-tree-in-driveway"}
            for f in proposal:
                p = f["properties"]
                if p.get("role") != "proposed-tree":
                    continue
                point = transform(TO_METRES, shape(f["geometry"]))
                if frame.contains(point):
                    kind_ = "street-drop" if p["candidate_id"] in replaced else "street-conflict" if p["screen_result"] == "conflict" else "street"
                    mark = {"kind": kind_, "xy": px(point.x, point.y), "r": 1.0 / step}
                    # only the street spots the text talks about carry their number
                    if any(p["candidate_id"] in summary[o]["izracun"].get("ulicna_ispred", []) + summary[o]["izracun"].get("ulicna_u_ulazu", [])
                           for o in owners):
                        mark["label"] = p["candidate_id"]
                    marks.append(mark)
            for f in obligations:
                p = f["properties"]
                if p.get("obligation") not in owners:
                    continue
                geometry = transform(TO_METRES, shape(f["geometry"]))
                if p["role"] == "obligation-tree":
                    marks.append({"kind": "plan" if p["placement"] == "plan" else "owed", "xy": px(geometry.x, geometry.y),
                                  "r": p["crown_radius_m"] / step})
                elif p["role"] == "obligation-plot" and not (p["obligation"] == "dracevac-15" and kind == "dof"):
                    clipped = geometry.intersection(frame)
                    for part in getattr(clipped, "geoms", [clipped]):
                        if part.geom_type == "Polygon":
                            areas.append({"kind": "plot-conditional" if p["conditional"] else "plot",
                                          "points": [px(*c) for c in part.exterior.coords]})
            for name, gap in gaps.items():
                clipped = gap.intersection(frame)
                if clipped.area > 10 and clipped.geom_type == "Polygon":
                    area = {"kind": "gap", "points": [px(*c) for c in clipped.exterior.coords]}
                    # a driveway at the frame's edge is drawn but not named
                    if clipped.area > 0.5 * gap.area:
                        # at the road end of the driveway, clear of the street spots on the plot edge
                        label_at = nearest_points(gap_lines[name], road_axis)[0]
                        if not frame.buffer(-3).contains(label_at):
                            label_at = clipped.representative_point()
                        area |= {"label": GAP_LABELS.get(name, "kolni ulaz"), "label_xy": px(label_at.x, label_at.y)}
                    areas.append(area)
            for line in power:
                clipped = line.intersection(frame)
                for part in getattr(clipped, "geoms", [clipped]):
                    if part.geom_type == "LineString" and part.length > 5:
                        lines.append({"kind": "power", "points": [px(*c) for c in part.coords], "label": "dalekovod 110 kV"})
            if "dracevac-15" in owners:
                # the olive row and the new building are in the photograph; only their names are added
                olives = next(transform(TO_METRES, shape(f["geometry"])) for f in obligations if f["properties"]["role"] == "olive-row")
                if kind == "google":
                    edge = parcels["291"].boundary.intersection(parcels["419/9"].buffer(0.5))
                    for part in getattr(edge, "geoms", [edge]):
                        if part.geom_type == "LineString" and part.length > 5:
                            lines.append({"kind": "boundary", "points": [px(*c) for c in part.coords], "label": "katastarska međa"})
                    # the wall's name goes on the sidewalk in front of it, so the line stays visible
                    wall = view["wall"]
                    middle = wall.interpolate(0.5, normalized=True)
                    label_at = nearest_points(road_axis, middle)[0]
                    label_at = LineString([middle, label_at]).interpolate(2.5)
                    lines.append({"kind": "wall", "points": [px(*c) for c in wall.coords], "label": "zid s ogradom",
                                  "label_xy": px(label_at.x, label_at.y)})
                    spot = olives.intersection(parcels["291"]).representative_point()
                    marks.append({"kind": "note", "xy": px(spot.x, spot.y), "r": 0, "label": "masline"})
                else:
                    spot = olives.representative_point()
                    marks.append({"kind": "note", "xy": px(spot.x, spot.y), "r": 0, "label": "masline"})
                    spot = new_building.representative_point()
                    marks.append({"kind": "note", "xy": px(spot.x, spot.y), "r": 0, "label": "nova građevina"})
        figures[fid] = {"src": f"/prijedlozi/nogostupi-obveze/{fid}.jpg", "width": width, "height": height,
                        "metres_per_px": round(step, 4), "source": source, "marks": marks, "lines": lines, "areas": areas}
        print(fid, width, height, len(marks), len(lines), len(areas))
    (ROOT / "src/generated/sidewalk-figures.json").write_text(json.dumps(figures, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
