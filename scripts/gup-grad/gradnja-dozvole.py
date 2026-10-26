#!/usr/bin/env python3
"""Dozvole na zelenim česticama karte /gup/gradnja: gdje se na zemljištu koje
karta pokazuje kao mjesto za stambenu zgradu već gradi ili se traži dozvola.

Zelene čestice su katastarske čestice (public/geo/gup-grad/cestice) na kojima
je barem NAJMANJE_ZELENO_M2 piksela kategorije „stambeno” ili „stambeno, ali
nedostaje ulica ili kanalizacija” (pločice public/geo/gup-grad/gradnja,
gradnja.ts), bez javnog zemljišta, i čestice sa slobodnim zemljištem pod
planom na snazi (DPU, UPU), gdje odlučuje plan pa se može i graditi.

Dozvole su s geoportala ISPU (registar akata): ispu-akti.py s maskom tih
čestica ($ISPU_PODRUCJE) skupi sve akte koji ih diraju. Registar eDozvola
(WFS, dozvole-sanacija.py) u listopadu 2026. vraća 503, a ISPU vodi i
starije predmete. Uzimaju se lokacijske i građevinske dozvole izdane od
OD_DATUMA (starije su istekle ako gradnja nije počela: građevinska za 3,
lokacijska za 2 + 2 godine) i zahtjevi u obradi zaprimljeni od OD_DATUMA.
Skupinu čestica akta daje njegov popis katastarskih čestica („3409/1, 3408
k.o. SPLIT”), a ne oblik.

Lokacijske dozvole za ulice, kanalizaciju i drugu
infrastrukturu obuhvaćaju desetke čestica, i javnih i privatnih, a ne znače
da se na njima gradi kuća: akti kojima je namjena ili zahvat infrastruktura
(INFRASTRUKTURA), i akti s više od NAJVISE_CESTICA zelenih čestica a bez
stambene namjene, izostavljaju se i broje se zasebno.

Izlaz: public/geo/gup-grad/gradnja-dozvole-2025.json
  akti:    klasa, postupak, ishod, datumi, namjena, zahvat, adresa, k.č., izvor,
           obuhvat (GeoJSON) i indeksi zelenih čestica koje zahvaća
  cestice: k.o., k.č., oblik, zeleno m² i indeksi akata (skupina se na
           karti vidi kao jedna kad akt zahvaća više čestica)
Javni podaci registra (kao /planovi/dozvole), bez imena investitora.

Čestice svakog akta su jedna građevna čestica: --skupine ih zapiše u
data/gup-grad/dozvole-skupine-2025.json, a gradnja-skupine.py ih ondje računa
zajedno (bez puta, ostatka uz zgradu i „premalo” unutar skupine).

Pokretanje:  python3 scripts/gup-grad/gradnja-dozvole.py --skupine       (prije gradnja-skupine.py)
             python3 scripts/gup-grad/gradnja-dozvole.py --samo-maska   (maska čestica)
  ISPU: ISPU_PODRUCJE=.cache/gup-grad/zelene-cestice.geojson ISPU_IZLAZ=.cache/gup-grad/ispu-akti-zelene.csv \
        python3 scripts/gup-grad/ispu-akti.py
  pa:          python3 scripts/gup-grad/gradnja-dozvole.py
"""
from __future__ import annotations

import csv
import datetime as dt
import glob
import importlib.util
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform as stransform, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JAVNO = os.path.join(ROOT, "public", "geo", "gup-grad")
CACHE = os.path.join(ROOT, ".cache", "gup-grad")
IZLAZ = os.path.join(JAVNO, "gradnja-dozvole-2025.json")
MASKA = os.path.join(CACHE, "zelene-cestice.geojson")
SKUPINE = os.path.join(ROOT, "data", "gup-grad", "dozvole-skupine-2025.json")
ISPU_AKTI = os.environ.get("ISPU_AKTI") or os.path.join(CACHE, "ispu-akti-zelene.csv")

# stambeno, stambeno uz uvjet, i gradilišta iz zahtjeva i dozvola (stambeno i nestambeno; gradnja.ts)
ZELENO = (13, 11, 25, 26, 27, 28)
PLAN_NA_SNAZI = 7  # gornja tri bita: slobodno pod DPU-om ili UPU-om na snazi (gradnja.ts)
NAJMANJE_ZELENO_M2 = 20.0
NAJVISE_CESTICA = 12
OD_DATUMA = "2020-01-01"
INFRASTRUKTURA = re.compile(
    r"prometnic|cest[ae]|ulic[ae]|kolnik|nogostup|parkiral|kanaliz|odvodn|vodovod|vodoopskrb|elektroenerget|"
    r"trafostanic|transformatorsk|kabel|plinovod|javn\w* rasvjet|infrastruktur|komunaln|telekomunik|EKI\b|zid\b|potporn",
    re.I,
)
NIJE_NOVA = re.compile(r"rekonstrukc|uporab|uklanjanj|ozakonjenj", re.I)
STAMBENO = re.compile(r"stamben|višestamben|obiteljsk", re.I)

U_HTRS = Transformer.from_crs(4326, 3765, always_xy=True).transform
U_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform

# zajednički dohvat iz dozvole-sanacija.py (ime s crticom, pa preko importliba)
_spec = importlib.util.spec_from_file_location("dozvole_sanacija", os.path.join(os.path.dirname(__file__), "dozvole-sanacija.py"))
ds = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ds)


def mercY(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + lat * math.pi / 360))


def izMercY(y: float) -> float:
    return 360 / math.pi * math.atan(math.exp(y)) - 90


def zelene_tocke() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Središta zelenih piksela i slobodnih pod planom na snazi (dužina, širina), površina u m² i je li pod planom."""
    ind = json.load(open(os.path.join(JAVNO, "gradnja.json")))
    lng, lat, m2, plan = [], [], [], []
    for p in ind["plocice"]:
        a = np.array(Image.open(os.path.join(ROOT, "public", p["url"].lstrip("/"))))
        b = a[..., 2]
        na = a[..., 3] == 255
        pod_planom = na & ((b >> 5) == PLAN_NA_SNAZI)
        m = (na & np.isin(b & 31, ZELENO) & ((b >> 5) == 0)) | pod_planom
        ys, xs = np.nonzero(m)
        if not len(ys):
            continue
        (jug, zapad), (sjever, istok) = p["granice"]
        h, w = m.shape
        y0, y1 = mercY(sjever), mercY(jug)
        la = np.array([izMercY(y0 - (r + 0.5) / h * (y0 - y1)) for r in range(h)])[ys]
        lng.append(zapad + (xs + 0.5) / w * (istok - zapad))
        lat.append(la)
        m2.append((ind["korak"] * np.cos(np.radians(la))) ** 2)
        plan.append(pod_planom[ys, xs])
    return np.concatenate(lng), np.concatenate(lat), np.concatenate(m2), np.concatenate(plan)


def zelene_cestice() -> tuple[list[dict], dict[tuple[str, str], dict]]:
    """Zelene čestice (i slobodne pod planom na snazi) i sve čestice po (k.o., k.č.) za skupine akata."""
    cestice = []
    for put in sorted(glob.glob(os.path.join(JAVNO, "cestice", "*.json"))):
        for f in json.load(open(put))["features"]:
            if f.get("geometry") and f["geometry"]["type"] in ("Polygon", "MultiPolygon"):
                cestice.append(f)
    # ista čestica može biti u dvije pločice: jednom
    po_id = {f["properties"]["i"]: f for f in cestice}
    cestice = list(po_id.values())
    oblici = [shape(f["geometry"]) for f in cestice]
    stablo = STRtree(oblici)
    lng, lat, m2, plan = zelene_tocke()
    zeleno = np.zeros(len(cestice))
    pod_planom = np.zeros(len(cestice))
    tocke = [Point(x, y) for x, y in zip(lng, lat)]
    for ti, ci in zip(*stablo.query(tocke, predicate="within")):
        if plan[ti]:
            pod_planom[ci] += m2[ti]
        else:
            zeleno[ci] += m2[ti]
    out = []
    for ci in np.flatnonzero(zeleno + pod_planom >= NAJMANJE_ZELENO_M2):
        f = cestice[ci]
        out.append({"ko": f["properties"]["ko"], "kc": f["properties"]["kc"], "a": f["properties"].get("a"),
                    "zeleno_m2": round(float(zeleno[ci])), "plan_m2": round(float(pod_planom[ci])),
                    "wgs": oblici[ci], "htrs": stransform(U_HTRS, oblici[ci]).buffer(0)})
    sve = {(f["properties"]["ko"].upper(), f["properties"]["kc"]): {"ko": f["properties"]["ko"], "kc": f["properties"]["kc"], "wgs": g}
           for f, g in zip(cestice, oblici)}
    return out, sve


def cestice_akta(tekst: str) -> list[tuple[str, str]]:
    """„3409/1, 3408 k.o. SPLIT; 12 k.o. STOBREČ” → [(SPLIT, 3409/1), (SPLIT, 3408), (STOBREČ, 12)]."""
    out = []
    for dio in re.split(r";|\n", tekst or ""):
        m = re.search(r"^(.*?)\s*k\.?\s*o\.?\s*(.+)$", dio.strip(), re.I)
        if not m:
            continue
        ko = m.group(2).strip().upper()
        for kc in re.split(r"[,\s]+", m.group(1)):
            kc = kc.strip().rstrip(".")
            if re.fullmatch(r"\d+(/\d+)?", kc):
                out.append((ko, kc))
    return out


def akti_ispu() -> list[dict]:
    if not os.path.exists(ISPU_AKTI):
        sys.exit(f"nema {ISPU_AKTI}: pokreni ispu-akti.py s ISPU_PODRUCJE={MASKA} (vidi gore)")
    akti = {}
    for r in csv.DictReader(open(ISPU_AKTI)):
        k = r["klasa"].strip()
        postupak = ds.postupak_po_klasi(k) or {"lokacijska": "lokacijska", "gradjenje": "građevinska"}.get(r["sloj"])
        if not k or not postupak:
            continue
        # isti predmet može se vratiti s više točaka: jednom
        akti.setdefault(k, {**r, "postupak": postupak})
    return list(akti.values())


def prihvatljiv(r: dict, izostavljeno: dict) -> tuple | None:
    """Ishod, datumi, je li stambeni i popis čestica akta koji ulazi na kartu; None ako ne ulazi (i zašto, u izostavljeno)."""
    ish = ds.ishod(r["nacin_rjesavanja"] or None, r["status_predmeta"])
    zaprimljeno, rijeseno = ds.iso(r["datum_zaprimanja"]), ds.iso(r["datum_rjesavanja"])
    if ish in ("odbijena", "obustavljena", "proslijeđena"):
        izostavljeno["odbijena ili obustavljena"] += 1
        return None
    datum = rijeseno if ish == "izdana" else zaprimljeno
    if ish not in ("izdana", "u obradi") or not datum or datum < OD_DATUMA:
        izostavljeno["istekla ili stara"] += 1
        return None
    opis = " ".join((r["namjena"], r["vrsta_zahvata"], r["naziv_akta"], r["opis"]))
    stambeno = bool(STAMBENO.search(r["namjena"]))
    if not stambeno and INFRASTRUKTURA.search(opis):
        izostavljeno["infrastruktura"] += 1
        return None
    popis = cestice_akta(r["katastarske_cestice"]) + cestice_akta(r["gradjevna_cestica"])
    if len(set(popis)) > NAJVISE_CESTICA and not stambeno:
        izostavljeno["mnogo čestica bez stanovanja"] += 1
        return None
    return ish, zaprimljeno, rijeseno, stambeno, popis


def skupine_akata() -> None:
    """Čestice svakog akta kao jedna građevna čestica, za gradnja-skupine.py (prije karte, iz istog popisa ISPU-a)."""
    izostavljeno = {k: 0 for k in ("istekla ili stara", "odbijena ili obustavljena", "infrastruktura", "mnogo čestica bez stanovanja")}
    skupine = []
    for r in akti_ispu():
        odabran = prihvatljiv(r, izostavljeno)
        # samo nova gradnja određuje novu građevnu česticu; obnova, uporaba i ozakonjenje postojeće ne
        if odabran and odabran[4] and not NIJE_NOVA.search(r["vrsta_zahvata"]):
            skupine.append({"klasa": r["klasa"], "ishod": odabran[0], "stambeno": odabran[3],
                            "cestice": sorted({f"{ko}|{kc}" for ko, kc in odabran[4]})})
    json.dump({"opis": "Čestice akata (dozvole od " + OD_DATUMA + " i zahtjevi u obradi, bez infrastrukture) kao jedna građevna "
               "čestica; čita gradnja-skupine.py. Izvedeno skriptom scripts/gup-grad/gradnja-dozvole.py --skupine.",
               "skupine": skupine}, open(SKUPINE, "w"), ensure_ascii=False, indent=0)
    print(f"skupina akata: {len(skupine)} → {SKUPINE}", file=sys.stderr)


def main() -> None:
    if "--skupine" in sys.argv:
        skupine_akata()
        return
    cestice, sve = zelene_cestice()
    print(f"čestica za gradnju: {len(cestice)}, zeleno {sum(c['zeleno_m2'] for c in cestice) / 1e4:.1f} ha, "
          f"pod planom na snazi {sum(c['plan_m2'] for c in cestice) / 1e4:.1f} ha", file=sys.stderr)
    os.makedirs(CACHE, exist_ok=True)
    json.dump({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"ko": c["ko"], "kc": c["kc"]}, "geometry": mapping(c["wgs"])} for c in cestice]},
        open(MASKA, "w"))
    if "--samo-maska" in sys.argv:
        return
    po_kc = {(c["ko"].upper(), c["kc"]): i for i, c in enumerate(cestice)}
    stablo = STRtree([c["wgs"] for c in cestice])

    izostavljeno = {"istekla ili stara": 0, "odbijena ili obustavljena": 0, "infrastruktura": 0, "mnogo čestica bez stanovanja": 0, "nije na zelenoj čestici": 0}
    akti, skupine = [], []
    for r in akti_ispu():
        odabran = prihvatljiv(r, izostavljeno)
        if not odabran:
            continue
        ish, zaprimljeno, rijeseno, stambeno, popis = odabran
        nase = sorted({po_kc[c] for c in popis if c in po_kc})
        if not popis:
            # bez popisa čestica: čestica na kojoj je točka akta
            lon, lat = float(r["lon"]), float(r["lat"])
            nase = sorted({int(i) for i in stablo.query(Point(lon, lat), predicate="within")})
        if not nase:
            izostavljeno["nije na zelenoj čestici"] += 1
            continue
        poveznica = (r["poveznica"].split("::", 1)[-1] if "http" in r["poveznica"] else "")
        akti.append({
            "klasa": r["klasa"], "postupak": r["postupak"], "ishod": ish,
            "akt": r["naziv_akta"] or ("Zahtjev za građevinsku dozvolu" if r["postupak"] == "građevinska" else "Zahtjev za lokacijsku dozvolu"),
            "zaprimljeno": zaprimljeno, "rijeseno": rijeseno if ish == "izdana" else None,
            "namjena": r["namjena"], "zahvat": r["vrsta_zahvata"], "adresa": r["adresa"],
            "kc": r["katastarske_cestice"], "poveznica": poveznica,
            "cestice": nase,
            # sve čestice akta koje karta zna, i one koje nisu zelene (prilaz, ostatak građevne čestice)
            "skupina": sorted({c for c in popis if c in sve}),
        })
    # čestice akta izvan zelenih: samo oblik, za obris skupine
    ostale: dict[tuple[str, str], int] = {}
    izlaz_cestica = [{"ko": c["ko"], "kc": c["kc"], "zeleno_m2": c["zeleno_m2"], "plan_m2": c["plan_m2"], "akti": [],
                      "oblik": c["wgs"]} for c in cestice]
    for n, a in enumerate(akti):
        for i in a["cestice"]:
            izlaz_cestica[i]["akti"].append(n)
        clanovi = []
        for kljuc in a.pop("skupina"):
            if kljuc in po_kc:
                clanovi.append(po_kc[kljuc])
                continue
            if kljuc not in ostale:
                ostale[kljuc] = len(izlaz_cestica)
                izlaz_cestica.append({"ko": sve[kljuc]["ko"], "kc": sve[kljuc]["kc"], "zeleno_m2": 0, "plan_m2": 0, "akti": [], "oblik": sve[kljuc]["wgs"]})
            clanovi.append(ostale[kljuc])
            izlaz_cestica[ostale[kljuc]]["akti"].append(n)
        a["cestice"] = sorted(set(a["cestice"]) | set(clanovi))
    # samo čestice koje su u nekom aktu idu van (ostale zelene karta već boji)
    zadrzi = [i for i, c in enumerate(izlaz_cestica) if c["akti"]]
    novi = {s: n for n, s in enumerate(zadrzi)}
    for a in akti:
        a["cestice"] = [novi[i] for i in a["cestice"]]

    def zaokruzi(g):
        return json.loads(json.dumps(mapping(g)), parse_float=lambda v: round(float(v), 6))

    izlaz = {
        "opis": "Lokacijske i građevinske dozvole izdane od " + OD_DATUMA + " i zahtjevi u obradi na zelenim česticama karte "
                "/gup/gradnja i slobodnim česticama pod planom na snazi; izvor: geoportal ISPU (registar akata). "
                "Izvedeno skriptom scripts/gup-grad/gradnja-dozvole.py.",
        "izradjeno": dt.date.today().isoformat(),
        "od_datuma": OD_DATUMA,
        "izostavljeno": izostavljeno,
        "akti": akti,
        "cestice": [{**{k: v for k, v in izlaz_cestica[i].items() if k != "oblik"}, "akti": izlaz_cestica[i]["akti"],
                     "oblik": zaokruzi(izlaz_cestica[i]["oblik"]),
                     # točka sigurno unutar čestice: oznaka izdaleka i klik na nju
                     "tocka": [round(v, 6) for v in izlaz_cestica[i]["oblik"].representative_point().coords[0]]} for i in zadrzi],
    }
    json.dump(izlaz, open(IZLAZ, "w"), ensure_ascii=False, separators=(",", ":"))
    po_ishodu = {}
    for a in akti:
        po_ishodu[(a["postupak"], a["ishod"])] = po_ishodu.get((a["postupak"], a["ishod"]), 0) + 1
    print(f"akata: {len(akti)} {po_ishodu}; čestica: {len(zadrzi)}; izostavljeno {izostavljeno} → {IZLAZ}", file=sys.stderr)


if __name__ == "__main__":
    main()
