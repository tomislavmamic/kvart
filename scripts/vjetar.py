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
- **`marjan`** — DHMZ-ova glavna postaja Split-Marjan (43° 30′ 30″,
  16° 25′ 33″), 6 km zapadno, preko Meteostatova niza *izmjerenih* satnih
  vrijednosti. Uzima se `hourly/obs`, a ne spojeni niz: spojeni rupe popunjava
  modelom, pa bi se kroz stražnja vrata vratio isti ERA5 koji je već odbačen.

Redoslijed nije stvar ukusa. Provjera na 9 904 sata izmjerenog H₂S-a uz plohu
(`docs/provjera-izvora-vjetra.md`) pokazala je da zračna luka noću nema moć
razlučivanja — AUC 0,505, dakle bacanje novčića — dok Marjan ima 0,592. Luka je
predaleko i iza Kozjaka, pa ne vidi noćno strujanje niz padinu, a upravo su te
noći epizode. Zato `marjan` ide ispred `ldsp`.

Zapis je uvijek rječnik: UTC sat u obliku `GGGG-MM-DDTHH:00Z` → (smjer iz kojega
puše u stupnjevima, brzina u m/s).
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import logging
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
PREDMEMORIJA = KORIJEN / ".cache" / "vjetar"

# Sredina odlagališta.
LAT, LON = 43.5215, 16.5105

#: Splitska zračna luka; jedina javna arhiva stvarnih mjerenja vjetra u blizini.
LDSP = "LDSP"

IZVORI = ("era5", "visoka", "marjan", "split3", "ldsp", "spoj")

#: Redoslijed za spojeni niz: bolji izvor prvi, slabiji popunjava rupe.
#:
#: Split-3 je prvi jer jedini ima i pogodak i pokrivenost — omjer 1,53 i AUC
#: 0,611 na 15 832 sata. Marjan pogađa jednako dobro (0,618), ali **noću ne
#: javlja ništa**: između ponoći i pet sati ima nula očitanja i pokrivenost mu
#: padne na 45 % naspram 75 % danju, pa bi sam izbacio upravo sate u kojima se
#: epizode događaju. Zračna luka je zadnja: noću joj je AUC 0,505, dakle
#: bacanje novčića (vidi `docs/provjera-izvora-vjetra.md` na `main`).
#:
#: Redoslijed je bitan: s Marjanom na čelu spoj pada na AUC 0,590, jer ono što
#: Split-3 zna zamijeni onim što Marjan zna samo danju.
LANAC = ("split3", "marjan", "ldsp")

#: Odakle brzina u spoju. Split-3 stoji u gradu, nisko i u zaklonu: smjer mu
#: valja, ali medijan brzine mu je 2,0 m/s naspram 3,1 na Marjanu i u luci, a
#: 90. percentil 5,0 naspram 6,2–8,9. Uzeta kao brzina nošenja, ta razlika
#: zaustavi perjanicu nad plohom. Zato spoj uzima smjer s najbliže postaje, a
#: brzinu s otvorenih meteoroloških — one mjere sloj kroz koji se zrak nosi.
LANAC_BRZINE = ("marjan", "ldsp", "era5")

#: Meteostatov niz izmjerenih satnih vrijednosti; 14445 je Split-Marjan.
METEOSTAT = "https://bulk.meteostat.net/v2/hourly/obs/{}.csv.gz"
MARJAN = "14445"

#: Očevidnik kvalitete zraka; postaja 305 je Split-3, 4,3 km od plohe.
#: Veličine 477 i 478 su brzina i smjer vjetra.
AZO_IZVOZ = "https://iszz.azo.hr/iskzl/rs/podatak/export/json"
SPLIT3 = 305
AZO_BRZINA, AZO_SMJER = 477, 478


#: Očevidnik odbija prebrze nizove upita s 429; ovo je stanka između njih.
STANKA_S = 3.0
POKUSAJA = 6
#: Zaglavlje mora biti latin-1, pa bez dijakritika.
ZAGLAVLJA = {"User-Agent": "kvart.hr (Karepovac air watch)"}


def _skini(adresa: str, put: Path, stanka: float = 0.0) -> bytes:
    """Skida adresu i pamti odgovor u predmemoriji.

    Args:
        adresa: Puna adresa.
        put: Datoteka u predmemoriji.
        stanka: Koliko čekati nakon uspješnog dohvata, radi pristojnosti.

    Returns:
        Sadržaj odgovora.

    Raises:
        RuntimeError: Ako ni nakon nekoliko pokušaja ne uspije.
    """
    if put.exists():
        return put.read_bytes()
    put.parent.mkdir(parents=True, exist_ok=True)
    logger.info("skidam %s", adresa.split("?")[0])
    for pokusaj in range(POKUSAJA):
        try:
            zahtjev = urllib.request.Request(adresa, headers=ZAGLAVLJA)
            with urllib.request.urlopen(zahtjev, timeout=300) as odgovor:
                podatci = odgovor.read()
            put.write_bytes(podatci)
            if stanka:
                time.sleep(stanka)
            return podatci
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as greska:
            zadnji = pokusaj == POKUSAJA - 1
            prolazno = (
                not isinstance(greska, urllib.error.HTTPError)
                or greska.code in (429, 503)
            )
            if zadnji or not prolazno:
                raise RuntimeError(f"ne mogu dohvatiti {adresa}") from greska
            cekaj = STANKA_S * (2**pokusaj)
            logger.info("  %s, čekam %.0f s", greska, cekaj)
            time.sleep(cekaj)
    raise RuntimeError(f"ne mogu dohvatiti {adresa}")


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


def marjan(od: str, do: str) -> dict[str, tuple[float, float]]:
    """Vraća izmjereni vjetar s postaje Split-Marjan, po satu.

    Meteostat brzinu piše u km/h, a redak nosi dan i sat u UTC-u odvojeno.

    Args:
        od: Prvi dan u obliku `GGGG-MM-DD`.
        do: Zadnji dan u obliku `GGGG-MM-DD`.

    Returns:
        Satni vjetar: UTC sat → (smjer iz kojega puše, brzina u m/s).
    """
    sirovo = _skini(
        METEOSTAT.format(MARJAN), PREDMEMORIJA / f"meteostat-{MARJAN}.csv.gz"
    )
    vjetar = {}
    with gzip.open(io.BytesIO(sirovo), "rt") as f:
        for redak in f:
            polja = redak.rstrip("\n").split(",")
            if len(polja) < 9 or not polja[7] or not polja[8]:
                continue
            dan, sat = polja[0], polja[1]
            if not (od <= dan <= do):
                continue
            try:
                kljuc = f"{dan}T{int(sat):02d}:00Z"
                vjetar[kljuc] = (float(polja[7]), float(polja[8]) / 3.6)
            except ValueError:
                continue
    return vjetar


def split3(od: str, do: str) -> dict[str, tuple[float, float]]:
    """Vraća izmjereni vjetar s postaje Split-3, po satu.

    Očevidnik vraća po jednu veličinu odjednom i ne voli duge upite, pa se
    razdoblje dijeli na komade od četrdeset dana; svaki se pamti zasebno.

    Args:
        od: Prvi dan u obliku `GGGG-MM-DD`.
        do: Zadnji dan u obliku `GGGG-MM-DD`.

    Returns:
        Satni vjetar: UTC sat → (smjer iz kojega puše, brzina u m/s).
    """
    def niz(velicina: int) -> dict[str, float]:
        izlaz: dict[str, float] = {}
        a = datetime.strptime(od, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        kraj = datetime.strptime(do, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        while a < kraj:
            b = min(a + timedelta(days=40), kraj)
            upit = (
                f"{AZO_IZVOZ}?postaja={SPLIT3}&polutant={velicina}&tipPodatka=0"
                f"&vrijemeOd={a:%d.%m.%Y}&vrijemeDo={b:%d.%m.%Y}"
            )
            put = PREDMEMORIJA / f"azo-{SPLIT3}-{velicina}-{a:%Y%m%d}.json"
            for zapis in json.loads(_skini(upit, put, STANKA_S).decode("utf8")):
                v, t = zapis.get("vrijednost"), zapis.get("vrijeme")
                if isinstance(v, (int, float)) and isinstance(t, int):
                    kada = datetime.fromtimestamp(t / 1000, timezone.utc)
                    izlaz[kada.strftime("%Y-%m-%dT%H:00Z")] = float(v)
            a = b
        return izlaz

    brzine, smjerovi = niz(AZO_BRZINA), niz(AZO_SMJER)
    return {
        t: (smjerovi[t], brzine[t])
        for t in brzine.keys() & smjerovi.keys()
    }


def ucitaj(izvor: str, od: str, do: str) -> dict[str, tuple[float, float]]:
    """Vraća vjetar odabranog izvora.

    Args:
        izvor: Jedan od `era5`, `visoka`, `marjan`, `split3`, `ldsp`, `spoj`.
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
    if izvor == "marjan":
        return marjan(od, do)
    if izvor == "split3":
        return split3(od, do)
    if izvor == "ldsp":
        return ldsp(od, do)
    if izvor == "spoj":
        smjerovi: dict[str, tuple[float, float]] = {}
        for ime in reversed(LANAC):
            smjerovi.update(ucitaj(ime, od, do))
        brzine: dict[str, tuple[float, float]] = {}
        for ime in reversed(LANAC_BRZINE):
            brzine.update(ucitaj(ime, od, do))
        return {
            t: (smjer, brzine[t][1] if t in brzine else brzina)
            for t, (smjer, brzina) in smjerovi.items()
        }
    raise ValueError(f"nepoznat izvor vjetra: {izvor}")
