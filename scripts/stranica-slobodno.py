#!/usr/bin/env python3
"""Slaže samostalnu HTML stranicu sa slobodnim stambenim česticama.

Stranica je jedna datoteka bez ijednog vanjskog zahtjeva — geometrija,
stil i skripta idu unutra. To je uvjet mjesta na kojem se objavljuje
(vanjski hostovi su blokirani), ali i dobra osobina za dokument koji se
šalje mailom ili nosi na sastanak: otvori se i za deset godina.

Karta se ne crta Leafletom nego kao SVG u metrima: obuhvat je 4×3,3 km u
HTRS96/TM, pa je koordinata ujedno i položaj na crtežu. Time otpada i
biblioteka i pločice s interneta.

Koordinate se ZAOKRUŽUJU na cijeli metar, ne pojednostavljuju. Douglas-
Peucker bi svakoj čestici razmaknuo zajedničku među sa susjedom i ostavio
proreze; zaokruživanje istu ulaznu točku uvijek preslika na istu izlaznu,
pa međe ostaju spojene, a zapis se skrati na trećinu.

Ulaz:  public/geo/analiza/stambeno-slobodno-sire.geojson (+ izvještaj)
Izlaz: public/slobodne-cestice.html

Cijeli lanac, od arhive do stranice:

    npm run izvadi-sire        # SHP.zip → public/geo/sire/ (42 MB, gitignore)
    npm run slobodne-sire      # analiza → public/geo/analiza/…-sire.geojson
    npm run stranica-slobodno  # → public/slobodne-cestice.html

Prvi korak traži SHP.zip u korijenu i jedini je koji ga treba; druga dva
rade iz onoga što je u gitu, pa se stranica može ponovno složiti i bez
arhive ako `public/geo/sire/` postoji.

Oblikovanje i sve ponašanje karte stoje u scripts/predlozak_slobodno.py.

Pokretanje:  /opt/homebrew/bin/python3 scripts/stranica-slobodno.py
"""
from __future__ import annotations

import json
import os
from typing import Any

from osgeo import ogr, osr

ogr.UseExceptions()

KORIJEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(KORIJEN, "public", "geo")
IZLAZ = os.path.join(KORIJEN, "public", "slobodne-cestice.html")

SLOJ = os.path.join(GEO, "analiza", "stambeno-slobodno-sire.geojson")
IZVJESTAJ = os.path.join(GEO, "analiza", "_stambeno-slobodno-sire.json")
CESTE = [os.path.join(GEO, "sire", f"{n}.geojson")
         for n in ("ulice", "ceste-nerazvrstane", "drzavne-ceste")]

PROZOR = (497574, 4818898, 501617, 4822231)   # EPSG:3765
SIRINA = PROZOR[2] - PROZOR[0]
VISINA = PROZOR[3] - PROZOR[1]


def _u_metre() -> osr.CoordinateTransformation:
    izvor = osr.SpatialReference()
    izvor.ImportFromEPSG(4326)
    izvor.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    cilj = osr.SpatialReference()
    cilj.ImportFromEPSG(3765)
    cilj.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(izvor, cilj)


U_METRE = _u_metre()


def _tocka(x: float, y: float) -> tuple[int, int]:
    """Iz HTRS96/TM u koordinatu crteža: ishodište gore lijevo, y prema dolje."""
    return round(x - PROZOR[0]), round(PROZOR[3] - y)


def _prsten(r: ogr.Geometry) -> str:
    """Jedan prsten kao SVG podputanja, bez ponovljenih točaka."""
    tocke: list[tuple[int, int]] = []
    for i in range(r.GetPointCount()):
        t = _tocka(*r.GetPoint(i)[:2])
        if not tocke or t != tocke[-1]:
            tocke.append(t)
    if len(tocke) < 3:
        return ""
    return "M" + "L".join(f"{x} {y}" for x, y in tocke) + "Z"


def putanja(g: ogr.Geometry) -> str:
    """Poligon ili multipoligon kao jedna SVG putanja."""
    ime = g.GetGeometryName()
    if ime == "POLYGON":
        return "".join(_prsten(g.GetGeometryRef(i))
                       for i in range(g.GetGeometryCount()))
    if ime in ("MULTIPOLYGON", "GEOMETRYCOLLECTION"):
        return "".join(putanja(g.GetGeometryRef(i))
                       for i in range(g.GetGeometryCount()))
    return ""


def crta(g: ogr.Geometry) -> str:
    """Crta ili višedijelna crta kao SVG putanja."""
    ime = g.GetGeometryName()
    if ime == "LINESTRING":
        tocke: list[tuple[int, int]] = []
        for i in range(g.GetPointCount()):
            t = _tocka(*g.GetPoint(i)[:2])
            if not tocke or t != tocke[-1]:
                tocke.append(t)
        if len(tocke) < 2:
            return ""
        return "M" + "L".join(f"{x} {y}" for x, y in tocke)
    if ime in ("MULTILINESTRING", "GEOMETRYCOLLECTION"):
        return "".join(crta(g.GetGeometryRef(i))
                       for i in range(g.GetGeometryCount()))
    return ""


def ucitaj(put: str) -> list[tuple[dict[str, Any], ogr.Geometry]]:
    """GeoJSON → parovi (atributi, geometrija u EPSG:3765)."""
    ds = ogr.Open(put)
    sloj = ds.GetLayer(0)
    out = []
    for f in sloj:
        g = f.GetGeometryRef()
        if g is None:
            continue
        g = g.Clone()
        g.Transform(U_METRE)
        out.append((f.items(), g))
    return out


def cestice() -> list[dict[str, Any]]:
    """Čestice s putanjom i podacima za natuknicu."""
    out = []
    for p, g in ucitaj(SLOJ):
        d = putanja(g)
        if not d:
            continue
        sred = g.Centroid()
        out.append({
            "d": d,
            "kc": p.get("cestica"),
            "ko": p.get("ko"),
            "p": round(p.get("povrsina_m2") or 0),
            "s": round(p.get("slobodno_m2") or 0),
            "n": p.get("namjena"),
            "g": p.get("skupina"),
            "gs": round(p.get("skupina_slobodno_m2") or 0),
            "gp": p.get("skupina_pristup_m"),
            "z": 1 if p.get("bez_pristupa") else 0,
            "c": list(_tocka(sred.GetX(), sred.GetY())),
        })
    return out


def ceste() -> list[str]:
    """Prometna mreža kao podloga za snalaženje."""
    out = []
    for put in CESTE:
        if not os.path.exists(put):
            continue
        for _, g in ucitaj(put):
            d = crta(g)
            if d:
                out.append(d)
    return out


def skupine(cs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Nakupine sažete za tablicu i za oznake na maloj razini uvećanja."""
    po: dict[int, list[dict[str, Any]]] = {}
    for c in cs:
        po.setdefault(c["g"], []).append(c)
    out = []
    for broj, clanovi in po.items():
        xs = [c["c"][0] for c in clanovi]
        ys = [c["c"][1] for c in clanovi]
        out.append({
            "g": broj,
            "n": len(clanovi),
            "s": clanovi[0]["gs"],
            "z": clanovi[0]["z"],
            "p": clanovi[0]["gp"],
            "kc": [c["kc"] for c in sorted(clanovi, key=lambda c: -c["p"])][:4],
            "c": [round(sum(xs) / len(xs)), round(sum(ys) / len(ys))],
        })
    return sorted(out, key=lambda s: -s["s"])


def main() -> None:
    """Sastavlja stranicu."""
    if not os.path.exists(SLOJ):
        raise SystemExit(f"nema sloja: {SLOJ} — pokreni slobodne-parcele.py "
                         "--obuhvat sire")
    with open(IZVJESTAJ, encoding="utf-8") as f:
        izv = json.load(f)
    cs = cestice()
    sk = skupine(cs)
    podaci = {
        "prozor": {"w": SIRINA, "h": VISINA, "x": PROZOR[0], "y": PROZOR[3]},
        "cestice": cs,
        "skupine": sk,
        "ceste": ceste(),
        "izvjestaj": izv,
    }
    from predlozak_slobodno import stranica  # noqa: PLC0415  (lokalni predložak)
    html = stranica(podaci)
    with open(IZLAZ, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  čestica {len(cs)}, nakupina {len(sk)}, cesta {len(podaci['ceste'])}")
    print(f"  → {os.path.relpath(IZLAZ, KORIJEN)} "
          f"({os.path.getsize(IZLAZ) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
