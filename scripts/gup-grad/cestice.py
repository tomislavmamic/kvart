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
  pr     pikseli pod prometnom površinom (os ceste ± pola profila,
         nogostupi, parkirališta)
  os     pikseli pod ostalim uređenim: groblja, športski objekti
  ze     pikseli pod održavanim javnim zelenilom (Parkovi i nasadi)
  g      pretežita skupina katastarskih zgrada u komadu (0 = nema):
         1 stambene (1xx), 2 gospodarske i poslovne (2xx), 3 javne (3xx),
         4 pomoćne (4xx), 5 ostale građevine (6xx–9xx)

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


def citaj(put: str, **kw):
    return pyogrio.read_dataframe(put, encoding="utf-8", **kw)


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

    ceste = []
    for put, pola in [
        (os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "Ceste.shp"), POLA_CESTE),
        (os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "NerazvrstaneCeste.shp"), POLA_CESTE),
        (os.path.join(BAZA, "DRZAVNA_CESTA", "drzavna_cesta_1.shp"), POLA_DRZAVNE),
    ]:
        d = citaj(put, columns=[])
        ceste.extend(shapely.buffer(d.geometry.values, pola, cap_style="flat"))
    nog = citaj(os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "Nogostupi.shp"), columns=["Sirina_nog"])
    sir = nog.Sirina_nog.fillna(1.5).clip(lower=1.0, upper=6.0).values
    ceste.extend(shapely.buffer(nog.geometry.values, sir / 2.0, cap_style="flat"))
    park = citaj(os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "JavnaParkiralista.shp"), columns=[])
    ceste.extend(park.geometry.values)
    pr = rasteriziraj(ceste).astype(bool)

    ostalo = []
    for put in [
        os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "Groblja.shp"),
        os.path.join(BAZA, "GRADSKE_NEKRETNINE", "Sportski_objekti_p.shp"),
    ]:
        ostalo.extend(citaj(put, columns=[]).geometry.values)
    os_ = rasteriziraj(ostalo).astype(bool)

    ze = rasteriziraj(citaj(os.path.join(BAZA, "KOMUNALNA_INFRASTRUKTURA", "JavneZelenePovrsine_poligoni.shp"), columns=[]).geometry.values).astype(bool)

    # ---- po godinama -----------------------------------------------------
    n_c = len(c) + 1
    godine_out = {}
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
        n_pr = zbroj(pr)
        n_os = zbroj(os_)
        n_ze = zbroj(ze)
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
            komadi.extend([ci - 1, klasa, v, n_zk.get(k, 0), n_z25.get(k, 0),
                           n_pr.get(k, 0), n_os.get(k, 0), n_ze.get(k, 0),
                           sk.get(k, (0, 0))[0]])
        # površina obuhvata po klasi (za infografiku bez katastra)
        u, cnt = np.unique(kl[(kl > 0) & maska_obuhvata], return_counts=True)
        godine_out[str(god)] = {
            "id": gid,
            "klase_px": {int(a): int(b) for a, b in zip(u, cnt)},
            "komadi": komadi,
        }
        print(god, "komada:", len(komadi) // 9, "obuhvat ha:", round(cnt.sum() * 4 / 1e4, 1))
        del kl, m, kljuc

    with open(os.path.join(R.OUT, "mreza.json")) as f:
        mreza = json.load(f)

    ko_imena = sorted(c.KO_NAZIV.fillna("").unique().tolist())
    ko_idx = {k: i for i, k in enumerate(ko_imena)}
    out = {
        "opis": "Izvedeno skriptom scripts/gup-grad/cestice.py — ne uređivati ručno.",
        "piksel_m2": R.KORAK * R.KORAK,
        "komad_polja": ["cestica", "klasa", "n", "zk", "z25", "pr", "os", "ze", "g"],
        "klase": mreza["klase"],
        "planovi": mreza["planovi"],
        "cestice": {
            "ko_imena": ko_imena,
            "ko": [ko_idx[k] for k in c.KO_NAZIV.fillna("")],
            "broj": c.KC_BROJ.fillna("").tolist(),
            "povrsina": [round(float(a)) for a in c.geometry.area],
        },
        "godine": godine_out,
        "izvori": {
            "cestice": "Grad Split, GIS izvoz: KATASTAR/CADASTRAL_PARCELS_2024_P",
            "zgrade_katastar": "Grad Split, GIS izvoz: ADMINISTRATIVNI_PODACI/KO_*_objekti",
            "zgrade_2025": "Grad Split, GIS izvoz: Objekti_Split_2025 (tlocrti gradskog 3D modela, isti kao Zgrade_3D/ST_3D_2024)",
            "promet": "Ceste, NerazvrstaneCeste, drzavna_cesta_1 (os ± pola profila), Nogostupi, JavnaParkiralista",
            "ostalo": "Groblja, Sportski_objekti_p",
            "zelenilo": "JavneZelenePovrsine_poligoni (Parkovi i nasadi)",
            "obuhvat": "OBUHVAT_PP/OBUHVATI_PP — Generalni urbanistički plan Splita",
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")

    zapisi_plocice(c, godine_out, out["cestice"])
    zapisi_zgrade(zg, z25g[z25g.geometry.intersects(obuhvat)])
    zapisi_slike(mreza)


KARTA = os.path.join(ROOT, "public", "geo", "gup-grad")
PLOCICA_M = 1000.0
PLOCICA_ISHODISTE = (490000.0, 4816000.0)


def zapisi_plocice(c, godine_out, cestice) -> None:
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
        for i in range(0, len(a), 9):
            po_cestici.setdefault(a[i], {}).setdefault(god, []).append(a[i + 1:i + 9])

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
                    "k": po_cestici[ci],
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
