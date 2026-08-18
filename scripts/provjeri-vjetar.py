#!/usr/bin/env python3
"""Koji izvor vjetra opisuje ono što postaja stvarno namiriše?

Model raspršenja stoji ili pada na vjetru. Dosad smo uzimali ERA5 s ćelijom od
25 km i nadali se najboljem. Sad postoje dvije godine satnog H₂S-a s postaje na
samom rubu plohe, pa se izvor vjetra više ne mora birati po osjećaju.

Postupak je jednostavan i ne treba mu model raspršenja:

1. Sati se razvrstaju po smjeru iz kojega puše, u 16 sektora.
2. Za svaki sektor računa se srednji H₂S na postaji.
3. Ako izvor vjetra valja, ruža će imati oštar vrh u smjeru odlagališta.

Mjere:

- **omjer** — srednji H₂S u tri najjača sektora naspram tri suprotna. Koliko
  se puta jače osjeti kad vjetar puše s plohe nego kad puše na nju.
- **AUC** — vjerojatnost da nasumično odabrani sat s vjetrom „s plohe” ima viši
  H₂S od nasumičnog sata s vjetrom „na plohu”. 0,5 znači nikakvu vezu.
- **vrh** — sektor u kojemu je H₂S najviši. Ako se poklapa sa smjerom plohe
  gledano s postaje, geometrija i vjetar se slažu.

Pokretanje: `npm run provjeri-vjetar`
"""

from __future__ import annotations

import logging
import math
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import postaje  # noqa: E402
import vjetar  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

OD, DO = "2024-09-01", "2026-08-17"

#: Tvar koja nosi provjeru na svakoj postaji.
TVAR = {"k1": "H2S", "k2": "metil+etilmerkaptan"}

SEKTORA = 16
KORAK = 360.0 / SEKTORA
IMENA = (
    "S", "SSI", "SI", "ISI", "I", "IJI", "JI", "JJI",
    "J", "JJZ", "JZ", "ZJZ", "Z", "SZ-Z", "SZ", "SSZ",
)


def _auc(jaki: list[float], slabi: list[float]) -> float:
    """Vjerojatnost da nasumičan član prvog niza nadmaši člana drugog.

    Args:
        jaki: Vrijednosti u satima s vjetrom s plohe.
        slabi: Vrijednosti u satima s vjetrom na plohu.

    Returns:
        Broj između 0 i 1; 0,5 znači da nema razlike.
    """
    if not jaki or not slabi:
        return float("nan")
    svi = sorted(jaki + slabi)
    rang = {}
    i = 0
    while i < len(svi):
        j = i
        while j + 1 < len(svi) and svi[j + 1] == svi[i]:
            j += 1
        for k in range(i, j + 1):
            rang[svi[k]] = (i + j) / 2 + 1
        i = j + 1
    zbroj = sum(rang[x] for x in jaki)
    return (zbroj - len(jaki) * (len(jaki) + 1) / 2) / (len(jaki) * len(slabi))


def ruza(
    vrijednosti: dict[str, float], vjetrovi: dict[str, tuple[float, float]]
) -> list[tuple[int, float]]:
    """Slaže srednju vrijednost po sektoru smjera vjetra.

    Returns:
        Popis (broj sati, srednja vrijednost) po sektoru, počevši od sjevera.
    """
    kante: list[list[float]] = [[] for _ in range(SEKTORA)]
    for t, mjerenje in vrijednosti.items():
        podatak = vjetrovi.get(t)
        if podatak is None:
            continue
        sektor = int(((podatak[0] + KORAK / 2) % 360) / KORAK)
        kante[sektor].append(mjerenje)
    return [(len(k), statistics.fmean(k) if k else float("nan")) for k in kante]


def ocijeni(
    oznaka: str, vrijednosti: dict[str, float], vjetrovi: dict[str, tuple[float, float]]
) -> dict[str, float]:
    """Ocjenjuje koliko dobro jedan izvor vjetra objašnjava mjerenja."""
    kante = ruza(vrijednosti, vjetrovi)
    vrh = max(range(SEKTORA), key=lambda s: -1 if math.isnan(kante[s][1]) else kante[s][1])

    s_plohe = [(vrh + d) % SEKTORA for d in (-1, 0, 1)]
    na_plohu = [(vrh + SEKTORA // 2 + d) % SEKTORA for d in (-1, 0, 1)]

    jaki, slabi = [], []
    for t, mjerenje in vrijednosti.items():
        podatak = vjetrovi.get(t)
        if podatak is None:
            continue
        sektor = int(((podatak[0] + KORAK / 2) % 360) / KORAK)
        if sektor in s_plohe:
            jaki.append(mjerenje)
        elif sektor in na_plohu:
            slabi.append(mjerenje)

    return {
        "vrh": vrh,
        "sati": sum(n for n, _ in kante),
        "omjer": statistics.fmean(jaki) / statistics.fmean(slabi) if slabi else float("nan"),
        "auc": _auc(jaki, slabi),
        "kante": kante,
    }


def glavno() -> None:
    """Uspoređuje tri izvora vjetra na obje postaje i ispisuje ocjene."""
    vjetrovi = {izvor: vjetar.ucitaj(izvor, OD, DO) for izvor in vjetar.IZVORI}
    for izvor, v in vjetrovi.items():
        logger.info("%s: %d sati vjetra", izvor, len(v))

    for postaja in postaje.POSTAJE:
        tvar = TVAR[postaja.oznaka]
        _, zapisi = postaje.niz(postaja.oznaka)
        vrijednosti = {
            str(z["t"]): float(z[tvar]) for z in zapisi if z.get(tvar) is not None
        }
        logger.info("\n=== %s, %s — %d sati mjerenja ===", postaja.naziv, tvar, len(vrijednosti))
        logger.info("%-8s %-6s %8s %6s %8s", "izvor", "vrh", "omjer", "AUC", "sati")
        for izvor in vjetar.IZVORI:
            o = ocijeni(postaja.oznaka, vrijednosti, vjetrovi[izvor])
            logger.info(
                "%-8s %-6s %8.2f %6.3f %8d",
                izvor, IMENA[int(o["vrh"])], o["omjer"], o["auc"], int(o["sati"]),
            )
        logger.info("\nruža po izvoru (srednji %s po sektoru, µg/m³):", tvar)
        logger.info("%-6s %s", "", " ".join(f"{ime:>6}" for ime in IMENA))
        for izvor in vjetar.IZVORI:
            kante = ruza(vrijednosti, vjetrovi[izvor])
            logger.info(
                "%-6s %s", izvor,
                " ".join(f"{sr:6.2f}" if not math.isnan(sr) else "     ." for _, sr in kante),
            )
            logger.info(
                "%-6s %s", "  sati",
                " ".join(f"{n:6d}" for n, _ in kante),
            )


if __name__ == "__main__":
    glavno()
