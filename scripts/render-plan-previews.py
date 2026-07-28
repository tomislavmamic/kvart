#!/usr/bin/env python3
"""Renderira listove planova u PNG predloške za ručno georeferenciranje.

Automatsko uklapanje (ISPU obuhvat, fazna korelacija, glasanje po zgradama,
toponimi) radi za listove koji imaju sloj granice obuhvata ili rijetku
grafiku, ali pada na gustim listovima poput GUP-a. Za njih je najbrže da
čovjek povuče list na kartu — alat je na /admin/georef.

Skripta svakom listu:
  1. odreže sastavnicu (najveći okomiti prorez u crtežu),
  2. renderira samo područje crteža u PNG,
  3. zapiše koliko PDF točaka pokriva slika, da /admin/georef može iz
     položaja i mjerila slike izračunati afinu u PDF točkama.

Rezultat: public/geo/planovi/preview/<id>.png + preview/manifest.json

Pokretanje:  python3 scripts/render-plan-previews.py
Traži:       pdftoppm, pdfinfo (poppler), qpdf
"""
from __future__ import annotations

import glob
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdfvec import extract  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "sources", "planovi")
OUT = os.path.join(ROOT, "public", "geo", "planovi", "preview")

DPI = 100  # dovoljno da se prepoznaju ulice, a slika ostane ispod ~10 MB

# Listovi koje želimo moći ručno smjestiti. Putanja može biti i izvan repoa
# (npr. nacrt preuzet u ~/Downloads) — tada se navodi apsolutno.
LISTOVI: list[dict[str, str]] = [
    {
        "id": "gup-nacrt-2024-namjena",
        "naziv": "GUP Split — nacrt ID 2024., korištenje i namjena",
        "put": os.path.expanduser(
            "~/Downloads/4.3_Prikaz Izmjena i dopuna grafickog dijela.pdf"),
        "mjerilo": "1:10000",
    },
    {
        "id": "gup-2008-namjena",
        "naziv": "GUP Split 2008. — korištenje i namjena",
        "put": os.path.join(
            SRC, "GUP grada Splita", "Generalni urbanistički plan Splita",
            "Grafički dio", "3170_1_namjena.pdf"),
        "mjerilo": "1:10000",
    },
    {
        "id": "gup-2015-procisceni-namjena",
        "naziv": "GUP Split — neslužbeni pročišćeni 2015., korištenje i namjena",
        "put": os.path.join(
            SRC, "GUP grada Splita", "Generalni urbanistički plan Splita",
            "Odredbe za provođenje i Grafički dio GUP-a",
            "Neslužbeni pročišćeni kartografski prikazi",
            "3196_01_Koristenje i namjena.pdf"),
        "mjerilo": "1:10000",  # otisnuto na listu
    },
]


def rez_sastavnice(pts) -> float:
    """x nakon kojeg počinje sastavnica — najveći okomiti prorez u crtežu."""
    xs = sorted(p[0] for p in pts)
    if len(xs) < 2:
        return float("inf")
    raspon = xs[-1] - xs[0]
    najveci, rez = 0.0, xs[-1] + 1.0
    for a, b in zip(xs, xs[1:]):
        if (b - a) > najveci and a > xs[0] + raspon * 0.4:
            najveci, rez = b - a, a
    return rez if najveci > raspon * 0.03 else xs[-1] + 1.0


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    manifest = []

    for list_ in LISTOVI:
        put = list_["put"]
        if not os.path.exists(put):
            print(f"  ! preskačem {list_['id']}: nema {put}")
            continue
        print(f"  · {list_['id']} …")

        layers, media = extract(put)
        pts = [p for items in layers.values() for it in items for p in it["pts"]]
        cut = rez_sastavnice(pts)
        crtez = [p for p in pts if p[0] < cut]
        x0 = max(0.0, min(p[0] for p in crtez))
        x1 = min(media[2], max(p[0] for p in crtez))
        y0 = max(0.0, min(p[1] for p in crtez))
        y1 = min(media[3], max(p[1] for p in crtez))

        # pdftoppm reže u pikselima od gornjeg lijevog ugla stranice
        k = DPI / 72.0
        px = int(x0 * k)
        py = int((media[3] - y1) * k)
        pw = int((x1 - x0) * k)
        ph = int((y1 - y0) * k)

        stem = os.path.join(OUT, list_["id"])
        subprocess.run(
            ["pdftoppm", "-png", "-r", str(DPI), "-f", "1", "-l", "1",
             "-x", str(px), "-y", str(py), "-W", str(pw), "-H", str(ph),
             put, stem],
            check=True, capture_output=True,
        )
        for cand in (f"{stem}-1.png", f"{stem}-01.png", f"{stem}-001.png"):
            if os.path.exists(cand):
                os.replace(cand, f"{stem}.png")
                break

        manifest.append({
            **{k2: v for k2, v in list_.items() if k2 != "put"},
            "png": f"/geo/planovi/preview/{list_['id']}.png",
            "px_sirina": pw,
            "px_visina": ph,
            # ključ za pretvorbu: koliko PDF točaka pokriva slika i gdje počinje
            "pdf_x0": round(x0, 3),
            "pdf_y0": round(y0, 3),
            "pdf_sirina_pt": round(x1 - x0, 3),
            "pdf_visina_pt": round(y1 - y0, 3),
            "dpi": DPI,
        })
        mb = os.path.getsize(f"{stem}.png") / 1e6
        print(f"    {pw}×{ph} px, {mb:.1f} MB, crtež {x1 - x0:.0f}×{y1 - y0:.0f} pt")

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(f"\n{len(manifest)} listova u {OUT}")


if __name__ == "__main__":
    main()
