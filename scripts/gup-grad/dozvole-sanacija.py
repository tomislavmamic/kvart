#!/usr/bin/env python3
"""Zahtjevi za građevinsku i lokacijsku dozvolu po važećem GUP-u na zemljištu
koje prijedlog GUP-a 2025. označava kao urbanu sanaciju, sa svim ishodima:
izdana, odbijena, obustavljena (zahtjev povučen), proslijeđena, u obradi.

Izvor dozvola je državni registar eDozvola (WFS Ministarstva, anonimno):
sloj eDozvola_area_polygon nosi obuhvat zahvata (građevnu česticu) svakog
predmeta, s vrstom, klasom, datumima, statusom i načinom rješavanja. Uzimaju
se predmeti skupina „Akt za građenje” i „Lokacijska dozvola”, s izmjenama,
bez obzira na ishod. Svi se rješavaju po GUP-u na snazi (SGGS 1/06, 3/08,
55/14): registar počinje 2014., a prijedlog 2025. nije donesen.

Urbana sanacija su plohe s lista 4.d prijedloga (zabrana-2025.geojson:
vrsta = sanacija u zonama gradnje, podrucje = sanacija na ulicama, parkovima i
javnim česticama), bez planova na snazi. Akt ulazi ako je barem
NAJMANJI_UDIO njegova obuhvata u sanaciji. Čestice su one iz
zabrana-izgradjenost-2025.geojson (vrsta = sanacija) kojih je barem
NAJMANJI_UDIO_CESTICE površine unutar obuhvata kojeg takvog akta.

Uz obuhvat se iz sloja eDozvola_building_polygon uzima namjena i zahvat
zgrade iz istog akta. Sloj eDozvola stao je u prosincu 2025. (zadnji
zahtjev 24. 12. 2025.), pa se dodaju predmeti s geoportala ISPU (ispu-akti.py,
.cache/gup-grad/ispu-akti.csv; drugi popis istih stupaca može se zadati kao
$ISPU_AKTI): predmet kojeg nema u eDozvoli ulazi s česticom na kojoj je
njegova točka, a predmet koji je u eDozvoli neriješen dobiva ishod s ISPU-a.

Ulazi:
  public/geo/gup-grad/zabrana-2025.geojson               (zabrana.py)
  public/geo/gup-grad/zabrana-izgradjenost-2025.geojson  (zabrana.py)
  .cache/gup-grad/ispu-akti.csv                          (ispu-akti.py)
Izlaz (za /planovi/dozvole; javni podaci registara, s adresama i česticama):
  public/geo/gup-grad/dozvole-sanacija-2025.geojson  predmeti (obuhvati), čestice, plohe sanacije
  public/geo/gup-grad/dozvole-sanacija-2025.csv      popis predmeta

Pokretanje:  python3 scripts/gup-grad/dozvole-sanacija.py [--osvjezi]
  bez --osvjezi koristi spremljene odgovore WFS-a (.cache/gup-grad/edozvola-*.json)
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

from pyproj import Transformer
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform as stransform, unary_union
from shapely.prepared import prep

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WFS = "https://oss.uredjenazemlja.hr/OssWebServices/external/eDozvole"
SLOJEVI = {"obuhvat": "eEditorDozvola_MGIPU_Public:eDozvola_area_polygon",
           "zgrada": "eEditorDozvola_MGIPU_Public:eDozvola_building_polygon"}
CACHE = os.path.join(ROOT, ".cache", "gup-grad")
ZABRANA = os.path.join(ROOT, "public", "geo", "gup-grad", "zabrana-2025.geojson")
CESTICE = os.path.join(ROOT, "public", "geo", "gup-grad", "zabrana-izgradjenost-2025.geojson")
IZLAZ = os.path.join(ROOT, "public", "geo", "gup-grad", "dozvole-sanacija-2025.geojson")
IZLAZ_CSV = os.path.join(ROOT, "public", "geo", "gup-grad", "dozvole-sanacija-2025.csv")
ISPU_AKTI = os.environ.get("ISPU_AKTI") or os.path.join(CACHE, "ispu-akti.csv")

# GUP Splita (Sl. gl. 1/06, 25. 1. 2006.) stupio je na snagu osmi dan od objave;
# stariji predmeti s ISPU-a rješavani su po ranijim planovima
GUP_NA_SNAZI = "2006-02-02"
NAJMANJI_UDIO = 0.5    # dio obuhvata akta u sanaciji
NAJMANJI_UDIO_CESTICE = 0.5  # dio čestice u obuhvatu, ili dio obuhvata na čestici
NAJMANJE_M2 = 20.0
ZALIHA_M = 100.0
POLOVICE = 3  # okvir se dijeli na 3×3 upita, da nijedan ne udari u granicu od 1000

U_WGS = Transformer.from_crs(3765, 4326, always_xy=True).transform
U_HTRS = Transformer.from_crs(4326, 3765, always_xy=True).transform


def skini(sloj: str, okvir: tuple[float, float, float, float]) -> list[dict]:
    x0, y0, x1, y1 = okvir
    dx, dy = (x1 - x0) / POLOVICE, (y1 - y0) / POLOVICE
    po_id: dict[str, dict] = {}
    for i in range(POLOVICE):
        for j in range(POLOVICE):
            b = (x0 + i * dx, y0 + j * dy, x0 + (i + 1) * dx, y0 + (j + 1) * dy)
            q = urllib.parse.urlencode({
                "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": sloj,
                "outputFormat": "application/json", "count": 1000,
                "bbox": ",".join(f"{v:.0f}" for v in b) + ",urn:ogc:def:crs:EPSG::3765",
            })
            with urllib.request.urlopen(f"{WFS}?{q}", timeout=180) as r:
                fc = json.load(r)
            n = len(fc["features"])
            print(f"  {sloj.split(':')[1]} {i},{j}: {n}", file=sys.stderr)
            if n >= 1000:
                sys.exit("upit je udario u granicu od 1000; povećaj POLOVICE")
            for f in fc["features"]:
                po_id[f["id"]] = f
    return list(po_id.values())


def lokacija(p: dict) -> tuple[str, str, str]:
    try:
        l = [x["lokacija"] for x in json.loads(p.get("lokacija") or "[]")]
    except (ValueError, KeyError, TypeError):
        return "", "", ""
    kc = "; ".join(sorted({x.get("lokacija_kat_cestica") or "" for x in l} - {""}))
    ko = "; ".join(sorted({x.get("lokacija_kat_opcina") or "" for x in l} - {""}))
    adr = "; ".join(sorted({x.get("lokacija_ulica_kucni") or "" for x in l} - {""}))
    return kc, ko, adr


POSTUPCI = {"Akt za građenje": "građevinska", "Lokacijska dozvola": "lokacijska"}
ISHODI = ("izdana", "u obradi", "odbijena", "obustavljena", "proslijeđena", "bez zabilježenog ishoda")


def ishod(nacin: str | None, status: str | None) -> str:
    if nacin == "zahtjev usvojen":
        return "izdana"
    if nacin in ("zahtjev odbijen", "zahtjev odbačen"):
        return "odbijena"
    if nacin == "postupak obustavljen":
        return "obustavljena"
    if nacin in ("predmet poslan na nadležno postupanje", "odlukom prenesena nadležnost"):
        return "proslijeđena"
    if nacin is None and status and "obrad" in status.lower():
        return "u obradi"
    return "bez zabilježenog ishoda"


def postupak_po_klasi(klasa: str) -> str | None:
    """UP/I-361-03 je građenje, UP/I-350-05 lokacijska dozvola."""
    k = klasa.replace(" ", "")
    if "361-03" in k:
        return "građevinska"
    if "350-05" in k:
        return "lokacijska"
    return None


def iso(d: str) -> str | None:
    d = (d or "").strip().strip(".")
    if not d:
        return None
    dan, mj, god = d.split(".")
    return f"{god}-{int(mj):02d}-{int(dan):02d}"


def spoji(*vrijednosti) -> str:
    return "; ".join(dict.fromkeys(v.strip() for v in vrijednosti if v and v.strip()))


def main() -> None:
    zab = json.load(open(ZABRANA))
    san = unary_union([shape(f["geometry"]) for f in zab["features"]
                       if "sanacija" in (f["properties"].get("vrsta"), f["properties"].get("podrucje"))])
    san = stransform(U_HTRS, san).buffer(0)
    sanp = prep(san)
    # komadi sanacije po propisanom UPU-u s lista 4.d (0 = izvan ucrtanih obuhvata)
    nazivi_upu = {u["broj"]: u["naziv"] for u in zab["zbroj"]["fokus"].get("po_upu", [])} \
        if "po_upu" in zab["zbroj"].get("fokus", {}) else {u["broj"]: u["naziv"] for u in zab["zbroj"]["po_upu"]}
    komadi_upu = [(stransform(U_HTRS, shape(f["geometry"])).buffer(0), f["properties"].get("upu", 0))
                  for f in zab["features"]
                  if "sanacija" in (f["properties"].get("vrsta"), f["properties"].get("podrucje"))]

    def upu_za(g) -> str:
        po = {}
        for k, u in komadi_upu:
            if k.intersects(g):
                po[u] = po.get(u, 0) + k.intersection(g).area
        u = max(po, key=po.get) if po else 0
        return nazivi_upu.get(u) or "izvan propisanog UPU-a"

    sirovo = {}
    for kljuc, sloj in SLOJEVI.items():
        put = os.path.join(CACHE, f"edozvola-{kljuc}.json")
        if "--osvjezi" in sys.argv or not os.path.exists(put):
            x0, y0, x1, y1 = san.bounds
            os.makedirs(CACHE, exist_ok=True)
            json.dump(skini(sloj, (x0 - ZALIHA_M, y0 - ZALIHA_M, x1 + ZALIHA_M, y1 + ZALIHA_M)),
                      open(put, "w"), ensure_ascii=False)
        sirovo[kljuc] = json.load(open(put))
    print(f"eDozvola u okviru: {len(sirovo['obuhvat'])} obuhvata, {len(sirovo['zgrada'])} zgrada", file=sys.stderr)

    # namjena i zahvat zgrade po klasi
    zgrade: dict[str, dict] = {}
    for f in sirovo["zgrada"]:
        p = f["properties"]
        z = zgrade.setdefault(p.get("predmet_klasa"), {"namjena": "", "zahvat": ""})
        z["namjena"] = spoji(z["namjena"], p.get("gradjevina_namjena"), p.get("gradjevina_namjena_dodatno"))
        z["zahvat"] = spoji(z["zahvat"], p.get("gradjevina_zahvat"), p.get("gradjevina_zahvat_dodatno"))

    # akt može imati više obuhvata (više građevnih čestica): spajaju se po klasi
    po_klasi: dict[str, tuple[list, dict]] = {}
    for f in sirovo["obuhvat"]:
        p = f["properties"]
        postupak = POSTUPCI.get(p.get("predmet_group"))
        if not postupak or not f.get("geometry"):
            continue
        g = shape(f["geometry"]).buffer(0)
        if g.is_empty:
            continue
        k = p.get("predmet_klasa")
        if k not in po_klasi:
            kc, ko, adr = lokacija(p)
            po_klasi[k] = ([], {
                "klasa": k, "postupak": postupak, "vrsta": p.get("predmet_vrsta"), "akt": p.get("zavrsni_akt_naziv"),
                "ishod": ishod(p.get("zavrsni_akt_nacin_rjesavanja"), p.get("predmet_status")),
                "status": p.get("predmet_status"),
                "zaprimljeno": p.get("zahtjev_dat_zaprimanja"),
                "datum": p.get("zavrsni_akt_dat_rjesavanja"), "pravomocno": p.get("zavrsni_akt_dat_pravomocnosti"),
                "kc": kc, "ko": ko, "adresa": adr, "izvor": "eDozvola",
                **zgrade.get(k, {"namjena": "", "zahvat": ""}),
            })
        po_klasi[k][0].append(g)

    odabrani: list[tuple] = []
    for k, (gs, p) in po_klasi.items():
        g = unary_union(gs)
        if not sanp.intersects(g):
            continue
        udio = g.intersection(san).area / g.area
        if udio >= NAJMANJI_UDIO:
            odabrani.append((g, {**p, "udio_u_sanaciji": round(udio, 2), "m2": round(g.area)}))
    print(f"zahtjevi za građevinsku i lokacijsku dozvolu, ≥{NAJMANJI_UDIO:.0%} u sanaciji: {len(odabrani)}",
          file=sys.stderr)

    ces = json.load(open(CESTICE))
    cestice_san = []
    for f in ces["features"]:
        if f["properties"].get("vrsta") != "sanacija":
            continue
        c = stransform(U_HTRS, shape(f["geometry"])).buffer(0)
        if not c.is_empty:
            cestice_san.append((c, f))

    # dopuna s ISPU-a (stanje iz rujna 2026., eDozvola stane u prosincu 2025.):
    # predmeti kojih nema u eDozvoli, s točkom u sanaciji → čestica pod točkom;
    # predmetima koje eDozvola vodi kao neriješene ishod s ISPU-a
    if os.path.exists(ISPU_AKTI):
        ispu: dict[str, dict] = {}
        for r in csv.DictReader(open(ISPU_AKTI)):
            r["_datum"] = iso(r["datum_rjesavanja"])
            if (r["_datum"] or iso(r.get("datum_zaprimanja", "")) or "") < GUP_NA_SNAZI:
                continue
            if r["klasa"] not in ispu or (r["_datum"] or "") > (ispu[r["klasa"]]["_datum"] or ""):
                ispu[r["klasa"]] = r
        poznate = {f["properties"].get("predmet_klasa") for f in sirovo["obuhvat"]}
        dodano = 0
        for k, r in ispu.items():
            postupak = postupak_po_klasi(k) or {"gradjenje": "građevinska", "lokacijska": "lokacijska"}.get(r.get("sloj"))
            if k in poznate or not postupak:
                continue
            t = Point(*U_HTRS(float(r["lon"]), float(r["lat"])))
            if not sanp.contains(t):
                continue
            pod = [c for c, _ in cestice_san if c.contains(t)]
            if not pod:
                continue
            odabrani.append((pod[0], {
                "klasa": k, "postupak": postupak, "vrsta": r["naziv_akta"], "akt": r["naziv_akta"],
                "ishod": ishod(r["nacin_rjesavanja"] or None, r["status_predmeta"]), "status": r["status_predmeta"],
                "zaprimljeno": iso(r.get("datum_zaprimanja", "")), "datum": r["_datum"], "pravomocno": None,
                "kc": r["katastarske_cestice"], "ko": "", "adresa": r["adresa"], "izvor": "ISPU (točka)",
                "namjena": r["namjena"], "zahvat": spoji(r["vrsta_zahvata"], r["opis"]),
                "udio_u_sanaciji": 1.0, "m2": round(pod[0].area),
            }))
            dodano += 1
        osvjezeno = 0
        for _, p in odabrani:
            r = ispu.get(p["klasa"])
            if not r or p["izvor"] != "eDozvola":
                continue
            p["zahvat"] = spoji(p["zahvat"], r["vrsta_zahvata"], r["opis"])
            p["namjena"] = p["namjena"] or r["namjena"]
            novi = ishod(r["nacin_rjesavanja"] or None, r["status_predmeta"])
            if p["ishod"] in ("u obradi", "bez zabilježenog ishoda") and novi != p["ishod"] and r["_datum"]:
                p.update(ishod=novi, datum=r["_datum"], status=r["status_predmeta"], akt=r["naziv_akta"],
                         izvor="eDozvola, ishod s ISPU-a")
                osvjezeno += 1
        print(f"dodano s ISPU-a: {dodano}, ishod s ISPU-a: {osvjezeno}", file=sys.stderr)
    odabrani.sort(key=lambda t: t[1]["datum"] or t[1]["zaprimljeno"] or "")

    def vrsta_zahvata(p: dict) -> str:
        z, n = (p["zahvat"] or "").lower(), (p["namjena"] or "").lower()
        if n.startswith(("infrastruktur", "športsko", "javne i društvene")):
            return "infrastruktura i javno"
        if any(r in z or r in n for r in ("rekonstrukc", "dogradnj", "nadogradnj")):
            return "rekonstrukcija"
        if any(r in z or r in n for r in ("građenje", "katnost", "jedinic", "stan")) \
                or "novoformiran" in (p["kc"] or "").lower():
            return "nova zgrada"
        return "nije navedeno"

    for _, p in odabrani:
        p["izmjena"] = any(r in (p["vrsta"] or "").lower() for r in ("izmjen", "produljenj"))
        p["zahvat_vrsta"] = vrsta_zahvata(p)
    for g, p in odabrani:
        p["upu"] = upu_za(g)

    # čestice u sanaciji pod obuhvatom kojeg od tih predmeta
    cestice = []
    for c, f in cestice_san:
        klase = []
        for g, p in odabrani:
            if not g.intersects(c):
                continue
            presjek = g.intersection(c).area
            if presjek >= NAJMANJE_M2 and (presjek / c.area >= NAJMANJI_UDIO_CESTICE
                                           or presjek / g.area >= NAJMANJI_UDIO_CESTICE):
                klase.append(p["klasa"])
        if klase:
            cestice.append({"type": "Feature", "geometry": f["geometry"], "properties": {
                "sloj": "cestica", "kc": f["properties"]["kc"], "ko": f["properties"]["ko"],
                "izgradjena": f["properties"].get("izgradjena"), "klase": klase,
            }})

    def u_wgs(geom):
        return json.loads(json.dumps(mapping(stransform(U_WGS, geom.simplify(0.3)))),
                          parse_float=lambda s: round(float(s), 6))

    znacajke = [{"type": "Feature", "geometry": u_wgs(g), "properties": {"sloj": "akt", **p}} for g, p in odabrani]
    osnovni = [p for _, p in odabrani if not p["izmjena"]]
    po_ishodu = {pos: {i: sum(1 for p in osnovni if p["postupak"] == pos and p["ishod"] == i) for i in ISHODI}
                 for pos in ("građevinska", "lokacijska")}
    izlaz = {
        "type": "FeatureCollection",
        "opis": "Izvedeno skriptom scripts/gup-grad/dozvole-sanacija.py.",
        "izradjeno": dt.date.today().isoformat(),
        "zbroj": {"predmeti": len(odabrani), "bez_izmjena": len(osnovni), "po_ishodu": po_ishodu,
                  "cestice": len(cestice),
                  "zadnji_u_edozvoli": max((p["zaprimljeno"] or "" for _, p in odabrani if p["izvor"].startswith("eDozvola")),
                                           default=None),
                  "po_upu": {u: sum(1 for p in osnovni if p["upu"] == u)
                             for u in sorted({p["upu"] for p in osnovni})}},
        "sanacija": u_wgs(san),
        "features": znacajke + cestice,
    }
    json.dump(izlaz, open(IZLAZ, "w"), ensure_ascii=False, separators=(",", ":"))

    polja = ("klasa", "postupak", "vrsta", "ishod", "status", "zaprimljeno", "datum", "pravomocno", "kc", "ko", "adresa", "namjena", "zahvat", "zahvat_vrsta",
             "udio_u_sanaciji", "m2", "upu", "izvor")
    with open(IZLAZ_CSV, "w", newline="") as fo:
        w = csv.writer(fo)
        w.writerow(polja)
        for _, p in odabrani:
            w.writerow([p[k] for k in polja])
    print(f"čestica u sanaciji pod tim predmetima: {len(cestice)}", file=sys.stderr)
    print(json.dumps(izlaz["zbroj"], ensure_ascii=False))


if __name__ == "__main__":
    main()
