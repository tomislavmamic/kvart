#!/usr/bin/env python3
"""Extract actual filled sidewalk/carriageway footprints from DPU traffic PDFs.

python3 scripts/extract-dpu-sidewalks.py /path/2a1.pdf /path/2a2.pdf
Sources: Split DMX entries 14243 and 14244 (2024 adopted amendments).
Requires PyMuPDF, Shapely and pyproj. No buffers infer sidewalk geometry.
"""
import json
import sys
from pathlib import Path

import pymupdf
import shapely
from pyproj import Transformer
from shapely.geometry import Point, Polygon, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/geo/planovi"
# Same ISPU registration and scale check as scripts/vectorize-plans.py.
ISPU = (499626.43366951845, 4820417.793367964,
        500118.0778796287, 4820903.928722085)
TO_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform
SIDEWALKS = {
    "TPS_B050_PARTER_Sraf": "surface",
    "TPS_B050_PARTER_Sraf-nadz": "upper",
    "TPS_B015_PROMET-Sraf_nadvoznjak-pjesak": "upper",
}
CARRIAGEWAYS = {
    "TPS_B015_PROMET-Sraf": "surface",
    "TPS_B015_PROMET-Sraf_nadvoznjak-2a1": "upper",
    "TPS_B015_PROMET-Sraf_podvoznjak": "lower",
    "TPS_B015_PROMET-Sraf_int prom": "lower",
}


def vertices(path):
    for item in path["items"]:
        if item[0] != "l":
            raise ValueError(f"Unexpected path operator in source fill: {item[0]}")
        yield tuple(item[1])
        yield tuple(item[2])


def registration(paths, height):
    points = [p for path in paths if path["layer"] == "TPS_A001_Granica obuhvata"
              for p in vertices(path)]
    xs = sorted(p[0] for p in points)
    # Boundary legend is separated from the map by the largest horizontal gap.
    left, right = max(zip(xs, xs[1:]), key=lambda pair: pair[1] - pair[0])
    cut = (left + right) / 2
    points = [(x, height-y) for x,y in points if x < cut]
    x0, x1 = min(x for x,y in points), max(x for x,y in points)
    y0, y1 = min(y for x,y in points), max(y for x,y in points)
    sx = (ISPU[2]-ISPU[0]) / (x1-x0)
    sy = (ISPU[3]-ISPU[1]) / (y1-y0)
    scale = (sx+sy)/2
    if abs(sx-sy)/sx > .01 or abs(scale/(25.4/72)-1) > .02:
        raise ValueError("DPU registration disagrees with printed 1:1000 scale")
    tx, ty = ISPU[0]-x0*scale, ISPU[1]-y0*scale
    return scale, tx, ty, cut


def filled_parts(path, project):
    """AutoCAD fill is a tessellation of closed line subpaths, not glyph bounds."""
    parts, ring = [], []
    for item in path["items"]:
        if item[0] != "l":
            raise ValueError("Unexpected non-linear fill; inspect source before extracting")
        a, b = tuple(item[1]), tuple(item[2])
        if ring and ring[-1] != a:
            if len(ring) >= 4 and ring[-1] == ring[0]:
                parts.append(Polygon([project(*p) for p in ring]))
            ring = []
        if not ring:
            ring.append(a)
        ring.append(b)
        if len(ring) >= 4 and ring[-1] == ring[0]:
            parts.append(Polygon([project(*p) for p in ring]))
            ring = []
    if len(ring) >= 3:
        parts.append(Polygon([project(*p) for p in ring]))
    return [shapely.make_valid(p) for p in parts if p.area > .00001]


def extract(pdf, entry, include_common):
    document = pymupdf.open(pdf)
    page = document[0]
    paths = page.get_drawings()
    scale, tx, ty, cut = registration(paths, page.rect.height)

    def project(x, y):
        return scale*x+tx, scale*(page.rect.height-y)+ty

    groups = {}
    # The hatch tessellation also fills the roundabout's planted centre.
    # Recover its closed outline from the same CAD layer, not a fitted circle.
    island = Point(500049, 4820853)
    islands = []
    for path in paths:
        layer = path["layer"]
        if include_common and layer == "TPS_B015_PROMET-Sraf" and path["fill"] is None:
            if path["items"] and all(item[0] == "l" for item in path["items"]):
                for part in filled_parts(path, project):
                    if 300 < part.area < 400 and part.covers(island):
                        islands.append(part)
        if layer not in SIDEWALKS and layer not in CARRIAGEWAYS:
            continue
        if not include_common and layer in ("TPS_B050_PARTER_Sraf", "TPS_B015_PROMET-Sraf"):
            continue  # identical base footprints in both level sheets
        if path["fill"] is None or path["rect"].x0 >= cut:
            continue
        # Gray 186 = sidewalk; gray 152 = carriageway. Legend is outside cut.
        expected = 186 if layer in SIDEWALKS else 152
        if any(abs(channel*255-expected) > 1 for channel in path["fill"]):
            continue
        groups.setdefault(layer, []).extend(filled_parts(path, project))
    output = {"nogostupi": [], "kolnici": []}
    for layer, pieces in groups.items():
        # Millimetre snapping joins shared tessellation edges without road buffers.
        geometry = shapely.union_all(pieces, grid_size=.001)
        geometry = shapely.make_valid(geometry)
        if layer == "TPS_B015_PROMET-Sraf":
            if not islands:
                raise ValueError("Missing original roundabout island outline")
            geometry = geometry.difference(unary_union(islands))
        if geometry.is_empty:
            continue
        category = "nogostupi" if layer in SIDEWALKS else "kolnici"
        level = (SIDEWALKS | CARRIAGEWAYS)[layer]
        geographic = shapely.make_valid(transform(TO_WGS, geometry))
        output[category].append({"type": "Feature", "geometry": mapping(geographic),
            "properties": {
                "tema": "dpu-"+category,
                "opis": "Pločnik prema DPU-u" if category == "nogostupi" else "Kolnik prema DPU-u",
                "cad_sloj": layer, "plan": "DPU radne zone Dračevac",
                "list": "2a-1" if entry == 14243 else "2a-2", "level": level,
                "plan_status": "adopted-plan", "area_m2": round(geometry.area, 1),
                "source_url": "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download"
                              f"?Command=Core_Download&EntryId={entry}&PortalId=0&language=hr-HR",
                "izvor": "Ispuna izvornog CAD sloja u prometnom listu DPU-a; nije dokaz izvedenog stanja.",
                "registration": "Granica DPU-a na ISPU-u, EPSG:3765; provjera mjerila 1:1000",
            }})
    return output


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    all_features = {"nogostupi": [], "kolnici": []}
    for pdf, entry, common in ((sys.argv[1], 14243, True), (sys.argv[2], 14244, False)):
        for kind, features in extract(pdf, entry, common).items():
            all_features[kind].extend(features)
    for kind, features in all_features.items():
        path = OUT / f"dpu-{kind}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                                  ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"{path.name}: {len(features)} source layers, "
              f"{sum(f['properties']['area_m2'] for f in features):.1f} m²")


if __name__ == "__main__":
    main()
