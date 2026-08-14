#!/usr/bin/env python3
"""Zajednički dohvat DGU-ova LiDAR reljefa (DMR) i pretvorbe koordinata.

Prozor, adresa servisa i ime pokrivenosti stoje na jednom mjestu jer iz istog
rastera izlaze dvije nezavisne stvari: površinski tokovi
(`izvedi-tokove.py`) i sjenčanje, izohipse i mreža visina
(`izvedi-reljef.py`). Da su konstante u dvije datoteke, prva promjena prozora
razišla bi tokove i sjenčanje za nekoliko stotina metara — a to se na karti
ne bi vidjelo kao greška nego kao loše poklapanje slojeva.

Zasad ovaj modul koristi samo `izvedi-reljef.py`. `izvedi-tokove.py` još drži
vlastitu kopiju `skini_dmr()` i `_pretvorba()`, i namjerno se ne dira dok
traje njegova prerada — spajanje tih dviju kopija je prvi zahvat nakon što
ona sleti, a ne usput.

WCS, ne WMS: `dmr__DMR_BW` preko WCS-a vraća pravi Float32 u metrima, dok
isti servis na WMS-u daje samo hipsometrijsku sliku. Ime sloja
(„Hipsometrijska skala crno-bijela”) na to ne upućuje.
"""
from __future__ import annotations

import logging
import os
import urllib.request

from osgeo import osr

logger = logging.getLogger(__name__)

KORIJEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREDMEMORIJA = os.path.join(KORIJEN, ".cache", "dmr.tif")

WCS = "https://geoportal.dgu.hr/services/dmr/wcs"
POKRIVENOST = "dmr__DMR_BW"  # jedini sloj s pravim visinama, ne slikom

# Kvart je E 499070–500817, N 4820064–4821053 (EPSG:3765). Prozor ga drži u
# sredini: sjeverni rub na razvodnici pod Kozjakom, zapadni u moru kod
# Vranjica, da tok ima i izvor i ušće unutar računa.
PROZOR = (496500, 4818500, 502500, 4823500)


def pretvorba(iz_epsg: int, u_epsg: int) -> osr.CoordinateTransformation:
    """Transformacija između dva EPSG-a u uobičajenom redoslijedu osi.

    Args:
        iz_epsg: Izvorni EPSG kod.
        u_epsg: Odredišni EPSG kod.

    Returns:
        Transformacija koja prima i vraća (x, y), a ne (y, x) — GDAL od
        verzije 3 inače poštuje redoslijed osi iz definicije CRS-a, pa
        EPSG:4326 dolazi kao (lat, lon).
    """
    a = osr.SpatialReference()
    a.ImportFromEPSG(iz_epsg)
    a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    b = osr.SpatialReference()
    b.ImportFromEPSG(u_epsg)
    b.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(a, b)


def skini_dmr() -> str:
    """Skida DMR s DGU WCS-a; drugi put čita iz `.cache/`.

    Returns:
        Putanja do lokalnog GeoTIFF-a s visinama u metrima (EPSG:3765).
    """
    if os.path.exists(PREDMEMORIJA):
        logger.info("DMR iz predmemorije: %s", PREDMEMORIJA)
        return PREDMEMORIJA
    os.makedirs(os.path.dirname(PREDMEMORIJA), exist_ok=True)
    x0, y0, x1, y1 = PROZOR
    url = (
        f"{WCS}?service=WCS&version=2.0.1&request=GetCoverage"
        f"&coverageId={POKRIVENOST}&format=image/tiff"
        f"&subset=E({x0},{x1})&subset=N({y0},{y1})"
    )
    logger.info("skidam DMR (%d × %d m)...", x1 - x0, y1 - y0)
    with urllib.request.urlopen(url, timeout=300) as odgovor:
        podaci = odgovor.read()
    with open(PREDMEMORIJA, "wb") as f:
        f.write(podaci)
    logger.info("  %.1f MB", len(podaci) / 1e6)
    return PREDMEMORIJA
