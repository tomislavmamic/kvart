#!/usr/bin/env python3
"""Izvodi površinske tokove vode iz DGU-ova LiDAR reljefa.

O prirodnoj vodi u kvartu nema podatka. Gradski GIS izvoz ima samo izvedene
mreže — vodoopskrbu i odvodnju; `vodovod_izvor.shp` je prazan. U OSM-u su
unutar granice kvarta točno dva neimenovana jarka. Jedini vektorski trag
bujice je natpis „BUJIČNI KANAL” pokupljen vektorizacijom DPU-a, koji označava
gdje kanal prolazi, ali ne kuda teče.

Kuda voda teče, međutim, određuje reljef, a reljef je objavljen: DGU nudi
DMR iz LiDAR-a preko WCS-a, u koracima od 1 m, kao pravi Float32 (WMS na
istom servisu vraća samo hipsometrijsku sliku — treba WCS). Iz njega se
tokovi računaju, ne prepisuju.

Postupak: Priority-Flood punjenje depresija (Barnes i dr., 2014.), D8
usmjeravanje po najstrmijem padu, pa akumulacija po topološkom redoslijedu.
Crta se ono što skuplja barem PRAG_M2 uzvodne površine.

Prozor je 6 × 5 km, znatno veći od kvarta, jer tok ne počinje ni ne završava
na granici kotara. Prema sjeveru seže do razvodnice pod Kozjakom, a prema
zapadu do mora kod Vranjica. Kvart je usred toga, ne na kraju.

Obuhvat rezultata nije ni kvart ni prozor nego vodni sustav kojem kvart
pripada: sliv koji se kroz njega slijeva (326 ha, ne dodiruje rub prozora,
dakle izvori su unutra) plus deblo kojim ta voda odlazi do mora. Granica
kotara u sloju se NE vidi — ista bujica ne postaje drugi objekt kad je
prijeđe. Veličinu grane nosi `sliv_ha`, a `rang` je njegov razred; jedino
to na karti mijenja debljinu i boju.

Depresije se NE objavljuju. Unutar kvarta ih je 15, sve do zadnje dodiruju
cestu, a devet se preklapa sa zgradama do 95 % — to su rupe u interpolaciji
ispod uklonjenih zgrada i nasipi cesta pod kojima DMR ne vidi propust, a ne
ponikve. Vani, prema Kozjaku, ima ih stvarnih (do 27 m dubine, kamenolomi).

Rezultat: public/geo/tokovi.geojson (EPSG:4326)

Pokretanje:  /opt/homebrew/bin/python3 scripts/izvedi-tokove.py
Traži:       GDAL s Python vezama i numpy, te mrežu do geoportal.dgu.hr
"""
from __future__ import annotations

import heapq
import json
import logging
import math
import os
import urllib.request

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KORIJEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRANICA = os.path.join(KORIJEN, "public", "geo", "granica.geojson")
IZLAZ = os.path.join(KORIJEN, "public", "geo", "tokovi.geojson")
PREDMEMORIJA = os.path.join(KORIJEN, ".cache", "dmr.tif")
PODRUCJE = os.path.join(KORIJEN, ".cache", "podrucje-kvarta.geojson")

WCS = "https://geoportal.dgu.hr/services/dmr/wcs"
POKRIVENOST = "dmr__DMR_BW"  # jedini sloj s pravim visinama, ne slikom

# Kvart je E 499070–500817, N 4820064–4821053 (EPSG:3765). Prozor ga drži u
# sredini: sjeverni rub na razvodnici pod Kozjakom, zapadni u moru kod
# Vranjica, da tok ima i izvor i ušće unutar računa.
PROZOR = (496500, 4818500, 502500, 4823500)

KORAK = 2  # m — na koliko se spušta izvorni 1 m raster
EPS = 1e-4  # nagib nametnut preko ravnina da usmjeravanje ne stane
PRAG_M2 = 10_000  # uzvodne površine prije nego se povuče crta
PRAG_IZLAZA_M2 = 50_000  # sliv koji tok mora nositi da mu se prati cijeli put
POJEDNOSTAVI = 2.0  # m — Douglas-Peucker, u metrima (EPSG:3765)

_SUSJEDI = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def _pretvorba(iz_epsg: int, u_epsg: int) -> osr.CoordinateTransformation:
    """Transformacija između dva EPSG-a u uobičajenom redoslijedu osi."""
    a = osr.SpatialReference()
    a.ImportFromEPSG(iz_epsg)
    a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    b = osr.SpatialReference()
    b.ImportFromEPSG(u_epsg)
    b.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(a, b)


def skini_dmr() -> str:
    """Skida DMR s DGU WCS-a; drugi put čita iz .cache/."""
    if os.path.exists(PREDMEMORIJA):
        logger.info("DMR iz predmemorije: %s", PREDMEMORIJA)
        return PREDMEMORIJA
    os.makedirs(os.path.dirname(PREDMEMORIJA), exist_ok=True)
    x0, y0, x1, y1 = PROZOR
    url = (
        f"{WCS}?service=WCS&version=2.0.1&request=GetCoverage"
        f"&coverageId={POKRIVENOST}&format=image/tiff"
        f"&subset=E({x0},{x1})&subset=N({y0},{y1})"
    )
    logger.info("skidam DMR (%d × %d m)...", x1 - x0, y1 - y0)
    with urllib.request.urlopen(url, timeout=300) as odgovor:
        podaci = odgovor.read()
    with open(PREDMEMORIJA, "wb") as f:
        f.write(podaci)
    logger.info("  %.1f MB", len(podaci) / 1e6)
    return PREDMEMORIJA


def ucitaj_reljef(putanja: str) -> tuple[np.ndarray, np.ndarray, tuple[float, ...]]:
    """Čita DMR, spušta ga na KORAK metara i izdvaja more.

    LiDAR s vodene plohe nema odboj, pa DMR ondje nosi -9999. U ovom prozoru
    to nije šum nego Vranjičko-solinski zaljev: rupa je jedan sklop na
    sjeverozapadu (E 496500–498167, N 4820808–4822085), a valjane visine uz
    njegov rub padaju na -0,3 m. Prazno se zato ne popunjava nego proglašava
    morem — ono je odredište tokova, ne manjak podatka.

    Srednja vrijednost pri spuštanju uzima samo valjane ćelije; inače bi
    jedna rupa povukla cijelu ćeliju na -9999 i „potopila” susjedstvo.
    """
    ds = gdal.Open(putanja)
    a = ds.GetRasterBand(1).ReadAsArray().astype(np.float64)
    gt = ds.GetGeoTransform()
    prazno = a == -9999

    v, s = a.shape
    v2, s2 = v // KORAK, s // KORAK
    a = a[: v2 * KORAK, : s2 * KORAK]
    prazno = prazno[: v2 * KORAK, : s2 * KORAK]
    blok = (v2, KORAK, s2, KORAK)
    valjano = (~prazno).reshape(blok).sum(axis=(1, 3))
    zbroj = np.where(prazno, 0.0, a).reshape(blok).sum(axis=(1, 3))
    more = valjano == 0
    reljef = np.where(more, 0.0, zbroj / np.maximum(valjano, 1))

    gt2 = (gt[0], gt[1] * KORAK, 0.0, gt[3], 0.0, gt[5] * KORAK)
    logger.info(
        "reljef %d × %d na %d m, %.0f–%.0f m n.v., more %.1f %% ćelija",
        v2,
        s2,
        KORAK,
        reljef[~more].min(),
        reljef[~more].max(),
        100 * more.mean(),
    )
    return reljef, more, gt2


def napuni_depresije(reljef: np.ndarray, more: np.ndarray) -> np.ndarray:
    """Priority-Flood s epsilonom — vraća reljef bez zatvorenih udubina.

    Sjeme su rubovi prozora i more: i jedno i drugo su mjesta na kojima voda
    napušta račun, pa se depresije pune prema njima.
    """
    v, s = reljef.shape
    puni = np.full((v, s), np.inf)
    zatvoren = np.zeros((v, s), dtype=bool)
    red: list[tuple[float, int, int]] = []

    def sjeme(r: int, c: int) -> None:
        if not zatvoren[r, c]:
            heapq.heappush(red, (float(reljef[r, c]), r, c))
            zatvoren[r, c] = True

    for r in range(v):
        sjeme(r, 0)
        sjeme(r, s - 1)
    for c in range(s):
        sjeme(0, c)
        sjeme(v - 1, c)
    for r, c in zip(*np.nonzero(more)):
        sjeme(int(r), int(c))

    while red:
        e, r, c = heapq.heappop(red)
        puni[r, c] = e
        for dr, dc in _SUSJEDI:
            nr, nc = r + dr, c + dc
            if 0 <= nr < v and 0 <= nc < s and not zatvoren[nr, nc]:
                zatvoren[nr, nc] = True
                heapq.heappush(red, (max(float(reljef[nr, nc]), e + EPS), nr, nc))

    return puni


def usmjeri(puni: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """D8 po najstrmijem padu. Vraća (nizvodni indeks, slivna površina m²)."""
    v, s = puni.shape
    n = v * s
    nizvodno = np.full(n, -1, dtype=np.int64)
    najbolji = np.zeros(n, dtype=np.float64)

    for dr, dc in _SUSJEDI:
        udaljenost = math.hypot(dr * KORAK, dc * KORAK)
        r0, r1 = max(0, -dr), v - max(0, dr)
        c0, c1 = max(0, -dc), s - max(0, dc)
        pad = (puni[r0:r1, c0:c1] - puni[r0 + dr : r1 + dr, c0 + dc : c1 + dc]) / udaljenost

        rr, cc = np.meshgrid(np.arange(r0, r1), np.arange(c0, c1), indexing="ij")
        ovdje = (rr * s + cc).ravel()
        tamo = ((rr + dr) * s + (cc + dc)).ravel()
        p = pad.ravel()

        bolje = p > najbolji[ovdje]
        nizvodno[ovdje[bolje]] = tamo[bolje]
        najbolji[ovdje[bolje]] = p[bolje]

    sliv = np.full(n, KORAK * KORAK, dtype=np.float64)
    for i in np.argsort(puni.ravel())[::-1]:  # od vrha prema dnu = topološki
        d = nizvodno[i]
        if d >= 0:
            sliv[d] += sliv[i]

    return nizvodno, sliv


def provjeri_sliv(sliv_maska: np.ndarray) -> None:
    """Dodiruje li sliv kvarta rub prozora — je li mu odsječen izvor.

    Provjera na cijelom sjevernom rubu bila je pretupa: rub prozora širok
    6 km presijeca i slivove koji s kvartom nemaju veze, pa je javljala
    manjak ondje gdje ga za kvart nema. Mjeri se zato samo sliv koji doista
    prolazi kvartom.
    """
    v, s = sliv_maska.shape
    rub = int(
        sliv_maska[0, :].sum()
        + sliv_maska[v - 1, :].sum()
        + sliv_maska[:, 0].sum()
        + sliv_maska[:, s - 1].sum()
    )
    povrsina = float(sliv_maska.sum()) * KORAK * KORAK / 10_000
    if rub:
        logger.warning(
            "sliv kvarta (%.0f ha) dodiruje rub prozora na %d ćelija — izvor je odsječen",
            povrsina,
            rub,
        )
    else:
        logger.info("sliv kvarta %.0f ha, ne dodiruje rub prozora — izvori su unutra", povrsina)


def u_crte(
    sliv: np.ndarray, nizvodno: np.ndarray, v: int, s: int, podrucje: np.ndarray
) -> list[tuple[list[int], float]]:
    """Reže D8 mrežu na poteze na račvama, unutar zadanog područja."""
    tok = (sliv >= PRAG_M2) & podrucje
    ulazni = np.zeros(v * s, dtype=np.int32)
    izvori = np.nonzero(tok)[0]
    ciljevi = nizvodno[izvori]
    valjani = (ciljevi >= 0) & tok[np.maximum(ciljevi, 0)]
    np.add.at(ulazni, ciljevi[valjani], 1)

    pocetci = set(np.nonzero(tok & (ulazni == 0))[0].tolist())
    pocetci |= set(np.nonzero(tok & (ulazni >= 2))[0].tolist())

    crte: list[tuple[list[int], float]] = []
    for p in pocetci:
        put = [int(p)]
        tekuci = int(p)
        while True:
            sljedeci = int(nizvodno[tekuci])
            if sljedeci < 0 or not tok[sljedeci]:
                break
            put.append(sljedeci)
            if ulazni[sljedeci] >= 2:
                break
            tekuci = sljedeci
        if len(put) >= 3:
            # Slivna se čita s pretposljednje ćelije: potez završava NA račvi,
            # a ona već nosi zbroj obiju grana, pa bi žilica koja se ulijeva u
            # veliki tok time dobila tuđu površinu i krivi rang.
            crte.append((put, float(sliv[put[-2]])))
    return crte


def rang_po_slivu(ha: float) -> int:
    """Razred veličine grane prema uzvodnom slivu.

    Jedina stvar koju debljina i boja crte na karti kazuju. Granica kvarta
    se namjerno NE vidi u stilu: ista bujica ne postaje drugi objekt kad
    prijeđe granicu kotara, a crtkanje izvan kvarta je sugeriralo da je
    ondje slabije izmjerena — nije, isti je račun na istom reljefu.
    """
    if ha >= 100:
        return 4
    if ha >= 20:
        return 3
    if ha >= 5:
        return 2
    return 1


def zapisi(crte: list[tuple[list[int], float]], gt: tuple[float, ...], s: int) -> None:
    """Pojednostavljuje i piše mrežu kao jedan GeoJSON u 4326."""
    u_4326 = _pretvorba(3765, 4326)
    obiljezja = []
    duljina = 0.0
    po_rangu: dict[int, float] = {}

    for put, slivna in crte:
        g = ogr.Geometry(ogr.wkbLineString)
        for i in put:
            r, c = divmod(i, s)
            g.AddPoint_2D(gt[0] + (c + 0.5) * gt[1], gt[3] + (r + 0.5) * gt[5])
        g = g.SimplifyPreserveTopology(POJEDNOSTAVI)
        if g.GetPointCount() < 2 or g.Length() < KORAK:
            continue
        duljina += g.Length()

        ha = slivna / 10_000
        rang = rang_po_slivu(ha)
        po_rangu[rang] = po_rangu.get(rang, 0.0) + g.Length()
        g.Transform(u_4326)
        geom = json.loads(g.ExportToJson())
        geom["coordinates"] = _zaokruzi(geom["coordinates"])
        obiljezja.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "sliv_ha": round(ha, 2),
                    "rang": rang,
                    "izvor": "izvedeno iz DGU DMR 1 m (LiDAR), D8 analiza",
                },
            }
        )

    obiljezja.sort(key=lambda f: -f["properties"]["sliv_ha"])
    with open(IZLAZ, "w") as f:
        json.dump({"type": "FeatureCollection", "features": obiljezja}, f)
    logger.info(
        "zapisano %d poteza, %.1f km -> %s",
        len(obiljezja),
        duljina / 1000,
        os.path.relpath(IZLAZ, KORIJEN),
    )
    for rang in sorted(po_rangu):
        logger.info("  rang %d: %.1f km", rang, po_rangu[rang] / 1000)


def _zaokruzi(c: list) -> list:
    """Reže koordinate na 7 decimala (~1 cm) da datoteka ne nabuja."""
    if c and isinstance(c[0], (int, float)):
        return [round(x, 7) for x in c]
    return [_zaokruzi(x) for x in c]


def _granica_3765() -> ogr.Geometry:
    """Granica kvarta u EPSG:3765, spojena u jednu geometriju."""
    izvor = ogr.Open(GRANICA)  # drži se: bez reference GDAL počisti sloj
    g = ogr.Geometry(ogr.wkbMultiPolygon)
    for obiljezje in izvor.GetLayer(0):
        g.AddGeometry(obiljezje.GetGeometryRef())
    g = g.UnionCascaded()
    g.Transform(_pretvorba(4326, 3765))
    return g


def maska_kvarta(gt: tuple[float, ...], v: int, s: int) -> np.ndarray:
    """Rasterizira granicu kvarta na mrežu računa."""
    ds = gdal.GetDriverByName("MEM").Create("", s, v, 1, gdal.GDT_Byte)
    ds.SetGeoTransform(gt)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(3765)
    ds.SetProjection(srs.ExportToWkt())
    vds = ogr.GetDriverByName("MEM").CreateDataSource("m")
    lyr = vds.CreateLayer("g", srs=srs, geom_type=ogr.wkbPolygon)
    f = ogr.Feature(lyr.GetLayerDefn())
    f.SetGeometry(_granica_3765())
    lyr.CreateFeature(f)
    gdal.RasterizeLayer(ds, [1], lyr, burn_values=[1])
    return ds.GetRasterBand(1).ReadAsArray().astype(bool)


def _uzvodni_indeks(nizvodno: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Obrnuti graf: za ćeliju daje raspon njezinih uzvodnih susjeda.

    Rječnik s milijun ključeva ovdje je i spor i težak, pa se obrnuti graf
    drži kao jedno polje posloženo po odredištu plus indeks početaka —
    uzvodni susjedi ćelije `i` su `poredak[pocetak[i]:pocetak[i+1]]`.
    """
    n = nizvodno.size
    valjani = np.nonzero(nizvodno >= 0)[0]
    poredak = valjani[np.argsort(nizvodno[valjani], kind="stable")]
    broj = np.bincount(nizvodno[poredak], minlength=n)
    pocetak = np.zeros(n + 1, dtype=np.int64)
    np.cumsum(broj, out=pocetak[1:])
    return poredak, pocetak


def izlazne_tocke(maska: np.ndarray, nizvodno: np.ndarray, sliv: np.ndarray) -> list[int]:
    """Ćelije na kojima znatan tok napušta kvart."""
    m = maska.ravel()
    unutra = np.nonzero(m & (sliv >= PRAG_IZLAZA_M2))[0]
    van = nizvodno[unutra]
    izlaz = unutra[(van < 0) | ~m[np.maximum(van, 0)]]
    return sorted(izlaz.tolist(), key=lambda i: -sliv[i])


def trag_nizvodno(pocetak: int, nizvodno: np.ndarray, more: np.ndarray) -> list[int]:
    """Od zadane ćelije nizvodno do mora ili do ruba prozora."""
    put = [pocetak]
    vidjeno = {pocetak}
    tekuci = pocetak
    while True:
        sljedeci = int(nizvodno[tekuci])
        if sljedeci < 0 or sljedeci in vidjeno:
            break
        put.append(sljedeci)
        vidjeno.add(sljedeci)
        if more[sljedeci]:
            break
        tekuci = sljedeci
    return put


def sliv_uzvodno(izlazi: list[int], poredak: np.ndarray, pocetci: np.ndarray, n: int) -> np.ndarray:
    """Sve ćelije koje se slijevaju kroz zadane izlaze."""
    u_slivu = np.zeros(n, dtype=bool)
    stog = list(izlazi)
    u_slivu[izlazi] = True
    while stog:
        i = stog.pop()
        for gore in poredak[pocetci[i] : pocetci[i + 1]]:
            g = int(gore)
            if not u_slivu[g]:
                u_slivu[g] = True
                stog.append(g)
    return u_slivu


def trag_uzvodno(
    pocetak: int, poredak: np.ndarray, pocetci: np.ndarray, sliv: np.ndarray
) -> list[int]:
    """Glavni krak uzvodno — na svakoj račvi ide se za većim slivom.

    To daje jedan potez od izvora do zadane ćelije, a ne cijelo stablo:
    „odakle ova voda dolazi” ima smisleni odgovor samo kao glavni tok.
    """
    put = [pocetak]
    tekuci = pocetak
    while True:
        gore = poredak[pocetci[tekuci] : pocetci[tekuci + 1]]
        if gore.size == 0:
            break
        tekuci = int(gore[np.argmax(sliv[gore])])
        put.append(tekuci)
    put.reverse()
    return put


def podrucje_kvarta(
    maska: np.ndarray,
    nizvodno: np.ndarray,
    sliv: np.ndarray,
    more: np.ndarray,
    v: int,
    s: int,
) -> np.ndarray:
    """Vodni sustav kojem kvart pripada: njegov sliv plus put do mora.

    Nije rez po granici kotara ni pravokutnik oko njega, nego ono što s
    kvartom hidrološki ima veze — sve što se kroz njega slijeva, i deblo
    kojim ta voda dalje odlazi. Pritoke koje se deblu priključe nizvodno
    nisu unutra: one nose tuđu vodu, a ovo je karta ove.
    """
    poredak, pocetci = _uzvodni_indeks(nizvodno)
    izlazi = izlazne_tocke(maska, nizvodno, sliv)
    gornji = sliv_uzvodno(izlazi, poredak, pocetci, v * s)
    provjeri_sliv(gornji.reshape(v, s))

    podrucje = gornji.copy()
    for izlaz in izlazi:
        for i in trag_nizvodno(izlaz, nizvodno, more.ravel()):
            podrucje[i] = True
    return podrucje


def zapisi_podrucje(podrucje: np.ndarray, gt: tuple[float, ...], v: int, s: int) -> None:
    """Sprema obuhvat u .cache/ da se drugi slojevi mogu rezati na isto.

    Bez toga je usporedba besmislena: vektorizirana hidrografija s HOK-a
    pokrivala je cijeli prozor od 6 × 5 km, a ovaj sloj samo vodni sustav
    kvarta, pa je „odstupanje” mjerilo udaljenost do Solina umjesto do
    najbližeg toka.
    """
    os.makedirs(os.path.dirname(PODRUCJE), exist_ok=True)
    ds = gdal.GetDriverByName("MEM").Create("", s, v, 1, gdal.GDT_Byte)
    ds.SetGeoTransform(gt)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(3765)
    ds.SetProjection(srs.ExportToWkt())
    ds.GetRasterBand(1).WriteArray(podrucje.reshape(v, s).astype(np.uint8))

    izlaz = ogr.GetDriverByName("GeoJSON").CreateDataSource(PODRUCJE)
    lyr = izlaz.CreateLayer("podrucje", srs=srs, geom_type=ogr.wkbPolygon)
    lyr.CreateField(ogr.FieldDefn("v", ogr.OFTInteger))
    gdal.Polygonize(ds.GetRasterBand(1), ds.GetRasterBand(1), lyr, 0)
    izlaz = None
    logger.info("obuhvat -> %s", os.path.relpath(PODRUCJE, KORIJEN))


def main() -> None:
    reljef, more, gt = ucitaj_reljef(skini_dmr())
    v, s = reljef.shape
    logger.info("punim depresije...")
    puni = napuni_depresije(reljef, more)
    logger.info("usmjeravam tok...")
    nizvodno, sliv = usmjeri(puni)
    podrucje = podrucje_kvarta(maska_kvarta(gt, v, s), nizvodno, sliv, more, v, s)
    zapisi_podrucje(podrucje, gt, v, s)
    zapisi(u_crte(sliv, nizvodno, v, s, podrucje), gt, s)


if __name__ == "__main__":
    main()
