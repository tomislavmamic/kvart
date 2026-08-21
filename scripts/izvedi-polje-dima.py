#!/usr/bin/env python3
"""Izvodi osnovna polja vjetra nad kvartom, za prikaz širenja u pregledniku.

Prikaz na `/karepovac` i `/karepovac/zrak` ne crta unaprijed nacrtanu perjanicu
nego je računa: čestice nosi polje vjetra, a polje dolazi odavde.

Polje nije podatak nego izvod. Iz DGU-ova LiDAR reljefa računa se debljina sloja
zraka nad terenom, pa se traži polje kojemu je protok masa dosljedan —
∇·(d·u) = 0. Time vjetar obilazi padinu umjesto da ide kroz nju, što je jedina
razlika koja se na ovoj udaljenosti uopće vidi.

Ne sprema se jedan slučaj vremena nego **osnova**, jer je taj račun linearan po
vjetru na otvorenom: ∇·(d∇λ) = −∇·(d·u₀) ima desnu stranu linearnu po u₀, a
rješenje se dobiva linearnim postupkom, pa vrijedi

    u(smjer, brzina) = brzina · [cos(270°−smjer)·u_istok + sin(270°−smjer)·u_sjever]

gdje su u_istok i u_sjever rješenja za jedinični vjetar prema istoku i prema
sjeveru. Provjereno na stvarnom reljefu: razlika prema izravnom rješenju je
reda 10⁻¹⁵ m/s. Zato smjer i brzina više ne moraju biti zapečeni — stranica ih
uzima iz trenutačnog vremena i polje slaže u izvođenju
(`src/lib/polje-dima.ts`).

Dubina miješanog sloja **nije** linearna jer ulazi kao koeficijent d, pa se za
nju sprema nekoliko razina i među njima se interpolira. Razlike su najveće oko
100 m: tada vjetar najviše skreće oko padine. Pri vrlo plitkom sloju d udari u
donju granicu pa je polje gotovo jednoliko, a pri vrlo dubokom teren više ne
stigne skrenuti struju.

Komponente `vx` i `vy` spremaju se odvojeno. Kut se ne smije spremati pa
interpolirati — prosjek 350° i 10° je 180°, dakle točno suprotan smjer.

Pokretanje: `npm run izvedi-polje-dima`
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reljef_polje import (  # noqa: E402
    GH,
    GW,
    NAJTANJI_SLOJ,
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

# Razine dubine miješanog sloja za koje se sprema osnova, u metrima. Razmak je
# logaritamski jer se i sam učinak tako mijenja: između 25 i 120 m polje se
# vidno prelomi, a između 300 i 800 m gotovo ništa. Vrijednosti pokrivaju noćnu
# inverziju (nekoliko desetaka metara) i razvijeni dnevni sloj (do ~1 km).
DUBINE = (25.0, 55.0, 120.0, 260.0, 600.0)

# Osnova su jedinični vjetrovi prema istoku i prema sjeveru; u meteorološkom
# zapisu to su vjetrovi *iz* zapada i *iz* juga.
OSNOVA_ISTOK = 270.0
OSNOVA_SJEVER = 180.0

#: Iznad ovog udjela zagušenih ćelija razina više ne nosi reljef nego jednolik
#: vjetar. Ne prekida se — plitke razine su takve po prirodi zadatka — nego se
#: ispisuje, da se ne dogodi opet da polje tiho ostane bez brda.
ZAGUSENJE_ZA_UPOZORENJE = 0.95


def _bajtovi(polje: np.ndarray, skala: float) -> str:
    """Pakira polje u bajtove oko sredine raspona, kao base64."""
    q = np.clip(polje / skala * 0.5 + 0.5, 0, 1)
    return base64.b64encode((q * 255).astype(np.uint8).tobytes()).decode()


def glavno() -> None:
    """Izvodi osnovna polja i piše generirani modul."""
    z = gladi(ucitaj_reljef(), 3)
    maska = maska_plohe()
    logger.info(
        "reljef %d×%d, %.0f–%.0f m; ploha %d ćelija",
        NY, NX, z.min(), z.max(), int(maska.sum()),
    )

    # Prvo se izvedu sva polja, pa tek onda pakiraju: ljestvica mora biti
    # zajednička svima, inače se dvije dubine ne mogu miješati bajt po bajt.
    rel = z - z.min()
    logger.info(
        "raspon reljefa %.0f m; granica debljine sloja %.0f m",
        float(rel.max()), NAJTANJI_SLOJ,
    )

    razine = []
    for dubina in DUBINE:
        ui, vi = polje_vjetra(z, OSNOVA_ISTOK, 1.0, dubina)
        us, vs = polje_vjetra(z, OSNOVA_SJEVER, 1.0, dubina)
        # U okviru stranice y raste prema dolje, a v je brzina prema sjeveru.
        razine.append(
            {
                "dubina": dubina,
                "polja": (u_okvir(ui), -u_okvir(vi), u_okvir(us), -u_okvir(vs)),
            }
        )
        # Osnovni vjetar puše točno prema istoku, pa je kut skretanja polja
        # od njega samo arctan(v/u).
        skretanje = np.degrees(np.abs(np.arctan2(vi, ui)))
        zagusenje = float((dubina - rel <= NAJTANJI_SLOJ).mean())
        logger.info(
            "dubina %5.0f m: brzine %.2f–%.2f, skretanje medijan %.1f° "
            "najveće %.1f°, zagušeno %.0f %%%s",
            dubina,
            np.hypot(ui, vi).min(),
            np.hypot(ui, vi).max(),
            float(np.median(skretanje)),
            float(skretanje.max()),
            100 * zagusenje,
            "  ← razina nosi gotovo jednolik vjetar"
            if zagusenje > ZAGUSENJE_ZA_UPOZORENJE
            else "",
        )

    skala = 1.02 * max(
        float(np.abs(polje).max()) for r in razine for polje in r["polja"]
    )

    podatci = {
        "gw": GW,
        "gh": GH,
        "skala": round(skala, 4),
        "dubine": [round(r["dubina"]) for r in razine],
        "osnove": [
            {
                "istokVx": _bajtovi(r["polja"][0], skala),
                "istokVy": _bajtovi(r["polja"][1], skala),
                "sjeverVx": _bajtovi(r["polja"][2], skala),
                "sjeverVy": _bajtovi(r["polja"][3], skala),
            }
            for r in razine
        ],
        "maska": base64.b64encode(
            ((u_okvir(maska.astype(float)) > 0.4).astype(np.uint8) * 255).tobytes()
        ).decode(),
    }

    IZLAZ.write_text(
        "// Generirano iz DGU-ova LiDAR reljefa i obrisa plohe.\n"
        "// Osnovna polja za jedinični vjetar; smjer, brzinu i dubinu sloja\n"
        "// stranica slaže u izvođenju — vidi src/lib/polje-dima.ts.\n"
        "// Pokretanje: npm run izvedi-polje-dima — ne uređivati ručno.\n"
        "\n"
        "export const OSNOVE_DIMA = "
        + json.dumps(podatci, ensure_ascii=False)
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s (%.0f kB, %d razina, ljestvica %.2f m/s)",
        IZLAZ.relative_to(KORIJEN), IZLAZ.stat().st_size / 1024, len(razine), skala,
    )


if __name__ == "__main__":
    glavno()
