#!/usr/bin/env python3
"""Extract conservative utility route segments from the original DPU CAD PDFs.

python3 scripts/extract-dpu-infrastructure.py /path/2b.pdf /path/2c.pdf /path/2d.pdf /path/2e.pdf
Requires PyMuPDF, Shapely, pyproj. Source drawing dashes become centre segments;
closed equipment symbols, text, ambiguous shapes and connecting gaps are excluded.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

import pymupdf
from shapely.geometry import LineString, mapping
from shapely.ops import transform, unary_union

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("dpu", HERE / "extract-dpu-sidewalks.py")
dpu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dpu)
LAYERS = {
    "7-INFRA-VO_trasa": ("vodoopskrba", "Vodoopskrba", "mixed-source-plan"),
    "D06203-ODVODNJA_PLAN": ("odvodnja", "Planirana fekalna kanalizacija", "planned"),
    "D06201-ODVODNJA": ("odvodnja", "Fekalna kanalizacija iz DPU-a", "existing-source-plan"),
    "D06203-OBORINSKA_PLAN": ("oborinska", "Planirana oborinska kanalizacija", "planned"),
    "7-INFRA-EL-1KV": ("struja", "Elektroopskrba 1 kV", "source-plan"),
    "7-INFRA-EL-20KV": ("struja", "Elektroopskrba 20 kV", "source-plan"),
    "D05103-PLINOVOD_PLAN": ("plin", "Planirani plinovod", "planned"),
    "7-INFRA-TK_kanalizacija": ("telekom", "Telekom kanalizacija", "source-plan"),
}


def rectangular_segment(geometry, first_edge):
    if geometry.geom_type != "Polygon" or geometry.area == 0:
        return None
    # AutoCAD emits each straight stroke dash as two triangles. The first edge
    # crosses its width; this also preserves direction for square telecom dots.
    # Node outlines use more triangles and are excluded by the caller.
    a, b = first_edge
    width = math.dist(a,b)
    if width > 2:
        corners = list(geometry.exterior.coords)
        a, b = min(zip(corners,corners[1:]), key=lambda edge: math.dist(*edge))
        width = math.dist(a,b)
    if not .03 <= width <= 2:
        return None
    nx, ny = -(b[1]-a[1])/width, (b[0]-a[0])/width
    cx, cy = (a[0]+b[0])/2, (a[1]+b[1])/2
    distances = [(x-cx)*nx+(y-cy)*ny for x,y in geometry.exterior.coords]
    lo, hi = min(distances), max(distances)
    length = hi-lo
    if length < .5 or not .85 <= geometry.area/(width*length) <= 1.15:
        return None
    return LineString([(cx+nx*lo,cy+ny*lo),(cx+nx*hi,cy+ny*hi)])


def open_segments(path, project):
    lines, points = [], []
    for item in path["items"]:
        if item[0] != "l":
            return []
        a, b = project(*item[1]), project(*item[2])
        if points and math.dist(points[-1], a) > .001:
            lines.append(points)
            points = []
        if not points:
            points.append(a)
        points.append(b)
    if points:
        lines.append(points)
    return [LineString(points) for points in lines
            if len(points) >= 2 and math.dist(points[0], points[-1]) >= 3]


def extract(pdf, entry, sheet):
    page = pymupdf.open(pdf)[0]
    paths = page.get_drawings()
    scale, tx, ty, cut = dpu.registration(paths, page.rect.height)
    def project(x,y):
        return x*scale+tx, (page.rect.height-y)*scale+ty
    groups = {}
    for path in paths:
        layer = path["layer"]
        if layer not in LAYERS or path["rect"].x0 >= cut:
            continue
        color = path["fill"] or path["color"]
        color_hex = "#" + "".join(f"{round(c*255):02x}" for c in color)
        key = (layer, color_hex)
        lines = []
        if path["fill"] is not None and len(path["items"]) == 6 and all(item[0] == "l" for item in path["items"]):
            geometry = unary_union(dpu.filled_parts(path, project))
            hull = geometry.convex_hull
            # Two source triangles can differ by floating-point seam coordinates.
            # Repair only near-solid convex rectangles; leave hollow symbols out.
            if hull.area and geometry.area/hull.area >= .9:
                geometry = hull
            parts = [geometry]
            edge = tuple(project(*p) for p in path["items"][0][1:])
            lines = [line for part in parts if (line := rectangular_segment(part, edge)) is not None]
        elif path["fill"] is None and not path["closePath"]:
            lines = open_segments(path, project)
        if lines:
            groups.setdefault(key, []).extend(lines)
    features = []
    for (layer, color), lines in groups.items():
        geometry = unary_union(lines)
        network, label, status = LAYERS[layer]
        if layer == "7-INFRA-VO_trasa" and color == "#bf00ff":
            label, status = "Interni vodovodni razvodi/priključci", "source-plan"
        props = {
            "role": "infrastructure", "network": "dpu-"+network,
            "network_status": "dpu-plan", "source_status": status,
            "label": "DPU · "+label, "name": label, "cad_sloj": layer,
            "source_color": color, "list": sheet, "plan": "DPU radne zone Dračevac",
            "source_url": "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download"
                          f"?Command=Core_Download&EntryId={entry}&PortalId=0&language=hr-HR",
            "source_path": "/geo/planovi/dpu-infrastruktura.geojson",
            "extraction": "Središnje crte izvornih tankih CAD crtica i otvoreni potezi; razmaci nisu interpolirani.",
            "completeness": "partial-conservative", "source_segments": len(lines),
            "drawn_length_m": round(geometry.length, 1),
            "note": "DPU prikaz nije snimka izvedenih vodova; tekst, simboli okana i nejasni oblici izostavljeni su. Provjeriti puni izvorni list i uvjete upravitelja.",
        }
        features.append({"type": "Feature", "geometry": mapping(transform(dpu.TO_WGS, geometry)),
                         "properties": props})
        print(sheet, layer, color, len(lines), round(geometry.length, 1))
    return features


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    features = []
    for pdf, entry, sheet in zip(sys.argv[1:], [14245,14246,14247,14248], ["2b","2c","2d","2e"]):
        features.extend(extract(pdf, entry, sheet))
    path = dpu.OUT / "dpu-infrastruktura.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                              ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
