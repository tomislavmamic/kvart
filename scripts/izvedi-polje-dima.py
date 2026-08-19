#!/usr/bin/env python3
"""Izvodi polje vjetra nad kvartom, za prikaz širenja mirisa u pregledniku.

Prikaz na `/karepovac` i `/karepovac/zrak` ne crta unaprijed nacrtanu perjanicu
nego je računa: čestice nosi polje vjetra, a polje dolazi odavde.

Polje nije podatak nego izvod. Iz DGU-ova LiDAR reljefa računa se debljina sloja
zraka nad terenom, pa se traži polje kojemu je protok masa dosljedan —
∇·(d·u) = 0. Time vjetar obilazi padinu umjesto da ide kroz nju, što je jedina
razlika koja se na ovoj udaljenosti uopće vidi.

Spremaju se dva slučaja vremena, jer jedan nije dovoljan da se vidi razlika.

Prvi je onaj o kojem ljudi javljaju: slab vjetar iz 112,5° (istok-jugoistok) pod
plitkim graničnim slojem. Tada perjanica ne odlazi u vis nego se drži tla i penje
uz padinu na Dračevac. Model ne simulira inverziju kao poklopac koji zadržava —
plitak sloj ovdje samo stanjuje protok nad uzvisinom.

Drugi je sjeveroistočnjak, jači i pod dubljim slojem. Odlagalište leži istočno-
jugoistočno od sredine kvarta, pa taj vjetar nosi zrak s plohe na jugozapad,
mimo kuća. Da se vide oba, mora se moći prebaciti s jednoga na drugi.

Udio sati uz svaki slučaj računa se iz izmjerenog vjetra sa splitske zračne
luke, jedinog javnog mjerenja vjetra u blizini. Postaja je 17 km zapadno, iza
Kozjaka, pa je i taj udio procjena — ali procjena iz mjerenja, ne iz modela.

Komponente `vx` i `vy` spremaju se odvojeno. Kut se ne smije spremati pa
interpolirati — prosjek 350° i 10° je 180°, dakle točno suprotan smjer.

Pokretanje: `npm run izvedi-polje-dima`
"""

from __future__ import annotations

import base64
import json
import logging
import math
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vjetar  # noqa: E402
from reljef_polje import (  # noqa: E402
    GH,
    GW,
    NX,
    NY,
    gladi,
    maska_plohe,
    polje_vjetra,
    u_okvir,
    ucitaj_reljef,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-polje.ts"

#: Slučajevi vremena koji se spremaju. Brzine i dubine odgovaraju onome što
#: se u tim smjerovima doista mjeri, osim kod prvoga: on je namjerno tih i
#: plitak, jer se ljudi žale upravo na takve sate, a ne na prosječne.
SLUCAJEVI = (
    {
        "kljuc": "na-kvart",
        "naziv": "Slab istok-jugoistok",
        "opis": "Zrak s plohe penje se uz padinu na Dračevac i Bilice.",
        "smjerOd": 112.5,
        "brzina": 1.2,
        "dubina": 80.0,
    },
    {
        "kljuc": "mimo-kvarta",
        "naziv": "Sjeveroistočnjak",
        "opis": "Zrak s plohe odlazi na jugozapad, mimo kuća.",
        "smjerOd": 45.0,
        "brzina": 3.6,
        "dubina": 400.0,
    },
)

#: Koliko široko oko smjera slučaja se broje sati kad se računa udio.
SIRINA_SEKTORA = 22.5

OD, DO = "2024-09-01", "2026-08-17"


def _bajtovi(polje: np.ndarray, skala: float) -> str:
    """Pakira polje u bajtove oko sredine raspona, kao base64."""
    q = np.clip(polje / skala * 0.5 + 0.5, 0, 1)
    return base64.b64encode((q * 255).astype(np.uint8).tobytes()).decode()


def _udio_sati(smjer_od: float) -> float:
    """Udio sati u kojima vjetar puše unutar sektora oko zadanog smjera.

    Args:
        smjer_od: Sredina sektora, u stupnjevima.

    Returns:
        Udio između 0 i 1, iz izmjerenog vjetra sa zračne luke.
    """
    izmjeren = vjetar.ucitaj("ldsp", OD, DO)
    if not izmjeren:
        return float("nan")
    unutra = sum(
        1
        for smjer, _ in izmjeren.values()
        if abs((smjer - smjer_od + 180) % 360 - 180) <= SIRINA_SEKTORA
    )
    return unutra / len(izmjeren)


def glavno() -> None:
    """Izvodi polja za sve slučajeve i piše generirani modul."""
    z = gladi(ucitaj_reljef(), 3)
    maska = maska_plohe()
    logger.info(
        "reljef %d×%d, %.0f–%.0f m; ploha %d ćelija",
        NY, NX, z.min(), z.max(), int(maska.sum()),
    )
    mk = (u_okvir(maska.astype(float)) > 0.4).astype(np.uint8)

    izvedeni = []
    for slucaj in SLUCAJEVI:
        u, v = polje_vjetra(z, slucaj["smjerOd"], slucaj["brzina"], slucaj["dubina"])
        # U okviru stranice y raste prema dolje, a v je brzina prema sjeveru.
        vx = u_okvir(u)
        vy = -u_okvir(v)
        skala = float(max(np.abs(vx).max(), np.abs(vy).max())) * 1.02
        azimut = float(np.degrees(np.arctan2(vx, -vy)).mean() % 360)
        udio = _udio_sati(slucaj["smjerOd"])
        logger.info(
            "%s: brzine %.2f–%.2f m/s, azimut %.0f° (otvoreno %.0f°), %.1f %% sati",
            slucaj["kljuc"], np.hypot(vx, vy).min(), np.hypot(vx, vy).max(),
            azimut, (slucaj["smjerOd"] + 180) % 360, 100 * udio,
        )
        izvedeni.append(
            {
                **slucaj,
                "azimut": round(azimut),
                "udioSati": round(udio, 4),
                "skala": round(skala, 4),
                "vx": _bajtovi(vx, skala),
                "vy": _bajtovi(vy, skala),
            }
        )

    zajednicko = {
        "gw": GW,
        "gh": GH,
        "maska": base64.b64encode((mk * 255).tobytes()).decode(),
    }
    IZLAZ.write_text(
        "// Generirano iz DGU-ova LiDAR reljefa i obrisa plohe.\n"
        "// Pokretanje: npm run izvedi-polje-dima — ne uređivati ručno.\n"
        "\n"
        "export const SLUCAJEVI_DIMA = "
        + json.dumps({**zajednicko, "slucajevi": izvedeni}, ensure_ascii=False)
        + " as const;\n"
        "\n"
        "/** Prvi slučaj, za mjesta koja prikazuju samo jedno vrijeme. */\n"
        "export const POLJE_DIMA = {\n"
        "  gw: SLUCAJEVI_DIMA.gw,\n"
        "  gh: SLUCAJEVI_DIMA.gh,\n"
        "  maska: SLUCAJEVI_DIMA.maska,\n"
        "  ...SLUCAJEVI_DIMA.slucajevi[0],\n"
        "} as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s (%.0f kB)",
        IZLAZ.relative_to(KORIJEN), IZLAZ.stat().st_size / 1024,
    )


if __name__ == "__main__":
    glavno()
