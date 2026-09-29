#!/usr/bin/env python3
"""Planski režim GUP-a na rešetku: gdje vrijedi plan užeg područja, a gdje se čeka.

Namjena s lista „Korištenje i namjena” ne kaže sve. Gdje je na snazi UPU,
DPU ili stari PUP, gradi se po njemu; gdje GUP propisuje obvezu izrade plana
užeg područja, a plana nema, nova gradnja u nisko konsolidiranim područjima
čeka taj plan (GUP 55/14, čl. 104–105; prijedlog 2025., čl. 103). Ova skripta
crta te obuhvate na istu rešetku od 2 m kao rasteriziraj.py; što koji znači
za gradnju odlučuje src/lib/gup-grad/pravila.ts.

Listovi (isti CAD predložak kao list namjene iste godine, pa isto uklapanje):
  2006.  4.c Obuhvat detaljnijih planova (izmjene 2008., EntryId 3179)
         4.d Važeći planovi (izmjene 2008., EntryId 3180)
  2015.  4.c kao 2006. — pročišćeni prikaz 4.c nije objavljen, a izmjene 2014.
         mijenjaju ga samo za Trsteničku uvalu (EntryId 6322)
         4.d Važeći planovi, stanje 28. 11. 2014. (EntryId 3198)
  2025.  4.d Područja i dijelovi primjene planskih mjera zaštite (prijedlog za
         ponovnu javnu raspravu): važeći planovi, obuhvati propisanih planova
         i ispune urbane sanacije, urbane preobrazbe i neuređenog dijela
         neizgrađenog građevinskog područja

Obuhvat plana na listu je šrafura (crvena, plava rešetka, ljubičasta) omeđena
debljom crtom iste boje. Ploha se uzima kao dio lista omeđen tim crtama u
kojem ima šrafure te boje; puna ispuna (2025.: sanacija, preobrazba,
neuređeno) uzima se kakva jest.

Izlaz (.cache/gup-grad/): pr-<id>.npy (uint8, bitovi REZIM), pregled-pr-<id>.png

Ispuna se uzima samo gdje se na listu i vidi. List prekriva dijelove ispune
bijelim plohama nacrtanim preko nje (npr. shematski obuhvat DPU-a dijela
područja Dračevac: bijela ploha s crvenom šrafurom preko sanacije), pa bi
ispuna po boji crteža ondje bila i ono čega na listu nema. Ploha uža od
~8 m (bijele crte ulica, podloga brojeva, crte šrafure) ne skida ispunu.

Pokretanje:  python scripts/gup-grad/planski-rezim.py [--cestice]
  --cestice uz to prepravi bitove sanacije, preobrazbe i neuređenog za 2025.
  u već izvezenim česticama (data/gup-grad/cestice.json i pločice), samo
  gdje ih je promijenio novi list, bez ponovnog pokretanja cijelog cestice.py
"""
from __future__ import annotations

import json
import os
import sys

import glob

import numpy as np
from PIL import Image
from rasterio import features
from rasterio.transform import Affine
from scipy import ndimage
from shapely.geometry import shape
from shapely.ops import transform as stransform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore

DL = "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId={id}&Command=Core_Download"
PONOVNA = ("https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti"
           "%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/")

# Bitovi režima; isti su u src/lib/gup-grad/model.ts (REZIM).
VAZECI = 1        # na snazi je plan užeg područja (UPU, DPU, PUP)
OBVEZA = 2        # GUP propisuje izradu plana užeg područja
SANACIJA = 4      # 2025.: područje urbane sanacije (čl. 103. st. 1. t. 3)
PREOBRAZBA = 8    # 2025.: područje urbane preobrazbe (t. 2)
NEUREDENO = 16    # 2025.: neuređeni dio neizgrađenog građevinskog područja (t. 1)
MARJAN = 32       # 2006./2015.: obveza prostornog plana područja posebnih obilježja Marjan

PLAVA, CRVENA, LJUBICASTA, ZELENA = "#003fff", "#ff0000", "#ff00ff", "#00ff00"

# Svaki list: plan čije se uklapanje koristi, i što koja boja znači.
LISTOVI = [
    {"id": "obveza-2008", "pdf": "3179.pdf", "url": DL.format(id=3179), "plan": "gup-2006",
     "naziv": "4.c Obuhvat detaljnijih planova (izmjene GUP-a 2008.)",
     "srafure": {PLAVA: OBVEZA, CRVENA: OBVEZA}, "ispune": {ZELENA: MARJAN}},
    {"id": "vazeci-2008", "pdf": "3180.pdf", "url": DL.format(id=3180), "plan": "gup-2006",
     "naziv": "4.d Važeći planovi (izmjene GUP-a 2008.)",
     "srafure": {PLAVA: VAZECI, CRVENA: VAZECI}, "ispune": {}},
    {"id": "vazeci-2014", "pdf": "3198.pdf", "url": DL.format(id=3198), "plan": "gup-2015",
     "naziv": "4.d Važeći planovi, stanje 28. 11. 2014. (neslužbeni pročišćeni prikaz)",
     "srafure": {PLAVA: VAZECI, CRVENA: VAZECI, LJUBICASTA: VAZECI}, "ispune": {}},
    {"id": "pr-2025", "pdf": "pr-2025.pdf", "url": PONOVNA + "4_d%20Podrucja%20i%20dijelovi%20primjene%20planskih%20mjera%20zastite.pdf",
     "plan": "gup-2025",
     "naziv": "4.d Područja i dijelovi primjene planskih mjera zaštite (prijedlog, travanj 2025.)",
     "srafure": {PLAVA: OBVEZA, CRVENA: VAZECI},
     "ispune": {"#9fff7f": SANACIJA, "#ffbf00": PREOBRAZBA, "#ffffaf": NEUREDENO}},
]

GODINE = {
    "gup-2006": ["obveza-2008", "vazeci-2008"],
    "gup-2015": ["obveza-2008", "vazeci-2014"],
    "gup-2025": ["pr-2025"],
}

TOLERANCIJA = 6
ZATVARANJE_PX = 5   # spaja šrafuru razmaka do ~10 px (rešetka lista, 2 m/px na tlu)
OTVARANJE_PX = 7    # uklanja crte uže od ~14 px: obrise, crtkane granice, natpise


def hexb(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(v * 255)) for v in rgb[:3])


def odhex(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.int16)


_CRTEZI: dict[str, list] = {}


def crtezi(put: str) -> list:
    """Crteži lista samo boja iz LISTOVI (bez sive podloge), čitani jednom."""
    if put not in _CRTEZI:
        # CAD boje su točne, pa je dovoljna usporedba nizova; numpy po
        # crtežu je na listu od 2,5 milijuna crteža presporo.
        boje = {b for lst in LISTOVI for b in (*lst["srafure"], *lst["ispune"])}
        izbor = []
        for x in pymupdf.open(put)[0].get_drawings():
            f, c = x.get("fill"), x.get("color")
            if (f is not None and hexb(f) in boje) or (c is not None and hexb(c) in boje):
                izbor.append(x)
        _CRTEZI[put] = izbor
        print(f"    {os.path.basename(put)}: {len(izbor)} crteža u bojama režima")
    return _CRTEZI[put]


def crtez(put: str, dpi: float, boja: str, sto: str) -> np.ndarray:
    """Maska lista jedne boje: `sto="ispuna"` (pune plohe), `"srafura"` ili `"crta"` (deblje crte).

    Šrafura je na listovima nacrtana kao ispunjene plohe tanke kao dlaka
    (dvije duži po crtežu); bez zaglađivanja ne pokriju nijedan piksel, pa
    se crtaju kao crte od 1 pt.

    Renderira se bez zaglađivanja, na istim pikselima kao
    rasteriziraj.renderiraj(), pa se preslikava istim uklapanjem.
    """
    src = pymupdf.open(put)
    p = src[0]
    p.set_cropbox(p.mediabox)
    novi = pymupdf.open()
    q = novi.new_page(width=p.mediabox.width, height=p.mediabox.height)
    sh = q.new_shape()
    n = 0
    for x in crtezi(put):
        c = x.get("fill") if sto in ("ispuna", "srafura") else x.get("color")
        if c is None:
            continue
        if sto == "crta" and (x.get("width") or 0) < 0.5:
            continue
        if hexb(c) != boja:
            continue
        for it in x["items"]:
            if it[0] == "l":
                sh.draw_line(it[1], it[2])
            elif it[0] == "re":
                sh.draw_rect(it[1])
            elif it[0] == "qu":
                sh.draw_quad(it[1])
            elif it[0] == "c":
                sh.draw_bezier(it[1], it[2], it[3], it[4])
        if sto == "ispuna":
            sh.finish(fill=(0, 0, 0), color=None, even_odd=x.get("even_odd", False), closePath=True)
        elif sto == "srafura":
            sh.finish(color=(0, 0, 0), width=1.0, closePath=False)
        else:
            sh.finish(color=(0, 0, 0), width=max(x.get("width") or 0.72, 0.72), closePath=False)
        n += 1
    sh.commit()
    q.set_rotation(p.rotation)
    pymupdf.TOOLS.set_aa_level(0)
    try:
        pix = q.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0), alpha=False, colorspace=pymupdf.csGRAY)
    finally:
        pymupdf.TOOLS.set_aa_level(8)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    print(f"    {boja} {sto}: {n} crteža")
    return a < 128


def krug(r: int) -> np.ndarray:
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def obuhvat_srafure(tragovi: np.ndarray) -> np.ndarray:
    """Plohe pokrivene šrafurom (ili rešetkom) jedne boje.

    Listovi nisu dosljedni: na jednom je šrafura nacrtana crtama a obris
    tankim plohama, na drugom obrnuto. Zato se uzimaju svi tragovi boje:
    zatvaranje spoji gustu šrafuru u punu plohu, a otvaranje zatim ukloni
    ono što je samo crta (obris bez šrafure, crtkana granica obalnog
    područja, brojevi). Šrafura je na listovima gusta ~3–6 px na rešetki
    lista, crte široke 1–3 px.
    """
    puno = ndimage.binary_closing(tragovi, structure=krug(ZATVARANJE_PX))
    puno = ndimage.binary_fill_holes(puno) & ndimage.binary_dilation(puno, iterations=ZATVARANJE_PX)
    puno = ndimage.binary_opening(puno, structure=krug(OTVARANJE_PX))
    return ndimage.binary_dilation(puno, iterations=2)


def bijele_plohe(put: str, dpi: float) -> np.ndarray:
    """Plohe lista šire od ~4 px (8 m) koje prekrivaju ispunu: bijele, ili bijele s crvenom šrafurom
    plana na snazi. Gdje je šrafura preko vidljive ispune, između crta je boja ispune, pa to ostaje.
    Ispuna ispod njih je u crtežu, ali je list ne pokazuje (odrezana ili prekrivena)."""
    p = pymupdf.open(put)[0]
    p.set_cropbox(p.mediabox)
    pix = p.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0), alpha=False)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    c = rgb.astype(np.int16)
    papir = rgb.min(axis=2) >= 245
    # crvena šrafura na bijelom i njezini rozi rubovi (G ≈ B); šrafura preko narančaste ima B ≈ 0
    rozo = (c[:, :, 0] >= 230) & (np.abs(c[:, :, 1] - c[:, :, 2]) <= 30) & (c[:, :, 1] <= 245)
    return ndimage.binary_opening(papir | rozo, iterations=4)


def list_na_rescetku(lst: dict) -> np.ndarray:
    plan = R.uklapanje_lista(lst["plan"], lst["pdf"])
    plan["pdf"], plan["url"] = lst["pdf"], lst["url"]
    put = R.preuzmi(plan)
    dpi = 72.0 * plan["afin"][0] / R.KORAK
    d = pymupdf.open(put)
    vis = d[0].mediabox.width if d[0].rotation in (90, 270) else d[0].mediabox.height
    print(lst["id"], lst["naziv"])
    bitovi = None
    for boja, bit in lst["srafure"].items():
        m = obuhvat_srafure(crtez(put, dpi, boja, "srafura") | crtez(put, dpi, boja, "crta"))
        bitovi = np.zeros(m.shape, np.uint8) if bitovi is None else bitovi
        bitovi[m] |= bit
    bijelo = bijele_plohe(put, dpi) if lst["ispune"] else None
    for boja, bit in lst["ispune"].items():
        m = crtez(put, dpi, boja, "ispuna") & ~bijelo
        m = ndimage.binary_closing(m, iterations=2)
        bitovi = np.zeros(m.shape, np.uint8) if bitovi is None else bitovi
        bitovi[m] |= bit
    g = R.na_rescetku(bitovi, plan, dpi, vis)
    return g


def pregled(g: np.ndarray, kl: np.ndarray | None, put: str) -> None:
    rgb = np.full(g.shape + (3,), 255, np.uint8)
    if kl is not None:
        rgb[kl > 0] = (235, 235, 235)
    for bit, boja in [(NEUREDENO, (255, 255, 175)), (SANACIJA, (159, 255, 127)), (PREOBRAZBA, (255, 191, 0)),
                      (OBVEZA, (120, 150, 255)), (MARJAN, (0, 200, 0)), (VAZECI, (255, 90, 90))]:
        rgb[(g & bit) > 0] = boja
    Image.fromarray(rgb[::2, ::2]).save(put)


ISPUNE_2025 = SANACIJA | PREOBRAZBA | NEUREDENO


def bitovi_po_cestici(g: np.ndarray, ids: np.ndarray, n: int) -> np.ndarray:
    """Kao cestice.py: bit ide čestici kad pokriva barem pola njezinih piksela."""
    mc = ids > 0
    svi = np.bincount(ids[mc], minlength=n)
    out = np.zeros(n, np.int64)
    for bit in (SANACIJA, PREOBRAZBA, NEUREDENO):
        mb = mc & ((g & bit) > 0)
        pod = np.bincount(ids[mb], minlength=n)
        out[(pod * 2 >= svi) & (svi > 0)] |= bit
    return out


def popravi_cestice(staro: np.ndarray, novo: np.ndarray) -> None:
    """Bitovi ispune za 2025. u izvezenim česticama: mijenja se samo ono što je promijenio list.

    Čestice se rasteriziraju iz pločica (public/geo/gup-grad/cestice), pa se
    za svaku usporede bitovi po starom i po novom listu na istoj rešetki;
    razlika se prenese u cestice.json i pločice. Tako rubni slučajevi zbog
    malo drukčijeg oblika čestice u pločici ne mijenjaju ništa.
    """
    from pyproj import Transformer

    u3765 = Transformer.from_crs(4326, 3765, always_xy=True).transform
    trans = Affine(R.KORAK, 0.0, R.MREZA_BBOX[0], 0.0, -R.KORAK, R.MREZA_BBOX[3])
    plocice = {}
    for put in sorted(glob.glob(os.path.join(R.ROOT, "public", "geo", "gup-grad", "cestice", "*.json"))):
        with open(put, encoding="utf-8") as f:
            plocice[put] = json.load(f)
    znacajke = [(put, z) for put, fc in plocice.items() for z in fc["features"]]
    n = max(z["properties"]["i"] for _, z in znacajke) + 2
    ids = features.rasterize(((stransform(u3765, shape(z["geometry"])), z["properties"]["i"] + 1) for _, z in znacajke),
                             out_shape=(R.H, R.W), transform=trans, fill=0, dtype="int32")
    razlika = bitovi_po_cestici(staro, ids, n) ^ bitovi_po_cestici(novo, ids, n)
    put_json = os.path.join(R.ROOT, "data", "gup-grad", "cestice.json")
    with open(put_json, encoding="utf-8") as f:
        d = json.load(f)
    rezim = d["godine"]["2025"]["planski_rezim"]
    promijenjene, broj = set(), 0
    for put, z in znacajke:
        s = z["properties"]
        r = int(razlika[s["i"] + 1])
        if not r:
            continue
        novi = s.get("p", {}).get("2025", 0) ^ r
        if novi:
            s.setdefault("p", {})["2025"] = novi
        else:
            del s["p"]["2025"]
            if not s["p"]:
                del s["p"]
        rezim[s["i"]] = novi
        promijenjene.add(put)
        broj += 1
    for put in promijenjene:
        with open(put, "w", encoding="utf-8") as f:
            json.dump(plocice[put], f, ensure_ascii=False, separators=(",", ":"))
    with open(put_json, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    print(f"čestice: bitovi ispune 2025. promijenjeni na {broj}; pločica prepravljeno {len(promijenjene)}")


def main() -> None:
    os.makedirs(R.OUT, exist_ok=True)
    stari_2025 = os.path.join(R.OUT, "pr-gup-2025.npy")
    staro = np.load(stari_2025) if "--cestice" in sys.argv[1:] and os.path.exists(stari_2025) else None
    po_listu = {lst["id"]: list_na_rescetku(lst) for lst in LISTOVI}
    izvj = {"bitovi": {"VAZECI": VAZECI, "OBVEZA": OBVEZA, "SANACIJA": SANACIJA, "PREOBRAZBA": PREOBRAZBA,
                       "NEUREDENO": NEUREDENO, "MARJAN": MARJAN},
            "listovi": [{k: lst[k] for k in ("id", "naziv", "url")} for lst in LISTOVI], "godine": {}}
    for gid, listovi in GODINE.items():
        g = np.zeros((R.H, R.W), np.uint8)
        for lid in listovi:
            g |= po_listu[lid]
        kl_put = os.path.join(R.OUT, f"klase-{gid}.npy")
        kl = np.load(kl_put) if os.path.exists(kl_put) else None
        if kl is not None:
            g[kl == 0] = 0  # izvan obuhvata GUP-a (i legende lista) nema režima
        np.save(os.path.join(R.OUT, f"pr-{gid}.npy"), g)
        if gid == "gup-2025" and staro is not None:
            popravi_cestice(staro, g)
        pregled(g, kl, os.path.join(R.OUT, f"pregled-pr-{gid}.png"))
        ha = {ime: round(float(((g & bit) > 0).sum()) * R.KORAK ** 2 / 1e4, 1) for ime, bit in izvj["bitovi"].items()}
        izvj["godine"][gid] = {"listovi": listovi, "ha": ha}
        print(gid, ha)
    with open(os.path.join(R.OUT, "pr.json"), "w") as f:
        json.dump(izvj, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
