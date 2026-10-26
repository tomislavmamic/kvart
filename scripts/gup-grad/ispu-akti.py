#!/usr/bin/env python3
"""Akti iz ISPU-ova registra dozvola u plohama urbane sanacije prijedloga GUP-a 2025.

Registar eDozvola (WFS, dozvole-sanacija.py) stao je u prosincu 2025., a
geoportal ISPU (https://ispu.mgipu.hr/, „Registar dozvola/akata”) vodi i
novije predmete. Geoportal nema WFS, pa se akti skupljaju kao što ih vidi
korisnik karte:

1. slojevi „Lokacijska dozvola” i „Akt za građenje građevine” iscrtaju se
   preko javnog WMS-a geoportala (api/v1/gis/wms, isti serviceId i layerHash
   kao u katalogu api/v1/gis/catalog-izbornik) na KORAK_M po pikselu;
2. svaki iscrtani oblik (točka, obris zgrade, crta) koji dira sanaciju
   postane skup točaka upita: točka oblika najbliža težištu i rešetka
   UZORAK_M unutar većih oblika, samo one u sanaciji;
3. na svakoj točki javni identify (api/v1/gis/identify) vrati sve akte
   ondje; akt se pamti jednom po featureId, s točkom upita.

Akti koji se potpuno preklapaju s drugima vraćaju se istim identifyjem, ali
oblik skriven ispod većeg oblika drugog sloja može promaknuti ako nijedna
točka upita ne padne na nj; brojke su zato najmanje.

Ulaz:   public/geo/gup-grad/zabrana-2025.geojson (zabrana.py)
Izlaz:  .cache/gup-grad/ispu-akti.csv (nije u gitu: adrese i čestice privatnih
        dozvola), u istim stupcima kao popis iz bilješki uz izvještaj o zabrani,
        pa ga dozvole-sanacija.py čita kao ISPU_AKTI
Drugo područje: ISPU_PODRUCJE=<geojson> ISPU_IZLAZ=<csv> (gradnja-dozvole.py).
Pokretanje:  python3 scripts/gup-grad/ispu-akti.py
  slike WMS-a i odgovori identifyja spremaju se u .cache/gup-grad/ispu/
"""
from __future__ import annotations

import concurrent.futures as cf
import csv
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image
from pyproj import Transformer
from scipy import ndimage
from shapely.geometry import Point, shape
from shapely.ops import transform as stransform, unary_union
from shapely.prepared import prep

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = "https://ispu.mgipu.hr/api/v1/gis/"
ZABRANA = os.path.join(ROOT, "public", "geo", "gup-grad", "zabrana-2025.geojson")
SPREMISTE = os.path.join(ROOT, ".cache", "gup-grad", "ispu")
IZLAZ = os.environ.get("ISPU_IZLAZ") or os.path.join(ROOT, ".cache", "gup-grad", "ispu-akti.csv")
# drugo područje umjesto sanacije (GeoJSON u WGS84), npr. zelene čestice iz gradnja-dozvole.py
PODRUCJE = os.environ.get("ISPU_PODRUCJE")
# točke akta koje padnu malo izvan čestice (na međi, na susjednoj čestici iste građevne)
ZALIHA_PODRUCJA_M = 5.0

# iz kataloga (catalog-izbornik → Registar dozvola/akata → Registar akata → Prema vrsti akta)
SLOJEVI = {
    "lokacijska": {"id": "35", "hashIdentify": "Jj3RwcNNmzM", "serviceId": "7", "layers": "39,40,41",
                   "hash": "sy947WtnJXs", "label": {"hr": "Lokacijska dozvola"}},
    "gradjenje": {"id": "37", "hashIdentify": "czxiPYHQ5cs", "serviceId": "7", "layers": "42,43,44",
                  "hash": "42mGASGF7Lk", "label": {"hr": "Akt za građenje građevine"}},
}
KORAK_M = 0.5
PLOCICA_PX = 1500
UZORAK_M = 6.0
ZALIHA_M = 15.0
MJERILO = 1000  # identify traži oko točke prema mjerilu; 1:1000 je ~ metar
NITI = int(os.environ.get("ISPU_NITI", "4"))

U_HTRS = Transformer.from_crs(4326, 3765, always_xy=True).transform
U_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform


def dohvati(url: str, podaci: bytes | None = None, pokusaja: int = 4) -> bytes:
    zag = {"Referer": "https://ispu.mgipu.hr/", "User-Agent": "kvart-split (istrazivanje GUP-a)"}
    if podaci is not None:
        zag["Content-Type"] = "application/json"
    for i in range(pokusaja):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=podaci, headers=zag), timeout=120) as r:
                return r.read()
        except Exception as e:  # servis zna vratiti 502
            if i == pokusaja - 1:
                raise
            print(f"  ponavljam ({e})", file=sys.stderr)
            time.sleep(3 * (i + 1))
    raise AssertionError


def spremljeno(ime: str, fn) -> bytes:
    put = os.path.join(SPREMISTE, ime)
    if os.path.exists(put):
        return open(put, "rb").read()
    b = fn()
    open(put, "wb").write(b)
    return b


def slika(sloj: dict, b: tuple[float, float, float, float], w: int, h: int) -> np.ndarray:
    q = urllib.parse.urlencode({
        "serviceId": sloj["serviceId"], "layerHash": sloj["hash"], "layers": sloj["layers"],
        "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "FORMAT": "image/png", "TRANSPARENT": "true",
        "STYLES": "", "CRS": "EPSG:3765", "WIDTH": w, "HEIGHT": h, "BBOX": ",".join(f"{v:.1f}" for v in b),
    })
    ime = f"wms-{sloj['id']}-{hashlib.md5(q.encode()).hexdigest()[:12]}.png"
    return np.array(Image.open(io.BytesIO(spremljeno(ime, lambda: dohvati(API + "wms?" + q)))).convert("RGBA"))


def identify(x: float, y: float) -> list[dict]:
    tijelo = json.dumps({"x": round(x, 2), "y": round(y, 2), "scale": MJERILO,
                         "layers": list(SLOJEVI.values())}).encode()
    ime = f"id-{round(x, 1)}-{round(y, 1)}.json"
    try:
        return json.loads(spremljeno(ime, lambda: dohvati(API + "identify", tijelo)))
    except urllib.error.HTTPError as e:
        # servis pod opterećenjem zna odbiti upit (400); točka se preskoči i ne pamti, pa je idući prolaz ponovi
        print(f"  preskačem točku {x:.1f}, {y:.1f}: {e}", file=sys.stderr)
        return []


def tocke_upita(san, sanp) -> list[tuple[float, float]]:
    x0, y0, x1, y1 = san.buffer(ZALIHA_M).bounds
    korak = PLOCICA_PX * KORAK_M
    tocke: set[tuple[float, float]] = set()
    plocice = [(x, y) for x in np.arange(x0, x1, korak) for y in np.arange(y0, y1, korak)]
    blizu = prep(san.buffer(ZALIHA_M))
    from shapely.geometry import box
    plocice = [(x, y) for x, y in plocice if blizu.intersects(box(x, y, x + korak, y + korak))]
    print(f"pločica: {len(plocice)}", file=sys.stderr)
    for n, (px, py) in enumerate(plocice):
        b = (px, py, px + korak, py + korak)
        maska = np.zeros((PLOCICA_PX, PLOCICA_PX), bool)
        for sloj in SLOJEVI.values():
            maska |= slika(sloj, b, PLOCICA_PX, PLOCICA_PX)[..., 3] > 0
        oznake, broj = ndimage.label(maska)
        for i, sl in enumerate(ndimage.find_objects(oznake), start=1):
            if sl is None:
                continue
            ys, xs = np.nonzero(oznake[sl] == i)
            ys = ys + sl[0].start
            xs = xs + sl[1].start
            mx = px + (xs + 0.5) * KORAK_M
            my = py + korak - (ys + 0.5) * KORAK_M
            # točka najbliža težištu, pa rešetka UZORAK_M preko većih oblika
            cx, cy = mx.mean(), my.mean()
            j = int(np.argmin((mx - cx) ** 2 + (my - cy) ** 2))
            kandidati = [(mx[j], my[j])]
            celije = {}
            for x, y in zip(mx, my):
                celije.setdefault((int(x // UZORAK_M), int(y // UZORAK_M)), (x, y))
            kandidati += list(celije.values())
            for x, y in kandidati:
                if sanp.contains(Point(x, y)):
                    tocke.add((round(float(x), 1), round(float(y), 1)))
        if n % 10 == 0:
            print(f"  pločica {n + 1}/{len(plocice)}: {len(tocke)} točaka upita", file=sys.stderr)
    return sorted(tocke)


def polja(stavka: dict) -> dict:
    d: dict[str, str] = {}
    prazno = 0
    for x in stavka["items"]:
        lab = (x.get("label") or {}).get("hr") or ""
        if x.get("type") == "naslov":
            continue
        if not lab:
            prazno += 1
            lab = "opis" if prazno == 1 else "nadlezno_tijelo"
        d[lab] = "" if x.get("value") is None else str(x["value"])
    return d


def main() -> None:
    os.makedirs(SPREMISTE, exist_ok=True)
    if PODRUCJE:
        san = unary_union([stransform(U_HTRS, shape(f["geometry"])).buffer(ZALIHA_PODRUCJA_M)
                           for f in json.load(open(PODRUCJE))["features"]])
    else:
        zab = json.load(open(ZABRANA))
        san = unary_union([shape(f["geometry"]) for f in zab["features"]
                           if "sanacija" in (f["properties"].get("vrsta"), f["properties"].get("podrucje"))])
        san = stransform(U_HTRS, san).buffer(0)
    tocke = tocke_upita(san, prep(san))
    print(f"točaka upita: {len(tocke)}", file=sys.stderr)

    akti: dict[str, dict] = {}
    with cf.ThreadPoolExecutor(NITI) as ex:
        for n, ((x, y), odg) in enumerate(zip(tocke, ex.map(lambda t: identify(*t), tocke))):
            for sloj in odg:
                for st in sloj.get("items") or []:
                    fid = st.get("featureId")
                    if fid and fid not in akti:
                        akti[fid] = {"sloj": sloj.get("catalogId"), "x": x, "y": y, **polja(st)}
            if n % 200 == 0:
                print(f"  identify {n + 1}/{len(tocke)}: {len(akti)} akata", file=sys.stderr)

    stupci = ["klasa", "naziv_akta", "datum_zaprimanja", "datum_rjesavanja", "nacin_rjesavanja", "status_predmeta",
              "vrsta_zahvata", "namjena", "adresa", "katastarske_cestice", "gradjevna_cestica", "opis",
              "nadlezno_tijelo", "poveznica", "sloj", "feature_id", "lon", "lat"]
    with open(IZLAZ, "w", newline="") as fo:
        w = csv.writer(fo)
        w.writerow(stupci)
        for fid, a in sorted(akti.items(), key=lambda t: t[1].get("Datum rješavanja", "")):
            lon, lat = U_WGS(a["x"], a["y"])
            w.writerow([a.get("Klasifikacijska oznaka", ""), a.get("Naziv akta", ""),
                        a.get("Datum zaprimanja zahtjeva", ""), a.get("Datum rješavanja", ""),
                        a.get("Način rješavanja", ""), a.get("Status predmeta", ""), a.get("Vrsta zahvata", ""),
                        a.get("Namjena građevine", ""), a.get("Mjesto, ulica i kućni broj", ""),
                        a.get("Katastarska čestica i općina", ""), a.get("Građevna čestica", ""), a.get("opis", ""),
                        a.get("nadlezno_tijelo", ""), a.get("Poveznica na dodatne podatke", ""),
                        {"35": "lokacijska", "37": "gradjenje"}.get(a["sloj"], a["sloj"]), fid,
                        round(lon, 6), round(lat, 6)])
    print(f"akata: {len(akti)} → {IZLAZ}", file=sys.stderr)


if __name__ == "__main__":
    main()
