#!/usr/bin/env python3
"""Pretvara plohe namjene s listova GUP-a u vektorske slojeve, po godinama.

Zašto rasterom, a ne izravno iz vektora PDF-a: plohe namjene na tim
listovima nisu nacrtane kao poligoni nego kao tisuće tankih vodoravnih
šrafura. Vađenje vektora daje ~80 000 krpica medijalne površine 20 m²,
iz kojih se ploha ne da rekonstruirati. Kad se list renderira na 1 m/px,
šrafura je ispod veličine piksela i stopi se u punu boju, pa se ploha
dobiva klasifikacijom boje i poligonizacijom (GDAL).

Georeferenciranje je riješeno prije ove skripte i ovdje je konstanta:
mjerilo je otisnuto na listu (1:10 000 → 3,527778 m/pt), a pomak je
dobiven faznom korelacijom protiv službenog ISPU rastera.

Uklapanje NIJE samo pomak. Listovi 2008. i 2015. crtani su zakrenuto (~1,2°)
i s mjerilom koje odstupa ~0,4 % od otisnutog, pa ih nikakvo pomicanje ne
poklapa. Parametre vadi mrežom veznih točaka: podijeli list na pločice,
svaku zasebno korelacijom uklopi u ISPU raster i na dobiveno polje pomaka
metodom najmanjih kvadrata prilagodi sličnost (Umeyama). 35 pločica daje ostatak
medijana ~6 m i potvrđuje zakret (2015.: preostalo +0,03°), ali NE puštaj
mjerilo da pluta: prilagodba ga povuče za ~0,4 %, preklop s ISPU-om padne
s 82,9 % na 79,4 %. Otisnuto mjerilo 1:10 000 potvrđeno je i širinom
crteža (3766 pt ≈ 13 285 m, točno obuhvat GUP-a iz ISPU-a), a ISPU je
druge vintage od lista, pa stvarne razlike sadržaja uklapanje upije kao
lažno mjerilo.

NERIJEŠENO (2026-07-28): list 2008. je pri velikom mjerilu vidljivo krivo
smješten — rub plohe siječe cestu umjesto da ide njome. Mreža veznih
točaka to i mjeri (preostali zakret +0,278°), ali ugradnja tog zakreta u
afinu prebaci na −0,380°, dakle promjena je veća od primijenjene i
suprotnog predznaka. Znači da je pogrešno slaganje ispravka u afinu, a ne
sam kut: `nOX,nOY = R@[OX,OY]+T` vrti ishodište oko (0,0), a ne oko
središta uklapanja, pa uz zakret unese i pomak. Prije novog pokušaja
provjeriti slaganje na sintetičkom primjeru poznatog kuta.

POMAK SE MORA TRAŽITI U ŠIROKOM PROZORU. Prvi pokušaj za 2015. tražio je
±400 m, uhvatio lažni vrh i promašio za ~500 m; provjera preklapanjem to
je pokazala udvostručenim natpisima, ali su protumačeni kao razlika
sadržaja. Ako se u preklopu natpisi ili crtkana granica obuhvata vide
dvaput, list NIJE dobro smješten — bez obzira na to koliko vrh izgleda
uvjerljivo.

Rezultat: public/geo/planovi/gup-<godina>-namjena.geojson (EPSG:4326)

Pokretanje:  /opt/homebrew/bin/python3 scripts/trace-plans.py
Traži:       pdftoppm (poppler), GDAL s Python vezama, numpy, Pillow
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
from html import unescape

import numpy as np
from osgeo import gdal, ogr, osr
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
gdal.UseExceptions()
ogr.UseExceptions()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "sources", "planovi")
OUT = os.path.join(ROOT, "public", "geo", "planovi")

KVART_3765 = (497574, 4818898, 501617, 4822231)

M_PO_PT = (25.4 / 72) * 10  # mjerilo 1:10 000
DPI = 254                   # 72/254 pt = 1,000 m/px pri tom mjerilu
M_PO_PX = M_PO_PT * 72 / DPI

# Sve godine završe na istoj osnoj mreži od 1 m, pa su i poligonizacija i
# razlika trivijalne — bez nje bi zakrenuti listovi tražili poravnavanje.
MREZA_W = KVART_3765[2] - KVART_3765[0]
MREZA_H = KVART_3765[3] - KVART_3765[1]
MREZA_GT = (KVART_3765[0], 1.0, 0.0, KVART_3765[3], 0.0, -1.0)


def _rot(plan: dict) -> tuple[float, float]:
    r = math.radians(plan.get("zakret", 0.0))
    return math.cos(r), math.sin(r)


def u_metre_lista(plan: dict, X: float, Y: float) -> tuple[float, float]:
    """Tlo → metri na listu (obrnuti zakret oko ishodišta lista)."""
    c, si = _rot(plan)
    _, ox, oy = plan["afin"]
    dx, dy = X - ox, Y - oy
    return c * dx + si * dy, -si * dx + c * dy


def u_tocke_lista(plan: dict, x_pt: float, y_pt: float,
                  visina_pt: float) -> tuple[float, float]:
    """Točka stranice (ishodište gore lijevo) → metri na listu.

    `pdftotext -bbox` broji y od vrha, a renderiranje u `renderiraj()` mjeri
    v od dna stranice, pa se os okreće ovdje i nigdje drugdje.
    """
    sc = plan["afin"][0]
    return x_pt * sc, (visina_pt - y_pt) * sc


# ---------------------------------------------------------------------------
# Stavke izmjena koje nacrt sam ucrtava na list
#
# Nacrt iz 2024. nije nijema karta: uz izmijenjene plohe otisnut je broj
# stavke iz popisa "1. Korištenje i namjena površina" u tumaču znakova, a
# tekst stavke je službeni opis odluke. To je jedini dio ovog cjevovoda koji
# ne izvodimo mi nego ga plan tvrdi sam o sebi, pa razlikama daje uporište
# neovisno o tome koliko su nam listovi točno smješteni.
#
# Napomena s lista, koja objašnjava zašto razlika ipak mora biti računata:
#   "Potpuni uvid u izmjene i dopune grafičkog dijela Plana je moguć jedino
#    na temelju usporedbe svakog pojedinačnog kartografskog prikaza
#    Prijedloga izmjena i dopuna Plana s odgovarajućim kartografskim
#    prikazom važećeg Plana."
#
# Uzorak je oznaka izvan crteža ne zanima: brojevi stavki stoje i u samom
# tumaču znakova, desno od crteža, pa se taj stupac odbacuje po x.
STUPAC_TUMACA_PT = 3820   # pt od lijevog ruba — desno od ovoga je legenda
NAJDALJA_STAVKA = 80      # m — oznaka je izvanploha, s uputnicom na plohu

# Stavka vrijedi samo za promjenu u namjenu o kojoj i govori. Bez tog uvjeta
# najbliža oznaka pokupi bilo koju susjednu promjenu i pripiše joj tuđi opis.
STAVKE: dict[str, tuple[str, str]] = {
    "1.7": (
        r"^Z",
        "Ucrtane postojeće zelene površine i zelene površine iz planova "
        "užeg područja (prenamjena, većinom iz mješovite)",
    ),
    "1.11": (
        r"^D",
        "Označene postojeće (prenamjena, većinom iz M1 i M2, ma Mejašima iz "
        "IS4) i nove planirane zone javne i društvene namjene",
    ),
    "1.15": (
        r"^R2",
        "Ucrtane postojeće rekreacijske površine R2 (koje su uglavnom bile "
        "u mješovitoj namjeni)",
    ),
}


def procitaj_stavke(plan: dict) -> list[dict]:
    """Brojevi stavki izmjena otisnuti na samom listu, s položajem na tlu.

    Čita se tekstualni sloj PDF-a, ne slika: nacrt iz 2024. je CAD izvoz pa
    su natpisi živi tekst. OCR ovdje ne treba.
    """
    if not plan.get("stavke"):
        return []
    _, visina = stranica(plan["pdf"])
    izlaz = os.path.join(RAD, f"{plan['id']}-tekst.xml")
    subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-bbox",
                    plan["pdf"], izlaz], check=True, capture_output=True)
    with open(izlaz, encoding="utf-8") as fh:
        xml = fh.read()

    x0, y0, x1, y1 = KVART_3765
    nadene: list[dict] = []
    uzorak = re.compile(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" '
        r'xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')
    for m in uzorak.finditer(xml):
        lx, ly, dx, dy = (float(v) for v in m.groups()[:4])
        rijec = unescape(m.group(5))
        if rijec not in STAVKE or lx > STUPAC_TUMACA_PT:
            continue
        u, v = u_tocke_lista(plan, (lx + dx) / 2, (ly + dy) / 2, visina)
        X, Y = u_tlo(plan, u, v)
        if not (x0 <= X <= x1 and y0 <= Y <= y1):
            continue
        t = ogr.Geometry(ogr.wkbPoint)
        t.AddPoint(X, Y)
        nadene.append({"stavka": rijec, "tocka": t})
    return nadene


def pripisi_stavku(g, u_kod: str, stavke: list[dict]) -> str | None:
    """Broj stavke nacrta koja objašnjava ovu promjenu, ako je ima.

    Traži se najbliža oznaka koja govori baš o toj namjeni; promjene koje
    nijedna stavka ne pokriva ostaju bez pripisa, jer popis na listu opisuje
    cijeli Split, a većina se stavki kvarta uopće ne tiče.
    """
    najbolja, razmak = None, NAJDALJA_STAVKA
    for o in stavke:
        if not re.match(STAVKE[o["stavka"]][0], u_kod):
            continue
        d = o["tocka"].Distance(g)
        if d <= razmak:
            najbolja, razmak = o["stavka"], d
    return najbolja


RADIJUS_POPUNE = 4    # px — zatvara zgrade i natpise unutar plohe
PRAG_POPUNE = 25      # koliko susjeda iste klase treba da se prazan px popuni
PROLAZA_POPUNE = 3
NAJMANJA_PLOHA = 400  # m² — ispod toga je šum rendera, ne ploha plana
POJEDNOSTAVI = 3.0    # m — Douglas–Peucker; poligonizacija ionako daje stepenice
DECIMALA = 6          # ~0,1 m; bez toga GeoJSON nosi 15 znamenki po koordinati

# Boje očitane iz legende listova (v. "Razvoj i uređenje naselja").
# Neke se namjene na listu crtaju istom bojom i razlikuju samo otisnutim
# slovnim kodom, pa ih ovdje pošteno vodimo kao spojenu klasu.
PALETA: list[tuple[str, str, str]] = [
    ("#ffff00", "S", "Stambena namjena"),
    ("#e0a000", "M/K5", "Mješovita namjena M ili poslovna namjena i stanovanje K5"),
    ("#f46040", "D", "Javna i društvena namjena"),
    ("#a02080", "I/K", "Gospodarska namjena I ili poslovna namjena K"),
    ("#c02000", "T", "Ugostiteljsko-turistička namjena"),
    ("#20a0c0", "L", "Luke — LN nautički turizam, LS športska luka"),
    ("#006000", "R1", "Športski centar"),
    ("#c0e080", "R2", "Rekreacija"),
    ("#40c0c0", "R3", "Kupalište"),
    ("#40c040", "Z1", "Javne zelene površine Z1/Z3/Z4 ili park-šuma"),
    ("#80e000", "Z5", "Zaštitno i pejsažno zelenilo Z5/Z6"),
    ("#a000c0", "N", "Posebna namjena"),
]
NAJVECI_RAZMAK = 90.0  # euklidski u RGB; šrafirana ploha je svjetlija od uzorka
NAJMANJA_ZASICENOST = 30  # max-min kanal; podloga zgrada je siva, ne namjena

# Boje koje nisu namjena ali padaju unutar razmaka do neke iz palete —
# čista crvena crta granice obalnog pojasa inače završi kao namjena T.
MAMCI: list[str] = ["#ff0000", "#000000", "#ffffff", "#808080", "#dbdbdb"]

PRAG_RUPE = 3000  # m² — rupa manja od toga je otisnuta oznaka, ne ploha

# Čitanje otisnutih oznaka. Plan dvjema namjenama daje istu boju (I i K,
# M i K5), pa se razlikuju jedino po slovnoj oznaci otisnutoj u plohi.
# Otisnuti kod → (klasa iz PALETE, precizniji kod, opis).
VOKABULAR: dict[str, tuple[str, str, str]] = {
    "S": ("S", "S", "Stambena namjena"),
    "M1": ("M/K5", "M1", "Mješovita namjena — pretežito stambena"),
    "M2": ("M/K5", "M2", "Mješovita namjena — stambena i poslovna"),
    "M3": ("M/K5", "M3", "Mješovita namjena — stanovanje i turizam"),
    "K5": ("M/K5", "K5", "Poslovna namjena i stanovanje"),
    "D1": ("D", "D1", "Javna i društvena namjena — uprava"),
    "D2": ("D", "D2", "Javna i društvena namjena — socijalna"),
    "D3": ("D", "D3", "Javna i društvena namjena — zdravstvena"),
    "D4": ("D", "D4", "Javna i društvena namjena — predškolska"),
    "D5": ("D", "D5", "Javna i društvena namjena — školska"),
    "D6": ("D", "D6", "Javna i društvena namjena — visoko učilište, znanost"),
    "D7": ("D", "D7", "Javna i društvena namjena — kultura"),
    "D8": ("D", "D8", "Javna i društvena namjena — vjerska"),
    "I": ("I/K", "I", "Gospodarska namjena"),
    "K": ("I/K", "K", "Poslovna namjena"),
    "K3": ("I/K", "K3", "Poslovna namjena — komunalno servisna"),
    "K4": ("I/K", "K4", "Poslovna namjena — rasadnici"),
    "T1": ("T", "T1", "Ugostiteljsko-turistička namjena — hotel"),
    "T3": ("T", "T3", "Ugostiteljsko-turistička namjena — kamp"),
    "Z1": ("Z1", "Z1", "Javne zelene površine — javni park"),
    "Z3": ("Z1", "Z3", "Javne zelene površine — uređeno zelenilo"),
    "Z4": ("Z1", "Z4", "Javne zelene površine — spomen-park"),
    "Z5": ("Z5", "Z5", "Zaštitno i pejsažno zelenilo"),
    "Z6": ("Z5", "Z6", "Zaštitno i pejsažno zelenilo"),
    "R1": ("R1", "R1", "Športsko rekreacijska namjena — športski centar"),
    "R2": ("R2", "R2", "Športsko rekreacijska namjena — rekreacija"),
    "R3": ("R3", "R3", "Športsko rekreacijska namjena — kupalište"),
    "N": ("N", "N", "Posebna namjena"),
    "LN": ("L", "LN", "Luka nautičkog turizma"),
    "LS": ("L", "LS", "Športska luka"),
}
CRNA_TINTA = 90     # max kanal; magenta #a02080 zbraja nisko pa "tamno" ne valja
NAJMANJE_CITANJE = 40  # povjerenje tesseracta ispod kojeg se čitanje odbacuje


PLANOVI: list[dict] = [
    {
        "id": "gup-2008-namjena",
        "godina": 2008,
        "naziv": "GUP Split 2008. — korištenje i namjena prostora",
        "pdf": os.path.join(
            SRC, "GUP grada Splita", "Generalni urbanistički plan Splita",
            "Grafički dio", "3170_1_namjena.pdf"),
        # ručno smješteno na /admin/georef (mjerilo prilijepljeno na 1:10 000)
        "afin": (M_PO_PT, 490179.59, 4816845.14),
        "zakret": 0.95,
    },
    {
        "id": "gup-2015-namjena",
        "godina": 2015,
        "naziv": "GUP Split 2015. (pročišćeni, uklj. ID 2014.) — korištenje i namjena",
        "pdf": os.path.join(
            SRC, "GUP grada Splita", "Generalni urbanistički plan Splita",
            "Odredbe za provođenje i Grafički dio GUP-a",
            "Neslužbeni pročišćeni kartografski prikazi",
            "3196_01_Koristenje i namjena.pdf"),
        # ručno smješteno na /admin/georef (mjerilo prilijepljeno na 1:10 000)
        "afin": (M_PO_PT, 489876.51, 4817030.51),
        "zakret": 1.10,
    },
    {
        "id": "gup-2024-namjena",
        "godina": 2024,
        "naziv": "GUP Split — nacrt izmjena i dopuna 2024., korištenje i namjena",
        "pdf": os.path.expanduser(
            "~/Downloads/4.3_Prikaz Izmjena i dopuna grafickog dijela.pdf"),
        # ručno smješteno na /admin/georef (mjerilo prilijepljeno na 1:10 000)
        "afin": (M_PO_PT, 490300.41, 4817117.25),
        "zakret": 0.0,
        # Jedini list koji uz izmijenjene plohe otiskuje broj stavke iz
        # popisa izmjena — vidi STAVKE i procitaj_stavke().
        "stavke": True,
    },
]


def stranica(put: str) -> tuple[float, float]:
    """Veličina stranice u točkama, nakon primjene /Rotate."""
    txt = subprocess.run(["pdfinfo", put], check=True,
                         capture_output=True, text=True).stdout
    w = h = 0.0
    rot = 0
    for red in txt.splitlines():
        if red.startswith("Page size:"):
            dio = red.split(":", 1)[1].split("pts")[0]
            w, h = (float(v) for v in dio.split("x"))
        elif red.startswith("Page rot:"):
            rot = int(red.split(":", 1)[1]) % 360
    return (h, w) if rot in (90, 270) else (w, h)


def renderiraj(plan: dict) -> tuple[np.ndarray, tuple[float, float]]:
    """Renderira dio lista koji pokriva kvart, na 1 m/px.

    Vraća RGB polje i koordinate gornjeg lijevog piksela u EPSG:3765.
    """
    sc, ox, oy = plan["afin"]
    sw, sh = stranica(plan["pdf"])
    x0, y0, x1, y1 = KVART_3765
    # Zakrenut list pokriva zakrenut pravokutnik na tlu, pa se uzima okvir
    # svih četiriju uglova kvarta preslikanih natrag u prostor lista.
    uglovi = [u_metre_lista(plan, X, Y)
              for X in (x0, x1) for Y in (y0, y1)]
    px0 = max(0.0, min(u for u, _ in uglovi) / sc)
    px1 = min(sw, max(u for u, _ in uglovi) / sc)
    py0 = max(0.0, min(v for _, v in uglovi) / sc)
    py1 = min(sh, max(v for _, v in uglovi) / sc)
    if px1 - px0 < 1 or py1 - py0 < 1:
        raise SystemExit(f"{plan['id']}: list ne pokriva kvart")

    k = DPI / 72.0
    lijevo, gore = int(px0 * k), int((sh - py1) * k)
    sirina, visina = int((px1 - px0) * k), int((py1 - py0) * k)

    stem = os.path.join(RAD, plan["id"])
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(DPI), "-f", "1", "-l", "1",
         "-x", str(lijevo), "-y", str(gore), "-W", str(sirina), "-H", str(visina),
         plan["pdf"], stem],
        check=True, capture_output=True,
    )
    for kand in (f"{stem}-1.png", f"{stem}-01.png", f"{stem}-001.png"):
        if os.path.exists(kand):
            os.replace(kand, f"{stem}.png")
            break
    rgb = np.asarray(Image.open(f"{stem}.png").convert("RGB"))
    # gornji lijevi piksel natrag u metre
    # gornji lijevi piksel u metrima lista (prije zakreta)
    gx = (lijevo / k) * sc
    gy = (sh - gore / k) * sc
    # Listovi ne pokrivaju kvart jednako: obuhvat GUP-a završava crtom uz
    # sjeverni rub kvarta, a svaka generacija lista reže na svom mjestu.
    # Bez ovoga bi se površine po godinama uspoređivale s različitih ploha.
    plan["pokriveno"] = list(KVART_3765)
    return rgb, (gx, gy)


def klasificiraj(rgb: np.ndarray) -> np.ndarray:
    """Svakom pikselu pridjeljuje najbližu boju iz palete (0 = ništa)."""
    boje = [h for h, _, _ in PALETA] + MAMCI
    uzorci = np.array(
        [[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in boje],
        dtype=np.float32,
    )
    a = rgb.astype(np.float32)
    najbolja = np.full(a.shape[:2], np.inf, np.float32)
    klase = np.zeros(a.shape[:2], np.uint8)
    for i, u in enumerate(uzorci, start=1):
        d = np.sqrt(((a - u) ** 2).sum(axis=2))
        bolje = d < najbolja
        klase = np.where(bolje, np.uint8(i), klase)
        najbolja = np.where(bolje, d, najbolja)
    # Siva podloga zgrada leži bliže blijedozelenoj R2 nego što se čini
    # (razmak ~76), pa se sve neutralno mora odbaciti prije razmaka.
    zasicenost = a.max(axis=2) - a.min(axis=2)
    dobro = (
        (najbolja <= NAJVECI_RAZMAK)
        & (zasicenost >= NAJMANJA_ZASICENOST)
        & (klase <= len(PALETA))  # mamci ispadaju
    )
    return np.where(dobro, klase, np.uint8(0))


def _zbroj_u_okviru(m: np.ndarray, r: int) -> np.ndarray:
    """Zbroj vrijednosti u kvadratu (2r+1)², preko integralne slike."""
    i = np.zeros((m.shape[0] + 1, m.shape[1] + 1), np.int32)
    i[1:, 1:] = m.cumsum(0).cumsum(1)
    H, W = m.shape
    y0 = np.clip(np.arange(H) - r, 0, H)
    y1 = np.clip(np.arange(H) + r + 1, 0, H)
    x0 = np.clip(np.arange(W) - r, 0, W)
    x1 = np.clip(np.arange(W) + r + 1, 0, W)
    return (i[np.ix_(y1, x1)] - i[np.ix_(y0, x1)]
            - i[np.ix_(y1, x0)] + i[np.ix_(y0, x0)])


def _jedan_prolaz(klase: np.ndarray, r: int, prag: int,
                  gdje: np.ndarray) -> np.ndarray:
    najbolji = np.zeros(klase.shape, np.int32)
    kandidat = np.zeros(klase.shape, np.uint8)
    for i in range(1, len(PALETA) + 1):
        n = _zbroj_u_okviru((klase == i).astype(np.int32), r)
        bolje = n > najbolji
        kandidat = np.where(bolje, np.uint8(i), kandidat)
        najbolji = np.where(bolje, n, najbolji)
    prazno = gdje & (klase == 0) & (najbolji >= prag)
    return np.where(prazno, kandidat, klase)


def popuni(klase: np.ndarray, tamno: np.ndarray | None = None) -> np.ndarray:
    """Zatvara zgrade, natpise i bijele proreze unutar plohe.

    Prazan piksel poprima klasu koja ga najviše okružuje. Ceste i more
    ostaju prazni jer su širi od okvira. Krupni otisnuti natpisi ("10")
    predebeli su za taj okvir, pa tamni pikseli dobiju širi okvir — bijela
    cesta time ostaje netaknuta.
    """
    for _ in range(PROLAZA_POPUNE):
        novo = _jedan_prolaz(klase, RADIJUS_POPUNE, PRAG_POPUNE,
                             np.ones(klase.shape, bool))
        if (novo == klase).all():
            break
        klase = novo
    if tamno is not None:
        r = RADIJUS_POPUNE * 3
        prag = int((2 * r + 1) ** 2 * 0.30)
        for _ in range(2):
            klase = _jedan_prolaz(klase, r, prag, tamno)
    return klase


def _komponente(ink: np.ndarray) -> list[tuple[float, float, float, float]]:
    """Povezane nakupine crne tinte, kao okviri u pikselima."""
    ds = gdal.GetDriverByName("MEM").Create("", ink.shape[1], ink.shape[0], 1,
                                            gdal.GDT_Byte)
    ds.SetGeoTransform((0, 1, 0, 0, 0, 1))
    ds.GetRasterBand(1).WriteArray(ink)
    ds.GetRasterBand(1).SetNoDataValue(0)
    mem = ogr.GetDriverByName("MEM").CreateDataSource("")
    sloj = mem.CreateLayer("k", geom_type=ogr.wkbPolygon)
    sloj.CreateField(ogr.FieldDefn("v", ogr.OFTInteger))
    gdal.Polygonize(ds.GetRasterBand(1), ds.GetRasterBand(1).GetMaskBand(),
                    sloj, 0, ["8CONNECTED=8"])
    out = []
    for f in sloj:
        if not f.GetField("v"):
            continue
        g = f.GetGeometryRef()
        x0, x1, y0, y1 = g.GetEnvelope()
        # slovo je visoko ~30 px (3 mm na listu 1:10 000) i puno; duge crte
        # granica i tanki obrisi zgrada ispadaju po visini ili površini
        if 10 <= y1 - y0 <= 45 and 3 <= x1 - x0 <= 60 and g.GetArea() >= 20:
            out.append((x0, y0, x1, y1))
    return out


def u_tlo(plan: dict, u: float, v: float) -> tuple[float, float]:
    """Metri na listu → tlo (EPSG:3765), sa zakretom lista."""
    c, si = _rot(plan)
    _, ox, oy = plan["afin"]
    return ox + c * u - si * v, oy + si * u + c * v


def procitaj_oznake(rgb: np.ndarray, ishodiste: tuple[float, float],
                    plan: dict) -> list[dict]:
    """Čita slovne oznake namjene otisnute u plohama.

    Slova se prvo izdvoje kao nakupine crne tinte i spoje u riječi, pa se
    svaka riječ zasebno preda tesseractu na bijeloj podlozi — na cijelom
    listu odjednom raspoznavanje pada jer je nacrt pun crnih crta.
    """
    ink = (rgb.max(axis=2) < CRNA_TINTA).astype(np.uint8)
    slova = sorted(_komponente(ink),
                   key=lambda b: (round((b[1] + b[3]) / 2 / 12), b[0]))
    rijeci: list[list[float]] = []
    for b in slova:
        if rijeci:
            p = rijeci[-1]
            if abs((b[1] + b[3]) / 2 - (p[1] + p[3]) / 2) < 9 and 0 <= b[0] - p[2] < 14:
                p[1] = min(p[1], b[1]); p[2] = b[2]; p[3] = max(p[3], b[3])
                continue
        rijeci.append(list(b))

    gx, gy = ishodiste
    rad = os.path.join(RAD, "_ocr")
    os.makedirs(rad, exist_ok=True)
    slika, osnova = os.path.join(rad, "r.png"), os.path.join(rad, "r")
    ocitano = []
    for x0, y0, x1, y1 in rijeci:
        P = 6
        sub = ink[max(0, int(y0) - P):int(y1) + P, max(0, int(x0) - P):int(x1) + P]
        if sub.size == 0:
            continue
        img = Image.fromarray(np.where(sub, 0, 255).astype(np.uint8))
        img.resize((img.width * 4, img.height * 4), Image.LANCZOS).save(slika)
        subprocess.run(
            ["tesseract", slika, osnova, "--psm", "8", "-c",
             "tessedit_char_whitelist=SMDIKTZRNLŠ0123456789", "tsv"],
            capture_output=True,
        )
        with open(f"{osnova}.tsv", encoding="utf-8") as fh:
            for red in fh.read().splitlines()[1:]:
                c = red.split("\t")
                if len(c) < 12 or not c[11].strip():
                    continue
                tekst = c[11].strip()
                if tekst in VOKABULAR and float(c[10]) >= NAJMANJE_CITANJE:
                    X, Y = u_tlo(plan, gx + (x0 + x1) / 2 * M_PO_PX,
                                 gy - (y0 + y1) / 2 * M_PO_PX)
                    ocitano.append({"tekst": tekst, "x": X, "y": Y})
    return ocitano


def na_mrezu(klase: np.ndarray, ishodiste: tuple[float, float],
             plan: dict) -> np.ndarray:
    """Zakrenuti list → zajednička osna mreža kvarta (1 m, EPSG:3765).

    GDAL geotransformacija nosi zakret u članovima [2] i [4], pa se list
    upiše kako jest i prepusti Warpu. Time sve godine završe na istoj
    mreži i razlika se svodi na usporedbu piksel po piksel.
    """
    c, si = _rot(plan)
    _, ox, oy = plan["afin"]
    u0, v0 = ishodiste
    H, W = klase.shape
    src = gdal.GetDriverByName("MEM").Create("", W, H, 1, gdal.GDT_Byte)
    src.SetGeoTransform((
        ox + c * u0 - si * v0, c, si,
        oy + si * u0 + c * v0, si, -c,
    ))
    sr = osr.SpatialReference(); sr.ImportFromEPSG(3765)
    src.SetProjection(sr.ExportToWkt())
    src.GetRasterBand(1).WriteArray(klase)

    cilj = gdal.GetDriverByName("MEM").Create("", MREZA_W, MREZA_H, 1, gdal.GDT_Byte)
    cilj.SetGeoTransform(MREZA_GT)
    cilj.SetProjection(sr.ExportToWkt())
    gdal.Warp(cilj, src, resampleAlg=gdal.GRA_NearestNeighbour)
    return cilj.GetRasterBand(1).ReadAsArray()


def poligoniziraj(klase: np.ndarray, polje: str = "klasa"):
    """Klase na zajedničkoj mreži → OGR sloj poligona u EPSG:3765."""
    H, W = klase.shape
    ds = gdal.GetDriverByName("MEM").Create("", W, H, 1, gdal.GDT_Byte)
    ds.SetGeoTransform(MREZA_GT)
    s = osr.SpatialReference()
    s.ImportFromEPSG(3765)
    ds.SetProjection(s.ExportToWkt())
    pojas = ds.GetRasterBand(1)
    pojas.WriteArray(klase)

    mem = ogr.GetDriverByName("Memory").CreateDataSource("")
    sloj = mem.CreateLayer("plohe", srs=s, geom_type=ogr.wkbPolygon)
    sloj.CreateField(ogr.FieldDefn(polje, ogr.OFTInteger))
    maska = ds.GetRasterBand(1).GetMaskBand()
    pojas.SetNoDataValue(0)
    gdal.Polygonize(pojas, maska, sloj, 0)
    return mem, sloj


def bez_sitnih_rupa(g):
    """Miče unutarnje prstenove manje od PRAG_RUPE.

    Veliki otisnuti natpisi ("10", "K5") ostaju neklasificirani i probiju
    plohu kao rupa. Ceste nisu rupe nego zarezi s ruba, pa preživljavaju.
    """
    if g.GetGeometryName() == "MULTIPOLYGON":
        novi = ogr.Geometry(ogr.wkbMultiPolygon)
        for i in range(g.GetGeometryCount()):
            novi.AddGeometry(bez_sitnih_rupa(g.GetGeometryRef(i)))
        return novi
    if g.GetGeometryName() != "POLYGON" or g.GetGeometryCount() <= 1:
        return g.Clone()
    novi = ogr.Geometry(ogr.wkbPolygon)
    novi.AddGeometry(g.GetGeometryRef(0))
    for i in range(1, g.GetGeometryCount()):
        prsten = g.GetGeometryRef(i)
        p = ogr.Geometry(ogr.wkbPolygon)
        p.AddGeometry(prsten)
        if p.GetArea() >= PRAG_RUPE:
            novi.AddGeometry(prsten)
    return novi


MAPSHAPER = os.path.join(ROOT, "node_modules", ".bin", "mapshaper")


def pojednostavi(ulaz: str, izlaz: str) -> str:
    """Pojednostavljuje sloj čuvajući zajedničke rubove susjednih ploha.

    mapshaper gradi topologiju prije generalizacije, pa rub koji dvije
    plohe dijele ostaje jedan luk i miče se objema jednako. `-clean`
    zatvara srpove koje je ostavila poligonizacija po pikselima.
    """
    r = subprocess.run(
        [MAPSHAPER, ulaz,
         "-simplify", f"interval={POJEDNOSTAVI}m", "keep-shapes", "stats",
         "-clean", f"gap-fill-area={NAJMANJA_PLOHA}m2",
         "-o", f"precision={10 ** -DECIMALA}", "format=geojson", izlaz],
        check=True, capture_output=True, text=True,
    )
    for red in (r.stderr or "").splitlines():
        if red.strip().startswith(("Removed", "Retained", "Repaired")):
            print(f"      mapshaper: {red.strip()}")
    return izlaz


def razvrstaj(g, klasa: str, oznake: list[dict]) -> tuple[str, str, int]:
    """Precizira namjenu plohe iz oznaka otisnutih unutar nje.

    Čitanja koja ne pripadaju boji plohe se odbacuju — "Z5" u magentnoj
    plohi je greška raspoznavanja, ne podatak. Ako ne ostane nijedno
    čitanje, vraća se spojena oznaka (npr. "I/K") jer boja stvarno ne
    razlikuje te dvije namjene.
    """
    glasovi: dict[str, int] = {}
    for o in oznake:
        pripada, kod, _ = VOKABULAR[o["tekst"]]
        if pripada != klasa:
            continue
        t = ogr.Geometry(ogr.wkbPoint)
        t.AddPoint_2D(o["x"], o["y"])
        if g.Contains(t):
            glasovi[kod] = glasovi.get(kod, 0) + 1
    if not glasovi:
        return klasa, "", 0
    kod = max(glasovi.items(), key=lambda t: (t[1], -len(t[0])))[0]
    return kod, VOKABULAR[kod][2], sum(glasovi.values())


def izvezi(sloj, plan: dict, oznake: list[dict] | None = None) -> dict:
    """Spaja, pojednostavljuje i zapisuje GeoJSON u EPSG:4326."""
    iz = osr.SpatialReference(); iz.ImportFromEPSG(3765)
    u = osr.SpatialReference(); u.ImportFromEPSG(4326)
    u.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(iz, u)

    znacajke, po_klasi = [], {}
    for f in sloj:
        i = f.GetField("klasa")
        if not i:
            continue
        g = f.GetGeometryRef()
        p = g.GetArea()
        if p < NAJMANJA_PLOHA:
            continue
        # Ovdje se NE pojednostavljuje: OGR čuva topologiju svakog poligona
        # zasebno, pa bi susjedne plohe koje su dijelile rub razišle do
        # tolerancije i ostavile srpove. To radi mapshaper nad cijelim
        # slojem odjednom, jer zajednički rub vidi kao jedan luk.
        g = bez_sitnih_rupa(g)
        if g.IsEmpty():
            continue
        boja, klasa, opis = PALETA[i - 1]
        kod, tocniji, citanja = razvrstaj(g, klasa, oznake or [])
        g.Transform(tr)
        po_klasi[kod] = po_klasi.get(kod, 0) + p
        znacajke.append({
            "type": "Feature",
            "properties": {
                "godina": plan["godina"], "kod": kod,
                "namjena": tocniji or opis, "iz_boje": klasa,
                "citanja": citanja, "boja": boja, "povrsina_m2": round(p),
            },
            "geometry": json.loads(g.ExportToJson(
                options=[f"COORDINATE_PRECISION={DECIMALA}"])),
        })
    znacajke.sort(key=lambda f: -f["properties"]["povrsina_m2"])
    sirovo = os.path.join(RAD, f"{plan['id']}-sirovo.geojson")
    with open(sirovo, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": znacajke},
                  fh, ensure_ascii=False)
    put = pojednostavi(sirovo, os.path.join(OUT, f"{plan['id']}.geojson"))
    return {"put": put, "ploha": len(znacajke), "mb": os.path.getsize(put) / 1e6,
            "po_klasi": {k: round(v / 1e4, 1) for k, v in
                         sorted(po_klasi.items(), key=lambda t: -t[1])}}


RAD = os.path.join(ROOT, "data", "sources", "planovi", "_raster")

# Razlika između godina. Georeferenciranje nosi ±2–5 m, pa svaka granica
# daje tanki srp lažne promjene — otvaranje (erozija pa dilatacija) ga
# briše, a stvarne plohe preživljavaju.
RADIJUS_OTVARANJA = 3
NAJMANJA_PROMJENA = 2000  # m²


def _erozija(m: np.ndarray, r: int) -> np.ndarray:
    return _zbroj_u_okviru(m.astype(np.int32), r) == (2 * r + 1) ** 2


def _dilatacija(m: np.ndarray, r: int) -> np.ndarray:
    return _zbroj_u_okviru(m.astype(np.int32), r) > 0


# Kratka imena za popis promjena. Izvedena iz opisa daju nesklapne nizove
# ("Poslovna  i stanovanje"), pa se pišu ručno — ovo čita stanar, ne planer.
KRATKO: dict[str, str] = {
    "S": "stambena", "M1": "pretežito stambena", "M2": "stambena i poslovna",
    "M3": "stanovanje i turizam", "M/K5": "mješovita",
    "K5": "poslovna sa stanovanjem", "D": "javna i društvena",
    "D1": "uprava", "D2": "socijalna ustanova", "D3": "zdravstvo",
    "D4": "predškolska ustanova", "D5": "škola", "D6": "visoko učilište",
    "D7": "kultura", "D8": "vjerski objekt", "I": "gospodarska (proizvodna)",
    "K": "poslovna", "K3": "komunalno-servisna", "K4": "rasadnik",
    "I/K": "gospodarska ili poslovna", "T": "ugostiteljsko-turistička",
    "T1": "hotel", "T3": "kamp", "Z1": "javni park", "Z3": "uređeno zelenilo",
    "Z4": "spomen-park", "Z5": "zaštitno zelenilo", "Z6": "zaštitno zelenilo",
    "R1": "športski centar", "R2": "rekreacija", "R3": "kupalište",
    "N": "posebna namjena", "L": "luka",
}


def kratko(kod: str) -> str:
    return KRATKO.get(kod, kod)


def ucitaj_plohe(plan: dict) -> list:
    """Već razvrstane plohe godine, u EPSG:3765, za preuzimanje kodova."""
    iz_ = osr.SpatialReference(); iz_.ImportFromEPSG(4326)
    iz_.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    u = osr.SpatialReference(); u.ImportFromEPSG(3765)
    tr = osr.CoordinateTransformation(iz_, u)
    with open(os.path.join(OUT, f"{plan['id']}.geojson"), encoding="utf-8") as fh:
        fc = json.load(fh)
    plohe = []
    for f in fc["features"]:
        g = ogr.CreateGeometryFromJson(json.dumps(f["geometry"]))
        g.Transform(tr)
        plohe.append((g, f["properties"]["kod"], f["properties"]["namjena"]))
    return plohe


def tocniji_kod(tocka, plan: dict, kod: str, opis: str) -> tuple[str, str]:
    for g, k, o in plan["plohe"]:
        if g.Contains(tocka):
            return k, o
    return kod, opis


def razlika(prije: dict, poslije: dict) -> dict:
    """Plohe kojima se namjena promijenila između dvije generacije plana.

    Uspoređuju se samo pikseli koje su OBJE godine razvrstale — prijelaz
    iz "ništa" je najčešće cesta ili rub obuhvata, a ne odluka plana.
    """
    ka, kb = prije["raster"], poslije["raster"]
    promjena = (ka > 0) & (kb > 0) & (ka != kb)
    cisto = _dilatacija(_erozija(promjena, RADIJUS_OTVARANJA), RADIJUS_OTVARANJA)
    promjena &= cisto
    # kod = stara klasa * 16 + nova; 12 klasa stane u uint8
    kod = np.where(promjena, ka.astype(np.uint16) * 16 + kb, 0).astype(np.uint8)

    mem, sloj = poligoniziraj(kod, "kod")
    iz_ = osr.SpatialReference(); iz_.ImportFromEPSG(3765)
    u = osr.SpatialReference(); u.ImportFromEPSG(4326)
    u.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(iz_, u)

    znacajke, zbroj = [], {}
    for f in sloj:
        v = f.GetField("kod")
        if not v:
            continue
        g = f.GetGeometryRef()
        p = g.GetArea()
        if p < NAJMANJA_PROMJENA:
            continue
        g = bez_sitnih_rupa(g)
        _, iz_kod, iz_opis = PALETA[(v >> 4) - 1]
        boja, u_kod, u_opis = PALETA[(v & 15) - 1]
        # Boja razlikuje samo klasu (I/K, M/K5); točan kod nose plohe koje
        # su već razvrstane čitanjem oznaka, pa se ovdje samo preuzme.
        # Uzorak se mora uzeti PRIJE prebacivanja u 4326 — plohe su u 3765.
        t = g.PointOnSurface()
        iz_kod, iz_opis = tocniji_kod(t, prije, iz_kod, iz_opis)
        u_kod, u_opis = tocniji_kod(t, poslije, u_kod, u_opis)
        if iz_kod == u_kod:
            continue  # boja se promijenila, stvarna namjena nije
        # I pripis stavke traži metre, pa ide prije prebacivanja u 4326.
        stavka = pripisi_stavku(g, u_kod, poslije.get("stavke_oznake", []))
        g.Transform(tr)
        kljuc = f"{iz_kod} → {u_kod}"
        zbroj[kljuc] = zbroj.get(kljuc, 0) + p
        znacajke.append({
            "type": "Feature",
            "properties": {
                "od_godine": prije["godina"], "do_godine": poslije["godina"],
                "promjena": kljuc, "iz_kod": iz_kod, "iz_namjena": iz_opis,
                "u_kod": u_kod, "u_namjena": u_opis, "boja": boja,
                "povrsina_m2": round(p),
                "stavka": stavka,
                "stavka_tekst": STAVKE[stavka][1] if stavka else None,
            },
            "geometry": json.loads(g.ExportToJson()),
        })
    del mem
    znacajke.sort(key=lambda f: -f["properties"]["povrsina_m2"])
    # Uz šifre nosimo i čitljiva imena — "Z5 → M1" stanaru ne znači ništa.
    imena: dict[str, dict] = {}
    for f in znacajke:
        q = f["properties"]
        st = imena.setdefault(q["promjena"], {
            "iz_kod": q["iz_kod"], "u_kod": q["u_kod"],
            "iz": kratko(q["iz_kod"]), "u": kratko(q["u_kod"]), "ha": 0.0,
        })
        st["ha"] += q["povrsina_m2"] / 1e4
    promjene = sorted(imena.values(), key=lambda x: -x["ha"])
    for x in promjene:
        x["ha"] = round(x["ha"], 1)
    # Zbroj po stavkama koje nacrt sam navodi — to je jedina podjela promjena
    # koju nismo mi izmislili, pa na /plan ide prije naših skupina.
    po_stavci: dict[str, dict] = {}
    for f in znacajke:
        q = f["properties"]
        if not q["stavka"]:
            continue
        st = po_stavci.setdefault(q["stavka"], {
            "broj": q["stavka"], "tekst": q["stavka_tekst"],
            "ha": 0.0, "ploha": 0, "promjene": {},
        })
        st["ha"] += q["povrsina_m2"] / 1e4
        st["ploha"] += 1
        st["promjene"][q["promjena"]] = round(
            st["promjene"].get(q["promjena"], 0) + q["povrsina_m2"] / 1e4, 1)
    stavke = sorted(po_stavci.values(),
                    key=lambda s: [int(d) for d in s["broj"].split(".")])
    for s in stavke:
        s["ha"] = round(s["ha"], 1)
    oznaka = f"gup-promjene-{prije['godina']}-{poslije['godina']}"
    sirovo = os.path.join(RAD, f"{oznaka}-sirovo.geojson")
    with open(sirovo, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": znacajke},
                  fh, ensure_ascii=False)
    put = pojednostavi(sirovo, os.path.join(OUT, f"{oznaka}.geojson"))
    return {"id": oznaka, "od_godine": prije["godina"],
            "do_godine": poslije["godina"], "ploha": len(znacajke),
            "mb": os.path.getsize(put) / 1e6,
            "promjene": promjene, "stavke": stavke,
            "ha_po_promjeni": {k: round(v / 1e4, 1) for k, v in
                               sorted(zbroj.items(), key=lambda t: -t[1])}}


def main() -> None:
    os.makedirs(RAD, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    izvjestaj: list[dict] = []
    gotovi: list[dict] = []
    for plan in PLANOVI:
        if not os.path.exists(plan["pdf"]):
            print(f"  ! preskačem {plan['id']}: nema {plan['pdf']}")
            continue
        print(f"  · {plan['id']} …")
        rgb, ishodiste = renderiraj(plan)
        tamno = rgb.astype(np.int32).sum(axis=2) < 360  # natpisi i pune crte
        klase = na_mrezu(popuni(klasificiraj(rgb), tamno), ishodiste, plan)
        udio = (klase > 0).mean() * 100
        print(f"    raster {rgb.shape[1]}×{rgb.shape[0]} px, klasificirano {udio:.0f}%")
        oznake = procitaj_oznake(rgb, ishodiste, plan)
        print(f"    pročitano {len(oznake)} oznaka namjene")
        plan["stavke_oznake"] = procitaj_stavke(plan)
        if plan["stavke_oznake"]:
            print(f"    {len(plan['stavke_oznake'])} oznaka stavki izmjena")
        mem, sloj = poligoniziraj(klase)
        r = izvezi(sloj, plan, oznake)
        del mem
        print(f"    {r['ploha']} ploha, {r['mb']:.1f} MB")
        print(f"    ha po klasi: {r['po_klasi']}")
        plan["raster"] = klase
        gotovi.append(plan)
        izvjestaj.append({"id": plan["id"], "godina": plan["godina"],
                          "naziv": plan["naziv"],
                          "pokriveno_3765": plan["pokriveno"],
                          "kvart_3765": list(KVART_3765), **r})

    razlike = []
    for plan in gotovi:
        plan["plohe"] = ucitaj_plohe(plan)
    for prije, poslije in zip(gotovi, gotovi[1:]):
        print(f"  · razlika {prije['godina']} → {poslije['godina']} …")
        d = razlika(prije, poslije)
        razlike.append(d)
        print(f"    {d['ploha']} ploha, {d['mb']:.1f} MB")
        print(f"    ha po promjeni: {d['ha_po_promjeni']}")

    with open(os.path.join(OUT, "_namjena.json"), "w", encoding="utf-8") as fh:
        json.dump({"godine": izvjestaj, "razlike": razlike},
                  fh, ensure_ascii=False, indent=1)
    print(f"\n{len(izvjestaj)} sloja + {len(razlike)} razlike u {OUT}")


if __name__ == "__main__":
    sys.exit(main())
