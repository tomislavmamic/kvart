#!/usr/bin/env python3
"""Okvir karte za /karepovac — jedno mjesto za granice i mjerilo prikaza.

Sve kartice na stranici moraju stajati nad istim kvartom, u istom mjerilu i s
istim sjeverom, inače se prikazi ne mogu usporediti. Kad bi svaka skripta
držala vlastitu kopiju granica, prva promjena razišla bi slojeve za nekoliko
stotina metara — a to se na karti ne vidi kao greška nego kao loše poklapanje.

`izvedi-karepovac-karticu.py` još drži vlastitu kopiju ovih brojki i namjerno se
ne dira dok radi; `scripts/okvir_test.py` pazi da se dvije kopije ne raziđu.
"""

from __future__ import annotations

import math

# Granice okvira u WGS84; obuhvaćaju oba dijela kvarta i cijelo tijelo plohe.
ZAPAD, JUG, ISTOK, SJEVER = 16.4867, 43.5184, 16.5192, 43.5301

SIRINA = 660.0

_LAT0 = (JUG + SJEVER) / 2
_M_PO_LON = 111320 * math.cos(math.radians(_LAT0))
_M_PO_LAT = 110574

SIRINA_M = (ISTOK - ZAPAD) * _M_PO_LON
VISINA_M = (SJEVER - JUG) * _M_PO_LAT
VISINA = round(SIRINA * VISINA_M / SIRINA_M, 1)
PX_PO_M = SIRINA / SIRINA_M


def projiciraj(lon: float, lat: float) -> tuple[float, float]:
    """Pretvara WGS84 stupnjeve u piksele okvira.

    Args:
        lon: Zemljopisna dužina u stupnjevima.
        lat: Zemljopisna širina u stupnjevima.

    Returns:
        Par (x, y) u pikselima okvira; y raste prema jugu.
    """
    return (
        (lon - ZAPAD) / (ISTOK - ZAPAD) * SIRINA,
        (SJEVER - lat) / (SJEVER - JUG) * VISINA,
    )
