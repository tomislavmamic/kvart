#!/usr/bin/env python3
"""Okvir teksta na kartografskom prikazu, za navod slike u src/lib/gup-dokument/navodi.ts.

Traži tekst na listu (natpis, stavku legende, napomenu) i ispisuje okvir kao
udjele širine i visine lista [lijevo, gore, desno, dolje] — isti oblik koji
navod lista (`okvir`) očekuje. S --slika sprema i isječak za provjeru.

  python3 scripts/gup-grad/okvir-lista.py namjena-2025 "Z6"
  python3 scripts/gup-grad/okvir-lista.py namjena-2014 "poslovna namjena i stanovanje" --rub 0.02 --slika /tmp/x.png
"""
from __future__ import annotations

import argparse
import importlib.util
import os

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore

OVDJE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("dokument", os.path.join(OVDJE, "dokument.py"))
dokument = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dokument)  # type: ignore


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("list")
    a.add_argument("tekst")
    a.add_argument("--rub", type=float, default=0.01, help="rub oko nađenog, u udjelu širine lista")
    a.add_argument("--slika")
    arg = a.parse_args()
    cfg = next(l for l in dokument.LISTOVI if l["id"] == arg.list)
    p = pymupdf.open(dokument.preuzmi(cfg["pdf"], cfg["url"]))[0]
    p.set_cropbox(p.mediabox)  # kao pločice lista (dokument.py)
    W, H = p.rect.width, p.rect.height
    nadjeno = [r * p.rotation_matrix for r in p.search_for(arg.tekst)]
    if not nadjeno:
        raise SystemExit("nema")
    for i, r in enumerate(nadjeno):
        rw = arg.rub
        rh = arg.rub * W / H
        o = [max(0, r.x0 / W - rw), max(0, r.y0 / H - rh), min(1, r.x1 / W + rw), min(1, r.y1 / H + rh)]
        print(i, "[" + ", ".join(f"{v:.4f}" for v in o) + "]")
        if arg.slika and i == 0:
            clip = pymupdf.Rect(o[0] * W, o[1] * H, o[2] * W, o[3] * H) * ~p.rotation_matrix
            p.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=clip).save(arg.slika)


if __name__ == "__main__":
    main()
