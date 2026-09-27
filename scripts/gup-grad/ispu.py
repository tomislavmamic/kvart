#!/usr/bin/env python3
"""Obuhvati planova na snazi s državnog ISPU-a, umjesto s lista 4.d.

List 4.d prijedloga GUP-a 2025. planove na snazi crta shematski: debelom
crvenom crtom oko otprilike tog mjesta, u mjerilu cijelog grada. DPU dijela
područja Dračevac je ondje četverokut od 1,5 ha preko ceste i susjednih
kuća, a plan je jedna građevna čestica od 0,46 ha južno od brze ceste.
Točan obuhvat nosi sam plan: ISPU (Informacijski sustav prostornog
uređenja) poslužuje georeferencirane listove svakog plana na snazi,
izrezane po obuhvatu — izvan obuhvata je slika prozirna. Ovdje se za svaki
plan s lista (broj iz legende → oznaka plana na ISPU-u, ručno sparena u
ISPU_PLANOVI) skine list namjene (KN_1_1) zadnje izmjene plana, a
neprozirni pikseli postanu poligon.

Propisani planovi (plavo na listu) još ne postoje, pa ih na ISPU-u nema;
njihov je obuhvat onaj s lista (planski-obrisi.py).

Isti obuhvati odlučuju i planski režim čestice u 2025.: čestica je „u planu
na snazi” kad je barem pola njezine površine unutar nekog obuhvata s ISPU-a
(na_snazi(), zove je cestice.py), a ne kad je pod crvenom šrafurom lista.

Slike se spremaju u data/sources/planovi/ispu/ (nisu u gitu), pa ponovno
pokretanje ne ovisi o servisu, koji zna vratiti 502.

Pokretanje:  python scripts/gup-grad/ispu.py [--cestice]
  zamijeni obuhvate planova na snazi u public/geo/gup-grad/planski-rezim-2025.geojson
  (planski-obrisi.py ga zove sam, pa ovo treba samo bez ponovnog praćenja lista);
  --cestice uz to prepravi bit „plan na snazi” za 2025. u već izvezenim
  česticama (data/gup-grad/cestice.json i pločice), bez ponovnog pokretanja
  cijelog cestice.py
"""
from __future__ import annotations

import importlib.util
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np
import shapely
import shapely.ops
from affine import Affine
from PIL import Image
from pyproj import Transformer
from rasterio import features
from shapely.geometry import shape

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPREMISTE = os.path.join(ROOT, "data", "sources", "planovi", "ispu")
GEOJSON = os.path.join(ROOT, "public", "geo", "gup-grad", "planski-rezim-2025.geojson")
POSLUZITELJI = [f"https://gis{i}.mgipu.hr/srv1/PPRasterZ17_Public/wms" for i in (1, 2, 3)]
JLS = "04090"  # Grad Split
KORAK_M = 0.5
NAJVECA_SLIKA = 4000  # px po strani; veći plan dobiva krupniji korak
ZALIHA_M = 10.0
MRVICA_M2 = 20.0       # neprozirni rub slike izvan obuhvata
RUPA_M2 = 50.0         # manja prozirna rupa unutar lista je šum, ne izuzeti dio obuhvata
POJEDNOSTAVI_M = 1.0

# Broj u legendi lista 4.d („Popis važećih prostornih planova užeg područja”)
# → oznaka plana na ISPU-u (HR_ISPU_<oznaka>_04090_R<izmjena>_<list>). Spareno
# po nazivu; ISPU ima DPU Visoke dvaput (DPU3 i DPU14, isti listovi), a Trg
# HBZ kao DPU45 i DPU24 (izmjene) — uzima se prvi.
ISPU_PLANOVI: dict[int, str] = {
    1: "DPU39",   # DPU sjeverozapadnog dijela Kocunara
    2: "DPU3",    # DPU jugoistočnog dijela područja Visoke
    3: "DPU11",   # DPU istočnog dijela područja Duilovo
    4: "DPU52",   # DPU Veletržnice
    5: "DPU32",   # DPU priobalnog područja Trstenik-Radoševac
    6: "DPU28",   # DPU dijela Lovreta
    7: "DPU35",   # DPU prostora Žnjana (sjeverno od Bračke)
    8: "DPU40",   # DPU dijela sjeverozapadnog područja Pazdigrad
    9: "DPU54",   # DPU lokacija vodosprema u Park-šumi Marjan
    10: "DPU4",   # DPU dijela područja Brnika (Jadro)
    11: "DPU20",  # DPU Obrtne tehničke škole u Špinutu
    12: "DPU9",   # DPU dijela područja Trstenik
    13: "DPU13",  # DPU jugoistočno od raskrižja Bračke i Velebitske
    14: "DPU37",  # DPU prostora na sjevernom dijelu Kmana (na listu bez broja)
    15: "DPU7",   # DPU dijela područja Gripe
    16: "DPU5",   # DPU dijela područja Dračevac
    17: "DPU62",  # DPU Zdravstvene škole na Firulama
    18: "DPU16",  # DPU južnog dijela Dragovoda
    19: "DPU65",  # DPU zone javnih sadržaja sjeverno od Poljičke
    20: "DPU45",  # DPU Trga Hrvatske bratske zajednice
    21: "DPU42",  # DPU Svačićeve ulice
    22: "DPU21",  # DPU područja oko crkvice Gospe od Žnjana
    23: "DPU26",  # DPU istočno od potoka Radoševac
    24: "DPU31",  # DPU poteza uz Poljičku sjeverno od bolnice Firule (P21)
    25: "DPU30",  # DPU sjeveroistočno od raskrižja Bruna Bušića i Poljičke
    26: "DPU36",  # DPU radne zone Dračevac
    27: "DPU44",  # DPU tenis centra u Stobreču
    28: "DPU41",  # DPU stambenog naselja Križine-Trstenik
    29: "DPU55",  # DPU P26 južno od križanja Domovinskog rata i ZNG
    30: "DPU8",   # DPU dijela Kila sjeveroistočno od TS Vrboran (P23a)
    31: "DPU29",  # DPU područja Zenta
    32: "DPU66",  # DPU zone K5 sjeverno od Vukovarske
    33: "DPU57",  # DPU istočnog dijela P26
    34: "DPU56",  # DPU P26 sjeverno od križanja Domovinskog rata i ZNG
    35: "DPU27",  # DPU između Tolstojeve ulice i usjeka pruge
    36: "UPU1",   # UPU Bilice II Mostine
    37: "UPU14",  # UPU stambenog naselja Vrh Sućidra
    38: "UPU5",   # UPU Kampusa
    39: "UPU16",  # UPU zone poslovnih sadržaja južno od Solinske ceste (Brda)
    40: "UPU7",   # UPU dijela Mejaša i Dragovoda
    41: "UPU9",   # UPU područja Sirobuja
    42: "UPU4",   # UPU Dujmovača - Smokovik zapad
    43: "UPU2",   # UPU Bilice sjever
    44: "UPU13",  # UPU stambenog naselja Stobreč
    45: "UPU10",  # UPU područja Šine - Vidovac
    46: "PUP2",   # PUP područja Pazdigrad (III. izmjene: dio stavljen izvan snage)
}
LIST = "KN_1_1"  # namjena; ima ga svaki plan

U4326 = Transformer.from_crs(3765, 4326, always_xy=True)
VAZECI = 1  # bit planskog režima (planski-rezim.py, rezim.ts)
IZVOR = "plan na snazi 2025.: obuhvati planova s ISPU-a, scripts/gup-grad/ispu.py"


def _dohvati(upit: str, provjera) -> bytes:
    """GET na prvi zrcalni poslužitelj koji odgovori ispravno."""
    zadnja = None
    for pokusaj in range(6):
        url = POSLUZITELJI[pokusaj % len(POSLUZITELJI)] + "?" + upit
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (kvart gup-grad)"})
            with urllib.request.urlopen(req, timeout=120) as r:
                tijelo = r.read()
            if provjera(tijelo):
                return tijelo
            zadnja = tijelo[:200]
        except (urllib.error.URLError, TimeoutError) as e:
            zadnja = e
        time.sleep(2 + pokusaj * 2)
    raise SystemExit(f"ISPU ne odgovara ({zadnja!r}): {upit[:120]}")


def slojevi() -> dict[str, tuple[str, tuple[float, float, float, float]]]:
    """Oznaka plana → (ime sloja LIST zadnje izmjene, okvir u EPSG:3765)."""
    put = os.path.join(SPREMISTE, "capabilities.xml")
    if not os.path.exists(put):
        os.makedirs(SPREMISTE, exist_ok=True)
        tijelo = _dohvati("service=WMS&request=GetCapabilities&version=1.3.0", lambda b: b"<WMS_Capabilities" in b[:2000])
        with open(put, "wb") as f:
            f.write(tijelo)
    ns = {"w": "http://www.opengis.net/wms"}
    out: dict[str, tuple[int, str, tuple]] = {}
    for sloj in ET.parse(put).iter("{http://www.opengis.net/wms}Layer"):
        ime = sloj.find("w:Name", ns)
        m = re.match(rf"HR_ISPU_([A-Z]+\d+)_{JLS}_R(\d+)_{LIST}$", ime.text if ime is not None else "")
        if not m:
            continue
        okvir = next(b.attrib for b in sloj.findall("w:BoundingBox", ns) if b.get("CRS") == "EPSG:3765")
        izmjena = int(m.group(2))
        if m.group(1) not in out or izmjena > out[m.group(1)][0]:
            out[m.group(1)] = (izmjena, ime.text, tuple(float(okvir[k]) for k in ("minx", "miny", "maxx", "maxy")))
    return {k: (v[1], v[2]) for k, v in out.items()}


def slika(ime: str, okvir: tuple[float, float, float, float], korak: float = KORAK_M,
          zaliha: float = ZALIHA_M) -> tuple[np.ndarray, Affine]:
    """List plana (RGBA) oko okvira i njegova geotransformacija (EPSG:3765)."""
    x0, y0, x1, y1 = okvir[0] - zaliha, okvir[1] - zaliha, okvir[2] + zaliha, okvir[3] + zaliha
    korak = max(korak, (x1 - x0) / NAJVECA_SLIKA, (y1 - y0) / NAJVECA_SLIKA)
    w, h = math.ceil((x1 - x0) / korak), math.ceil((y1 - y0) / korak)
    x1, y1 = x0 + w * korak, y0 + h * korak
    put = os.path.join(SPREMISTE, f"{ime}_{int(x0)}_{int(y0)}_{korak:g}.png")
    if not os.path.exists(put):
        os.makedirs(SPREMISTE, exist_ok=True)
        upit = urllib.parse.urlencode({
            "service": "WMS", "request": "GetMap", "version": "1.3.0", "layers": ime, "styles": "",
            "crs": "EPSG:3765", "bbox": f"{x0},{y0},{x1},{y1}", "width": w, "height": h,
            "format": "image/png", "transparent": "true",
        })
        tijelo = _dohvati(upit, lambda b: b[:8] == b"\x89PNG\r\n\x1a\n")
        with open(put + ".tmp", "wb") as f:
            f.write(tijelo)
        os.replace(put + ".tmp", put)
    a = np.asarray(Image.open(put).convert("RGBA"))
    return a, Affine(korak, 0, x0, 0, -korak, y1)


def obuhvat(ime: str, okvir: tuple[float, float, float, float]) -> shapely.Geometry:
    """Obuhvat plana u EPSG:3765: neprozirni dio lista."""
    a, tf = slika(ime, okvir)
    m = a[..., 3] >= 128
    if not m.any():
        raise SystemExit(f"{ime}: list je prazan")
    geom = shapely.union_all([shape(g) for g, v in features.shapes(m.astype(np.uint8), mask=m, transform=tf) if v == 1])
    dijelovi = []
    for p in getattr(geom, "geoms", [geom]):
        if p.area < MRVICA_M2:
            continue
        rupe = [r for r in p.interiors if shapely.Polygon(r).area >= RUPA_M2]
        dijelovi.append(shapely.Polygon(p.exterior, rupe))
    return shapely.union_all(dijelovi).simplify(POJEDNOSTAVI_M, preserve_topology=True)


def u_4326(geom: shapely.Geometry) -> shapely.Geometry:
    g = shapely.transform(geom, lambda xy: np.column_stack(U4326.transform(xy[:, 0], xy[:, 1])))
    return shapely.set_precision(g, 1e-6)


def obuhvati(legenda: dict[int, tuple[str, str | None]]) -> list[dict]:
    """Značajke planova na snazi (vrsta "vazeci") za planski-rezim-2025.geojson.

    `legenda`: broj → (naziv, brojevi Službenog glasnika) iz popisa na listu 4.d.
    """
    nepoznati = sorted(set(legenda) - set(ISPU_PLANOVI))
    if nepoznati:
        raise SystemExit(f"planovi s lista bez para na ISPU-u: {nepoznati} — dopuni ISPU_PLANOVI")
    s = slojevi()
    geom = {}
    for broj in sorted(legenda):
        oznaka = ISPU_PLANOVI[broj]
        if oznaka not in s:
            raise SystemExit(f"{broj} {legenda[broj][0]}: nema sloja {oznaka}_…_{LIST} na ISPU-u")
        geom[broj] = obuhvat(*s[oznaka])
    feats = []
    for broj, g in geom.items():
        naziv, glasnik = legenda[broj]
        # natpis što dalje od ruba, i izvan manjih planova unutar ovoga
        # (DPU radne zone Dračevac leži u UPU-u Bilice II Mostine)
        unutra = [h for b, h in geom.items() if b != broj and h.area < g.area and h.intersects(g)]
        slobodno = g.difference(shapely.union_all(unutra)) if unutra else g
        if slobodno.area < 0.2 * g.area:
            slobodno = g
        najveci = max(getattr(slobodno, "geoms", [slobodno]), key=lambda x: x.area)
        t = shapely.ops.polylabel(najveci, tolerance=1.0)
        svojstva = {
            "vrsta": "vazeci", "broj": broj, "naziv": naziv, "ha": round(g.area / 1e4, 2 if g.area < 1e4 else 1),
            "tocka": [round(v, 6) for v in U4326.transform(t.x, t.y)], "ispu": ISPU_PLANOVI[broj],
        }
        if glasnik:
            svojstva["glasnik"] = glasnik
        feats.append({"type": "Feature", "geometry": json.loads(shapely.to_geojson(u_4326(g))), "properties": svojstva})
        print(f"  {broj:>2} {ISPU_PLANOVI[broj]:<6} {naziv[:58]:58} {svojstva['ha']:>6} ha")
    return feats


def na_snazi(geometrije) -> np.ndarray:
    """Koje su čestice (EPSG:3765) u planu na snazi: barem pola površine u obuhvatu s ISPU-a.

    Isto pravilo „barem pola” kao za bitove lista u cestice.py.
    """
    s = slojevi()
    unija = shapely.union_all([obuhvat(*s[o]) for o in sorted(set(ISPU_PLANOVI.values()))])
    g = np.asarray(geometrije, dtype=object)
    pov = shapely.area(g)
    u_planu = np.zeros(len(g))
    kandidati = shapely.intersects(g, unija)
    u_planu[kandidati] = shapely.area(shapely.intersection(g[kandidati], unija))
    return (pov > 0) & (u_planu * 2 >= pov)


def popravi_cestice() -> None:
    """Bit „plan na snazi” za 2025. u već izvezenim česticama, po obuhvatima s ISPU-a."""
    import glob

    u3765 = Transformer.from_crs(4326, 3765, always_xy=True)
    karta = os.path.join(ROOT, "public", "geo", "gup-grad", "cestice")
    plocice = {}
    for put in sorted(glob.glob(os.path.join(karta, "*.json"))):
        with open(put, encoding="utf-8") as f:
            plocice[put] = json.load(f)
    znacajke = [(put, z) for put, fc in plocice.items() for z in fc["features"]]
    geo = [shapely.transform(shape(z["geometry"]), lambda xy: np.column_stack(u3765.transform(xy[:, 0], xy[:, 1])))
           for _, z in znacajke]
    u_planu = na_snazi(geo)

    put_json = os.path.join(ROOT, "data", "gup-grad", "cestice.json")
    with open(put_json, encoding="utf-8") as f:
        d = json.load(f)
    rezim = d["godine"]["2025"]["planski_rezim"]
    if IZVOR not in d["izvori"]["planski_rezim"]:
        d["izvori"]["planski_rezim"] += "; " + IZVOR
    dobilo = izgubilo = 0
    promijenjene = set()
    for (put, z), v in zip(znacajke, u_planu):
        s = z["properties"]
        stari = s.get("p", {}).get("2025", 0)
        novi = (stari & ~VAZECI) | (VAZECI if v else 0)
        if novi == stari:
            continue
        dobilo += novi > stari
        izgubilo += novi < stari
        if novi:
            s.setdefault("p", {})["2025"] = novi
        else:
            del s["p"]["2025"]
            if not s["p"]:
                del s["p"]
        rezim[s["i"]] = novi
        promijenjene.add(put)
    for put in promijenjene:
        with open(put, "w", encoding="utf-8") as f:
            json.dump(plocice[put], f, ensure_ascii=False, separators=(",", ":"))
    with open(put_json, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    print(f"čestice: u planu na snazi {int(u_planu.sum())}, bit dobilo {dobilo}, izgubilo {izgubilo}; "
          f"pločica prepravljeno {len(promijenjene)}")


def main() -> None:
    # nazivi s legende lista: planski-obrisi.py ih zna pročitati
    spec = importlib.util.spec_from_file_location("planski_obrisi", os.path.join(os.path.dirname(__file__), "planski-obrisi.py"))
    po = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(po)  # type: ignore[union-attr]
    legenda = po.legenda_vazecih()

    with open(GEOJSON, encoding="utf-8") as f:
        fc = json.load(f)
    propisani = [f for f in fc["features"] if f["properties"]["vrsta"] != "vazeci"]
    print(f"planovi na snazi s ISPU-a ({len(legenda)}):")
    fc["features"] = obuhvati(legenda) + propisani
    fc["opis"] = po.OPIS
    with open(GEOJSON, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", GEOJSON, round(os.path.getsize(GEOJSON) / 1e3), "kB")
    if "--cestice" in sys.argv[1:]:
        popravi_cestice()


if __name__ == "__main__":
    main()
