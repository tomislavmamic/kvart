#!/usr/bin/env python3
"""Izvozi satni vjetar u modul koji stranica čita bez odlaska na mrežu.

Ruži dojava treba, za svaku dojavu, vjetar u satu u kojem je miris osjetio.
Taj se vjetar ne smije dohvaćati pri svakom prikazu — stranica bi ovisila o
tuđem poslužitelju, a niz bi se mijenjao pod nogama.

Izvor je spoj izmjerenih postaja, redom Split-3 (4,3 km), Split-Marjan (6 km)
i zračna luka (16 km). Redoslijed nije proizvoljan nego izmjeren: `provjeri-
vjetar.py` ocjenjuje svaki izvor prema tome koliko dobro objašnjava izmjereni
H₂S uz plohu, i zračna luka ispada zadnja jer noću ne razlučuje ništa.

Zapis je gust namjerno: smjer u koracima od 5° i brzina u koracima od 0,5 m/s,
po jedan bajt, oboje kao base64. Godina dana tako stane u dvadesetak kilobajta.
Sat bez podatka nosi 255.

Pokretanje: `npm run izvedi-vjetar`
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vjetar  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-vjetar.ts"

#: Koliko dana unatrag ide niz. Dojave se javljaju i naknadno, ali ne godinama.
DANA = 400

#: Oznaka za sat bez podatka.
NEMA = 255
KORAK_SMJERA = 5.0
KORAK_BRZINE = 0.5


def glavno() -> None:
    """Skida vjetar za zadnjih `DANA` dana i piše generirani modul."""
    danas = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    od = (danas - timedelta(days=DANA)).strftime("%Y-%m-%d")
    do = danas.strftime("%Y-%m-%d")
    izmjeren = vjetar.ucitaj("spoj", od, do)

    prvi = datetime.strptime(od, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    sati = DANA * 24
    smjerovi = bytearray(sati)
    brzine = bytearray(sati)
    imamo = 0
    for i in range(sati):
        kljuc = (prvi + timedelta(hours=i)).strftime("%Y-%m-%dT%H:00Z")
        podatak = izmjeren.get(kljuc)
        if podatak is None:
            smjerovi[i] = NEMA
            brzine[i] = NEMA
            continue
        smjer, brzina = podatak
        smjerovi[i] = int(round(smjer / KORAK_SMJERA)) % int(360 / KORAK_SMJERA)
        brzine[i] = min(int(round(brzina / KORAK_BRZINE)), NEMA - 1)
        imamo += 1

    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(
        "// Generirano iz METAR-a splitske zračne luke (LDSP).\n"
        "// Pokretanje: npm run izvedi-vjetar — ne uređivati ručno.\n"
        "\n"
        "export const VJETAR = "
        + json.dumps(
            {
                "izvor": "LDSP",
                "prviSat": prvi.strftime("%Y-%m-%dT%H:00Z"),
                "sati": sati,
                "imamo": imamo,
                "korakSmjera": KORAK_SMJERA,
                "korakBrzine": KORAK_BRZINE,
                "nema": NEMA,
                "smjer": base64.b64encode(bytes(smjerovi)).decode(),
                "brzina": base64.b64encode(bytes(brzine)).decode(),
            },
            ensure_ascii=False,
        )
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s: %d od %d sati ima vjetar (%.0f kB)",
        IZLAZ.relative_to(KORIJEN), imamo, sati, IZLAZ.stat().st_size / 1024,
    )


if __name__ == "__main__":
    glavno()
