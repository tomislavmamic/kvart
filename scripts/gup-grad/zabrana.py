#!/usr/bin/env python3
"""Gdje bi prijedlog GUP-a 2025. zabranio novu gradnju do donošenja UPU-a.

Prijedlog izmjena GUP-a (travanj 2025., čl. 103. st. 1) dopušta gradnju u
područjima urbane sanacije, urbane preobrazbe i neuređenog dijela
građevinskog područja samo na temelju plana užeg područja. Do tada se nova
zgrada ne može graditi (čl. 105. st. 5 i Zakon o prostornom uređenju, NN
155/25, čl. 106. st. 3: samo rekonstrukcija i zamjena). Ta su područja
ispune na listu 4.d prijedloga; ovdje ih se vektorizira i prebroji.

Crveno = ispuna sanacije, preobrazbe ili neuređenog s lista 4.d (bitovi iz
planski-rezim.py), unutar službenog obuhvata GUP-a, bez planova na snazi.
Obuhvati planova na snazi su s ISPU-a (ispu.py, u planski-rezim-2025.geojson),
kao i za planski režim čestica: list 4.d ih crta shematski, pa se crvena
šrafura lista ne uzima. Svaki komad nosi vrstu
područja i broj propisanog UPU-a s lista 4.d u čijem je obuhvatu (0 = ni u
jednom ucrtanom obuhvatu).

Zabrana ne dira ono što je izgrađeno, nego slobodno zemljište na kojem bi se
inače smjela graditi nova zgrada. To zemljište po čestici računa
zabrana-cestice.ts (istim izračunom kao grafikon na /gup); ovdje mu se dodaje
oblik čestice i UPU u čijem je obuhvatu, pa zbrojevi idu po UPU-u.

Ulazi:
  .cache/gup-grad/pr-gup-2025.npy    planski-rezim.py (prvo pokreni njega)
  public/geo/gup-grad/planski-rezim-2025.geojson   obuhvati planova (planski-obrisi.py, ispu.py)
  data/gup-grad/zabrana-cestice.json zabrana-cestice.ts (i njega prije ovoga)
  public/geo/gup-grad/cestice/*.json oblici čestica (cestice.py)
  data/sources/Split Export/...      GIS izvoz Grada: obuhvat GUP-a, kućni brojevi

Izlaz:
  public/geo/gup-grad/zabrana-2025.geojson   komadi po vrsti i UPU-u,
      obris cijelog crvenog, obuhvat GUP-a, zbrojevi (crveno, slobodno zemljište,
      neizgrađene čestice, po UPU-u)
  public/geo/gup-grad/zabrana-cestice-2025.geojson   čestice sa slobodnim
      zemljištem koje bi čekalo UPU, s pretežitom oznakom pod sobom (vrsta)
  public/geo/gup-grad/kucni-brojevi.json     kućni brojevi u obuhvatu GUP-a
      za tražilicu adrese na /gup/zabrana

Pokretanje:  python3 scripts/gup-grad/zabrana.py
"""
from __future__ import annotations

import glob
import json
import os
import sys

import numpy as np
import pyogrio
from pyproj import Transformer
from rasterio import features
from rasterio.transform import Affine
from scipy import ndimage
from shapely.geometry import mapping, shape
from shapely.ops import transform as stransform, unary_union
from shapely.prepared import prep

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

ROOT = R.ROOT
IZVOZ = os.environ.get("SPLIT_IZVOZ", os.path.join(ROOT, "data", "sources", "Split Export"))
if not os.path.isdir(IZVOZ):
    # worktree nema data/sources; izvoz živi u glavnoj kopiji repozitorija
    IZVOZ = os.path.join(os.path.expanduser("~"), "projects", "kvart", "data", "sources", "Split Export")
BAZA = os.path.join(IZVOZ, "SPLIT_EXPORT_BAZA")
REZIM = os.path.join(R.OUT, "pr-gup-2025.npy")
NAMJENA = os.path.join(R.OUT, "klase-gup-2025.npy")
OBUHVATI = os.path.join(ROOT, "public", "geo", "gup-grad", "planski-rezim-2025.geojson")
IZLAZ = os.path.join(ROOT, "public", "geo", "gup-grad", "zabrana-2025.geojson")
IZLAZ_BROJEVI = os.path.join(ROOT, "public", "geo", "gup-grad", "kucni-brojevi.json")
CESTICE = os.path.join(ROOT, "data", "gup-grad", "zabrana-cestice.json")
PLOCICE = os.path.join(ROOT, "public", "geo", "gup-grad", "cestice")
IZLAZ_CESTICE = os.path.join(ROOT, "public", "geo", "gup-grad", "zabrana-cestice-2025.geojson")

# bitovi iz planski-rezim.py
SANACIJA, PREOBRAZBA, NEUREDENO = 4, 8, 16
VRSTE = {1: "sanacija", 2: "preobrazba", 3: "neuredeno"}
# Namjena s lista 1 (rasteriziraj.py, KLASE u model.ts): u zonama S, M/K5, I/K i T
# gradi se zgrada (ZONE_ZABRANE u zabrana-podaci.ts); ostalo ni bez zabrane nije
# za privatnu gradnju, pa se na karti ne boji kao zabrana nego kao „negradivo”.
GRADNJA = (1, 2, 4, 5)
NEGRADIVO = {"promet": (15, 0), "javna": (3,), "sport": (7, 8, 9, 13, 14), "zelenilo": (10, 11), "ostalo": (6, 12)}
# komadići ispune manji od ovoga su ostaci skeniranja (38 px = 152 m²)
NAJMANJE_PX = 38
POJEDNOSTAVI_M = 1.2
# Adresni registar piše nazive velikim slovima; ove riječi unutar naziva ostaju malim
MALA = {"i", "u", "na", "od", "do", "iza", "kod", "pod", "nad", "put", "ulica", "obala", "trg", "šetalište", "kneza",
        "kralja", "kraljice", "bana", "don", "fra", "sv.", "svetog", "svete", "biskupa", "cara", "dr.", "prilaz",
        "poljana", "stube", "odvojak", "hrvatskih", "narodnih", "pape"}

TRANSFORM = Affine(R.KORAK, 0.0, R.MREZA_BBOX[0], 0.0, -R.KORAK, R.MREZA_BBOX[3])
U_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform
U_HTRS = Transformer.from_crs(4326, 3765, always_xy=True).transform


def poligoni(g):
    if g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    return [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon" and not x.is_empty]


def naziv_ulice(s: str) -> str:
    """„ULICA KNEZA LJUDEVITA POSAVSKOG” → „Ulica kneza Ljudevita Posavskog”."""
    rijeci = s.lower().split()
    return " ".join(r if i and r in MALA else r[:1].upper() + r[1:] for i, r in enumerate(rijeci))


def zaokruzi(geom):
    """GeoJSON u WGS84 sa 6 decimala (~0,1 m)."""
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], 6), round(c[1], 6)]
        return [r(x) for x in c]
    m = mapping(stransform(U_WGS, geom))
    return {"type": m["type"], "coordinates": r(m["coordinates"])}


def novi_red(broj: int, naziv: str | None) -> dict:
    return {"broj": broj, "naziv": naziv, "sanacija_ha": 0.0, "preobrazba_ha": 0.0, "neuredeno_ha": 0.0,
            "slobodno_ha": 0.0, "neizgradjene": 0}


def crvena_rescetka(gup, planovi) -> np.ndarray:
    """Vrsta (1–3) po pikselu rešetke; 0 = nije crveno."""
    b = np.load(REZIM)
    dopusteno = features.rasterize(((gup, 1),), out_shape=(R.H, R.W), transform=TRANSFORM, fill=0, dtype="uint8") > 0
    if planovi:
        dopusteno &= features.rasterize(((p, 1) for p in planovi), out_shape=(R.H, R.W), transform=TRANSFORM,
                                        fill=0, dtype="uint8") == 0
    v = np.zeros((R.H, R.W), np.uint8)
    v[((b & NEUREDENO) > 0) & dopusteno] = 3
    v[((b & PREOBRAZBA) > 0) & dopusteno] = 2
    v[((b & SANACIJA) > 0) & dopusteno] = 1
    # mrvice i rupice od skeniranja
    lab, n = ndimage.label(v > 0)
    vel = ndimage.sum(v > 0, lab, range(1, n + 1))
    v[np.isin(lab, np.nonzero(vel < NAJMANJE_PX)[0] + 1)] = 0
    rupe = ndimage.binary_fill_holes(v > 0) & (v == 0)
    hl, hn = ndimage.label(rupe)
    hv = ndimage.sum(rupe, hl, range(1, hn + 1))
    male = np.isin(hl, np.nonzero(hv < NAJMANJE_PX)[0] + 1)
    v[male] = ndimage.grey_dilation(v, size=3)[male]
    return v


def pikseli(g, resetka: np.ndarray) -> np.ndarray:
    """Vrijednosti rešetke pod česticom; all_touched, da ni čestica uža od piksela ne ostane prazna."""
    minx, miny, maxx, maxy = g.bounds
    c0 = max(0, int((minx - R.MREZA_BBOX[0]) / R.KORAK))
    c1 = min(R.W, int((maxx - R.MREZA_BBOX[0]) / R.KORAK) + 1)
    r0 = max(0, int((R.MREZA_BBOX[3] - maxy) / R.KORAK))
    r1 = min(R.H, int((R.MREZA_BBOX[3] - miny) / R.KORAK) + 1)
    if c1 <= c0 or r1 <= r0:
        return resetka[:0, :0].ravel()
    t = Affine(R.KORAK, 0, R.MREZA_BBOX[0] + c0 * R.KORAK, 0, -R.KORAK, R.MREZA_BBOX[3] - r0 * R.KORAK)
    sub = features.rasterize([(g, 1)], out_shape=(r1 - r0, c1 - c0), transform=t, fill=0, dtype="uint8", all_touched=True)
    return resetka[r0:r1, c0:c1][sub.astype(bool)]


def vrsta_cestice(g, v: np.ndarray) -> str | None:
    """Pretežita oznaka (sanacija, preobrazba, neuređeno) pod česticom."""
    x = pikseli(g, v)
    x = x[x > 0]
    return VRSTE[int(np.bincount(x).argmax())] if x.size else None


def main() -> None:
    if not os.path.exists(REZIM):
        sys.exit(f"Nema {REZIM}: prvo pokreni scripts/gup-grad/planski-rezim.py")
    if not os.path.exists(CESTICE):
        sys.exit(f"Nema {CESTICE}: prvo pokreni npx tsx scripts/gup-grad/zabrana-cestice.ts")
    ob = pyogrio.read_dataframe(os.path.join(BAZA, "OBUHVAT_PP", "OBUHVATI_PP.shp"))
    gup = next(g for n, t, g in zip(ob.PLAN_NAME, ob.PLAN_TYPE_, ob.geometry) if t == 3 and n.strip() == "Generalni urbanistički plan Splita")
    gup = gup.buffer(0)
    pr = json.load(open(OBUHVATI))
    planovi = [stransform(U_HTRS, shape(f["geometry"])).buffer(0) for f in pr["features"] if f["properties"]["vrsta"] == "vazeci"]

    v = crvena_rescetka(gup, planovi)
    print("crveno ha", {VRSTE[k]: round(float((v == k).sum()) * R.KORAK ** 2 / 1e4, 1) for k in VRSTE})
    if not os.path.exists(NAMJENA):
        sys.exit(f"Nema {NAMJENA}: pokreni scripts/gup-grad/rasteriziraj.py gup-2025")
    namjena = np.load(NAMJENA)
    gradnja = np.isin(namjena, GRADNJA)
    # listovi 1 i 4.d nisu savršeno poravnati: uski pojas druge namjene uz rub zone
    # je pomak, a ne ulica, pa se vraća zoni za gradnju (otvaranje od 3 px = 6 m)
    ne = ndimage.binary_opening((v > 0) & ~gradnja, structure=np.ones((3, 3), bool))
    vg = np.where(ne, 0, v)
    vn = np.where(ne, v, 0)
    print("za gradnju ha", {VRSTE[k]: round(float((vg == k).sum()) * R.KORAK ** 2 / 1e4, 1) for k in VRSTE},
          "negradivo ha", {VRSTE[k]: round(float((vn == k).sum()) * R.KORAK ** 2 / 1e4, 1) for k in VRSTE})

    po_vrsti = {k: [] for k in VRSTE}
    for geom, val in features.shapes(vg, mask=vg > 0, transform=TRANSFORM):
        po_vrsti[int(val)].append(shape(geom))
    po_vrsti = {k: unary_union(g).buffer(0) for k, g in po_vrsti.items()}
    sve = unary_union([shape(g) for g, _ in features.shapes((v > 0).astype("uint8"), mask=v > 0, transform=TRANSFORM)]).buffer(0)
    negradivo = {}
    for ime, klase in NEGRADIVO.items():
        m = (vn > 0) & np.isin(namjena, klase)
        for geom, val in features.shapes(np.where(m, vn, 0), mask=m, transform=TRANSFORM):
            negradivo.setdefault((int(val), ime), []).append(shape(geom))
    negradivo = {k: unary_union(g).buffer(0) for k, g in negradivo.items()}

    upu = [(f["properties"], stransform(U_HTRS, shape(f["geometry"])).buffer(0))
           for f in pr["features"] if f["properties"]["vrsta"] == "propisan"]
    svi_upu = unary_union([g for _, g in upu])

    komadi, zbroj_upu = [], {}
    for k, g in po_vrsti.items():
        dijelovi = [(p["broj"], p["naziv"], g.intersection(ug)) for p, ug in upu]
        dijelovi.append((0, None, g.difference(svi_upu)))
        for broj, naziv, dio in dijelovi:
            for p in poligoni(dio):
                if p.area < NAJMANJE_PX * R.KORAK ** 2:
                    continue
                ps = p.simplify(POJEDNOSTAVI_M, preserve_topology=True)
                if ps.is_empty:
                    continue
                komadi.append({"type": "Feature", "properties": {"vrsta": VRSTE[k], "upu": broj, "ha": round(p.area / 1e4, 2)},
                               "geometry": zaokruzi(ps)})
                z = zbroj_upu.setdefault(broj, novi_red(broj, naziv))
                z[f"{VRSTE[k]}_ha"] += p.area / 1e4
    for (k, ime), g in negradivo.items():
        dijelovi = [(p["broj"], g.intersection(ug)) for p, ug in upu] + [(0, g.difference(svi_upu))]
        for broj, dio in dijelovi:
            for p in poligoni(dio):
                if p.area < NAJMANJE_PX * R.KORAK ** 2:
                    continue
                ps = p.simplify(POJEDNOSTAVI_M, preserve_topology=True)
                if ps.is_empty:
                    continue
                komadi.append({"type": "Feature", "properties": {"vrsta": "negradivo", "podrucje": VRSTE[k], "namjena": ime,
                                                                  "upu": broj, "ha": round(p.area / 1e4, 2)},
                               "geometry": zaokruzi(ps)})
    obris = [{"type": "Feature", "properties": {"vrsta": "obris"},
              "geometry": zaokruzi(unary_union([p.simplify(POJEDNOSTAVI_M, preserve_topology=True) for p in poligoni(sve)]))},
             {"type": "Feature", "properties": {"vrsta": "gup"}, "geometry": zaokruzi(gup.simplify(2.0, preserve_topology=True))}]

    # slobodno zemljište za novu zgradu, po čestici, s oblikom i UPU-om
    redovi = {c: (m2, bool(n), zona) for c, m2, n, zona in json.load(open(CESTICE))["cestice"]}
    oblici = {}
    for put in sorted(glob.glob(os.path.join(PLOCICE, "*.json"))):
        for f in json.load(open(put))["features"]:
            i = f["properties"]["i"]
            if i in redovi and i not in oblici:
                oblici[i] = f
    upu_prep = [(p["broj"], prep(ug)) for p, ug in upu]
    nazivi = {p["broj"]: p["naziv"] for p, _ in upu}
    cestice, bez_oblika, bez_vrste, izvan_gradnje = [], 0, 0, [0, 0.0]
    ukupno = {"neizgradjene": [0, 0.0], "djelomicno": [0, 0.0]}
    po_zoni = {}
    for i, (m2, neizgradjena, zona) in sorted(redovi.items()):
        f = oblici.get(i)
        if f is None:
            bez_oblika += 1
            continue
        g = stransform(U_HTRS, shape(f["geometry"]))
        # čestica kojoj je većina na ulici, javnoj, športskoj ili zelenoj namjeni (npr. u
        # koridoru planirane ceste) nije privatno građevno zemljište, iako ima rub u zoni
        z = pikseli(g, gradnja)
        if z.size and z.mean() < 0.5:
            izvan_gradnje[0] += 1
            izvan_gradnje[1] += m2 / 1e4
            continue
        t = g.representative_point()
        broj = next((b for b, pg in upu_prep if pg.contains(t)), 0)
        vrsta = vrsta_cestice(g, vg) or vrsta_cestice(g, v)
        bez_vrste += vrsta is None
        cestice.append({"type": "Feature", "geometry": f["geometry"],
                        "properties": {"kc": f["properties"]["kc"], "ko": f["properties"]["ko"], "m2": m2,
                                       "neizgradjena": neizgradjena, "zona": zona, "upu": broj,
                                       **({"vrsta": vrsta} if vrsta else {})}})
        z = zbroj_upu.setdefault(broj, novi_red(broj, nazivi.get(broj)))
        z["slobodno_ha"] += m2 / 1e4
        z["neizgradjene"] += int(neizgradjena)
        k = ukupno["neizgradjene" if neizgradjena else "djelomicno"]
        k[0] += 1
        k[1] += m2 / 1e4
        po_zoni[zona] = po_zoni.get(zona, 0.0) + m2 / 1e4
    if bez_oblika:
        print(f"upozorenje: {bez_oblika} čestica nema oblika u pločicama")
    if bez_vrste:
        print(f"upozorenje: {bez_vrste} čestica nema oznake s lista 4.d pod sobom")
    print(f"izostavljeno {izvan_gradnje[0]} čestica ({izvan_gradnje[1]:.2f} ha slobodnog) kojima je većina izvan zona za gradnju")

    kb = pyogrio.read_dataframe(os.path.join(BAZA, "AR_V_HOUSENUMBERS_PT_HTRS.shp"),
                                columns=["HN_NUMBER", "HN_TEXTADD", "STREETNA_1", "STREETNAME", "GRAD_KOT_1"])
    u_gupu = prep(gup)
    ulice, indeks, brojevi = [], {}, []
    for rec, g in zip(kb.drop(columns="geometry").to_dict("records"), kb.geometry.values):
        broj = int(rec["HN_NUMBER"] or 0)
        if g is None or broj <= 0 or not u_gupu.contains(g):
            continue
        dodatak = (rec["HN_TEXTADD"] or "").strip()
        if dodatak.upper().startswith("BB"):
            dodatak = ""
        naziv = naziv_ulice((rec["STREETNA_1"] or rec["STREETNAME"] or "").strip())
        if not naziv:
            continue
        kljuc = (naziv, (rec["GRAD_KOT_1"] or "").strip())
        if kljuc not in indeks:
            indeks[kljuc] = len(ulice)
            ulice.append(list(kljuc))
        lon, lat = U_WGS(g.x, g.y)
        brojevi.append([indeks[kljuc], f"{broj}{dodatak.lower()}", round(lon, 5), round(lat, 5)])

    ha = {VRSTE[k]: round(float((v == k).sum()) * R.KORAK ** 2 / 1e4, 1) for k in VRSTE}
    po_upu = sorted(({**z, **{k: round(z[k], 1) for k in ("sanacija_ha", "preobrazba_ha", "neuredeno_ha", "slobodno_ha")}}
                     for z in zbroj_upu.values()),
                    key=lambda z: (-z["slobodno_ha"], -(z["sanacija_ha"] + z["preobrazba_ha"] + z["neuredeno_ha"])))
    ha_gradnja = {VRSTE[k]: round(float((vg == k).sum()) * R.KORAK ** 2 / 1e4, 1) for k in VRSTE}
    ha_negradivo = {VRSTE[k]: round(float((vn == k).sum()) * R.KORAK ** 2 / 1e4, 1) for k in VRSTE}
    zbroj = {"ha": ha, "ukupno_ha": round(sum(ha.values()), 1),
             # ha: sve što je na listu 4.d obojeno; gradnja_ha: od toga u zonama za gradnju
             "gradnja_ha": ha_gradnja, "gradnja_ukupno_ha": round(sum(ha_gradnja.values()), 1),
             "negradivo_ha": ha_negradivo,
             "slobodno_ha": round(sum(po_zoni.values()), 1),
             "slobodno_po_zoni_ha": {z: round(v, 1) for z, v in sorted(po_zoni.items())},
             "neizgradjene": {"cestice": ukupno["neizgradjene"][0], "ha": round(ukupno["neizgradjene"][1], 1)},
             "djelomicno": {"cestice": ukupno["djelomicno"][0], "ha": round(ukupno["djelomicno"][1], 1)},
             "po_upu": po_upu}
    print(json.dumps({k: zbroj[k] for k in zbroj if k != "po_upu"}, ensure_ascii=False))

    with open(IZLAZ, "w") as f:
        json.dump({"type": "FeatureCollection",
                   "opis": "Izvedeno skriptom scripts/gup-grad/zabrana.py iz lista 4.d prijedloga GUP-a (travanj 2025.), "
                           "obuhvata planova na snazi s ISPU-a i slobodnog zemljišta po čestici (zabrana-cestice.ts).",
                   "zbroj": zbroj, "features": komadi + obris}, f, ensure_ascii=False, separators=(",", ":"))
    with open(IZLAZ_CESTICE, "w") as f:
        json.dump({"type": "FeatureCollection",
                   "opis": "Izvedeno skriptom scripts/gup-grad/zabrana.py: čestice sa slobodnim zemljištem za novu zgradu "
                           "koje bi po prijedlogu GUP-a 2025. čekalo UPU (m2), neizgrađene ili djelomično izgrađene; "
                           "bez čestica kojima je većina izvan zona za gradnju (ulice, javna, športska i zelena namjena).",
                   "features": cestice}, f, ensure_ascii=False, separators=(",", ":"))
    with open(IZLAZ_BROJEVI, "w") as f:
        json.dump({"opis": "Kućni brojevi u obuhvatu GUP-a iz adresnog registra Grada Splita (scripts/gup-grad/zabrana.py).",
                   "ulice": ulice, "brojevi": brojevi}, f, ensure_ascii=False, separators=(",", ":"))
    for p in (IZLAZ, IZLAZ_CESTICE, IZLAZ_BROJEVI):
        print(os.path.relpath(p, ROOT), round(os.path.getsize(p) / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
