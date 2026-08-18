#!/usr/bin/env python3
"""Satni vjetar nad Karepovcem — tri izvora, isti oblik zapisa.

Vjetar je najslabija karika u računu raspršenja: sve ostalo model računa nad
LiDAR reljefom u koraku od 20 m, a vjetar je dosad dolazio iz ERA5-a, čija je
ćelija 25 km — dakle jedan broj za cijeli Split, Kaštela, Mosor i pola kanala.

Zato su ovdje tri izvora u istom obliku, da se mogu izravno usporediti prema
mjerenjima s postaje (vidi `scripts/provjeri-vjetar.py`):

- **`era5`** — preračun ERA5 preko Open-Mete, ćelija ~25 km. Ono što smo imali.
- **`visoka`** — Open-Meteo arhiva prognostičkih modela visoke razlučivosti,
  ćelija ~2 km. Nije mjerenje nego model, ali model koji vidi obalu i Mosor.
- **`ldsp`** — METAR sa splitske zračne luke (Resnik), stvarno mjerenje
  anemometrom svakih pola sata. Postaja je 17 km zapadno, iza Kozjaka, pa
  opisuje kaštelansko polje, a ne našu padinu.

DHMZ-ova postaja Split-Marjan (43° 30′ 30″, 16° 25′ 33″) je najbliža službena
automatska postaja s vjetrom — 8 km zapadno — ali arhivu satnih vrijednosti ne
objavljuje javno, nego se traži zahtjevom. Zato je ovdje nema.

Zapis je uvijek rječnik: UTC sat u obliku `GGGG-MM-DDTHH:00Z` → (smjer iz kojega
puše u stupnjevima, brzina u m/s).
"""

from __future__ import annotations

import csv
import io
import json
import logging
import math
import urllib.parse
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
PREDMEMORIJA = KORIJEN / ".cache" / "vjetar"

# Sredina odlagališta.
LAT, LON = 43.5215, 16.5105

#: Splitska zračna luka; jedina javna arhiva stvarnih mjerenja vjetra u blizini.
LDSP = "LDSP"

IZVORI = ("era5", "visoka", "ldsp")


def _skini(adresa: str, put: Path) -> bytes:
    """Skida adresu i pamti odgovor u predmemoriji."""
    if put.exists():
        return put.read_bytes()
    put.parent.mkdir(parents=True, exist_ok=True)
    logger.info("skidam %s", adresa.split("?")[0])
    with urllib.request.urlopen(adresa, timeout=300) as odgovor:
        podatci = odgovor.read()
    put.write_bytes(podatci)
    return podatci


def _open_meteo(
    posluzitelj: str, od: str, do: str, polja: str, ime: str, dodatno: str = ""
) -> dict:
    """Skida satni niz s Open-Mete i vraća `hourly` dio odgovora."""
    upit = urllib.parse.urlencode(
        {
            "latitude": LAT,
            "longitude": LON,
            "start_date": od,
            "end_date": do,
            "hourly": polja,
            "timezone": "UTC",
            "wind_speed_unit": "ms",
        }
    )
    adresa = f"{posluzitelj}?{upit}{dodatno}"
    return json.loads(_skini(adresa, PREDMEMORIJA / f"{ime}-{od}-{do}.json"))["hourly"]


POLJA_ERA5 = (
    "wind_speed_10m,wind_direction_10m,boundary_layer_height,"
    "shortwave_radiation,cloud_cover,temperature_2m"
)


def era5(od: str, do: str) -> tuple[dict[str, tuple[float, float]], dict[str, dict]]:
    """Vraća ERA5 vjetar i ono što treba za razred stabilnosti.

    Args:
        od: Prvi dan u obliku `GGGG-MM-DD`.
        do: Zadnji dan u obliku `GGGG-MM-DD`.

    Returns:
        Par (vjetar po satu, okolnosti po satu). Okolnosti su rječnik s
        `granicni` (dubina graničnog sloja, m), `sunce` (kratkovalno zračenje,
        W/m²) i `oblaci` (naoblaka, %).
    """
    h = _open_meteo(
        "https://archive-api.open-meteo.com/v1/archive",
        od,
        do,
        POLJA_ERA5,
        "era5-uvjeti",
        "&models=era5",
    )
    vjetar, okolnosti = {}, {}
    for i, t in enumerate(h["time"]):
        kljuc = f"{t}Z" if t.endswith(":00") else t
        smjer, brzina = h["wind_direction_10m"][i], h["wind_speed_10m"][i]
        if smjer is not None and brzina is not None:
            vjetar[kljuc] = (float(smjer), float(brzina))
        okolnosti[kljuc] = {
            "granicni": h["boundary_layer_height"][i],
            "sunce": h["shortwave_radiation"][i],
            "oblaci": h["cloud_cover"][i],
        }
    return vjetar, okolnosti


def uvjeti(od: str, do: str) -> dict[str, dict]:
    """Vraća satne okolnosti (granični sloj, zračenje, naoblaka) iz ERA5-a."""
    return era5(od, do)[1]


def visoka(od: str, do: str) -> dict[str, tuple[float, float]]:
    """Vraća vjetar iz arhive prognostičkih modela visoke razlučivosti."""
    h = _open_meteo(
        "https://historical-forecast-api.open-meteo.com/v1/forecast",
        od,
        do,
        "wind_speed_10m,wind_direction_10m,boundary_layer_height",
        "visoka",
    )
    vjetar = {}
    for i, t in enumerate(h["time"]):
        smjer, brzina = h["wind_direction_10m"][i], h["wind_speed_10m"][i]
        if smjer is None or brzina is None:
            continue
        vjetar[f"{t}Z"] = (float(smjer), float(brzina))
    return vjetar


def ldsp(od: str, do: str) -> dict[str, tuple[float, float]]:
    """Vraća izmjereni vjetar sa splitske zračne luke, usrednjen po satu.

    METAR javlja svakih pola sata; dva očitanja unutar sata usrednjuju se
    vektorski, jer se smjerovi ne smiju zbrajati kao brojevi.
    """
    upit = urllib.parse.urlencode(
        {
            "station": LDSP,
            "data": "drct,sknt",
            "year1": od[:4], "month1": int(od[5:7]), "day1": int(od[8:10]),
            "year2": do[:4], "month2": int(do[5:7]), "day2": int(do[8:10]),
            "tz": "Etc/UTC",
            "format": "onlycomma",
            "missing": "M",
            "trace": "T",
            "direct": "no",
            "report_type": "3",
        }
    )
    sirovo = _skini(
        f"https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?{upit}",
        PREDMEMORIJA / f"ldsp-{od}-{do}.csv",
    ).decode("utf8")

    zbroj: dict[str, list[float]] = {}
    for red in csv.DictReader(io.StringIO(sirovo)):
        if red["drct"] in ("M", "") or red["sknt"] in ("M", ""):
            continue
        kljuc = red["valid"][:13].replace(" ", "T") + ":00Z"
        brzina = float(red["sknt"]) * 0.514444
        kut = math.radians(float(red["drct"]))
        stavka = zbroj.setdefault(kljuc, [0.0, 0.0, 0.0])
        stavka[0] += brzina * math.sin(kut)
        stavka[1] += brzina * math.cos(kut)
        stavka[2] += 1

    vjetar = {}
    for kljuc, (su, sv, n) in zbroj.items():
        u, v = su / n, sv / n
        vjetar[kljuc] = ((math.degrees(math.atan2(u, v)) + 360) % 360, math.hypot(u, v))
    return vjetar


def ucitaj(izvor: str, od: str, do: str) -> dict[str, tuple[float, float]]:
    """Vraća vjetar odabranog izvora.

    Args:
        izvor: Jedan od `era5`, `visoka`, `ldsp`.
        od: Prvi dan u obliku `GGGG-MM-DD`.
        do: Zadnji dan u obliku `GGGG-MM-DD`.

    Returns:
        Satni vjetar: UTC sat → (smjer iz kojega puše, brzina u m/s).

    Raises:
        ValueError: Ako izvor nije poznat.
    """
    if izvor == "era5":
        return era5(od, do)[0]
    if izvor == "visoka":
        return visoka(od, do)
    if izvor == "ldsp":
        return ldsp(od, do)
    raise ValueError(f"nepoznat izvor vjetra: {izvor}")
