#!/usr/bin/env python3
"""Satna mjerenja sa službenih postaja na Karepovcu — skidanje i čitanje.

Na Karepovcu stoje dvije postaje Nastavnog zavoda za javno zdravstvo SDŽ.
Objavljuju satne tablice, mjesec po mjesec, na `zrak-zavod-split.info`:

- **Karepovac 1** (`/k1/`) — H₂S, NH₃, NO₂, SO₂. Istočna strana plohe.
- **Karepovac 2** (`/k2/`) — merkaptani, benzen i srodni, ozon, CO. Južna strana;
  u državnom očevidniku vodi se kao postaja 309.

Tablice su nevalidirani, automatski objavljeni podatci — Zavod ih naknadno
provjerava i objavljuje u godišnjim izvješćima. Za našu upotrebu (usporedba s
modelom, bazdarenje izvora) to je dovoljno, ali tako ih treba i označiti.

Oblik zapisa u tablici:

- `datum` je `dd.mm.gggg`, `sat` je kraj sata, pa `1:00` znači 00–01 h.
- `< 0,1` znači ispod granice određivanja; uzima se polovica granice.
- `-` znači da uređaj nije radio.

Vrijeme je lokalno (Europe/Zagreb). Ovdje se pretvara u UTC da bi se moglo
spojiti s vremenskim nizovima.
"""

from __future__ import annotations

import html
import json
import logging
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
PREDMEMORIJA = KORIJEN / ".cache" / "postaje"

POSLUZITELJ = "http://www.zrak-zavod-split.info"
#: Poslužitelj prekida vezu klijentima bez zaglavlja; ovo je najmanje pristojno.
ZAGLAVLJA = {"User-Agent": "kvart.hr (mjerenja s Karepovca; kontakt@kvart.hr)"}
POKUSAJA = 4
ZAGREB = ZoneInfo("Europe/Zagreb")

#: Udio granice određivanja koji se pripisuje nalazu „< granica”.
UDIO_ISPOD_GRANICE = 0.5


@dataclass(frozen=True)
class Postaja:
    """Jedna mjerna postaja i njezino mjesto.

    Attributes:
        oznaka: Kratica koja se koristi u putanjama i datotekama.
        naziv: Ime kako ga objavljuje Zavod.
        lat: Zemljopisna širina u stupnjevima, WGS84.
        lon: Zemljopisna dužina u stupnjevima, WGS84.
        opis: Gdje postaja stoji u odnosu na plohu.
    """

    oznaka: str
    naziv: str
    lat: float
    lon: float
    opis: str


#: Očevidnik kvalitete zraka (iszz.azo.hr) obje postaje vodi na istoj točki,
#: zaokruženoj na tri decimale — dakle na ~100 m. To je jugoistočni rub plohe,
#: prema Kamenu. Godišnji izvještaj Zavoda za 2021. navodi drugu koordinatu
#: (N 43° 31′ 47,90″), koja bi postaju stavila sjeverno od plohe; ruža mirisa
#: to isključuje, jer H₂S raste kad vjetar puše sa sjeverozapada, dakle s
#: plohe prema postaji. Vidi `scripts/provjeri-vjetar.py`.
POSTAJE = (
    Postaja("k1", "Karepovac 1", 43.516, 16.517, "jugoistočni rub plohe"),
    Postaja("k2", "Karepovac 2", 43.516, 16.517, "jugoistočni rub plohe"),
)

_BROJ = re.compile(r"^-?\d+(?:[.,]\d+)?$")
_ISPOD = re.compile(r"^<\s*(\d+(?:[.,]\d+)?)$")


def _skini(adresa: str, put: Path) -> str:
    """Skida stranicu i pamti je; drugi put čita s diska.

    Args:
        adresa: Puna adresa stranice.
        put: Datoteka u predmemoriji.

    Returns:
        Sadržaj stranice kao tekst.
    """
    if put.exists():
        return put.read_text(encoding="utf8")
    put.parent.mkdir(parents=True, exist_ok=True)
    logger.info("skidam %s", adresa)
    zahtjev = urllib.request.Request(adresa, headers=ZAGLAVLJA)
    for pokusaj in range(POKUSAJA):
        try:
            with urllib.request.urlopen(zahtjev, timeout=60) as odgovor:
                tekst = odgovor.read().decode("utf8", errors="replace")
            break
        except (urllib.error.URLError, ConnectionError, TimeoutError) as greska:
            if pokusaj == POKUSAJA - 1:
                raise RuntimeError(f"ne mogu skinuti {adresa}") from greska
            time.sleep(2 ** pokusaj)
    put.write_text(tekst, encoding="utf8")
    return tekst


def mjeseci(oznaka: str) -> list[str]:
    """Vraća popis mjeseci koje postaja objavljuje, u obliku `GGGGMM`."""
    tekst = _skini(
        f"{POSLUZITELJ}/{oznaka}/", PREDMEMORIJA / f"{oznaka}-kazalo.html"
    )
    return sorted(set(re.findall(rf"{oznaka}Tab(\d{{6}})\.html", tekst)))


def _polje(tekst: str) -> tuple[float | None, bool]:
    """Pretvara jednu ćeliju tablice u broj.

    Returns:
        Par (vrijednost, je li nalaz bio ispod granice određivanja).
    """
    tekst = tekst.strip().replace("\xa0", " ")
    if _BROJ.match(tekst):
        return float(tekst.replace(",", ".")), False
    ispod = _ISPOD.match(tekst)
    if ispod:
        return float(ispod.group(1).replace(",", ".")) * UDIO_ISPOD_GRANICE, True
    return None, False


def _redci(tekst: str) -> list[list[str]]:
    """Razlaže HTML tablicu na redke gole od oznaka."""
    izlaz = []
    for red in re.findall(r"<tr[^>]*>(.*?)</tr>", tekst, re.S | re.I):
        celije = [
            html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", red, re.S | re.I)
        ]
        if celije:
            izlaz.append(celije)
    return izlaz


def ucitaj(oznaka: str, mjesec: str) -> tuple[list[str], list[dict]]:
    """Učitava jedan mjesec satnih mjerenja jedne postaje.

    Args:
        oznaka: `k1` ili `k2`.
        mjesec: Mjesec u obliku `GGGGMM`.

    Returns:
        Par (nazivi tvari, satni zapisi). Svaki zapis ima `t` (UTC, ISO 8601)
        i po jedan ključ za svaku tvar; vrijednost je broj ili `None`.
    """
    tekst = _skini(
        f"{POSLUZITELJ}/{oznaka}Tab{mjesec}.html",
        PREDMEMORIJA / f"{oznaka}-{mjesec}.html",
    )
    redci = _redci(tekst)
    if not redci:
        return [], []

    tvari = [c for c in redci[0][2:] if c]
    zapisi = []
    for red in redci[1:]:
        if len(red) < 2 or not re.match(r"^\d{2}\.\d{2}\.\d{4}$", red[0]):
            continue
        sat = int(red[1].split(":")[0])
        dan = datetime.strptime(red[0], "%d.%m.%Y")
        # Sat je kraj razdoblja: „1:00” je 00–01 h, „24:00” je 23–24 h.
        pocetak = dan + timedelta(hours=sat - 1)
        zapis: dict[str, object] = {
            "t": pocetak.replace(tzinfo=ZAGREB)
            .astimezone(timezone.utc)
            .strftime("%Y-%m-%dT%H:00Z")
        }
        for tvar, celija in zip(tvari, red[2:]):
            vrijednost, _ = _polje(celija)
            zapis[tvar] = vrijednost
        zapisi.append(zapis)
    return tvari, zapisi


def niz(oznaka: str) -> tuple[list[str], list[dict]]:
    """Slaže sve objavljene mjesece jedne postaje u jedan niz po vremenu.

    Args:
        oznaka: `k1` ili `k2`.

    Returns:
        Par (nazivi tvari, satni zapisi poredani po vremenu, bez ponavljanja).
    """
    sve: dict[str, dict] = {}
    tvari: list[str] = []
    for mjesec in mjeseci(oznaka):
        m_tvari, zapisi = ucitaj(oznaka, mjesec)
        for tvar in m_tvari:
            if tvar not in tvari:
                tvari.append(tvar)
        for zapis in zapisi:
            sve.setdefault(str(zapis["t"]), {}).update(zapis)
    return tvari, [sve[k] for k in sorted(sve)]


def spremi(izlaz: Path | None = None) -> Path:
    """Skida obje postaje i sprema uredan zapis u `.cache/postaje/`.

    Args:
        izlaz: Odredište; podrazumijeva se `.cache/postaje/mjerenja.json`.

    Returns:
        Putanju do zapisanog spisa.
    """
    izlaz = izlaz or PREDMEMORIJA / "mjerenja.json"
    sadrzaj = {}
    for postaja in POSTAJE:
        tvari, zapisi = niz(postaja.oznaka)
        sadrzaj[postaja.oznaka] = {
            "naziv": postaja.naziv,
            "lat": postaja.lat,
            "lon": postaja.lon,
            "opis": postaja.opis,
            "tvari": tvari,
            "satno": zapisi,
        }
    izlaz.parent.mkdir(parents=True, exist_ok=True)
    izlaz.write_text(json.dumps(sadrzaj), encoding="utf8")
    return izlaz
