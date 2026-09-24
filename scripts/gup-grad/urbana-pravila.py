#!/usr/bin/env python3
"""Područja urbanih pravila GUP-a (list „Urbana pravila”) na rešetku.

Najmanja površina građevne čestice (Ppmin) u odredbama GUP-a ne ovisi o
namjeni nego o PODRUČJU URBANOG PRAVILA (1.1 … 3.6, GP) i vrsti građevine.
Da bi se pravilo o premalim ostacima (src/lib/gup-grad/pravila.ts) držalo
odredbi, svaka čestica mora znati u kojem je području. Ova skripta crta
područja na istu rešetku od 2 m kao rasteriziraj.py.

Kako:
  1. Listovi su vektorski CAD izvozi. Iz PDF-a se uzimaju samo ispune boja
     urbanih pravila (bez teksta, međa, podloge zgrada) i crtaju se istim
     redom, bez zaglađivanja — svaki piksel ima TOČNU boju pravila.
  2. Boja → kod čita se iz natpisa na listu 2025. (CAD sa živim tekstom:
     boja ispune ispod svakog natpisa). Svi listovi (2012., 2015., 2025.)
     koriste istu shemu boja.
  3. Sedam pravila dijeli osnovnu boju s drugim (razlikuju se samo
     šrafurom): 1.1/3.3, 1.2/3.4, 1.3/3.5, 1.4/3.6, 1.7/GP, 1.7a/2.8,
     1.7c/1.7d. Na listu 2025. odlučuje natpis u istoj plohi, a ploha bez
     natpisa dobiva kod najbližeg natpisa iste boje. Na listovima bez teksta
     (2015., 2012.) odlučuje kod iz 2025. na tom mjestu, a ako ga ondje
     nema, najbliže područje tog koda iz 2025.

Za „2006.” objavljen je samo list urbanih pravila iz ciljanih izmjena 2012.
(EntryId 3178), pa se on koristi; odredbe su 1/06 s izmjenama 3/08.

Izlaz (.cache/gup-grad/): up-<id>.npy (uint8; 0 = nema, i = KODOVI[i-1]),
pregled-up-<id>.png, up.json (kodovi, boje, točnost prema natpisima).

Pokretanje:  python scripts/gup-grad/urbana-pravila.py
"""
from __future__ import annotations

import json
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore

DL = "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId={id}&Command=Core_Download"
PONOVNA = ("https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti"
           "%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/")

LISTOVI = [
    {"id": "gup-2025", "pdf": "up-2025.pdf", "url": PONOVNA + "4_c%20Urbana%20pravila.pdf", "plan": "gup-2025",
     "naziv": "4.c Urbana pravila, prijedlog za ponovnu javnu raspravu (travanj 2025.)"},
    {"id": "gup-2015", "pdf": "up-2015.pdf", "url": DL.format(id=3197), "plan": "gup-2015",
     "naziv": "4.b Urbana pravila, neslužbeni pročišćeni prikaz (Sl. gl. 55/14)"},
    {"id": "gup-2006", "pdf": "up-2012.pdf", "url": DL.format(id=3178), "plan": "gup-2015",
     "naziv": "4.b Urbana pravila, ciljane izmjene 2012. — jedini objavljeni list prije 2014."},
]

KOD = re.compile(r"^(\d\.\d+[a-z]?|GP\d*)$")
# Boje bez natpisa na listu 2025. (uski pojasevi uz obalu).
RUCNO = {"#a500dd": ["1.9"], "#bababa": ["1.9a"]}
TOLERANCIJA = 4  # razlika u kanalu između boje u PDF-u i renderirane


def hexb(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(v * 255)) if isinstance(v, float) else int(v) for v in rgb[:3])


def odhex(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.int16)


def normaliziraj(kod: str) -> str:
    return "GP" if kod.startswith("GP") else kod


def ispune(put: str, dpi: float, boje: list[str] | None) -> np.ndarray:
    """RGB raster samo ispuna (bez teksta i crta), bez zaglađivanja.

    `boje`: ako je zadano, crtaju se samo ispune čija je boja blizu jedne od
    njih (ostalo — podloga zgrada, crvene granice zaštite — se preskače).
    """
    src = pymupdf.open(put)
    p = src[0]
    p.set_cropbox(p.mediabox)
    w = p.rect.width
    uzorci = np.array([odhex(b) for b in boje]) if boje else None
    # Crteži su u NEZAKRENUTIM koordinatama (MediaBox); legenda je desno u
    # zakrenutom prikazu, pa se okvir za filtar prvo zakrene.
    rot = p.rotation_matrix
    novi = pymupdf.open()
    q = novi.new_page(width=p.mediabox.width, height=p.mediabox.height)
    sh = q.new_shape()
    for x in p.get_drawings():
        f = x.get("fill")
        if not f:
            continue
        r = x["rect"] * rot
        if r.x0 > w * 0.78 or r.width > w * 0.9:
            continue
        if uzorci is not None:
            c = odhex(hexb(f))
            if np.abs(uzorci - c).max(1).min() > TOLERANCIJA:
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
    # Nova stranica nosi isti MediaBox i zakret kao list, pa se renderira u
    # istim pikselima kao rasteriziraj.renderiraj().
    q.set_rotation(p.rotation)
    pymupdf.TOOLS.set_aa_level(0)
    try:
        pix = q.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0), alpha=False)
    finally:
        pymupdf.TOOLS.set_aa_level(8)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].copy()


def natpisi(put: str, dpi: float) -> list[tuple[int, int, str]]:
    d = pymupdf.open(put)
    p = d[0]
    p.set_cropbox(p.mediabox)
    w = p.rect.width
    k = dpi / 72.0
    return [(int((y0 + y1) / 2 * k), int((x0 + x1) / 2 * k), normaliziraj(t))
            for x0, y0, x1, y1, t, *_ in p.get_text("words") if x0 < w * 0.78 and KOD.match(t)]


def indeks_boja(rgb: np.ndarray, boje: list[str]) -> np.ndarray:
    """Piksel → indeks boje (1-based), 0 = nije boja pravila."""
    out = np.zeros(rgb.shape[:2], np.uint8)
    a = rgb.astype(np.int16)
    for i, b in enumerate(boje, start=1):
        m = (np.abs(a - odhex(b)).max(2) <= TOLERANCIJA)
        out[m & (out == 0)] = i
    return out


def main() -> None:
    os.makedirs(R.OUT, exist_ok=True)
    izvj: dict = {"listovi": []}
    ref: np.ndarray | None = None
    kodovi: list[str] = []
    boja_kodovi: dict[str, list[str]] = {}

    for lst in LISTOVI:
        plan = dict(next(p for p in R.PLANOVI if p["id"] == lst["plan"]))
        plan["pdf"], plan["url"] = lst["pdf"], lst["url"]
        put = R.preuzmi(plan)
        dpi = 72.0 * plan["afin"][0] / R.KORAK
        d = pymupdf.open(put)
        vis = d[0].mediabox.width if d[0].rotation in (90, 270) else d[0].mediabox.height

        if ref is None:
            # 2025.: boje i kodovi iz natpisa
            sve = ispune(put, dpi, None)
            nat = natpisi(put, dpi)
            glas: dict[str, dict[str, int]] = {}
            for r, c, kod in nat:
                b = hexb(sve[r, c])
                if b != "#ffffff":
                    glas.setdefault(b, {}).setdefault(kod, 0)
                    glas[b][kod] += 1
            boja_kodovi = {b: sorted(g, key=lambda k: -g[k]) for b, g in glas.items() if sum(g.values()) >= 1}
            boja_kodovi.update(RUCNO)
            boje = sorted(boja_kodovi)
            kodovi = sorted({k for v in boja_kodovi.values() for k in v},
                            key=lambda k: (k == "GP", [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", k)]))
            rgb = ispune(put, dpi, boje)
            bi = indeks_boja(rgb, boje)
            lista = np.zeros(bi.shape, np.uint8)
            for i, b in enumerate(boje, start=1):
                kand = boja_kodovi[b]
                m = bi == i
                if len(kand) == 1:
                    lista[m] = kodovi.index(kand[0]) + 1
                    continue
                # dijeljena boja: ploha (povezani pikseli te boje) dobiva kod natpisa u njoj
                oz, n = ndimage.label(m)
                kod_plohe = np.zeros(n + 1, np.uint8)
                for r, c, kod in nat:
                    if kod in kand and oz[r, c] > 0:
                        kod_plohe[oz[r, c]] = kodovi.index(kod) + 1
                # plohe bez natpisa: najbliži natpis jednog od kandidata
                tocke = np.zeros(m.shape, np.uint8)
                for r, c, kod in nat:
                    if kod in kand:
                        tocke[r, c] = kodovi.index(kod) + 1
                if tocke.any():
                    _, (ri, ci) = ndimage.distance_transform_edt(tocke == 0, return_indices=True)
                    najblizi = tocke[ri, ci]
                else:
                    najblizi = np.full(m.shape, kodovi.index(kand[0]) + 1, np.uint8)
                lista[m] = np.where(kod_plohe[oz[m]] > 0, kod_plohe[oz[m]], najblizi[m])
            ok = sum(1 for r, c, kod in nat if lista[r, c] and kodovi[lista[r, c] - 1] == kod)
            ima = sum(1 for r, c, _ in nat if lista[r, c])
            print(f"{lst['id']}: natpisa {len(nat)}, na ispuni {ima}, isti kod {ok} ({ok / max(ima, 1):.3f})")
            tocnost = ok / max(ima, 1)
            g = R.na_rescetku(lista, plan, dpi, vis)
            ref = g
            slaganje = None
        else:
            boje = sorted(boja_kodovi)
            rgb = ispune(put, dpi, boje)
            bi = indeks_boja(rgb, boje)
            gb = R.na_rescetku(bi, plan, dpi, vis)
            g = np.zeros(gb.shape, np.uint8)
            for i, b in enumerate(boje, start=1):
                kand = [kodovi.index(k) + 1 for k in boja_kodovi[b]]
                m = gb == i
                if len(kand) == 1:
                    g[m] = kand[0]
                    continue
                isti = m & np.isin(ref, kand)
                g[isti] = ref[isti]
                ostalo = m & ~isti
                if ostalo.any():
                    tocke = np.where(np.isin(ref, kand), ref, 0).astype(np.uint8)
                    _, (ri, ci) = ndimage.distance_transform_edt(tocke == 0, return_indices=True)
                    g[ostalo] = tocke[ri[ostalo], ci[ostalo]]
            obje = (g > 0) & (ref > 0)
            slaganje = float((g[obje] == ref[obje]).mean())
            tocnost = None
            print(f"{lst['id']}: isti kod kao 2025. na {slaganje:.3f} zajedničkih piksela")

        np.save(os.path.join(R.OUT, f"up-{lst['id']}.npy"), g)
        pal = np.zeros((len(kodovi) + 1, 3), np.uint8)
        pal[0] = 255
        for b, ks in boja_kodovi.items():
            for k in ks:
                pal[kodovi.index(k) + 1] = odhex(b)
        Image.fromarray(pal[g]).resize((R.W // 3, R.H // 3), Image.NEAREST).save(
            os.path.join(R.OUT, f"pregled-up-{lst['id']}.png"))
        izvj["listovi"].append({"id": lst["id"], "naziv": lst["naziv"], "url": lst["url"],
                                "slaganje_s_natpisima": tocnost, "isti_kod_kao_2025": slaganje})
    izvj["kodovi"] = kodovi
    izvj["boje"] = boja_kodovi
    with open(os.path.join(R.OUT, "up.json"), "w") as f:
        json.dump(izvj, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
