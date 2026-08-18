#!/usr/bin/env python3
"""Godišnji račun raspršenja mirisa s Karepovca — prototip, još nije na stranici.

Ovo je kvantitativni dio: koliko sati godišnje miris prijeđe prag i kolika je
koncentracija na 98. percentilu. Prikaz dima na stranici (`izvedi-polje-dima.py`)
nosi samo geometriju; ovdje su brojke.

Postupak prati okvir iz `docs/Karepovac Odour Dispersion Modeling.md`, ali ne
cijeli — vidi „Što ovdje nedostaje” niže. Ukratko:

1. Sati u godini razvrstaju se po smjeru, brzini i dubini graničnog sloja.
2. Za svaki razred računa se polje vjetra nad LiDAR reljefom.
3. Kroz polje se puštaju Lagrangeove čestice; debljina perjanice raste kao
   √(2·Kz·t), pa se koncentracija razrjeđuje s udaljenošću.
4. Rezultat se množi omjerom vrh/prosjek (2,3) jer nos reagira na trenutačni
   vrh, a ne na satni prosjek.
5. Iz razreda se, težinski po broju sati, računa 98. percentil i broj sati
   iznad praga.

Što ovdje nedostaje, a studija to traži:

- Model nema pamćenje. Svaki razred se računa kao ustaljeno stanje, pa nema ni
  zastoja ni vraćanja mirisa koje donosi izmjena kopnenog i morskog povjetarca.
  To je glavni prigovor koji studija ima na ustaljene modele.
- Jačina izvora je pretpostavka iz literature, ne mjerenje po EN 13725. Sve
  brojke skaliraju s njom pravocrtno.
- Nema hrapavosti podloge iz CORINE-a, ni baklje kao uzdignutog izvora.
- ERA5 ima ćeliju od 25 km, pa opisuje vrijeme nad Splitom, a ne nad Karepovcem.

Pokretanje: `npm run izvedi-raspesenje`
"""

from __future__ import annotations

import json
import logging
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reljef_polje import (  # noqa: E402
    DX,
    NX,
    NY,
    X0,
    Y1,
    gladi,
    maska_plohe,
    polje_vjetra,
    ucitaj_reljef,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
PREDMEMORIJA = KORIJEN / ".cache" / "era5-karepovac.json"
IZLAZ = KORIJEN / ".cache" / "raspesenje.npz"

# Sredina odlagališta; ERA5 ionako ne razlučuje ništa sitnije.
LAT, LON = 43.5245, 16.5050
GODINA = 2025

# Emisija: prekriveno tijelo s otplinjavanjem daje 1–5 ouE/m²/s, radna ploha
# desetke puta više. Dok nema mjerenja, ovo je pretpostavka — i najveća
# nesigurnost u cijelom računu.
TOK = 3.0
#: Omjer vrh/prosjek; nos reagira na udah, model daje satni prosjek.
PMR = 2.3
#: Prag „jako neugodnog” mirisa iz europske prakse, u ouE/m³.
PRAG = 1.5

#: Vodoravna turbulencija kao udio brzine, po razredu stabilnosti.
SIGMA = (0.06, 0.18, 0.45)
#: Dubina miješanja u metrima, po razredu stabilnosti.
DUBINA = (80.0, 350.0, 900.0)
#: Okomita difuzivnost u m²/s, po razredu stabilnosti.
KZ = (0.06, 0.6, 3.0)

#: Razred se preskače ako ga u godini ima manje od ovoliko sati.
NAJMANJE_SATI = 8


def skini_vrijeme() -> dict[str, list]:
    """Skida satne podatke ERA5 preko Open-Mete; drugi put čita iz `.cache/`.

    Returns:
        Rječnik sa `time`, `wind_speed_10m`, `wind_direction_10m` i
        `boundary_layer_height`.
    """
    if PREDMEMORIJA.exists():
        logger.info("vrijeme iz predmemorije: %s", PREDMEMORIJA.name)
        return json.loads(PREDMEMORIJA.read_text(encoding="utf8"))["hourly"]

    PREDMEMORIJA.parent.mkdir(parents=True, exist_ok=True)
    upit = urllib.parse.urlencode(
        {
            "latitude": LAT,
            "longitude": LON,
            "start_date": f"{GODINA}-01-01",
            "end_date": f"{GODINA}-12-31",
            "hourly": "wind_speed_10m,wind_direction_10m,temperature_2m,"
            "boundary_layer_height",
            "timezone": "Europe/Zagreb",
        }
    )
    adresa = f"https://archive-api.open-meteo.com/v1/archive?{upit}"
    logger.info("skidam %d sati vremena s Open-Mete...", 24 * 365)
    with urllib.request.urlopen(adresa, timeout=180) as odgovor:
        podatci = odgovor.read()
    PREDMEMORIJA.write_bytes(podatci)
    return json.loads(podatci)["hourly"]


def razredi(met: dict[str, list]) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Razvrstava sate po smjeru, brzini i stabilnosti.

    Args:
        met: Satni niz iz `skini_vrijeme`.

    Returns:
        Četvorka (sektor, razred brzine, razred stabilnosti, brzina u m/s).
    """
    brzina = np.array(met["wind_speed_10m"], float) / 3.6
    smjer = np.array(met["wind_direction_10m"], float)
    granicni = np.array(met["boundary_layer_height"], float)

    sektor = np.floor(((smjer + 11.25) % 360) / 22.5).astype(int)
    po_brzini = np.digitize(brzina, [1.5, 3.5])
    po_stabilnosti = np.digitize(granicni, [150.0, 600.0])
    return sektor, po_brzini, po_stabilnosti, brzina


def raspri(
    u: np.ndarray,
    v: np.ndarray,
    izvor: np.ndarray,
    sigma: float,
    kz: float,
    najveca_dubina: float,
    cestica: int = 6000,
    koraka: int = 400,
    dt: float = 6.0,
) -> np.ndarray:
    """Pušta čestice kroz polje i zbraja vrijeme boravka po ćeliji.

    Debljina perjanice raste kao √(2·Kz·t), pa se ne zbraja broj čestica nego
    boravak podijeljen debljinom — inače bi se sve razrijedilo odmah na cijelu
    dubinu miješanja i near-field bi ispao prenizak.

    Args:
        u: Brzina prema istoku, m/s.
        v: Brzina prema sjeveru, m/s.
        izvor: Točke izvora, oblika (n, 2), u HTRS96/TM.
        sigma: Vodoravna turbulencija, m/s.
        kz: Okomita difuzivnost, m²/s.
        najveca_dubina: Gornja granica debljine perjanice, m.
        cestica: Koliko čestica pustiti.
        koraka: Koliko koraka odraditi.
        dt: Duljina koraka u sekundama.

    Returns:
        Polje Σ(boravak/debljina) oblika (NY, NX).
    """
    rng = np.random.default_rng(7)
    kljuc = rng.integers(0, len(izvor), cestica)
    tocka = izvor[kljuc].astype(np.float64) + rng.normal(0, DX * 0.5, (cestica, 2))
    pocetak = rng.integers(0, koraka, cestica)

    polje = np.zeros((NY, NX))
    zivo = np.zeros(cestica, bool)
    starost = np.zeros(cestica)

    for korak in range(koraka):
        zivo |= pocetak == korak
        starost += zivo * dt
        if not zivo.any():
            continue

        i = np.clip(((Y1 - tocka[:, 1]) / DX).astype(int), 0, NY - 1)
        j = np.clip(((tocka[:, 0] - X0) / DX).astype(int), 0, NX - 1)
        sum_ = rng.normal(0, sigma, (cestica, 2))
        tocka[:, 0] += np.where(zivo, (u[i, j] + sum_[:, 0]) * dt, 0)
        tocka[:, 1] += np.where(zivo, (v[i, j] + sum_[:, 1]) * dt, 0)

        vani = (
            (tocka[:, 0] < X0)
            | (tocka[:, 0] > X0 + NX * DX)
            | (tocka[:, 1] < Y1 - NY * DX)
            | (tocka[:, 1] > Y1)
        )
        zivo &= ~vani
        tocka[vani] = izvor[kljuc[vani]]
        starost[vani] = 0.0

        debljina = np.clip(np.sqrt(2.0 * kz * starost) + 8.0, 8.0, najveca_dubina)
        np.add.at(polje, (i[zivo], j[zivo]), 1.0 / debljina[zivo])
    return polje


def glavno() -> None:
    """Računa godišnju sliku i sprema polja u `.cache/`."""
    z = gladi(ucitaj_reljef(), 3)
    maska = maska_plohe()
    yi, xi = np.nonzero(maska)
    izvor = np.stack([X0 + (xi + 0.5) * DX, Y1 - (yi + 0.5) * DX], 1)

    oer = TOK * maska.sum() * DX * DX
    logger.info(
        "ploha %d ćelija (%.0f ha), emisija %.2f MouE/s pri %.1f ouE/m²/s",
        int(maska.sum()), maska.sum() * DX * DX / 1e4, oer / 1e6, TOK,
    )

    met = skini_vrijeme()
    sektor, po_brzini, po_stabilnosti, brzina = razredi(met)

    polja: dict[tuple[int, int, int], tuple[np.ndarray, int]] = {}
    for s in range(16):
        for rb in range(3):
            for rs in range(3):
                pripada = (sektor == s) & (po_brzini == rb) & (po_stabilnosti == rs)
                sati = int(pripada.sum())
                if sati < NAJMANJE_SATI:
                    continue
                v_sr = max(float(np.median(brzina[pripada])), 0.4)
                u, v = polje_vjetra(z, s * 22.5, v_sr, DUBINA[rs])
                cestica, koraka, dt = 6000, 400, 6.0
                boravak = raspri(
                    u, v, izvor, SIGMA[rs] * max(v_sr, 0.5), KZ[rs], DUBINA[rs],
                    cestica, koraka, dt,
                )
                # C = Σ(boravak/debljina)·dt·E / (N · površina ćelije)
                polja[(s, rb, rs)] = (boravak * dt * oer / (cestica * DX * DX) * PMR, sati)

    pokriveno = sum(sati for _, sati in polja.values())
    logger.info("razreda %d, pokrivaju %d od %d sati", len(polja), pokriveno, len(brzina))

    kljucevi = list(polja)
    vrijednosti = np.stack([polja[k][0] for k in kljucevi])
    tezine = np.array([polja[k][1] for k in kljucevi], float)

    # 98. percentil: dva posto sati smije prijeći tu vrijednost.
    poredak = np.argsort(-vrijednosti, axis=0)
    kumulativ = np.cumsum(tezine[poredak], axis=0) / tezine.sum()
    prag_indeks = (kumulativ >= 0.02).argmax(axis=0)
    p98 = np.take_along_axis(
        vrijednosti, np.take_along_axis(poredak, prag_indeks[None], 0), 0
    )[0]

    sati_mirisa = np.zeros((NY, NX))
    for k in kljucevi:
        polje_k, sati_k = polja[k]
        sati_mirisa += (polje_k > PRAG) * sati_k

    np.savez_compressed(IZLAZ, p98=p98, sati=sati_mirisa, maska=maska, reljef=z)
    logger.info(
        "p98 najviše %.0f ouE/m³; sati iznad praga: medijan %.0f, najviše %.0f",
        p98.max(), np.median(sati_mirisa), sati_mirisa.max(),
    )
    for granica in (175, 500, 1000, 2000):
        logger.info(
            "  iznad %4d h/god na %.1f %% obuhvata",
            granica, 100 * float((sati_mirisa > granica).mean()),
        )
    logger.info("spremljeno %s", IZLAZ.relative_to(KORIJEN))


if __name__ == "__main__":
    glavno()
