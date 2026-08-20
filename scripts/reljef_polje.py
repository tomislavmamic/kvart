#!/usr/bin/env python3
"""Reljef i polje vjetra nad kvartom — zajednička osnova za više izvoda.

Iz istog modela visina izlaze dvije nezavisne stvari: polje koje nosi prikaz
dima na stranici (`izvedi-polje-dima.py`) i godišnji račun raspršenja
(`izvedi-raspesenje.py`). Da svaka drži svoju kopiju, prva promjena obuhvata
razišla bi ih za nekoliko stotina metara — a to se ne bi vidjelo kao greška
nego kao loše poklapanje slojeva.

Polje vjetra nije podatak nego izvod: traži se polje kojemu je protok masa
dosljedan, ∇·(d·u) = 0, gdje je d debljina sloja zraka nad terenom. Time vjetar
obilazi padinu umjesto da ide kroz nju.
"""

from __future__ import annotations

import json
import logging
import math
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dmr  # noqa: E402
import okvir  # noqa: E402

gdal.UseExceptions()

logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent

@dataclass(frozen=True)
class Obuhvat:
    """Pravokutni obuhvat računa u HTRS96/TM i korak rešetke.

    Attributes:
        x0: Zapadni rub u metrima.
        y0: Južni rub u metrima.
        x1: Istočni rub u metrima.
        y1: Sjeverni rub u metrima.
        dx: Korak rešetke u metrima.
    """

    x0: float
    y0: float
    x1: float
    y1: float
    dx: float

    @property
    def nx(self) -> int:
        """Broj stupaca rešetke."""
        return int((self.x1 - self.x0) / self.dx)

    @property
    def ny(self) -> int:
        """Broj redaka rešetke."""
        return int((self.y1 - self.y0) / self.dx)


# Obuhvat prikaza: ploha, kvart i rub, da perjanica ima kamo otići. Ovo je
# obuhvat iz kojega izlazi polje dima na stranici i ne dira se bez potrebe —
# svaka promjena mijenja i generirani modul.
PRIKAZ = Obuhvat(498400, 4819100, 501800, 4821400, 20.0)

# Obuhvat računa raspršenja. Veći je jer perjanica koja izađe iz obuhvata ne
# može se vratiti, a upravo je vraćanje ono što model s pamćenjem treba moći
# pokazati. Rub je unutar prozora DMR-a (vidi `dmr.PROZOR`).
RASPRSENJE = Obuhvat(497600, 4818600, 502400, 4822200, 25.0)

#: Najtanji sloj zraka nad uzvisinom; ispod ovoga rješenje postaje osjetljivo
#: na jedan piksel reljefa umjesto na oblik padine.
NAJTANJI_SLOJ = 25.0

X0, Y0, X1, Y1 = PRIKAZ.x0, PRIKAZ.y0, PRIKAZ.x1, PRIKAZ.y1
DX = PRIKAZ.dx
NX = PRIKAZ.nx
NY = PRIKAZ.ny

# Rešetka koja ide u preglednik; finije od ovoga ništa se ne dobiva jer se
# čestice ionako crtaju na vlastitoj, gušćoj mreži.
GW, GH = 220, 108

SMJER_OD = 112.5
BRZINA = 1.2
DUBINA = 80.0


def _pretvorba() -> osr.CoordinateTransformation:
    """Vraća pretvorbu iz WGS84 u HTRS96/TM."""
    izvor = osr.SpatialReference()
    izvor.ImportFromEPSG(4326)
    izvor.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    cilj = osr.SpatialReference()
    cilj.ImportFromEPSG(3765)
    cilj.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(izvor, cilj)


def ucitaj_reljef(obuhvat: Obuhvat = PRIKAZ) -> np.ndarray:
    """Učitava DMR i uzorkuje ga na računsku rešetku.

    Args:
        obuhvat: Obuhvat i korak rešetke.

    Returns:
        Polje visina u metrima, oblika (ny, nx); bez rupa.
    """
    izvor = gdal.Open(dmr.skini_dmr())
    gt = izvor.GetGeoTransform()
    sirovo = izvor.GetRasterBand(1).ReadAsArray().astype(np.float64)
    sirovo[sirovo < -100] = np.nan

    xs = obuhvat.x0 + (np.arange(obuhvat.nx) + 0.5) * obuhvat.dx
    ys = obuhvat.y1 - (np.arange(obuhvat.ny) + 0.5) * obuhvat.dx
    cx = np.clip(((xs - gt[0]) / gt[1]).astype(int), 0, sirovo.shape[1] - 1)
    cy = np.clip(((ys - gt[3]) / gt[5]).astype(int), 0, sirovo.shape[0] - 1)
    z = sirovo[np.ix_(cy, cx)]

    for _ in range(6):
        if not np.isnan(z).any():
            break
        rub = np.pad(z, 1, mode="edge")
        susjedi = np.nanmean(
            np.stack([rub[:-2, 1:-1], rub[2:, 1:-1], rub[1:-1, :-2], rub[1:-1, 2:]]),
            axis=0,
        )
        z = np.where(np.isnan(z), susjedi, z)
    return np.nan_to_num(z, nan=float(np.nanmedian(z)))


def gladi(polje: np.ndarray, prolaza: int) -> np.ndarray:
    """Ublažava šum reljefa; bez toga nagib skače po pojedinim pikselima."""
    for _ in range(prolaza):
        rub = np.pad(polje, 1, mode="edge")
        polje = (
            rub[1:-1, 1:-1] * 4
            + rub[:-2, 1:-1]
            + rub[2:, 1:-1]
            + rub[1:-1, :-2]
            + rub[1:-1, 2:]
        ) / 8
    return polje


def maska_plohe(obuhvat: Obuhvat = PRIKAZ) -> np.ndarray:
    """Rasterizira obris odlagališta na računsku rešetku.

    Args:
        obuhvat: Obuhvat i korak rešetke.

    Returns:
        Logičko polje oblika (ny, nx); istina unutar plohe.

    Raises:
        SystemExit: Ako sloj s obrisom nedostaje.
    """
    put = KORIJEN / "public" / "geo" / "karepovac.geojson"
    if not put.exists():
        sys.exit(f"Nedostaje sloj: {put.relative_to(KORIJEN)}")
    znacajka = json.loads(put.read_text(encoding="utf8"))["features"][0]
    prsten = znacajka["geometry"]["coordinates"][0]

    tocke = np.array(
        [_pretvorba().TransformPoint(x, y)[:2] for x, y in prsten]
    )
    px = (tocke[:, 0] - obuhvat.x0) / obuhvat.dx
    py = (obuhvat.y1 - tocke[:, 1]) / obuhvat.dx

    gx, gy = np.meshgrid(
        np.arange(obuhvat.nx) + 0.5, np.arange(obuhvat.ny) + 0.5
    )
    unutra = np.zeros((obuhvat.ny, obuhvat.nx), bool)
    n = len(px)
    for i in range(n):
        j = (i + 1) % n
        y1, y2 = py[i], py[j]
        if y1 == y2:
            continue
        presjek = (gy >= min(y1, y2)) & (gy < max(y1, y2))
        xt = px[i] + (gy - y1) * (px[j] - px[i]) / (y2 - y1)
        unutra ^= presjek & (gx < xt)
    return unutra


def _rijesi(d: np.ndarray, desna: np.ndarray, korak: float) -> np.ndarray:
    """Rješava ∇·(d∇λ) = desna, uz λ = 0 na rubu obuhvata.

    Rub je Dirichletov, ne Neumannov: kroz rub obuhvata vjetar mora moći ući i
    izaći, pa se korekcija ondje gasi. Uz Neumannov rub zadatak nema rješenja
    kad d nije jednolik — ulazni i izlazni protok se ne poklapaju — a iteracija
    to ne prijavi nego samo polako odluta.

    Ovdje je to i izmjereno: raniji Jacobi sa 600 koraka ostavljao je
    relativni ostatak 0,12, a ni 20 000 koraka nije palo ispod 0,07. Polje se
    time razlikovalo do 40 % po brzini i do 16° po smjeru od konvergiranog —
    dakle perjanica je putovala krivom brzinom, a da ništa nije prijavilo grešku.

    Args:
        d: Debljina sloja po ćeliji, u metrima.
        desna: Desna strana jednadžbe, već pomnožena s korakom na kvadrat.
        korak: Korak rešetke u metrima; ulazi samo kroz `desna`.

    Returns:
        Polje λ; nula na rubu.

    Raises:
        RuntimeError: Ako sprežni gradijenti ne padnu ispod praga.
    """

    def rub(x: np.ndarray) -> np.ndarray:
        x[0, :] = 0
        x[-1, :] = 0
        x[:, 0] = 0
        x[:, -1] = 0
        return x

    de = 0.5 * (d + np.roll(d, -1, 1))
    dz = 0.5 * (d + np.roll(d, 1, 1))
    ds = 0.5 * (d + np.roll(d, 1, 0))
    dj = 0.5 * (d + np.roll(d, -1, 0))
    zbroj = de + dz + ds + dj

    def mnozi(x: np.ndarray) -> np.ndarray:
        x = rub(x.copy())
        return rub(
            zbroj * x
            - (
                de * np.roll(x, -1, 1)
                + dz * np.roll(x, 1, 1)
                + ds * np.roll(x, 1, 0)
                + dj * np.roll(x, -1, 0)
            )
        )

    b = rub(desna.copy())
    lam = np.zeros_like(b)
    ostatak = b - mnozi(lam)
    smjer = ostatak.copy()
    norma = float((ostatak * ostatak).sum())
    pocetna = norma
    if pocetna == 0.0:
        return lam
    for _ in range(4000):
        a = mnozi(smjer)
        korak_cg = norma / float((smjer * a).sum())
        lam += korak_cg * smjer
        ostatak -= korak_cg * a
        nova = float((ostatak * ostatak).sum())
        if nova < 1e-20 * pocetna:
            return lam
        smjer = ostatak + (nova / norma) * smjer
        norma = nova
    raise RuntimeError("polje vjetra nije konvergiralo")


def polje_vjetra(
    z: np.ndarray,
    smjer_od: float,
    brzina: float,
    dubina: float,
    obuhvat: Obuhvat = PRIKAZ,
) -> tuple[np.ndarray, np.ndarray]:
    """Traži polje kojemu je protok masa dosljedan: ∇·(d∇λ) = −∇·(d·u₀).

    Args:
        z: Visine terena u metrima.
        smjer_od: Meteorološki smjer iz kojega puše, u stupnjevima.
        brzina: Brzina na otvorenom, u m/s.
        dubina: Debljina miješanog sloja iznad najniže točke, u metrima.
        obuhvat: Obuhvat i korak rešetke; mora odgovarati obliku `z`.

    Returns:
        Par (u, v): brzina prema istoku i prema sjeveru, u m/s.
    """
    ny, nx, korak = obuhvat.ny, obuhvat.nx, obuhvat.dx
    kut = math.radians(270.0 - smjer_od)
    # v je brzina prema sjeveru u stvarnom prostoru, ne prema dolje po retku.
    u0 = np.full((ny, nx), brzina * math.cos(kut))
    v0 = np.full((ny, nx), brzina * math.sin(kut))

    d = np.clip(dubina - (z - z.min()), NAJTANJI_SLOJ, None)
    divergencija = np.zeros_like(d)
    divergencija[:, 1:-1] += ((d * u0)[:, 2:] - (d * u0)[:, :-2]) / (2 * korak)
    divergencija[1:-1, :] += ((d * v0)[:-2, :] - (d * v0)[2:, :]) / (2 * korak)

    lam = _rijesi(d, divergencija * korak * korak, korak)

    gx = np.zeros_like(lam)
    gy = np.zeros_like(lam)
    gx[:, 1:-1] = (lam[:, 2:] - lam[:, :-2]) / (2 * korak)
    gy[1:-1, :] = (lam[:-2, :] - lam[2:, :]) / (2 * korak)
    return u0 + gx, v0 + gy


def u_okvir(polje: np.ndarray) -> np.ndarray:
    """Uzorkuje računsku rešetku u rešetku okvira stranice."""
    tr = _pretvorba()
    lon = okvir.ZAPAD + (np.arange(GW) + 0.5) / GW * (okvir.ISTOK - okvir.ZAPAD)
    lat = okvir.SJEVER - (np.arange(GH) + 0.5) / GH * (okvir.SJEVER - okvir.JUG)
    lo, la = np.meshgrid(lon, lat)
    tocke = np.array(
        tr.TransformPoints(np.stack([lo.ravel(), la.ravel()], 1).tolist())
    )[:, :2]
    gj = np.clip(((tocke[:, 0] - X0) / DX).astype(int), 0, polje.shape[1] - 1)
    gi = np.clip(((Y1 - tocke[:, 1]) / DX).astype(int), 0, polje.shape[0] - 1)
    return polje[gi, gj].reshape(GH, GW)
