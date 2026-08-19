#!/usr/bin/env python3
"""Ocjenjuje izvore vjetra prema izmjerenom H₂S-u uz Karepovac.

Stranica `/karepovac` crta kamo zrak s plohe ide, a smjer i brzinu uzima s
najbliže postaje koja ih u tom satu objavljuje. „Najbliža” nije samo pitanje
kilometara: postaja mora i pogađati ono što se uz plohu doista dogodilo. Ova
skripta to provjerava na arhivi i iz nje izlazi redoslijed u `src/lib/vjetar.ts`.

Postupak nema nijednu pretpostavku o jačini izvora. Postaja Karepovac (AZO 308)
leži 737 m od središta plohe, na azimutu 144°, dakle jugoistočno od nje; zrak s
plohe dolazi na nju kad vjetar puše iz sjeverozapadnog kvadranta. Svakom se
izvoru mjeri samo dvoje: pogađa li **kada** postaja stoji nizvjetar i **kada**
se zrak ne razrjeđuje.

Tri zamke koje se ovdje izbjegavaju:

1. **Dnevni hod.** I brzina vjetra i H₂S imaju jak dnevni hod, pa sirova
   korelacija mjeri doba dana, a ne prijenos. Zato se računa i na ostatcima,
   nakon što se iz obiju serija izbaci medijan po satu dana.
2. **Nulti model.** Sve mjere se ponove na plinu pomaknutom u vremenu za
   višekratnik 24 sata. Time se dobije pojas unutar kojeg brojka ne znači
   ništa — bez toga ρ = 0,08 zvuči kao nalaz.
3. **Model umjesto mjerenja.** Meteostatov spojeni niz popunjava rupe modelom;
   uzima se samo `hourly/obs`, dakle isključivo izmjereno.

Podatci se pamte u `.cache/vjetar/`, pa ponovno pokretanje ne opterećuje izvore.
AZO-ov servis vraća najviše 1000 zapisa po zahtjevu i uzvraća 429 na prebrz
slijed, pa se ide u komadima od 40 dana, sa stankom i uzmakom.

Pokretanje: `npm run provjeri-vjetar`
"""

from __future__ import annotations

import gzip
import json
import logging
import math
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
PREDMEMORIJA = KORIJEN / ".cache" / "vjetar"

AZO_IZVOZ = "https://iszz.azo.hr/iskzl/rs/podatak/export/json"
METEOSTAT = "https://bulk.meteostat.net/v2/hourly/obs/{}.csv.gz"
ZAGLAVLJA = {"User-Agent": "kvart (Karepovac air watch; +https://kvart-sage.vercel.app)"}
STANKA_S = 3.0

# AZO-ove oznake: postaje i veličine.
KAREPOVAC = 308
H2S = 4
BRZINA = 477
SMJER = 478

# Azimut sa središta plohe na postaju; postaja je nizvjetar kad vjetar puše iz
# suprotnog smjera.
AZIMUT_NA_POSTAJU = 144.0
SEKTOR = 45.0
SAT_MS = 3_600_000

OD = datetime(2024, 1, 1, tzinfo=timezone.utc)
DO = datetime(2026, 8, 19, tzinfo=timezone.utc)

IZVORI: dict[str, tuple[str, int | str]] = {
    "Split-3 (AZO, 4,3 km)": ("azo", 305),
    "Split-2 (AZO, 4,6 km)": ("azo", 304),
    "Split-Marjan (6 km)": ("meteostat", "14445"),
    "Zračna luka LDSP (16 km)": ("meteostat", "14444"),
}


# ------------------------------------------------------------------- statistika


def rangovi(x: list[float]) -> list[float]:
    """Rangovi s prosjekom za izjednačene vrijednosti."""
    poredak = sorted(range(len(x)), key=lambda i: x[i])
    r = [0.0] * len(x)
    i = 0
    while i < len(poredak):
        j = i
        while j + 1 < len(poredak) and x[poredak[j + 1]] == x[poredak[i]]:
            j += 1
        prosjek = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[poredak[k]] = prosjek
        i = j + 1
    return r


def pearson(x: list[float], y: list[float]) -> float:
    """Pearsonov koeficijent; nula ako neka serija nema raspršenja."""
    n = len(x)
    if n < 3:
        return 0.0
    sx = sum(x) / n
    sy = sum(y) / n
    gore = sum((a - sx) * (b - sy) for a, b in zip(x, y))
    dolje = math.sqrt(sum((a - sx) ** 2 for a in x) * sum((b - sy) ** 2 for b in y))
    return gore / dolje if dolje else 0.0


def spearman(x: list[float], y: list[float]) -> float:
    """Spearmanov koeficijent."""
    return pearson(rangovi(x), rangovi(y))


def auc(vrijednost: list[float], oznaka: list[bool]) -> float:
    """Vjerojatnost da nasumična epizoda ima veći pokazatelj od ne-epizode."""
    poz = sum(oznaka)
    neg = len(oznaka) - poz
    if not poz or not neg:
        return 0.5
    r = rangovi(vrijednost)
    zbroj = sum(rr for rr, o in zip(r, oznaka) if o)
    return (zbroj - poz * (poz + 1) / 2) / (poz * neg)


def medijan(x: list[float]) -> float:
    """Medijan; nula za prazan niz."""
    if not x:
        return 0.0
    s = sorted(x)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def mjesni_sat(t: int) -> int:
    """Sat po srednjoeuropskom ljetnom vremenu; dovoljno za dnevni hod."""
    return (datetime.fromtimestamp(t / 1000, timezone.utc).hour + 2) % 24


def ostatci(serija: dict[int, float]) -> dict[int, float]:
    """Vadi dnevni hod: od svake vrijednosti oduzima medijan njezina sata."""
    po_satu: dict[int, list[float]] = {}
    for t, v in serija.items():
        po_satu.setdefault(mjesni_sat(t), []).append(v)
    sredina = {h: medijan(vs) for h, vs in po_satu.items()}
    return {t: v - sredina[mjesni_sat(t)] for t, v in serija.items()}


# ------------------------------------------------------------------- dohvaćanje


def _skini(url: str, put: Path, binarno: bool = False) -> bytes:
    """Skida adresu u predmemoriju, uz uzmak na 429 i na pad mreže.

    Args:
        url: Adresa.
        put: Datoteka u koju se sprema.
        binarno: Sprema li se bez pretvorbe.

    Returns:
        Sadržaj odgovora.

    Raises:
        RuntimeError: Ako ni nakon šest pokušaja ne uspije.
    """
    if put.exists():
        return put.read_bytes()
    put.parent.mkdir(parents=True, exist_ok=True)
    for pokusaj in range(6):
        try:
            zahtjev = urllib.request.Request(url, headers=ZAGLAVLJA)
            with urllib.request.urlopen(zahtjev, timeout=120) as odgovor:
                sadrzaj = odgovor.read()
            put.write_bytes(sadrzaj)
            time.sleep(STANKA_S if not binarno else 0)
            return sadrzaj
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            if isinstance(e, urllib.error.HTTPError) and e.code not in (429, 503):
                raise
            cekaj = STANKA_S * (2**pokusaj)
            logger.info("  %s, čekam %.0f s", e, cekaj)
            time.sleep(cekaj)
    raise RuntimeError(f"ne mogu dohvatiti {url}")


def azo_niz(postaja: int, velicina: int) -> dict[int, float]:
    """Satni niz jedne veličine s jedne AZO-ove postaje, po komadima."""
    izlaz: dict[int, float] = {}
    a = OD
    while a < DO:
        b = min(a + timedelta(days=40), DO)
        url = (
            f"{AZO_IZVOZ}?postaja={postaja}&polutant={velicina}&tipPodatka=0"
            f"&vrijemeOd={a:%d.%m.%Y}&vrijemeDo={b:%d.%m.%Y}"
        )
        put = PREDMEMORIJA / f"azo-{postaja}-{velicina}-{a:%Y%m%d}.json"
        for zapis in json.loads(_skini(url, put).decode("utf8")):
            v, t = zapis.get("vrijednost"), zapis.get("vrijeme")
            if isinstance(v, (int, float)) and isinstance(t, int):
                izlaz[t] = float(v)
        a = b
    return izlaz


def meteostat_niz(oznaka: str) -> tuple[dict[int, float], dict[int, float]]:
    """Satna brzina (m/s) i smjer (°) s Meteostatova niza izmjerenih podataka.

    Uzima se `hourly/obs`, a ne spojeni niz: spojeni rupe popunjava modelom, pa
    bi se u usporedbu vratio isti ERA5 koji je već jednom bio odbačen.
    Meteostat brzinu piše u km/h.
    """
    put = PREDMEMORIJA / f"meteostat-{oznaka}.csv.gz"
    _skini(METEOSTAT.format(oznaka), put, binarno=True)
    brzina: dict[int, float] = {}
    smjer: dict[int, float] = {}
    with gzip.open(put, "rt") as f:
        for redak in f:
            polja = redak.rstrip("\n").split(",")
            if len(polja) < 9:
                continue
            try:
                dan = datetime.strptime(polja[0], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                t = int(dan.timestamp() * 1000) + int(polja[1]) * SAT_MS
            except ValueError:
                continue
            if polja[8]:
                brzina[t] = float(polja[8]) / 3.6
            if polja[7]:
                smjer[t] = float(polja[7])
    return brzina, smjer


def ucitaj_izvore() -> dict[str, tuple[dict[int, float], dict[int, float]]]:
    """Učitava sve izvore vjetra."""
    izlaz = {}
    for ime, (vrsta, oznaka) in IZVORI.items():
        if vrsta == "azo":
            izlaz[ime] = (azo_niz(int(oznaka), BRZINA), azo_niz(int(oznaka), SMJER))
        else:
            izlaz[ime] = meteostat_niz(str(oznaka))
        logger.info("%-26s %6d sati", ime, len(izlaz[ime][0]))
    return izlaz


# ----------------------------------------------------------------------- ocjena


def nizvjetar(smjer: float) -> bool:
    """Stoji li postaja nizvjetar od plohe pri tom smjeru vjetra."""
    puse_prema = (smjer + 180.0) % 360.0
    return abs(((puse_prema - AZIMUT_NA_POSTAJU + 540.0) % 360.0) - 180.0) <= SEKTOR


def ocijeni(
    brzina: dict[int, float],
    smjer: dict[int, float],
    plin: dict[int, float],
    samo: set[int],
) -> dict[str, float] | None:
    """Mjere slaganja jednog izvora vjetra s izmjerenim plinom.

    Args:
        brzina: Satna brzina vjetra u m/s.
        smjer: Satni smjer vjetra u stupnjevima.
        plin: Satna koncentracija plina.
        samo: Sati na kojima se računa; isti za sve izvore.

    Returns:
        Mjere slaganja, ili ništa ako je uzorak premalen.
    """
    sati = sorted(set(brzina) & set(smjer) & set(plin) & samo)
    if len(sati) < 500:
        return None

    u = [max(brzina[t], 0.2) for t in sati]
    g = [plin[t] for t in sati]
    niz = [nizvjetar(smjer[t]) for t in sati]
    pokazatelj = [(1.0 / uu) if nn else 0.0 for uu, nn in zip(u, niz)]
    prag = sorted(g)[int(len(g) * 0.9)]
    epizoda = [v >= prag for v in g]

    plinO = ostatci({t: plin[t] for t in sati})
    brzinaO = ostatci({t: max(brzina[t], 0.2) for t in sati})

    po_sektoru: dict[int, list[float]] = {}
    for t in sati:
        po_sektoru.setdefault(int(smjer[t] // 30) % 12, []).append(plin[t])
    vrh = max(
        (k for k, vs in po_sektoru.items() if len(vs) >= 100),
        key=lambda k: medijan(po_sektoru[k]),
        default=-1,
    )
    ocekivano = (AZIMUT_NA_POSTAJU + 180.0) % 360.0

    return {
        "sati": float(len(sati)),
        "medijan brzine": medijan(u),
        "nizvjetar %": 100.0 * sum(niz) / len(niz),
        "vrh iz smjera": float(vrh * 30 + 15) if vrh >= 0 else -1.0,
        "promašaj vrha": (
            abs(((vrh * 30 + 15 - ocekivano + 540.0) % 360.0) - 180.0) if vrh >= 0 else -1.0
        ),
        "ρ brzina": spearman(g, u),
        "ρ bez dnevnog hoda": spearman([plinO[t] for t in sati], [brzinaO[t] for t in sati]),
        "nizvjetar/uzvjetar": (
            medijan([v for v, n in zip(g, niz) if n])
            / medijan([v for v, n in zip(g, niz) if not n])
            if medijan([v for v, n in zip(g, niz) if not n])
            else 0.0
        ),
        "AUC epizode": auc(pokazatelj, epizoda),
        "AUC 1/brzina": auc([1.0 / uu for uu in u], epizoda),
    }


def nulti_pojas(
    brzina: dict[int, float],
    smjer: dict[int, float],
    plin: dict[int, float],
    samo: set[int],
    kljuc: str,
    ponavljanja: int = 60,
) -> tuple[float, float]:
    """Raspon mjere kad plin s vjetrom nema nikakve veze.

    Plin se vrti u vremenu za višekratnik 24 sata, pa mu dnevni hod ostaje na
    mjestu — inače bi nulti model bio prelagan i sve bi ispalo značajno.

    Returns:
        Par (5. percentil, 95. percentil) mjere pod nultim modelom.
    """
    kljucevi = sorted(plin)
    vrijednosti = [plin[t] for t in kljucevi]
    n = len(kljucevi)
    korak = max(24, (n // ponavljanja // 24) * 24)
    uzorci: list[float] = []
    for i in range(ponavljanja):
        k = ((i + 1) * korak) % n
        pomaknut = {t: vrijednosti[(j + k) % n] for j, t in enumerate(kljucevi)}
        ocjena = ocijeni(brzina, smjer, pomaknut, samo)
        if ocjena:
            uzorci.append(ocjena[kljuc])
    if not uzorci:
        return (0.0, 0.0)
    uzorci.sort()
    return (uzorci[int(len(uzorci) * 0.05)], uzorci[int(len(uzorci) * 0.95)])


def ispisi(naslov: str, plin: dict[int, float], izvori, samo: set[int]) -> None:
    """Ispisuje tablicu ocjena za jedan skup sati."""
    logger.info("\n=== %s (%d sati) ===", naslov, len(samo))
    stupci = None
    for ime, (b, s) in izvori.items():
        ocjena = ocijeni(b, s, plin, samo)
        if not ocjena:
            logger.info("%-26s premalo preklapanja", ime)
            continue
        if stupci is None:
            stupci = list(ocjena)
            logger.info("%-26s%s", "", "".join(f"{k:>20s}" for k in stupci))
        logger.info("%-26s%s", ime, "".join(f"{ocjena[k]:20.3f}" for k in stupci))
        for mjera in ("ρ bez dnevnog hoda", "AUC epizode"):
            donji, gornji = nulti_pojas(b, s, plin, samo, mjera)
            logger.info("%-26s  nulti pojas, %s: %.3f do %.3f", "", mjera, donji, gornji)


def glavno() -> None:
    """Povlači arhivu i ispisuje usporedbu izvora."""
    # Negativna očitanja su šum analizatora oko nule; brisanjem bi ostali samo
    # zagađeniji sati i svaka bi veza izgledala jača nego što jest.
    plin = {t: max(v, 0.0) for t, v in azo_niz(KAREPOVAC, H2S).items()}
    logger.info("H₂S na postaji Karepovac: %d sati", len(plin))

    izvori = ucitaj_izvore()
    zajedno = set(plin)
    for b, s in izvori.values():
        zajedno &= set(b) & set(s)

    raspodjela = sorted(plin.values())
    logger.info(
        "H₂S medijan %.2f, 90. pct %.2f, najviše %.0f µg/m³",
        raspodjela[len(raspodjela) // 2],
        raspodjela[int(len(raspodjela) * 0.9)],
        raspodjela[-1],
    )

    ispisi("svi sati", plin, izvori, zajedno)
    noc = {t for t in zajedno if mjesni_sat(t) >= 21 or mjesni_sat(t) < 6}
    ispisi("noć (21–06), kad se zrak ne miješa", plin, izvori, noc)


if __name__ == "__main__":
    glavno()
