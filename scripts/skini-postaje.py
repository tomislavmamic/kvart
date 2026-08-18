#!/usr/bin/env python3
"""Skida satna mjerenja s obje postaje na Karepovcu i ispisuje pregled.

Pokretanje: `npm run skini-postaje`
"""

from __future__ import annotations

import logging
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import postaje  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def glavno() -> None:
    """Skida sve objavljene mjesece i ispisuje koliko je čega izmjereno."""
    for postaja in postaje.POSTAJE:
        tvari, zapisi = postaje.niz(postaja.oznaka)
        if not zapisi:
            logger.warning("%s: ništa nije skinuto", postaja.naziv)
            continue
        logger.info(
            "\n%s (%s) — %d sati, %s do %s",
            postaja.naziv,
            postaja.opis,
            len(zapisi),
            zapisi[0]["t"],
            zapisi[-1]["t"],
        )
        for tvar in tvari:
            vrijednosti = [z[tvar] for z in zapisi if z.get(tvar) is not None]
            if not vrijednosti:
                continue
            logger.info(
                "  %-24s %5d sati  medijan %8.3f  99. perc. %8.3f  najviše %8.3f",
                tvar,
                len(vrijednosti),
                statistics.median(vrijednosti),
                sorted(vrijednosti)[int(0.99 * (len(vrijednosti) - 1))],
                max(vrijednosti),
            )
    put = postaje.spremi()
    logger.info("\nspremljeno %s", put.relative_to(postaje.KORIJEN))


if __name__ == "__main__":
    glavno()
