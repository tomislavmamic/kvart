#!/usr/bin/env python3
"""Godišnja slika raspršenja s Karepovca, bazdarena na mjerenjima.

Ovo je kvantitativni dio: koliko često zrak s plohe prijeđe preko kojeg dijela
kvarta i koliko tada donese. Prikaz dima na stranici (`izvedi-polje-dima.py`)
nosi samo geometriju jednog slučaja vremena; ovdje je cijela godina.

Račun ide kroz `oblacici.py` — nestacionarni Lagrangeov model s pamćenjem, sat
po sat, s izmjerenim vjetrom iz onog izvora koji je bazdarenje odabralo kao
najbolji. Jačina izvora nije
pretpostavljena nego izračunata unatrag iz 13 791 sata H₂S-a na postaji uz
plohu (`bazdari-izvor.py`), zajedno s rasponom pouzdanosti.

Izlaze dvije stvari, i razlikuju se po tome koliko im se smije vjerovati:

- **Koliko sati godišnje zrak s plohe prijeđe preko svake točke.** Ovo ne ovisi
  o jačini izvora nego samo o vjetru i geometriji širenja, a oboje je
  provjereno: smjer prema ruži H₂S-a na postaji, razrjeđenje prema ozonu, koji
  s Karepovca ne dolazi. Ovo je najpouzdanija brojka koju model daje.
- **Koncentracija H₂S-a.** Bazdarena je, ali nosi raspon od šest puta i vrijedi
  samo za H₂S. Miris nose i merkaptani, koji su po jedinici mase stotinama puta
  jači, a njih model ne pogađa — vidi ocjenu u `bazdari-izvor.py`. Zato se ovo
  ne smije predstaviti kao karta mirisa.

Pokretanje: `npm run izvedi-raspesenje`
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import oblacici  # noqa: E402
import vjetar  # noqa: E402
from reljef_polje import RASPRSENJE, maska_plohe  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
BAZDARENJE = KORIJEN / "src" / "generated" / "karepovac-bazdarenje.ts"
IZLAZ = KORIJEN / ".cache" / "raspesenje.npz"

GODINA = 2025


#: Kad je koncentracija u točki iznad ovog udjela prosjeka na samoj plohi,
#: broji se da je točka toga sata bila u perjanici. Mjerilo je omjer, pa ne
#: ovisi o jačini izvora — a jačina izvora je ono što najmanje znamo.
UDIO_PRELASKA = 0.1

#: Razine H₂S-a za koje se broje sati, u µg/m³. Sredina je donji rub raspona
#: koji literatura navodi kao prag ljudskog njuha za H₂S.
RAZINE = (0.2, 0.7, 2.0)


def _bazdarenje() -> dict:
    """Čita bazdarenje iz generiranog modula.

    Returns:
        Rječnik s emisijom i odabranim izvorom vjetra.

    Raises:
        SystemExit: Ako bazdarenje nije izvedeno.
    """
    if not BAZDARENJE.exists():
        sys.exit("Prvo pokreni `npm run bazdari-izvor`.")
    tekst = BAZDARENJE.read_text(encoding="utf8")
    return json.loads(tekst[tekst.index("{") : tekst.rindex("}") + 1])


def glavno() -> None:
    """Prolazi godinu sat po sat i sprema godišnja polja."""
    bazdareno = _bazdarenje()
    donja, srednja, gornja = (float(x) for x in bazdareno["emisijaUgS"])
    # Izvor vjetra se ne bira ovdje nego se preuzima iz bazdarenja, koje ga je
    # odabralo mjerenjem — po tome koliko dobro kroz model objašnjava izmjereni
    # H₂S uz plohu. Prije je ovdje stajalo ime napisano rukom, i razišlo se:
    # godišnja slika građena je na izvoru koji kroz model postiže negativnu
    # korelaciju, dok je bazdarenje odabralo drugi.
    izvor_vjetra = str(bazdareno["vjetar"])
    maska = maska_plohe(RASPRSENJE)
    yi, xi = np.nonzero(maska)
    tocke = np.stack(
        [RASPRSENJE.x0 + (xi + 0.5) * RASPRSENJE.dx,
         RASPRSENJE.y1 - (yi + 0.5) * RASPRSENJE.dx], 1
    )
    logger.info(
        "ploha %.1f ha; emisija %.2f mg/s (%.2f–%.2f); vjetar %s",
        maska.sum() * RASPRSENJE.dx**2 / 1e4, srednja / 1e3, donja / 1e3, gornja / 1e3,
        izvor_vjetra,
    )

    okolnosti = vjetar.uvjeti(f"{GODINA}-01-01", f"{GODINA}-12-31")
    vjetrovi = vjetar.ucitaj(izvor_vjetra, f"{GODINA}-01-01", f"{GODINA}-12-31")
    sati = oblacici.slozi_sate(vjetrovi, okolnosti)
    logger.info("godina %d: %d sati s vjetrom i graničnim slojem", GODINA, len(sati))

    zbroj = np.zeros((RASPRSENJE.ny, RASPRSENJE.nx))
    najvise = np.zeros_like(zbroj)
    prelasci = np.zeros_like(zbroj)
    iznad = {razina: np.zeros_like(zbroj) for razina in RAZINE}
    for broj, (_, polje) in enumerate(
        oblacici.prodji(sati, tocke, srednja, RASPRSENJE), 1
    ):
        zbroj += polje
        najvise = np.maximum(najvise, polje)
        na_plohi = float(polje[maska].mean())
        if na_plohi > 0:
            prelasci += polje > UDIO_PRELASKA * na_plohi
        for razina in RAZINE:
            iznad[razina] += polje > razina
        if broj % 2000 == 0:
            logger.info("  %d/%d sati", broj, len(sati))

    n = max(len(sati), 1)
    prosjek = zbroj / n
    # Zračna luka ne javlja svaki sat, pa se brojevi sati preračunavaju na
    # punu godinu. Preračun pretpostavlja da su sati bez javljanja jednaki
    # onima s javljanjem, što nije sasvim točno, ali je bolje od prešućivanja.
    na_godinu = 8760.0 / n

    np.savez_compressed(
        IZLAZ,
        prosjek=prosjek,
        najvise=najvise,
        prelasci=prelasci,
        maska=maska,
        emisija=np.array([donja, srednja, gornja]),
        sati=np.array([n]),
        na_godinu=np.array([na_godinu]),
        **{f"iznad_{razina}": iznad[razina] for razina in RAZINE},
    )

    logger.info(
        "\nprosječni doprinos H₂S-a: na plohi %.3f, najviše izvan plohe %.3f µg/m³",
        float(prosjek[maska].mean()), float(prosjek[~maska].max()),
    )
    logger.info(
        "najviši satni doprinos izvan plohe: %.2f µg/m³", float(najvise[~maska].max())
    )
    for razina in RAZINE:
        izvan = iznad[razina][~maska] * na_godinu
        logger.info(
            "  iznad %.1f µg/m³: najviše %d h/god, na %.1f %% obuhvata više od 10 h",
            razina, int(izvan.max()), 100 * float((izvan > 10).mean()),
        )
    u_perjanici = prelasci[~maska] * na_godinu
    logger.info(
        "\ntočka je u perjanici: medijan %.0f h/god, najviše %.0f h/god",
        float(np.median(u_perjanici)), float(u_perjanici.max()),
    )
    logger.info("udio obuhvata iznad 500 h/god: %.1f %%", 100 * float((u_perjanici > 500).mean()))
    logger.info("spremljeno %s", IZLAZ.relative_to(KORIJEN))


if __name__ == "__main__":
    glavno()
