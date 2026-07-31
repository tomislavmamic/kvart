#!/usr/bin/env python3
"""Vadi slojeve iz GIS izvoza Grada za ŠIRI obuhvat — cijeli praćeni list.

Sloj slobodnih čestica dosad je pokrivao samo Dračevac i Bilice jer su i
podloge bile rezane na kvart. Namjena iz GUP-a praćena je, međutim, na
znatno širem prozoru (4,0 × 3,3 km, 1348 ha — vidi KVART_3765 u
scripts/trace-plans.py), pa se isti račun može provesti na svemu što ta
podloga pokriva.

Prozor leži ISTOČNO od gradskog središta: središte mu je na 16,495 °E, a
Dioklecijanova palača na 16,440 °E. Mjereno protiv sloja gradskih kotara,
u njemu su Mejaši (356 ha), Kamen (142), Neslanovac (97), Visoka (50),
Pujanke (37), Brda (36) i Sirobuja (26), te rubovi Split-3, Ravnih njiva,
Mertojaka, Žnjana i Kocunara. Prozor je pravokutnik, ne granica kotara,
pa 771 od 1348 ha otpada na splitske kotare, a ostatak na susjedne
jedinice i neizgrađeno zaleđe.

Ovo NIJE cijeli Split. GUP pokriva gradski pojas ~13,3 × 4,7 km, a
katastar Grada seže 27,4 km; izvan GUP-a (Žrnovnica, Stobreč, Kamen,
Srinjine, Slatine) vrijedi PPUG, koji nije praćen i namjene za njega
nema. Prozor je ovdje granica podatka, ne izbor.

Ceste se uzimaju iz gradske evidencije, a ne iz OSM-a: OSM izvadak u repou
rezan je na kvart, a gradski registar pokriva cijelo područje i nosi
nadležnost.

Rezultat: public/geo/sire/*.geojson (EPSG:4326)

Pokretanje:  /opt/homebrew/bin/python3 scripts/izvadi-sire.py
Traži:       ogr2ogr (GDAL) i SHP.zip u korijenu repoa
"""
from __future__ import annotations

import json
import os
import subprocess

from osgeo import ogr

ogr.UseExceptions()

KORIJEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARHIVA = os.path.join(KORIJEN, "SHP.zip")
IZLAZ = os.path.join(KORIJEN, "public", "geo", "sire")

# Isti prozor na kojem je praćena namjena (EPSG:3765), pretvoren u 4326 s
# malom rezervom da čestice na rubu ne ispadnu prepolovljene.
OBUHVAT_4326 = (16.4585, 43.5045, 16.5605, 43.5555)

# ime → (putanja u arhivi, {izvorno polje: naše ime})
SLOJEVI: dict[str, tuple[str, dict[str, str]]] = {
    "katastar": (
        "SPLIT_EXPORT_BAZA/KATASTAR/CADASTRAL_PARCELS_2024_P.shp",
        {"KO_NAZIV": "ko", "KC_BROJ": "cestica", "Shape_Area": "povrsina"},
    ),
    "zgrade": (
        "SPLIT_EXPORT_PORTAL/Objekti_Split_2025_Objekti_Split_2025.shp",
        {"povrsina": "tlocrt"},
    ),
    "zgrade-2d": (
        "SPLIT_EXPORT_PORTAL/Objekti_SPLIT_objekti_2D_v1.shp",
        {},
    ),
    "katastar-objekti": (
        "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/KO_Split_objekti.shp",
        {},
    ),
    "ulice": (
        "SPLIT_EXPORT_BAZA/ADMINISTRATIVNI_PODACI/Ulice.shp",
        {"UL_IME": "naziv"},
    ),
    "ceste-nerazvrstane": (
        "SPLIT_EXPORT_PORTAL/Nerazvrstane_ceste_Split_nerazvrstane_ceste_29112023.shp",
        {"ulica_nazi": "ulica", "upravitelj": "upravitelj"},
    ),
    "ceste-dionice": (
        "SPLIT_EXPORT_BAZA/KOMUNALNA_INFRASTRUKTURA/Dionice_Cesta.shp",
        {},
    ),
    "drzavne-ceste": (
        "SPLIT_EXPORT_BAZA/DRZAVNA_CESTA/drzavna_cesta_UI.shp",
        {},
    ),
    "dalekovod": (
        "SPLIT_EXPORT_PORTAL/"
        "Energetika_2022_Visokonaponska_110_kV_i_220_kV___dionica.shp",
        {"vrsta": "vrsta"},
    ),
}


def izvadi(ime: str, izvor: str, polja: dict[str, str]) -> int:
    """Reže jedan sloj na obuhvat i piše ga kao GeoJSON u EPSG:4326.

    Arhiva se čita na mjestu preko /vsizip — raspakirana traži 2,3 GB, a
    na ovom stroju diska nema. `-spat_srs` je nužan jer izvoz miješa tri
    koordinatna sustava, pa fiksni okvir bez njega tiho promaši sloj.
    """
    put = os.path.join(IZLAZ, f"{ime}.geojson")
    medju = os.path.join(IZLAZ, f"_{ime}_tmp.geojson")
    for p in (put, medju):
        if os.path.exists(p):
            os.remove(p)

    # Dva prolaza jer ogr2ogr odbija `-spat_srs` zajedno s `-sql`: prvo se
    # reže u izvornom sustavu sloja i prebacuje u 4326, pa se tek onda
    # preimenuju stupci.
    subprocess.run(
        ["ogr2ogr", "-f", "GeoJSON", medju,
         f"/vsizip/{ARHIVA}/SHP/{izvor}",
         "-spat", *(str(v) for v in OBUHVAT_4326),
         "-spat_srs", "EPSG:4326",
         "-t_srs", "EPSG:4326",
         "-makevalid", "-skipfailures"],
        check=True, capture_output=True,
    )
    # Ime sloja i popis polja ČITAJU se iz međudatoteke, ne pogađaju:
    # GeoJSON naslijedi ime iz izvornog shapefilea, a shapefile krati imena
    # polja na 10 znakova (`ulica` je ondje `ulica_nazi`). Traženo polje
    # kojeg nema preskače se uz upozorenje umjesto da sruši cijeli izvadak.
    # Izvor se drži u varijabli: pusti li se da nestane u istom izrazu, GC
    # ga pokupi prije nego što se sloj pročita.
    ds = ogr.Open(medju)
    lyr = ds.GetLayer(0)
    sloj = lyr.GetName()
    ima = {lyr.GetLayerDefn().GetFieldDefn(i).GetName()
           for i in range(lyr.GetLayerDefn().GetFieldCount())}
    ds = lyr = None
    nedostaju = [k for k in polja if k not in ima]
    if nedostaju:
        print(f"  ! {ime}: nema polja {nedostaju}; dostupna: {sorted(ima)}")
    stupci = ", ".join(f'"{k}" AS "{v}"' for k, v in polja.items()
                       if k in ima)
    subprocess.run(
        ["ogr2ogr", "-f", "GeoJSON", put, medju,
         "-dialect", "OGRSQL",
         "-sql", f'SELECT {stupci or "*"} FROM "{sloj}"',
         "-lco", "COORDINATE_PRECISION=6",
         "-lco", "RFC7946=YES", "-skipfailures"],
        check=True, capture_output=True,
    )
    os.remove(medju)
    with open(put, encoding="utf-8") as f:
        n = len(json.load(f)["features"])
    print(f"  {ime:22s} {n:7d} objekata  "
          f"{os.path.getsize(put) / 1e6:6.1f} MB")
    return n


def main() -> None:
    """Vadi sve slojeve za širi obuhvat."""
    if not os.path.exists(ARHIVA):
        raise SystemExit(f"nema arhive: {ARHIVA}")
    os.makedirs(IZLAZ, exist_ok=True)
    print(f"Širi obuhvat {OBUHVAT_4326} → {os.path.relpath(IZLAZ, KORIJEN)}")
    for ime, (izvor, polja) in SLOJEVI.items():
        izvadi(ime, izvor, polja)


if __name__ == "__main__":
    main()
