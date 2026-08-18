#!/usr/bin/env python3
"""Izvodi polje vjetra nad kvartom, za prikaz širenja mirisa u pregledniku.

Prikaz na `/karepovac` i `/karepovac/zrak` ne crta unaprijed nacrtanu perjanicu
nego je računa: čestice nosi polje vjetra, a polje dolazi odavde.

Polje nije podatak nego izvod. Iz DGU-ova LiDAR reljefa računa se debljina sloja
zraka nad terenom, pa se traži polje kojemu je protok masa dosljedan —
∇·(d·u) = 0. Time vjetar obilazi padinu umjesto da ide kroz nju, što je jedina
razlika koja se na ovoj udaljenosti uopće vidi.

Sprema se slučaj o kojem ljudi javljaju: slab vjetar iz 112,5° (istok-jugoistok)
pod plitkim graničnim slojem. Tada perjanica ne odlazi u vis nego se drži tla i
penje uz padinu na Dračevac. Model ne simulira inverziju kao poklopac koji
zadržava — plitak sloj ovdje samo stanjuje protok nad uzvisinom.

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

# Slučaj koji se sprema: istočnojugoistočni vjetar, slab, plitak sloj —
# vrijeme na koje se ljudi i žale.
SMJER_OD = 112.5
BRZINA = 1.2
DUBINA = 80.0


def _bajtovi(polje: np.ndarray, skala: float) -> str:
    """Pakira polje u bajtove oko sredine raspona, kao base64."""
    q = np.clip(polje / skala * 0.5 + 0.5, 0, 1)
    return base64.b64encode((q * 255).astype(np.uint8).tobytes()).decode()


def glavno() -> None:
    """Izvodi polje i piše generirani modul."""
    z = gladi(ucitaj_reljef(), 3)
    maska = maska_plohe()
    logger.info(
        "reljef %d×%d, %.0f–%.0f m; ploha %d ćelija",
        NY, NX, z.min(), z.max(), int(maska.sum()),
    )

    u, v = polje_vjetra(z, SMJER_OD, BRZINA, DUBINA)

    # U okviru stranice y raste prema dolje, a v je brzina prema sjeveru.
    vx = u_okvir(u)
    vy = -u_okvir(v)
    mk = (u_okvir(maska.astype(float)) > 0.4).astype(np.uint8)

    skala = float(max(np.abs(vx).max(), np.abs(vy).max())) * 1.02
    azimut = float(np.degrees(np.arctan2(vx, -vy)).mean() % 360)
    logger.info(
        "polje %d×%d, brzine %.2f–%.2f m/s, prosječni azimut %.0f° (otvoreno %.0f°)",
        GW, GH, np.hypot(vx, vy).min(), np.hypot(vx, vy).max(),
        azimut, (SMJER_OD + 180) % 360,
    )

    podatci = {
        "gw": GW,
        "gh": GH,
        "skala": round(skala, 4),
        "smjerOd": SMJER_OD,
        "brzina": BRZINA,
        "dubina": DUBINA,
        "azimut": round(azimut),
        "vx": _bajtovi(vx, skala),
        "vy": _bajtovi(vy, skala),
        "maska": base64.b64encode((mk * 255).tobytes()).decode(),
    }

    IZLAZ.write_text(
        "// Generirano iz DGU-ova LiDAR reljefa i obrisa plohe.\n"
        "// Pokretanje: npm run izvedi-polje-dima — ne uređivati ručno.\n"
        "\n"
        "export const POLJE_DIMA = "
        + json.dumps(podatci, ensure_ascii=False)
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s (%.0f kB)",
        IZLAZ.relative_to(KORIJEN), IZLAZ.stat().st_size / 1024,
    )


if __name__ == "__main__":
    glavno()
