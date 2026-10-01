#!/usr/bin/env python3
"""Slika za /gup/zabrana: isto područje na listu 4.d prijedloga i na karti stranice.

Lijevo je izrez lista 4.d iz pločica preglednika (public/gup/listovi), uklopljen
koeficijentima „uklapanje” iz data/gup-grad/dokument/listovi.json (HTRS96 → udio
lista). Desno je isto područje kako ga crta karta na /gup/zabrana: siva ortofoto
podloga (isti filter kao .podloga-siva u globals.css), čestice iz
zabrana-izgradjenost-2025.geojson u bojama BOJE_ZABRANE i TAMNE_ZABRANE, planovi
na snazi i obuhvati UPU-a s obojenim česticama.

Ortofoto se čita kroz posrednik aplikacije, pa mora raditi razvojni poslužitelj:
    npx next dev -p 3107
    python3 scripts/gup-grad/zabrana-slika.py [zapad jug istok sjever [mapa]]

Izlaz: public/gup/zabrana/list-4d-dracevac.webp i karta-dracevac.webp
"""
from __future__ import annotations

import io
import json
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
from shapely.geometry import shape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEB = os.environ.get("KVART_WEB", "http://localhost:3107")
IZLAZ = os.path.join(ROOT, "public", "gup", "zabrana")
# Dračevac 2: dovoljno izbliza da se vide pojedine čestice
OKVIR = (16.4993, 43.5233, 16.5072, 43.5280)
SIRINA = 1100
Z = 16  # posrednik na z=15 daje pločice od 512 px, što je razlučivost zuma 16

BOJE = {"sanacija": "#ef4444", "preobrazba": "#fb923c"}
TAMNE = {"sanacija": "#dc2626", "preobrazba": "#ea580c"}
VAZECI, UPU, CESTICA = "#71717a", "#2563eb", "#3f3f46"
U_HTRS = Transformer.from_crs(4326, 3765, always_xy=True).transform


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def list_4d(zapad, jug, istok, sjever) -> Image.Image:
    lst = json.load(open(os.path.join(ROOT, "data", "gup-grad", "dokument", "listovi.json")))["listovi"]["planske-mjere-2025"]
    a, b, c, d, e, f = lst["uklapanje"]

    def px(lng, lat):
        E, N = U_HTRS(lng, lat)
        return (a * E + b * N + c) * lst["sirina"], (d * E + e * N + f) * lst["visina"]

    (x0, y0), (x1, y1) = px(zapad, sjever), px(istok, jug)
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    platno = Image.new("RGB", (int(x1) - int(x0) + 1, int(y1) - int(y0) + 1), "white")
    for tx in range(int(x0) // 512, int(x1) // 512 + 1):
        for ty in range(int(y0) // 512, int(y1) // 512 + 1):
            put = os.path.join(ROOT, "public", "gup", "listovi", "planske-mjere-2025", str(lst["maksZum"]), f"{tx}_{ty}.avif")
            if os.path.exists(put):
                platno.paste(Image.open(put).convert("RGB"), (tx * 512 - int(x0), ty * 512 - int(y0)))
    return platno


def svijet(lng, lat):
    n = 256 * 2 ** Z
    s = math.sin(math.radians(lat))
    return (lng + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n


def karta(zapad, jug, istok, sjever) -> Image.Image:
    x0, y0 = svijet(zapad, sjever)
    x1, y1 = svijet(istok, jug)
    w, h = int(x1 - x0), int(y1 - y0)
    pod = Image.new("RGB", (w, h), "white")
    for tx in range(int(x0) // 512, int(x1) // 512 + 1):
        for ty in range(int(y0) // 512, int(y1) // 512 + 1):
            with urllib.request.urlopen(f"{WEB}/api/podloga/dof-2025/15/{tx}/{ty}") as r:
                pod.paste(Image.open(io.BytesIO(r.read())).convert("RGB"), (tx * 512 - int(x0), ty * 512 - int(y0)))
    # grayscale(1) contrast(0.6) brightness(1.3), kao .podloga-siva
    g = (np.asarray(pod).astype(float) / 255) @ np.array([0.2126, 0.7152, 0.0722])
    g = np.clip(((g - 0.5) * 0.6 + 0.5) * 1.3, 0, 1)
    slika = Image.fromarray((np.dstack([g, g, g]) * 255).astype("uint8")).convert("RGBA")

    def prsteni(geom):
        g = shape(geom)
        for p in g.geoms if g.geom_type == "MultiPolygon" else [g]:
            yield [(lx - x0, ly - y0) for lx, ly in (svijet(*c) for c in p.exterior.coords)]

    def sloj(znacajke, boja: str, neprozirnost: float, rub: int = 0):
        nonlocal slika
        l = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(l)
        for f in znacajke:
            for pr in prsteni(f["geometry"]):
                if rub:
                    d.line(pr + [pr[0]], fill=rgb(boja) + (255,), width=rub)
                else:
                    d.polygon(pr, fill=rgb(boja) + (255,))
        l.putalpha(l.getchannel("A").point(lambda v: int(v * neprozirnost)))
        slika = Image.alpha_composite(slika, l)

    geo = os.path.join(ROOT, "public", "geo", "gup-grad")
    planovi = json.load(open(os.path.join(geo, "planski-rezim-2025.geojson")))["features"]
    zbroj = json.load(open(os.path.join(geo, "zabrana-2025.geojson")))["zbroj"]
    na_karti = {r["broj"] for r in zbroj["po_upu"] if r["broj"] and r["fokus_cestice"] > 0 and r["fokus_slobodno_ha"] >= 0.05}
    cestice = json.load(open(os.path.join(geo, "zabrana-izgradjenost-2025.geojson")))["features"]

    vazeci = [f for f in planovi if f["properties"]["vrsta"] == "vazeci"]
    sloj(vazeci, VAZECI, 0.35)
    sloj(vazeci, VAZECI, 1.0, rub=2)
    for vrsta in ("sanacija", "preobrazba"):
        ove = [f for f in cestice if f["properties"]["vrsta"] == vrsta]
        sloj([f for f in ove if f["properties"]["izgradjena"]], BOJE[vrsta], 0.4)
        sloj([f for f in ove if not f["properties"]["izgradjena"]], TAMNE[vrsta], 0.85)
    sloj(cestice, CESTICA, 0.5, rub=1)
    sloj([f for f in planovi if f["properties"]["vrsta"] == "propisan" and f["properties"].get("broj") in na_karti], UPU, 1.0, rub=3)
    return slika.convert("RGB")


def main() -> None:
    # za isprobavanje: zapad jug istok sjever [predmetak imena]
    okvir = tuple(float(v) for v in sys.argv[1:5]) if len(sys.argv) >= 5 else OKVIR
    izlaz = sys.argv[5] if len(sys.argv) >= 6 else IZLAZ
    os.makedirs(izlaz, exist_ok=True)
    desno = karta(*okvir)
    visina = round(desno.height * SIRINA / desno.width)
    desno = desno.resize((SIRINA, visina), Image.LANCZOS)
    lijevo = list_4d(*okvir).resize((SIRINA, visina), Image.LANCZOS)
    for ime, s in (("list-4d-dracevac.webp", lijevo), ("karta-dracevac.webp", desno)):
        put = os.path.join(izlaz, ime)
        s.save(put, "WEBP", quality=80, method=6)
        print(put, s.size, f"{os.path.getsize(put) / 1024:.0f} kB")


if __name__ == "__main__":
    main()
