#!/usr/bin/env python3
"""Sporne oznake s lista 4.d prijedloga GUP-a 2025.: čestice pod zabranom
gradnje kojima oznaka ne odgovara kriteriju samoga Grada ili zakona.

Zabrana (zabrana.py) vrijedi na ispuni urbane sanacije, urbane preobrazbe i
neuređenog dijela s lista 4.d. Ovdje se ta ispuna provjerava prema dvama
kriterijima koji se mogu izmjeriti:

  Neuređeni dio. Obrazloženje prijedloga (§ 2.1.1.3) kao „osnovni kriterij
  uređenosti” uzima „mogućnost priključenja na postojeću prometnu površinu u
  funkciji, minimalne širine 4 m”. Za svaku os iz gradskog registra
  nerazvrstanih cesta (2023.) mjeri se širina čestice
  kojom os prolazi: svaka 4 m tetiva okomita na os kroz usku česticu (tetiva
  kraća od 15 m, čestica dulja od 30 m), izglađeno pomičnim medijanom na
  ±20 m (barem 3 mjerenja). Čestica neuređenog dijela koja je od takve ceste
  široke barem 4 m udaljena najviše 3 m sporna je („pristup”). Širina čestice
  ceste nije širina kolnika, pa je to gornja granica onoga što cesta može
  biti; ceste koje nisu zasebne čestice ne mjere se i ne broje kao pristup.
  Državna cesta ne broji se kao pristup: Grad u odgovorima na primjedbe o
  PPUG-u pristup s nje ne priznaje („Postojeće pristupe s državne ceste ne
  treba dodatno opterećivati”, izvješće o javnoj raspravi 2025., br. 80, 89 i
  100); njezine osi služe samo tome da se čestica ceste ne broji. Uz to se
  bilježi prolazi li na manje od 15 m mješovita ili fekalna kanalizacija
  (gradski sloj mreže i kolektora).

  Ceste izvan registra. Registar ne sadrži sve postojeće ulice i putove, a Grad
  u odgovorima na primjedbe presudnim smatra je li cesta do čestice izvedena,
  ne koliko je široka. Zato se osi traže i u gradskim slojevima Ceste i
  NerazvrstaneCeste te u OpenStreetMapu (kolne ceste i servisne ulice, bez
  kolnih prilaza, parkirališnih prolaza i privatnih putova; scripts/gup-grad/
  osm.py). Čestica neuređenog dijela uz takvu cestu, ili uz cestu iz
  registra čija se širina ne da izmjeriti, moguće je sporna („cesta”), osim
  ako je cesta izmjerena i uža od 4 m.

  Urbana sanacija. Zakon (NN 153/13, čl. 77. st. 5.) mjere urbane sanacije
  propisuje „za područja na kojima se pretežito nalaze zgrade ozakonjene na
  temelju posebnog zakona”. Za svaku plohu urbane sanacije broje se zgrade
  (tlocrti gradskog 3D modela, dijelovi krova koji se dodiruju spojeni, od
  35 m²) i one kojima je na manje od 15 m točka rješenja o izvedenom stanju
  iz javnog registra akata Ministarstva (ISPU, sloj „Akt za uporabu
  građevine”, samo usvojeni zahtjevi). Čestice u plohi s barem 10 zgrada u
  kojoj takve zgrade nisu većina sporne su („sanacija”).

  Neuređeni dio po PPUG-u. Obrazloženje kaže da je neuređeni dio određen
  PPUG-om, a list 4.d ga samo prikazuje. Prijedlog izmjena PPUG-a crta ga po
  katastarskim česticama (listovi 4.2–4.4, ppug.py). Čestica koju list 4.d
  vodi kao neuređenu, a PPUG kao izgrađenu ili neizgrađenu uređenu (bez
  šrafure), sporna je („ppug”).

  Uz to se bilježe djelomično izgrađene čestice neuređenog dijela
  („izgradjena”): zakon neuređenim naziva dio neizgrađenog dijela.

Broje se samo čestice na kojima zabrana stvarno pogađa novu gradnju
(zabrana-cestice-2025.geojson, zabrana.py), od najmanje 250 m² (najmanja
građevna čestica za stanovanje u GUP-u), i to one kojima je barem pola
površine u ispuni koja se provjerava. Čestice kojima registrirana cesta
prolazi dulje od 8 m smatraju se cestom i ne broje se.

Ulazi:
  .cache/gup-grad/pr-gup-2025.npy                   planski-rezim.py
  public/geo/gup-grad/planski-rezim-2025.geojson    obuhvati planova
  public/geo/gup-grad/zabrana-cestice-2025.geojson  zabrana.py
  public/geo/gup-grad/cestice/*.json                oblici svih čestica (cestice.py)
  data/sources/Split Export/...                     registar cesta, državne ceste,
                                                    kanalizacija, 3D model, obuhvat GUP-a
  data/gup-grad/ppug-2025.json                      razred čestice po PPUG-u (ppug.py)
  data/sources/ispu-akti/*.json                     akti za uporabu s ISPU-a (nisu u gitu:
                                                    sadrže adrese; ovdje se iz njih broje
                                                    samo udjeli po plohi)

Izlaz:
  public/geo/gup-grad/sporne-2025.geojson  sporne čestice, plohe urbane sanacije s
      udjelom ozakonjenih zgrada, osi cesta uz neuređeni dio po širini i zbrojevi

Pokretanje:  python3 scripts/gup-grad/sporne.py   (nakon zabrana.py)
"""
from __future__ import annotations

import glob
import json
import os
import sys

import numpy as np
import pyogrio
import shapely
from rasterio import features
from scipy import ndimage
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform as stransform, unary_union
from shapely.prepared import prep

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402
import zabrana as Z  # noqa: E402

ROOT = R.ROOT
PORTAL = os.path.join(Z.IZVOZ, "SPLIT_EXPORT_PORTAL")
AKTI = os.path.join(ROOT, "data", "sources", "ispu-akti")
ZABRANA_CESTICE = Z.IZLAZ_CESTICE
IZLAZ = os.path.join(ROOT, "public", "geo", "gup-grad", "sporne-2025.geojson")
PPUG = os.path.join(ROOT, "data", "gup-grad", "ppug-2025.json")
NAZIVI_PPUG = {"ppug-podrucja-zapad-2025": "4.2", "ppug-podrucja-sredisnji-2025": "4.3", "ppug-podrucja-istok-2025": "4.4"}

SANACIJA, NEUREDENO = 1, 3  # vrste u crvena_rescetka
KORAK_UZORKA = 4.0
NAJVISE_TETIVA = 15.0
NAJMANJE_DULJINA = 30.0
MEDIJAN_UZORAKA = 5  # ±5 uzoraka = ±20 m
PRISTUP_M = 3.0
KANAL_M = 15.0
CESTA_U_CESTICI_M = 8.0
OKO_NEUREDENOG_M = 60.0
AKT_M = 15.0
ZGRADA_M2 = 35.0
ZGRADA_NA_CESTICI_M2 = 30.0
NAJMANJE_ZGRADA = 10
# najmanja građevna čestica za stanovanje u GUP-u (dvojne, Ppmin = 250 m²); manje su
# čestice ostaci i trake uz ceste na koje se nova zgrada ne može smjestiti sama
NAJMANJA_CESTICA_M2 = 250.0


def udio_u(g, maska) -> float:
    """Udio površine čestice u maski rešetke."""
    minx, miny, maxx, maxy = g.bounds
    c0 = max(0, int((minx - R.MREZA_BBOX[0]) / R.KORAK))
    c1 = min(R.W, int((maxx - R.MREZA_BBOX[0]) / R.KORAK) + 1)
    r0 = max(0, int((R.MREZA_BBOX[3] - maxy) / R.KORAK))
    r1 = min(R.H, int((R.MREZA_BBOX[3] - miny) / R.KORAK) + 1)
    if c1 <= c0 or r1 <= r0:
        return 0.0
    t = Z.Affine(R.KORAK, 0, R.MREZA_BBOX[0] + c0 * R.KORAK, 0, -R.KORAK, R.MREZA_BBOX[3] - r0 * R.KORAK)
    sub = features.rasterize([(g, 1)], out_shape=(r1 - r0, c1 - c0), transform=t, fill=0, dtype="uint8").astype(bool)
    n = sub.sum()
    return float(maska[r0:r1, c0:c1][sub].sum() / n) if n else 0.0


def u_htrs(geoms):
    return [stransform(Z.U_HTRS, g) for g in geoms]


def sve_cestice(okvir) -> list:
    """Sve čestice iz pločica unutar okvira, u HTRS96/TM."""
    out = []
    for put in sorted(glob.glob(os.path.join(Z.PLOCICE, "*.json"))):
        for f in json.load(open(put))["features"]:
            g = stransform(Z.U_HTRS, shape(f["geometry"]))
            if g.intersects(okvir):
                out.append(g)
    return out


REGISTAR = "Nerazvrstane_ceste_Split_nerazvrstane_ceste_29112023.shp"
GRADSKE = [os.path.join("KOMUNALNA_INFRASTRUKTURA", "NerazvrstaneCeste.shp"), os.path.join("KOMUNALNA_INFRASTRUKTURA", "Ceste.shp")]
OSM_CESTE = os.path.join(R.OUT, "osm-ceste.json")
# kolne ceste; trunk je brza cesta, a pristup s državne ceste se ne broji
OSM_VRSTE = {"primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service",
             "primary_link", "secondary_link", "tertiary_link"}
DRZAVNE = os.path.join("DRZAVNA_CESTA", "drzavna_cesta_UI.shp")


def osi_osm(oko, drzavne) -> list:
    """Kolne ceste iz OpenStreetMapa oko neuređenog dijela, bez državnih cesta."""
    if not os.path.exists(OSM_CESTE):
        print("NEMA", OSM_CESTE, "— pokreni scripts/gup-grad/osm.py; ceste iz OSM-a se ne traže")
        return []
    drz = shapely.union_all(drzavne).buffer(6) if drzavne else None
    out = []
    for e in json.load(open(OSM_CESTE))["elements"]:
        t = e.get("tags", {})
        if t.get("highway") not in OSM_VRSTE or t.get("area") == "yes" or len(e.get("geometry", [])) < 2:
            continue
        if t.get("service") in ("driveway", "parking_aisle", "drive-through") or t.get("access") in ("private", "no"):
            continue
        g = LineString([Z.U_HTRS(q["lon"], q["lat"]) for q in e["geometry"]])
        if g.intersects(oko) and not (drz is not None and drz.contains(g.interpolate(0.5, normalized=True))):
            out.append(g)
    return out


def osi_cesta(oko, put: str) -> list:
    osi = []
    d = pyogrio.read_dataframe(put, columns=[])
    for g in d.geometry.values:
        if g is None or not g.intersects(oko):
            continue
        osi.extend(x for x in getattr(g, "geoms", [g]) if x.length > 0)
    return osi


def sirine(osi, cestice) -> list[list[tuple[Point, float]]]:
    """Izglađena širina čestice ceste svaka 4 m duž svake osi (NaN = nije izmjereno)."""
    ct = shapely.STRtree(cestice)
    duljine = {}
    po_osi = []
    for l in osi:
        L = l.length
        uzorci = []
        for s in np.arange(2, max(L - 1, 2.0), KORAK_UZORKA):
            p = l.interpolate(s)
            a, b = l.interpolate(max(0, s - 1)), l.interpolate(min(L, s + 1))
            dx, dy = b.x - a.x, b.y - a.y
            n = np.hypot(dx, dy)
            w = np.nan
            if n > 0:
                nx, ny = -dy / n, dx / n
                okomica = LineString([(p.x - nx * 20, p.y - ny * 20), (p.x + nx * 20, p.y + ny * 20)])
                for ci in ct.query(p.buffer(1.0)):
                    g = cestice[ci]
                    if g.distance(p) > 1.0:
                        continue
                    x = okomica.intersection(g)
                    dijelovi = [q for q in getattr(x, "geoms", [x])
                                if not q.is_empty and q.geom_type == "LineString" and q.distance(p) <= 1.0]
                    if not dijelovi:
                        continue
                    t = max(q.length for q in dijelovi)
                    if ci not in duljine:
                        xs, ys = g.minimum_rotated_rectangle.exterior.coords.xy
                        duljine[ci] = max(np.hypot(np.diff(xs), np.diff(ys))[:2])
                    if t < NAJVISE_TETIVA and duljine[ci] > NAJMANJE_DULJINA:
                        w = t if np.isnan(w) else max(w, t)
            uzorci.append((p, w))
        ws = np.array([w for _, w in uzorci])
        izgladeno = []
        for j, (p, _) in enumerate(uzorci):
            okolo = ws[max(0, j - MEDIJAN_UZORAKA): j + MEDIJAN_UZORAKA + 1]
            okolo = okolo[np.isfinite(okolo)]
            izgladeno.append((p, float(np.median(okolo)) if len(okolo) >= 3 else np.nan))
        po_osi.append(izgladeno)
    return po_osi


def akti_ozakonjenja() -> list[Point]:
    """Točke usvojenih rješenja o izvedenom stanju, svako jednom."""
    toc = {}
    for put in sorted(glob.glob(os.path.join(AKTI, "*.json"))):
        for r in json.load(open(put)):
            if r.get("_layer") != "uporaba":
                continue
            t = " ".join(r.get(k) or "" for k in ("title", "Naziv akta", "Vrsta zahvata"))
            if "izvedenom stanju" not in t and "ozakonjenje" not in t:
                continue
            nacin = r.get("Način rješavanja") or ""
            if "odbij" in nacin or "obustav" in nacin:
                continue
            k = r.get("Klasifikacijska oznaka") or r.get("title")
            toc[k] = Point(*Z.U_HTRS(*r["_pt"]))
    return list(toc.values())


def zgrade_3d(okvir) -> list:
    """Tlocrti 3D modela, dijelovi koji se dodiruju spojeni, od 35 m²."""
    d = pyogrio.read_dataframe(os.path.join(PORTAL, "Objekti_Split_2025_Objekti_Split_2025.shp"), columns=[],
                               bbox=okvir.bounds)
    u = shapely.union_all(shapely.buffer(d.geometry.values, 0.25))
    dijelovi = [shapely.buffer(p, -0.25) for p in getattr(u, "geoms", [u])]
    return [p for p in dijelovi if not p.is_empty and p.area >= ZGRADA_M2]


def ppug_listovi() -> dict:
    """Za svaki list građevinskih područja PPUG-a: WGS84 (lng, lat) → udio lista (x, y),
    afina dotjerana na mreži točaka lista (na 10 km je razlika od HTRS96 ispod metra),
    da preglednik iz klika na karti složi navod mjesta na listu."""
    out = {}
    for lid, u in json.load(open(PPUG))["uklapanje"].items():
        a, b, c, d, e, f = u["udio"]
        M = np.array([[a, b], [d, e]])
        # mreža točaka u dijelu lista s kartom (x 0–0,83, y 0–1)
        xs, ys = np.meshgrid(np.linspace(0.02, 0.81, 12), np.linspace(0.02, 0.98, 12))
        xy = np.c_[xs.ravel(), ys.ravel()]
        en = np.linalg.solve(M, (xy - [c, f]).T).T
        ll = np.array([Z.U_WGS(E, N) for E, N in en])
        A = np.c_[ll, np.ones(len(ll))]
        koef = np.linalg.lstsq(A, xy, rcond=None)[0]
        ost = np.abs(A @ koef - xy).max() / max(np.hypot(a, b), 1e-12)
        out[lid] = {"broj": NAZIVI_PPUG.get(lid, lid), "udio": [round(float(v), 10) for v in (*koef[:, 0], *koef[:, 1])],
                    "karta_do": 0.83}
        print(f"  {lid}: najveće odstupanje WGS84 afine {ost:.2f} m")
    return out


def main() -> None:
    if not os.path.isdir(AKTI) or not glob.glob(os.path.join(AKTI, "*.json")):
        sys.exit(f"Nema akata u {AKTI}: prikupi ih s ISPU-a (vidi opis skripte)")
    ob = pyogrio.read_dataframe(os.path.join(Z.BAZA, "OBUHVAT_PP", "OBUHVATI_PP.shp"))
    gup = next(g for n, t, g in zip(ob.PLAN_NAME, ob.PLAN_TYPE_, ob.geometry)
               if t == 3 and n.strip() == "Generalni urbanistički plan Splita").buffer(0)
    pr = json.load(open(Z.OBUHVATI))
    planovi = [stransform(Z.U_HTRS, shape(f["geometry"])).buffer(0) for f in pr["features"] if f["properties"]["vrsta"] == "vazeci"]
    upu = {f["properties"]["broj"]: f["properties"]["naziv"] for f in pr["features"] if f["properties"]["vrsta"] == "propisan"}
    v = Z.crvena_rescetka(gup, planovi)
    NEU, SAN = v == NEUREDENO, v == SANACIJA

    def poligon(maska):
        return unary_union([shape(g) for g, x in features.shapes(maska.astype("uint8"), mask=maska, transform=Z.TRANSFORM)]).buffer(0)

    neu_pol = poligon(NEU)
    oko = neu_pol.buffer(OKO_NEUREDENOG_M)
    print("neuređeno ha", round(neu_pol.area / 1e4, 1))

    # ceste uz neuređeni dio i širina njihovih čestica
    cestice = sve_cestice(oko.buffer(40))
    osi = osi_cesta(oko, os.path.join(PORTAL, REGISTAR))
    drzavne = osi_cesta(oko, os.path.join(Z.BAZA, DRZAVNE))
    ostale = [g for put in GRADSKE for g in osi_cesta(oko, os.path.join(Z.BAZA, put))] + osi_osm(oko, drzavne)
    print("osi iz registra", len(osi), "ostalih (gradski slojevi, OSM)", len(ostale))
    po_osi = sirine(osi, cestice)
    po_ostalim = sirine(ostale, cestice)
    # moguć pristup: uz postojeću cestu kojoj širina nije izmjerena ili nije u registru, osim ako je izmjerena uža od 4 m
    moguci = [p for p, w in [u for o in po_osi for u in o] if not np.isfinite(w)] + \
             [p for p, w in [u for o in po_ostalim for u in o] if not (np.isfinite(w) and w < 4.0)]
    moguci_t = shapely.STRtree(moguci)
    uzorci = [u for o in po_osi for u in o]
    W = np.array([w for _, w in uzorci])
    print("osi", len(osi), "uzoraka", len(W), "izmjereno", int(np.isfinite(W).sum()), "≥4 m", int((W >= 4).sum()))
    siroki = [(p, w) for p, w in uzorci if np.isfinite(w) and w >= 4.0]
    siroki_t = shapely.STRtree([p for p, _ in siroki])
    # čestica kojom prolazi os ceste (i državne) je cesta, a ne građevna čestica
    sve_osi = osi + drzavne
    osi_t = shapely.STRtree(sve_osi)

    kan = pyogrio.read_dataframe(os.path.join(PORTAL, "Kanalizacijska_mreza_i_kolektor_Kanalizacijska_mreza_i_kolektor.shp")).to_crs(3765)
    kan = [g for g, st, md in zip(kan.geometry.values, kan["status"].values, kan["medij"].values)
           if g is not None and g.intersects(oko) and (st or "") not in ("Plan", "Planirano") and md in ("Mješovita", "Fekalna")]
    kan_t = shapely.STRtree(kan)

    # plohe urbane sanacije i udio ozakonjenih zgrada
    lab, n = ndimage.label(SAN)
    san_pol = poligon(SAN)
    zg = zgrade_3d(san_pol.buffer(50))
    toc = akti_ozakonjenja()
    toc_t = shapely.STRtree(toc)
    plohe = {}
    for g in zg:
        p = shapely.point_on_surface(g)
        r, c = int((R.MREZA_BBOX[3] - p.y) / R.KORAK), int((p.x - R.MREZA_BBOX[0]) / R.KORAK)
        if 0 <= r < R.H and 0 <= c < R.W and lab[r, c]:
            z = plohe.setdefault(int(lab[r, c]), [0, 0])
            z[0] += 1
            z[1] += int(len(toc_t.query(g, predicate="dwithin", distance=AKT_M)) > 0)
    print("rješenja o izvedenom stanju:", len(toc), "zgrada u plohama:", sum(z[0] for z in plohe.values()))

    ppug = json.load(open(PPUG))["cestice"] if os.path.exists(PPUG) else {}

    # čestice pod zabranom
    zc = json.load(open(ZABRANA_CESTICE))["features"]
    ppug_cestice = {}
    sporne, zbroj = [], {"pristup": [0, 0.0], "cesta": [0, 0.0], "izgradjena": [0, 0.0], "sanacija": [0, 0.0], "ppug": [0, 0.0],
                         "ukupno": [0, 0.0],
                         "neuredeno": [0, 0.0], "u_sanaciji": [0, 0.0], "pristup_kanal": 0}
    for f in zc:
        p = f["properties"]
        g = stransform(Z.U_HTRS, shape(f["geometry"]))
        razlozi, info = [], {}
        kljuc = f"{p['ko']}|{p['kc']}"
        if kljuc in ppug:
            ppug_cestice[kljuc] = ppug[kljuc]
        if g.area < NAJMANJA_CESTICA_M2:
            continue
        if sum(sve_osi[i].intersection(g).length for i in osi_t.query(g)) > CESTA_U_CESTICI_M:
            continue
        if udio_u(g, NEU) >= 0.5:
            zbroj["neuredeno"][0] += 1
            zbroj["neuredeno"][1] += p["m2"] / 1e4
            blizu = siroki_t.query(g, predicate="dwithin", distance=PRISTUP_M)
            if len(blizu):
                razlozi.append("pristup")
                info["sirina"] = round(max(siroki[i][1] for i in blizu) * 2) / 2
                info["kanal"] = bool(len(kan_t.query(g, predicate="dwithin", distance=KANAL_M)))
                zbroj["pristup_kanal"] += int(info["kanal"])
            elif len(moguci_t.query(g, predicate="dwithin", distance=PRISTUP_M)):
                razlozi.append("cesta")
                info["kanal"] = bool(len(kan_t.query(g, predicate="dwithin", distance=KANAL_M)))
            if ppug.get(kljuc) in ("I", "N"):
                razlozi.append("ppug")
            if not p["neizgradjena"]:
                razlozi.append("izgradjena")
            podrucje = "neuredeno"
        elif udio_u(g, SAN) >= 0.5:
            zbroj["u_sanaciji"][0] += 1
            zbroj["u_sanaciji"][1] += p["m2"] / 1e4
            t = g.representative_point()
            r, c = int((R.MREZA_BBOX[3] - t.y) / R.KORAK), int((t.x - R.MREZA_BBOX[0]) / R.KORAK)
            z = plohe.get(int(lab[r, c])) if 0 <= r < R.H and 0 <= c < R.W else None
            if z and z[0] >= NAJMANJE_ZGRADA and z[1] * 2 < z[0]:
                razlozi.append("sanacija")
                info["udio"] = round(100 * z[1] / z[0])
            podrucje = "sanacija"
        else:
            continue
        for k in razlozi:
            zbroj[k][0] += 1
            zbroj[k][1] += p["m2"] / 1e4
        # djelomično izgrađena čestica sama po sebi nije sporna na karti: neizgrađeni
        # dio zakon određuje kao područje, a ne česticu po česticu
        if not {"pristup", "cesta", "sanacija", "ppug"} & set(razlozi):
            continue
        zbroj["ukupno"][0] += 1
        zbroj["ukupno"][1] += p["m2"] / 1e4
        sporne.append({"type": "Feature", "geometry": f["geometry"],
                       "properties": {"vrsta": "cestica", "kc": p["kc"], "ko": p["ko"], "m2": p["m2"],
                                      "neizgradjena": p["neizgradjena"], "upu": p["upu"], "podrucje": podrucje,
                                      "razlozi": razlozi, **info,
                                      **({"ppug": ppug[kljuc]} if kljuc in ppug else {})}})

    # plohe sanacije s barem 10 zgrada, s udjelom
    plohe_f = []
    for i, (nz, nr) in sorted(plohe.items()):
        if nz < NAJMANJE_ZGRADA:
            continue
        g = poligon(lab == i)
        t = g.representative_point()
        broj = next((f["properties"]["broj"] for f in pr["features"] if f["properties"]["vrsta"] == "propisan"
                     and stransform(Z.U_HTRS, shape(f["geometry"])).contains(t)), 0)
        plohe_f.append({"type": "Feature", "geometry": Z.zaokruzi(g.simplify(Z.POJEDNOSTAVI_M, preserve_topology=True)),
                        "properties": {"vrsta": "ploha", "ha": round(g.area / 1e4, 1), "zgrade": nz, "s_rjesenjem": nr,
                                       "udio": round(100 * nr / nz), "upu": broj, "manjina": nr * 2 < nz}})

    # osi cesta uz neuređeni dio, po širini čestice ceste
    razredi = {"4+": [], "<4": [], "?": []}
    uz_neuredeno = prep(neu_pol.buffer(15))
    for o in po_osi + po_ostalim:
        for (p0, w0), (p1, _) in zip(o, o[1:]):
            if not uz_neuredeno.intersects(p0):
                continue
            razredi["?" if not np.isfinite(w0) else "4+" if w0 >= 4 else "<4"].append(LineString([p0, p1]))
    # izmjerena dionica ima prednost pred istom cestom bez izmjerene širine
    zauzeto = shapely.union_all(razredi["4+"] + razredi["<4"]).buffer(5) if razredi["4+"] or razredi["<4"] else None
    if zauzeto is not None:
        razredi["?"] = [l for l in razredi["?"] if not zauzeto.contains(l)]
    ceste = []
    for k, ls in razredi.items():
        m = shapely.line_merge(shapely.union_all(ls)) if ls else None
        if m is None or m.is_empty:
            continue
        ceste.append({"type": "Feature", "geometry": Z.zaokruzi(m.simplify(1.5)),
                      "properties": {"vrsta": "cesta", "sirina": k}})

    okrugli = {k: ({"cestice": v[0], "ha": round(v[1], 1)} if isinstance(v, list) else v) for k, v in zbroj.items()}
    okrugli["plohe"] = [{k: f["properties"][k] for k in ("ha", "zgrade", "udio", "upu", "manjina")} for f in plohe_f]
    okrugli["po_upu"] = {}
    for f in sporne:
        b = f["properties"]["upu"]
        r = okrugli["po_upu"].setdefault(str(b), {"naziv": upu.get(b), "cestice": 0, "ha": 0.0})
        r["cestice"] += 1
        r["ha"] = round(r["ha"] + f["properties"]["m2"] / 1e4, 2)
    print(json.dumps({k: v for k, v in okrugli.items() if k not in ("plohe", "po_upu")}, ensure_ascii=False))
    for f in plohe_f:
        print("  ploha", f["properties"])
    with open(IZLAZ, "w") as f:
        json.dump({"type": "FeatureCollection",
                   "opis": "Izvedeno skriptom scripts/gup-grad/sporne.py: čestice pod zabranom iz prijedloga GUP-a 2025. "
                           "kojima oznaka ne odgovara kriteriju Grada (neuređeni dio uz cestu čija je čestica široka "
                           "barem 4 m), PPUG-u (neuređeno na listu 4.d, a ne na listu PPUG-a) ili zakonu (urbana sanacija "
                           "gdje ozakonjene zgrade nisu većina).",
                   "zbroj": okrugli, "ppug": ppug_listovi() if os.path.exists(PPUG) else {},
                   # razred po PPUG-u za sve čestice pod zabranom, za karticu na karti
                   "ppug_cestice": dict(sorted(ppug_cestice.items())),
                   "features": plohe_f + ceste + sporne}, f, ensure_ascii=False, separators=(",", ":"))
    print("→", os.path.relpath(IZLAZ, ROOT), round(os.path.getsize(IZLAZ) / 1e3), "kB")


if __name__ == "__main__":
    main()
