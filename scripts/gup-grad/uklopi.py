#!/usr/bin/env python3
"""Uklapa novi list GUP-a na već smještenu rešetku druge godine.

Prijedlog 2025. je novi CAD izvoz bez georeference i bez ikakvog uklapanja
u trace-plans.py. Plan se između godina mijenja u malom dijelu površine, pa
je slaganje klasa s već uklopljenim listom (2015.) dobra mjera smještaja:
traži se pomak i zakret koji maksimiziraju udio piksela iste klase.
Mjerilo se NE pušta da pluta (vidi obrazloženje u trace-plans.py) — list je
otisnut u 1:10 000, a sc je 25,4/72·10 m/pt uz korekciju plotera iz 2024.

Pokretanje:  python scripts/gup-grad/uklopi.py gup-2025 [referenca=gup-2015]
Ispis: (sc, ox, oy), zakret — prepisati u PLANOVI u rasteriziraj.py.
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402


def slaganje(kl_lista, plan, dpi, vis, ref, korak=5):
    """Udio istih klasa na svakom `korak`-tom pikselu rešetke."""
    sc, ox, oy = plan["afin"]
    t = math.radians(plan.get("zakret", 0.0))
    c, s = math.cos(t), math.sin(t)
    xs = R.MREZA_BBOX[0] + (np.arange(0, R.W, korak) + 0.5) * R.KORAK
    ys = R.MREZA_BBOX[3] - (np.arange(0, R.H, korak) + 0.5) * R.KORAK
    X, Y = np.meshgrid(xs, ys)
    dx, dy = X - ox, Y - oy
    k = dpi / 72.0
    px = np.floor((c * dx + s * dy) / sc * k).astype(np.int64)
    py = np.floor((vis - (-s * dx + c * dy) / sc) * k).astype(np.int64)
    ok = (px >= 0) & (py >= 0) & (px < kl_lista.shape[1]) & (py < kl_lista.shape[0])
    g = np.zeros(X.shape, np.uint8)
    g[ok] = kl_lista[py[ok], px[ok]]
    r = ref[::korak, ::korak]
    m = (r > 0) & (r < R.KLASA_PROMET) & (g > 0) & (g <= len(R.PALETA))
    return float((g[m] == r[m]).mean()) if m.any() else 0.0, int(m.sum())


def main() -> None:
    cilj = sys.argv[1] if len(sys.argv) > 1 else "gup-2025"
    ref_id = sys.argv[2] if len(sys.argv) > 2 else "gup-2015"
    plan = dict(next(p for p in R.PLANOVI if p["id"] == cilj))
    ref = np.load(os.path.join(R.OUT, f"klase-{ref_id}.npy"))
    rgb, dpi, vis = R.renderiraj(R.preuzmi(plan), plan["afin"][0])
    kl, cisto, tamno = R.klasificiraj(rgb, plan.get("klasa", 12), plan.get("srafura", False))
    del rgb
    kl = R.popuni(R.vecina(R.zatvori_srafuru(kl, tamno), cisto), tamno)
    sc, ox, oy = plan["afin"]
    zakret = plan.get("zakret", 0.0)

    def ocjena(ox_, oy_, z_, korak=5):
        p = plan | {"afin": (sc, ox_, oy_), "zakret": z_}
        return slaganje(kl, p, dpi, vis, ref, korak)

    best = (ocjena(ox, oy, zakret)[0], ox, oy, zakret)
    print("početno", best)
    # grubo: ±600 m u koracima od 40 m, pa 10 m, pa 2 m; zakret ±0,5°
    for raspon, korak_m in ((600, 40), (60, 10), (12, 2)):
        _, bx, by, bz = best
        for dx in np.arange(-raspon, raspon + 1, korak_m):
            for dy in np.arange(-raspon, raspon + 1, korak_m):
                s, _ = ocjena(bx + dx, by + dy, bz)
                if s > best[0]:
                    best = (s, bx + dx, by + dy, bz)
        print(f"  pomak ±{raspon} m / {korak_m} m →", best)
    for raspon, korak_z in ((0.6, 0.1), (0.1, 0.02)):
        _, bx, by, bz = best
        for dz in np.arange(-raspon, raspon + 1e-9, korak_z):
            # zakret oko ishodišta lista pomiče središte; kompenzira se
            # tako da se zakrene oko središta rešetke
            cx = (R.MREZA_BBOX[0] + R.MREZA_BBOX[2]) / 2
            cy = (R.MREZA_BBOX[1] + R.MREZA_BBOX[3]) / 2
            t = math.radians(dz)
            nx = cx + (bx - cx) * math.cos(t) - (by - cy) * math.sin(t)
            ny = cy + (bx - cx) * math.sin(t) + (by - cy) * math.cos(t)
            s, _ = ocjena(nx, ny, bz + dz)
            if s > best[0]:
                best = (s, nx, ny, bz + dz)
        print(f"  zakret ±{raspon}° →", best)
        _, bx, by, bz = best
        for dx in np.arange(-6, 7, 2):
            for dy in np.arange(-6, 7, 2):
                s, _ = ocjena(bx + dx, by + dy, bz)
                if s > best[0]:
                    best = (s, bx + dx, by + dy, bz)
    s_fino, n = ocjena(best[1], best[2], best[3], korak=1)
    print(f"KONAČNO: afin=({sc}, {best[1]:.3f}, {best[2]:.3f}), zakret={best[3]:.4f}; "
          f"slaganje {s_fino:.3f} na {n} px")


if __name__ == "__main__":
    main()
