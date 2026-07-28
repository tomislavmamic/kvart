#!/usr/bin/env python3
"""Vektorizira službene prostorne planove iz PDF-a u GeoJSON za kartu kvarta.

Grafički listovi planova sa split.hr nisu skenovi nego vektorski izvozi iz
AutoCAD Map 3D-a, pa se iz njih može izvući prava geometrija zajedno s
izvornim imenima CAD slojeva. Skripta:

  1. čita PDF content stream i vadi sve putanje (linije, krivulje, pravokutnici),
  2. pridružuje im izvorni CAD sloj (PDF optional content group) i boju,
  3. georeferencira list tako da opseg sloja granice obuhvata izjednači sa
     službenim obuhvatom istog plana na državnom ISPU WMS-u (EPSG:3765),
  4. zadržava samo kurirane teme (TEME), spaja razlomljene segmente u poteze,
  5. reprojicira u EPSG:4326 i sprema GeoJSON u public/geo/planovi/.

Georeferenciranje je provjerljivo: mjerilo dobiveno iz uklapanja mora se
poklapati s mjerilom otisnutim u sastavnici lista (1:1000 → 0,352778 m/pt),
a osi se ne smiju razilaziti više od 1 %. List koji ne prođe se preskače.

Zašto je ovo vrijedno: DPU radne zone Dračevac nosi vodoopskrbu, odvodnju,
elektroopskrbu, javnu rasvjetu, plinovod i telekom kanalizaciju — slojeve
kojih u OpenStreetMapu za ovo područje uopće nema (vidi src/lib/datasets.ts).

Pokretanje:  python3 scripts/vectorize-plans.py
Traži:       qpdf, pdftotext (poppler), pyproj
Ulaz:        data/sources/planovi/…   (popis: data/sources/planovi-manifest.json)
"""
from __future__ import annotations

import glob
import json
import math
import os
import re
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdfvec import extract  # noqa: E402

try:
    from pyproj import Transformer
except ImportError:  # pragma: no cover
    sys.exit("Nedostaje pyproj:  pip install pyproj")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "sources", "planovi")
OUT = os.path.join(ROOT, "public", "geo", "planovi")

MM_PER_PT = 25.4 / 72.0
TOLERANCIJA_MJERILA = 0.02   # dopušteno odstupanje od mjerila iz sastavnice
TOLERANCIJA_OSI = 0.01       # dopuštena razlika mjerila po x i y osi
# Iscrtkane linije u CAD-u nisu spojene — između crtica stoji praznina, pa
# tolerancija spajanja mora premostiti tipičnu crticu (oko metar u mjerilu
# 1:1000). Veće od toga počelo bi spajati susjedne, nepovezane vodove.
SPOJ_EPS_M = 1.20
SAZMI_EPS_M = 0.15           # Douglas–Peucker tolerancija
# Obuhvat kvarta u EPSG:3765 (bbox iz map-views.ts). Gradski listovi poput
# GUP-a pokrivaju cijeli Split; bez rezanja bi jedan sloj bio ~73 MB.
KVART_3765 = (497574, 4818898, 501617, 4822231)


def u_kvartu(pts) -> bool:
    x0, y0, x1, y1 = KVART_3765
    return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)

TO4326 = Transformer.from_crs(3765, 4326, always_xy=True)

# Planovi bez imenovanih CAD slojeva: značenje se čita iz boje ispune prema
# tumaču znakova otisnutom na listu. Afina transformacija je izvedena jednom
# faznom korelacijom vektorske grafike protiv službenog ISPU rastera istog
# lista i ovdje je zapisana kao konstanta — ISPU WMS povremeno vraća 502, pa
# skripta ne smije o njemu ovisiti pri svakom pokretanju.
#
# Ponovno izvođenje afine: renderiraj linework u raster iste geografske
# rasprostranjenosti kao ISPU GetMap za `ispu_sloj` i `ispu`, pa uzmi vrh
# fazne korelacije. Za UPU Bilice sjever vrh je bio 14450× iznad prosjeka,
# a rezultat je provjeren preklapanjem s OSM cestama (ulična mreža plana
# pada na OSM ulice, obalni zeleni pojas prati rub ceste).
# Listovi GUP-a ovdje NISU. Njihove plohe namjene nisu nacrtane kao
# poligoni nego kao tisuće tankih šrafura, pa vađenje vektora daje krpice
# medijalne površine 20 m² iz kojih se ploha ne da složiti (bilo je 18 MB
# nerazvrstane grafike). Rješava ih scripts/trace-plans.py praćenjem
# rastera; ondje su i afine za 2008., 2015. i nacrt 2024.
PLANOVI_BOJA: list[dict[str, Any]] = [
    {
        "id": "upu-bilice-sjever",
        "naziv": "UPU Bilice sjever",
        "glob": "UPU-i na snazi/*/UPU Bilice sjever*/Grafički dio/*1. Koristenje*.pdf",
        "ispu_sloj": "HR_ISPU_UPU2_04090_R01_KN_1_1",
        "ispu": (498491, 4820462, 499301, 4821063),
        "mjerilo": 1000,        # „MJ. 1:1000" iz sastavnice + grafičko mjerilo
        "min_x": 510.0,         # lijevo od toga je sastavnica s tumačem znakova
        "afin": (0.352778, 498310.03, 4820465.13),
        "boje": {
            "#bf7eff": ("namjena-proizvodna",
                        "I — gospodarska namjena, proizvodna"),
            "#ffbf7e": ("namjena-poslovna",
                        "K — gospodarska namjena, poslovna"),
            "#bfff7e": ("namjena-zelenilo",
                        "Z5 — pejzažno i zaštitno zelenilo"),
            "#259500": ("granica-obalni-pojas",
                        "Granica zaštićenog obalnog pojasa"),
        },
    },
]

# --- Ostali planovi: što je obrađeno, a što ne i zašto ---
#
# Rotaciju stranice (/Rotate) i CropBox pdfvec sada ispravno primjenjuje, pa
# listovi bez imenovanih CAD slojeva više nisu blokirani sami po sebi:
#   • UPU Bilice sjever (/Rotate 180) — riješen, vidi PLANOVI_BOJA.
#   • UPU Bilice II – Mostine — na split.hr postoji SAMO tekstualni dio,
#     grafičkih listova nema, pa nema što vektorizirati.
#   • UPU Šine–Vidovac (/Rotate 90) — obuhvat mu je E501270–502626, što je
#     istočno od granice kvarta (do 16,51005° E), dakle izvan Dračevca i
#     Bilica; rezanje na granicu ostavilo bi prazan sloj.
#   • GUP Splita (/Rotate 270) — pokriva cijeli kvart i bio bi najvrjedniji,
#     ali georeferenciranje još nije riješeno: na listu nema otisnutog
#     mjerila, a jedini ISPU sloj za usporedbu je „VI. ID (ciljane)", čiji
#     se obuhvat ne poklapa s otisnutim listom. Fazna korelacija na
#     mjerilima 1:5000–1:25000 daje podjednake vrhove (10–13 tisuća), dakle
#     bez jasnog pobjednika, pa GUP namjerno NIJE uključen — bolje ništa
#     nego kriva namjena na karti.

PLANOVI: list[dict[str, Any]] = [
    {
        "id": "dpu-radne-zone-dracevac",
        "naziv": "DPU radne zone Dračevac",
        "glob": "DPU-i na snazi/*/DPU radne zone Dračevac*/Grafički dio/*.pdf",
        # službeni EPSG:3765 BoundingBox s ISPU WMS-a (GetCapabilities 26. 7. 2026.)
        "ispu": (499626.43366951845, 4820417.793367964,
                 500118.0778796287, 4820903.928722085),
        "ispu_sloj": "HR_ISPU_DPU36_04090_R03_*",
        "granica_sloj": "Granica obuhvata",
    },
]

# CAD sloj -> (tema, opis). Sve što nije ovdje se odbacuje: sastavnica,
# legenda, prometna signalizacija, visinske kote i sitni simboli inače
# proizvedu stotine tisuća beznačajnih objekata.
TEME: dict[str, tuple[str, str]] = {
    "7-INFRA-VO_trasa":                     ("vodoopskrba", "Trasa vodoopskrbe"),
    "D06203-ODVODNJA_PLAN":                 ("odvodnja", "Planirana odvodnja otpadnih voda"),
    "D06201-ODVODNJA":                      ("odvodnja", "Odvodnja otpadnih voda"),
    "D06203-OBORINSKA_PLAN":                ("oborinska", "Planirana oborinska odvodnja"),
    "RUBEN-BUJICA_NOVO":                    ("bujica", "Bujični kanal"),
    "7-INFRA-EL-1KV":                       ("struja", "Elektroopskrba 1 kV"),
    "7-INFRA-EL-20KV":                      ("struja", "Elektroopskrba 20 kV"),
    "D05103-PLINOVOD_PLAN":                 ("plin", "Planirani plinovod"),
    "7-INFRA-TK_kanalizacija":              ("telekom", "Telekom kanalizacija"),
    "TPS_A001_Granica obuhvata":            ("granica", "Granica obuhvata plana"),
    "TPS_C000_Zgrade POSTOJECE":            ("zgrade-postojece", "Postojeće zgrade"),
    "TPS_C000_Zgrade POSTOJECE1":           ("zgrade-postojece", "Postojeće zgrade"),
    "TPS_C003_Gradivi dio-NADZEMNO-nova gradnja": ("gradivi-dio", "Gradivi dio — nadzemno"),
    "TPS_C001_Gradivi dio-PODZEMNO":        ("gradivi-dio", "Gradivi dio — podzemno"),
    "TPS_B002_Parcelacija-ZGRADE":          ("parcelacija", "Parcelacija — zgrade"),
    "TPS_B002_Parcelacija-CESTE":           ("parcelacija", "Parcelacija — ceste"),
    "TPS_B010_PROMET_Ceste":                ("promet", "Prometne površine"),
    "D02001A-STAMBENA_N":                   ("namjena", "Stambena namjena"),
    "D02005A-G_POSLOVNA_N":                 ("namjena", "Poslovna namjena"),
}


def mjerilo_iz_sastavnice(pdf: str) -> int | None:
    txt = subprocess.run(
        ["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True
    ).stdout
    m = re.search(r"Mjerilo[^:]*:\s*1\s*[:.]\s*([\d\s]{3,8})", txt)
    return int(re.sub(r"\s+", "", m.group(1))) if m else None


def rez_sastavnice(pts: list[tuple[float, float]]) -> float:
    """x nakon kojeg počinje legenda.

    Crtež plana je jedna gusta nakupina; uzorak iste linije u legendi stoji
    desno, odvojen širokom prazninom. Bez ovog reza legendni uzorak napuhne
    opseg sloja i georeferenciranje ispadne krivo (~10 % anizotropije)."""
    xs = sorted(p[0] for p in pts)
    if len(xs) < 2:
        return float("inf")
    raspon = xs[-1] - xs[0]
    najveci, rez = 0.0, xs[-1] + 1.0
    for a, b in zip(xs, xs[1:]):
        if (b - a) > najveci:
            najveci, rez = b - a, a
    return rez + 1e-6 if najveci > raspon * 0.03 else xs[-1] + 1.0


def georeferenciraj(layers: dict, plan: dict, denom: int | None):
    """Afina transformacija PDF prostor → EPSG:3765, ili (None, razlog)."""
    ime = next((n for n in layers if plan["granica_sloj"].lower() in n.lower()), None)
    if not ime:
        return None, "nema sloja granice obuhvata"
    svi = [p for it in layers[ime] for p in it["pts"]]
    cut = rez_sastavnice(svi)
    pts = [p for p in svi if p[0] < cut]
    if len(pts) < 4:
        return None, "sloj granice prazan nakon reza legende"

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    ix0, iy0, ix1, iy1 = plan["ispu"]
    sx = (ix1 - ix0) / (x1 - x0)
    sy = (iy1 - iy0) / (y1 - y0)
    if abs(sx - sy) / sx > TOLERANCIJA_OSI:
        return None, f"anizotropija {abs(sx - sy) / sx * 100:.2f}% — sumnjivo uklapanje"
    s = (sx + sy) / 2

    if denom:
        ocekivano = MM_PER_PT * denom / 1000.0
        odstup = abs(s - ocekivano) / ocekivano
        if odstup > TOLERANCIJA_MJERILA:
            return None, (f"uklopljeno mjerilo 1:{1000 * MM_PER_PT / s:.0f} ne odgovara "
                          f"sastavnici 1:{denom} ({odstup * 100:.1f}%)")
    return (s, ix0 - x0 * s, iy0 - y0 * s, cut), None


def spoji(putanje: list[list[tuple[float, float]]], eps: float) -> list[list]:
    """Spoji razlomljene segmente u duge poteze preko podudarnih krajeva.

    CAD crta iscrtkane linije kao tisuće dvotočkastih segmenata; bez spajanja
    jedan vodovod postane 4000 zasebnih objekata."""
    def cell(p):
        return (int(math.floor(p[0] / eps)), int(math.floor(p[1] / eps)))

    kraj: dict[tuple[int, int], list[int]] = {}
    for i, p in enumerate(putanje):
        for p_end in (p[0], p[-1]):
            kraj.setdefault(cell(p_end), []).append(i)

    def blizu(a, b):
        return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 <= eps * eps

    def kandidati(p):
        cx, cy = cell(p)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                yield from kraj.get((cx + dx, cy + dy), ())

    isk = [False] * len(putanje)
    out: list[list] = []
    for i in range(len(putanje)):
        if isk[i]:
            continue
        isk[i] = True
        lanac = list(putanje[i])
        for smjer in (0, 1):
            if smjer:
                lanac.reverse()
            while True:
                glava = lanac[-1]
                sljed = None
                for j in kandidati(glava):
                    if isk[j] or j == i:
                        continue
                    cand = putanje[j]
                    if blizu(cand[0], glava):
                        sljed = (j, cand[1:])
                    elif blizu(cand[-1], glava):
                        sljed = (j, list(reversed(cand))[1:])
                    if sljed:
                        break
                if not sljed:
                    break
                isk[sljed[0]] = True
                lanac.extend(sljed[1])
        out.append(lanac)
    return out


def sazmi(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Douglas–Peucker."""
    if len(pts) < 3:
        return pts
    x0, y0 = pts[0]
    x1, y1 = pts[-1]
    dx, dy = x1 - x0, y1 - y0
    norm = math.hypot(dx, dy)
    best, bi = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = (abs(dy * px - dx * py + x1 * y0 - y1 * x0) / norm if norm
             else math.hypot(px - x0, py - y0))
        if d > best:
            best, bi = d, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return sazmi(pts[:bi + 1], eps)[:-1] + sazmi(pts[bi:], eps)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    sys.setrecursionlimit(10000)
    izvjestaj: list[dict] = []
    teme: dict[str, list] = {}

    for plan in PLANOVI:
        pdfs = sorted(glob.glob(os.path.join(SRC, plan["glob"])))
        print(f"\n=== {plan['naziv']} — {len(pdfs)} listova")
        if not pdfs:
            print("    ! nema PDF-ova (vidi data/sources/planovi-manifest.json)")
            continue

        for pdf in pdfs:
            ime = re.sub(r"^\d+_", "", os.path.splitext(os.path.basename(pdf))[0])
            try:
                layers, _ = extract(pdf)
            except Exception as e:  # noqa: BLE001
                print(f"    ✗ {ime[:50]}: čitanje palo — {e}")
                izvjestaj.append({"list": ime, "status": "greška", "razlog": str(e)})
                continue

            denom = mjerilo_iz_sastavnice(pdf)
            tf, razlog = georeferenciraj(layers, plan, denom)
            if not tf:
                print(f"    ✗ {ime[:50]}: {razlog}")
                izvjestaj.append({"list": ime, "status": "bez georeferencije",
                                  "razlog": razlog})
                continue
            s, tx, ty, cut = tf

            po_temi: dict[str, int] = {}
            for sloj, items in layers.items():
                if sloj not in TEME:
                    continue
                tema, opis = TEME[sloj]
                linije, poligoni = [], []
                for it in items:
                    pts = [(x * s + tx, y * s + ty) for x, y in it["pts"] if x < cut]
                    if len(pts) < 2:
                        continue
                    (poligoni if (it["closed"] and len(pts) >= 4) else linije).append(pts)

                for pts in spoji(linije, SPOJ_EPS_M):
                    pts = sazmi(pts, SAZMI_EPS_M)
                    if len(pts) < 2:
                        continue
                    teme.setdefault(tema, []).append(("LineString", pts, sloj, opis, ime,
                                                      plan["naziv"]))
                    po_temi[tema] = po_temi.get(tema, 0) + 1
                for pts in poligoni:
                    pts = sazmi(pts, SAZMI_EPS_M)
                    if len(pts) < 4:
                        continue
                    teme.setdefault(tema, []).append(("Polygon", pts, sloj, opis, ime,
                                                      plan["naziv"]))
                    po_temi[tema] = po_temi.get(tema, 0) + 1

            print(f"    ✓ {ime[:50]:52} 1:{denom}  " +
                  ", ".join(f"{k}={v}" for k, v in sorted(po_temi.items())))
            izvjestaj.append({"list": ime, "status": "ok", "mjerilo": denom,
                              "teme": po_temi})

    # ---- planovi klasificirani po boji ----
    for plan in PLANOVI_BOJA:
        uzorak = os.path.expanduser(plan["glob"])
        if not os.path.isabs(uzorak):
            uzorak = os.path.join(SRC, uzorak)
        pdfs = sorted(glob.glob(uzorak))
        print(f"\n=== {plan['naziv']} — {len(pdfs)} listova (klasifikacija po boji)")
        s, tx, ty = plan["afin"]
        ocekivano = MM_PER_PT * plan["mjerilo"] / 1000.0
        if abs(s - ocekivano) / ocekivano > TOLERANCIJA_MJERILA:
            print(f"    ! zapisana afina ne odgovara mjerilu 1:{plan['mjerilo']}")
            continue
        for pdf in pdfs:
            ime = re.sub(r"^\d+_", "", os.path.splitext(os.path.basename(pdf))[0])
            try:
                layers, _ = extract(pdf)
            except Exception as e:  # noqa: BLE001
                print(f"    ✗ {ime[:50]}: {e}")
                continue
            po_temi: dict[str, int] = {}
            for it in layers.get("(bez sloja)", []):
                boja = it.get("color")
                spec = plan["boje"].get(boja)
                if not spec:
                    continue
                tema, opis = spec
                gornja = plan.get("max_x", float("inf"))
                pts = [(x * s + tx, y * s + ty) for x, y in it["pts"]
                       if plan["min_x"] < x < gornja]
                if len(pts) < 2:
                    continue
                if plan.get("rezi_na_kvart") and not u_kvartu(pts):
                    continue
                kind = "Polygon" if (it["closed"] and len(pts) >= 4) else "LineString"
                pts = sazmi(pts, SAZMI_EPS_M)
                if len(pts) < (4 if kind == "Polygon" else 2):
                    continue
                teme.setdefault(tema, []).append((kind, pts, "boja " + boja,
                                                  opis, ime, plan["naziv"]))
                po_temi[tema] = po_temi.get(tema, 0) + 1
            print(f"    ✓ {ime[:50]:52} 1:{plan['mjerilo']}  " +
                  ", ".join(f"{k}={v}" for k, v in sorted(po_temi.items())))
            izvjestaj.append({"list": ime, "plan": plan["naziv"], "status": "ok",
                              "mjerilo": plan["mjerilo"], "teme": po_temi})

    # Podloga (granica, parcelacija, zgrade, promet…) crta se na svakom listu
    # jednako, pa se nakon iste transformacije pojavi 11 identičnih kopija.
    # Zadržavamo prvu pojavu svake geometrije.
    print()
    for tema in list(teme):
        vidjeno: set = set()
        jedinstveno = []
        for st in teme[tema]:
            k = (st[0], tuple((round(x, 2), round(y, 2)) for x, y in st[1]))
            if k in vidjeno:
                continue
            vidjeno.add(k)
            jedinstveno.append(st)
        if len(jedinstveno) != len(teme[tema]):
            print(f"  · {tema}: {len(teme[tema])} → {len(jedinstveno)} nakon "
                  f"uklanjanja kopija s više listova")
        teme[tema] = jedinstveno

    print()
    ukupno = 0
    for tema, stavke in sorted(teme.items()):
        feats = []
        for kind, pts, sloj, opis, listic, plan_naziv in stavke:
            coords = []
            for x, y in pts:
                lon, lat = TO4326.transform(x, y)
                coords.append([round(lon, 7), round(lat, 7)])
            if kind == "Polygon":
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                geom = {"type": "Polygon", "coordinates": [coords]}
            else:
                geom = {"type": "LineString", "coordinates": coords}
            feats.append({"type": "Feature", "geometry": geom, "properties": {
                "tema": tema, "opis": opis, "cad_sloj": sloj, "list": listic,
                "plan": plan_naziv,
                "izvor": f"{plan_naziv} (split.hr), vektorizirano iz PDF-a",
            }})
        put = os.path.join(OUT, f"{tema}.geojson")
        with open(put, "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": feats}, fh,
                      ensure_ascii=False)
        ukupno += len(feats)
        print(f"  ✓ planovi/{tema}.geojson — {len(feats)} objekata, "
              f"{os.path.getsize(put) / 1e6:.2f} MB")

    with open(os.path.join(OUT, "_izvjestaj.json"), "w", encoding="utf-8") as fh:
        json.dump(izvjestaj, fh, ensure_ascii=False, indent=1)
    print(f"\nUkupno {ukupno} objekata.")


if __name__ == "__main__":
    main()
