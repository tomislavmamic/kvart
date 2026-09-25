#!/usr/bin/env python3
"""Obuhvati planova užeg područja iz prijedloga GUP-a 2025. (list 4.d), s imenima.

Prijedlog izmjena GUP-a (travanj 2025.) na listu 4.d „Područja i dijelovi
primjene planskih mjera zaštite” debelom crtom omeđuje dvije vrste planova
užeg područja i u legendi ih nabraja po broju:

  crveno  46 planova na snazi (DPU, UPU, stari PUP; „Popis važećih prostornih
          planova užeg područja”) — unutar njih se gradi samo po tom planu
          (čl. 103. st. 5)
  plavo   34 plana „za koje je propisana obveza izrade” — unutar obuhvata
          ispuna kaže gdje nova gradnja stoji do plana (urbana sanacija,
          preobrazba, neuređeni dio; čl. 103. st. 1), a drugdje se gradi po
          GUP-u (st. 3)

Što to znači za pojedinu česticu na kartu /gup nosi planski režim čestice
(rezim.ts); ova skripta crta sam obuhvat svakog plana, s imenom iz legende,
kako ga je planer nacrtao.

Kako (za svaku boju posebno):
  1. Debele crte su na listu ispunjene vrpce (plohe), a šrafura ili rešetka
     unutar obuhvata su tanke crte. Vrpce su zidovi.
  2. Šrafura (bit VAZECI ili OBVEZA u pr-gup-2025.npy, planski-rezim.py) bez
     zidova raspada se na plohe; svaka dobiva broj plana iz broja iste boje
     otisnutog u njoj, a plohe bez broja (dio obuhvata koji je presjekla
     cesta) najbliži broj.
  3. Zidovi se dijele između susjednih plana, pa se plohe istog broja spoje,
     izglade za koji metar i pojednostave.

Izlaz: public/geo/gup-grad/planski-rezim-2025.geojson (EPSG:4326), svojstva
  vrsta          "vazeci" (crveno na listu) ili "propisan" (plavo)
  broj, naziv    iz legende lista (broj je redni broj u popisu svoje vrste)
  glasnik        važeći: brojevi Službenog glasnika Grada Splita iz legende
  tocka          [lng, lat] za natpis, unutar obuhvata
  ha             površina obuhvata
  sanacija_ha, preobrazba_ha, neuredeno_ha
                 propisani: koliko obuhvata je u području u kojem nova
                 gradnja čeka plan

Pokretanje:  python scripts/gup-grad/planski-obrisi.py   (poslije planski-rezim.py)
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys

import numpy as np
import pymupdf
import shapely
import shapely.ops
from affine import Affine
from pyproj import Transformer
from rasterio import features
from scipy import ndimage
from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

_spec = importlib.util.spec_from_file_location("planski_rezim", os.path.join(os.path.dirname(__file__), "planski-rezim.py"))
PR = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(PR)  # type: ignore[union-attr]

IZLAZ = os.path.join(R.ROOT, "public", "geo", "gup-grad", "planski-rezim-2025.geojson")
NAJMANJE_HA = 0.2          # mrvice uz rub zida nisu dio obuhvata
IZGLADI_M = 4.0            # zatvaranje pa otvaranje ruba, u metrima
POJEDNOSTAVI_M = 2.5
MALI_HA = 1.5              # zatvoreni prsten zida do te površine je obuhvat i bez šrafure
# legenda: desni stupac lista (pt, nezakrenuto; list 2025. nema zakreta); desno od
# LEGENDA_X[1] je zaglavlje lista, pa se riječi odande ne uzimaju
LEGENDA_X = (3830, 4270)
KARTA_DO_X = LEGENDA_X[0] - 40

# Dvije vrste obuhvata na listu: boja, bit šrafure, popis u legendi (y od–do),
# veličina brojeva na karti (pt).
VRSTE = [
    {"vrsta": "vazeci", "boja": PR.CRVENA, "bit": PR.VAZECI, "popis_y": (80, 735), "velicina": (19.0, 30.0)},
    {"vrsta": "propisan", "boja": PR.PLAVA, "bit": PR.OBVEZA, "popis_y": (780, 1210), "velicina": (16.0, 21.0)},
]
# „(3/96, 2/98)”, „(2-98, 1-07)”; zagrada se u legendi zna ne zatvoriti
GLASNIK = re.compile(r"\s*\(([^()]*\d+[/-]\d+[^()]*)\)?\s*$")


def popis(p: pymupdf.Page, od_y: float, do_y: float) -> dict[int, str]:
    """Broj → naziv iz popisa u legendi; stavka u dva retka se spaja."""
    redovi: dict[int, list] = {}
    for w in p.get_text("words"):
        if LEGENDA_X[0] < w[0] < LEGENDA_X[1] and od_y < w[1] < do_y:
            redovi.setdefault(round(w[1] / 3), []).append(w)
    out: dict[int, str] = {}
    zadnji = None
    for _, ws in sorted(redovi.items()):
        t = " ".join(x[4] for x in sorted(ws, key=lambda x: x[0]))
        m = re.match(r"^(\d+)\.\s*((?:UPU|DPU|PUP).*)$", t)
        if m:
            zadnji = int(m.group(1))
            out[zadnji] = m.group(2).strip()
        elif zadnji is not None:
            out[zadnji] += " " + t.strip()
    return out


def naziv_i_glasnik(t: str) -> tuple[str, str | None]:
    """„DPU dijela područja Dračevac (23/04)” → ("DPU dijela područja Dračevac", "23/04")."""
    m = GLASNIK.search(t)
    if not m:
        return t, None
    return t[:m.start()].strip(), m.group(1).strip()


def brojevi_na_karti(p: pymupdf.Page, boja: str, velicina: tuple[float, float]) -> list[tuple[int, float, float]]:
    """Brojevi planova jedne boje na karti: (broj, x, y) u pt lista."""
    out = []
    for b in p.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for s in ln["spans"]:
                t = s["text"].strip()
                x0, y0, x1, y1 = s["bbox"]
                if (t.isdigit() and "%06x" % s["color"] == boja[1:] and velicina[0] <= s["size"] <= velicina[1]
                        and x0 < KARTA_DO_X):
                    out.append((int(t), (x0 + x1) / 2, (y0 + y1) / 2))
    return out


def obuhvati(v: dict, p: pymupdf.Page, put: str, plan: dict, dpi: float, vis: float,
             g: np.ndarray, u_gupu: np.ndarray) -> list[dict]:
    nazivi = popis(p, *v["popis_y"])
    print(f"{v['vrsta']}: planova u legendi {len(nazivi)}")

    # 1. zidovi: debele vrpce (plohe), na rešetku
    vrpce = PR.crtez(put, dpi, v["boja"], "ispuna")
    zid = R.na_rescetku(vrpce.astype(np.uint8), plan, dpi, vis) > 0
    zid = ndimage.binary_dilation(zid, iterations=1) & u_gupu

    # 2. plohe obuhvata i njihovi brojevi
    obuhvat = (((g & v["bit"]) > 0) | zid) & u_gupu
    # obuhvat uži od šrafure (planski-rezim.py je uklanja kao crtu) ostaje samo
    # zid; unutrašnjost malog zatvorenog prstena vraća se
    rupe, nr = ndimage.label(ndimage.binary_fill_holes(zid) & ~obuhvat)
    if nr:
        vel = ndimage.sum(np.ones_like(rupe), rupe, index=np.arange(1, nr + 1)) * R.KORAK ** 2 / 1e4
        obuhvat |= np.isin(rupe, 1 + np.flatnonzero(vel <= MALI_HA)) & u_gupu
    oz, n = ndimage.label(obuhvat & ~zid)
    sc, ox, oy = plan["afin"]
    kljuc = np.zeros(n + 1, np.int32)

    def ploha(r: int, c: int, rad: int, slobodne: bool) -> int:
        okolina = oz[max(0, r - rad):r + rad + 1, max(0, c - rad):c + rad + 1]
        ids, cnt = np.unique(okolina[okolina > 0], return_counts=True)
        if slobodne:
            ids, cnt = ids[kljuc[ids] == 0], cnt[kljuc[ids] == 0]
        return int(ids[np.argmax(cnt)]) if len(ids) else 0

    brojevi = []
    for broj, x, y in brojevi_na_karti(p, v["boja"], v["velicina"]):
        E, N = ox + x * sc, oy + (vis - y) * sc
        c = int((E - R.MREZA_BBOX[0]) / R.KORAK)
        r = int((R.MREZA_BBOX[3] - N) / R.KORAK)
        if 0 <= r < oz.shape[0] and 0 <= c < oz.shape[1]:
            brojevi.append((broj, r, c))
    izvan = []
    for broj, r, c in brojevi:
        # broj stoji u obuhvatu; ploha je ona s najviše piksela u okolini od ~20 m
        if i := ploha(r, c, 10, False):
            kljuc[i] = broj
        else:
            izvan.append((broj, r, c))
    for broj, r, c in izvan:
        # malom planu broj stoji pokraj: najbliža ploha bez broja u ~80 m
        if i := ploha(r, c, 40, True):
            kljuc[i] = broj
    oznaceno = kljuc[oz]
    # plohe bez broja i zidovi: broj najbliže označene plohe
    if (oznaceno > 0).any():
        _, (ri, ci) = ndimage.distance_transform_edt(oznaceno == 0, return_indices=True)
        oznaceno = np.where(obuhvat, oznaceno[ri, ci], 0)

    # 3. poligoni po planu
    transform = Affine(R.KORAK, 0, R.MREZA_BBOX[0], 0, -R.KORAK, R.MREZA_BBOX[3])
    u4326 = Transformer.from_crs(3765, 4326, always_xy=True)
    px_ha = R.KORAK ** 2 / 1e4
    feats = []
    for broj in sorted(set(np.unique(oznaceno)) - {0}):
        m = oznaceno == broj
        polig = [shape(geom) for geom, val in features.shapes(m.astype(np.uint8), mask=m, transform=transform) if val == 1]
        geom = shapely.union_all(polig)
        geom = geom.buffer(IZGLADI_M).buffer(-2 * IZGLADI_M).buffer(IZGLADI_M)
        dijelovi = [x for x in getattr(geom, "geoms", [geom]) if x.area / 1e4 >= NAJMANJE_HA]
        if not dijelovi:
            continue
        geom = shapely.union_all(dijelovi).simplify(POJEDNOSTAVI_M, preserve_topology=True)
        ha = geom.area / 1e4
        # točka za natpis: unutar najvećeg dijela, što dalje od ruba
        najveci = max(getattr(geom, "geoms", [geom]), key=lambda x: x.area)
        t = shapely.ops.polylabel(najveci, tolerance=2.0)
        tocka = [round(val, 6) for val in u4326.transform(t.x, t.y)]
        geom = shapely.transform(geom, lambda xy: np.column_stack(u4326.transform(xy[:, 0], xy[:, 1])))
        geom = shapely.set_precision(geom, 1e-6)
        naziv, glasnik = naziv_i_glasnik(nazivi.get(int(broj), f"plan br. {broj}"))
        svojstva = {"vrsta": v["vrsta"], "broj": int(broj), "naziv": naziv, "ha": round(ha, 1), "tocka": tocka}
        if glasnik:
            svojstva["glasnik"] = glasnik
        if v["vrsta"] == "propisan":
            svojstva.update({f"{ime}_ha": round(float(((g & bit) > 0)[m].sum()) * px_ha, 1)
                             for ime, bit in (("sanacija", PR.SANACIJA), ("preobrazba", PR.PREOBRAZBA),
                                              ("neuredeno", PR.NEUREDENO))})
        feats.append({"type": "Feature", "geometry": json.loads(shapely.to_geojson(geom)), "properties": svojstva})
    nedostaje = sorted(set(nazivi) - {f["properties"]["broj"] for f in feats})
    print(f"  obuhvata: {len(feats)}, nedostaje: {nedostaje}")
    for f in feats:
        s = f["properties"]
        dodatak = (f"  san {s['sanacija_ha']:>5} pre {s['preobrazba_ha']:>5} neu {s['neuredeno_ha']:>5}"
                   if "sanacija_ha" in s else f"  ({s.get('glasnik', '')})")
        print(f"  {s['broj']:>2} {s['naziv'][:60]:60} {s['ha']:>6} ha{dodatak}")
    return feats


def main() -> None:
    lst = next(x for x in PR.LISTOVI if x["id"] == "pr-2025")
    plan = dict(next(p for p in R.PLANOVI if p["id"] == lst["plan"]))
    plan["pdf"], plan["url"] = lst["pdf"], lst["url"]
    put = R.preuzmi(plan)
    dpi = 72.0 * plan["afin"][0] / R.KORAK
    d = pymupdf.open(put)
    p = d[0]
    vis = p.mediabox.width if p.rotation in (90, 270) else p.mediabox.height

    g = np.load(os.path.join(R.OUT, "pr-gup-2025.npy"))
    # samo unutar obuhvata GUP-a: izvan njega su legenda i okvir lista
    u_gupu = np.load(os.path.join(R.OUT, "klase-gup-2025.npy")) > 0
    u_gupu = ndimage.binary_dilation(u_gupu, iterations=4)  # zid na rubu obuhvata ostaje

    feats = [f for v in VRSTE for f in obuhvati(v, p, put, plan, dpi, vis, g, u_gupu)]
    with open(IZLAZ, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "opis": "Izvedeno skriptom scripts/gup-grad/planski-obrisi.py iz lista 4.d prijedloga GUP-a (travanj 2025.).",
            "features": feats,
        }, f, ensure_ascii=False, separators=(",", ":"))
    print("zapisano", IZLAZ, round(os.path.getsize(IZLAZ) / 1e3), "kB")


if __name__ == "__main__":
    main()
