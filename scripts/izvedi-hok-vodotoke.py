#!/usr/bin/env python3
"""Vadi povremene vodotoke sa stare HOK 1:5000 kao vektorski sloj.

HOK ih crta crtkano plavo, u mjerilu 1:5000, među izohipsama i katastarskim
linijama — na ekranu se to jedva razabire, a upravo je to jedini stari zapis
o tome kuda je voda tekla prije nego je radna zona dobila današnji oblik.
Ovdje se ta boja izdvaja iz rastera i pretvara u crte, da se može upaliti uz
izvedene tokove i usporediti.

Postupak: WMS GetMap u EPSG:3765 po pločama → prag na plavu → širenje da se
spoje crtice → Zhang-Suen stanjivanje → praćenje kostura u poteze.

Rimski vodovod je zamka i miče se ovdje, a ne na karti. HOK ga crta ISTOM
plavom bojom, pa upada u prag; u ranijoj usporedbi baš je on dizao medijan
odstupanja s 7,8 na 12,0 m. Ne razlikuje se po boji nego po ponašanju: on je
akvadukt i drži izohipsu, dok vodotok pada niz teren. Zato se svakom potezu
očita visina iz DMR-a i odbaci se ono što po duljini gotovo ne pada — mjera
je pad po metru, ne izgled.

Rezultat: public/geo/vodotoci-hok.geojson (EPSG:4326)

Pokretanje:  /opt/homebrew/bin/python3 scripts/izvedi-hok-vodotoke.py
Traži:       GDAL s Python vezama, numpy, .cache/dmr.tif (izvedi-tokove.py)
             i mrežu do geoportal.dgu.hr
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IZLAZ = os.path.join(KORIJEN, "public", "geo", "vodotoci-hok.geojson")
DMR = os.path.join(KORIJEN, ".cache", "dmr.tif")
PREDMEMORIJA = os.path.join(KORIJEN, ".cache", "hok.tif")
PODRUCJE = os.path.join(KORIJEN, ".cache", "podrucje-kvarta.geojson")

# Rezerva oko slivnog područja. Nije nula namjerno: stari tok koji se s
# izvedenim NE poklapa upravo je ono što se želi vidjeti, pa rez mora biti
# zemljopisan (sliv kvarta), a ne „ono što je blizu izvedenog toka“ — inače
# bi sloj potvrđivao sam sebe.
REZERVA_M = 200

WMS = "https://geoportal.dgu.hr/services/hok/wms"
SLOJ = "hok:HOK5"

# Isti prozor kao izvedeni tokovi, da se dvije karte poklapaju bez pomaka.
PROZOR = (496500, 4818500, 502500, 4823500)
PLOCA = 2000  # m — WMS ne voli 6 × 5 km odjednom, pa ide po pločama
KORAK = 1  # m po pikselu

MIN_PIKSELA = 120  # manje od toga je natpis ili mrlja, ne tok
SPAJANJE = 3  # px — koliko se širi da se crtice spoje u crtu
MIN_DULJINA_M = 60
MIN_PAD_PROMILA = 4.0  # ispod ovog pada po duljini to je akvadukt, ne tok
POJEDNOSTAVI = 3.0  # m


def _pretvorba(iz_epsg: int, u_epsg: int) -> osr.CoordinateTransformation:
    """Transformacija između dva EPSG-a u uobičajenom redoslijedu osi."""
    a = osr.SpatialReference()
    a.ImportFromEPSG(iz_epsg)
    a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    b = osr.SpatialReference()
    b.ImportFromEPSG(u_epsg)
    b.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(a, b)


def skini_hok() -> np.ndarray:
    """Skida HOK po pločama i slaže ih u jedan RGB niz."""
    x0, y0, x1, y1 = PROZOR
    s, v = (x1 - x0) // KORAK, (y1 - y0) // KORAK
    if os.path.exists(PREDMEMORIJA):
        logger.info("HOK iz predmemorije: %s", PREDMEMORIJA)
        ds = gdal.Open(PREDMEMORIJA)
        return ds.ReadAsArray().transpose(1, 2, 0)

    platno = np.zeros((v, s, 3), dtype=np.uint8)
    ploce = [
        (px, py)
        for px in range(x0, x1, PLOCA)
        for py in range(y0, y1, PLOCA)
    ]
    logger.info("skidam HOK u %d ploča...", len(ploce))
    for px, py in ploce:
        qx, qy = min(px + PLOCA, x1), min(py + PLOCA, y1)
        sw, sv = (qx - px) // KORAK, (qy - py) // KORAK
        url = (
            f"{WMS}?service=WMS&version=1.3.0&request=GetMap&layers={SLOJ}"
            f"&styles=&crs=EPSG:3765&bbox={px},{py},{qx},{qy}"
            f"&width={sw}&height={sv}&format=image/png"
        )
        with urllib.request.urlopen(url, timeout=180) as odgovor:
            podaci = odgovor.read()
        gdal.FileFromMemBuffer("/vsimem/p.png", podaci)
        ploca = gdal.Open("/vsimem/p.png").ReadAsArray()[:3].transpose(1, 2, 0)
        gdal.Unlink("/vsimem/p.png")
        r0 = v - (qy - y0) // KORAK
        c0 = (px - x0) // KORAK
        platno[r0 : r0 + sv, c0 : c0 + sw] = ploca

    drv = gdal.GetDriverByName("GTiff")
    ds = drv.Create(PREDMEMORIJA, s, v, 3, gdal.GDT_Byte, options=["COMPRESS=DEFLATE"])
    for i in range(3):
        ds.GetRasterBand(i + 1).WriteArray(platno[:, :, i])
    ds.FlushCache()
    logger.info("  %d × %d px", s, v)
    return platno


def plava_maska(rgb: np.ndarray) -> np.ndarray:
    """Piksele hidrografije razlikuje od crne crte i smeđe izohipse."""
    r = rgb[:, :, 0].astype(int)
    g = rgb[:, :, 1].astype(int)
    b = rgb[:, :, 2].astype(int)
    maska = (b > 110) & (b - r > 45) & (b - g > 25)
    logger.info("plavih piksela: %d (%.3f %%)", int(maska.sum()), 100 * maska.mean())
    return maska


def _siri(maska: np.ndarray, koraka: int) -> np.ndarray:
    """Širenje po 4-susjedstvu, da crtkana crta postane neprekinuta."""
    out = maska.copy()
    for _ in range(koraka):
        out = (
            out
            | np.roll(out, 1, 0)
            | np.roll(out, -1, 0)
            | np.roll(out, 1, 1)
            | np.roll(out, -1, 1)
        )
    return out


def stanji(maska: np.ndarray) -> np.ndarray:
    """Zhang-Suen: debelu mrlju svodi na kostur širine jednog piksela."""
    img = maska.astype(np.uint8).copy()
    while True:
        promjena = False
        for korak in (0, 1):
            p = [
                np.roll(np.roll(img, dr, 0), dc, 1)
                for dr, dc in [
                    (-1, 0), (-1, -1), (0, -1), (1, -1),
                    (1, 0), (1, 1), (0, 1), (-1, 1),
                ]
            ]
            # p[0]=sjever, pa u smjeru kazaljke; Zhang-Suen ih zove P2..P9.
            susjedi = sum(p)
            prijelazi = sum(
                ((p[i] == 0) & (p[(i + 1) % 8] == 1)).astype(np.uint8) for i in range(8)
            )
            uvjet = (img == 1) & (susjedi >= 2) & (susjedi <= 6) & (prijelazi == 1)
            if korak == 0:
                uvjet &= (p[0] * p[2] * p[4] == 0) & (p[2] * p[4] * p[6] == 0)
            else:
                uvjet &= (p[0] * p[2] * p[6] == 0) & (p[0] * p[4] * p[6] == 0)
            if uvjet.any():
                img[uvjet] = 0
                promjena = True
        if not promjena:
            break
    return img.astype(bool)


def _sastavnice(kostur: np.ndarray) -> list[list[tuple[int, int]]]:
    """Povezane sastavnice kostura po 8-susjedstvu."""
    vidjeno = np.zeros_like(kostur)
    v, s = kostur.shape
    out = []
    for r0, c0 in zip(*np.nonzero(kostur)):
        if vidjeno[r0, c0]:
            continue
        stog = [(int(r0), int(c0))]
        vidjeno[r0, c0] = True
        skup = []
        while stog:
            r, c = stog.pop()
            skup.append((r, c))
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < v and 0 <= nc < s and kostur[nr, nc] and not vidjeno[nr, nc]:
                        vidjeno[nr, nc] = True
                        stog.append((nr, nc))
        out.append(skup)
    return out


def _put_kroz(skup: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Najdulji put kroz sastavnicu — dvaput BFS, kao promjer stabla."""
    cvor = {p: i for i, p in enumerate(skup)}

    def bfs(start: tuple[int, int]) -> tuple[tuple[int, int], dict]:
        prethodnik = {start: None}
        red = [start]
        zadnji = start
        while red:
            sljedeci = []
            for r, c in red:
                zadnji = (r, c)
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        p = (r + dr, c + dc)
                        if p in cvor and p not in prethodnik:
                            prethodnik[p] = (r, c)
                            sljedeci.append(p)
            red = sljedeci
        return zadnji, prethodnik

    a, _ = bfs(skup[0])
    b, prethodnik = bfs(a)
    put = []
    p: tuple[int, int] | None = b
    while p is not None:
        put.append(p)
        p = prethodnik[p]
    return put


def _zaokruzi(c: list) -> list:
    """Reže koordinate na 7 decimala (~1 cm), na bilo kojoj dubini ugnježđenja."""
    if c and isinstance(c[0], (int, float)):
        return [round(x, 7) for x in c]
    return [_zaokruzi(x) for x in c]


def _tocke_geometrije(g: ogr.Geometry) -> list[tuple[float, float]]:
    """Sve točke crte ili višedijelne crte, redom."""
    if g.GetGeometryType() == ogr.wkbLineString:
        return [(g.GetX(i), g.GetY(i)) for i in range(g.GetPointCount())]
    out: list[tuple[float, float]] = []
    for i in range(g.GetGeometryCount()):
        out.extend(_tocke_geometrije(g.GetGeometryRef(i)))
    return out


def ucitaj_podrucje() -> ogr.Geometry:
    """Slivno područje kvarta iz izvedi-tokove.py, prošireno rezervom."""
    if not os.path.exists(PODRUCJE):
        raise SystemExit(
            f"nema {os.path.relpath(PODRUCJE, KORIJEN)} — prvo pokreni scripts/izvedi-tokove.py"
        )
    izvor = ogr.Open(PODRUCJE)  # drži se: bez reference GDAL počisti sloj
    spoj = ogr.Geometry(ogr.wkbMultiPolygon)
    for obiljezje in izvor.GetLayer(0):
        if obiljezje.GetField("v") == 1:
            spoj.AddGeometry(obiljezje.GetGeometryRef())
    return spoj.UnionCascaded().Buffer(REZERVA_M)


def main() -> None:
    podrucje = ucitaj_podrucje()
    rgb = skini_hok()
    maska = plava_maska(rgb)
    logger.info("spajam crtice i stanjujem...")
    kostur = stanji(_siri(maska, SPAJANJE))

    dmr = gdal.Open(DMR)
    visine = dmr.GetRasterBand(1).ReadAsArray()
    gt_dmr = dmr.GetGeoTransform()
    x0, _, _, y1 = PROZOR[0], 0, 0, PROZOR[3]

    u_4326 = _pretvorba(3765, 4326)
    obiljezja = []
    odbaceno = []
    for skup in _sastavnice(kostur):
        if len(skup) < MIN_PIKSELA:
            continue
        put = _put_kroz(skup)
        if len(put) < 2:
            continue

        tocke = [(x0 + c * KORAK, y1 - r * KORAK) for r, c in put]
        g = ogr.Geometry(ogr.wkbLineString)
        for x, y in tocke:
            g.AddPoint_2D(x, y)
        g = g.SimplifyPreserveTopology(POJEDNOSTAVI)
        if not g.Intersects(podrucje):
            continue
        g = g.Intersection(podrucje)
        if g.IsEmpty() or g.GetGeometryType() not in (ogr.wkbLineString, ogr.wkbMultiLineString):
            continue
        duljina = g.Length()
        if duljina < MIN_DULJINA_M:
            continue

        # Visina se čita iz DMR-a na krajevima poteza; pad po duljini
        # razdvaja vodotok od akvadukta koji drži izohipsu. Uzorci se uzimaju
        # s REZANE geometrije — inače bi se pad računao i po dijelu koji je
        # ispao iz obuhvata.
        rezane = _tocke_geometrije(g)
        uzorci = []
        for x, y in (rezane[0], rezane[len(rezane) // 2], rezane[-1]):
            cc = int((x - gt_dmr[0]) / gt_dmr[1])
            rr = int((y - gt_dmr[3]) / gt_dmr[5])
            if 0 <= rr < visine.shape[0] and 0 <= cc < visine.shape[1]:
                h = float(visine[rr, cc])
                if h != -9999:
                    uzorci.append(h)
        if len(uzorci) < 2:
            continue
        pad = (max(uzorci) - min(uzorci)) / duljina * 1000

        if pad < MIN_PAD_PROMILA:
            odbaceno.append((duljina, pad))
            continue

        g.Transform(u_4326)
        geom = json.loads(g.ExportToJson())
        geom["coordinates"] = _zaokruzi(geom["coordinates"])
        obiljezja.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "duljina_m": round(duljina),
                    "pad_promila": round(pad, 1),
                    "izvor": "HOK 1:5000, DGU — vektorizirano iz rastera",
                },
            }
        )

    obiljezja.sort(key=lambda f: -f["properties"]["duljina_m"])
    with open(IZLAZ, "w") as f:
        json.dump({"type": "FeatureCollection", "features": obiljezja}, f)
    ukupno = sum(f["properties"]["duljina_m"] for f in obiljezja)
    logger.info(
        "zapisano %d vodotoka, %.1f km -> %s",
        len(obiljezja),
        ukupno / 1000,
        os.path.relpath(IZLAZ, KORIJEN),
    )
    for duljina, pad in sorted(odbaceno, reverse=True):
        logger.info("  odbačeno kao akvadukt: %.0f m uz pad %.1f ‰", duljina, pad)


if __name__ == "__main__":
    main()
