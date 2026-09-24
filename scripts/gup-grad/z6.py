#!/usr/bin/env python3
"""Odvaja Z6 od Z5 na rešetkama namjene, po natpisima na listu 2025.

Z5 (zaštitno i pejsažno zelenilo) i Z6 (zaštitno i pejsažno zelenilo s
postojećim građevinama — Meje, Bačvice) list crta ISTOM bojom (#80e000) i
razlikuje ih samo otisnutom oznakom. Odredbe ih razlikuju bitno: u Z6 su
postojeće kuće dio onoga što se čuva, u Z5 kuće nisu dopuštene. Zato:

  1. Na listu 2025. (CAD sa živim tekstom) crtaju se samo ispune boje Z5/Z6,
     bez teksta i crta; povezane plohe su zone.
  2. Zona s natpisom „Z6” (i bez „Z5”) je Z6; zona s oba natpisa dijeli se
     po najbližem natpisu; zona bez natpisa ostaje Z5.
  3. Listovi 2006. i 2015. nemaju teksta: piksel Z5/Z6 koji leži na Z6 iz
     2025. (uz rub od KORAK_RUB px za razliku u uklapanju) postaje Z6 —
     zone Z6 su postojeći dijelovi grada i između planova se ne sele.

Mijenja .cache/gup-grad/klase-<id>.npy (klasa Z5 → Z6 gdje treba) i dopisuje
klasu Z6 u mreza.json. Pokreće se nakon rasteriziraj.py, prije cestice.py.

Pokretanje:  python scripts/gup-grad/z6.py
"""
from __future__ import annotations

import json
import os
import re
import sys

import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore

BOJA_Z5 = (0x80, 0xE0, 0x00)
Z5 = 1 + [k for _, k, _ in R.PALETA].index("Z5")
Z6 = R.KLASA_PROMET + 1  # nova klasa iza svih iz palete i „P”
BOJA_Z6_KARTE = "#a0b400"  # list je nema zasebno; za kartu tamnija maslinasta
KORAK_RUB = 4  # px (8 m) — rub popune i razlika uklapanja starijih listova


def ispune_z5(p: "pymupdf.Page", dpi: float) -> np.ndarray:
    """Maska ispuna boje Z5/Z6 na listu, bez zaglađivanja."""
    w = p.rect.width
    novi = pymupdf.open()
    q = novi.new_page(width=p.mediabox.width, height=p.mediabox.height)
    sh = q.new_shape()
    for x in p.get_drawings():
        f = x.get("fill")
        if not f or (x["rect"] * p.rotation_matrix).x0 > w * 0.78:
            continue
        if tuple(int(round(v * 255)) for v in f[:3]) != BOJA_Z5:
            continue
        for it in x["items"]:
            if it[0] == "l":
                sh.draw_line(it[1], it[2])
            elif it[0] == "re":
                sh.draw_rect(it[1])
            elif it[0] == "qu":
                sh.draw_quad(it[1])
            elif it[0] == "c":
                sh.draw_bezier(it[1], it[2], it[3], it[4])
        sh.finish(fill=f, color=None, even_odd=x.get("even_odd", False), closePath=True)
    sh.commit()
    q.set_rotation(p.rotation)
    pymupdf.TOOLS.set_aa_level(0)
    try:
        pix = q.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0), alpha=False)
    finally:
        pymupdf.TOOLS.set_aa_level(8)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    return np.all(np.abs(a.astype(int) - BOJA_Z5) <= 4, axis=2)


def main() -> None:
    plan = next(p for p in R.PLANOVI if p["id"] == "gup-2025")
    put = R.preuzmi(plan)
    dpi = 72.0 * plan["afin"][0] / R.KORAK
    d = pymupdf.open(put)
    p = d[0]
    p.set_cropbox(p.mediabox)
    vis = p.mediabox.width if p.rotation in (90, 270) else p.mediabox.height
    k = dpi / 72.0

    maska = ispune_z5(p, dpi)
    natpisi = [(int((y0 + y1) / 2 * k), int((x0 + x1) / 2 * k), t)
               for x0, y0, x1, y1, t, *_ in p.get_text("words")
               if x0 < p.rect.width * 0.78 and t in ("Z5", "Z6")]
    print("natpisa:", {t: sum(1 for *_, x in natpisi if x == t) for t in ("Z5", "Z6")})

    oz, n = ndimage.label(maska)
    z6 = np.zeros(maska.shape, bool)
    for zona in range(1, n + 1):
        u = [(r, c, t) for r, c, t in natpisi if 0 <= r < oz.shape[0] and 0 <= c < oz.shape[1] and oz[r, c] == zona]
        oznake = {t for *_, t in u}
        if oznake == {"Z6"}:
            z6 |= oz == zona
        elif oznake == {"Z5", "Z6"}:
            # zona s oba natpisa: svaki piksel pripada najbližem natpisu
            tocke = np.zeros(maska.shape, np.uint8)
            for r, c, t in u:
                tocke[r, c] = 6 if t == "Z6" else 5
            _, (ri, ci) = ndimage.distance_transform_edt(tocke == 0, return_indices=True)
            z6 |= (oz == zona) & (tocke[ri, ci] == 6)
    print(f"zona Z5/Z6: {n}, u Z6: {int(z6.sum())} px lista")

    z6_tlo = R.na_rescetku(z6.astype(np.uint8), plan, dpi, vis) > 0
    z6_rub = ndimage.binary_dilation(z6_tlo, iterations=KORAK_RUB)

    with open(os.path.join(R.OUT, "mreza.json")) as f:
        mreza = json.load(f)
    for pl in R.PLANOVI:
        put_k = os.path.join(R.OUT, f"klase-{pl['id']}.npy")
        kl = np.load(put_k)
        kl[kl == Z6] = Z5  # ponovno pokretanje kreće od čistog Z5
        # i na 2025. rub: rešetka namjene (s popunom natpisa) i maska ispuna
        # razlikuju se za piksel-dva, pa bi oko svake Z6 ostao prsten Z5
        podrucje = z6_rub
        m = (kl == Z5) & podrucje
        kl[m] = Z6
        np.save(put_k, kl)
        ha = round(float(m.sum()) * R.KORAK * R.KORAK / 1e4, 1)
        print(f"{pl['id']}: Z6 {ha} ha")
        for zapis in mreza["planovi"]:
            if zapis["id"] == pl["id"]:
                # iz rešetke, ne oduzimanjem — ponovno pokretanje ne smije dvaput oduzeti
                zapis["ha"]["Z5"] = round(float((kl == Z5).sum()) * R.KORAK * R.KORAK / 1e4, 1)
                zapis["ha"]["Z6"] = ha
    mreza["klase"] = [x for x in mreza["klase"] if x["kod"] != "Z6"] + [
        {"i": Z6, "kod": "Z6", "naziv": "Zaštitno i pejsažno zelenilo s postojećim građevinama", "boja": BOJA_Z6_KARTE}
    ]
    with open(os.path.join(R.OUT, "mreza.json"), "w") as f:
        json.dump(mreza, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
