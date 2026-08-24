#!/usr/bin/env python3
"""Bazdarenje izvora i poštena ocjena modela prema mjerenjima s postaje.

Do sada je jačina izvora bila pretpostavka iz literature (3 ouE/m²/s) i sve je
u računu skaliralo s njom pravocrtno. Na rubu plohe stoje dvije godine satnog
H₂S-a, pa se ista brojka može izračunati unatrag — ali samo ako model uopće
ima veze sa stvarnošću. Zato ovaj račun ima tri dijela, i drugi je najvažniji.

**1. Bazdarenje.** Model se pusti s jediničnom emisijom i za svaki sat se očita
vrijednost na mjestu postaje. Regresija izmjerenoga na modelirano daje nagib —
to je jačina izvora — i odsječak, koji je pozadinski H₂S iz svega ostaloga.
Odsječak je ovdje bitan: bez njega bi se cijela pozadina pripisala plohi i
izvor bi ispao desetak puta jači nego što jest.

Pouzdanost se računa ponovnim uzorkovanjem po danima, ne po satima. Satne
vrijednosti unutar dana nisu nezavisne, pa bi uzorkovanje po satima dalo lažno
uzak raspon.

**2. Ocjena.** Ista se modelirana vrijednost usporedi s nizom tvari koje postaje
mjere. Ozon i ugljikov monoksid nisu s Karepovca — oni ovise samo o tome koliko
se zrak miješa. Ako model dobro pogađa njih, njegov dio o razrjeđenju valja.
Ako uz to loše pogađa merkaptane i H₂S, onda ono što ne valja nije fizika nego
pretpostavka o izvoru. Ta se razlika ne vidi ni iz čega osim iz ovakve provjere.

**3. Usporedba izvedbi.** Tri izvora vjetra i model sa i bez pamćenja, da se
vidi koliko koji zahvat doista donosi.

## Ograda koju treba pročitati prije svake brojke odavde

Prijemnik je jedan, i nije na strani na kojoj ljudi žive. Postaja stoji 676 m
jugoistočno od težišta plohe, na azimutu 140°, u udolini prema Kamenu na 40 m
nadmorske visine — 74 m ispod vrha odlagališta. Dračevac je na 293°, Bilice na
290°: kut između smjera prema postaji i smjera prema kvartu je 150–153°.

Bazdarenje zato mjeri jačinu izvora kroz sate u kojima zrak s plohe ide na
**suprotnu** stranu od one koja nas zanima. To ne čini račun besmislenim —
jačina izvora ne ovisi o strani — ali čini ocjenu slijepom za pola pitanja:
model koji dobro pogađa jugoistočnu udolinu, a promašuje sjeverozapadnu
padinu, ovdje bi izgledao jednako kao model koji pogađa oboje.

Koordinata je do kolovoza 2026. bila zaokružena na tri decimale (43,516 /
16,517), dakle netočna 72 m. Ponovni račun s točkom nađenom na terenu:
Spearman 0,134 → 0,128, AUC 0,577 → 0,573, jačina izvora 2076 → 1822 µg S/s.
Dakle nije se popravilo ništa mjerljivo — što i jest nalaz: ono što ovdje
nedostaje nije stotinjak metara, nego drugi prijemnik.

## Ugađanje fizike i zaštita od preugađanja (kolovoz 2026.)

Postaja stoji u udolini, 74 m ispod vrha plohe, a stari je model i pri
tišini cijelu perjanicu slao za smjerom s anemometara 4–16 km daleko — pa je
na drugoj godini mjerenja imao Spearman ≈ 0. Vrtloženje po razredu
stabilnosti (`oblacici.K_PO_RAZREDU`) to popravlja; meandar smjera i
drenaža niz padinu isprobani su i odbačeni (ne dodaju ništa povrh
vrtloženja). Cijeli je izbor rađen na prvoj godini i provjeren na drugoj.

Zato se i ovdje najbolja izvedba **bira po drugoj godini** (`REZ`), ne po
cijelom razdoblju: zračna luka je na prvoj godini imala Spearman 0,25, na
drugoj 0,07 — izbor po cijelom razdoblju uzeo bi baš nju, dakle izvedbu
koja se izvan uzorka raspala. Regresija jačine izvora ide na svim satima
odabrane izvedbe, jer nagib nije biran po tim podacima.

Pokretanje: `npm run bazdari-izvor`
"""

from __future__ import annotations

import json
import logging
import math
import os
import statistics
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import oblacici  # noqa: E402
import postaje  # noqa: E402
import vjetar  # noqa: E402
from reljef_polje import RASPRSENJE, maska_plohe  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-bazdarenje.ts"

OD, DO = "2024-09-01", "2026-08-17"
#: Rez ugađanje/provjera: fizika je ugođena na satima prije ovog dana, pa je
#: ocjena na satima poslije njega jedina koja ne laska modelu.
REZ = "2025-09-01"
#: Tvar po kojoj se bazdari: mjeri se na postaji uz plohu i dolazi s odlagališta.
TVAR, POSTAJA = "H2S", "k1"

#: Tvari koje pokazuju koliko se zrak miješa, a ne što odlagalište ispušta.
#: Ozon se pri tlu troši i najniži je kad zrak stoji, pa se očekuje negativna
#: veza; ugljikov monoksid dolazi iz prometa i tada se nakuplja.
KONTROLNE = (("k2", "Ozon (O3)"), ("k2", "Ugljikov monoksid (CO)"),
             ("k2", "metil+etilmerkaptan"), ("k1", "NH3"))

#: Koliko puta se ponavlja uzorkovanje po danima.
PONAVLJANJA = 400

#: Izvori vjetra koji prolaze kroz cijeli model. Ruža u `provjeri-vjetar.py`
#: već ih rangira bez modela i mnogo jeftinije; kroz model idu samo tri koja
#: nose zaključak — preračun, najbolje pojedinačno mjerenje, i spoj.
KROZ_MODEL = ("era5", "ldsp", "spoj")

#: Prag ljudskog njuha za H₂S u µg/m³. Literatura daje raspon i on se nosi
#: dalje u svaki prijevod iz mase u mirisne jedinice.
PRAG_NJUHA = (0.7, 7.0)


def _mjesto_postaje(oznaka: str) -> tuple[float, float]:
    """Vraća položaj postaje u HTRS96/TM.

    Args:
        oznaka: Oznaka postaje, `k1` ili `k2`.

    Returns:
        Par (istok, sjever) u metrima.
    """
    from osgeo import osr

    izvor = osr.SpatialReference()
    izvor.ImportFromEPSG(4326)
    izvor.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    cilj = osr.SpatialReference()
    cilj.ImportFromEPSG(3765)
    cilj.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    p = next(p for p in postaje.POSTAJE if p.oznaka == oznaka)
    x, y, _ = osr.CoordinateTransformation(izvor, cilj).TransformPoint(p.lon, p.lat)
    return x, y


def _rangovi(niz: np.ndarray) -> np.ndarray:
    """Vraća rangove s prosjekom za izjednačene vrijednosti."""
    poredak = np.argsort(niz, kind="stable")
    rang = np.empty(len(niz))
    poredani = niz[poredak]
    i = 0
    while i < len(poredani):
        j = i
        while j + 1 < len(poredani) and poredani[j + 1] == poredani[i]:
            j += 1
        rang[poredak[i : j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return rang


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    """Spearmanov koeficijent korelacije rangova."""
    ra, rb = _rangovi(np.asarray(a, float)), _rangovi(np.asarray(b, float))
    ra, rb = ra - ra.mean(), rb - rb.mean()
    dolje = math.sqrt(float((ra**2).sum() * (rb**2).sum()))
    return float((ra * rb).sum() / dolje) if dolje else float("nan")


def auc_vrha(model: np.ndarray, mjereno: np.ndarray, udio: float = 0.1) -> float:
    """Vjerojatnost da model najgorem satu da veću vrijednost nego običnom.

    Args:
        model: Modelirane vrijednosti.
        mjereno: Izmjerene vrijednosti.
        udio: Koji gornji udio sati se smatra „najgorim”.

    Returns:
        Broj između 0 i 1; 0,5 znači da model o tome ne zna ništa.
    """
    model, mjereno = np.asarray(model, float), np.asarray(mjereno, float)
    prag = float(np.quantile(mjereno, 1 - udio))
    gornji = mjereno > prag
    if not gornji.any() or gornji.all():
        return float("nan")
    rang = _rangovi(model)
    n1, n0 = int(gornji.sum()), int((~gornji).sum())
    return float((rang[gornji].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def nagib_i_odsjecak(
    x: np.ndarray, y: np.ndarray, dani: np.ndarray, sjeme: int = 3
) -> tuple[float, float, float, float]:
    """Regresija izmjerenoga na modelirano, s rasponom po danima.

    Args:
        x: Modelirane vrijednosti uz jediničnu emisiju.
        y: Izmjerene koncentracije, u µg/m³.
        dani: Dan svakog sata, radi ponovnog uzorkovanja po danima.
        sjeme: Sjeme slučajnih brojeva.

    Returns:
        Četvorka (nagib, odsječak, donja i gornja granica nagiba).
    """
    def _rijesi(i: np.ndarray) -> tuple[float, float]:
        a = np.vstack([x[i], np.ones(len(i))]).T
        rjesenje = np.linalg.lstsq(a, y[i], rcond=None)[0]
        return float(rjesenje[0]), float(rjesenje[1])

    svi = np.arange(len(x))
    nagib, odsjecak = _rijesi(svi)

    rng = np.random.default_rng(sjeme)
    jedinstveni = np.unique(dani)
    po_danu = {d: np.nonzero(dani == d)[0] for d in jedinstveni}
    uzorci = []
    for _ in range(PONAVLJANJA):
        izbor = rng.choice(jedinstveni, len(jedinstveni))
        uzorci.append(_rijesi(np.concatenate([po_danu[d] for d in izbor]))[0])
    donja, gornja = np.percentile(uzorci, [2.5, 97.5])
    return nagib, odsjecak, float(donja), float(gornja)


def _tocke_izvora() -> tuple[np.ndarray, float]:
    """Vraća točke izvora na rešetci i površinu plohe u m²."""
    maska = maska_plohe(RASPRSENJE)
    yi, xi = np.nonzero(maska)
    tocke = np.stack(
        [RASPRSENJE.x0 + (xi + 0.5) * RASPRSENJE.dx,
         RASPRSENJE.y1 - (yi + 0.5) * RASPRSENJE.dx], 1
    )
    return tocke, float(maska.sum()) * RASPRSENJE.dx**2


def _niz_modela(
    izvor_vjetra: str, pamcenje: bool, okolnosti: dict, tocke: np.ndarray,
    mjesto: tuple[float, float], ugodba: oblacici.Ugodba | None = None,
) -> dict[str, float]:
    """Modelirani satni niz na mjestu postaje, uz jediničnu emisiju."""
    sati = oblacici.slozi_sate(vjetar.ucitaj(izvor_vjetra, OD, DO), okolnosti)
    prijemnici = np.array([mjesto])
    return {
        sat.t: float(v[0])
        for sat, v in oblacici.prodji(
            sati, tocke, 1.0, RASPRSENJE, prijemnici=prijemnici,
            pamcenje=pamcenje, ugodba=ugodba,
        )
    }


def _ocjene(
    niz: dict[str, float], mjereno: dict[str, float]
) -> dict[str, float | int]:
    """Spearman i AUC na svim satima te odvojeno prije i poslije `REZ`."""
    zajedno = sorted(set(niz) & set(mjereno))
    ocjene: dict[str, float | int] = {"sati": len(zajedno)}
    dijelovi = {
        "": zajedno,
        "Ugadjanje": [t for t in zajedno if t[:10] < REZ],
        "Provjera": [t for t in zajedno if t[:10] >= REZ],
    }
    for ime, ts in dijelovi.items():
        x = np.array([niz[t] for t in ts])
        y = np.array([mjereno[t] for t in ts])
        ocjene[f"spearman{ime}"] = round(spearman(x, y), 4)
        ocjene[f"auc{ime}"] = round(auc_vrha(x, y), 4)
    return ocjene


def _mjerenja(oznaka: str, tvar: str) -> dict[str, float]:
    """Satna mjerenja jedne tvari, bez mjeseci u kojima uređaj nije mjerio.

    Probir nije kozmetika. Bez njega u regresiju uđe šest mjeseci u kojima
    analizator stoji na granici određivanja — stotine sati u kojima mjerenje
    ne ovisi ni o vjetru ni o čemu drugom. To ne doda šum oko pravog nagiba
    nego ga povuče prema nuli i raširi raspon pouzdanosti.
    """
    return postaje.satno(oznaka, tvar)


def glavno() -> None:
    """Ocjenjuje izvedbe modela i računa jačinu izvora iz mjerenja."""
    tocke, ploha = _tocke_izvora()
    mjesto = _mjesto_postaje(POSTAJA)
    okolnosti = vjetar.uvjeti(OD, DO)
    mjereno = _mjerenja(POSTAJA, TVAR)
    sirovo = postaje.satno(POSTAJA, TVAR, probrano=False)
    logger.info(
        "ploha izvora %.1f ha; postaja na %.0f, %.0f; %s: %d sati od %d "
        "(izbačeno %d mjeseci u kojima uređaj nije mjerio)",
        ploha / 1e4, *mjesto, TVAR, len(mjereno), len(sirovo),
        len({t[:7] for t in sirovo}) - len({t[:7] for t in mjereno}),
    )

    logger.info(
        "\n%-14s %-9s %9s %9s %10s %10s %8s",
        "vjetar", "pamćenje", "Spearman", "AUC vrha", "ρ-provj.", "AUC-provj.",
        "sati",
    )
    izvedbe: dict[tuple[str, bool], tuple[dict[str, float], dict]] = {}
    najbolja, najbolja_ocjena = None, -2.0
    stara = oblacici.Ugodba(k_vrtlozenje=(oblacici.K_VRTLOZENJE,) * 6)
    prolazi = [(iv, p, None) for iv in KROZ_MODEL for p in (True, False)]
    # Stara fizika kao usporedba, na spojenom vjetru — da razlika koju je
    # ugađanje donijelo ostane zapisana uz brojke, a ne samo u povijesti.
    prolazi.append(("spoj", True, stara))
    for izvor_vjetra, pamcenje, ugodba in prolazi:
        niz = _niz_modela(izvor_vjetra, pamcenje, okolnosti, tocke, mjesto, ugodba)
        o = _ocjene(niz, mjereno)
        kljuc = izvor_vjetra if ugodba is None else f"{izvor_vjetra}-staro"
        izvedbe[(kljuc, pamcenje)] = (niz, o)
        logger.info(
            "%-14s %-9s %9.3f %9.3f %10.3f %10.3f %8d",
            kljuc, "da" if pamcenje else "ne", o["spearman"], o["auc"],
            o["spearmanProvjera"], o["aucProvjera"], o["sati"],
        )
        # Bira se po drugoj godini: fizika je ugođena na prvoj, pa samo druga
        # govori kako model radi na podacima koje nije vidio. Stara fizika ne
        # ulazi u izbor — ona je tu za usporedbu.
        if ugodba is None and o["spearmanProvjera"] > najbolja_ocjena:
            najbolja_ocjena, najbolja = float(o["spearmanProvjera"]), (kljuc, pamcenje)

    niz, o = izvedbe[najbolja]
    rho, auc, sati = float(o["spearman"]), float(o["auc"]), int(o["sati"])
    logger.info(
        "\nnajbolja izvedba (po provjeri): vjetar %s, pamćenje %s", najbolja[0],
        "da" if najbolja[1] else "ne",
    )

    logger.info("\nprovjera na tvarima koje nisu s odlagališta:")
    kontrola = {}
    for oznaka, tvar in KONTROLNE:
        drugo = _mjerenja(oznaka, tvar)
        zajedno = sorted(set(niz) & set(drugo))
        if len(zajedno) < 3000:
            continue
        x = np.array([niz[t] for t in zajedno])
        y = np.array([drugo[t] for t in zajedno])
        kontrola[f"{oznaka} {tvar}"] = spearman(x, y)
        logger.info("  %-26s Spearman %+.3f (%d sati)", tvar, kontrola[f"{oznaka} {tvar}"], len(zajedno))

    zajedno = sorted(set(niz) & set(mjereno))
    x = np.array([niz[t] for t in zajedno])
    y = np.array([mjereno[t] for t in zajedno])
    dani = np.array([t[:10] for t in zajedno])
    nagib, odsjecak, donja, gornja = nagib_i_odsjecak(x, y, dani)

    logger.info("\nbazdarenje na %d sati %s:", len(zajedno), TVAR)
    logger.info("  pozadina (odsječak)  %.2f µg/m³", odsjecak)
    logger.info(
        "  emisija H₂S s plohe  %.1f mg/s  (95 %%: %.1f–%.1f)",
        nagib / 1e3, donja / 1e3, gornja / 1e3,
    )
    logger.info(
        "  po četvornom metru   %.4f µg/m²/s  (95 %%: %.4f–%.4f)",
        nagib / ploha, donja / ploha, gornja / ploha,
    )
    for prag in PRAG_NJUHA:
        logger.info(
            "  pri pragu njuha %.1f µg/m³ → %.3f ouE/m²/s (95 %%: %.3f–%.3f)",
            prag, nagib / ploha / prag, donja / ploha / prag, gornja / ploha / prag,
        )

    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(
        "// Generirano iz mjerenja postaje Karepovac 1 i modela raspršenja.\n"
        "// Pokretanje: npm run bazdari-izvor — ne uređivati ručno.\n"
        "\n"
        "export const BAZDARENJE = "
        + json.dumps(
            {
                "od": OD,
                "do": DO,
                "rez": REZ,
                "tvar": TVAR,
                "postaja": POSTAJA,
                "vjetar": najbolja[0],
                "pamcenje": najbolja[1],
                "sati": sati,
                "spearman": round(rho, 4),
                "auc": round(auc, 4),
                "spearmanProvjera": o["spearmanProvjera"],
                "aucProvjera": o["aucProvjera"],
                "pozadina": round(odsjecak, 3),
                "emisijaUgS": [round(donja, 1), round(nagib, 1), round(gornja, 1)],
                "plohaM2": round(ploha),
                "pragNjuha": list(PRAG_NJUHA),
                "kontrola": {k: round(v, 4) for k, v in kontrola.items()},
                "izvedbe": {
                    f"{i}-{'pamti' if p else 'bez'}": ocjene
                    for (i, p), (_, ocjene) in izvedbe.items()
                },
            },
            ensure_ascii=False,
            indent=2,
        )
        + " as const;\n",
        encoding="utf8",
    )
    logger.info("\nspremljeno %s", IZLAZ.relative_to(KORIJEN))


if __name__ == "__main__":
    glavno()
