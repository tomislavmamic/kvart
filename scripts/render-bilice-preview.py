#!/usr/bin/env python3
"""Create the proposal-card map from the same geometry as the Three.js scene."""
import html
import json
import math
from pathlib import Path

root = Path(__file__).resolve().parent.parent
scene = json.loads((root / "public/geo/prijedlozi/bilice-cesta-3d.json").read_text())
width, depth = scene["width"], scene["depth"]


def path(rings):
    return " ".join("M" + " L".join(f"{x:.2f},{z:.2f}" for x, _, z in ring) + " Z" for ring in rings)


def contains(rings, x, z):
    def in_ring(ring):
        inside = False
        for a, b in zip(ring[-1:] + ring[:-1], ring):
            dx, dz = b[0] - a[0], b[2] - a[2]
            length = math.hypot(dx, dz)
            if length and abs((x-a[0])*dz-(z-a[2])*dx) <= 1e-6*length and min(a[0], b[0])-1e-6 <= x <= max(a[0], b[0])+1e-6 and min(a[2], b[2])-1e-6 <= z <= max(a[2], b[2])+1e-6:
                return True
            if (a[2] > z) != (b[2] > z) and x < (b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0]:
                inside = not inside
        return inside
    return in_ring(rings[0]) and not any(in_ring(ring) for ring in rings[1:])


def inbound_arrows(segment):
    if not segment.get("onewayInbound"):
        return []
    points = list(reversed(segment["points"]))
    footprints = [f for f in scene["proposalFootprints"] if f["source"] == "existing" and f["segmentId"] == segment["id"]]
    distance, next_arrow, arrows = 0, 18, []
    for before, after in zip(points, points[1:]):
        dx, dz = after[0]-before[0], after[2]-before[2]
        length = math.hypot(dx, dz)
        if not length:
            continue
        while next_arrow < distance+length:
            fraction = (next_arrow-distance)/length
            x, z = before[0]+dx*fraction, before[2]+dz*fraction
            fx, fz, half_width = dx/length, dz/length, min(2.5, segment["widthM"]*.38)
            ring = [[x+fx*3.8, 0, z+fz*3.8], [x-fx*3-fz*half_width, 0, z-fz*3+fx*half_width], [x-fx*3+fz*half_width, 0, z-fz*3-fx*half_width]]
            if all(any(contains(f["rings"], point[0], point[2]) for f in footprints) for point in ring):
                arrows.append(ring)
            next_arrow += 35
        distance += length
    return arrows


svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-width/2} {-depth/2-65} {width} {depth+130}" role="img" aria-labelledby="title desc">',
       '<title id="title">Bilice — provjera cestovne veze</title>',
       '<desc id="desc">Zeleno korištenje postojećih cesta, narančasto nedostajući spojevi prema DPU-u i radni priključak. Bijele strelice označavaju jednosmjerni ulaz s D1. Ružičasto je probir proširenja prvih 75 m Bilica II. Izlaz na D1 nije potvrđen.</desc>',
       f'<rect x="{-width/2}" y="{-depth/2-65}" width="{width}" height="{depth+130}" fill="#e9e9df"/>']
for surface in scene["surfaces"]:
    if surface["role"] != "existing-road":
        continue
    svg.append(f'<path d="{path(surface["rings"])}" fill="#c1c3b8"/>')
for footprint in scene["proposalFootprints"]:
    if footprint["source"] not in {"existing", "dpu", "candidate"}:
        raise ValueError(f'Unknown footprint source: {footprint["source"]}')
    color = "#007e75" if footprint["source"] == "existing" else "#c66b28"
    svg.append(f'<path data-source="{footprint["source"]}" data-segment="{html.escape(footprint["segmentId"], quote=True)}" d="{path(footprint["rings"])}" fill="{color}" fill-rule="evenodd"/>')
for segment in scene["segments"]:
    for arrow in inbound_arrows(segment):
        svg.append(f'<path data-role="inbound-arrow" data-segment="{html.escape(segment["id"], quote=True)}" d="{path([arrow])}" fill="#fff8e7"/>')
for building in scene["buildings"]:
    svg.append(f'<path d="{path(building["rings"])}" fill="#fbf9f0" stroke="#a4a797" stroke-width=".6" fill-rule="evenodd"/>')
if scene.get("widening"):
    svg.append(f'<path d="{path(scene["widening"]["rings"])}" fill="#ad4777" stroke="#ffffff" stroke-width="1" fill-rule="evenodd"/>')
svg += [f'<text x="{-width/2+28}" y="{-depth/2-24}" font-family="system-ui,sans-serif" font-size="23" font-weight="700" fill="#263a30">Bilice · provjera pristupa</text>',
        f'<text x="{-width/2+28}" y="{depth/2+39}" font-family="system-ui,sans-serif" font-size="17" font-weight="600" fill="#835015">Izlaz na D1 nije potvrđen</text>',
        f'<text x="{-width/2+28}" y="{depth/2+58}" font-family="system-ui,sans-serif" font-size="11" fill="#52525c">Postojeće širine su shematske · DPU samo za nedostajuće spojeve</text>',
        f'<text x="{width/2-25}" y="{-depth/2-24}" text-anchor="end" font-family="system-ui,sans-serif" font-size="16" fill="#35473a">S ↑</text>']
for x, color, label in [(-width/2+28, "#007e75", "Postojeća cesta"), (-width/2+186, "#c66b28", "Nedostajući spoj"), (-width/2+352, "#ad4777", "Prvih 75 m")]:
    svg.append(f'<rect x="{x}" y="{-depth/2-13}" width="14" height="5" rx="2" fill="{color}"/>')
    svg.append(f'<text x="{x+20}" y="{-depth/2-6}" font-family="system-ui,sans-serif" font-size="11" fill="#35473a">{label}</text>')
for label in scene["labels"]:
    x, _, z = label["position"]
    attributes = f'x="{x:.2f}" y="{z:.2f}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700"'
    text = html.escape(label["label"])
    svg.append(f'<text {attributes} fill="none" stroke="#f5f5e9" stroke-width="3">{text}</text>')
    svg.append(f'<text {attributes} fill="#263a30">{text}</text>')
svg.append('</svg>')
(root / "public/prijedlozi/bilice-trasa.svg").write_text("\n".join(svg) + "\n")
