#!/usr/bin/env python3
"""Sažima službena mjerenja s Karepovca u modul koji stranica može prikazati.

Stranica dosad govori da mjerenja nemamo. To je točno za naše uređaje, ali
netočno kao slika stanja: na Karepovcu već stoje dvije službene postaje i
objavljuju satne tablice. Ovdje se te tablice sažimaju u ono što se može
pošteno pokazati — koliko je sati izmjereno, kolike su vrijednosti, i kako
izgleda dnevni hod.

Dnevni hod je ovdje najvažniji. H₂S je najviši noću, kad zrak stoji; merkaptani
su najviši sredinom dana, kad se na plohi radi. Dvije tvari s istog odlagališta
ponašaju se suprotno, i to se vidi samo ako se objavi.

Pokretanje: `npm run izvedi-mjerenja`
"""

from __future__ import annotations

import json
import logging
import os
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import postaje  # noqa: E402
import vjetar  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-mjerenja.ts"
RASPRSENJE = KORIJEN / ".cache" / "raspesenje.npz"

ZAGREB = ZoneInfo("Europe/Zagreb")

#: Tvar po kojoj se na svakoj postaji crta dnevni hod i ruža.
GLAVNA = {"k1": "H2S", "k2": "metil+etilmerkaptan"}

#: Iz kojeg se izvora uzima vjetar za ružu; provjeren u `provjeri-vjetar.py`.
IZVOR_VJETRA = "ldsp"
OD, DO = "2024-09-01", "2026-08-17"

SEKTORA = 16


def _lokalni_sat(t: str) -> int:
    """Vraća sat dana u Zagrebu za oznaku vremena u UTC-u."""
    return (
        datetime.strptime(t, "%Y-%m-%dT%H:00Z")
        .replace(tzinfo=timezone.utc)
        .astimezone(ZAGREB)
        .hour
    )


def _sazetak(vrijednosti: list[float]) -> dict:
    """Sažima niz satnih vrijednosti u nekoliko brojeva."""
    poredano = sorted(vrijednosti)
    return {
        "sati": len(poredano),
        "medijan": round(statistics.median(poredano), 3),
        "p98": round(poredano[int(0.98 * (len(poredano) - 1))], 3),
        "najvise": round(poredano[-1], 3),
    }


def _dnevni_hod(niz: dict[str, float]) -> list[float]:
    """Vraća srednju vrijednost po satu dana, po lokalnom vremenu."""
    kante: list[list[float]] = [[] for _ in range(24)]
    for t, x in niz.items():
        kante[_lokalni_sat(t)].append(x)
    return [round(statistics.fmean(k), 3) if k else 0.0 for k in kante]


def _ruza(niz: dict[str, float], vjetrovi: dict) -> dict:
    """Vraća srednju vrijednost i broj sati po sektoru smjera vjetra."""
    kante: list[list[float]] = [[] for _ in range(SEKTORA)]
    for t, x in niz.items():
        podatak = vjetrovi.get(t)
        if podatak is None:
            continue
        kante[int(((podatak[0] + 360 / SEKTORA / 2) % 360) / (360 / SEKTORA))].append(x)
    return {
        "srednje": [round(statistics.fmean(k), 3) if k else 0.0 for k in kante],
        "sati": [len(k) for k in kante],
    }


def _godisnja_slika() -> dict | None:
    """Čita sažetak godišnjeg računa raspršenja, ako postoji."""
    if not RASPRSENJE.exists():
        logger.warning("nema %s — pokreni `npm run izvedi-raspesenje`", RASPRSENJE.name)
        return None
    p = np.load(RASPRSENJE)
    maska = p["maska"].astype(bool)
    na_godinu = float(p["na_godinu"][0])
    izvan = ~maska
    razine = sorted(
        float(k.split("_")[1]) for k in p.files if k.startswith("iznad_")
    )
    return {
        "godina": 2025,
        "sati": int(p["sati"][0]),
        "najviseSatno": round(float(p["najvise"][izvan].max()), 2),
        "iznad": [
            {
                "razina": razina,
                "najviseSati": int(p[f"iznad_{razina}"][izvan].max() * na_godinu),
            }
            for razina in razine
        ],
        "uPerjaniciMedijan": int(np.median(p["prelasci"][izvan]) * na_godinu),
        "uPerjaniciNajvise": int(p["prelasci"][izvan].max() * na_godinu),
    }


def glavno() -> None:
    """Slaže sažetak obiju postaja i piše generirani modul."""
    vjetrovi = vjetar.ucitaj(IZVOR_VJETRA, OD, DO)
    sadrzaj = {"izvorVjetra": IZVOR_VJETRA, "postaje": []}

    for postaja in postaje.POSTAJE:
        tvari, zapisi = postaje.niz(postaja.oznaka)
        nizovi = {
            tvar: {
                str(z["t"]): float(z[tvar]) for z in zapisi if z.get(tvar) is not None
            }
            for tvar in tvari
        }
        glavna = GLAVNA[postaja.oznaka]
        sadrzaj["postaje"].append(
            {
                "oznaka": postaja.oznaka,
                "naziv": postaja.naziv,
                "opis": postaja.opis,
                "lat": postaja.lat,
                "lon": postaja.lon,
                "od": str(zapisi[0]["t"]),
                "do": str(zapisi[-1]["t"]),
                "glavna": glavna,
                "tvari": [
                    {"naziv": tvar, **_sazetak(list(nizovi[tvar].values()))}
                    for tvar in tvari
                    if nizovi[tvar]
                ],
                "dnevniHod": _dnevni_hod(nizovi[glavna]),
                "ruza": _ruza(nizovi[glavna], vjetrovi),
            }
        )
        logger.info(
            "%s: %d tvari, %d sati glavne (%s)",
            postaja.naziv, len(tvari), len(nizovi[glavna]), glavna,
        )

    slika = _godisnja_slika()
    if slika:
        sadrzaj["godisnjaSlika"] = slika

    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(
        "// Generirano iz satnih tablica postaja Karepovac 1 i Karepovac 2.\n"
        "// Pokretanje: npm run izvedi-mjerenja — ne uređivati ručno.\n"
        "\n"
        "export const MJERENJA = "
        + json.dumps(sadrzaj, ensure_ascii=False, indent=2)
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s (%.0f kB)", IZLAZ.relative_to(KORIJEN), IZLAZ.stat().st_size / 1024
    )


if __name__ == "__main__":
    glavno()
