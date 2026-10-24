#!/usr/bin/env python3
"""Putovi i preuske skupine čestica za kartu /gup/gradnja.

Nasljednik pravila iz scripts/slobodne-parcele.py (kvart, GUP 2015./2024.),
popravljen gdje je griješio i proširen na cijeli GUP 2025. Tamo:

  - uska traka (< 6 m) ostajala je ako je dugom stranom uz susjeda — a
    upravo put dugom stranom dodiruje svaku česticu kojoj služi, pa je
    pravilo spašavalo putove;
  - širina se računala iz površine i opsega kao da je čestica pravokutnik,
    što na zakrivljenim i razgranatim česticama putova ne vrijedi, i to na
    cijeloj čestici, ne na slobodnom dijelu;
  - skupina susjednih čestica prolazila je na površinu (najveći povezan
    komad ≥ 300 m²), bez obzira na oblik: lanac traka spojenih krajevima
    prolazio je iako u njega kuća ne stane;
  - 6 m su samo dva odmaka od 3 m, kuća u njih ne stane.

Isto je slijepo i gradsko računanje u cestice.py: „široko” (krug od 9 m)
mjeri se na slobodnom zemljištu preko međa, pa put širok 5 m između dva
slobodna vrta ispada širok.

Ovdje, u dva koraka:

1. PUT. Čestica je u praksi put ako je uska (najveći upisani krug < 9 m),
   izdužena (duljina ≥ 6 širina) i ima dokaz da služi kao put: OSM put bilo
   koje vrste (i track/path, koje cestice.py namjerno ne broji jer se preko
   poljskog puta gradi) prolazi njome barem 40 % duljine, ili graniči s
   barem 10 različitih čestica, ili dugom stranom leži uz postojeću ulicu
   (rub ceste, nogostup: barem 35 % ruba uz ulicu, dakle ~70 % jedne duge
   strane). Poljske trake (lazi) jedna uz drugu imaju 4–8 susjeda, a ulicu
   dodiruju kraćom stranom, pa ostaju: spajanjem bočno postaju gradilište.
   Put se ne gradi i ne spaja susjede preko sebe. Pravila su provjerena na
   ortofotu, na slučajnom uzorku proglašenih i na najvećim neproglašenima.

2. TLOCRT. Slobodno zemljište zone za gradnju, bez putova i koridora ulica,
   spaja se preko međa (susjedne slobodne čestice smiju se spojiti), ali
   gradilište je samo ono u što stane krug od 10 m (odredbe: građevna
   čestica široka barem 10 m) i čiji je takav dio barem 250 m² (najmanja
   čestica koju plan igdje propisuje za stanovanje). Ostalo je preusko.
   Stambene zone (S, M/K5) spajaju se međusobno, ostale svaka za sebe.

3. MJESTO ZA ZGRADU. Zgrada mora biti 5 m od javne ulice (postojeće,
   planirane, koridora i puta) i 3 m od ostalih međa spojene čestice.
   „Mjesto za zgradu” je samo ono unutar tih odmaka u što stane zgrada
   široka barem 6 m, s tlocrtom od barem 60 m². Karta zeleno (ili plavo)
   boji samo to; ostatak gradilišta je „odmak” (dvorište, prilaz nove
   zgrade), a gradilište u koje zgrada uz odmake uopće ne stane je „zgrada
   ne stane”. Tako ne ostaju zelene ni uske trake ni rubovi uz tuđe zgrade.

Ulaz:  public/geo/gup-grad/regije.json i pločice („po odredbama”, 2025.),
       data/gup-grad/koridori-2025 (koridori.py), data/gup-grad/javno-2025
       (gradnja-javno.py: javno i gradski projekti ne ulaze u spajanje), čestice
       public/geo/gup-grad/cestice, OSM ceste .cache/gup-grad/osm-ceste.json
       (osm.py; bez njih samo pravilo susjeda)
Izlaz: data/gup-grad/skupine-2025/<red>_<stupac>.png — 1 = put, 2 = preusko,
       3 = odmak na gradilištu, 4 = zgrada ne stane uz odmake;
       čita ih scripts/gup-grad/gradnja.ts
       public/geo/gup-grad/putovi-2025.json — čestice proglašene putom, s
       mjerama i razlogom (tumač klika na karti ih navodi)

Pokretanje (poslije koridori.py i gradnja-javno.py, prije gradnja.ts):
  /opt/homebrew/bin/python3 scripts/gup-grad/gradnja-skupine.py
"""
from __future__ import annotations

import glob
import json
import math
import os
import shutil
import sys

import numpy as np
import shapely
from PIL import Image
from pyproj import Transformer
from rasterio import features
from rasterio.transform import Affine
from scipy import ndimage
from shapely.geometry import shape
from shapely.ops import transform as stransform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

JAVNO = os.path.join(R.ROOT, "public")
KORIDORI = os.path.join(R.ROOT, "data", "gup-grad", "koridori-2025")
JAVNE = os.path.join(R.ROOT, "data", "gup-grad", "javno-2025")
IZLAZ = os.path.join(R.ROOT, "data", "gup-grad", "skupine-2025")
IZLAZ_PUTOVA = os.path.join(JAVNO, "geo", "gup-grad", "putovi-2025.json")
OSM_CESTE = os.path.join(R.OUT, "osm-ceste.json")
PLOCICA = 512

# klase (src/lib/gup-grad/model.ts): zone za gradnju i koje se smiju spajati
STAMBENE = (1, 2)  # S, M/K5
GRADEVNE = (1, 2, 3, 4, 5, 6, 7)  # + D, I/K, T, L, R1 (N je vojna zona, R5 golf bez zgrada)
# regije (src/lib/gup-grad/regije.ts): slobodno i slobodni ostaci koji se mogu spojiti, i čeka plan
SLOBODNE_REGIJE = (10, 11, 12, 15)

PUT_SIRINA_M = 9.0
PUT_IZDUZENOST = 6.0
PUT_OSM_UDIO = 0.4
PUT_SUSJEDA = 10
PUT_UZ_ULICU = 0.35
DODIR_M = 0.3
# OSM oznake koje nisu put na tlu
NIJE_PUT = {"platform", "proposed", "construction", "corridor", "elevator", "raceway", "bus_stop"}

TLOCRT_M = 10.0
NAJMANJE_M2 = 250.0
# odmaci zgrade (odredbe GUP-a): od javne prometne površine 5 m, od ostalih međa
# građevne čestice 3 m. Međa je rub spojene skupine slobodnih čestica, ne
# međa svake katastarske čestice u njoj (spojene čestice čine jednu građevnu).
ODMAK_ULICA_M = 5.0
ODMAK_MEDA_M = 3.0
# najmanja zgrada koja mora stati unutar odmaka (naša pretpostavka, ne odredba):
# široka barem 6 m, tlocrta barem 60 m²
ZGRADA_M = 6.0
ZGRADA_M2 = 60.0


def mozaik():
    """Pločice dijelova čestice i koridora složene u jednu mrežu, s geotransformacijom u EPSG:3857."""
    ind = json.load(open(os.path.join(JAVNO, "geo", "gup-grad", "regije.json")))
    korak = ind["korak"]
    plocice = []
    for p in ind["inacice"]["gradevna"]["2025"]:
        r, c = (int(x) for x in os.path.basename(p["url"]).removesuffix(".png").split("_"))
        plocice.append((r, c, p))
    H = (max(r for r, _, _ in plocice) + 1) * PLOCICA
    W = (max(c for _, c, _ in plocice) + 1) * PLOCICA
    klasa = np.zeros((H, W), np.uint8)
    regija = np.zeros((H, W), np.uint8)
    koridor = np.zeros((H, W), bool)
    # javno zemljište i gradski projekti (gradnja-javno.py): ne spajaju se u privatnu građevnu česticu
    nije_privatno = np.zeros((H, W), bool)
    velicina = {}
    for r, c, p in plocice:
        a = np.array(Image.open(os.path.join(JAVNO, p["url"].lstrip("/"))))
        h, w = a.shape[:2]
        velicina[(r, c)] = (h, w)
        na = a[..., 3] == 255
        y0, x0 = r * PLOCICA, c * PLOCICA
        klasa[y0:y0 + h, x0:x0 + w] = np.where(na, a[..., 0], 0)
        regija[y0:y0 + h, x0:x0 + w] = np.where(na, a[..., 1], 0)
        kp = os.path.join(KORIDORI, os.path.basename(p["url"]))
        if os.path.exists(kp):
            koridor[y0:y0 + h, x0:x0 + w] = np.array(Image.open(kp).convert("L")) > 127
        jp = os.path.join(JAVNE, os.path.basename(p["url"]))
        if os.path.exists(jp):
            nije_privatno[y0:y0 + h, x0:x0 + w] = np.array(Image.open(jp)) > 0
    # ishodište iz sjeverozapadnog kuta prve pločice
    r0, c0, p0 = plocice[0]
    (_, zapad), (sjever, _) = p0["granice"]
    x, y = Transformer.from_crs(4326, 3857, always_xy=True).transform(zapad, sjever)
    transform = Affine(korak, 0, x - c0 * PLOCICA * korak, 0, -korak, y + r0 * PLOCICA * korak)
    return klasa, regija, koridor, nije_privatno, transform, korak, plocice, velicina


def cestice():
    """Sve čestice iz pločica (indeks → ko, kc, geometrija u 4326), bez dvostrukih s rubova pločica."""
    out = {}
    for f in glob.glob(os.path.join(JAVNO, "geo", "gup-grad", "cestice", "*.json")):
        for ft in json.load(open(f))["features"]:
            p = ft["properties"]
            if p["i"] not in out and ft["geometry"]:
                out[p["i"]] = (p["ko"], p["kc"], shape(ft["geometry"]))
    return out


def osm_putovi(u_3765) -> list:
    if not os.path.exists(OSM_CESTE):
        print("NEMA", OSM_CESTE, "— pokreni scripts/gup-grad/osm.py; put se prepoznaje samo po susjedima")
        return []
    out = []
    for e in json.load(open(OSM_CESTE))["elements"]:
        t = e.get("tags", {})
        if t.get("highway") in NIJE_PUT or t.get("area") == "yes" or len(e.get("geometry", [])) < 2:
            continue
        x, y = u_3765([p["lon"] for p in e["geometry"]], [p["lat"] for p in e["geometry"]])
        out.append(shapely.linestrings(list(zip(x, y))))
    return out


def udio_ruba_uz_ulicu(rid: np.ndarray, ulica: np.ndarray, oznaka: int) -> float:
    """Koji udio ruba čestice (pikseli na rubu njezine maske) leži uz ulicu."""
    ys, xs = _pikseli(rid, oznaka)
    if len(ys) == 0:
        return 0.0
    y0, y1, x0, x1 = ys.min() - 2, ys.max() + 3, xs.min() - 2, xs.max() + 3
    m = rid[max(0, y0):y1, max(0, x0):x1] == oznaka
    rub = m & ~ndimage.binary_erosion(m)
    if not rub.any():
        return 0.0
    return float((rub & ulica[max(0, y0):y1, max(0, x0):x1]).sum() / rub.sum())


_OKVIRI: dict[int, tuple] = {}


def _pikseli(rid: np.ndarray, oznaka: int):
    """Pikseli čestice, preko okvira izračunatih jednom za sve (ndimage.find_objects)."""
    if not _OKVIRI:
        for i, o in enumerate(ndimage.find_objects(rid), start=1):
            if o is not None:
                _OKVIRI[i] = o
    o = _OKVIRI.get(oznaka)
    if o is None:
        return np.array([]), np.array([])
    ys, xs = np.nonzero(rid[o] == oznaka)
    return ys + o[0].start, xs + o[1].start


def main() -> None:
    klasa, regija, koridor, nije_privatno, transform, korak, plocice, velicina = mozaik()
    slobodno = (regija > 0) & np.isin(regija, SLOBODNE_REGIJE) & np.isin(klasa, GRADEVNE) & ~koridor & ~nije_privatno
    # postojeća ulica, ulica plana i koridor; napuhnuto za ~2 m, da je dodiruje i susjedna međa
    ulica = ndimage.binary_dilation((regija == 3) | (klasa == 15) | koridor, iterations=1)

    sve = cestice()
    kljucevi = np.array(sorted(sve))
    u_3857 = Transformer.from_crs(4326, 3857, always_xy=True).transform
    u_3765 = Transformer.from_crs(4326, 3765, always_xy=True).transform
    rid = features.rasterize(
        ((stransform(u_3857, sve[i][2]), n + 1) for n, i in enumerate(kljucevi)),
        out_shape=klasa.shape, transform=transform, fill=0, dtype="int32",
    )
    s_slobodnim = np.flatnonzero(np.bincount(rid[slobodno], minlength=len(kljucevi) + 1)[1:] > 0)
    print(len(kljucevi), "čestica,", len(s_slobodnim), "sa slobodnim zemljištem zone za gradnju")

    # ---- 1. putovi -------------------------------------------------------
    geo = [stransform(u_3765, sve[i][2]) for i in kljucevi]
    stablo = shapely.STRtree(geo)
    osm = osm_putovi(u_3765)
    stablo_osm = shapely.STRtree(osm) if osm else None
    putovi, opis = set(), []
    for n in s_slobodnim:
        g = geo[n]
        if g.area <= 0:
            continue
        sirina = 2 * shapely.maximum_inscribed_circle(g, 0.2).length
        if sirina >= PUT_SIRINA_M or g.area < PUT_IZDUZENOST * sirina * sirina:
            continue
        duljina = g.area / max(sirina, 0.1)
        susjeda = len(set(stablo.query(g.buffer(DODIR_M), predicate="intersects").tolist()) - {n})
        uz = 0.0
        if stablo_osm is not None:
            okolo = g.buffer(1.0)
            uz = sum(osm[j].intersection(okolo).length for j in stablo_osm.query(okolo, predicate="intersects"))
        osm_udio = uz / duljina
        uz_ulicu = udio_ruba_uz_ulicu(rid, ulica, n + 1)
        razlog = (
            "OSM put uzduž" if osm_udio >= PUT_OSM_UDIO
            else "graniči s mnogo čestica" if susjeda >= PUT_SUSJEDA
            else "dugom stranom uz ulicu" if uz_ulicu >= PUT_UZ_ULICU
            else None
        )
        if razlog:
            putovi.add(n + 1)
            ko, kc, _ = sve[kljucevi[n]]
            opis.append({"ko": ko, "kc": kc, "sirina_m": round(sirina, 1), "duljina_m": round(duljina),
                         "susjeda": susjeda, "osm_udio": round(osm_udio, 2), "uz_ulicu": round(uz_ulicu, 2),
                         "razlog": razlog})
    put = np.isin(rid, list(putovi)) & (rid > 0)

    # ---- 2. tlocrt -------------------------------------------------------
    lat = 43.51
    m_po_px = korak * math.cos(math.radians(lat))
    r = TLOCRT_M / 2 / m_po_px
    n_ = int(math.ceil(r))
    yy, xx = np.mgrid[-n_:n_ + 1, -n_:n_ + 1]
    krug = xx * xx + yy * yy <= r * r
    gradivo = slobodno & ~put
    zadrzano = np.zeros(klasa.shape, bool)
    skupine = [STAMBENE] + [(k,) for k in GRADEVNE if k not in STAMBENE]
    for kl in skupine:
        m = gradivo & np.isin(klasa, kl)
        if not m.any():
            continue
        jezgra = ndimage.binary_opening(m, structure=krug)
        oznake, n = ndimage.label(jezgra)
        if n:
            vel = ndimage.sum_labels(np.ones_like(oznake), oznake, index=np.arange(1, n + 1)) * m_po_px ** 2
            jezgra[np.isin(oznake, np.flatnonzero(vel < NAJMANJE_M2) + 1)] = False
        zadrzano |= jezgra
    preusko = gradivo & ~zadrzano

    # ---- 3. mjesto za zgradu i odmaci -------------------------------------
    # Udaljenosti se mjere od ruba piksela (EDT daje udaljenost do središta
    # susjednog piksela, pa se oduzme pola piksela).
    javna_ulica = (regija == 3) | (klasa == 15) | koridor | put
    do_ulice = (ndimage.distance_transform_edt(~javna_ulica) - 0.5) * m_po_px
    mjesto = np.zeros(klasa.shape, bool)
    odmak = np.zeros(klasa.shape, bool)
    ne_stane = np.zeros(klasa.shape, bool)
    for kl in skupine:
        cestica = zadrzano & np.isin(klasa, kl)
        if not cestica.any():
            continue
        do_mede = (ndimage.distance_transform_edt(cestica) - 0.5) * m_po_px
        unutra = cestica & (do_ulice >= ODMAK_ULICA_M) & (do_mede >= ODMAK_MEDA_M)
        # zgrada široka ZGRADA_M: središta u koja stane krug toga promjera, i sve što takvi krugovi pokriju
        sredista = unutra & ((ndimage.distance_transform_edt(unutra) - 0.5) * m_po_px >= ZGRADA_M / 2)
        zgrada = unutra & (ndimage.distance_transform_edt(~sredista) * m_po_px <= ZGRADA_M / 2)
        oz, nzg = ndimage.label(zgrada)
        if nzg:
            vel = ndimage.sum_labels(np.ones_like(oz), oz, index=np.arange(1, nzg + 1)) * m_po_px ** 2
            zgrada[np.isin(oz, np.flatnonzero(vel < ZGRADA_M2) + 1)] = False
        oc, nc = ndimage.label(cestica)
        ima = np.zeros(nc + 1, bool)
        ima[np.unique(oc[zgrada])] = True
        ima[0] = False
        mjesto |= zgrada
        odmak |= cestica & ~zgrada & ima[oc]
        ne_stane |= cestica & ~ima[oc]

    # ---- izlaz -------------------------------------------------------------
    if os.path.isdir(IZLAZ):
        shutil.rmtree(IZLAZ)
    os.makedirs(IZLAZ)
    oznaka = np.select([put, preusko, odmak, ne_stane], [1, 2, 3, 4], 0).astype(np.uint8)
    for r0, c0, p in plocice:
        h, w = velicina[(r0, c0)]
        t = oznaka[r0 * PLOCICA:r0 * PLOCICA + h, c0 * PLOCICA:c0 * PLOCICA + w]
        if t.any():
            Image.fromarray(t, "L").save(os.path.join(IZLAZ, os.path.basename(p["url"])), optimize=True)
    opis.sort(key=lambda d: (d["ko"], d["kc"]))
    with open(IZLAZ_PUTOVA, "w") as f:
        json.dump({"opis": "Čestice koje gradnja-skupine.py proglašava putom (vidi tamo pravila).", "putovi": opis},
                  f, ensure_ascii=False, separators=(",", ":"))
    ha = lambda m: round(float(m.sum()) * m_po_px ** 2 / 1e4, 1)  # noqa: E731
    from collections import Counter
    print(f"putovi: {len(putovi)} čestica, {ha(put & slobodno)} ha slobodnog na njima", dict(Counter(d["razlog"] for d in opis)))
    print(f"slobodno zone za gradnju {ha(slobodno)} ha → gradilišta {ha(zadrzano)} ha (mjesto za zgradu {ha(mjesto)} ha, "
          f"odmak {ha(odmak)} ha, zgrada ne stane {ha(ne_stane)} ha), preusko {ha(preusko)} ha")


if __name__ == "__main__":
    main()
