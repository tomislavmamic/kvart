#!/usr/bin/env python3
"""Koridori ulica s lista 1 novog GUP-a koje rasterizacija upije u zonu.

List 1. „Korištenje i namjena prostora” (prijedlog 2025.) je vektorski: svaka
zona je obojena ploha, a ulice — postojeće i planirane — nisu ploha nego
praznina između ploha, s crnim obrubom zone. Rasterizacija po boji
(rasteriziraj.py) uske praznine popuni susjednom bojom (obrub, natpisi,
siva podloga), pa planirana ulica kroz blok M1 završi kao mješovita zona,
a slobodno zemljište na njoj kao mjesto za kuću.

Ovdje se iz PDF-a precrtaju SAMO ispune zona (bez obruba, podloge i
natpisa), na ~1 m po pikselu: što nije pod ispunom, plan ne boji. Uske
pukotine (< ~5 m, spoj dviju ploha) i mrvice se izbace. Zatim se za svaki
piksel pločica dijelova čestice (regije.py, 2025.) pita je li u takvoj
praznini; ako jest, a pločica ga vodi u zoni za gradnju, to je kandidat.

Rasterizacija zone uz ulicu koju JE prepoznala proširi za nekoliko metara
(upije crni obrub), pa bi uz svaku ulicu ostao rub „koridora” kroz vrtove.
Zato koridor mora imati jezgru dalje od UZ_ULICU_M od poznate ulice (klasa
P); jezgra se zatim proširi natrag za toliko, da se koridor spoji s mrežom.

Ulaz:   list 1 prijedloga 2025. (preuzima ga rasteriziraj.preuzmi, isto
        uklapanje kao rasterizacija), public/geo/gup-grad/regije.json i
        pločice „po odredbama” 2025. (iste kao ulaz za gradnja.ts)
Izlaz:  data/gup-grad/koridori-2025/<red>_<stupac>.png — 1 = koridor, samo
        pločice u kojima ga ima; čita ih scripts/gup-grad/gradnja.ts

Pokretanje (prije gradnja.ts):  /opt/homebrew/bin/python3 scripts/gup-grad/koridori.py
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image
from pyproj import Transformer
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

pymupdf = R.pymupdf
JAVNO = os.path.join(R.ROOT, "public")
IZLAZ = os.path.join(R.ROOT, "data", "gup-grad", "koridori-2025")
M_PO_PX = 1.0
# praznina uža od ovoga je spoj dviju ploha ili rub, ne ulica
NAJUZE_M = 5.0
# manja zatvorena praznina usred zone je rupa u crtežu, ne ulica
NAJMANJE_M2 = 150.0
# indeksi klasa (src/lib/gup-grad/model.ts) u kojima je koridor novost: zone za gradnju
GRADEVNE = (1, 2, 3, 4, 5, 6, 7, 12, 14)  # S, M/K5, D, I/K, T, L, R1, N, R5
P = 15
# rub zone uz već prepoznatu ulicu (vidi gore), m na tlu
UZ_ULICU_M = 6.0
TOLERANCIJA = 0.03
PLOCICA = 512


def boje_zona() -> list[tuple[float, float, float]]:
    return [tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)) for h, _, _ in R.PALETA]


def je_zona(fill, boje) -> bool:
    return fill is not None and any(max(abs(a - b) for a, b in zip(fill, c)) <= TOLERANCIJA for c in boje)


def maska_ispuna(put: str) -> tuple[np.ndarray, float, float]:
    """Samo ispune zona, crno na bijelom, na M_PO_PX. Vraća masku, dpi i visinu stranice u pt."""
    izvor = pymupdf.open(put)
    p = izvor[0]
    p.set_cropbox(p.mediabox)
    boje = boje_zona()
    nova = pymupdf.open()
    np_ = nova.new_page(width=p.rect.width, height=p.rect.height)
    sh = np_.new_shape()
    n = 0
    for d in p.get_drawings():
        if "f" not in d["type"] or not je_zona(d.get("fill"), boje):
            continue
        for it in d["items"]:
            if it[0] == "l":
                sh.draw_line(it[1], it[2])
            elif it[0] == "c":
                sh.draw_bezier(it[1], it[2], it[3], it[4])
            elif it[0] == "re":
                sh.draw_rect(it[1])
            elif it[0] == "qu":
                sh.draw_quad(it[1])
        sh.finish(fill=(0, 0, 0), color=None, width=0, closePath=d.get("closePath", True), even_odd=bool(d.get("even_odd")))
        n += 1
    sh.commit()
    sc = next(x for x in R.PLANOVI if x["id"] == "gup-2025")["afin"][0]
    dpi = 72.0 * sc / M_PO_PX
    pix = np_.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0), colorspace=pymupdf.csGRAY, alpha=False)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    print(f"  {n} ispuna zona, maska {pix.width}×{pix.height}")
    return a < 128, dpi, float(p.rect.height)


def praznine(ispuna: np.ndarray) -> np.ndarray:
    """Neobojeno dovoljno široko za ulicu, bez mrvica."""
    prazno = ~ispuna
    r = max(1, int(round(NAJUZE_M / M_PO_PX / 2)))
    krug = ndimage.generate_binary_structure(2, 1)
    prazno = ndimage.binary_opening(prazno, krug, iterations=r)
    oznake, n = ndimage.label(prazno)
    vel = ndimage.sum_labels(np.ones_like(oznake), oznake, index=np.arange(1, n + 1))
    mali = np.flatnonzero(vel * M_PO_PX ** 2 < NAJMANJE_M2) + 1
    prazno[np.isin(oznake, mali)] = False
    return prazno


def main() -> None:
    plan = next(x for x in R.PLANOVI if x["id"] == "gup-2025")
    put = R.preuzmi(plan)
    ispuna, dpi, visina_pt = maska_ispuna(put)
    prazno = praznine(ispuna)
    del ispuna

    sc, ox, oy = plan["afin"]
    zr = math.radians(plan.get("zakret", 0.0))
    c_, s_ = math.cos(zr), math.sin(zr)
    k = dpi / 72.0
    u_3765 = Transformer.from_crs(4326, 3765, always_xy=True)

    ind = json.load(open(os.path.join(JAVNO, "geo", "gup-grad", "regije.json")))
    korak = ind["korak"]
    plocice = []
    for p in ind["inacice"]["gradevna"]["2025"]:
        r, c = (int(x) for x in os.path.basename(p["url"]).removesuffix(".png").split("_"))
        plocice.append((r, c, p))
    H = (max(r for r, _, _ in plocice) + 1) * PLOCICA
    W = (max(c for _, c, _ in plocice) + 1) * PLOCICA
    klasa = np.zeros((H, W), np.uint8)
    kandidat = np.zeros((H, W), bool)
    lat_reda = np.zeros(H)
    velicina: dict[tuple[int, int], tuple[int, int]] = {}
    my = lambda la: np.log(np.tan(np.pi / 4 + np.radians(la) / 2))  # noqa: E731
    iz_my = lambda y: np.degrees(2 * np.arctan(np.exp(y)) - np.pi / 2)  # noqa: E731
    for r0, c0, p in plocice:
        a = np.array(Image.open(os.path.join(JAVNO, p["url"].lstrip("/"))))
        h, w = a.shape[:2]
        (jug, zapad), (sjever, istok) = p["granice"]
        lng = zapad + (np.arange(w) + 0.5) / w * (istok - zapad)
        lat = iz_my(my(sjever) - (np.arange(h) + 0.5) / h * (my(sjever) - my(jug)))
        LO, LA = np.meshgrid(lng, lat)
        X, Y = u_3765.transform(LO, LA)
        dx, dy = X - ox, Y - oy
        u = c_ * dx + s_ * dy
        v = -s_ * dx + c_ * dy
        px = np.floor(u / sc * k).astype(np.int64)
        py = np.floor((visina_pt - v / sc) * k).astype(np.int64)
        ok = (px >= 0) & (py >= 0) & (px < prazno.shape[1]) & (py < prazno.shape[0])
        gap = np.zeros((h, w), bool)
        gap[ok] = prazno[py[ok], px[ok]]
        na = a[..., 3] == 255
        y0, x0 = r0 * PLOCICA, c0 * PLOCICA
        velicina[(r0, c0)] = (h, w)
        klasa[y0:y0 + h, x0:x0 + w] = np.where(na, a[..., 0], 0)
        kandidat[y0:y0 + h, x0:x0 + w] = gap & na & np.isin(a[..., 0], GRADEVNE)
        lat_reda[y0:y0 + h] = lat
    del prazno

    # piksel je `korak` m Web Mercatora, na tlu korak·cos φ
    m_po_px = korak * math.cos(math.radians(float(np.mean(lat_reda[lat_reda != 0]))))
    do_ulice = ndimage.distance_transform_edt(klasa != P) * m_po_px
    jezgra = kandidat & (do_ulice > UZ_ULICU_M)
    jezgra = ndimage.binary_opening(jezgra, ndimage.generate_binary_structure(2, 1))
    oznake, n = ndimage.label(jezgra)
    vel = ndimage.sum_labels(np.ones_like(oznake), oznake, index=np.arange(1, n + 1))
    jezgra[np.isin(oznake, np.flatnonzero(vel * m_po_px ** 2 < NAJMANJE_M2) + 1)] = False
    r = int(math.ceil(UZ_ULICU_M / m_po_px))
    koridor = ndimage.binary_dilation(jezgra, ndimage.generate_binary_structure(2, 1), iterations=r) & kandidat

    if os.path.isdir(IZLAZ):
        shutil.rmtree(IZLAZ)
    os.makedirs(IZLAZ)
    ukupno_m2, broj = 0.0, 0
    for r0, c0, p in plocice:
        y0, x0 = r0 * PLOCICA, c0 * PLOCICA
        h, w = velicina[(r0, c0)]
        # maska iste veličine kao pločica (rubne su manje od PLOCICA)
        kor = koridor[y0:y0 + h, x0:x0 + w]
        if not kor.any():
            continue
        Image.fromarray(kor.astype(np.uint8) * 255, "L").convert("1").save(os.path.join(IZLAZ, os.path.basename(p["url"])), optimize=True)
        broj += 1
        ukupno_m2 += float((kor * (korak * np.cos(np.radians(lat_reda[y0:y0 + kor.shape[0]])))[:, None] ** 2).sum())
    print(f"{broj} pločica, {ukupno_m2 / 1e4:.1f} ha koridora u zonama za gradnju → {IZLAZ}")


if __name__ == "__main__":
    main()
