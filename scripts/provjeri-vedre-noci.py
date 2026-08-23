#!/usr/bin/env python3
"""Provjerava nosi li miris niz padinu hladan zrak, a ne vjetar.

Model pretpostavlja da zrak s plohe pokreće vjetar izmjeren na udaljenoj
postaji. Ako je to točno, u satima bez vjetra ne bi se trebalo događati ništa
osobito osim zastoja. Ali postoji druga mogućnost, koju model uopće ne zna
opisati: vedre noći bez vjetra tlo izrači svoju toplinu, zrak uz njega se
ohladi, otežа i **otječe niz padinu sam od sebe**, kao voda. Ploha leži iznad
Dračevca, pa bi tada išla ravno na kuće — bez ikakva vjetra.

Dvije se pretpostavke ovdje razdvajaju, jer daju različita predviđanja:

- **Zastoj.** Zrak stoji, sve se nakuplja. Tada bi uz sumporovodik jednako
  rastao i ugljikov monoksid, kojemu su izvori ceste u samoj nizini.
- **Otjecanje.** Hladan zrak donosi zrak s plohe, koja je iznad. Tada
  sumporovodik raste **više** nego ugljikov monoksid, jer mu izvor nije dolje
  nego gore.

Ključna je usporedba unutar tihih sati: vedro prema oblačno. Naoblaka je ono
što zaustavlja izračivanje, pa ako vedrina ne doda ništa iznad same tišine,
otjecanja nema i nema se što modelirati.

## Nalaz: na ovoj postaji otjecanja nema — a više od toga se odavde ne vidi

Sirove brojke izgledaju uvjerljivo — u tišini je sumporovodika pod vedrim
nebom 1,3× više nego pod oblačnim, merkaptana 2,6×, a nadzorni ugljikov
monoksid se ne miče. Točno kako bi izgledalo da hladan zrak nosi zrak s plohe.

Ali vedre tihe noći nisu jednako raspoređene po godini, a ni ispuštanje s
plohe nije. Kad se vedro i oblačno usporedi **unutar istog mjeseca**, učinak
nestane: omjer padne na 0,88 za sumporovodik i 0,94 za merkaptane, dakle na
ništa, i to na svakoj isprobanoj granici tišine (0,6–2,0 m/s) i vedrine
(10–25 % naoblake). Provjera po smjeru vjetra kaže isto: da hladan zrak
preuzima posao, smjer bi u tihim vedrim noćima prestao biti važan — a raspon
među sektorima ostaje jednak kao po vjetrovitim satima (1,55× prema 1,57×).

Ono što u tablici **jest** stvarno je razlika između tišine i vjetra: medijan
sumporovodika je 1,8 µg/m³ u tihim satima prema 1,1 u vjetrovitima. Zastoj
zraka nosi, vedrina ne.

## Dokle taj nalaz seže

Ranija inačica ovog teksta iz gornjeg je računa izvela da otjecanja **nema**.
To je više nego što se odavde može vidjeti, i sada se zna zašto.

Obje postaje stoje na jednoj točki, a ta točka nije između plohe i kvarta.
Nađena je na terenu (43,516651 / 16,516912, vidi `postaje.py`): udolina
jugoistočno od plohe, prema Kamenu, 676 m od sredine odlagališta na azimutu
140°, na 40 m nadmorske visine — dakle 74 m ispod vrha plohe. Dračevac je s
iste sredine na 282°, Bilice na 286°. Kut između smjera prema postaji i smjera
prema kvartu je 153°: **gotovo suprotne strane odlagališta**.

Hladan zrak ne bira jednu padinu. Ako otječe, otječe niz svaku, i onda su
sjeverozapadna padina (prema Dračevcu) i jugoistočna udolina (prema postaji)
dva odvojena toka. Ovaj račun mjeri drugi od njih. Da na prvom otjecanja ima,
ovoj postaji to ne bi ni na koji način moralo doći do senzora.

Pošteno čitanje je dakle: **u udolini jugoistočno od plohe otjecanje ne
objašnjava ništa iznad samog zastoja zraka.** O sjeverozapadnoj padini, na
kojoj ljudi žive i s koje dolaze prijave, ovaj račun ne govori ni za ni protiv.
Na to pitanje odgovaraju prostorno raspoređene prijave (`odour_reports`) i
motrišta u kvartu — ili, kao zamjena dok njih nema, ugrađivanje katabatičkog
člana u polje vjetra i ponovno bazdarenje nad istim satima (vidi #21).

Skripta ostaje da se nalaz može ponoviti, i da se ne provjerava dvaput.

Pokretanje: `npm run provjeri-vedre-noci`
"""

from __future__ import annotations

import logging
import os
import random
import statistics
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import postaje  # noqa: E402
import vjetar  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

OD, DO = "2024-09-01", "2026-08-17"

MJESNO = ZoneInfo("Europe/Zagreb")

#: Sati koji se broje kao noć, po mjesnom vremenu. Izračivanje počinje nakon
#: zalaska, a hladan sloj je najdublji pred zoru.
NOC = range(21, 24 + 6)

#: Granica tišine, m/s. Iznad ovoga vjetar razbija hladni sloj uz tlo.
TIHO = 1.5

#: Granice naoblake u postotcima: ispod prve je vedro, iznad druge oblačno.
VEDRO, OBLACNO = 25.0, 75.0

#: Tvari koje se gledaju: prve dvije dolaze s plohe, treća je nadzorna.
_VJETROVI: dict[str, tuple[float, float]] = {}

TVARI = (
    ("k1", "H2S", "sumporovodik", True),
    ("k2", "metil+etilmerkaptan", "merkaptani", True),
    ("k2", "Ugljikov monoksid (CO)", "CO (nadzor, izvor u nizini)", False),
)


def _noc_mjesno(kljuc: str) -> bool:
    """Je li taj sat noć po mjesnom vremenu.

    Args:
        kljuc: Vrijeme u UTC-u, ISO 8601 sa `Z`.

    Returns:
        Istina ako sat pada u noćni raspon.
    """
    t = datetime.strptime(kljuc, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
    return t.astimezone(MJESNO).hour in {h % 24 for h in NOC}


def _razred(brzina: float, oblaci: float) -> str | None:
    """Svrstava sat u jedan od četiri razreda; None ako je na granici."""
    tisina = "tiho" if brzina < TIHO else "vjetar" if brzina >= TIHO else None
    nebo = "vedro" if oblaci <= VEDRO else "oblačno" if oblaci >= OBLACNO else None
    return f"{tisina}/{nebo}" if tisina and nebo else None


def _postotak(vrijednosti: list[float], p: float) -> float:
    """Vraća p-ti postotak niza."""
    poredano = sorted(vrijednosti)
    return poredano[min(len(poredano) - 1, int(len(poredano) * p))]


def _permutacija(a: list[float], b: list[float], ponavljanja: int = 5000) -> float:
    """Vjerojatnost da je razlika medijana slučajna.

    Args:
        a: Uzorak prvog razreda.
        b: Uzorak drugog razreda.
        ponavljanja: Broj premetanja.

    Returns:
        Udio premetanja u kojima je razlika bila barem jednako velika.
    """
    stvarna = abs(statistics.median(a) - statistics.median(b))
    zajedno = a + b
    n = len(a)
    slucaj = random.Random(1)
    barem = 0
    for _ in range(ponavljanja):
        slucaj.shuffle(zajedno)
        if abs(statistics.median(zajedno[:n]) - statistics.median(zajedno[n:])) >= stvarna:
            barem += 1
    return barem / ponavljanja


def _po_mjesecima(
    niz: dict[str, float], vedri: list[str], oblacni: list[str]
) -> tuple[float, int]:
    """Uspoređuje vedro i oblačno unutar istog mjeseca.

    Vedre tihe noći nisu jednako raspoređene po godini, a ni ispuštanje s
    plohe nije — toplo tijelo odlagališta ljeti diše jače. Bez uparivanja po
    mjesecu godišnje doba može samo glumiti učinak vedrine.

    Args:
        niz: Satna mjerenja.
        vedri: Ključevi vedrih tihih sati.
        oblacni: Ključevi oblačnih tihih sati.

    Returns:
        Par (medijan omjera po mjesecima, broj usporedivih mjeseci).
    """
    omjeri = []
    mjeseci = {k[:7] for k in vedri} & {k[:7] for k in oblacni}
    for mjesec in sorted(mjeseci):
        v = [niz[k] for k in vedri if k[:7] == mjesec and k in niz]
        o = [niz[k] for k in oblacni if k[:7] == mjesec and k in niz]
        if len(v) >= 5 and len(o) >= 5:
            omjeri.append(statistics.median(v) / max(statistics.median(o), 1e-9))
    return (statistics.median(omjeri) if omjeri else float("nan"), len(omjeri))


def _po_smjeru(niz: dict[str, float], kljucevi: list[str]) -> float:
    """Koliko se medijan mijenja među smjerovima vjetra.

    Ako miris nosi vjetar, smjer mora odlučivati. Ako ga nosi hladan zrak niz
    padinu, smjer slabog vjetra postaje gotovo nevažan — pa raspon među
    sektorima padne.

    Args:
        niz: Satna mjerenja.
        kljucevi: Sati koji ulaze u račun.

    Returns:
        Omjer najvišeg i najnižeg medijana po sektoru od 90°.
    """
    po_sektoru: dict[int, list[float]] = {}
    for k in kljucevi:
        if k in niz and k in _VJETROVI:
            po_sektoru.setdefault(int(_VJETROVI[k][0] // 90) % 4, []).append(niz[k])
    medijani = [statistics.median(v) for v in po_sektoru.values() if len(v) >= 15]
    return max(medijani) / max(min(medijani), 1e-9) if len(medijani) >= 3 else float("nan")


def glavno() -> None:
    """Ispisuje razdiobu po razredima noći, za svaku tvar."""
    global _VJETROVI
    okolnosti = vjetar.uvjeti(OD, DO)
    vjetrovi = vjetar.ucitaj("ldsp", OD, DO)
    _VJETROVI = vjetrovi
    logger.info(
        "okolnosti %d sati, vjetar %d sati; noć = %d–%d h mjesno",
        len(okolnosti), len(vjetrovi), NOC.start, NOC.stop % 24,
    )

    razredi: dict[str, list[str]] = {}
    for kljuc, o in okolnosti.items():
        if not _noc_mjesno(kljuc) or kljuc not in vjetrovi:
            continue
        oblaci = o.get("oblaci")
        if oblaci is None:
            continue
        razred = _razred(vjetrovi[kljuc][1], float(oblaci))
        if razred:
            razredi.setdefault(razred, []).append(kljuc)

    logger.info("")
    for oznaka, tvar, ime, s_plohe in TVARI:
        niz = postaje.satno(oznaka, tvar)
        if not niz:
            logger.info("%s: nema mjerenja", ime)
            continue
        logger.info("%s%s", ime, "" if s_plohe else "")
        logger.info("  razred          sati   medijan     p90")
        srednje: dict[str, float] = {}
        for razred in ("tiho/vedro", "tiho/oblačno", "vjetar/vedro", "vjetar/oblačno"):
            uzorak = [niz[k] for k in razredi.get(razred, []) if k in niz]
            if len(uzorak) < 30:
                logger.info("  %-14s %5d   (premalo)", razred, len(uzorak))
                continue
            srednje[razred] = statistics.median(uzorak)
            logger.info(
                "  %-14s %5d   %7.3f  %6.3f",
                razred, len(uzorak), statistics.median(uzorak), _postotak(uzorak, 0.9),
            )
        if "tiho/vedro" in srednje and "tiho/oblačno" in srednje:
            vedri = [k for k in razredi["tiho/vedro"] if k in niz]
            oblacni = [k for k in razredi["tiho/oblačno"] if k in niz]
            omjer = srednje["tiho/vedro"] / max(srednje["tiho/oblačno"], 1e-9)
            p = _permutacija([niz[k] for k in vedri], [niz[k] for k in oblacni])
            upareno, mjeseci = _po_mjesecima(niz, vedri, oblacni)
            logger.info(
                "  vedro/oblačno u tišini: %.2f× (p = %.3f); upareno po mjesecu "
                "%.2f× iz %d mjeseci",
                omjer, p, upareno, mjeseci,
            )
            tiho_smjer = _po_smjeru(niz, vedri)
            vjetar_smjer = _po_smjeru(
                niz, [k for k in razredi.get("vjetar/vedro", []) if k in niz]
            )
            logger.info(
                "  raspon među smjerovima: tihe vedre noći %.2f×, vjetrovite %.2f×",
                tiho_smjer, vjetar_smjer,
            )
        logger.info("")


if __name__ == "__main__":
    glavno()
