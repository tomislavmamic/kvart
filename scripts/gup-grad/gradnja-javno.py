#!/usr/bin/env python3
"""Javno zemljište i gradski projekti za kartu /gup/gradnja.

Javno zemljište (Republika Hrvatska, Grad Split, Splitsko-dalmatinska
županija) nije zemljište na kojem stanar može graditi, pa ga karta vodi kao
zaseban odgovor, izgrađeno ili ne. Vlasnik je iz GIS izvoza Grada
(KatastarskeCestice.shp, stupac zku_status, stanje 3. 10. 2025.). Taj izvoz
nosi i osobne podatke, pa se ovdje iz njega uzima SAMO je li vlasnik RH, JLS
ili DNŽ, i ništa drugo ne izlazi. Izvoz vlasnika ne zna za većinu čestica
(~60 % zemljišta u obuhvatu GUP-a nema upisan status), pa javnog zemljišta
ima i više nego što karta pokazuje. Vojna zona (Lora) ondje nije upisana kao
državna; nju karta prepoznaje po namjeni N (gradnja.ts).

Gradski projekt (urbano pravilo GP s lista 4.c) gradi se tek po odobrenom
projektu i samo ono što projekt kaže, pa slobodno zemljište ondje nije za
gradnju dok projekta nema. Čestice s pravilom GP su iz pločica čestica
(cestice.py, `u`).

Uz državu, Grad i županiju javne su i njihove ustanove i tvrtke (Vodovod i
kanalizacija, Hrvatske ceste, institut…), prepoznate po imenu vlasnika koji
je pravna osoba (registar data/public-entities.json i JAVNE_PRAVNE), te
čestice kojima je javno vlasništvo potvrđeno ciljanom provjerom u
zemljišnim knjigama (ciljana-provjera-vlasnistva.geojson, kvart).

Izvoz Grada ima svoju, stariju podjelu na čestice, pa se vlasnik ne spaja po
broju nego po mjestu, i to po CIJELOJ katastarskoj čestici DGU-a: čestica je
javna ako je barem pola njezine površine javno u izvozu. Tako na rubu javne
čestice ne ostanu krhotine „slobodnog” zemljišta zbog pomaka između dviju
podjela.

Ulaz:  Split Export/SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/KatastarskeCestice.shp
       (lokalno, nije u gitu), public/geo/gup-grad/regije.json i pločice,
       public/geo/gup-grad/cestice
Izlaz: data/gup-grad/javno-2025/<red>_<stupac>.png — bitovi 0–2 vlasnik
       (1 RH, 2 Grad, 3 županija, 4 javna ustanova ili tvrtka), bit 3
       gradski projekt, bit 4 javno uže od 10 m (ulica, rub ceste, put);
       čita ih gradnja.ts

Pokretanje (prije gradnja.ts):  /opt/homebrew/bin/python3 scripts/gup-grad/gradnja-javno.py
"""
from __future__ import annotations

import glob
import json
import os
import shutil
import sys

import numpy as np
import pyogrio
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
IZLAZ = os.path.join(R.ROOT, "data", "gup-grad", "javno-2025")
PLOCICA = 512
# isti izvoz kao cestice.py: u radnoj kopiji, inače u glavnoj
IZVOZ = os.path.join(R.ROOT, "data", "sources", "Split Export")
if not os.path.isdir(IZVOZ):
    IZVOZ = os.path.join(os.path.expanduser("~"), "projects", "kvart", "data", "sources", "Split Export")
VLASNISTVO = os.path.join(IZVOZ, "SPLIT_EXPORT_BAZA", "KOMUNALNA_INFRASTRUKTURA", "KatastarskeCestice.shp")
VLASNIK = {"RH": 1, "JLS": 2, "DNŽ": 3}
JAVNA_TVRTKA = 4  # javna ustanova ili tvrtka države ili Grada (po imenu vlasnika, vidi JAVNE_PRAVNE)
GRADSKI_PROJEKT = 8
# javno uže od ovoga (rub ceste, put, prolaz, ostatak uz cestu) je „uski javni pojas”:
# javno je, ali bi ga jantarna boja crtala kao mrežu tankih traka preko karte
USKO_JAVNO = 16
USKO_JAVNO_M = 10.0
USKO_JAVNO_MIN_M2 = 300.0
REGISTAR = os.path.join(R.ROOT, "data", "public-entities.json")
PROVJERA = os.path.join(JAVNO, "geo", "analiza", "ciljana-provjera-vlasnistva.geojson")
# Pravne osobe koje su država ili njezine ustanove i tvrtke, uz gradske iz registra
# (data/public-entities.json). Uspoređuje se samo ime vlasnika PRAVNE osobe;
# imena fizičkih osoba se ne čitaju.
JAVNE_PRAVNE = (
    "REPUBLIKA HRVATSKA", "HRVATSKE CESTE", "HRVATSKA UPRAVA ZA CESTE", "HRVATSKE AUTOCESTE", "HRVATSKE ŠUME",
    "HRVATSKE VODE", "HRVATSKE ŽELJEZNICE", "HŽ INFRASTRUKTURA", "HEP", "HRVATSKA ELEKTROPRIVREDA",
    "LUČKA UPRAVA", "SVEUČILIŠTE U SPLITU", "KLINIČKI BOLNIČKI CENTAR", "INSTITUT ZA JADRANSKE KULTURE",
    "MINISTARSTVO", "MORH", "AGENCIJA ZA UPRAVLJANJE DRŽAVNOM IMOVINOM", "DRŽAVNA AGENCIJA",
)
# udio katastarske čestice (DGU) pod javnim zemljištem iz izvoza od kojeg je cijela čestica javna
VECINA = 0.5


def main() -> None:
    ind = json.load(open(os.path.join(JAVNO, "geo", "gup-grad", "regije.json")))
    korak = ind["korak"]
    plocice = []
    for p in ind["inacice"]["gradevna"]["2025"]:
        r, c = (int(x) for x in os.path.basename(p["url"]).removesuffix(".png").split("_"))
        h, w = Image.open(os.path.join(JAVNO, p["url"].lstrip("/"))).size[::-1]
        plocice.append((r, c, h, w, p))
    H = (max(r for r, *_ in plocice) + 1) * PLOCICA
    W = (max(c for _, c, *_ in plocice) + 1) * PLOCICA
    r0, c0, _, _, p0 = plocice[0]
    (_, zapad), (sjever, _) = p0["granice"]
    x, y = Transformer.from_crs(4326, 3857, always_xy=True).transform(zapad, sjever)
    transform = Affine(korak, 0, x - c0 * PLOCICA * korak, 0, -korak, y + r0 * PLOCICA * korak)

    # vlasnik: RH, JLS, DNŽ, i javne pravne osobe po imenu; ime fizičke osobe se ne čita
    df = pyogrio.read_dataframe(VLASNISTVO, columns=["zku_status", "zku_vlasni"])
    registar = json.load(open(REGISTAR))
    po_kategoriji = {"city": 2, "state": 1, "county": 3}
    imena = [(a.upper(), po_kategoriji.get(e["category"], JAVNA_TVRTKA)) for e in registar for a in e["aliases"]]
    imena += [(a, JAVNA_TVRTKA) for a in JAVNE_PRAVNE]

    def kod_vlasnika(status, ime) -> int:
        if status in VLASNIK:
            return VLASNIK[status]
        if status in ("Pravna osoba", "Ostalo") and isinstance(ime, str):
            ime = ime.upper()
            return next((k for a, k in imena if ime.startswith(a) or f" {a}" in ime), 0)
        return 0

    kodovi = [kod_vlasnika(s, i) for s, i in zip(df["zku_status"], df["zku_vlasni"])]
    del df["zku_vlasni"]
    u_3857 = Transformer.from_crs(int(df.crs.to_epsg()), 3857, always_xy=True).transform
    izvoz = features.rasterize(
        ((stransform(u_3857, g), k) for g, k in zip(df.geometry, kodovi) if g is not None and k),
        out_shape=(H, W), transform=transform, fill=0, dtype="uint8",
    )
    # ciljana provjera u zemljišnim knjigama (kvart): potvrđeno javne čestice
    if os.path.exists(PROVJERA):
        u_4326_3857 = Transformer.from_crs(4326, 3857, always_xy=True).transform
        potvrdene = []
        for ft in json.load(open(PROVJERA))["features"]:
            p = ft["properties"]
            if p.get("verification_status") in ("confirmed_public", "cadastre_public", "mixed_public") and ft["geometry"]:
                kat = (p.get("public_entities") or [{}])[0].get("category")
                potvrdene.append((stransform(u_4326_3857, shape(ft["geometry"])), po_kategoriji.get(kat, JAVNA_TVRTKA)))
        if potvrdene:
            p_ras = features.rasterize(potvrdene, out_shape=(H, W), transform=transform, fill=0, dtype="uint8")
            izvoz = np.where(p_ras > 0, p_ras, izvoz)

    # gradski projekt: čestice s urbanim pravilom GP 2025.
    u_4326 = Transformer.from_crs(4326, 3857, always_xy=True).transform
    gp, vidjene, cestice_dgu = [], set(), []
    for f in glob.glob(os.path.join(JAVNO, "geo", "gup-grad", "cestice", "*.json")):
        for ft in json.load(open(f))["features"]:
            p = ft["properties"]
            if p["i"] in vidjene or not ft["geometry"]:
                continue
            vidjene.add(p["i"])
            g = stransform(u_4326, shape(ft["geometry"]))
            cestice_dgu.append(g)
            if (p.get("u") or {}).get("2025") == "GP":
                gp.append(g)
    projekt = features.rasterize(((g, 1) for g in gp), out_shape=(H, W), transform=transform, fill=0, dtype="uint8") > 0

    # vlasnik po cijeloj čestici DGU-a: javna ako je barem pola pod javnim, s najčešćim vlasnikom
    rid = features.rasterize(((g, n + 1) for n, g in enumerate(cestice_dgu)), out_shape=(H, W), transform=transform, fill=0, dtype="int32")
    n = len(cestice_dgu) + 1
    ukupno = np.bincount(rid.ravel(), minlength=n)
    vlasnik_cestice = np.zeros(n, np.uint8)
    najvise = np.zeros(n, np.int64)
    for kod in range(1, 5):
        broj = np.bincount(rid[izvoz == kod], minlength=n)
        bolji = broj > najvise
        vlasnik_cestice[bolji] = kod
        najvise[bolji] = broj[bolji]
    javnih = np.bincount(rid[izvoz > 0], minlength=n)
    vlasnik_cestice[javnih < VECINA * np.maximum(ukupno, 1)] = 0
    vlasnik_cestice[0] = 0
    # izvan čestica DGU-a (more, rubovi) ostaje izvoz kakav jest
    vlasnik = np.where(rid > 0, vlasnik_cestice[rid], izvoz).astype(np.uint8)

    # uski javni pojas: dio javnog u koji ne stane krug od USKO_JAVNO_M (otvaranje preko udaljenosti)
    m_po_px = korak * np.cos(np.radians(43.51))
    javno = vlasnik > 0
    sredista = (ndimage.distance_transform_edt(javno) - 0.5) * m_po_px >= USKO_JAVNO_M / 2
    siroko = javno & (ndimage.distance_transform_edt(~sredista) * m_po_px <= USKO_JAVNO_M / 2)
    # i mrvice širokog (krug na križanju uskih pojaseva) idu u uski pojas
    oz, n = ndimage.label(siroko)
    if n:
        vel = ndimage.sum_labels(np.ones_like(oz), oz, index=np.arange(1, n + 1)) * m_po_px ** 2
        siroko[np.isin(oz, np.flatnonzero(vel < USKO_JAVNO_MIN_M2) + 1)] = False
    usko = javno & ~siroko

    oznaka = vlasnik | np.where(projekt, GRADSKI_PROJEKT, 0).astype(np.uint8) | np.where(usko, USKO_JAVNO, 0).astype(np.uint8)
    if os.path.isdir(IZLAZ):
        shutil.rmtree(IZLAZ)
    os.makedirs(IZLAZ)
    for r, c, h, w, p in plocice:
        t = oznaka[r * PLOCICA:r * PLOCICA + h, c * PLOCICA:c * PLOCICA + w]
        if t.any():
            Image.fromarray(t, "L").save(os.path.join(IZLAZ, os.path.basename(p["url"])), optimize=True)
    m2 = (korak * np.cos(np.radians(43.51))) ** 2
    print(f"javno: RH {(vlasnik == 1).sum() * m2 / 1e4:.1f} ha, Grad {(vlasnik == 2).sum() * m2 / 1e4:.1f} ha, "
          f"županija {(vlasnik == 3).sum() * m2 / 1e4:.1f} ha, javne ustanove i tvrtke {(vlasnik == 4).sum() * m2 / 1e4:.1f} ha "
          f"(od toga uski pojasevi {usko.sum() * m2 / 1e4:.1f} ha); gradski projekt {len(gp)} čestica, {projekt.sum() * m2 / 1e4:.1f} ha → {IZLAZ}")


if __name__ == "__main__":
    main()
