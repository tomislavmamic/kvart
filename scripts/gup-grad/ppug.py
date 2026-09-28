#!/usr/bin/env python3
"""Listovi 4. „Građevinska područja” prijedloga izmjena PPUG-a Splita (2025.).

Obrazloženje prijedloga izmjena GUP-a (§ 2.1.1.3) kaže da je neuređeni dio
građevinskog područja „određen PPUG-om, na kartografskom prikazu
građevinskih područja”; list 4.d GUP-a ga samo prenosi. PPUG ga crta u
mjerilu 1:5000 na katastarskoj podlozi: izgrađeno žuto, neizgrađeno
svijetložuto, neuređeno šrafirano. Ovdje se ti listovi (4.2 Split zapad, 4.3
Split središnji dio, 4.4 Split istok – Kamen – Stobreč) čitaju kao vektor:

  Uklapanje. Na listu su ispisani brojevi katastarskih čestica. Svaki broj
  koji postoji među česticama u obuhvatu GUP-a (pločice iz cestice.py) je
  kandidat; RANSAC nad parovima jednoznačnih brojeva nađe sličnost (mjerilo
  ~1,764 m/pt), a zatim se afina dotjera najmanjim kvadratima na svim
  oznakama koje padnu u česticu svog broja. Na listovima 4.2–4.4 to je
  8 000–22 000 parova, s medijanom odstupanja 1–1,5 m.

  Razredi. Plohe izgrađenog (#ffff00) i neizgrađenog (#ffffb0) dijela su
  ispunjeni putovi u PDF-u; neuređeni dio je šrafura, crte debljine 0,84 pt
  pod 45°, koje se spoje u plohu.

Izlaz:
  data/gup-grad/ppug-2025.json   uklapanje svakog lista (za dokument.py i
      navode na /gup/dokument) i razred po čestici u obuhvatu GUP-a:
      {"cestice": {"<ko>|<kc>": "U" | "I" | "N"}} (neuređeno, izgrađeno,
      neizgrađeno uređeno; I i N samo ako je šrafirano manje od petine čestice,
      a čestica bez pretežitog razreda se ne upisuje)

Pokretanje:  python3 scripts/gup-grad/ppug.py
Traži:       PyMuPDF, shapely, numpy; PDF-ove preuzima sam (dokument.py, preuzmi)
"""
from __future__ import annotations

import glob
import json
import os
import random
import re
import sys

import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform as stransform, unary_union

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dokument as D  # noqa: E402
import zabrana as Z  # noqa: E402

ROOT = D.ROOT
IZLAZ = os.path.join(ROOT, "data", "gup-grad", "ppug-2025.json")

# id lista u dokument.py (LISTOVI) → list PPUG-a
LISTOVI = ["ppug-podrucja-zapad-2025", "ppug-podrucja-sredisnji-2025", "ppug-podrucja-istok-2025"]
BOJE = {(1.0, 1.0, 0.0): "I", (1.0, 1.0, 0.69): "N"}
# legenda, pečat i sadržaj su u desnoj šestini lista
KARTA_DO = 0.83
KC = re.compile(r"^\d{1,5}(/\d{1,3})?$")
PRETEZITO = 0.5
# izgrađena ili uređena je čestica samo ako šrafure na njoj gotovo nema: uz rub
# neuređenog dijela prijenos lista griješi za metar-dva
JEDVA = 0.2


def slicnost(A, B):
    A, B = np.asarray(A, float), np.asarray(B, float)
    ma, mb = A.mean(0), B.mean(0)
    U, S, Vt = np.linalg.svd((A - ma).T @ (B - mb))
    R = (U @ Vt).T
    s = S.sum() / ((A - ma) ** 2).sum()
    return s, R, mb - s * R @ ma


def uklopi(p, cestice: dict) -> tuple[np.ndarray, int, float]:
    """Afina (x, -y lista u pt) → HTRS96 iz brojeva čestica ispisanih na listu."""
    W = p.rect.width
    oznake = [((w[0] + w[2]) / 2, -(w[1] + w[3]) / 2, w[4]) for w in p.get_text("words")
              if KC.match(w[4]) and (w[3] - w[1]) < 6 and (w[0] + w[2]) / 2 < W * KARTA_DO]
    parovi = [(x, y, cestice[t]) for x, y, t in oznake if t in cestice]
    jed = [q for q in parovi if len(q[2]) == 1]
    rng = random.Random(1)
    naj = None
    for _ in range(4000):
        a, b = rng.sample(jed, 2)
        s, R, t = slicnost([a[:2], b[:2]], [(a[2][0][1].x, a[2][0][1].y), (b[2][0][1].x, b[2][0][1].y)])
        if not 1.6 < s < 1.95:
            continue
        n = sum(c[0][0].distance(Point(s * R @ np.array([x, y]) + t)) < 3 for x, y, c in rng.sample(jed, min(300, len(jed))))
        if naj is None or n > naj[0]:
            naj = (n, s, R, t)
    _, s, R, t = naj
    M = np.c_[s * R, t]
    for prag in (3.0, 1.5, 1.5):
        A, B = [], []
        for x, y, c in parovi:
            q = Point(M @ np.array([x, y, 1]))
            for g, rp in c:
                if g.distance(q) < prag:
                    A.append((x, y, 1))
                    B.append((rp.x, rp.y))
                    break
        A, B = np.array(A), np.array(B)
        M = np.linalg.lstsq(A, B, rcond=None)[0].T
    odst = float(np.median(np.hypot(*(A @ M.T - B).T)))
    return M, len(A), odst


def udio_lista(M, sirina_pt: float, visina_pt: float) -> list[float]:
    """HTRS96 (E, N) → udio lista (x, y), kao uklapanje u listovi.json: x = a·E + b·N + c, y = d·E + e·N + f."""
    Ai = np.linalg.inv(M[:, :2])
    c = -Ai @ M[:, 2]
    # (x, -y) = Ai·(E, N) + c; y lista ide od vrha stranice
    return [round(float(v), 12) for v in (Ai[0, 0] / sirina_pt, Ai[0, 1] / sirina_pt, c[0] / sirina_pt,
                                           -Ai[1, 0] / visina_pt, -Ai[1, 1] / visina_pt, -c[1] / visina_pt)]


def razredi(p, M) -> dict[str, object]:
    """Plohe izgrađenog, neizgrađenog i neuređenog dijela u HTRS96."""
    W = p.rect.width
    polja = {"I": [], "N": []}
    srafura = []
    for x in p.get_drawings():
        fill = tuple(round(v, 2) for v in (x.get("fill") or ()))
        if x["type"] in ("f", "fs") and fill in BOJE:
            tocke = []
            for it in x["items"]:
                if it[0] == "l":
                    tocke += [(it[1].x, -it[1].y), (it[2].x, -it[2].y)]
                elif it[0] == "re":
                    r = it[1]
                    tocke += [(r.x0, -r.y0), (r.x1, -r.y0), (r.x1, -r.y1), (r.x0, -r.y1)]
                elif it[0] == "qu":
                    q = it[1]
                    tocke += [(q.ul.x, -q.ul.y), (q.ur.x, -q.ur.y), (q.lr.x, -q.lr.y), (q.ll.x, -q.ll.y)]
                elif it[0] == "c":
                    tocke += [(it[1].x, -it[1].y), (it[4].x, -it[4].y)]
            if len(tocke) >= 3:
                g = Polygon(tocke).buffer(0)
                if not g.is_empty and g.bounds[0] < W * KARTA_DO:
                    polja[BOJE[fill]].append(g)
        elif x["type"] == "s" and tuple(round(v, 2) for v in (x.get("color") or ())) == (0.0, 0.0, 0.0) \
                and round(x.get("width") or 0, 2) == 0.84:
            for it in x["items"]:
                if it[0] != "l":
                    continue
                a, b = it[1], it[2]
                if abs(np.degrees(np.arctan2(b.y - a.y, b.x - a.x)) % 180 - 45) < 3 and a.x < W * KARTA_DO:
                    srafura.append(LineString([(a.x, -a.y), (b.x, -b.y)]))
    tr = [M[0, 0], M[0, 1], M[1, 0], M[1, 1], M[0, 2], M[1, 2]]
    out = {k: affinity.affine_transform(unary_union(v), tr) for k, v in polja.items()}
    # crte šrafure (razmak ~5 pt ≈ 9 m) spojene u plohu
    sr = affinity.affine_transform(unary_union([l.buffer(2.6, cap_style="flat") for l in srafura]), tr)
    out["U"] = sr.buffer(3.0).buffer(-3.0)
    out["okvir"] = affinity.affine_transform(box(0, -p.rect.height, W * KARTA_DO, 0), tr)
    return out


def main() -> None:
    cestice_po_broju: dict[str, list] = {}
    sve = []
    for put in sorted(glob.glob(os.path.join(Z.PLOCICE, "*.json"))):
        for f in json.load(open(put))["features"]:
            g = stransform(Z.U_HTRS, shape(f["geometry"]))
            pr = f["properties"]
            cestice_po_broju.setdefault(pr["kc"], []).append((g, shapely.point_on_surface(g)))
            sve.append((f"{pr['ko']}|{pr['kc']}", g))
    listovi = {c["id"]: c for c in D.LISTOVI}
    uklapanje, plohe = {}, {"I": [], "N": [], "U": []}
    for lid in LISTOVI:
        cfg = listovi[lid]
        p = pymupdf.open(D.preuzmi(cfg["pdf"], cfg["url"]))[0]
        M, n, odst = uklopi(p, cestice_po_broju)
        print(f"{lid}: parova {n}, medijan odstupanja {odst:.1f} m, mjerilo {np.hypot(M[0, 0], M[1, 0]):.4f} m/pt")
        uklapanje[lid] = {"afina": [[round(v, 6) for v in r] for r in M.tolist()], "udio": udio_lista(M, p.rect.width, p.rect.height),
                          "sirina_pt": p.rect.width, "visina_pt": p.rect.height, "parova": n, "odstupanje_m": round(odst, 1)}
        r = razredi(p, M)
        for k in plohe:
            plohe[k].append(r[k])
    plohe = {k: unary_union(v) for k, v in plohe.items()}
    print("ha:", {k: round(v.area / 1e4, 1) for k, v in plohe.items()})
    stablo = {k: shapely.STRtree(list(getattr(v, "geoms", [v]))) for k, v in plohe.items()}
    dijelovi = {k: list(getattr(v, "geoms", [v])) for k, v in plohe.items()}
    razred = {}
    for kljuc, g in sve:
        if g.area <= 0:
            continue
        udio = {}
        for k in ("U", "I", "N"):
            udio[k] = sum(dijelovi[k][i].intersection(g).area for i in stablo[k].query(g)) / g.area
        if udio["U"] >= PRETEZITO:
            razred[kljuc] = "U"
        elif udio["U"] < JEDVA and udio["I"] >= PRETEZITO:
            razred[kljuc] = "I"
        elif udio["U"] < JEDVA and udio["N"] >= PRETEZITO:
            razred[kljuc] = "N"
    print("čestica po razredu:", {k: sum(v == k for v in razred.values()) for k in "UIN"})
    with open(IZLAZ, "w") as f:
        json.dump({"opis": "Izvedeno skriptom scripts/gup-grad/ppug.py iz listova 4.2–4.4 „Građevinska područja” prijedloga "
                           "izmjena PPUG-a Splita za ponovnu javnu raspravu (travanj 2025.): uklapanje listova i razred čestice "
                           "(U neuređeno, I izgrađeno, N neizgrađeno uređeno).",
                   "uklapanje": uklapanje, "cestice": dict(sorted(razred.items()))}, f, ensure_ascii=False, separators=(",", ":"))
    print("→", os.path.relpath(IZLAZ, ROOT), round(os.path.getsize(IZLAZ) / 1e3), "kB")


if __name__ == "__main__":
    main()
