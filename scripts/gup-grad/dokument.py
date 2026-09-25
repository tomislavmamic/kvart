#!/usr/bin/env python3
"""GUP Splita kao dokument: tekst odredbi i kartografski prikazi za /gup/dokument.

Tekstualni dio. Svaki izvor je jedan objavljeni PDF (Službeni glasnik ili
prijedlog za javnu raspravu). Iz njega se čita tekst po stranicama, u
redoslijedu čitanja (glasnik je u dva stupca, a redoslijed u samom PDF-u
nije redoslijed čitanja), i slaže u blokove: naslov, članak, odlomak,
stavka popisa. Tablice se ne prepisuju nego izrežu kao slika stranice —
prepisane su nečitljive, a slika je ono što piše. Izlaz:
  data/gup-grad/dokument/<id>.json      blokovi s brojem stranice
  public/gup/dokument/<id>/*.webp       isječci tablica

Grafički dio. Svaki list (1:10 000, ~1,7 × 0,5 m) renderira se na 150 dpi —
toliko da se čitaju oznake zona (M1, D5, Z5) — i reže u piramidu pločica:
  public/gup/listovi/<id>/<z>/<x>_<y>.avif
  data/gup-grad/dokument/listovi.json   veličina, razine i uklapanje svakog lista
AVIF, a ne WebP: 20 listova je ~40 MB umjesto ~83 MB, uz jednako čitak
tekst legende (preglednici ga podržavaju od 2020.–2023.; Safari od 16.4).

Tekst se ne ispravlja, osim pogrešnog kodiranja slova u izvorniku (ñ → đ u
glasnicima 2006./2008., Ɵ → ti u prijedlogu 2025.) — oba su greška fonta,
ne teksta, i u PDF-u se na zaslonu vide ispravno.

Pokretanje:
  python3 scripts/gup-grad/dokument.py tekst      # samo tekst
  python3 scripts/gup-grad/dokument.py listovi    # samo listovi
  python3 scripts/gup-grad/dokument.py            # oboje (npm run gup-grad:dokument)
Traži: PyMuPDF, Pillow (s WebP-om).
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import sys
import urllib.request

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "data", "sources", "planovi")
IZLAZ = os.path.join(ROOT, "data", "gup-grad", "dokument")
JAVNO_TEKST = os.path.join(ROOT, "public", "gup", "dokument")
JAVNO_LISTOVI = os.path.join(ROOT, "public", "gup", "listovi")

DL = "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId={id}&Command=Core_Download"
PONOVNA = ("https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti"
           "%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/")

# Tekstualni izvori. `od` je prva stranica s tekstom (prva je naslovnica sa
# sadržajem broja glasnika); `stupci` je raspored sloga.
DOKUMENTI = [
    {
        "id": "1-06",
        "pdf": "3181.pdf",
        "url": DL.format(id=3181),
        "naslov": "Odluka o donošenju Generalnog urbanističkog plana Splita",
        "izvor": "Službeni glasnik Grada Splita 1/06, 25. siječnja 2006.",
        "kratko": "Sl. gl. 1/06",
        "stupci": 2,
        "od": 2,
    },
    {
        "id": "3-08",
        "pdf": "3183.pdf",
        "url": DL.format(id=3183),
        "naslov": "Odluka o donošenju Izmjena i dopuna Odluke o donošenju Generalnog urbanističkog plana Splita",
        "izvor": "Službeni glasnik Grada Splita 3/08, 25. siječnja 2008.",
        "kratko": "Sl. gl. 3/08",
        "stupci": 2,
        "od": 2,
    },
    {
        "id": "55-14",
        "pdf": "6130.pdf",
        "url": DL.format(id=6130),
        "naslov": "Odredbe za provođenje i Grafički dio Generalnog urbanističkog plana Splita – pročišćeni tekst",
        "izvor": "Službeni glasnik Grada Splita 55/14, 28. studenoga 2014.",
        "kratko": "Sl. gl. 55/14",
        "stupci": 2,
        "od": 2,
    },
    {
        "id": "prijedlog-2025",
        "pdf": "odredbe-2025.pdf",
        "url": PONOVNA + "1_%20Odredbe%20za%20provedbu.pdf",
        "naslov": "Odredbe za provedbu – prijedlog Izmjena i dopuna GUP-a Splita za ponovnu javnu raspravu",
        "izvor": "Grad Split, travanj 2025. (prijedlog, nije donesen)",
        "kratko": "Prijedlog 2025.",
        "stupci": 1,
        "od": 1,
    },
]

# Kartografski prikazi. Isti list često vrijedi za više izdanja (2008. listovi
# infrastrukture ostali su na snazi i u pročišćenom tekstu), pa se svaki
# renderira jednom; koje izdanje koristi koji list piše src/lib/gup-dokument/izdanja.ts.
LISTOVI = [
    {"id": "namjena-2008", "pdf": "3170.pdf", "url": DL.format(id=3170), "naslov": "1. Korištenje i namjena prostora",
     "izvor": "Izmjene i dopune GUP-a, Sl. gl. 3/08"},
    {"id": "namjena-2014", "pdf": "3196.pdf", "url": DL.format(id=3196), "naslov": "1. Korištenje i namjena prostora",
     "izvor": "Neslužbeni pročišćeni kartografski prikaz, 2014."},
    {"id": "djelatnosti-2008", "pdf": "3171.pdf", "url": DL.format(id=3171), "naslov": "2. Mreža gospodarskih i društvenih djelatnosti",
     "izvor": "Izmjene i dopune GUP-a, Sl. gl. 3/08"},
    {"id": "promet-2008", "pdf": "3172.pdf", "url": DL.format(id=3172), "naslov": "3.a Promet",
     "izvor": "Izmjene i dopune GUP-a, Sl. gl. 3/08"},
    {"id": "telekomunikacije-2006", "pdf": "3173.pdf", "url": DL.format(id=3173), "naslov": "3.b Pošta i telekomunikacije",
     "izvor": "GUP, Sl. gl. 1/06"},
    {"id": "energetika-2008", "pdf": "3174.pdf", "url": DL.format(id=3174), "naslov": "3.c Energetski sustav",
     "izvor": "Izmjene i dopune GUP-a, Sl. gl. 3/08"},
    {"id": "vodoopskrba-2006", "pdf": "3176.pdf", "url": DL.format(id=3176), "naslov": "3.d Vodnogospodarski sustav – vodoopskrba",
     "izvor": "GUP, Sl. gl. 1/06"},
    {"id": "odvodnja-2006", "pdf": "3175.pdf", "url": DL.format(id=3175), "naslov": "3.e Vodnogospodarski sustav – odvodnja otpadnih voda",
     "izvor": "GUP, Sl. gl. 1/06"},
    {"id": "uvjeti-koristenja-2012", "pdf": "3177.pdf", "url": DL.format(id=3177), "naslov": "4.a Uvjeti korištenja",
     "izvor": "Ciljane izmjene i dopune GUP-a, Sl. gl. 3/12"},
    {"id": "urbana-pravila-2012", "pdf": "3178.pdf", "url": DL.format(id=3178), "naslov": "4.b Urbana pravila",
     "izvor": "Ciljane izmjene i dopune GUP-a, Sl. gl. 3/12"},
    {"id": "urbana-pravila-2014", "pdf": "3197.pdf", "url": DL.format(id=3197), "naslov": "4.b Urbana pravila",
     "izvor": "Neslužbeni pročišćeni kartografski prikaz, 2014."},
    {"id": "detaljniji-planovi-2008", "pdf": "3179.pdf", "url": DL.format(id=3179), "naslov": "4.c Područja i dijelovi primjene planskih mjera zaštite – obuhvat detaljnijih planova",
     "izvor": "Izmjene i dopune GUP-a, Sl. gl. 3/08"},
    {"id": "vazeci-planovi-2008", "pdf": "3180.pdf", "url": DL.format(id=3180), "naslov": "4.d Područja i dijelovi primjene planskih mjera zaštite – važeći planovi",
     "izvor": "Izmjene i dopune GUP-a, Sl. gl. 3/08"},
    {"id": "vazeci-planovi-2014", "pdf": "3198.pdf", "url": DL.format(id=3198), "naslov": "4.d Područja i dijelovi primjene planskih mjera zaštite – važeći planovi",
     "izvor": "Neslužbeni pročišćeni kartografski prikaz, stanje 28. 11. 2014."},
    {"id": "namjena-2025", "pdf": "2025.pdf", "url": PONOVNA + "1_%20Koristenje%20i%20namjena%20prostora.pdf",
     "naslov": "1. Korištenje i namjena prostora", "izvor": "Prijedlog ID GUP-a za ponovnu javnu raspravu, travanj 2025."},
    {"id": "djelatnosti-2025", "pdf": "2025-2.pdf", "url": PONOVNA + "2_%20Mreza%20gospodarskih%20i%20drustvenih%20djelatnosti.pdf",
     "naslov": "2. Mreža gospodarskih i društvenih djelatnosti", "izvor": "Prijedlog ID GUP-a za ponovnu javnu raspravu, travanj 2025."},
    {"id": "promet-2025", "pdf": "2025-3a.pdf", "url": PONOVNA + "3_a%20Promet.pdf",
     "naslov": "3.a Promet", "izvor": "Prijedlog ID GUP-a za ponovnu javnu raspravu, travanj 2025."},
    {"id": "energetika-2025", "pdf": "2025-3c.pdf", "url": PONOVNA + "3_c%20Energetski%20sustav.pdf",
     "naslov": "3.c Energetski sustav", "izvor": "Prijedlog ID GUP-a za ponovnu javnu raspravu, travanj 2025."},
    {"id": "urbana-pravila-2025", "pdf": "up-2025.pdf", "url": PONOVNA + "4_c%20Urbana%20pravila.pdf",
     "naslov": "4.c Urbana pravila", "izvor": "Prijedlog ID GUP-a za ponovnu javnu raspravu, travanj 2025."},
    {"id": "planske-mjere-2025", "pdf": "pr-2025.pdf", "url": PONOVNA + "4_d%20Podrucja%20i%20dijelovi%20primjene%20planskih%20mjera%20zastite.pdf",
     "naslov": "4.d Područja i dijelovi primjene planskih mjera zaštite", "izvor": "Prijedlog ID GUP-a za ponovnu javnu raspravu, travanj 2025."},
]

DPI_LISTA = 150
PLOCICA = 512

# Uklapanje lista u HTRS96/TM, po planu iz rasteriziraj.py (PLANOVI): isto
# uklapanje kojim su izmjerene namjena, urbana pravila i planski režim, pa
# isječak lista oko čestice pokazuje baš ono što je izračun pročitao. Ostali
# listovi (promet, infrastruktura…) crtani su na istom predlošku, ali njihovo
# uklapanje nije provjereno, pa ga nemaju.
UKLAPANJE = {
    "namjena-2008": "gup-2006", "detaljniji-planovi-2008": "gup-2006", "vazeci-planovi-2008": "gup-2006",
    "namjena-2014": "gup-2015", "urbana-pravila-2014": "gup-2015", "vazeci-planovi-2014": "gup-2015",
    "urbana-pravila-2012": "gup-2015",
    "namjena-2025": "gup-2025", "urbana-pravila-2025": "gup-2025", "planske-mjere-2025": "gup-2025",
}


def planovi_uklapanja() -> dict[str, dict]:
    import importlib.util
    spec = importlib.util.spec_from_file_location("rasteriziraj", os.path.join(os.path.dirname(os.path.abspath(__file__)), "rasteriziraj.py"))
    r = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r)  # type: ignore
    return {p["id"]: p for p in r.PLANOVI}


def afina_uklapanja(plan: dict, sirina_pt: float, visina_pt: float) -> list[float]:
    """HTRS96 (E, N) → udio lista (x, y): x = a·E + b·N + c, y = d·E + e·N + f.

    Isto kao rasteriziraj.na_rescetku: pomak (ox, oy), zakret, mjerilo sc m/pt,
    y lista ide od vrha stranice."""
    import math
    sc, ox, oy = plan["afin"]
    r = math.radians(plan.get("zakret", 0.0))
    c, s_ = math.cos(r), math.sin(r)
    a, b = c / (sc * sirina_pt), s_ / (sc * sirina_pt)
    d, e = s_ / (sc * visina_pt), -c / (sc * visina_pt)
    return [a, b, -(a * ox + b * oy), d, e, 1 - (d * ox + e * oy)]


def preuzmi(ime: str, url: str) -> str:
    put = os.path.join(SRC, ime)
    if os.path.exists(put):
        return put
    os.makedirs(SRC, exist_ok=True)
    print(f"  preuzimam {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (kvart gup-dokument)", "Referer": "https://split.hr/"})
    with urllib.request.urlopen(req, timeout=600) as r, open(put + ".tmp", "wb") as f:
        f.write(r.read())
    os.replace(put + ".tmp", put)
    return put


# ---------------------------------------------------------------- tekst

# Pogrešno kodirana slova: glasnici 2006. i 2008. imaju „ñ” umjesto „đ”
# (i „Ñ” umjesto „Đ”), prijedlog 2025. „Ɵ” umjesto ligature „ti”.
ZAMJENE = [("ñ", "đ"), ("Ñ", "Đ"), ("Ɵ", "ti"), ("ﬁ", "fi"), ("ﬂ", "fl"), ("­", "")]
# Oznake stavki popisa: „■” (55/14, dvostruko), „\x01” (1/06, 3/08), „” i „” (2025.), „•”.
OZNAKE = "■\x01•▪◦–"
OZNAKA_RE = re.compile(r"^[■\x01•▪◦](\s*[■\x01•▪◦])*\s*")
CLANAK_RE = re.compile(r"^„?\s*Članak\s*(\d+)\s*\.?\s*([a-z])?\s*\.?\s*$")
BROJ_NASLOVA_RE = re.compile(r"^((?:\d+\.)+\d*\.?)\s")
NABRAJANJE_RE = re.compile(r"^(\(\d+[a-z]?\)|\d+[a-z]?\.\s+[A-ZČĆŽŠĐ„]|[a-z]\)\s|[−–-]\s)")


def popravi(t: str) -> str:
    for a, b in ZAMJENE:
        t = t.replace(a, b)
    return t


class Redak:
    __slots__ = ("x0", "y0", "x1", "y1", "tekst", "bold", "vel", "oznaka", "stupac", "osnovica", "prefiks")

    def __init__(self, x0, y0, x1, y1, tekst, bold, vel, osnovica, prefiks=""):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.tekst, self.bold, self.vel = tekst, bold, vel
        # podebljani početak retka koji nije sav podebljan: kraj naslova u dva
        # retka („Vrijedno pejsažno zelenilo s postojećim / građevinama – Z6”)
        self.prefiks = prefiks
        self.oznaka = False
        self.stupac = 0
        # osnovica prvog raspona pune veličine: eksponent (m²) podiže okvir
        # retka, pa bi ga razvrstavanje po okviru stavilo ispred retka
        self.osnovica = osnovica


def tekst_retka(spans: list[dict], osnovna: float) -> tuple[str, bool, str]:
    """Spoji raspone retka: indeksi (k_ig) bez razmaka, eksponent m2 → m².
    Vraća i podebljani početak retka (prazan ako je redak sav ili nimalo podebljan)."""
    dijelovi: list[str] = []
    bold_znakova = 0
    znakova = 0
    for s in spans:
        t = popravi(s["text"])
        if not t:
            continue
        malo = s["size"] < osnovna * 0.75
        if malo and s["flags"] & 1 and t.strip() in ("2", "3"):
            prije = "".join(dijelovi).rstrip()
            if prije.endswith("m"):
                dijelovi = [prije + ("²" if t.strip() == "2" else "³")]
                if t.endswith(" "):
                    dijelovi.append(" ")
                continue
        dijelovi.append(t)
        if t.strip():
            znakova += len(t.strip())
            if s["flags"] & 16 or "Bold" in s["font"]:
                bold_znakova += len(t.strip())
    tekst = "".join(dijelovi)
    prefiks = ""
    for sp in spans:
        if not sp["text"].strip():
            prefiks += sp["text"]
            continue
        if sp["flags"] & 16 or "Bold" in sp["font"]:
            prefiks += popravi(sp["text"])
        else:
            break
    sav = znakova > 0 and bold_znakova / znakova > 0.8
    if sav or not prefiks.strip() or not tekst.startswith(prefiks):
        prefiks = ""
    return tekst, sav, prefiks


def retci_stranice(p, cfg) -> tuple[list[Redak], list[tuple]]:
    """Retci teksta bez zaglavlja i podnožja, i okviri tablica."""
    W, H = p.rect.width, p.rect.height
    tablice = []
    try:
        for t in p.find_tables().tables:
            x0, y0, x1, y1 = t.bbox
            if (x1 - x0) > 120 and (y1 - y0) > 30 and t.row_count >= 2 and t.col_count >= 2:
                tablice.append((x0, y0, x1, y1, t))
    except Exception:  # pragma: no cover - tablica je samo pomoć
        pass

    d = p.get_text("dict")
    # osnovna veličina slova: najčešća na stranici
    vel: dict[float, int] = {}
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                vel[round(s["size"], 1)] = vel.get(round(s["size"], 1), 0) + len(s["text"])
    osnovna = max(vel, key=vel.get) if vel else 10.0

    retci: list[Redak] = []
    for b in d["blocks"]:
        for l in b.get("lines", []):
            x0, y0, x1, y1 = l["bbox"]
            # zaglavlje i podnožje stranice
            if cfg["stupci"] == 2 and y1 < 62:
                continue
            if cfg["stupci"] == 1 and (y1 < 46 or y0 > 812):
                continue
            if any(tx0 - 2 <= (x0 + x1) / 2 <= tx1 + 2 and ty0 - 2 <= (y0 + y1) / 2 <= ty1 + 2 for tx0, ty0, tx1, ty1, _ in tablice):
                continue
            tekst, bold, prefiks = tekst_retka(l["spans"], osnovna)
            if not tekst.strip():
                continue
            if l["dir"][0] < 0.9:  # okomit tekst (margine tablica)
                continue
            puni = [s for s in l["spans"] if s["size"] >= osnovna * 0.75 and s["text"].strip()]
            osnovica = puni[0]["origin"][1] if puni else y1
            retci.append(Redak(x0, y0, x1, y1, tekst, bold, osnovna, osnovica, prefiks))
    return retci, tablice


def spoji_retke_iste_visine(retci: list[Redak]) -> list[Redak]:
    """Oznaka „■” i tekst stavke, i svaka riječ poravnatog retka u glasniku
    2006., u PDF-u su odvojeni retci na istoj osnovici."""
    retci = sorted(retci, key=lambda r: (r.stupac, r.osnovica, r.x0))
    skupine: list[list[Redak]] = []
    for r in retci:
        if skupine and skupine[-1][0].stupac == r.stupac and abs(skupine[-1][0].osnovica - r.osnovica) < 2.5:
            skupine[-1].append(r)
        else:
            skupine.append([r])
    retci = [r for sk in skupine for r in sorted(sk, key=lambda r: r.x0)]
    out: list[Redak] = []
    for r in retci:
        if out:
            z = out[-1]
            if z.stupac == r.stupac and abs(z.osnovica - r.osnovica) < 2.5 and r.x0 >= z.x0 - 1:
                razmak = "" if z.tekst.endswith((" ", "\t")) else " "
                if z.bold and not r.bold:
                    # podebljani dio retka, pa obični: „građevinama – Z6” + „ je dijelom…”
                    z.prefiks = z.tekst
                elif z.prefiks and not r.bold:
                    pass
                elif not z.bold:
                    z.prefiks = z.prefiks if z.prefiks and z.prefiks == z.tekst[: len(z.prefiks)] else ""
                z.tekst = z.tekst + razmak + r.tekst
                z.x1 = max(z.x1, r.x1)
                z.y0, z.y1 = min(z.y0, r.y0), max(z.y1, r.y1)
                z.bold = z.bold and r.bold
                continue
        out.append(r)
    return out


def razvrstaj_stupce(retci: list[Redak], tablice, W: float, stupci: int):
    """Redoslijed čitanja: pojasevi odijeljeni sadržajem preko cijele širine,
    unutar pojasa lijevi pa desni stupac. Vraća popis ('r', redak) i ('t', tablica)."""
    sredina = W / 2
    stavke = []
    for r in retci:
        if stupci == 1:
            r.stupac = 0
        elif r.x1 <= sredina + 12:
            r.stupac = 0
        elif r.x0 >= sredina - 12:
            r.stupac = 1
        else:
            r.stupac = -1
    retci = spoji_retke_iste_visine(retci)
    for r in retci:
        stavke.append(("r", r.stupac, r.y0, r))
    for (x0, y0, x1, y1, t) in tablice:
        st = 0 if stupci == 1 else (0 if x1 <= sredina + 12 else (1 if x0 >= sredina - 12 else -1))
        stavke.append(("t", st, y0, (x0, y0, x1, y1, t)))
    if stupci == 1:
        return [(v, o) for v, _, _, o in sorted(stavke, key=lambda s: s[2])]
    siroke = sorted(s[2] for s in stavke if s[1] == -1)
    granice = [-1.0] + siroke + [1e9]
    out = []
    for i in range(len(granice) - 1):
        a, b = granice[i], granice[i + 1]
        pojas = [s for s in stavke if a <= s[2] < b]
        sirok = [s for s in pojas if s[1] == -1 and s[2] == a]
        for s in sirok:
            out.append((s[0], s[3]))
        for st in (0, 1):
            for s in sorted((s for s in pojas if s[1] == st), key=lambda s: s[2]):
                out.append((s[0], s[3]))
    return out


def lijevi_rub(retci: list[Redak], stupac: int) -> float:
    xs = sorted(r.x0 for r in retci if r.stupac == stupac)
    if not xs:
        return 0.0
    # najčešći lijevi rub (s tolerancijom) je rub stupca
    hist: dict[int, int] = {}
    for x in xs:
        hist[round(x)] = hist.get(round(x), 0) + 1
    return float(max(hist, key=lambda k: (hist[k], -k)))


def je_naslov(r: Redak) -> bool:
    t = r.tekst.strip()
    return r.bold and len(t) < 200 and not t.endswith((",", ";"))


def blokovi_dokumenta(cfg: dict) -> tuple[list[dict], list[dict]]:
    put = preuzmi(cfg["pdf"], cfg["url"])
    doc = pymupdf.open(put)
    blokovi: list[dict] = []
    slike: list[dict] = []
    mapa_slika = os.path.join(JAVNO_TEKST, cfg["id"])
    shutil.rmtree(mapa_slika, ignore_errors=True)
    os.makedirs(mapa_slika, exist_ok=True)

    tekuci: dict | None = None  # odlomak koji se još puni
    zadnji_y = None
    zadnji_stupac = None
    visina_retka = 12.0

    def zatvori():
        nonlocal tekuci
        if tekuci is not None:
            tekuci["t"] = re.sub(r"[ \t]+", " ", tekuci["t"]).strip()
            if tekuci["t"]:
                blokovi.append(tekuci)
        tekuci = None

    for i in range(cfg["od"] - 1, doc.page_count):
        p = doc[i]
        stranica = i + 1
        retci, tablice = retci_stranice(p, cfg)
        redoslijed = razvrstaj_stupce(retci, tablice, p.rect.width, cfg["stupci"])
        rubovi = {s: lijevi_rub([r for v, r in redoslijed if v == "r"], s) for s in (-1, 0, 1)}
        n = 0
        prvi_na_stranici = True
        zadnji_y = None
        for vrsta, o in redoslijed:
            if vrsta == "t":
                zatvori()
                x0, y0, x1, y1, t = o
                ime = f"s{stranica}-{n}.webp"
                pix = p.get_pixmap(matrix=pymupdf.Matrix(2.5, 2.5), clip=pymupdf.Rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3), alpha=False)
                im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                im.save(os.path.join(mapa_slika, ime), "WEBP", quality=82, method=6)
                redovi = []
                for red in t.extract():
                    celije = [popravi(re.sub(r"\s+", " ", c or "")).strip() for c in red]
                    celije = [c for c in celije if c]
                    if celije:
                        redovi.append(" | ".join(celije))
                blokovi.append({
                    "id": f"s{stranica}-{n}", "s": stranica, "v": "tab",
                    "src": f"/gup/dokument/{cfg['id']}/{ime}", "w": im.width, "h": im.height,
                    "t": "\n".join(redovi),
                })
                n += 1
                prvi_na_stranici = False
                zadnji_y = y1
                zadnji_stupac = None
                continue
            r: Redak = o
            tekst = r.tekst
            oznaka = bool(OZNAKA_RE.match(tekst.lstrip()))
            if oznaka:
                tekst = OZNAKA_RE.sub("", tekst.lstrip())
            ciste = tekst.strip()
            rub = rubovi.get(r.stupac, 0.0)
            novi_stupac = zadnji_stupac is not None and r.stupac != zadnji_stupac
            razmak = zadnji_y is not None and not novi_stupac and (r.y0 - zadnji_y) > visina_retka * 0.55
            if cfg["stupci"] == 2:
                # glasnik: novi odlomak počinje uvlakom prvog retka
                uvuceno = r.x0 > rub + 5
            else:
                # prijedlog 2025. (Word): stavke „1.”, „(2)”, „a)” i „−” imaju
                # viseću uvlaku, pa uvlaka ne znači novi odlomak — znači ga
                # nabrajanje na početku retka iza završenog prethodnog retka
                pret = (tekuci or {}).get("t", "").rstrip()
                uvuceno = bool(NABRAJANJE_RE.match(ciste)) and (
                    not pret or (tekuci or {}).get("v") == "n" or pret.endswith((".", ":", ";", ",", "“", "\"", ")")))
                # „2. izgrađeni…” iza „1. neuređeni…”: stavke bez interpunkcije na kraju
                # prepoznaju se po broju koji slijedi broj tekuće stavke
                m_br = re.match(r"^(\d+)\.\s", ciste)
                m_pret = re.match(r"^„?(\d+)\.\s", pret)
                if m_br and m_pret and int(m_br.group(1)) == int(m_pret.group(1)) + 1:
                    uvuceno = True
                if uvuceno and ciste[:1] in "−–-":
                    ciste = ciste[1:].strip()
                    oznaka = True
            if (r.prefiks and not r.bold and tekuci is not None and tekuci["v"] == "n" and not razmak
                    and not novi_stupac and not tekuci["t"].rstrip().endswith((".", ":", ";"))):
                tekuci["t"] += " " + r.prefiks.strip()
                ciste = tekst[len(r.prefiks):].strip() if tekst.startswith(r.prefiks) else ciste
                zatvori()
                if not ciste:
                    zadnji_y, zadnji_stupac = r.y1, r.stupac
                    continue
                tekuci = {"id": f"s{stranica}-{n}", "s": stranica, "v": "p", "t": ciste}
                n += 1
                zadnji_y, zadnji_stupac = r.y1, r.stupac
                prvi_na_stranici = False
                continue
            m_cl = CLANAK_RE.match(ciste)

            if m_cl:
                zatvori()
                broj = m_cl.group(1) + ("." + m_cl.group(2) if m_cl.group(2) else "")
                blokovi.append({"id": f"s{stranica}-{n}", "s": stranica, "v": "cl", "t": ciste.lstrip("„ ").replace("Članak", "Članak ").replace("  ", " "), "cl": broj})
                n += 1
            elif je_naslov(r) and not oznaka:
                if tekuci is not None and tekuci["v"] == "n" and not razmak and not novi_stupac:
                    tekuci["t"] += " " + ciste
                else:
                    zatvori()
                    tekuci = {"id": f"s{stranica}-{n}", "s": stranica, "v": "n", "t": ciste}
                    n += 1
            else:
                nastavak = tekuci is not None and tekuci["v"] in ("p", "li") and not oznaka and not uvuceno and not razmak
                # nastavak odlomka s prethodnog stupca ili stranice: retci na rubu
                # stupca bez uvlake, a prethodni odlomak nije završio rečenicu
                if tekuci is None and blokovi and blokovi[-1]["v"] in ("p", "li") and not oznaka and not uvuceno \
                        and (prvi_na_stranici or novi_stupac) and not blokovi[-1]["t"].rstrip().endswith((".", ":", ";", "“", "\"")):
                    nastavak = True
                    tekuci = {"id": f"s{stranica}-{n}", "s": stranica, "v": blokovi[-1]["v"], "t": "", "nast": True}
                    n += 1
                elif novi_stupac and not prvi_na_stranici and tekuci is not None and tekuci["v"] in ("p", "li") \
                        and not oznaka and not uvuceno and not tekuci["t"].rstrip().endswith((".", ":", ";")):
                    # drugi stupac iste stranice: isti odlomak, bez novog bloka
                    nastavak = True
                elif prvi_na_stranici and tekuci is not None and not oznaka and not uvuceno \
                        and not tekuci["t"].rstrip().endswith((".", ":", ";")):
                    # nova stranica: nastavak je zaseban blok, jer blok nosi broj stranice
                    v = tekuci["v"]
                    zatvori()
                    tekuci = {"id": f"s{stranica}-{n}", "s": stranica, "v": v, "t": "", "nast": True}
                    n += 1
                    nastavak = True
                if nastavak:
                    pret = tekuci["t"]
                    if pret.endswith("-") and not pret.endswith(" -") and ciste[:1].islower():
                        tekuci["t"] = pret + ciste
                    else:
                        tekuci["t"] = (pret + " " + ciste) if pret else ciste
                else:
                    zatvori()
                    tekuci = {"id": f"s{stranica}-{n}", "s": stranica, "v": "li" if oznaka else "p", "t": ciste}
                    n += 1
            zadnji_y = r.y1
            zadnji_stupac = r.stupac
            visina_retka = max(9.0, min(16.0, r.y1 - r.y0))
            prvi_na_stranici = False
        zatvori()
    zatvori()
    return blokovi, slike


def razine_naslova(blokovi: list[dict]) -> None:
    """Razina naslova po broju (1. → 1, 8.3.1.4. → 4); nenumerirani su 5."""
    for b in blokovi:
        if b["v"] != "n":
            continue
        m = BROJ_NASLOVA_RE.match(b["t"] + " ")
        if m:
            r = len([x for x in m.group(1).split(".") if x])
            # „4. Gospodarska namjena” u tumaču znakova (čl. 7) i „1. Osnovni
            # pojmovi” u pojmovniku su podnaslovi; poglavlja prvog reda
            # glasnik piše velikim slovima („1. UVJETI ZA RAZGRANIČAVANJE…”)
            b["r"] = 5 if r == 1 and not b["t"].isupper() else min(4, r)
        elif b["t"].isupper() and len(b["t"]) > 6:
            b["r"] = 1
        else:
            b["r"] = 5


def sidra(blokovi: list[dict]) -> None:
    """Sidro članka (cl-53, cl-49-i); ponovljeni broj (izmjena citira članak) dobiva -2, -3…"""
    vidjeno: dict[str, int] = {}
    for b in blokovi:
        if b["v"] != "cl":
            continue
        osnova = "cl-" + b["cl"].replace(".", "-")
        vidjeno[osnova] = vidjeno.get(osnova, 0) + 1
        b["a"] = osnova if vidjeno[osnova] == 1 else f"{osnova}-{vidjeno[osnova]}"


def tekst() -> None:
    os.makedirs(IZLAZ, exist_ok=True)
    for cfg in DOKUMENTI:
        blokovi, _ = blokovi_dokumenta(cfg)
        razine_naslova(blokovi)
        sidra(blokovi)
        doc = pymupdf.open(os.path.join(SRC, cfg["pdf"]))
        out = {
            "opis": "Izvedeno skriptom scripts/gup-grad/dokument.py iz izvornog PDF-a.",
            "id": cfg["id"],
            "naslov": cfg["naslov"],
            "izvor": cfg["izvor"],
            "kratko": cfg["kratko"],
            "url": cfg["url"],
            "stranica": doc.page_count,
            "blokovi": blokovi,
        }
        with open(os.path.join(IZLAZ, f"{cfg['id']}.json"), "w") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        vrste: dict[str, int] = {}
        for b in blokovi:
            vrste[b["v"]] = vrste.get(b["v"], 0) + 1
        print(cfg["id"], len(blokovi), "blokova", vrste, sum(len(b["t"]) for b in blokovi), "znakova")


# ---------------------------------------------------------------- listovi

def listovi() -> None:
    meta_put = os.path.join(IZLAZ, "listovi.json")
    meta = {"opis": "Izvedeno skriptom scripts/gup-grad/dokument.py.", "dpi": DPI_LISTA, "plocica": PLOCICA, "listovi": {}}
    if os.path.exists(meta_put):
        meta["listovi"] = json.load(open(meta_put)).get("listovi", {})
    samo = set(sys.argv[2:])
    for cfg in LISTOVI:
        if samo and cfg["id"] not in samo:
            continue
        put = preuzmi(cfg["pdf"], cfg["url"])
        p = pymupdf.open(put)[0]
        # MediaBox, ne CropBox: uklapanje (rasteriziraj.py) je mjereno na
        # MediaBoxu, a na pročišćenim listovima 2014. CropBox je uži i pomaknut
        p.set_cropbox(p.mediabox)
        pix = p.get_pixmap(matrix=pymupdf.Matrix(DPI_LISTA / 72, DPI_LISTA / 72), alpha=False)
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        del pix
        mapa = os.path.join(JAVNO_LISTOVI, cfg["id"])
        shutil.rmtree(mapa, ignore_errors=True)
        # z = najveća razina je puna rezolucija; svaka niža upola manja, do
        # razine na kojoj cijeli list stane u jednu pločicu
        maks = 0
        while max(im.width, im.height) / (2 ** maks) > PLOCICA:
            maks += 1
        ukupno = 0
        razina = im
        for z in range(maks, -1, -1):
            if z < maks:
                razina = razina.resize((max(1, razina.width // 2), max(1, razina.height // 2)), Image.LANCZOS)
            os.makedirs(os.path.join(mapa, str(z)), exist_ok=True)
            for y in range(0, razina.height, PLOCICA):
                for x in range(0, razina.width, PLOCICA):
                    b = io.BytesIO()
                    razina.crop((x, y, min(x + PLOCICA, razina.width), min(y + PLOCICA, razina.height))).save(b, "AVIF", quality=45, speed=6)
                    with open(os.path.join(mapa, str(z), f"{x // PLOCICA}_{y // PLOCICA}.avif"), "wb") as f:
                        f.write(b.getvalue())
                    ukupno += b.tell()
        # sličica za karticu lista
        sl = im.copy()
        sl.thumbnail((960, 960), Image.LANCZOS)
        sl.save(os.path.join(mapa, "slicica.webp"), "WEBP", quality=75, method=6)
        meta["listovi"][cfg["id"]] = {
            "naslov": cfg["naslov"], "izvor": cfg["izvor"], "url": cfg["url"],
            "sirina": im.width, "visina": im.height, "maksZum": maks,
            "slicica": {"sirina": sl.width, "visina": sl.height},
        }
        if cfg["id"] in UKLAPANJE:
            plan = planovi_uklapanja()[UKLAPANJE[cfg["id"]]]
            meta["listovi"][cfg["id"]]["uklapanje"] = afina_uklapanja(plan, p.rect.width, p.rect.height)
        print(f"{cfg['id']:8} {im.width}×{im.height} z0–{maks} {ukupno / 1e6:.1f} MB")
        del im, razina
    with open(meta_put, "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sto = sys.argv[1] if len(sys.argv) > 1 else "sve"
    if sto in ("tekst", "sve"):
        tekst()
    if sto in ("listovi", "sve"):
        listovi()
