#!/usr/bin/env python3
"""Render a geographic proposal-card SVG from the school-bus screening.

Requires Shapely and pyproj. This is a location map, not a bus route.
"""
import json
from html import escape
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
project = Transformer.from_crs(4326, 3765, always_xy=True).transform
data = json.loads((ROOT / "public/geo/prijedlozi/skolski-autobus.geojson").read_text())
report = json.loads((ROOT / "public/geo/prijedlozi/skolski-autobus.json").read_text())
bounds = transform(project, box(16.4924, 43.5247, 16.5051, 43.5291)).bounds
west, south, east, north = bounds
scale = min(1104 / (east - west), 592 / (north - south))
offset_x = (1200 - (east - west) * scale) / 2
offset_y = 165 + (592 - (north - south) * scale) / 2


def xy(x, y):
    return offset_x + (x - west) * scale, offset_y + (north - y) * scale


def path(geometry):
    if geometry.is_empty:
        return ""
    if hasattr(geometry, "geoms"):
        return " ".join(path(part) for part in geometry.geoms)
    if geometry.geom_type == "Polygon":
        return " ".join(path(ring) + " Z" for ring in [geometry.exterior, *geometry.interiors])
    if geometry.geom_type in ("LineString", "LinearRing"):
        points = [xy(x, y) for x, y in geometry.coords]
        return "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return ""


def draw(feature, style):
    geometry = transform(project, shape(feature["geometry"]))
    return f'<path d="{path(geometry)}" {style}/>'


parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="title desc">
<title id="title">Školski autobus za Bilice i Dračevac</title>
<desc id="desc">R1 s dolaskom iz radne zone ili N1 na sjevernom rubu rotora za Dračevac. B2 uz ulaz u Bilice prikazan u DPU-u. Stajališta su novi prijedlozi, a ne odobreni peroni.</desc>
<defs><clipPath id="map"><rect x="32" y="156" width="1136" height="616" rx="18"/></clipPath><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#007956"/></marker></defs>
<rect width="1200" height="900" fill="#f4f4f5"/>
<g font-family="system-ui,-apple-system,Segoe UI,sans-serif" fill="#18181b">
<text x="48" y="59" font-size="16" font-weight="700" letter-spacing="2">PRIJEVOZ DO ŠKOLE U SV. KAJU</text>
<text x="48" y="113" font-size="36" font-weight="750" letter-spacing="-1">Dračevac: R1 ili N1. Bilice: novi ulaz.</text>
<g clip-path="url(#map)"><rect x="32" y="156" width="1136" height="616" fill="#e9e8e4"/>''']

for feature in data["features"]:
    if feature["properties"]["role"] == "public-parcel":
        parts.append(draw(feature, 'fill="#dbeaf0" stroke="#9abbca" stroke-width="1" fill-rule="evenodd"'))

buildings = json.loads((ROOT / "public/geo/zgrade.geojson").read_text())
for feature in buildings["features"]:
    parts.append(draw(feature, 'fill="#ceccc5" stroke="#b7b5ad" stroke-width="0.8" fill-rule="evenodd"'))

roads = [f for f in data["features"] if f["properties"]["role"] == "existing-road"]
for feature in roads:
    main = feature["properties"].get("highway") in ("trunk", "trunk_link", "primary")
    parts.append(draw(feature, f'fill="none" stroke="#b3b2b0" stroke-width="{13 if main else 7}" stroke-linecap="round" stroke-linejoin="round"'))
for feature in roads:
    main = feature["properties"].get("highway") in ("trunk", "trunk_link", "primary")
    parts.append(draw(feature, f'fill="none" stroke="#fff" stroke-width="{10 if main else 4}" stroke-linecap="round" stroke-linejoin="round"'))
for feature in data["features"]:
    if feature["properties"]["role"] == "planned-road":
        parts.append(draw(feature, 'fill="#e4d6c4" fill-opacity="0.85" stroke="#953d00" stroke-width="1.2" stroke-dasharray="5 4" fill-rule="evenodd"'))
for feature in data["features"]:
    if feature["properties"]["role"] == "recreation-zone":
        parts.append(draw(feature, 'fill="#b5c787" stroke="#657b27" stroke-width="2"'))
    if feature["properties"]["role"] == "approach-direction":
        parts.append(draw(feature, 'fill="none" stroke="#007956" stroke-width="4" stroke-dasharray="7 4" marker-end="url(#arrow)"'))
    if feature["properties"]["role"] == "dpu-entry":
        parts.append(draw(feature, 'fill="none" stroke="#005986" stroke-width="5"'))

for x, y, title in [(190, 623, "BILICE"), (850, 696, "DRAČEVAC")]:
    parts.append(f'<text x="{x}" y="{y}" fill="#52525c" font-size="26" font-weight="700" letter-spacing="4" paint-order="stroke" stroke="#e9e8e4" stroke-width="6">{title}</text>')

callouts = {
    "R1": (820, 480, "R1 · prilaz iz radne zone", "419/1 · Grad Split (GIS)"),
    "N1": (780, 190, "N1 · sjeverni rub rotora", "276/1 · Republika Hrvatska (GIS)"),
    "B2": (70, 385, "B2 · uz planski ulaz u Bilice", "252/2 · Republika Hrvatska (GIS)"),
}
for candidate in report["candidates"]:
    x, y = xy(*project(*candidate["coordinate"]))
    label_x, label_y, title, detail = callouts[candidate["id"]]
    end_y = label_y if label_y > y else label_y + 80
    end_x = max(label_x + 20, min(label_x + 300, x))
    parts.append(f'''<path d="M{x:.1f},{y:.1f} L{end_x:.1f},{end_y:.1f}" stroke="#007956" stroke-width="2"/>
<rect x="{label_x:.1f}" y="{label_y:.1f}" width="320" height="80" rx="12" fill="#fff" stroke="#d4d4d8"/>
<text x="{label_x+17:.1f}" y="{label_y+32:.1f}" font-size="20" font-weight="700">{escape(title)}</text>
<text x="{label_x+17:.1f}" y="{label_y+59:.1f}" font-size="16" fill="#52525c">{detail}</text>
<circle cx="{x:.1f}" cy="{y:.1f}" r="24" fill="#007956" stroke="#fff" stroke-width="5"/>
<text x="{x:.1f}" y="{y+7:.1f}" text-anchor="middle" font-size="20" font-weight="750" fill="#fff">{candidate['id']}</text>''')

park_x, park_y = xy(*project(16.50155, 43.52718))
parts.append(f'<path d="M{park_x:.1f},{park_y:.1f} l-76,160" fill="none" stroke="#657b27" stroke-width="1.5"/><text x="{park_x-183:.1f}" y="{park_y+182:.1f}" font-size="18" font-weight="600" fill="#435418" paint-order="stroke" stroke="#e9e8e4" stroke-width="4">Rekreativna zona</text>')
parts.append('</g>')
parts.append(f'''<path d="M1055,700 h{100*scale:.1f} m0,-5 v10 M1055,695 v10" stroke="#52525c" stroke-width="2"/>
<text x="1055" y="686" font-size="16" fill="#52525c">100 m</text>
<path d="M1119,239 v-37 l-7,12 m7,-12 l7,12" fill="none" stroke="#52525c" stroke-width="2"/>
<text x="1119" y="191" text-anchor="middle" font-size="16" font-weight="700">S</text>
<text x="48" y="816" font-size="21" font-weight="650">Jedno stajalište po naselju · predložene lokacije na javnim česticama</text>
<text x="48" y="849" font-size="16" fill="#52525c">Smeđe: planirani kolnici DPU-a · strelica: smjer prilaza, bez završnog manevra do R1</text>
<text x="48" y="877" font-size="15" fill="#52525c">Grad Split GIS i DPU / OpenStreetMap · 22. rujna 2026. · perone treba projektirati</text>
</g></svg>''')
target = ROOT / "public/prijedlozi/skolski-autobus.svg"
target.write_text("\n".join(parts))
print(target)
