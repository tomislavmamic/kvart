#!/usr/bin/env python3
"""Izvodi sjenčani reljef, izohipse i mrežu visina iz DGU-ova LiDAR DMR-a.

Isti raster iz kojeg `izvedi-tokove.py` računa tokove (vidi `dmr.py`) nosi
još tri stvari koje karta nema, a kvart ih traži:

1. **Sjenčani reljef** kao podloga. DMR je bare-earth — zgrade su uistinu
   uklonjene (medijan unutrašnjosti minus okolni prsten = 0,07 m) — pa se pod
   radnom zonom vidi stari krajobraz: terase, suhozidi, usjeci cesta, rubovi
   kamenoloma. Ne uzima se s DGU-ova WMS-a jer anonimni pristup preko sredine
   svake pločice otiskuje vodeni žig „GEOPORTAL”, a to je upravo mjesto na
   koje se kod reljefa gleda.

2. **Izohipse.** Sirovi LiDAR na 1 m daje 21.437 crta i 6,4 MB nečitljive
   kaše: svaki potporni zid postane zatvorena krivulja. Reljef se zato prije
   crtanja zagladi na ~9 m, čime padne na ~1.200 crta, a oblik terena ostaje.
   Izohipsa je ovdje crta za čitanje karte, ne geodetski podatak.

3. **Mreža visina** za dosje čestice — visina, nagib i ekspozicija u
   kliknutoj točki. `int16` decimetri u pravilnoj lon/lat mreži, da očitanje
   na poslužitelju bude aritmetika bez reprojekcije po kliku.

Korak mreže je 3 m, a ne izvornih 1 m, i to je izbor a ne ušteda: nagib
računat na 1 m LiDAR-u mjeri šum snimke, ne teren.

Obuhvat je MAP_MAX_BOUNDS iz src/lib/map-views.ts — dokle karta uopće pušta
pomicanje. Zaglavlje mreže nosi stvarne rubove, a `tests/reljef.test.ts`
provjerava da se to dvoje nije razišlo.

Rezultat:
    public/geo/reljef/{z}/{x}/{y}.png   sjenčani reljef, zumovi 12–17
    public/geo/reljef/visine.bin.gz     int16 decimetri, redak po redak
    public/geo/reljef/visine.json       zaglavlje mreže
    public/geo/izohipse.geojson         izohipse, 2 m ekvidistancija

Pokretanje:  npm run izvedi-reljef
Traži:       GDAL s Python vezama (gdaldem, gdal_contour, gdal2tiles) i numpy
"""
from __future__ import annotations

import gzip
import json
import logging
import math
import os
import shutil
import subprocess
import tempfile

import numpy as np
from osgeo import gdal, ogr, osr

from dmr import KORIJEN, pretvorba, skini_dmr

gdal.UseExceptions()
ogr.UseExceptions()
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

IZLAZ_RELJEF = os.path.join(KORIJEN, "public", "geo", "reljef")
IZLAZ_IZOHIPSE = os.path.join(KORIJEN, "public", "geo", "izohipse.geojson")
GRANICA = os.path.join(KORIJEN, "public", "geo", "granica.geojson")

# Rezerva oko granice kvarta pri rezanju izohipsi. Isto kao BUFFER_KM u
# scripts/clip-lib.ts — svi vektorski slojevi osim tokova režu se na kvart
# plus 120 m, pa nema razloga da izohipse budu iznimka.
REZERVA_M = 120.0

# Rezerva za sjenčani reljef, znatno šira od vektorske.
#
# Sjenčanje je PODLOGA, ne sloj: pod njim nema ničega, pa ondje gdje ga nema
# ostaje prazna ploha. Zato mu rub mora biti dovoljno daleko da se ne vidi
# dok se gleda kvart — pri z16 je pola okna oko 700 m, pa kilometar znači da
# se do ruba dolazi tek namjernim pomicanjem izvan kvarta.
#
# Ostatak obuhvata karte (koji seže do Kozjaka i mora, zbog sloja tokova)
# svjesno ostaje bez sjenčanja: ondje se gleda tok vode, a ne oblik terena,
# i ne vrijedi četverostruko više pločica.
REZERVA_SJENCANJE_M = 1000.0

# Isti okvir kao MAP_MAX_BOUNDS u src/lib/map-views.ts: [zapad, jug, istok,
# sjever]. Dalje od toga karta ne pušta pomicanje, pa mreža visina ondje ne
# bi imala tko čitati.
OBUHVAT = (16.457, 43.514, 16.518, 43.547)

KORAK_M = 3.0  # m — korak mreže visina i podloge za izohipse
ZAGLADI = 3  # ćelija (× KORAK_M ≈ 9 m) — box filtar prije izohipsi
EKVIDISTANCIJA = 2.0  # m — razmak izohipsi
POJEDNOSTAVI = 2.5  # m — Douglas-Peucker nad izohipsama
ZUM_OD, ZUM_DO = 12, 17  # z17 = 0,87 m/px ≈ izvorna gustoća DMR-a
PRAZNO = -9999


def okvir_3765() -> tuple[float, float, float, float]:
    """Obuhvat u EPSG:3765, prošiten za jednu ćeliju na svaku stranu.

    Returns:
        (x_min, y_min, x_max, y_max) u metrima.
    """
    t = pretvorba(4326, 3765)
    z, j, i, s = OBUHVAT
    uglovi = [t.TransformPoint(lon, lat)[:2] for lon in (z, i) for lat in (j, s)]
    xs = [x for x, _ in uglovi]
    ys = [y for _, y in uglovi]
    return (
        min(xs) - KORAK_M,
        min(ys) - KORAK_M,
        max(xs) + KORAK_M,
        max(ys) + KORAK_M,
    )


def izrezi_i_spusti(izvor: str, radni: str) -> str:
    """Reže DMR na obuhvat karte i spušta ga s 1 m na KORAK_M.

    Args:
        izvor: Putanja do izvornog DMR-a (EPSG:3765, 1 m).
        radni: Direktorij za međurezultate.

    Returns:
        Putanja do rastera na KORAK_M metara.
    """
    x0, y0, x1, y1 = okvir_3765()
    izlaz = os.path.join(radni, "reljef3.tif")
    gdal.Warp(
        izlaz,
        izvor,
        outputBounds=(x0, y0, x1, y1),
        xRes=KORAK_M,
        yRes=KORAK_M,
        resampleAlg="average",
        srcNodata=PRAZNO,
        dstNodata=PRAZNO,
        format="GTiff",
    )
    ds = gdal.Open(izlaz)
    a = ds.GetRasterBand(1).ReadAsArray()
    valjano = a != PRAZNO
    logger.info(
        "reljef %d × %d na %.0f m, %.1f–%.1f m n.v., praznih %.2f %%",
        ds.RasterXSize,
        ds.RasterYSize,
        KORAK_M,
        float(a[valjano].min()),
        float(a[valjano].max()),
        100 * (1 - valjano.mean()),
    )
    return izlaz


def zagladi(a: np.ndarray, valjano: np.ndarray, w: int) -> np.ndarray:
    """Box filtar w × w koji preskače prazne ćelije.

    Integralna slika umjesto klizećeg prozora: prozor 3 × 3 nad 2 milijuna
    ćelija je jeftin ovako, a `sliding_window_view` + `nanmean` alocira
    devet punih kopija.

    Args:
        a: Vrijednosti; prazne ćelije smiju biti bilo što.
        valjano: Maska valjanih ćelija.
        w: Stranica prozora u ćelijama (neparna).

    Returns:
        Zaglađene vrijednosti; ondje gdje u prozoru nema nijedne valjane
        ćelije vraća se izvorna vrijednost.
    """
    p = w // 2
    vrijednosti = np.where(valjano, a, 0.0).astype(np.float64)
    tezine = valjano.astype(np.float64)

    def zbroj(m: np.ndarray) -> np.ndarray:
        pad = np.pad(m, p, mode="edge")
        c = pad.cumsum(axis=0).cumsum(axis=1)
        c = np.pad(c, ((1, 0), (1, 0)), mode="constant")
        v, s = m.shape
        return c[w:, w:] - c[:-w, w:] - c[w:, :-w] + c[:-w, :-w]

    zv, zt = zbroj(vrijednosti), zbroj(tezine)
    return np.where(zt > 0, zv / np.maximum(zt, 1e-9), a)


def sjencani_reljef(reljef3: str, radni: str) -> int:
    """Crta višesmjerno sjenčanje i reže ga na XYZ pločice.

    Višesmjerno, a ne s jednim izvorom svjetla pod 315°: kod jednog azimuta
    grebeni okomiti na svjetlo nestanu, a oko ih uz to zna pročitati naopako
    (udubljenje kao izbočina). Terase u kvartu idu na sve strane, pa bi
    jedan azimut polovicu njih izgubio.

    Args:
        reljef3: Raster na KORAK_M metara.
        radni: Direktorij za međurezultate.

    Returns:
        Broj zapisanih pločica.
    """
    sjena = os.path.join(radni, "sjena.tif")
    gdal.DEMProcessing(
        sjena,
        reljef3,
        "hillshade",
        multiDirectional=True,
        zFactor=1.3,
        computeEdges=True,
    )

    # Pločica bez alfe pokrila bi more i rubove punom sivom plohom. Alfa se
    # uzima iz DMR-a, ne iz sjenčanja: sjenčanje i na praznini vrati broj.
    #
    # Uz to se reže na kvart + REZERVA_SJENCANJE_M. Reljef se računa na cijelom
    # obuhvatu karte jer ga mreža visina treba, ali pločice se i objavljuju i
    # drže u gitu, a izvan kvarta ih nitko ne gleda: prije rezanja je 74 %
    # svih pločica bilo na z17, uglavnom nad područjem kroz koje se samo
    # prolazi prema tokovima.
    izvor = gdal.Open(reljef3)
    visine = izvor.GetRasterBand(1).ReadAsArray()
    sjena_ds = gdal.Open(sjena)
    siva = sjena_ds.GetRasterBand(1).ReadAsArray()
    maska = maska_na_mrezi(reljef3, REZERVA_SJENCANJE_M)
    alfa = np.where((visine != PRAZNO) & maska, 255, 0).astype(np.uint8)

    rgba_put = os.path.join(radni, "sjena-rgba.tif")
    rgba = gdal.GetDriverByName("GTiff").Create(
        rgba_put, izvor.RasterXSize, izvor.RasterYSize, 4, gdal.GDT_Byte
    )
    rgba.SetGeoTransform(izvor.GetGeoTransform())
    rgba.SetProjection(izvor.GetProjection())
    for i in (1, 2, 3):
        rgba.GetRasterBand(i).WriteArray(siva)
    rgba.GetRasterBand(4).WriteArray(alfa)
    rgba = None

    if os.path.isdir(IZLAZ_RELJEF):
        for z in range(0, 25):
            shutil.rmtree(os.path.join(IZLAZ_RELJEF, str(z)), ignore_errors=True)
    os.makedirs(IZLAZ_RELJEF, exist_ok=True)

    subprocess.run(
        [
            "gdal2tiles.py",
            "--xyz",
            f"--zoom={ZUM_OD}-{ZUM_DO}",
            "--resampling=bilinear",
            "--webviewer=none",
            "--processes=4",
            "-q",
            rgba_put,
            IZLAZ_RELJEF,
        ],
        check=True,
    )

    # gdal2tiles uz pločice ostavlja i svoj opis skupa; karta ga ne čita.
    for smece in ("tilemapresource.xml", "googlemaps.html", "openlayers.html", "leaflet.html"):
        put = os.path.join(IZLAZ_RELJEF, smece)
        if os.path.exists(put):
            os.remove(put)

    broj, prazne, prije, poslije = 0, 0, 0, 0
    for koren, _, datoteke in os.walk(IZLAZ_RELJEF):
        for d in datoteke:
            if not d.endswith(".png"):
                continue
            put = os.path.join(koren, d)
            velicina = os.path.getsize(put)
            stisnuta = _stisni_plocicu(put)
            if stisnuta is None:
                # Potpuno prozirna pločica ne crta ništa, a i dalje bi bila
                # zahtjev, bajtovi i zapis u gitu. gdal2tiles ih uglavnom sam
                # preskoči jer pokriva puni pravokutnik rastera, a granica
                # kvarta pravokutnik nije — ovo je ograda ako se to promijeni.
                prazne += 1
                continue
            broj += 1
            prije += velicina
            poslije += stisnuta

    # Prazni direktoriji ostaju iza brisanja i samo zbunjuju pri pregledu.
    for koren, mape, datoteke in os.walk(IZLAZ_RELJEF, topdown=False):
        if not datoteke and not mape and koren != IZLAZ_RELJEF:
            os.rmdir(koren)

    logger.info(
        "sjenčani reljef: %d pločica, %.1f MB (RGBA bi bilo %.1f MB), zumovi %d–%d; "
        "izbačeno %d praznih izvan kvarta + %.0f m",
        broj,
        poslije / 1e6,
        prije / 1e6,
        ZUM_OD,
        ZUM_DO,
        prazne,
        REZERVA_SJENCANJE_M,
    )
    return broj


def _stisni_plocicu(put: str) -> int | None:
    """Prepisuje pločicu kao sivu s alfom umjesto RGBA; praznu briše.

    Sjenčanje je sivo — tri jednaka kanala nose isti bajt tri puta. Repozitorij
    je javan i pločice u njemu ostaju zauvijek, a i „sporija veza je normalna”
    je zapisana obveza, pa se plaća jednom ovdje umjesto pri svakom učitavanju.

    Provjera praznine ide ovdje, a ne u zasebnom prolazu, da se svaka pločica
    otvori jednom umjesto dvaput.

    Args:
        put: Putanja do PNG pločice; prepisuje se ili briše na mjestu.

    Returns:
        Veličina zapisane datoteke u bajtovima, ili `None` ako je pločica bila
        potpuno prozirna pa je obrisana.
    """
    from PIL import Image

    with Image.open(put) as slika:
        siva_alfa = slika.convert("LA")
    if siva_alfa.getchannel("A").getextrema()[1] == 0:
        os.remove(put)
        return None
    siva_alfa.save(put, format="PNG", optimize=True)
    return os.path.getsize(put)


def mreza_visina(reljef3: str, radni: str) -> dict[str, object]:
    """Prebacuje visine u pravilnu lon/lat mrežu i zapisuje ih kao int16 dm.

    Lon/lat, a ne EPSG:3765, jer se mreža čita po kliku na karti: u lon/lat
    je očitanje dijeljenje i zaokruživanje, a u metričkom bi svaki klik tražio
    reprojekciju točke na poslužitelju.

    Args:
        reljef3: Raster na KORAK_M metara (EPSG:3765).
        radni: Direktorij za međurezultate.

    Returns:
        Zaglavlje mreže — isti objekt koji ide u visine.json.
    """
    z, j, i, s = OBUHVAT
    # Korak u stupnjevima biran tako da na ovoj širini bude ~KORAK_M metara.
    sredina = math.radians((j + s) / 2)
    d_lat = KORAK_M / 111_320.0
    d_lon = KORAK_M / (111_320.0 * math.cos(sredina))
    stupaca = int(round((i - z) / d_lon))
    redaka = int(round((s - j) / d_lat))

    put = os.path.join(radni, "visine4326.tif")
    gdal.Warp(
        put,
        reljef3,
        dstSRS="EPSG:4326",
        outputBounds=(z, j, i, s),
        width=stupaca,
        height=redaka,
        resampleAlg="bilinear",
        srcNodata=PRAZNO,
        dstNodata=PRAZNO,
        format="GTiff",
    )

    # Skup se drži u varijabli: `gdal.Open(...).GetRasterBand(1)` pusti skup
    # da ga sakupljač pokupi prije čitanja, a pojas ostane visjeti nad ničim.
    warpan = gdal.Open(put)
    a = warpan.GetRasterBand(1).ReadAsArray().astype(np.float64)
    valjano = a != PRAZNO
    # Decimetri: raspon kvarta je 0–400 m, dakle 0–4000 dm, a int16 nosi do
    # 32767. Prazno je -32768 i ne može se pomiješati s valjanom visinom.
    dm = np.where(valjano, np.round(a * 10), -32768)
    dm = np.clip(dm, -32768, 32767).astype("<i2")

    os.makedirs(IZLAZ_RELJEF, exist_ok=True)
    binarno = os.path.join(IZLAZ_RELJEF, "visine.bin.gz")
    # `mtime=0` da izlaz bude ponovljiv: gzip inače u zaglavlje upiše trenutak
    # pakiranja, pa svako ponovno pokretanje skripte proizvede drugačiju
    # datoteku od 1,6 MB iako su visine do bajta iste — i git je uredno zabilježi
    # kao promjenu.
    with open(binarno, "wb") as sirovo:
        with gzip.GzipFile(fileobj=sirovo, mode="wb", compresslevel=9, mtime=0) as f:
            f.write(dm.tobytes(order="C"))

    zaglavlje = {
        "zapad": z,
        "jug": j,
        "istok": i,
        "sjever": s,
        "stupaca": stupaca,
        "redaka": redaka,
        # Sjever je PRVI redak — isti redoslijed kojim raster leži na disku.
        "prviRedakJe": "sjever",
        "jedinica": "dm",
        "prazno": -32768,
        "korakM": KORAK_M,
        "izvor": "DGU DMR (LiDAR), geoportal.dgu.hr WCS",
    }
    with open(os.path.join(IZLAZ_RELJEF, "visine.json"), "w", encoding="utf-8") as f:
        json.dump(zaglavlje, f, ensure_ascii=False, indent=2)
        f.write("\n")

    logger.info(
        "mreža visina: %d × %d (%.1f MB sirovo, %.1f MB gzipano), praznih %.2f %%",
        stupaca,
        redaka,
        dm.nbytes / 1e6,
        os.path.getsize(binarno) / 1e6,
        100 * (1 - valjano.mean()),
    )
    return zaglavlje


def granica_3765(rezerva_m: float) -> ogr.Geometry:
    """Granica kvarta, spojena i proširena za `rezerva_m`, u EPSG:3765.

    Args:
        rezerva_m: Koliko metara oko granice ostaje unutar maske.

    Returns:
        Jedna geometrija u metrima.
    """
    izvor = ogr.Open(GRANICA)  # drži se: bez reference GDAL počisti sloj
    spoj = ogr.Geometry(ogr.wkbMultiPolygon)
    for obiljezje in izvor.GetLayer(0):
        spoj.AddGeometry(obiljezje.GetGeometryRef())
    spoj = spoj.UnionCascaded()
    # Širenje ide u metrima, dakle u projiciranom sustavu; u stupnjevima bi
    # „120” značilo 120 stupnjeva, a i rezerva bi po sjeveru i istoku ispala
    # različita.
    spoj.Transform(pretvorba(4326, 3765))
    return spoj.Buffer(rezerva_m)


def granica_datoteka(radni: str, rezerva_m: float, ime: str) -> str:
    """Ista granica zapisana kao GeoJSON u 4326, za `ogr2ogr -clipsrc`.

    Args:
        radni: Direktorij za međurezultate.
        rezerva_m: Rezerva oko granice, u metrima.
        ime: Ime datoteke bez nastavka.

    Returns:
        Putanja do GeoJSON-a s jednim poligonom (EPSG:4326).
    """
    spoj = granica_3765(rezerva_m)
    spoj.Transform(pretvorba(3765, 4326))
    put = os.path.join(radni, f"{ime}.geojson")
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    ds = ogr.GetDriverByName("GeoJSON").CreateDataSource(put)
    sloj = ds.CreateLayer("granica", srs=srs, geom_type=ogr.wkbPolygon)
    f = ogr.Feature(sloj.GetLayerDefn())
    f.SetGeometry(spoj)
    sloj.CreateFeature(f)
    ds = None
    return put


def maska_na_mrezi(reljef3: str, rezerva_m: float) -> np.ndarray:
    """Rasterizira granicu s rezervom na mrežu reljefa.

    Args:
        reljef3: Raster čiju mrežu maska mora slijediti.
        rezerva_m: Rezerva oko granice, u metrima.

    Returns:
        Logička maska: `True` unutar granice s rezervom.
    """
    izvor = gdal.Open(reljef3)
    ds = gdal.GetDriverByName("MEM").Create(
        "", izvor.RasterXSize, izvor.RasterYSize, 1, gdal.GDT_Byte
    )
    ds.SetGeoTransform(izvor.GetGeoTransform())
    ds.SetProjection(izvor.GetProjection())

    srs = osr.SpatialReference()
    srs.ImportFromEPSG(3765)
    vds = ogr.GetDriverByName("MEM").CreateDataSource("maska")
    sloj = vds.CreateLayer("g", srs=srs, geom_type=ogr.wkbPolygon)
    f = ogr.Feature(sloj.GetLayerDefn())
    f.SetGeometry(granica_3765(rezerva_m))
    sloj.CreateFeature(f)
    gdal.RasterizeLayer(ds, [1], sloj, burn_values=[1])
    return ds.GetRasterBand(1).ReadAsArray().astype(bool)


def izohipse(reljef3: str, radni: str) -> int:
    """Zaglađuje reljef i crta izohipse na EKVIDISTANCIJA metara.

    Args:
        reljef3: Raster na KORAK_M metara.
        radni: Direktorij za međurezultate.

    Returns:
        Broj zapisanih crta.
    """
    ds = gdal.Open(reljef3)
    a = ds.GetRasterBand(1).ReadAsArray().astype(np.float64)
    valjano = a != PRAZNO
    glatko = np.where(valjano, zagladi(a, valjano, ZAGLADI), PRAZNO)

    put = os.path.join(radni, "glatko.tif")
    izlaz = gdal.GetDriverByName("GTiff").Create(
        put, ds.RasterXSize, ds.RasterYSize, 1, gdal.GDT_Float32
    )
    izlaz.SetGeoTransform(ds.GetGeoTransform())
    izlaz.SetProjection(ds.GetProjection())
    izlaz.GetRasterBand(1).WriteArray(glatko)
    izlaz.GetRasterBand(1).SetNoDataValue(PRAZNO)
    izlaz = None

    gpkg = os.path.join(radni, "izohipse.gpkg")
    subprocess.run(
        ["gdal_contour", "-q", "-a", "visina", "-i", str(EKVIDISTANCIJA), put, gpkg, "-f", "GPKG"],
        check=True,
    )
    # Rezanje na kvart, i to je bitno za veličinu datoteke.
    #
    # Reljef se računa na cijelom obuhvatu karte (4,9 × 3,7 km), jer sjenčanje
    # i mreža visina to trebaju. Izohipse ne: one su JEDNA datoteka koju
    # preglednik povuče cijelu, za razliku od pločica, kojih se dohvate samo
    # one u oknu. Neodrezane su pokrivale 18,0 km² za kvart od 1,7 km² —
    # deset puta više crta nego što itko gleda, u svakom učitavanju.
    #
    # Tokovi su svjesna iznimka od ovog pravila (ista bujica ne postaje drugi
    # objekt kad prijeđe granicu); izohipsa nema takav razlog — teren izvan
    # kvarta ne objašnjava ništa o kvartu.
    subprocess.run(
        [
            "ogr2ogr",
            "-f", "GeoJSON",
            "-t_srs", "EPSG:4326",
            "-clipsrc", granica_datoteka(radni, REZERVA_M, "granica-rezerva"),
            "-lco", "COORDINATE_PRECISION=6",
            "-simplify", str(POJEDNOSTAVI),
            "-nln", "izohipse",
            IZLAZ_IZOHIPSE,
            gpkg,
        ],
        check=True,
    )

    with open(IZLAZ_IZOHIPSE, encoding="utf-8") as f:
        zbirka = json.load(f)
    # Deblja crta svakih 10 m nosi čitanje karte: bez nje se u nizu jednakih
    # izohipsi ne vidi koja je koja, a s njom se visina broji od najbliže
    # označene. Prag je zapisan uz crtu, da ga stil na karti ne pogađa.
    for crta in zbirka["features"]:
        visina = crta["properties"].get("visina")
        crta["properties"] = {
            "visina": visina,
            "glavna": visina is not None and abs(visina % 10) < 1e-6,
        }
    zbirka["nazivSloja"] = "izohipse"
    with open(IZLAZ_IZOHIPSE, "w", encoding="utf-8") as f:
        json.dump(zbirka, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    glavnih = sum(1 for c in zbirka["features"] if c["properties"]["glavna"])
    logger.info(
        "izohipse: %d crta (%d glavnih), ekvidistancija %.0f m, %.2f MB",
        len(zbirka["features"]),
        glavnih,
        EKVIDISTANCIJA,
        os.path.getsize(IZLAZ_IZOHIPSE) / 1e6,
    )
    return len(zbirka["features"])


def provjeri(zaglavlje: dict[str, object], reljef3: str) -> None:
    """Uspoređuje očitanje iz mreže s izvornim DMR-om na nasumičnim točkama.

    Mreža prolazi kroz dvije promjene razlučivosti i jednu reprojekciju, pa
    tvrdnja „ovo je visina vaše čestice” traži mjeru koliko se pritom izgubilo.
    """
    ds = gdal.Open(reljef3)
    gt = ds.GetGeoTransform()
    a = ds.GetRasterBand(1).ReadAsArray()

    with gzip.open(os.path.join(IZLAZ_RELJEF, "visine.bin.gz"), "rb") as f:
        mreza = np.frombuffer(f.read(), dtype="<i2").reshape(
            int(zaglavlje["redaka"]), int(zaglavlje["stupaca"])
        )

    t = pretvorba(4326, 3765)
    rng = np.random.default_rng(7)
    razlike = []
    z, j, i, s = OBUHVAT
    for _ in range(2000):
        lon = float(rng.uniform(z, i))
        lat = float(rng.uniform(j, s))
        c = int((lon - z) / (i - z) * int(zaglavlje["stupaca"]))
        r = int((s - lat) / (s - j) * int(zaglavlje["redaka"]))
        iz_mreze = mreza[r, c]
        if iz_mreze == -32768:
            continue
        x, y = t.TransformPoint(lon, lat)[:2]
        col = int((x - gt[0]) / gt[1])
        row = int((y - gt[3]) / gt[5])
        if not (0 <= row < a.shape[0] and 0 <= col < a.shape[1]):
            continue
        izvorno = a[row, col]
        if izvorno == PRAZNO:
            continue
        razlike.append(abs(iz_mreze / 10 - izvorno))

    if razlike:
        d = np.array(razlike)
        logger.info(
            "provjera mreže na %d točaka: medijan %.2f m, 95. percentil %.2f m, najgore %.2f m",
            len(d),
            float(np.median(d)),
            float(np.percentile(d, 95)),
            float(d.max()),
        )


def main() -> None:
    """Skida DMR po potrebi i izrađuje sve reljefne izlaze."""
    izvor = skini_dmr()
    with tempfile.TemporaryDirectory(prefix="reljef-") as radni:
        reljef3 = izrezi_i_spusti(izvor, radni)
        zaglavlje = mreza_visina(reljef3, radni)
        izohipse(reljef3, radni)
        sjencani_reljef(reljef3, radni)
        provjeri(zaglavlje, reljef3)
    logger.info("gotovo")


if __name__ == "__main__":
    main()
