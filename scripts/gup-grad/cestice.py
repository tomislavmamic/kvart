#!/usr/bin/env python3
"""Katastarske čestice × namjena GUP-a × ono što na čestici stvarno stoji.

Ulaz:
  .cache/gup-grad/klase-<id>.npy     rešetka namjene po godini (rasteriziraj.py)
  data/sources/Split Export/...      GIS izvoz Grada Splita (SHP), vidi IZVOZ

Izlaz:
  data/gup-grad/cestice.json         ulaz za src/lib/gup-grad/ (TypeScript)
  public/geo/gup-grad/cestice/*.json čestice s mjerenjima, u pločicama od
                                     1 km, za pogled „Provjera GUP-a” na /karta
  public/geo/gup-grad/zgrade/*.json  zgrade iz katastra i iz 3D modela, iste
                                     pločice, da se na karti vidi što je izmjereno
  public/geo/gup-grad/namjena-*.png  rešetka namjene po godini, preprojicirana
                                     u Web Mercator, za usporedbu s listom

Ovdje se NE odlučuje što je „iskorišteno” ni što je „u skladu s planom” —
to su pravila koja se žele mijenjati (src/lib/gup-grad/pravila.ts). Skripta
samo izmjeri, za svaki komad čestice koji pada u jednu klasu namjene:

  n      površina komada (pikseli od 4 m²)
  zk     pikseli pod zgradom iz katastra (KO_*_objekti)
  z25    pikseli pod zgradom iz gradskog 3D modela (sloj Objekti_Split_2025,
         isti tlocrti kao Zgrade_3D/ST_3D_2024; datum snimanja izvoz ne kaže)
  kat    bruto površina zgrada iz 3D modela u pikselima: svaki piksel pod
         zgradom broji se onoliko puta koliko zgrada ima etaža — visina
         krova iznad tla (Korisna_povrsina_Split_2025, h_objekt) / 3 m,
         najmanje 1. Odredbe uz kig propisuju i kis (bruto površina /
         čestica), pa neboder troši više čestice od prizemnice istog tlocrta.
  pr     pikseli pod ulicom: os ceste ± pola profila (Ceste,
         NerazvrstaneCeste, registar nerazvrstanih cesta 2023., državne
         ceste, i OSM highway=* po razredu ceste — kolni prilazi,
         prometnice kroz naselja, pješački putovi i stube koje gradski
         slojevi nemaju) i nogostupi. Pravila ih mogu
         izuzeti iz namjene zone (ulica u stambenoj zoni nije stanovanje).
  pa     pikseli pod parkiralištem ili garažama: javna parkirališta
         Grada i sva iz OSM-a (trgovine, zgrade, tvrtke)
  jv     pikseli pod okolišem javne ustanove: škole, vrtići, fakulteti,
         bolnice, crkve (OSM)
  os     pikseli pod ostalim uređenim: groblja, športski objekti i
         igrališta, trgovi i pješačke površine
  inf    pikseli pod infrastrukturom: trafostanice, vodospreme,
         benzinske postaje, pruga (OSM)
  ze     pikseli pod održavanim javnim zelenilom (Parkovi i nasadi:
         parkovi, travnjaci, zelene površine, živice)
  gr     pikseli pod gradilištem (OSM landuse=construction)
  Sve to JEST korištenje zemljišta: na parkiralištu, školskom dvorištu ili
  u parku se ne gradi stan. Kojim se redom prekrivanja broje i što je u
  kojoj zoni u skladu s planom, odlučuje pravila.ts.
  g      pretežita skupina katastarskih zgrada u komadu (0 = nema):
         1 stambene (1xx), 2 gospodarske i poslovne (2xx), 3 javne (3xx),
         4 pomoćne (4xx), 5 ostale građevine (6xx–9xx)
  us     slobodni pikseli (ništa od gore navedenog) koji leže u slobodnom
         zemljištu iste klase dovoljno širokom za zgradu: u njega stane
         krug promjera ~9 m (morfološko otvaranje, SIRINA_PX). Odredbe
         traže česticu široku barem 10 m (dvojna; slobodnostojeća 12–16 m),
         pa put, stube, pojas uz nogostup ili rub oko zgrade na tuđoj međi
         nisu građevno zemljište — ni sami ni spojeni sa susjednima. Mala
         čestica usred slobodnog polja ostaje široka, jer se mjeri polje,
         ne čestica.

Skupine zgrada izvedene su iz šifre VRSTA po stotici i provjerene
položajem na planu: 1xx leže u M/S, 2xx u I/K, 3xx u D (škole, bolnice,
crkve), 4xx su garaže i spremišta, 6xx su nadstrešnice i objekti uz ceste.

Pokretanje:  /opt/homebrew/bin/python3 scripts/gup-grad/cestice.py
Traži:       numpy, geopandas/pyogrio, rasterio, shapely
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import pyogrio
from rasterio import features
from affine import Affine
import shapely

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

ROOT = R.ROOT
IZVOZ = os.environ.get(
    "SPLIT_IZVOZ",
    os.path.join(ROOT, "data", "sources", "Split Export"),
)
if not os.path.isdir(IZVOZ):
    # worktree nema data/sources; izvoz živi u glavnoj kopiji repozitorija
    IZVOZ = os.path.join(os.path.expanduser("~"), "projects", "kvart", "data", "sources", "Split Export")
BAZA = os.path.join(IZVOZ, "SPLIT_EXPORT_BAZA")
PORTAL = os.path.join(IZVOZ, "SPLIT_EXPORT_PORTAL")
OUT = os.path.join(ROOT, "data", "gup-grad", "cestice.json")

GODINE = [("gup-2006", 2006), ("gup-2015", 2015), ("gup-2025", 2025)]
# izravno, bez množenja: affine u Homebrew Pythonu 3.10 puca na __matmul__
TRANSFORM = Affine(R.KORAK, 0.0, R.MREZA_BBOX[0], 0.0, -R.KORAK, R.MREZA_BBOX[3])
OBLIK = (R.H, R.W)

# Komad čestice manji od ovog udjela čestice je rub klase koji je
# uklapanje lista (±5–10 m) prebacilo preko međe — ne pravi komad.
NAJMANJI_UDIO_KOMADA = 0.05

# Poluširina profila ceste kad sloj ne kaže širinu (m): kolnik 6–7 m.
POLA_CESTE = 3.5
POLA_DRZAVNE = 6.0


# Polja komada u cestice.json, redom (vidi opis gore).
POLJA = ["cestica", "klasa", "n", "zk", "z25", "kat", "pr", "pa", "jv", "os", "inf", "ze", "gr", "g", "us"]
VISINA_ETAZE = 3.0  # m
# Najuže slobodno zemljište na kojem se može graditi: krug polumjera 2 px
# (dx² + dy² ≤ 4 na rešetki od 2 m) — 10 m uzduž osi, ~8 m dijagonalno.
SIRINA_PX = 2

OSM_PUT = os.path.join(R.OUT, "osm.json")  # scripts/gup-grad/osm.py
OSM_CESTE_PUT = os.path.join(R.OUT, "osm-ceste.json")
# Rasteri mjerenja za scripts/gup-grad/regije.py (samo lokalno, u .cache)
MASKE_PUT = os.path.join(R.OUT, "maske.npz")

# Pola širine OSM ceste po razredu (m), kad oznaka width ne kaže više.
# Poljski putovi (track) i staze kroz makiju (path) nisu korištenje
# zemljišta za stanovanje — preko njih se gradi — pa ih nema.
POLA_OSM = {
    "motorway": 12.0, "trunk": 8.0, "primary": 7.0, "secondary": 5.5, "tertiary": 4.5,
    "motorway_link": 4.0, "trunk_link": 4.0, "primary_link": 4.0, "secondary_link": 3.5, "tertiary_link": 3.5,
    "residential": 3.5, "unclassified": 3.5, "living_street": 3.5, "service": 2.5,
    "pedestrian": 2.5, "footway": 1.0, "steps": 1.0, "cycleway": 1.25,
}


def osm_ceste() -> list:
    """OSM ceste (scripts/gup-grad/osm.py) kao poligoni os ± pola širine, u EPSG:3765."""
    from pyproj import Transformer

    if not os.path.exists(OSM_CESTE_PUT):
        print("NEMA", OSM_CESTE_PUT, "— pokreni scripts/gup-grad/osm.py; OSM ceste prazne")
        return []
    u = Transformer.from_crs(4326, 3765, always_xy=True)
    out = []
    for e in json.load(open(OSM_CESTE_PUT))["elements"]:
        t = e.get("tags", {})
        pola = POLA_OSM.get(t.get("highway", ""))
        if pola is None or t.get("area") == "yes" or len(e.get("geometry", [])) < 2:
            continue
        try:
            pola = max(pola, float(t["width"].replace(",", ".").split()[0]) / 2)
        except (KeyError, ValueError, IndexError):
            pass
        x, y = u.transform([p["lon"] for p in e["geometry"]], [p["lat"] for p in e["geometry"]])
        out.append(shapely.buffer(shapely.linestrings(list(zip(x, y))), pola, cap_style="flat"))
    return out


def osm_kategorija(t: dict) -> str | None:
    a, le, lu = t.get("amenity"), t.get("leisure"), t.get("landuse")
    if a == "parking" and t.get("parking") != "underground" or lu == "garages":
        return "pa"
    if a in ("school", "kindergarten", "college", "university", "hospital", "clinic", "place_of_worship") \
            or lu in ("education", "religious"):
        return "jv"
    if le in ("pitch", "playground", "sports_centre", "stadium", "track", "dog_park") \
            or a in ("grave_yard", "marketplace") or lu == "cemetery" \
            or t.get("place") == "square" or (t.get("highway") and t.get("area") == "yes"):
        return "os"
    if t.get("power") in ("substation", "plant") or a == "fuel" or lu == "railway" \
            or t.get("man_made") in ("reservoir_covered", "water_tower", "wastewater_plant"):
        return "inf"
    if le == "park" or lu == "village_green":
        return "ze"
    if lu == "construction":
        return "gr"
    return None


def osm_poligoni() -> dict[str, list]:
    """Poligoni iz OSM-a (scripts/gup-grad/osm.py) po kategoriji, u EPSG:3765."""
    from pyproj import Transformer

    out: dict[str, list] = {k: [] for k in ("pa", "jv", "os", "inf", "ze", "gr")}
    if not os.path.exists(OSM_PUT):
        print("NEMA", OSM_PUT, "— pokreni scripts/gup-grad/osm.py; OSM slojevi prazni")
        return out
    u = Transformer.from_crs(4326, 3765, always_xy=True)

    def prsten(geom):
        x, y = u.transform([p["lon"] for p in geom], [p["lat"] for p in geom])
        return list(zip(x, y))

    for e in json.load(open(OSM_PUT))["elements"]:
        k = osm_kategorija(e.get("tags", {}))
        if not k:
            continue
        g = None
        if e["type"] == "way" and len(e.get("geometry", [])) >= 4 and e["geometry"][0] == e["geometry"][-1]:
            g = shapely.Polygon(prsten(e["geometry"]))
        elif e["type"] == "relation":
            vanjski = [shapely.LineString(prsten(m["geometry"])) for m in e.get("members", [])
                       if m.get("type") == "way" and m.get("role") in ("outer", "") and len(m.get("geometry", [])) >= 2]
            unutarnji = [shapely.LineString(prsten(m["geometry"])) for m in e.get("members", [])
                         if m.get("type") == "way" and m.get("role") == "inner" and len(m.get("geometry", [])) >= 2]
            if vanjski:
                g = shapely.union_all(list(shapely.polygonize(vanjski).geoms))
                if unutarnji:
                    g = g.difference(shapely.union_all(list(shapely.polygonize(unutarnji).geoms)))
        if g is not None and not g.is_empty:
            out[k].append(shapely.make_valid(g))
    print("OSM poligona:", {k: len(v) for k, v in out.items()})
    return out


RUCNO_PUT = os.path.join(ROOT, "data", "gup-grad", "pregled", "rucno.json")
ISPRAVCI_PUT = os.path.join(ROOT, "data", "gup-grad", "pregled", "ispravci.json")  # scripts/gup-grad/ispravci.ts
# Što ručni pregled smije reći o čestici; značenje u src/lib/gup-grad/pravila.ts.
RUCNO_VRSTE = ["parkiraliste", "javna", "uredjeno", "zelenilo", "gradiliste", "izgradjeno", "promet",
               "infrastruktura", "neizgradivo", "slobodno"]


def rucno_po_cestici(c) -> list[int]:
    """Ispravci iz ručnog pregleda, po čestici (0 = nema).

    Prvo pregled ortofotom (rucno.json), pa preko njega prihvaćeni
    prijedlozi s karte (ispravci.json, scripts/gup-grad/ispravci.ts).
    """
    out = [0] * len(c)
    kljuc = {(k, b): i for i, (k, b) in enumerate(zip(c.KO_NAZIV.fillna(""), c.KC_BROJ.fillna("")))}
    for put in (RUCNO_PUT, ISPRAVCI_PUT):
        if not os.path.exists(put):
            continue
        nema, n = [], 0
        for z in json.load(open(put))["cestice"]:
            i = kljuc.get((z["ko"], z["kc"]))
            if i is None or z["vrsta"] not in RUCNO_VRSTE:
                nema.append(f"{z['ko']} {z['kc']}")
                continue
            out[i] = RUCNO_VRSTE.index(z["vrsta"]) + 1
            n += 1
        print(os.path.basename(put), "primijenjeno:", n, "nepoznatih:", nema[:10])
    return out


def osm_stanje() -> str:
    if not os.path.exists(OSM_PUT):
        return ""
    t = json.load(open(OSM_PUT)).get("osm3s", {}).get("timestamp_osm_base", "")
    return f"© OpenStreetMap contributors (ODbL), stanje {t[:10]}"


def citaj(put: str, **kw):
    d = pyogrio.read_dataframe(put, encoding="utf-8", **kw)
    # dio slojeva portala je u Web Mercatoru; sve se mjeri u HTRS96/TM
    if d.crs is not None and d.crs.to_epsg() != 3765:
        d = d.to_crs(3765)
    return d


def rasteriziraj(geomi, vrijednosti=None, dtype="uint8") -> np.ndarray:
    geomi = [g for g in geomi if g is not None and not g.is_empty]
    if not geomi:
        return np.zeros(OBLIK, dtype)
    if vrijednosti is None:
        oblici = ((g, 1) for g in geomi)
    else:
        oblici = zip(geomi, vrijednosti)
    return features.rasterize(oblici, out_shape=OBLIK, transform=TRANSFORM,
                              fill=0, dtype=dtype, all_touched=False)


def obuhvat_gupa():
    df = citaj(os.path.join(BAZA, "OBUHVAT_PP", "OBUHVATI_PP.shp"))
    red = df[df.PLAN_NAME.str.contains("Generalni urbanistički plan Splita", na=False)]
    if red.empty:
        raise SystemExit("OBUHVATI_PP nema GUP Splita")
    return shapely.union_all(red.geometry.values)


def skupina_zgrade(vrsta: int) -> int:
    s = int(vrsta) // 100
    return {1: 1, 2: 2, 3: 3, 4: 4}.get(s, 5)


def main() -> None:
    print("izvoz:", IZVOZ)
    obuhvat = obuhvat_gupa()
    maska_obuhvata = rasteriziraj([obuhvat]).astype(bool)

    # ---- čestice ---------------------------------------------------------
    c = citaj(os.path.join(BAZA, "KATASTAR", "CADASTRAL_PARCELS_2024_P.shp"))
    c = c[c.geometry.intersects(obuhvat)].reset_index(drop=True)
    print("čestica u obuhvatu:", len(c))
    ids = rasteriziraj(c.geometry.values, np.arange(1, len(c) + 1), "int32")

    # ---- što stoji na tlu ------------------------------------------------
    ko_obj = []
    for ime in sorted(os.listdir(os.path.join(BAZA, "ADMINISTRATIVNI_PODACI"))):
        if ime.startswith("KO_") and ime.endswith("_objekti.shp"):
            d = citaj(os.path.join(BAZA, "ADMINISTRATIVNI_PODACI", ime), columns=["VRSTA"])
            ko_obj.append(d)
    import pandas as pd
    zg = pd.concat(ko_obj, ignore_index=True)
    zg = zg[zg.geometry.intersects(obuhvat)]
    # pomoćne (4) prve pa glavne preko njih — pri preklopu vrijedi glavna
    zg = zg.assign(sk=zg.VRSTA.map(skupina_zgrade)).sort_values("sk", key=lambda s: s.map({4: 0, 5: 1, 3: 2, 2: 3, 1: 4}))
    zk = rasteriziraj(zg.geometry.values, zg.sk.values)
    print("katastarskih zgrada:", len(zg))

    z25g = citaj(os.path.join(PORTAL, "Objekti_Split_2025_Objekti_Split_2025.shp"), columns=[])
    z25 = rasteriziraj(z25g.geometry.values).astype(bool)
    print("zgrada 2025:", len(z25g))
    # etaže iz visine krovnih ploha 3D modela; niže plohe prve, više preko njih
    kr = citaj(os.path.join(PORTAL, "Korisna_povrsina_Split_2025_Korisna_povrsina_Split_2025.shp"), columns=["h_objekt"])
    kr = kr[kr.h_objekt.notna() & (kr.h_objekt > 0)].sort_values("h_objekt")
    etaze = np.clip(np.round(kr.h_objekt.values / VISINA_ETAZE), 1, 60).astype("uint8")
    kat = np.where(z25, np.maximum(rasteriziraj(kr.geometry.values, etaze), 1), 0).astype("uint16")
    print("bruto površina zgrada 3D modela, ha:", round(float(kat.sum()) * R.KORAK * R.KORAK / 1e4, 1))

    ceste = []
    for put, pola in [
        (os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "Ceste.shp"), POLA_CESTE),
        (os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "NerazvrstaneCeste.shp"), POLA_CESTE),
        (os.path.join(BAZA, "DRZAVNA_CESTA", "drzavna_cesta_1.shp"), POLA_DRZAVNE),
    ]:
        d = citaj(put, columns=[])
        ceste.extend(shapely.buffer(d.geometry.values, pola, cap_style="flat"))
    # registar nerazvrstanih cesta (2023.): 3 078 dionica prema 629 u bazi
    reg = citaj(os.path.join(PORTAL, "Nerazvrstane_ceste_Split_nerazvrstane_ceste_29112023.shp"), columns=["vrsta_cest"])
    pola_reg = np.where(reg.vrsta_cest.fillna("").str.startswith("Pješ"), 2.0, POLA_CESTE)
    ceste.extend(shapely.buffer(reg.geometry.values, pola_reg, cap_style="flat"))
    osm_c = osm_ceste()
    ceste.extend(osm_c)
    print("OSM cesta:", len(osm_c))
    nog = citaj(os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "Nogostupi.shp"), columns=["Sirina_nog"])
    sir = nog.Sirina_nog.fillna(1.5).clip(lower=1.0, upper=6.0).values
    ceste.extend(shapely.buffer(nog.geometry.values, sir / 2.0, cap_style="flat"))
    pr = rasteriziraj(ceste).astype(bool)

    osm = osm_poligoni()
    grad = lambda *put: list(citaj(os.path.join(*put), columns=[]).geometry.values)  # noqa: E731
    pa = rasteriziraj(
        grad(BAZA, "KOMUNALNA_INFRASTRUKTURA", "JavnaParkiralista.shp")
        + grad(PORTAL, "ST_PARKING_I_NADZOR_Parkiralista.shp")
        + osm["pa"]
    ).astype(bool)
    jv = rasteriziraj(osm["jv"]).astype(bool)
    os_ = rasteriziraj(
        grad(BAZA, "KOMUNALNA_INFRASTRUKTURA", "Groblja.shp")
        + grad(BAZA, "GRADSKE_NEKRETNINE", "Sportski_objekti_p.shp")
        + osm["os"]
    ).astype(bool)
    inf = rasteriziraj(osm["inf"]).astype(bool)
    # Parkovi i nasadi: sve što Grad održava (218 ha); JavneZelenePovrsine
    # je samo 18 ha travnjaka i živica iz istog izvora
    ze = rasteriziraj(grad(PORTAL, "Parkovi_i_nasadi_poligoni_Parkovi_i_nasadi_poligoni.shp") + osm["ze"]).astype(bool)
    gr = rasteriziraj(osm["gr"]).astype(bool)
    for ime, m_ in (("parkirališta", pa), ("javne ustanove", jv), ("uređeno", os_), ("infrastruktura", inf),
                    ("zelenilo", ze), ("gradilišta", gr)):
        print(f"{ime}: {m_.sum() * R.KORAK * R.KORAK / 1e4:.1f} ha")

    zauzeto = (zk > 0) | z25 | pr | pa | jv | os_ | inf | ze | gr
    yy, xx = np.mgrid[-SIRINA_PX:SIRINA_PX + 1, -SIRINA_PX:SIRINA_PX + 1]
    krug = xx * xx + yy * yy <= SIRINA_PX * SIRINA_PX

    # ---- po godinama -----------------------------------------------------
    n_c = len(c) + 1
    godine_out = {}
    siroko_po_godini = {}
    for gid, god in GODINE:
        kl = np.load(os.path.join(R.OUT, f"klase-{gid}.npy"))
        nk = int(kl.max()) + 1
        m = (ids > 0) & (kl > 0) & maska_obuhvata
        kljuc = ids[m].astype(np.int64) * 64 + kl[m]

        def zbroj(maska=None):
            k = kljuc if maska is None else kljuc[maska[m]]
            u, n = np.unique(k, return_counts=True)
            return dict(zip(u.tolist(), n.tolist()))

        n = zbroj()
        n_zk = zbroj(zk > 0)
        n_z25 = zbroj(z25)
        # zbroj etaža po komadu (težinski), ne broj piksela
        u_k, inv = np.unique(kljuc, return_inverse=True)
        n_kat = dict(zip(u_k.tolist(), np.bincount(inv, weights=kat[m]).astype(np.int64).tolist()))
        n_pr = zbroj(pr)
        n_mj = [zbroj(x) for x in (pa, jv, os_, inf, ze, gr)]
        siroko = siroko_slobodno(kl, (ids > 0) & maska_obuhvata & ~zauzeto, krug)
        siroko_po_godini[god] = siroko
        n_us = zbroj(siroko)
        # pretežita skupina zgrada po komadu
        sk = {}
        for s in range(1, 6):
            for k, v in zbroj(zk == s).items():
                if v > sk.get(k, (0, 0))[1]:
                    sk[k] = (s, v)
        # ukupno po čestici, za prag komada
        po_cestici = np.zeros(n_c, np.int64)
        for k, v in n.items():
            po_cestici[k // 64] += v
        komadi = []
        for k, v in sorted(n.items()):
            ci, klasa = k // 64, k % 64
            if v < NAJMANJI_UDIO_KOMADA * po_cestici[ci] and v < 25:
                continue
            komadi.extend([ci - 1, klasa, v, n_zk.get(k, 0), n_z25.get(k, 0), n_kat.get(k, 0), n_pr.get(k, 0),
                           *(x.get(k, 0) for x in n_mj), sk.get(k, (0, 0))[0], n_us.get(k, 0)])
        # pretežito područje urbanog pravila po čestici (urbana-pravila.py);
        # iz njega odredbe daju najmanju građevnu česticu
        up_put = os.path.join(R.OUT, f"up-{gid}.npy")
        up = [0] * len(c)
        if os.path.exists(up_put):
            upg = np.load(up_put)
            mu = (ids > 0) & (upg > 0)
            k2 = ids[mu].astype(np.int64) * 64 + upg[mu]
            uu, nn = np.unique(k2, return_counts=True)
            najvise = np.zeros(n_c, np.int64)
            for kk, vv in zip(uu.tolist(), nn.tolist()):
                ci = kk // 64
                if vv > najvise[ci]:
                    najvise[ci] = vv
                    up[ci - 1] = kk % 64
        # površina obuhvata po klasi (za infografiku bez katastra)
        u, cnt = np.unique(kl[(kl > 0) & maska_obuhvata], return_counts=True)
        godine_out[str(god)] = {
            "id": gid,
            "klase_px": {int(a): int(b) for a, b in zip(u, cnt)},
            "komadi": komadi,
            "urbano_pravilo": up,
        }
        print(god, "komada:", len(komadi) // len(POLJA), "obuhvat ha:", round(cnt.sum() * 4 / 1e4, 1))
        del kl, m, kljuc

    # maske za regije.py (gdje je unutar čestice zauzeto, a gdje slobodno)
    np.savez_compressed(
        MASKE_PUT,
        ids=ids, zk=zk, z25=z25, pr=pr, pa=pa, jv=jv, os=os_, inf=inf, ze=ze, gr=gr,
        obuhvat=maska_obuhvata,
        **{f"siroko_{g}": m for g, m in siroko_po_godini.items()},
    )
    print("maske:", MASKE_PUT, round(os.path.getsize(MASKE_PUT) / 1e6, 1), "MB")

    with open(os.path.join(R.OUT, "mreza.json")) as f:
        mreza = json.load(f)

    up_json = os.path.join(R.OUT, "up.json")
    up_kodovi = json.load(open(up_json))["kodovi"] if os.path.exists(up_json) else []

    ko_imena = sorted(c.KO_NAZIV.fillna("").unique().tolist())
    ko_idx = {k: i for i, k in enumerate(ko_imena)}
    out = {
        "opis": "Izvedeno skriptom scripts/gup-grad/cestice.py — ne uređivati ručno.",
        "piksel_m2": R.KORAK * R.KORAK,
        "komad_polja": POLJA,
        "klase": mreza["klase"],
        "planovi": mreza["planovi"],
        "cestice": {
            "susjedi": susjedi(c),
            "ko_imena": ko_imena,
            "ko": [ko_idx[k] for k in c.KO_NAZIV.fillna("")],
            "broj": c.KC_BROJ.fillna("").tolist(),
            "povrsina": [round(float(a)) for a in c.geometry.area],
            # ručni pregled ortofotom (data/gup-grad/pregled/rucno.json):
            # indeks u `rucno_vrste` + 1, 0 = nije pregledana ili nema ispravka
            "rucno": rucno_po_cestici(c),
        },
        "rucno_vrste": RUCNO_VRSTE,
        "godine": godine_out,
        "urbana_pravila_kodovi": up_kodovi,
        "izvori": {
            "cestice": "Grad Split, GIS izvoz: KATASTAR/CADASTRAL_PARCELS_2024_P",
            "zgrade_katastar": "Grad Split, GIS izvoz: ADMINISTRATIVNI_PODACI/KO_*_objekti",
            "zgrade_2025": "Grad Split, GIS izvoz: Objekti_Split_2025 (tlocrti gradskog 3D modela, isti kao Zgrade_3D/ST_3D_2024)",
            "etaze": "Grad Split, GIS izvoz: Korisna_povrsina_Split_2025 (visina krovnih ploha 3D modela, h_objekt / 3 m)",
            "promet": "Ceste, NerazvrstaneCeste, Nerazvrstane_ceste_Split_29112023, drzavna_cesta_1 (os ± pola profila), Nogostupi; OSM highway=* po razredu",
            "parkiralista": "JavnaParkiralista, ST_PARKING_I_NADZOR_Parkiralista; OSM amenity=parking, landuse=garages",
            "javne_ustanove": "OSM amenity=school/kindergarten/college/university/hospital/clinic/place_of_worship, landuse=education/religious",
            "ostalo": "Groblja, Sportski_objekti_p; OSM leisure=pitch/playground/sports_centre/stadium/track, trgovi i pješačke površine",
            "infrastruktura": "OSM power=substation, man_made=reservoir_covered/water_tower/wastewater_plant, amenity=fuel, landuse=railway",
            "zelenilo": "Parkovi_i_nasadi_poligoni (Parkovi i nasadi); OSM leisure=park, landuse=village_green",
            "gradilista": "OSM landuse=construction",
            "osm": osm_stanje(),
            "obuhvat": "OBUHVAT_PP/OBUHVATI_PP — Generalni urbanistički plan Splita",
            "urbana_pravila": "listovi 4.b/4.c Urbana pravila (2012., 2015., 2025.), scripts/gup-grad/urbana-pravila.py",
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")

    zapisi_plocice(c, godine_out, out["cestice"], up_kodovi)
    zapisi_zgrade(zg, z25g[z25g.geometry.intersects(obuhvat)])
    zapisi_slike(mreza)


def siroko_slobodno(kl: np.ndarray, slobodno: np.ndarray, krug: np.ndarray) -> np.ndarray:
    """Slobodni pikseli u koje stane `krug` a da ne izađe iz slobodnog iste klase."""
    from scipy import ndimage

    out = np.zeros(slobodno.shape, bool)
    for k in np.unique(kl[slobodno]):
        if k == 0:
            continue
        m = slobodno & (kl == k)
        out |= ndimage.binary_opening(m, structure=krug)
    print("  široko slobodno:", round(out.sum() / max(1, slobodno.sum()) * 100), "% slobodnog")
    return out


def susjedi(c) -> dict:
    """Koje se čestice dodiruju, kao CSR: susjedi i-te su lista[od[i]:od[i+1]].

    Treba pravilu o ostacima (pravila.ts): premala slobodna čestica je
    neiskoristiva samo ako nema slobodnog susjeda s kojim bi se mogla
    spojiti. Međe iz katastra nisu savršeno zatvorene, pa se dodir traži s
    razmakom od 0,3 m.
    """
    geo = c.geometry.values
    stablo = shapely.STRtree(geo)
    a, b = stablo.query(shapely.buffer(geo, 0.3), predicate="intersects")
    parovi = sorted({(int(i), int(j)) for i, j in zip(a, b) if i != j})
    od = [0] * (len(geo) + 1)
    for i, _ in parovi:
        od[i + 1] += 1
    for i in range(len(geo)):
        od[i + 1] += od[i]
    return {"od": od, "lista": [j for _, j in parovi]}


KARTA = os.path.join(ROOT, "public", "geo", "gup-grad")
PLOCICA_M = 1000.0
PLOCICA_ISHODISTE = (490000.0, 4816000.0)


def zapisi_plocice(c, godine_out, cestice, up_kodovi) -> None:
    """Čestice s mjerenjima po komadima, u pločicama od 1 km (EPSG:4326).

    Karta ih učitava samo za ono što je u oknu: cijeli grad je ~41 000
    čestica, što kao jedan GeoJSON telefon ne probavi. Pločica je određena
    točkom unutar čestice, pa je svaka čestica u točno jednoj pločici, a
    okvir pločice u indeksu je okvir njezinih čestica (smije viriti preko
    rešetke).
    """
    import shutil

    po_cestici: dict[int, dict[str, list[list[int]]]] = {}
    for god, g in godine_out.items():
        a = g["komadi"]
        w = len(POLJA)
        for i in range(0, len(a), w):
            po_cestici.setdefault(a[i], {}).setdefault(god, []).append(a[i + 1:i + w])

    idx = sorted(po_cestici)
    sub = c.iloc[idx]
    tocke = sub.geometry.representative_point()
    tx = np.floor((tocke.x.values - PLOCICA_ISHODISTE[0]) / PLOCICA_M).astype(int)
    ty = np.floor((tocke.y.values - PLOCICA_ISHODISTE[1]) / PLOCICA_M).astype(int)
    geo = sub.geometry.simplify(0.2).to_crs(4326)

    def zaokruzi(g):
        return shapely.set_precision(g, 1e-6)

    izlaz = os.path.join(KARTA, "cestice")
    if os.path.isdir(izlaz):
        shutil.rmtree(izlaz)
    os.makedirs(izlaz)
    plocice: dict[str, list] = {}
    for j, ci in enumerate(idx):
        plocice.setdefault(f"{tx[j]}_{ty[j]}", []).append((ci, geo.iloc[j]))
    indeks = []
    for kljuc, clanovi in sorted(plocice.items()):
        feats = []
        for ci, g in clanovi:
            g = zaokruzi(g)
            feats.append({
                "type": "Feature",
                "geometry": json.loads(shapely.to_geojson(g)),
                "properties": {
                    "i": ci,
                    "ko": cestice["ko_imena"][cestice["ko"][ci]],
                    "kc": cestice["broj"][ci],
                    "a": cestice["povrsina"][ci],
                    **({"r": RUCNO_VRSTE[cestice["rucno"][ci] - 1]} if cestice["rucno"][ci] else {}),
                    "k": po_cestici[ci],
                    # područje urbanog pravila po godini (za skočni prozor)
                    "u": {god: up_kodovi[g["urbano_pravilo"][ci] - 1]
                          for god, g in godine_out.items() if g["urbano_pravilo"][ci] > 0},
                },
            })
        put = os.path.join(izlaz, f"{kljuc}.json")
        with open(put, "w") as f:
            json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
        x0, y0, x1, y1 = shapely.total_bounds([g for _, g in clanovi])
        indeks.append({"id": kljuc, "n": len(feats), "granice": [[round(y0, 5), round(x0, 5)], [round(y1, 5), round(x1, 5)]]})
    with open(os.path.join(KARTA, "cestice-indeks.json"), "w") as f:
        json.dump({"opis": "Izvedeno skriptom scripts/gup-grad/cestice.py.", "plocice": indeks}, f, separators=(",", ":"))
    ukupno = sum(os.path.getsize(os.path.join(izlaz, n)) for n in os.listdir(izlaz))
    print("pločica:", len(indeks), "čestica:", len(idx), "MB:", round(ukupno / 1e6, 1))


def zapisi_zgrade(zg, z25g) -> None:
    """Zgrade oba izvora u pločicama od 1 km, za kartu provjere.

    Katastarske nose skupinu (`g`, kao u cestice.json) i šifru vrste (`v`);
    tlocrti 3D modela nemaju atributa. Na karti se crtaju zajedno, pa se
    vidi gdje se izvori razilaze — zgrada upisana u katastar koje na tlu
    nema, ili tlocrt koji katastar ne poznaje.
    """
    import shutil

    izlaz = os.path.join(KARTA, "zgrade")
    if os.path.isdir(izlaz):
        shutil.rmtree(izlaz)
    os.makedirs(izlaz)
    plocice: dict[str, list] = {}
    for izvor, df in (("k", zg), ("m", z25g)):
        tocke = df.geometry.representative_point()
        tx = np.floor((tocke.x.values - PLOCICA_ISHODISTE[0]) / PLOCICA_M).astype(int)
        ty = np.floor((tocke.y.values - PLOCICA_ISHODISTE[1]) / PLOCICA_M).astype(int)
        geo = df.geometry.simplify(0.2).to_crs(4326)
        for j in range(len(df)):
            g = shapely.set_precision(geo.iloc[j], 1e-6)
            if g.is_empty:
                continue
            svojstva = {"s": izvor}
            if izvor == "k":
                svojstva |= {"g": int(df.sk.iloc[j]), "v": int(df.VRSTA.iloc[j])}
            plocice.setdefault(f"{tx[j]}_{ty[j]}", []).append((g, svojstva))
    indeks = []
    for kljuc, clanovi in sorted(plocice.items()):
        feats = [{"type": "Feature", "geometry": json.loads(shapely.to_geojson(g)), "properties": p}
                 for g, p in clanovi]
        with open(os.path.join(izlaz, f"{kljuc}.json"), "w") as f:
            json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
        x0, y0, x1, y1 = shapely.total_bounds([g for g, _ in clanovi])
        indeks.append({"id": kljuc, "n": len(feats), "granice": [[round(y0, 5), round(x0, 5)], [round(y1, 5), round(x1, 5)]]})
    with open(os.path.join(KARTA, "zgrade-indeks.json"), "w") as f:
        json.dump({"opis": "Izvedeno skriptom scripts/gup-grad/cestice.py.", "plocice": indeks}, f, separators=(",", ":"))
    ukupno = sum(os.path.getsize(os.path.join(izlaz, n)) for n in os.listdir(izlaz))
    print("zgrade: pločica", len(indeks), "katastar", len(zg), "3D", len(z25g), "MB:", round(ukupno / 1e6, 1))


def zapisi_slike(mreza) -> None:
    """Rešetka namjene po godini, preprojicirana u Web Mercator, kao PNG.

    Boje su boje LEGENDE PLANA, ne infografike: sloj služi da se naše
    razvrstavanje usporedi sa službenim listom (ISPU) i ortofotom, a to se
    radi okom po istim bojama. Neobojeno unutar obuhvata (ulice, pruga…)
    ostaje prozirno, da se vidi što je ispod.
    """
    from PIL import Image
    from pyproj import Transformer

    u_3765 = Transformer.from_crs(3857, 3765, always_xy=True)
    u_4326 = Transformer.from_crs(3765, 4326, always_xy=True)
    u_3857 = Transformer.from_crs(3765, 3857, always_xy=True)
    x0, y0, x1, y1 = R.MREZA_BBOX
    xs, ys = u_3857.transform([x0, x1, x0, x1], [y0, y0, y1, y1])
    mx0, mx1, my0, my1 = min(xs), max(xs), min(ys), max(ys)
    korak = 3.0  # m Web Mercatora (~2,2 m na tlu na 43,5° S)
    w = int((mx1 - mx0) / korak)
    h = int((my1 - my0) / korak)
    paleta = np.zeros((256, 4), np.uint8)
    for k in mreza["klase"]:
        if k["kod"] == "P":
            continue
        b = k["boja"]
        paleta[k["i"]] = [int(b[1:3], 16), int(b[3:5], 16), int(b[5:7], 16), 255]
    lon, lat = u_4326.transform([x0, x1, x0, x1], [y0, y0, y1, y1])
    # rubovi slike u 4326 — iz rubova u 3857, ne iz rubova rešetke
    to4326 = Transformer.from_crs(3857, 4326, always_xy=True)
    lon0, lat0 = to4326.transform(mx0, my0)
    lon1, lat1 = to4326.transform(mx1, my1)
    granice = [[round(lat0, 6), round(lon0, 6)], [round(lat1, 6), round(lon1, 6)]]
    opis = []
    for gid, god in GODINE:
        kl = np.load(os.path.join(R.OUT, f"klase-{gid}.npy"))
        slika = np.zeros((h, w, 4), np.uint8)
        stupci = mx0 + (np.arange(w) + 0.5) * korak
        for r0 in range(0, h, 256):
            redovi = my1 - (np.arange(r0, min(h, r0 + 256)) + 0.5) * korak
            MX, MY = np.meshgrid(stupci, redovi)
            X, Y = u_3765.transform(MX, MY)
            c_ = np.floor((X - x0) / R.KORAK).astype(np.int64)
            r_ = np.floor((y1 - Y) / R.KORAK).astype(np.int64)
            ok = (c_ >= 0) & (r_ >= 0) & (c_ < kl.shape[1]) & (r_ < kl.shape[0])
            v = np.zeros(MX.shape, np.uint8)
            v[ok] = kl[r_[ok], c_[ok]]
            slika[r0:r0 + v.shape[0]] = paleta[v]
        put = os.path.join(KARTA, f"namjena-{god}.png")
        Image.fromarray(slika, "RGBA").save(put, optimize=True)
        opis.append({"godina": god, "url": f"/geo/gup-grad/namjena-{god}.png"})
        print("slika", put, w, "×", h, round(os.path.getsize(put) / 1e6, 2), "MB")
    with open(os.path.join(KARTA, "namjena-slike.json"), "w") as f:
        json.dump({"granice": granice, "slike": opis}, f)


if __name__ == "__main__":
    main()
