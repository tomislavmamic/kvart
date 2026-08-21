#!/usr/bin/env python3
"""Izvodi osnovna polja vjetra za simulator na `/karepovac/sim`.

Isti račun kao `izvedi-polje-dima.py` — mase dosljedno polje nad LiDAR
reljefom, po razinama miješanog sloja — ali nad **širim obuhvatom**. Prikaz na
`/karepovac/zrak` gleda 2,6 × 1,3 km oko plohe, što je dovoljno da se vidi
kamo perjanica krene, ali premalo da stanovnik Kile ili Mravinaca na karti
nađe svoju ulicu. Simulator zato računa 6,4 × 6,4 km, s plohom u sredini.

Izlaz **nije** TypeScript modul nego dvojno: sirovi bajtovi u
`public/karepovac/sim-polje.bin` i opis u `src/generated/karepovac-sim-polje.ts`.
Razlog je veličina: 256 × 256 ćelija × 4 polja × 5 razina je 1,3 MB, a u
base64 unutar JS-a to naraste na 1,8 MB koje bi preglednik razlagao pri
učitavanju stranice. Ovako sliku skida samo onaj tko otvori simulator, i to
kao binarni zapis koji ide ravno u `Uint8Array`.

Redoslijed u datoteci: za svaku razinu redom `istokVx`, `istokVy`,
`sjeverVx`, `sjeverVy`, pa na kraju maska plohe. Svako polje je `gw · gh`
bajtova, 128 je nula, ljestvica je zajednička (`skala`).

Pokretanje: `npm run izvedi-sim-polje`
"""

from __future__ import annotations

import json
import logging
import math
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reljef_polje import (  # noqa: E402
    NAJTANJI_SLOJ,
    Obuhvat,
    gladi,
    maska_plohe,
    polje_vjetra,
)

gdal.UseExceptions()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
BAJTOVI = KORIJEN / "public" / "karepovac" / "sim-polje.bin"
OPIS = KORIJEN / "src" / "generated" / "karepovac-sim-polje.ts"

#: Vlastiti isječak DMR-a, širi od onoga koji koriste ostale karte.
#:
#: `dmr.PROZOR` drži kvart u sredini, pa ploha ispadne uz sam istočni rub i
#: istočno od nje ostaje 1,6 km. Simulator gleda na sve strane jednako, pa mu
#: treba prozor sa središtem na plohi. Ne mijenja se `dmr.PROZOR` jer o njemu
#: vise tokovi, sjenčanje i visinska mreža — promjena bi ih sve pomaknula.
DMR = KORIJEN / ".cache" / "dmr-sim.tif"
DMR_PROZOR = (497400, 4816700, 504400, 4823700)
DMR_WCS = "https://geoportal.dgu.hr/services/dmr/wcs"

#: Obuhvat računa u HTRS96/TM. Veći je od prikaza za 300 m sa svake strane:
#: rješenje se na rubu drži uz λ = 0, pa polje ondje nije vjerodostojno.
OBUHVAT = Obuhvat(497400, 4816700, 504400, 4823700, 25.0)

#: Rešetka koja ide u preglednik. Potencija dvojke jer postaje WebGL tekstura.
GW, GH = 256, 256

#: Središte plohe (`public/geo/karepovac.geojson`), oko kojega se prikaz siječe.
SREDISTE = (16.5115446, 43.5214492)

#: Polovica stranice prikaza u metrima; ploha je u sredini kvadrata 6,4 km.
POLA_M = 3200.0

DUBINE = (25.0, 55.0, 120.0, 260.0, 600.0)
OSNOVA_ISTOK = 270.0
OSNOVA_SJEVER = 180.0

ZAGUSENJE_ZA_UPOZORENJE = 0.95

#: Najveća brzina koja se sprema, u jedinicama brzine na otvorenom.
#:
#: Uži obuhvat prikaza na `/karepovac/zrak` staje u kvart, pa mu je najveće
#: ubrzanje 2,2×. Ovaj zahvaća i padine Kozjaka (726 m), gdje pod plitkim
#: slojem debljina udari u `NAJTANJI_SLOJ` i jednadžba kontinuiteta ondje daje
#: 7,8×. Nad brdom to nije prikaz zraka nego rub modela — sloj od 25 m preko
#: vrha od 700 m nema fizikalnog smisla — ali ulazi u zajedničku ljestvicu i
#: guta točnost ondje gdje se gleda: pri jedinici bi na plohu ostalo 16 razina
#: bajta umjesto 40. Zato se sprema odrezano, i to se ovdje piše, a ne šuti.
NAJVECE_UBRZANJE = 3.0


def _pretvorba(iz_epsg: int, u_epsg: int) -> osr.CoordinateTransformation:
    """Transformacija između dva EPSG-a, s osima u redoslijedu (x, y)."""
    a = osr.SpatialReference()
    a.ImportFromEPSG(iz_epsg)
    a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    b = osr.SpatialReference()
    b.ImportFromEPSG(u_epsg)
    b.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(a, b)


def granice() -> dict[str, float]:
    """Zemljopisni obuhvat prikaza, kvadrat oko plohe.

    Returns:
        Rubovi u WGS84; `zapad`, `jug`, `istok`, `sjever`.
    """
    lon, lat = SREDISTE
    dlat = POLA_M / 111320.0
    dlon = POLA_M / (111320.0 * math.cos(math.radians(lat)))
    return {
        "zapad": round(lon - dlon, 6),
        "jug": round(lat - dlat, 6),
        "istok": round(lon + dlon, 6),
        "sjever": round(lat + dlat, 6),
    }


def skini_dmr() -> Path:
    """Skida širi isječak DMR-a; drugi put čita iz `.cache/`.

    Returns:
        Putanja do GeoTIFF-a s visinama u metrima (EPSG:3765).
    """
    if DMR.exists():
        logger.info("DMR iz predmemorije: %s", DMR.relative_to(KORIJEN))
        return DMR
    DMR.parent.mkdir(parents=True, exist_ok=True)
    x0, y0, x1, y1 = DMR_PROZOR
    url = (
        f"{DMR_WCS}?service=WCS&version=2.0.1&request=GetCoverage"
        f"&coverageId=dmr__DMR_BW&format=image/tiff"
        f"&subset=E({x0},{x1})&subset=N({y0},{y1})"
    )
    logger.info("skidam DMR (%d × %d m)…", x1 - x0, y1 - y0)
    with urllib.request.urlopen(url, timeout=900) as odgovor:
        podaci = odgovor.read()
    DMR.write_bytes(podaci)
    logger.info("  %.1f MB", len(podaci) / 1e6)
    return DMR


def ucitaj_reljef() -> np.ndarray:
    """Učitava širi DMR i uzorkuje ga na računsku rešetku.

    Returns:
        Polje visina u metrima, oblika (ny, nx); bez rupa.
    """
    izvor = gdal.Open(str(skini_dmr()))
    gt = izvor.GetGeoTransform()
    sirovo = izvor.GetRasterBand(1).ReadAsArray().astype(np.float64)
    sirovo[sirovo < -100] = np.nan

    xs = OBUHVAT.x0 + (np.arange(OBUHVAT.nx) + 0.5) * OBUHVAT.dx
    ys = OBUHVAT.y1 - (np.arange(OBUHVAT.ny) + 0.5) * OBUHVAT.dx
    cx = np.clip(((xs - gt[0]) / gt[1]).astype(int), 0, sirovo.shape[1] - 1)
    cy = np.clip(((ys - gt[3]) / gt[5]).astype(int), 0, sirovo.shape[0] - 1)
    z = sirovo[np.ix_(cy, cx)]

    for _ in range(6):
        if not np.isnan(z).any():
            break
        rub = np.pad(z, 1, mode="edge")
        susjedi = np.nanmean(
            np.stack([rub[:-2, 1:-1], rub[2:, 1:-1], rub[1:-1, :-2], rub[1:-1, 2:]]),
            axis=0,
        )
        z = np.where(np.isnan(z), susjedi, z)
    return np.nan_to_num(z, nan=float(np.nanmedian(z)))


def u_prikaz(polje: np.ndarray, rub: dict[str, float]) -> np.ndarray:
    """Uzorkuje računsku rešetku (HTRS96/TM) u zemljopisnu rešetku prikaza.

    Args:
        polje: Polje na računskoj rešetki, oblika (ny, nx).
        rub: Zemljopisni obuhvat prikaza.

    Returns:
        Polje oblika (GH, GW); redak 0 je sjeverni rub.
    """
    tr = _pretvorba(4326, 3765)
    lon = rub["zapad"] + (np.arange(GW) + 0.5) / GW * (rub["istok"] - rub["zapad"])
    lat = rub["sjever"] - (np.arange(GH) + 0.5) / GH * (rub["sjever"] - rub["jug"])
    lo, la = np.meshgrid(lon, lat)
    tocke = np.array(
        tr.TransformPoints(np.stack([lo.ravel(), la.ravel()], 1).tolist())
    )[:, :2]
    gj = np.clip(((tocke[:, 0] - OBUHVAT.x0) / OBUHVAT.dx).astype(int), 0, polje.shape[1] - 1)
    gi = np.clip(((OBUHVAT.y1 - tocke[:, 1]) / OBUHVAT.dx).astype(int), 0, polje.shape[0] - 1)
    return polje[gi, gj].reshape(GH, GW)


def _odrezi(polje: np.ndarray) -> np.ndarray:
    """Reže brzinu na `NAJVECE_UBRZANJE`, po iznosu, čuvajući smjer."""
    return np.clip(polje, -NAJVECE_UBRZANJE, NAJVECE_UBRZANJE)


def _bajtovi(polje: np.ndarray, skala: float) -> np.ndarray:
    """Pakira polje u bajtove oko sredine raspona."""
    q = np.clip(polje / skala * 0.5 + 0.5, 0, 1)
    return (q * 255).astype(np.uint8)


def glavno() -> None:
    """Računa osnove za svaku razinu i piše bajtove i opis."""
    rub = granice()
    logger.info(
        "obuhvat prikaza: %.6f–%.6f × %.6f–%.6f (%.1f × %.1f km)",
        rub["zapad"], rub["istok"], rub["jug"], rub["sjever"],
        2 * POLA_M / 1000, 2 * POLA_M / 1000,
    )

    z = gladi(ucitaj_reljef(), 3)
    logger.info("reljef %d × %d, %.0f–%.0f m", z.shape[1], z.shape[0], z.min(), z.max())

    sidro = float(np.median(z))
    razine: list[tuple[np.ndarray, ...]] = []
    for dubina in DUBINE:
        ui, vi = polje_vjetra(z, OSNOVA_ISTOK, 1.0, dubina, OBUHVAT)
        us, vs = polje_vjetra(z, OSNOVA_SJEVER, 1.0, dubina, OBUHVAT)
        d = np.clip(dubina - (z - sidro), NAJTANJI_SLOJ, None)
        zagusenje = float((d <= NAJTANJI_SLOJ + 1e-9).mean())
        if zagusenje > ZAGUSENJE_ZA_UPOZORENJE:
            logger.warning(
                "  %.0f m: %.0f %% ćelija na donjoj granici — razina nosi malo reljefa",
                dubina, 100 * zagusenje,
            )
        # Nad brdom polje pobjegne u rub modela; odrezuje se prije pakiranja,
        # da zajednička ljestvica ostane upotrebljiva nad plohom i kvartom.
        ui, vi, us, vs = (_odrezi(p) for p in (ui, vi, us, vs))
        # U rešetki prikaza y raste prema jugu, a v je brzina prema sjeveru.
        razine.append((
            u_prikaz(ui, rub), -u_prikaz(vi, rub),
            u_prikaz(us, rub), -u_prikaz(vs, rub),
        ))
        logger.info(
            "  %.0f m: brzina %.2f–%.2f, skretanje do %.1f°",
            dubina,
            float(np.hypot(ui, vi).min()), float(np.hypot(ui, vi).max()),
            float(np.abs(np.degrees(np.arctan2(vi, ui))).max()),
        )

    skala = float(max(np.abs(p).max() for r in razine for p in r))
    skala = round(skala * 1.02, 4)

    maska = (u_prikaz(maska_plohe(OBUHVAT).astype(float), rub) > 0.4).astype(np.uint8) * 255
    logger.info("ploha zauzima %d ćelija prikaza", int((maska > 0).sum()))
    if not (maska > 0).any():
        sys.exit("Ploha je ispala izvan obuhvata prikaza — provjeri granice.")

    komadi = [p.tobytes() for r in razine for p in (_bajtovi(r[0], skala), _bajtovi(r[1], skala), _bajtovi(r[2], skala), _bajtovi(r[3], skala))]
    komadi.append(maska.tobytes())
    BAJTOVI.parent.mkdir(parents=True, exist_ok=True)
    BAJTOVI.write_bytes(b"".join(komadi))

    opis = {
        "gw": GW,
        "gh": GH,
        "skala": skala,
        "dubine": list(DUBINE),
        "granice": rub,
        "sirinaM": round(2 * POLA_M, 1),
        "visinaM": round(2 * POLA_M, 1),
        "izvor": {"lon": SREDISTE[0], "lat": SREDISTE[1]},
        "bajtovi": "/karepovac/sim-polje.bin",
        "duljina": sum(len(k) for k in komadi),
        "odrezanoNa": NAJVECE_UBRZANJE,
    }
    OPIS.write_text(
        "// Generirano iz DGU-ova LiDAR reljefa nad širim obuhvatom oko plohe.\n"
        "// Opis; sama polja su u public/karepovac/sim-polje.bin, jer bi u\n"
        "// base64 unutar JS-a bila 1,8 MB koje preglednik razlaže pri učitavanju.\n"
        "// Pokretanje: npm run izvedi-sim-polje — ne uređivati ručno.\n\n"
        f"export const SIM_POLJE = {json.dumps(opis, ensure_ascii=False)} as const;\n",
        encoding="utf8",
    )
    logger.info(
        "\n%s — %.2f MB\n%s",
        BAJTOVI.relative_to(KORIJEN), BAJTOVI.stat().st_size / 1e6,
        OPIS.relative_to(KORIJEN),
    )


if __name__ == "__main__":
    glavno()
