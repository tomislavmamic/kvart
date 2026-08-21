#!/usr/bin/env python3
"""Izvodi presjek padine: od plohe odlagališta, niz Dračevac, do Bilica.

Karta odozgo pokazuje kamo zrak ide, ali ne i ono što svatko tko ondje živi
zna nogama: da odlagalište stoji **iznad** kuća. Presjek je jedina slika koja
to pokazuje izravno, a treba samo reljef koji već imamo.

Uz teren se crta i poklopac miješanja — visina do koje se zrak uopće miješa.
Ne uzima se iz literature nego iz mjerenja: gleda se desetina sati s najvišim
izmjerenim sumporovodikom na postaji uz plohu i uzima medijan dubine sloja u
tim satima. Ispadne oko 175 m, prema 335 m u prosječnom satu — dakle u satima
kad se namiriše zrak se miješa u upola plićoj kutiji.

Što se iz slike vidi, a što ne:

- **Vidi se** da su ploha, Dračevac i Bilice tada u istoj plitkoj kutiji zraka,
  i da je izvor na njezinu gornjem kraju.
- **Ne vidi se** poklopac ispod plohe. To je bila pretpostavka s kojom sam
  krenuo i podatci je ne podupiru: u najgorim satima poklopac je na oko 230 m
  nadmorske visine, dakle iznad vrha plohe (113 m). Slika govori o plitkosti
  kutije, ne o tome da odlagalište viri iz nje.

Presjek prati pravac od središta plohe do Bilica. Dračevac ne leži točno na
njemu, pa se označava ondje gdje se na pravac projicira, a njegova visinska
vrpca dolazi iz izmjerenih visina naselja, ne s pravca.

Pokretanje: `npm run izvedi-presjek`
"""

from __future__ import annotations

import json
import logging
import math
import os
import statistics
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import okvir  # noqa: E402
import postaje  # noqa: E402
import vjetar  # noqa: E402
from reljef_polje import (  # noqa: E402
    PRIKAZ,
    _pretvorba,
    _sidro,
    gladi,
    maska_plohe,
    ucitaj_reljef,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-presjek.ts"

OD, DO = "2024-09-01", "2026-08-17"

#: Mjesta kako stoje na karti, u koordinatama njezina SVG-a. Ista brojka na
#: dva mjesta bila bi dvije brojke koje se mogu raziću, pa ovdje stoje samo
#: krajevi pravca; visinske vrpce naselja dolaze iz `VISINE` na karti.
MJESTA_SVG = {
    "Karepovac": (497.0, 250.0),
    "Dračevac": (330.0, 150.0),
    "Bilice": (120.0, 100.0),
}

#: Koliko se uzoraka uzme uzduž pravca.
UZORAKA = 220

#: Polovica širine pojasa oko pravca, u metrima. Teren nije oštrica, pa se uz
#: srednju crtu bilježi i raspon u pojasu — inače presjek tvrdi točnost koju
#: jedan pravac preko brda nema.
POJAS_M = 120.0

#: Desetina sati s najvišim sumporovodikom; iz nje se čita poklopac.
NAJGORI_UDIO = 0.1


def _iz_svg(x: float, y: float) -> tuple[float, float]:
    """Vraća (lon, lat) za točku u koordinatama SVG-a karte."""
    lon = okvir.ZAPAD + x / okvir.SIRINA * (okvir.ISTOK - okvir.ZAPAD)
    lat = okvir.SJEVER - y / okvir.VISINA * (okvir.SJEVER - okvir.JUG)
    return lon, lat


def _u_mrezu(lon: float, lat: float) -> tuple[float, float]:
    """Vraća (stupac, redak) u računskoj rešetki, kao decimalne brojeve."""
    x, y = _pretvorba().TransformPoint(lon, lat)[:2]
    return (x - PRIKAZ.x0) / PRIKAZ.dx, (PRIKAZ.y1 - y) / PRIKAZ.dx


def _poklopac() -> dict[str, float]:
    """Čita dubinu miješanog sloja u satima kad se najviše namiriše.

    Returns:
        Rječnik s medijanom svih sati i s medijanom i kvartilima najgorih.
    """
    okolnosti = vjetar.uvjeti(OD, DO)
    niz = postaje.satno("k1", "H2S")
    parovi = [
        (v, float(okolnosti[k]["granicni"]))
        for k, v in niz.items()
        if k in okolnosti and okolnosti[k].get("granicni") is not None
    ]
    parovi.sort(key=lambda p: -p[0])
    najgori = sorted(g for _, g in parovi[: int(len(parovi) * NAJGORI_UDIO)])
    return {
        "sati": len(parovi),
        "svi": statistics.median(g for _, g in parovi),
        "najgori": statistics.median(najgori),
        "donji": najgori[len(najgori) // 4],
        "gornji": najgori[3 * len(najgori) // 4],
    }


def glavno() -> None:
    """Uzorkuje teren uzduž pravca i piše generirani modul."""
    z = gladi(ucitaj_reljef(), 3)
    ploha = maska_plohe()
    sidro = _sidro(z)

    pocetak = _u_mrezu(*_iz_svg(*MJESTA_SVG["Karepovac"]))
    kraj = _u_mrezu(*_iz_svg(*MJESTA_SVG["Bilice"]))
    duljina_m = math.hypot(kraj[0] - pocetak[0], kraj[1] - pocetak[1]) * PRIKAZ.dx
    # Jedinični vektor okomit na pravac, za pojas oko njega.
    dx, dy = kraj[0] - pocetak[0], kraj[1] - pocetak[1]
    n = math.hypot(dx, dy)
    ox, oy = -dy / n, dx / n

    tocke = []
    for i in range(UZORAKA):
        t = i / (UZORAKA - 1)
        cx, cy = pocetak[0] + t * dx, pocetak[1] + t * dy
        pojas = []
        koraka = int(POJAS_M / PRIKAZ.dx)
        for k in range(-koraka, koraka + 1):
            j = int(round(cy + k * oy))
            m = int(round(cx + k * ox))
            if 0 <= j < z.shape[0] and 0 <= m < z.shape[1]:
                pojas.append(z[j, m])
        j0, m0 = int(round(cy)), int(round(cx))
        na_plohi = 0 <= j0 < z.shape[0] and 0 <= m0 < z.shape[1] and bool(ploha[j0, m0])
        tocke.append(
            {
                "m": round(t * duljina_m),
                "z": round(float(np.mean(pojas)), 1),
                "dno": round(float(np.min(pojas)), 1),
                "vrh": round(float(np.max(pojas)), 1),
                "ploha": na_plohi,
            }
        )

    mjesta = []
    for ime, svg in MJESTA_SVG.items():
        p = _u_mrezu(*_iz_svg(*svg))
        # Projekcija na pravac; Dračevac ne leži točno na njemu.
        t = ((p[0] - pocetak[0]) * dx + (p[1] - pocetak[1]) * dy) / (n * n)
        mjesta.append({"ime": ime, "m": round(max(0.0, min(1.0, t)) * duljina_m)})

    p = _poklopac()
    podatci = {
        "duljinaM": round(duljina_m),
        "sidroM": round(sidro),
        "tocke": tocke,
        "mjesta": mjesta,
        "poklopac": {
            "sati": p["sati"],
            "udio": NAJGORI_UDIO,
            "sviM": round(p["svi"]),
            "najgoriM": round(p["najgori"]),
            "donjiM": round(p["donji"]),
            "gornjiM": round(p["gornji"]),
        },
    }
    IZLAZ.write_text(
        "// Generirano iz DGU-ova LiDAR reljefa i izmjerenog sumporovodika.\n"
        "// Pokretanje: npm run izvedi-presjek — ne uređivati ručno.\n"
        "\n"
        "export const PRESJEK = "
        + json.dumps(podatci, ensure_ascii=False)
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "presjek %.0f m, teren %.0f–%.0f m; sidro %.0f m",
        duljina_m,
        min(t["dno"] for t in tocke),
        max(t["vrh"] for t in tocke),
        sidro,
    )
    logger.info(
        "poklopac: svi sati %.0f m, najgorih %.0f %% %.0f m (kvartili %.0f–%.0f)",
        p["svi"], 100 * NAJGORI_UDIO, p["najgori"], p["donji"], p["gornji"],
    )
    logger.info("napisano %s (%.0f kB)", IZLAZ.relative_to(KORIJEN), IZLAZ.stat().st_size / 1024)


if __name__ == "__main__":
    glavno()
