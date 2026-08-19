#!/usr/bin/env python3
"""Široka karta raspršenja: cijelo područje koje model računa, ne samo kvart.

Sve dosadašnje kartice stoje u okviru kvarta (`scripts/okvir.py`), jer je kvart
ono o čemu stranica govori. Godišnji račun raspršenja, međutim, ide preko
znatno šireg obuhvata — perjanica koja izađe iz kvarta ne prestaje postojati,
a i ono što odlazi mimo kuća dio je odgovora. Ova karta pokriva cijeli taj
obuhvat, 4,8 × 3,6 km.

Podloga je sjenčani reljef iz DGU-ova LiDAR-a, a ne ceste ili zgrade. Razlog je
sadržajan: reljef je ono što perjanicu skreće, pa je na karti raspršenja
najkorisnija podloga upravo on. Ceste se crtaju preko njega dokle sloj seže
(`ceste-sve.geojson` ne pokriva istočni rub obuhvata, iza plohe).

Iz istog se računa izvode dvije veličine slika. **Široka** pokriva cijeli
obuhvat i ide na `/karta`, gdje se po njoj može hodati. **Kvartovska** stoji u
okviru svih ostalih kartica na `/karepovac` i služi samo za pogled — jer kad bi
se u istom prebacivaču okvir mijenjao između pogleda, čitatelj bi izgubio gdje
je. Nepomična je namjerno: podatak nije toliko točan da bi zasluživao
razgledavanje, a tko ga želi razgledati, ide na kartu.

Ljestvice im nisu iste, i to namjerno. Široka ide od nule, jer njezin obuhvat
doista dopire do mjesta kamo zrak s plohe gotovo nikad ne stigne. Kvartovska
se rasteže između najmanje i najveće vrijednosti *u okviru*: unutar kvarta
ništa nije blizu nule — najmanje je oko 360 sati godišnje — pa bi ljestvica od
nule cijeli okvir obojila i perjanica se ne bi vidjela kao perjanica.

Zato kvartovska slika mora uza se nositi svoje rubove, i stranica ih ispisuje:
blijedi kraj ljestvice ovdje ne znači „ništa”, nego „i dalje 360 sati”. Bez
toga bi rastezanje ljepše izgledalo, a govorilo neistinu.

Slike se pišu u `public/`, ne u generirani modul: sjenčanje i polja su rasteri
od nekoliko stotina kilobajta i nemaju što tražiti u snopu koji preglednik
mora pročitati prije prvog crtanja. Iz istog razloga se i ceste crtaju u
podlogu, a ne šalju kao putanje — pet tisuća crta u snopu stoji pola megabajta,
a u slici ne stoji gotovo ništa.

Pokretanje: `npm run izvedi-siru-kartu`
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import okvir  # noqa: E402
from reljef_polje import RASPRSENJE, Obuhvat, _pretvorba, gladi, ucitaj_reljef  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
RACUN = KORIJEN / ".cache" / "raspesenje.npz"
SLIKE = KORIJEN / "public" / "karepovac"
MODUL = KORIJEN / "src" / "generated" / "karepovac-siri.ts"

#: Korak slike u metrima. Pet metara daje 960 × 720 — dovoljno da se pri
#: povećanju vide terase i usjeci, a da slika ostane ispod pola megabajta.
KORAK = 5.0

#: Sjenčanje: sunce sa sjeverozapada, uobičajeno za karte jer se pod drugim
#: kutom reljef oku izvrne — brda izgledaju kao doline.
AZIMUT, VISINA_SUNCA, PRETJERANOST = 315.0, 45.0, 1.6

#: Ljestvica polja: prozirno pri dnu, pa žuto, narančasto, tamnocrveno.
LJESTVICA = (
    (0.00, (253, 237, 199), 0.0),
    (0.20, (250, 214, 137), 0.45),
    (0.45, (233, 156, 66), 0.62),
    (0.72, (183, 84, 42), 0.74),
    (1.00, (94, 27, 22), 0.86),
)

SLOJEVI = (
    {
        "kljuc": "sati",
        "naziv": "Koliko sati godišnje",
        "opis": "Koliko je sati godišnje točka bila u perjanici s plohe. Ne ovisi o jačini izvora, nego samo o vjetru i širenju — i zato je najpouzdanije što model daje. U kvartu nijedno mjesto nije blizu nule: i ondje gdje je najbljeđe, zrak s plohe prijeđe nekoliko stotina sati godišnje.",
        "polje": "prelasci",
        "godisnje": True,
        "vrh": 8760.0,
        "jedinica": "h/god",
    },
    {
        "kljuc": "prosjek",
        "naziv": "Prosječni doprinos H₂S-a",
        "opis": "Prosječna koncentracija sumporovodika koju plohа dodaje na zatečeno stanje. Bazdareno na mjerenjima, ali raspon je širok i vrijedi samo za H₂S — merkaptane, koje nos zapravo prepoznaje, model ne pogađa.",
        "polje": "prosjek",
        "godisnje": False,
        "vrh": None,
        "jedinica": "µg/m³",
    },
)

OBRISI = (
    ("ploha", "karepovac", "#18181b", 2.0),
    ("kvart", "granica", "#007956", 2.0),
)


def _obuhvat() -> Obuhvat:
    """Obuhvat slike: isti prostor kao račun, samo sitniji korak."""
    return Obuhvat(
        RASPRSENJE.x0, RASPRSENJE.y0, RASPRSENJE.x1, RASPRSENJE.y1, KORAK
    )


def _granice_wgs84(obuhvat: Obuhvat) -> dict[str, float]:
    """Vraća rubove obuhvata u WGS84, da karta zna gdje stoji."""
    from osgeo import osr

    izvor = osr.SpatialReference()
    izvor.ImportFromEPSG(3765)
    izvor.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    cilj = osr.SpatialReference()
    cilj.ImportFromEPSG(4326)
    cilj.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(izvor, cilj)
    uglovi = [
        tr.TransformPoint(x, y)[:2]
        for x in (obuhvat.x0, obuhvat.x1)
        for y in (obuhvat.y0, obuhvat.y1)
    ]
    lon = [t[0] for t in uglovi]
    lat = [t[1] for t in uglovi]
    return {
        "zapad": round(min(lon), 6),
        "jug": round(min(lat), 6),
        "istok": round(max(lon), 6),
        "sjever": round(max(lat), 6),
    }


def sjencanje(obuhvat: Obuhvat) -> Image.Image:
    """Računa sjenčani reljef nad obuhvatom, s cestama urisanima u njega.

    Args:
        obuhvat: Obuhvat i korak slike.

    Returns:
        Sliku podloge u boji, oblika (ny, nx).
    """
    z = gladi(ucitaj_reljef(obuhvat), 1) * PRETJERANOST
    dy, dx = np.gradient(z, obuhvat.dx)
    nagib = np.arctan(np.hypot(dx, dy))
    # Ekspozicija: `dy` raste prema jugu jer redak raste prema jugu.
    ekspozicija = np.arctan2(-dy, dx)
    a = np.radians(90.0 - AZIMUT)
    v = np.radians(VISINA_SUNCA)
    sjena = np.sin(v) * np.cos(nagib) + np.cos(v) * np.sin(nagib) * np.cos(
        a - ekspozicija
    )
    # Stisnuto u svijetli raspon: podloga, ne prizor. Preko nje ide polje, pa
    # tamno sjenčanje pojede boju kojom se čita rezultat.
    sivo = np.clip(0.62 + 0.38 * sjena, 0, 1)
    # Ostaje u sivim tonovima: podloga nema boju, pa je RGB troši trostruko.
    slika = Image.fromarray((sivo * 255).astype(np.uint8), "L")

    crtac = ImageDraw.Draw(slika)
    for d in putanje("ceste-sve", obuhvat):
        tocke = _tocke(d)
        crtac.line(tocke, fill=255, width=2)
        crtac.line(tocke, fill=120, width=1)
    return slika


def _tocke(d: str) -> list[tuple[float, float]]:
    """Vraća točke SVG putanje; potrebno je samo za crtanje u raster."""
    return [
        (float(par.split(" ")[0]), float(par.split(" ")[1]))
        for par in d.lstrip("M").rstrip("Z").split(" L")
    ]


def _ljestvica() -> np.ndarray:
    """Razvija ljestvicu u tablicu od 256 boja s prozirnošću."""
    tablica = np.zeros((256, 4), np.uint8)
    for i in range(256):
        u = i / 255
        for (a, boja_a, p_a), (b, boja_b, p_b) in zip(LJESTVICA, LJESTVICA[1:]):
            if a <= u <= b:
                t = (u - a) / (b - a)
                tablica[i, :3] = [
                    round(boja_a[k] + (boja_b[k] - boja_a[k]) * t) for k in range(3)
                ]
                tablica[i, 3] = round((p_a + (p_b - p_a) * t) * 255)
                break
        else:
            tablica[i, :3] = LJESTVICA[-1][1]
            tablica[i, 3] = round(LJESTVICA[-1][2] * 255)
    return tablica


def _uvecaj(polje: np.ndarray, ny: int, nx: int) -> np.ndarray:
    """Dvolinearno uvećava polje računa na rešetku slike."""
    yi = np.linspace(0, polje.shape[0] - 1, ny)
    xi = np.linspace(0, polje.shape[1] - 1, nx)
    y0 = np.clip(yi.astype(int), 0, polje.shape[0] - 2)
    x0 = np.clip(xi.astype(int), 0, polje.shape[1] - 2)
    ty = (yi - y0)[:, None]
    tx = (xi - x0)[None, :]
    a = polje[np.ix_(y0, x0)]
    b = polje[np.ix_(y0, x0 + 1)]
    c = polje[np.ix_(y0 + 1, x0)]
    d = polje[np.ix_(y0 + 1, x0 + 1)]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def sloj_polja(
    polje: np.ndarray, vrh: float, obuhvat: Obuhvat, tablica: np.ndarray
) -> Image.Image:
    """Pretvara jedno polje računa u prozirni sloj nad podlogom."""
    veliko = _uvecaj(polje, obuhvat.ny, obuhvat.nx)
    # Korijen: raspon je nekoliko redova veličine, pa bi pravocrtna ljestvica
    # sve osim same plohe ostavila praznim.
    u = np.clip(np.sqrt(np.clip(veliko, 0, None) / max(vrh, 1e-12)), 0, 1)
    return Image.fromarray(tablica[(u * 255).astype(np.uint8)], "RGBA")


def u_okvir_kvarta(polje: np.ndarray, povecanje: int = 2) -> np.ndarray:
    """Uzorkuje polje računa u okvir kartica na `/karepovac`.

    Args:
        polje: Polje na rešetci računa.
        povecanje: Koliko puta gušće od okvira u pikselima.

    Returns:
        Polje oblika (visina, širina) u pikselima okvira.
    """
    tr = _pretvorba()
    sirina = int(okvir.SIRINA) * povecanje
    visina = int(round(okvir.VISINA)) * povecanje
    lon = okvir.ZAPAD + (np.arange(sirina) + 0.5) / sirina * (
        okvir.ISTOK - okvir.ZAPAD
    )
    lat = okvir.SJEVER - (np.arange(visina) + 0.5) / visina * (
        okvir.SJEVER - okvir.JUG
    )
    lo, la = np.meshgrid(lon, lat)
    tocke = np.array(
        tr.TransformPoints(np.stack([lo.ravel(), la.ravel()], 1).tolist())
    )[:, :2]
    j = np.clip(
        ((tocke[:, 0] - RASPRSENJE.x0) / RASPRSENJE.dx).astype(int),
        0, polje.shape[1] - 1,
    )
    i = np.clip(
        ((RASPRSENJE.y1 - tocke[:, 1]) / RASPRSENJE.dx).astype(int),
        0, polje.shape[0] - 1,
    )
    return polje[i, j].reshape(visina, sirina)


def putanje(ime: str, obuhvat: Obuhvat) -> list[str]:
    """Vraća SVG putanje sloja u pikselima slike.

    Args:
        ime: Ime sloja u `public/geo`, bez nastavka.
        obuhvat: Obuhvat i korak slike.

    Returns:
        Popis `d` nizova; prazan ako sloja nema.
    """
    put = KORIJEN / "public" / "geo" / f"{ime}.geojson"
    if not put.exists():
        return []
    tr = _pretvorba()
    izlaz = []
    for znacajka in json.loads(put.read_text(encoding="utf8"))["features"]:
        geom = znacajka["geometry"]
        vrsta = geom["type"]
        if vrsta == "Polygon":
            komadi = geom["coordinates"]
        elif vrsta == "MultiPolygon":
            komadi = [d for m in geom["coordinates"] for d in m]
        elif vrsta == "LineString":
            komadi = [geom["coordinates"]]
        elif vrsta == "MultiLineString":
            komadi = geom["coordinates"]
        else:
            continue
        zatvoreno = vrsta in ("Polygon", "MultiPolygon")
        for prsten in komadi:
            tocke = tr.TransformPoints([[x, y] for x, y, *_ in prsten])
            px = [
                (
                    round((x - obuhvat.x0) / obuhvat.dx, 1),
                    round((obuhvat.y1 - y) / obuhvat.dx, 1),
                )
                for x, y, *_ in tocke
            ]
            if len(px) < 2 or not any(
                -50 <= x <= obuhvat.nx + 50 and -50 <= y <= obuhvat.ny + 50
                for x, y in px
            ):
                continue
            d = "M" + " L".join(f"{x} {y}" for x, y in px) + ("Z" if zatvoreno else "")
            izlaz.append(d)
    return izlaz


def glavno() -> None:
    """Slaže podlogu, slojeve polja i obrise, pa piše slike i modul.

    Raises:
        SystemExit: Ako godišnji račun nije izveden.
    """
    if not RACUN.exists():
        sys.exit("Prvo pokreni `npm run izvedi-raspesenje`.")
    racun = np.load(RACUN)
    na_godinu = float(racun["na_godinu"][0])
    obuhvat = _obuhvat()
    SLIKE.mkdir(parents=True, exist_ok=True)

    podloga = sjencanje(obuhvat)
    podloga.save(SLIKE / "siri-reljef.png", optimize=True)
    logger.info(
        "podloga %d×%d (%.0f kB)",
        obuhvat.nx, obuhvat.ny, (SLIKE / "siri-reljef.png").stat().st_size / 1024,
    )

    tablica = _ljestvica()
    opisi = []
    for sloj in SLOJEVI:
        polje = racun[sloj["polje"]] * (na_godinu if sloj["godisnje"] else 1.0)
        vrh = float(sloj["vrh"] or np.quantile(polje, 0.9995))
        slika = sloj_polja(polje, vrh, obuhvat, tablica)
        ime = f"siri-{sloj['kljuc']}.png"
        slika.save(SLIKE / ime, optimize=True)
        # Ista veličina u okviru kartica, za pogled na `/karepovac`, ali
        # rastegnuta između rubova koje okvir doista sadrži.
        u_okviru = u_okvir_kvarta(polje)
        od, do = float(u_okviru.min()), float(u_okviru.max())
        udio = np.sqrt(np.clip((u_okviru - od) / max(do - od, 1e-12), 0, 1))
        u_kvartu = Image.fromarray(
            tablica[(udio * 255).astype(np.uint8)], "RGBA"
        )
        ime_kvart = f"kvart-{sloj['kljuc']}.png"
        u_kvartu.save(SLIKE / ime_kvart, optimize=True)

        izvan = polje[~racun["maska"].astype(bool)]
        opisi.append(
            {
                "kljuc": sloj["kljuc"],
                "naziv": sloj["naziv"],
                "opis": sloj["opis"],
                "slika": f"/karepovac/{ime}",
                "slikaKvart": f"/karepovac/{ime_kvart}",
                "kvartOd": round(od, 4),
                "kvartDo": round(do, 4),
                "jedinica": sloj["jedinica"],
                "vrh": round(vrh, 4),
                "najviseIzvanPlohe": round(float(izvan.max()), 4),
                "medijanIzvanPlohe": round(float(np.median(izvan)), 4),
            }
        )
        logger.info(
            "%s: široko 0–%.4g %s; u kvartu %.4g–%.4g (%.0f kB)",
            sloj["kljuc"], vrh, sloj["jedinica"], od, do,
            (SLIKE / ime).stat().st_size / 1024,
        )

    obrisi = {
        kljuc: {"putanje": putanje(sloj, obuhvat), "boja": boja, "debljina": debljina}
        for kljuc, sloj, boja, debljina in OBRISI
    }
    emisija = racun["emisija"]

    MODUL.parent.mkdir(parents=True, exist_ok=True)
    MODUL.write_text(
        "// Generirano iz LiDAR reljefa i godišnjeg računa raspršenja.\n"
        "// Pokretanje: npm run izvedi-siru-kartu — ne uređivati ručno.\n"
        "\n"
        "export const SIRA_KARTA = "
        + json.dumps(
            {
                "sirina": obuhvat.nx,
                "visina": obuhvat.ny,
                "korakM": KORAK,
                "granice": _granice_wgs84(obuhvat),
                "podloga": "/karepovac/siri-reljef.png",
                "slojevi": opisi,
                "obrisi": obrisi,
                "godina": 2025,
                "sati": int(racun["sati"][0]),
                "emisijaUgS": [round(float(x), 1) for x in emisija],
            },
            ensure_ascii=False,
        )
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s (%.0f kB)",
        MODUL.relative_to(KORIJEN), MODUL.stat().st_size / 1024,
    )


if __name__ == "__main__":
    glavno()
