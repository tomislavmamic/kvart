#!/usr/bin/env python3
"""Slika godišnjeg računa raspršenja, za gledanje prije nego što išta ode na stranicu.

Račun u `izvedi-raspesenje.py` do sada je izlazio samo kao brojke u ispisu.
Brojka „medijan 479 sati godišnje” ne kaže gdje su ti sati, a upravo se to mora
vidjeti prije odluke ide li išta od ovoga pred ljude.

Sprema PNG s četiri polja jedno do drugoga, s obrisom plohe i kvarta preko
njih, u `.cache/`. Nije za stranicu — za gledanje.

Pokretanje: `npm run pogledaj-raspesenje`
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reljef_polje import RASPRSENJE, _pretvorba  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
ULAZ = KORIJEN / ".cache" / "raspesenje.npz"
IZLAZ = KORIJEN / ".cache" / "raspesenje.png"

#: Koliko se puta polje poveća; rešetka je 25 m, pa je ovo oko 6 m po pikselu.
POVECANJE = 4
RAZMAK = 16

#: Ljestvica boja: od podloge kroz žutu i narančastu do tamnocrvene. Ista
#: obitelj kao perjanica na stranici, da se prizori mogu usporediti.
LJESTVICA = (
    (0.00, (252, 251, 249)),
    (0.15, (253, 237, 199)),
    (0.35, (247, 200, 115)),
    (0.60, (226, 138, 60)),
    (0.82, (176, 74, 40)),
    (1.00, (94, 27, 22)),
)


def _boje() -> np.ndarray:
    """Razvija ljestvicu u tablicu od 256 boja."""
    tablica = np.zeros((256, 3), np.uint8)
    for i in range(256):
        u = i / 255
        for (a, boja_a), (b, boja_b) in zip(LJESTVICA, LJESTVICA[1:]):
            if a <= u <= b:
                t = (u - a) / (b - a)
                tablica[i] = [
                    round(boja_a[k] + (boja_b[k] - boja_a[k]) * t) for k in range(3)
                ]
                break
        else:
            tablica[i] = LJESTVICA[-1][1]
    return tablica


def _obris(ime: str) -> list[list[tuple[float, float]]]:
    """Učitava sloj i vraća prstenove u koordinatama rešetke računa."""
    put = KORIJEN / "public" / "geo" / f"{ime}.geojson"
    if not put.exists():
        return []
    tr = _pretvorba()
    prstenovi = []
    for znacajka in json.loads(put.read_text(encoding="utf8"))["features"]:
        geom = znacajka["geometry"]
        komadi = (
            geom["coordinates"]
            if geom["type"] == "Polygon"
            else [d for m in geom["coordinates"] for d in m]
        )
        for prsten in komadi:
            tocke = tr.TransformPoints([[x, y] for x, y, *_ in prsten])
            prstenovi.append(
                [
                    (
                        (x - RASPRSENJE.x0) / RASPRSENJE.dx,
                        (RASPRSENJE.y1 - y) / RASPRSENJE.dx,
                    )
                    for x, y, *_ in tocke
                ]
            )
    return prstenovi


def _ploca(polje: np.ndarray, vrh: float, tablica: np.ndarray) -> Image.Image:
    """Pretvara jedno polje u sliku, s korijenskom ljestvicom."""
    # Korijen, ne pravocrtno: raspon je nekoliko redova veličine, pa bi
    # pravocrtna ljestvica sve osim same plohe ostavila praznim.
    u = np.clip(np.sqrt(np.clip(polje, 0, None) / max(vrh, 1e-12)), 0, 1)
    slika = Image.fromarray(tablica[(u * 255).astype(np.uint8)], "RGB")
    return slika.resize(
        (slika.width * POVECANJE, slika.height * POVECANJE), Image.NEAREST
    )


def glavno() -> None:
    """Slaže sliku sa četiri polja i sprema je.

    Raises:
        SystemExit: Ako godišnji račun nije izveden.
    """
    if not ULAZ.exists():
        sys.exit("Prvo pokreni `npm run izvedi-raspesenje`.")
    p = np.load(ULAZ)
    na_godinu = float(p["na_godinu"][0])
    maska = p["maska"].astype(bool)

    ploce = [
        ("prosjecni doprinos H2S-a, ug/m3", p["prosjek"], np.quantile(p["prosjek"], 0.9995)),
        ("najvisi satni doprinos, ug/m3", p["najvise"], np.quantile(p["najvise"], 0.9995)),
        ("sati godisnje u perjanici", p["prelasci"] * na_godinu, 8760.0),
        ("sati godisnje iznad 0,7 ug/m3", p["iznad_0.7"] * na_godinu, 400.0),
    ]

    tablica = _boje()
    sirina = RASPRSENJE.nx * POVECANJE
    visina = RASPRSENJE.ny * POVECANJE
    platno = Image.new(
        "RGB",
        (sirina * 2 + RAZMAK * 3, (visina + 26) * 2 + RAZMAK),
        (255, 255, 255),
    )
    crtac = ImageDraw.Draw(platno)
    granice = _obris("granica")
    ploha = _obris("karepovac")

    for i, (naslov, polje, vrh) in enumerate(ploce):
        slika = _ploca(polje, float(vrh), tablica)
        crt = ImageDraw.Draw(slika)
        for prstenovi, boja in ((granice, (0, 121, 86)), (ploha, (24, 24, 27))):
            for prsten in prstenovi:
                crt.line(
                    [(x * POVECANJE, y * POVECANJE) for x, y in prsten],
                    fill=boja,
                    width=2,
                )
        x = RAZMAK + (i % 2) * (sirina + RAZMAK)
        y = RAZMAK + (i // 2) * (visina + 26)
        platno.paste(slika, (x, y))
        crtac.text(
            (x, y + visina + 5),
            f"{naslov}   (najtamnije = {vrh:.3g})",
            fill=(24, 24, 27),
        )

    platno.save(IZLAZ)
    logger.info("spremljeno %s (%d×%d)", IZLAZ.relative_to(KORIJEN), *platno.size)
    logger.info(
        "izvan plohe: prosjek najviše %.3f µg/m³, satni vrh %.2f µg/m³",
        float(p["prosjek"][~maska].max()), float(p["najvise"][~maska].max()),
    )


if __name__ == "__main__":
    glavno()
