#!/usr/bin/env python3
"""Izvodi osnovna polja vjetra nad kvartom, za prikaz širenja u pregledniku.

Prikaz na `/karepovac` i `/karepovac/zrak` ne crta unaprijed nacrtanu perjanicu
nego je računa: čestice nosi polje vjetra, a polje dolazi odavde.

Polje nije podatak nego izvod. Iz DGU-ova LiDAR reljefa računa se debljina sloja
zraka nad terenom, pa se traži polje kojemu je protok masa dosljedan —
∇·(d·u) = 0. Time vjetar obilazi padinu umjesto da ide kroz nju, što je jedina
razlika koja se na ovoj udaljenosti uopće vidi.

Ne sprema se jedan slučaj vremena nego **osnova**, jer je taj račun linearan po
vjetru na otvorenom: ∇·(d∇λ) = −∇·(d·u₀) ima desnu stranu linearnu po u₀, a
rješenje se dobiva linearnim postupkom, pa vrijedi

    u(smjer, brzina) = brzina · [cos(270°−smjer)·u_istok + sin(270°−smjer)·u_sjever]

gdje su u_istok i u_sjever rješenja za jedinični vjetar prema istoku i prema
sjeveru. Provjereno na stvarnom reljefu: razlika prema izravnom rješenju je
reda 10⁻¹⁵ m/s. Zato smjer i brzina više ne moraju biti zapečeni — stranica ih
uzima iz trenutačnog vremena i polje slaže u izvođenju
(`src/lib/polje-dima.ts`).

Dubina miješanog sloja **nije** linearna jer ulazi kao koeficijent d, pa se za
nju sprema nekoliko razina i među njima se interpolira. Razlike su najveće oko
100 m: tada vjetar najviše skreće oko padine. Pri vrlo plitkom sloju d udari u
donju granicu pa je polje gotovo jednoliko, a pri vrlo dubokom teren više ne
stigne skrenuti struju.

Komponente `vx` i `vy` spremaju se odvojeno. Kut se ne smije spremati pa
interpolirati — prosjek 350° i 10° je 180°, dakle točno suprotan smjer.

Pokretanje: `npm run izvedi-polje-dima`
"""

from __future__ import annotations

import base64
import json
import logging
import math
import os
import sys
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dmr  # noqa: E402
import okvir  # noqa: E402

gdal.UseExceptions()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-polje.ts"

# Obuhvat računa (HTRS96/TM): ploha, kvart i rub, da perjanica ima kamo otići.
X0, Y0, X1, Y1 = 498400, 4819100, 501800, 4821400
DX = 20.0
NX = int((X1 - X0) / DX)
NY = int((Y1 - Y0) / DX)

# Rešetka koja ide u preglednik; finije od ovoga ništa se ne dobiva jer se
# čestice ionako crtaju na vlastitoj, gušćoj mreži.
GW, GH = 220, 108

# Razine dubine miješanog sloja za koje se sprema osnova, u metrima. Razmak je
# logaritamski jer se i sam učinak tako mijenja: između 25 i 120 m polje se
# vidno prelomi, a između 300 i 800 m gotovo ništa. Vrijednosti pokrivaju noćnu
# inverziju (nekoliko desetaka metara) i razvijeni dnevni sloj (do ~1 km).
DUBINE = (25.0, 55.0, 120.0, 260.0, 600.0)

# Osnova su jedinični vjetrovi prema istoku i prema sjeveru; u meteorološkom
# zapisu to su vjetrovi *iz* zapada i *iz* juga.
OSNOVA_ISTOK = 270.0
OSNOVA_SJEVER = 180.0

# Ispod ovoga se sloj ne stanjuje ni nad najvišim grebenom. Bez donje granice
# protok se u zagušenim ćelijama pretvara u mlaz od nekoliko m/s po metru
# sekundi vjetra, što dvodimenzionalni račun ne može tvrditi.
NAJTANJI_SLOJ = 10.0


def _pretvorba() -> osr.CoordinateTransformation:
    """Vraća pretvorbu iz WGS84 u HTRS96/TM."""
    izvor = osr.SpatialReference()
    izvor.ImportFromEPSG(4326)
    izvor.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    cilj = osr.SpatialReference()
    cilj.ImportFromEPSG(3765)
    cilj.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(izvor, cilj)


def ucitaj_reljef() -> np.ndarray:
    """Učitava DMR i uzorkuje ga na računsku rešetku.

    Returns:
        Polje visina u metrima, oblika (NY, NX); bez rupa.
    """
    izvor = gdal.Open(dmr.skini_dmr())
    gt = izvor.GetGeoTransform()
    sirovo = izvor.GetRasterBand(1).ReadAsArray().astype(np.float64)
    sirovo[sirovo < -100] = np.nan

    xs = X0 + (np.arange(NX) + 0.5) * DX
    ys = Y1 - (np.arange(NY) + 0.5) * DX
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


def gladi(polje: np.ndarray, prolaza: int) -> np.ndarray:
    """Ublažava šum reljefa; bez toga nagib skače po pojedinim pikselima."""
    for _ in range(prolaza):
        rub = np.pad(polje, 1, mode="edge")
        polje = (
            rub[1:-1, 1:-1] * 4
            + rub[:-2, 1:-1]
            + rub[2:, 1:-1]
            + rub[1:-1, :-2]
            + rub[1:-1, 2:]
        ) / 8
    return polje


def maska_plohe() -> np.ndarray:
    """Rasterizira obris odlagališta na računsku rešetku.

    Returns:
        Logičko polje oblika (NY, NX); istina unutar plohe.

    Raises:
        SystemExit: Ako sloj s obrisom nedostaje.
    """
    put = KORIJEN / "public" / "geo" / "karepovac.geojson"
    if not put.exists():
        sys.exit(f"Nedostaje sloj: {put.relative_to(KORIJEN)}")
    znacajka = json.loads(put.read_text(encoding="utf8"))["features"][0]
    prsten = znacajka["geometry"]["coordinates"][0]

    tocke = np.array(
        [_pretvorba().TransformPoint(x, y)[:2] for x, y in prsten]
    )
    px = (tocke[:, 0] - X0) / DX
    py = (Y1 - tocke[:, 1]) / DX

    gx, gy = np.meshgrid(np.arange(NX) + 0.5, np.arange(NY) + 0.5)
    unutra = np.zeros((NY, NX), bool)
    n = len(px)
    for i in range(n):
        j = (i + 1) % n
        y1, y2 = py[i], py[j]
        if y1 == y2:
            continue
        presjek = (gy >= min(y1, y2)) & (gy < max(y1, y2))
        xt = px[i] + (gy - y1) * (px[j] - px[i]) / (y2 - y1)
        unutra ^= presjek & (gx < xt)
    return unutra


def _rijesi(d: np.ndarray, desna: np.ndarray) -> np.ndarray:
    """Rješava ∇·(d∇λ) = desna, uz λ = 0 na rubu obuhvata.

    Rub je Dirichletov, ne Neumannov: kroz rub obuhvata vjetar mora moći ući i
    izaći, pa se korekcija ondje gasi. Uz Neumannov rub zadatak nema rješenja
    (ulazni i izlazni protok se ne poklapaju kad d nije jednolik), a iteracija
    to ne prijavi nego samo polako odluta — zato je raniji Jacobi s 600 koraka
    davao premalo skretanja.

    Args:
        d: Debljina sloja po ćeliji, u metrima.
        desna: Desna strana jednadžbe, već pomnožena s DX².

    Returns:
        Polje λ; nula na rubu.

    Raises:
        RuntimeError: Ako sprežni gradijenti ne padnu ispod praga.
    """

    def rub(x: np.ndarray) -> np.ndarray:
        x[0, :] = 0
        x[-1, :] = 0
        x[:, 0] = 0
        x[:, -1] = 0
        return x

    de = 0.5 * (d + np.roll(d, -1, 1))
    dz = 0.5 * (d + np.roll(d, 1, 1))
    ds = 0.5 * (d + np.roll(d, 1, 0))
    dj = 0.5 * (d + np.roll(d, -1, 0))
    zbroj = de + dz + ds + dj

    def mnozi(x: np.ndarray) -> np.ndarray:
        x = rub(x.copy())
        return rub(
            zbroj * x
            - (
                de * np.roll(x, -1, 1)
                + dz * np.roll(x, 1, 1)
                + ds * np.roll(x, 1, 0)
                + dj * np.roll(x, -1, 0)
            )
        )

    b = rub(desna.copy())
    lam = np.zeros_like(b)
    ostatak = b - mnozi(lam)
    smjer = ostatak.copy()
    norma = float((ostatak * ostatak).sum())
    pocetna = norma
    if pocetna == 0.0:
        return lam
    for _ in range(4000):
        a = mnozi(smjer)
        korak = norma / float((smjer * a).sum())
        lam += korak * smjer
        ostatak -= korak * a
        nova = float((ostatak * ostatak).sum())
        if nova < 1e-20 * pocetna:
            return lam
        smjer = ostatak + (nova / norma) * smjer
        norma = nova
    raise RuntimeError("polje vjetra nije konvergiralo")


def polje_vjetra(
    z: np.ndarray, smjer_od: float, brzina: float, dubina: float
) -> tuple[np.ndarray, np.ndarray]:
    """Traži polje kojemu je protok masa dosljedan: ∇·(d∇λ) = −∇·(d·u₀).

    Args:
        z: Visine terena u metrima.
        smjer_od: Meteorološki smjer iz kojega puše, u stupnjevima.
        brzina: Brzina na otvorenom, u m/s.
        dubina: Debljina miješanog sloja iznad najniže točke, u metrima.

    Returns:
        Par (u, v): brzina prema istoku i prema sjeveru, u m/s.
    """
    kut = math.radians(270.0 - smjer_od)
    # v je brzina prema sjeveru u stvarnom prostoru, ne prema dolje po retku.
    u0 = np.full((NY, NX), brzina * math.cos(kut))
    v0 = np.full((NY, NX), brzina * math.sin(kut))

    d = np.clip(dubina - (z - z.min()), NAJTANJI_SLOJ, None)
    divergencija = np.zeros_like(d)
    divergencija[:, 1:-1] += ((d * u0)[:, 2:] - (d * u0)[:, :-2]) / (2 * DX)
    divergencija[1:-1, :] += ((d * v0)[:-2, :] - (d * v0)[2:, :]) / (2 * DX)

    lam = _rijesi(d, divergencija * DX * DX)

    gx = np.zeros_like(lam)
    gy = np.zeros_like(lam)
    gx[:, 1:-1] = (lam[:, 2:] - lam[:, :-2]) / (2 * DX)
    gy[1:-1, :] = (lam[:-2, :] - lam[2:, :]) / (2 * DX)
    return u0 + gx, v0 + gy


def u_okvir(polje: np.ndarray) -> np.ndarray:
    """Uzorkuje računsku rešetku u rešetku okvira stranice."""
    tr = _pretvorba()
    lon = okvir.ZAPAD + (np.arange(GW) + 0.5) / GW * (okvir.ISTOK - okvir.ZAPAD)
    lat = okvir.SJEVER - (np.arange(GH) + 0.5) / GH * (okvir.SJEVER - okvir.JUG)
    lo, la = np.meshgrid(lon, lat)
    tocke = np.array(
        tr.TransformPoints(np.stack([lo.ravel(), la.ravel()], 1).tolist())
    )[:, :2]
    gj = np.clip(((tocke[:, 0] - X0) / DX).astype(int), 0, polje.shape[1] - 1)
    gi = np.clip(((Y1 - tocke[:, 1]) / DX).astype(int), 0, polje.shape[0] - 1)
    return polje[gi, gj].reshape(GH, GW)


def _bajtovi(polje: np.ndarray, skala: float) -> str:
    """Pakira polje u bajtove oko sredine raspona, kao base64."""
    q = np.clip(polje / skala * 0.5 + 0.5, 0, 1)
    return base64.b64encode((q * 255).astype(np.uint8).tobytes()).decode()


def glavno() -> None:
    """Izvodi osnovna polja i piše generirani modul."""
    z = gladi(ucitaj_reljef(), 3)
    maska = maska_plohe()
    logger.info(
        "reljef %d×%d, %.0f–%.0f m; ploha %d ćelija",
        NY, NX, z.min(), z.max(), int(maska.sum()),
    )

    # Prvo se izvedu sva polja, pa tek onda pakiraju: ljestvica mora biti
    # zajednička svima, inače se dvije dubine ne mogu miješati bajt po bajt.
    razine = []
    for dubina in DUBINE:
        ui, vi = polje_vjetra(z, OSNOVA_ISTOK, 1.0, dubina)
        us, vs = polje_vjetra(z, OSNOVA_SJEVER, 1.0, dubina)
        # U okviru stranice y raste prema dolje, a v je brzina prema sjeveru.
        razine.append(
            {
                "dubina": dubina,
                "polja": (u_okvir(ui), -u_okvir(vi), u_okvir(us), -u_okvir(vs)),
            }
        )
        # Osnovni vjetar puše točno prema istoku, pa je kut skretanja polja
        # od njega samo arctan(v/u).
        skretanje = np.degrees(np.abs(np.arctan2(vi, ui)))
        logger.info(
            "dubina %5.0f m: brzine %.2f–%.2f, skretanje medijan %.1f° najveće %.1f°",
            dubina,
            np.hypot(ui, vi).min(),
            np.hypot(ui, vi).max(),
            float(np.median(skretanje)),
            float(skretanje.max()),
        )

    skala = 1.02 * max(
        float(np.abs(polje).max()) for r in razine for polje in r["polja"]
    )

    podatci = {
        "gw": GW,
        "gh": GH,
        "skala": round(skala, 4),
        "dubine": [round(r["dubina"]) for r in razine],
        "osnove": [
            {
                "istokVx": _bajtovi(r["polja"][0], skala),
                "istokVy": _bajtovi(r["polja"][1], skala),
                "sjeverVx": _bajtovi(r["polja"][2], skala),
                "sjeverVy": _bajtovi(r["polja"][3], skala),
            }
            for r in razine
        ],
        "maska": base64.b64encode(
            ((u_okvir(maska.astype(float)) > 0.4).astype(np.uint8) * 255).tobytes()
        ).decode(),
    }

    IZLAZ.write_text(
        "// Generirano iz DGU-ova LiDAR reljefa i obrisa plohe.\n"
        "// Osnovna polja za jedinični vjetar; smjer, brzinu i dubinu sloja\n"
        "// stranica slaže u izvođenju — vidi src/lib/polje-dima.ts.\n"
        "// Pokretanje: npm run izvedi-polje-dima — ne uređivati ručno.\n"
        "\n"
        "export const OSNOVE_DIMA = "
        + json.dumps(podatci, ensure_ascii=False)
        + " as const;\n",
        encoding="utf8",
    )
    logger.info(
        "napisano %s (%.0f kB, %d razina, ljestvica %.2f m/s)",
        IZLAZ.relative_to(KORIJEN), IZLAZ.stat().st_size / 1024, len(razine), skala,
    )


if __name__ == "__main__":
    glavno()
