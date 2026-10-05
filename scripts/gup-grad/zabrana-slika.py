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

Izlaz: public/gup/zabrana/list-4d-dracevac.webp, karta-dracevac.webp i, za
rupu u zabrani, rupa-ppug-4-4.webp, rupa-gup-4d.webp i rupa-ortofoto.webp:
isto područje na oba lista i na ortofotu, s česticama bez oznake na listu
4.d (sporne.oznaka_4d) obrubljenima na sva tri.
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
from PIL import Image, ImageChops, ImageDraw
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as stransform, unary_union

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


def svijet(lng, lat, z: int = Z):
    n = 256 * 2 ** z
    s = math.sin(math.radians(lat))
    return (lng + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n


class Platno:
    """Siva ortofoto podloga okvira (kao .podloga-siva u globals.css) i crtanje slojeva po njoj.
    Posrednik na zumu z−1 daje pločice od 512 px, što je razlučivost zuma z."""

    def __init__(self, zapad, jug, istok, sjever, z: int = Z):
        self.z = z
        self.x0, self.y0 = svijet(zapad, sjever, z)
        x1, y1 = svijet(istok, jug, z)
        self.w, self.h = int(x1 - self.x0), int(y1 - self.y0)
        pod = Image.new("RGB", (self.w, self.h), "white")
        for tx in range(int(self.x0) // 512, int(x1) // 512 + 1):
            for ty in range(int(self.y0) // 512, int(y1) // 512 + 1):
                with urllib.request.urlopen(f"{WEB}/api/podloga/dof-2025/{z - 1}/{tx}/{ty}") as r:
                    pod.paste(Image.open(io.BytesIO(r.read())).convert("RGB"), (tx * 512 - int(self.x0), ty * 512 - int(self.y0)))
        g = (np.asarray(pod).astype(float) / 255) @ np.array([0.2126, 0.7152, 0.0722])
        g = np.clip(((g - 0.5) * 0.6 + 0.5) * 1.3, 0, 1)
        self.slika = Image.fromarray((np.dstack([g, g, g]) * 255).astype("uint8")).convert("RGBA")

    def kopija(self) -> "Platno":
        k = object.__new__(Platno)
        k.__dict__.update(self.__dict__)
        k.slika = self.slika.copy()
        return k

    def tocke(self, prsten) -> list:
        return [(lx - self.x0, ly - self.y0) for lx, ly in (svijet(*c, self.z) for c in prsten.coords)]

    def poligoni(self, geom):
        g = shape(geom) if isinstance(geom, dict) else geom
        return [p for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" and not p.is_empty]

    def prsteni(self, geom):
        for p in self.poligoni(geom):
            yield self.tocke(p.exterior)

    def sloj(self, oblici, boja: str, neprozirnost: float = 1.0, rub: int = 0, srafura: int = 0):
        """Ispuna, rub (debljina u px) ili šrafura (razmak crta u px) oblika (GeoJSON ili shapely, WGS84)."""
        l = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        d = ImageDraw.Draw(l)
        if srafura:
            maska = Image.new("L", (self.w, self.h), 0)
            dm = ImageDraw.Draw(maska)
            for g in oblici:
                for p in self.poligoni(g):
                    dm.polygon(self.tocke(p.exterior), fill=255)
                    for r in p.interiors:
                        dm.polygon(self.tocke(r), fill=0)
            for k in range(-self.h, self.w, srafura):
                d.line([(k, self.h), (k + self.h, 0)], fill=rgb(boja) + (255,), width=max(1, srafura // 5))
            l.putalpha(ImageChops.multiply(l.getchannel("A"), maska))
        else:
            for g in oblici:
                for p in self.poligoni(g):
                    pr = self.tocke(p.exterior)
                    if rub:
                        d.line(pr + [pr[0]], fill=rgb(boja) + (255,), width=rub, joint="curve")
                    else:
                        d.polygon(pr, fill=rgb(boja) + (255,))
                        for r in p.interiors:
                            d.polygon(self.tocke(r), fill=(0, 0, 0, 0))
        l.putalpha(l.getchannel("A").point(lambda v: int(v * neprozirnost)))
        self.slika = Image.alpha_composite(self.slika, l)

    def gotovo(self, sirina: int) -> Image.Image:
        s = self.slika.convert("RGB")
        return s.resize((sirina, round(s.height * sirina / s.width)), Image.LANCZOS)


def geo(ime: str) -> dict:
    return json.load(open(os.path.join(ROOT, "public", "geo", "gup-grad", ime)))


def karta(zapad, jug, istok, sjever) -> Image.Image:
    pl = Platno(zapad, jug, istok, sjever)
    planovi = geo("planski-rezim-2025.geojson")["features"]
    zbroj = geo("zabrana-2025.geojson")["zbroj"]
    na_karti = {r["broj"] for r in zbroj["po_upu"] if r["broj"] and r["fokus_cestice"] > 0 and r["fokus_slobodno_ha"] >= 0.05}
    cestice = geo("zabrana-izgradjenost-2025.geojson")["features"]
    vazeci = [f["geometry"] for f in planovi if f["properties"]["vrsta"] == "vazeci"]
    pl.sloj(vazeci, VAZECI, 0.35)
    pl.sloj(vazeci, VAZECI, 1.0, rub=2)
    for vrsta in ("sanacija", "preobrazba"):
        ove = [f for f in cestice if f["properties"]["vrsta"] == vrsta]
        pl.sloj([f["geometry"] for f in ove if f["properties"]["izgradjena"]], BOJE[vrsta], 0.4)
        pl.sloj([f["geometry"] for f in ove if not f["properties"]["izgradjena"]], TAMNE[vrsta], 0.85)
    pl.sloj([f["geometry"] for f in cestice], CESTICA, 0.5, rub=1)
    pl.sloj([f["geometry"] for f in planovi if f["properties"]["vrsta"] == "propisan" and f["properties"].get("broj") in na_karti],
            UPU, 1.0, rub=3)
    return pl.slika.convert("RGB")


# Rupa u zabrani: zabrana (sve oznake lista 4.d) crveno, rupa ljubičasto
ZABRANA = "#ef4444"


def slika_rupe(zapad, jug, istok, sjever, sirina: int = 900, z: int = 18) -> Image.Image:
    """Jedna slika: gdje vrijedi zabrana (sve oznake lista 4.d, crveno), rupa (čestice bez oznake
    prema sporne.oznaka_4d, ljubičasto), obuhvat UPU-a (plavo) i čestice (tanko). Čestica u rupi
    većinom je bez oznake, pa se rub oznake koji je dotiče ne crta preko nje."""
    pl = Platno(zapad, jug, istok, sjever, z=z)
    sve = []
    for put in sorted(glob.glob(os.path.join(ROOT, "public", "geo", "gup-grad", "cestice", "*.json"))):
        for f in json.load(open(put))["features"]:
            g = shape(f["geometry"])
            x0, y0, x1, y1 = g.bounds
            if not (x1 < zapad or x0 > istok or y1 < jug or y0 > sjever):
                sve.append(g)
    planovi = geo("planski-rezim-2025.geojson")["features"]
    oznake = [f["geometry"] for f in geo("zabrana-2025.geojson")["features"]
              if f["properties"]["vrsta"] in ("sanacija", "preobrazba", "neuredeno", "negradivo")]
    rupe_ovdje = rupe(zapad, jug, istok, sjever)
    # čestica u rupi većinom je bez oznake (oznaka_4d); rub oznake koji je dotiče ne crta se preko nje
    oznake = [unary_union([shape(g) for g in oznake]).difference(unary_union(rupe_ovdje))]
    pl.sloj(oznake, ZABRANA, 0.45)
    pl.sloj(rupe_ovdje, RUPA, 0.65)
    pl.sloj(sve, "#57534e", 0.4, rub=1)
    pl.sloj(rupe_ovdje, RUPA, 1.0, rub=4)
    pl.sloj([f["geometry"] for f in planovi if f["properties"]["vrsta"] == "vazeci"], VAZECI, 0.35)
    pl.sloj([f["geometry"] for f in planovi if f["properties"]["vrsta"] == "propisan"], UPU, 1.0, rub=4)
    print(f"rupa: {len(rupe_ovdje)} čestica u okviru")
    return pl.gotovo(sirina)


def obrubi(slika: Image.Image, u_izrez, mjerilo: tuple[float, float], oblici: list, debljina: int = 4) -> Image.Image:
    """Ljubičasti rub oblika (WGS84) na izrezu lista, preslikan kao i izrez."""
    s = slika.copy()
    d = ImageDraw.Draw(s)
    for g in oblici:
        for poli in g.geoms if g.geom_type == "MultiPolygon" else [g]:
            pr = [(x * mjerilo[0], y * mjerilo[1]) for x, y in (u_izrez(*c) for c in poli.exterior.coords)]
            d.line(pr + [pr[0]], fill=rgb(RUPA), width=debljina, joint="curve")
    return s


def slike_rupe(zapad, jug, istok, sjever, sirina: int = 760) -> dict[str, Image.Image]:
    """Isto područje na listu 4.4 PPUG-a, na listu 4.d novog GUP-a i na ortofotu, s istim česticama u rupi
    obrubljenima na sva tri, za usporedbu s planovima."""
    okvir = (zapad, jug, istok, sjever)
    rupe_ovdje = rupe(*okvir)
    orto = slika_rupe(*okvir, sirina=sirina, z=17)
    out = {"rupa-ortofoto.webp": orto}
    for ime, lid in (("rupa-ppug-4-4.webp", "ppug-podrucja-istok-2025"), ("rupa-gup-4d.webp", "planske-mjere-2025")):
        izrez, u_izrez = izrez_lista(lid, *okvir)
        mjerilo = (orto.width / izrez.width, orto.height / izrez.height)
        out[ime] = obrubi(izrez.resize(orto.size, Image.LANCZOS), u_izrez, mjerilo, rupe_ovdje)
    return out


def main() -> None:
    # za isprobavanje: zapad jug istok sjever [predmetak imena]
    okvir = tuple(float(v) for v in sys.argv[1:5]) if len(sys.argv) >= 5 else OKVIR
    izlaz = sys.argv[5] if len(sys.argv) >= 6 else IZLAZ
    os.makedirs(izlaz, exist_ok=True)
    desno = karta(*okvir)
    visina = round(desno.height * SIRINA / desno.width)
    desno = desno.resize((SIRINA, visina), Image.LANCZOS)
    lijevo = izrez_lista("planske-mjere-2025", *okvir)[0].resize((SIRINA, visina), Image.LANCZOS)
    slike = {"list-4d-dracevac.webp": lijevo, "karta-dracevac.webp": desno, **slike_rupe(*OKVIR)}
    for ime, s in slike.items():
        put = os.path.join(izlaz, ime)
        s.save(put, "WEBP", quality=80, method=6)
        print(put, s.size, f"{os.path.getsize(put) / 1024:.0f} kB")


if __name__ == "__main__":
    main()
