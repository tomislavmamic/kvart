#!/usr/bin/env python3
"""Slike za /gup/zabrana: isto područje na listovima plana i na karti stranice.

Izrezi listova (4.d novog GUP-a i 4.4 PPUG-a) su iz pločica preglednika
(public/gup/listovi), uklopljeni koeficijentima „uklapanje” iz
data/gup-grad/dokument/listovi.json (HTRS96 → udio lista). Karta je isto
područje kako ga crta karta na /gup/zabrana: siva ortofoto
podloga (isti filter kao .podloga-siva u globals.css), čestice iz
zabrana-izgradjenost-2025.geojson u bojama BOJE_ZABRANE i TAMNE_ZABRANE, planovi
na snazi i obuhvati UPU-a s obojenim česticama.

Ortofoto se čita kroz posrednik aplikacije, pa mora raditi razvojni poslužitelj:
    npx next dev -p 3107
    python3 scripts/gup-grad/zabrana-slika.py [zapad jug istok sjever [mapa]]

Izlaz: public/gup/zabrana/list-4d-dracevac.webp, karta-dracevac.webp i
ppug-4-4-dracevac.webp. Na izrezima listova 4.4 i 4.d za pitanje o rupi u
zabrani (rupa-*.webp) ljubičasto su obrubljene čestice koje PPUG vodi kao
neizgrađene bez šrafure, a list 4.d ostavlja bez oznake (sporne.oznaka_4d).
"""
from __future__ import annotations

import glob
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
from shapely.ops import transform as stransform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sporne as SP  # noqa: E402
import zabrana as ZB  # noqa: E402

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
RUPA = "#c026d3"
U_HTRS = Transformer.from_crs(4326, 3765, always_xy=True).transform


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def izrez_lista(lid: str, zapad, jug, istok, sjever):
    """Izrez lista i preslikavanje (lng, lat) → piksel izreza."""
    lst = json.load(open(os.path.join(ROOT, "data", "gup-grad", "dokument", "listovi.json")))["listovi"][lid]
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
            put = os.path.join(ROOT, "public", "gup", "listovi", lid, str(lst["maksZum"]), f"{tx}_{ty}.avif")
            if os.path.exists(put):
                platno.paste(Image.open(put).convert("RGB"), (tx * 512 - int(x0), ty * 512 - int(y0)))

    def u_izrez(lng, lat):
        x, y = px(lng, lat)
        return x - int(x0), y - int(y0)

    return platno, u_izrez


def rupe(zapad, jug, istok, sjever) -> list:
    """Čestice u okviru koje PPUG vodi kao neizgrađene bez šrafure, a list 4.d ostavlja bez oznake (WGS84)."""
    ppug = json.load(open(os.path.join(ROOT, "data", "gup-grad", "ppug-2025.json")))["cestice"]
    b = np.load(ZB.REZIM)
    out = []
    for put in sorted(glob.glob(os.path.join(ROOT, "public", "geo", "gup-grad", "cestice", "*.json"))):
        for f in json.load(open(put))["features"]:
            p = f["properties"]
            if ppug.get(f"{p['ko']}|{p['kc']}") != "N":
                continue
            g = shape(f["geometry"])
            x0, y0, x1, y1 = g.bounds
            if x1 < zapad or x0 > istok or y1 < jug or y0 > sjever:
                continue
            if SP.oznaka_4d(stransform(ZB.U_HTRS, g), b) == "bez":
                out.append(g)
    return out


def obrubi(slika: Image.Image, u_izrez, mjerilo: tuple[float, float], oblici: list) -> Image.Image:
    s = slika.copy()
    d = ImageDraw.Draw(s)
    for g in oblici:
        for poli in g.geoms if g.geom_type == "MultiPolygon" else [g]:
            pr = [(x * mjerilo[0], y * mjerilo[1]) for x, y in (u_izrez(*c) for c in poli.exterior.coords)]
            d.line(pr + [pr[0]], fill=rgb(RUPA) + (255,) if s.mode == "RGBA" else rgb(RUPA), width=5, joint="curve")
    return s


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
    izrezi = {}
    for lid in ("planske-mjere-2025", "ppug-podrucja-istok-2025"):
        slika, u_izrez = izrez_lista(lid, *okvir)
        izrezi[lid] = (slika.resize((SIRINA, visina), Image.LANCZOS), u_izrez, (SIRINA / slika.width, visina / slika.height))
    lijevo = izrezi["planske-mjere-2025"][0]
    rupe_ovdje = rupe(*okvir)
    print(f"rupa: {len(rupe_ovdje)} čestica u okviru")
    rupa_4d = obrubi(*izrezi["planske-mjere-2025"], rupe_ovdje)
    rupa_ppug = obrubi(*izrezi["ppug-podrucja-istok-2025"], rupe_ovdje)
    for ime, s in (("list-4d-dracevac.webp", lijevo), ("karta-dracevac.webp", desno),
                   ("rupa-ppug-dracevac.webp", rupa_ppug), ("rupa-4d-dracevac.webp", rupa_4d)):
        put = os.path.join(izlaz, ime)
        s.save(put, "WEBP", quality=80, method=6)
        print(put, s.size, f"{os.path.getsize(put) / 1024:.0f} kB")


if __name__ == "__main__":
    main()
