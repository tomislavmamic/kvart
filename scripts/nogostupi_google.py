"""Google's 3D view of the Dračevac 15 yard edge, aligned to the city's GIS.

Used by generate-sidewalk-obligations.py and generate-sidewalk-figures.py.

The view is a screenshot, not a map: it has no coordinates. It is aligned by a
similarity (shift, rotation, one scale) fitted to the manholes and gullies of
the city's drainage layers that show on it, all at street level. A similarity
keeps the picture as Google drew it, and the points lie on both curbs, so the
fit holds across the street as well as along it.

Google draws the view from a camera above its middle, so what stands tall
(crowns, roofs) leans a little away from the middle; the wall and the ground do
not. DGU's orthophotos lean tall things too, here some 2 m to the north, which
is why the boundary is measured on this view (docs/prijedlozi/nogostupi-obveze.md).
"""
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "scripts/data/dracevac-15-google.json"
IMAGE = ROOT / "public/prijedlozi/nogostupi-obveze/dracevac-15-google.jpg"


def _fit(src, dst):
    """Least-squares similarity src → dst (Umeyama), both (n, 2)."""
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    u, sigma, vt = np.linalg.svd(b.T @ a / len(src))
    d = np.diag([1, np.sign(np.linalg.det(u @ vt))])
    rotation = u @ d @ vt
    scale = np.trace(np.diag(sigma) @ d) / (a ** 2).sum(1).mean()
    return scale, rotation, md - scale * rotation @ ms


def load():
    data = json.loads(DATA.read_text())
    # pixel y points down, map y up: flip before fitting so the fit stays a rotation
    px = np.array([p["px"] for p in data["kontrolne_tocke"]], float) * [1, -1]
    xy = np.array([p["xy_3765"] for p in data["kontrolne_tocke"]], float)
    scale, rotation, shift = _fit(px, xy)
    residual = (scale * px @ rotation.T + shift) - xy

    def to_metres(points):
        return [tuple(v) for v in scale * (np.asarray(points, float) * [1, -1]) @ rotation.T + shift]

    def to_px(x, y):
        v = rotation.T @ ((np.array([x, y]) - shift) / scale)
        return [round(float(v[0]), 1), round(float(-v[1]), 1)]

    width, height = data["velicina_px"]
    return {
        "source": data["izvor"],
        "image": IMAGE,
        "width": width,
        "height": height,
        "to_px": to_px,
        "metres_per_px": float(scale),
        "rms_m": float(np.sqrt((residual ** 2).sum(1).mean())),
        # the image's footprint on the map
        "frame": Polygon(to_metres([(0, 0), (width, 0), (width, height), (0, height)])),
        "wall": LineString(to_metres(data["zid"]["px"])),
        "canopy": Polygon(to_metres(data["krosnje"]["px"])),
    }
