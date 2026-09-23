#!/usr/bin/env python3
"""Plohe namjene GUP-a za CIJELI obuhvat plana, po godinama, kao rešetka klasa.

Sestra skripte `scripts/trace-plans.py`, koja isto radi samo za kvart i
vodi do poligona. Za gradsku infografiku poligoni nisu potrebni: površina
po namjeni je broj piksela, a presjek s katastrom se radi rasterizacijom
čestica na istu rešetku (`scripts/gup-grad/cestice.py`). Zato ovdje nema
GDAL-a — list se renderira PyMuPDF-om, razvrsta po boji i preslika na
zajedničku rešetku od 2 m u HTRS96/TM (EPSG:3765).

Uklapanje listova (mjerilo, pomak, zakret) preuzeto je iz trace-plans.py,
gdje je izmjereno mrežom veznih točaka prema ISPU rasteru. Tamo zapisana
nesigurnost za list 2008. (do desetak metara na rubovima) na gradskoj je
razini zanemariva za zbrojeve, ali se osjeti u presjeku s pojedinom
česticom — zato se u `cestice.py` čestica pripisuje namjeni po udjelu
piksela, a ne po jednoj točki.

Izlaz (u .cache/gup-grad/, nije u gitu):
  klase-<id>.npy     uint8, (H, W), 0 = izvan obuhvata, vidi KLASE
  pregled-<id>.png   obojeni pregled za oko
  mreza.json         geotransformacija rešetke

Pokretanje:  /opt/homebrew/bin/python3 scripts/gup-grad/rasteriziraj.py
Traži:       numpy, scipy, Pillow, PyMuPDF (pip install pymupdf)
"""
from __future__ import annotations

import json
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

try:
    import pymupdf
except ImportError:  # starije inačice
    import fitz as pymupdf  # type: ignore

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "data", "sources", "planovi", "gup-grad")
OUT = os.path.join(ROOT, ".cache", "gup-grad")

# Obuhvat ISPU sloja HR_ISPU_GUP1_04090_R07_KN_1_1, s 250 m zalihe.
MREZA_BBOX = (490280.0, 4816690.0, 503810.0, 4821970.0)
KORAK = 2.0  # m/px
W = int(round((MREZA_BBOX[2] - MREZA_BBOX[0]) / KORAK))
H = int(round((MREZA_BBOX[3] - MREZA_BBOX[1]) / KORAK))

# Klase rešetke. 1..14 su boje namjene s lista (paleta iz trace-plans.py
# i legende prijedloga 2025.), 15 je neobojeno unutar obuhvata: ulice, pruga, infrastrukturni
# koridori (šrafirano sivo) — plan ih ne boji namjenom, ali su dio obuhvata.
PALETA: list[tuple[str, str, str]] = [
    ("#ffff00", "S", "Stambena namjena"),
    ("#e0a000", "M/K5", "Mješovita namjena (M) i poslovna sa stanovanjem (K5)"),
    ("#f46040", "D", "Javna i društvena namjena"),
    ("#a02080", "I/K", "Gospodarska (I) i poslovna namjena (K)"),
    ("#c02000", "T", "Ugostiteljsko-turistička namjena"),
    ("#20a0c0", "L", "Luke posebne namjene"),
    ("#006000", "R1", "Športski centar"),
    ("#c0e080", "R2", "Rekreacija"),
    ("#40c0c0", "R3", "Kupalište"),
    ("#40c040", "Z1", "Javne zelene površine i park-šuma"),
    ("#80e000", "Z5", "Zaštitno i pejsažno zelenilo"),
    ("#a000c0", "N", "Posebna namjena"),
    # Klase koje uvodi tek prijedlog 2025. (legenda lista, uzorci očitani
    # iz renderiranih kvadratića): prirodna plaža i golf izvan naselja.
    ("#3ec09b", "R4", "Prirodna plaža"),
    ("#7fff9f", "R5", "Golf — izdvojeno građevinsko područje"),
]
KLASA_PROMET = len(PALETA) + 1
MORE = 255  # privremena oznaka šrafure akvatorija (#00c0ff na bijelom)
MAMCI = ["#ff0000", "#000000", "#ffffff", "#808080", "#dbdbdb"]
NAJVECI_RAZMAK = 90.0
NAJMANJA_POKRIVENOST = 0.35  # šrafura rjeđa od toga je bijelo s crtama, ne ploha
NAJMANJA_ZASICENOST = 30
TON_TOLERANCIJA = 22.0  # °; M (43°) i R2 (80°) moraju ostati razdvojeni

# Na 2 m/px okvir popune je upola manji nego na 1 m/px u trace-plans.py.
RADIJUS_POPUNE = 2
PRAG_POPUNE = 8
PROLAZA_POPUNE = 3
RADIJUS_TAMNO = 6
PRAG_TAMNO = int((2 * RADIJUS_TAMNO + 1) ** 2 * 0.30)
PROLAZA_TAMNO = 4
VECINA_PX = 9
SRAFURA_PX = 2
KRHOTINA_T_M2 = 10_000
CISTA_BOJA = 35.0
TEZINA_CISTE = 4.0
# Zatvaranje obuhvata: ulice i trgovi su prazni, a najšire (Poljička,
# Domovinskog rata s rampama) imaju do ~60 m. Radijus mora biti veći od
# pola najšire ulice, a manji od najužeg zaljeva mora koji plan ne pokriva.
ZATVARANJE_M = 45.0

DL = "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gis-podatci?EntryId={id}&Command=Core_Download"

PLANOVI: list[dict] = [
    {
        "id": "gup-2006",
        "godina": 2006,
        "naziv": "GUP Splita 2006. (Sl. gl. 1/06, s izmjenama 3/08)",
        "napomena": "Izvorni list iz 2006. nije objavljen zasebno; ovo je "
                    "list „Korištenje i namjena prostora” iz izmjena 2008. "
                    "(EntryId 3170 = 6298).",
        "pdf": "3170.pdf",
        "url": DL.format(id=3170),
        "afin": (3.527314871927, 490179.212119, 4816834.057698),
        "zakret": 1.031775498190,
    },
    {
        "id": "gup-2015",
        "godina": 2015,
        "naziv": "GUP Splita 2015. (pročišćeni tekst, Sl. gl. 55/14)",
        "napomena": "Neslužbeni pročišćeni kartografski prikaz 1. "
                    "Korištenje i namjena prostora (EntryId 3196).",
        "pdf": "3196.pdf",
        "url": DL.format(id=3196),
        "afin": (3.526990974768, 489883.608384, 4816744.109932),
        "zakret": 1.031092915839,
        "srafura": True,  # sitna šrafura na bijelom — vidi klasificiraj()
    },
    {
        "id": "gup-2025",
        "godina": 2025,
        "naziv": "GUP Splita 2025. (prijedlog izmjena i dopuna za ponovnu javnu raspravu)",
        "napomena": "Prijedlog iz travnja 2025.; do rujna 2026. nije donesen. "
                    "List 1. Korištenje i namjena prostora. Uklapanje: isti "
                    "CAD predložak kao nacrt 2024., provjereno skriptom "
                    "uklopi.py (82 % istih klasa s 2015.).",
        "pdf": "2025.pdf",
        "url": "https://split.hr/Portals/0/Dokumenti/Prostorno-planska/"
               "Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana"
               "%20Splita%20za%20ponovnu%20javnu%20raspravu/"
               "1_%20Koristenje%20i%20namjena%20prostora.pdf",
        "afin": (3.527572698708, 490298.551615, 4817109.960992),
        "zakret": -0.000953656854,
        "klasa": 14,  # legenda uvodi R4 i R5
    },
]


def preuzmi(plan: dict) -> str:
    put = os.path.join(SRC, plan["pdf"])
    if os.path.exists(put):
        return put
    if not plan.get("url"):
        raise SystemExit(f"{plan['id']}: nema {put} ni poznatog URL-a")
    os.makedirs(SRC, exist_ok=True)
    print(f"  preuzimam {plan['url']}")
    req = urllib.request.Request(plan["url"], headers={
        "User-Agent": "Mozilla/5.0 (kvart gup-grad)",
        "Referer": "https://split.hr/",
    })
    with urllib.request.urlopen(req, timeout=300) as r, open(put + ".tmp", "wb") as f:
        f.write(r.read())
    os.replace(put + ".tmp", put)
    return put


def renderiraj(put: str, sc: float) -> tuple[np.ndarray, float, float]:
    """Cijeli list na KORAK m/px. Vraća RGB, dpi i visinu stranice u pt."""
    d = pymupdf.open(put)
    p = d[0]
    # Uklapanje iz trace-plans.py mjereno je na MediaBoxu (pdftoppm ga
    # renderira po zadanom); PyMuPDF bi renderirao CropBox, koji je na
    # pročišćenom listu 2015. uži i pomaknut — list bi završio ~500 m dalje.
    p.set_cropbox(p.mediabox)
    dpi = 72.0 * sc / KORAK
    pix = p.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0), alpha=False)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    return rgb.copy(), dpi, float(p.rect.height)


def _ton(a: np.ndarray) -> np.ndarray:
    """Ton (hue) u stupnjevima za polje RGB int."""
    r, g, b = (a[..., i].astype(np.float32) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4))
    return h * 60.0


def klasificiraj(rgb: np.ndarray, n_klasa: int = len(PALETA),
                 srafura: bool = False) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Klase po boji, maska „čistih” piksela i maska tamne podloge.

    `n_klasa` ograničava paletu na klase koje legenda tog lista ima — R4/R5
    postoje tek 2025., a na starijim listovima njihove bi boje uhvatile
    blijedu šrafuru park-šume.
    """
    boje = [h for h, _, _ in PALETA[:n_klasa]] + MAMCI
    uzorci = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in boje], np.int32)
    tonovi = _ton(uzorci[None, :n_klasa].astype(np.int32))[0]
    klase = np.zeros(rgb.shape[:2], np.uint8)
    cisto = np.zeros(rgb.shape[:2], bool)
    tamno = np.zeros(rgb.shape[:2], bool)
    # u trakama, da float kopije lista ne pojedu RAM
    for y0 in range(0, rgb.shape[0], 512):
        a = rgb[y0:y0 + 512].astype(np.int32)
        najbolja = np.full(a.shape[:2], np.inf, np.float32)
        k = np.zeros(a.shape[:2], np.uint8)
        # Samo za list sa sitnom šrafurom (`srafura`; pročišćeni 2015.):
        # šrafura na bijelom je boja plana pomiješana s bijelim: P = W − α(W − C).
        # Mjeri se udaljenost od te crte (α ≥ NAJMANJA_POKRIVENOST), a ne
        # od same boje: turistička T (#c02000) šrafirana fino na bijelom daje
        # (211,102,82), što je obično RGB-om bliže javnoj D (#f46040), a na
        # crti T–bijelo leži gotovo točno (ostatak 7 prema 35). Na punim
        # listovima (2006., 2025.) isti model blijede rubove i more upisuje
        # kao luke, pa ondje ostaje obična udaljenost.
        w_a = (255 - a).astype(np.float32)
        for i, u in enumerate(uzorci, start=1):
            wc = (255 - u).astype(np.float32)
            norma = float((wc * wc).sum())
            if srafura and i <= n_klasa and norma > 0:
                alfa = np.clip((w_a * wc).sum(axis=2) / norma, NAJMANJA_POKRIVENOST, 1.0)
                d = ((w_a - alfa[..., None] * wc) ** 2).sum(axis=2)
            else:
                d = ((a - u) ** 2).sum(axis=2).astype(np.float32)
            bolje = d < najbolja
            k[bolje] = i
            najbolja[bolje] = d[bolje]
        zas = a.max(axis=2) - a.min(axis=2)
        # Stapanje šrafure s bijelim čuva ton, a RGB razmak ne: blijedo-
        # narančasta mješovita zona (216,192,160) bliža je blijedozelenoj R2
        # nego narančastoj M. Ton dalji od TON_TOLERANCIJA znači „ne znam”,
        # a prazninu poslije popuni okolna klasa.
        ton = _ton(a)
        dton = np.abs(ton - tonovi[np.minimum(k, len(tonovi)) - 1])
        dton = np.minimum(dton, 360 - dton)
        dobro = ((najbolja <= NAJVECI_RAZMAK ** 2) & (zas >= NAJMANJA_ZASICENOST)
                 & (k <= n_klasa) & (dton <= TON_TOLERANCIJA))
        # Akvatorij luka: tanke svijetloplave kose crte. Na 2 m/px stope se
        # s bijelim u (0–190, 190–240, 255) — ni jedna boja namjene nije tako
        # plava, a bez oznake bi zatvaranje obuhvata more upisalo kao ulice.
        R, G, B = a[..., 0], a[..., 1], a[..., 2]
        more = (B >= 240) & (G >= 175) & (G <= 245) & (R <= G - 25)
        dobro &= ~more
        blok = np.where(dobro, k, 0).astype(np.uint8)
        blok[more] = MORE
        klase[y0:y0 + 512] = blok
        cisto[y0:y0 + 512] = dobro & (najbolja <= CISTA_BOJA ** 2)
        # Siva podloga zgrada i crni natpisi: nisu bijela ulica ni boja.
        tamno[y0:y0 + 512] = ~dobro & ~more & (a.max(axis=2) < 215)
    return klase, cisto, tamno


def zatvori_srafuru(klase: np.ndarray, tamno: np.ndarray) -> np.ndarray:
    """Popunjava bijele pruge vodoravne šrafure (list 2015.).

    Pročišćeni list mješovitu namjenu šrafira vodoravnim crtama s bijelim
    razmakom od 1–3 px na 2 m/px. Prazan svijetli piksel kojem je ista
    klasa i iznad i ispod na najviše SRAFURA_PX dobiva tu klasu. Ulica je
    šira od 6 m pa je ne dira; vodoravna uličica uža od toga bi se
    popunila, ali takvih je u planu 1 : 10 000 zanemarivo malo.
    """
    out = klase.copy()
    prazno = (klase == 0) & ~tamno
    for i in range(1, len(PALETA) + 1):
        m = klase == i
        gore = np.zeros_like(m)
        dolje = np.zeros_like(m)
        for d in range(1, SRAFURA_PX + 1):
            gore[d:] |= m[:-d]
            dolje[:-d] |= m[d:]
        out[prazno & gore & dolje & (out == 0)] = i
    return out


def vrati_krhotine_t(klase: np.ndarray) -> np.ndarray:
    """Na šrafiranom listu: sitne mrlje T usred javne namjene vraća u D.

    Javna namjena ispod sive podloge zgrada na listu 2015. zna pasti na
    crtu T–bijelo. Stvarne turističke zone su velike (hoteli, Žnjan);
    mrlja T manja od KRHOTINA_T_M2 kojoj je rub većinom D je D. Tako je
    vraćeno ~13 ha koje su i 2006. i 2025. javna namjena.
    """
    t_i = 1 + [k for _, k, _ in PALETA].index("T")
    d_i = 1 + [k for _, k, _ in PALETA].index("D")
    oz, n = ndimage.label(klase == t_i)
    if n == 0:
        return klase
    vel = ndimage.sum(np.ones_like(oz), oz, index=np.arange(1, n + 1))
    rub = ndimage.binary_dilation(klase == t_i, iterations=2) & (klase != t_i)
    # za svaki piksel ruba: kojoj mrlji pripada (najbliža oznaka)
    _, (ri, ci) = ndimage.distance_transform_edt(oz == 0, return_indices=True)
    rub_oz = oz[ri[rub], ci[rub]]
    rub_d = klase[rub] == d_i
    udio_d = np.bincount(rub_oz, weights=rub_d, minlength=n + 1) / np.maximum(np.bincount(rub_oz, minlength=n + 1), 1)
    px = KORAK * KORAK  # list je renderiran na KORAK m/px
    male = np.flatnonzero((vel * px < KRHOTINA_T_M2) & (udio_d[1:] > 0.5)) + 1
    out = klase.copy()
    out[np.isin(oz, male)] = d_i
    return out


def vecina(klase: np.ndarray, cisto: np.ndarray) -> np.ndarray:
    """Obojeni piksel poprima klasu koja prevladava u okviru VECINA_PX².

    Pročišćeni list 2015. mješovitu namjenu crta narančastom šrafurom na
    bijelom; stopljena daje blijedonarančaste piksele (216,192,160) koji su
    u RGB-u jednako blizu blijedozelene R2 kao i narančaste M — pa je svaka
    zona M bila posuta s ~30 % lažne rekreacije. Zone plana su široke
    desetke metara, pa glas okvira od 14 m ispravlja šrafuru, a rub zone
    pomakne najviše za pola okvira.

    Isto vrijedi za turističku namjenu T: crvena šrafura (#c02000) stopljena
    s bijelim pada u lososnu javnu namjenu D. Zato piksel čiste boje (bliže
    od CISTA_BOJA uzorku) glasa TEZINA_CISTE puta — u šrafuri je malo čistih
    crta, ali su one jedine koje znaju koja je šrafura.
    """
    tezina = np.where(cisto, np.float32(TEZINA_CISTE), np.float32(1.0))
    najbolji = np.zeros(klase.shape, np.float32)
    kandidat = np.zeros(klase.shape, np.uint8)
    for i in range(1, len(PALETA) + 1):
        n = ndimage.uniform_filter((klase == i) * tezina, VECINA_PX, mode="constant")
        bolje = n > najbolji
        kandidat[bolje] = i
        najbolji[bolje] = n[bolje]
    obojeno = (klase > 0) & (klase <= len(PALETA))
    return np.where(obojeno, kandidat, klase)


def popuni(klase: np.ndarray, tamno: np.ndarray | None = None) -> np.ndarray:
    """Prazan piksel poprima klasu koja ga najviše okružuje (natpisi, zgrade).

    Listovi 2006. i 2015. imaju ispod namjene sivu podlogu postojećih zgrada;
    veće zgrade su šire od okvira pa bi ostale prazne i na kraju upisane
    kao „ulica”. Tamni pikseli zato dobiju širi okvir i niži prag (kao u
    trace-plans.py), a bijela ulica ostaje netaknuta.
    """
    if tamno is not None:
        klase = _popuni(klase, tamno, RADIJUS_TAMNO, PRAG_TAMNO, PROLAZA_TAMNO)
    return _popuni(klase, np.ones(klase.shape, bool), RADIJUS_POPUNE,
                   PRAG_POPUNE, PROLAZA_POPUNE)


def _popuni(klase, gdje, radijus, prag, prolaza):
    vel = 2 * radijus + 1
    for _ in range(prolaza):
        najbolji = np.zeros(klase.shape, np.float32)
        kandidat = np.zeros(klase.shape, np.uint8)
        for i in range(1, len(PALETA) + 1):
            n = ndimage.uniform_filter((klase == i).astype(np.float32), vel, mode="constant") * vel * vel
            bolje = n > najbolji
            kandidat[bolje] = i
            najbolji[bolje] = n[bolje]
        prazno = gdje & (klase == 0) & (najbolji >= prag - 0.01)
        if not prazno.any():
            break
        klase = np.where(prazno, kandidat, klase)
    return klase


def na_rescetku(klase_lista: np.ndarray, plan: dict, dpi: float, visina_pt: float) -> np.ndarray:
    """Preslikava klase s lista na zemljišnu rešetku (najbliži susjed)."""
    sc, ox, oy = plan["afin"]
    r = math.radians(plan.get("zakret", 0.0))
    c, s = math.cos(r), math.sin(r)
    xs = MREZA_BBOX[0] + (np.arange(W) + 0.5) * KORAK
    out = np.zeros((H, W), np.uint8)
    k = dpi / 72.0
    for row in range(0, H, 256):
        ys = MREZA_BBOX[3] - (np.arange(row, min(H, row + 256)) + 0.5) * KORAK
        X, Y = np.meshgrid(xs, ys)
        dx, dy = X - ox, Y - oy
        u = c * dx + s * dy
        v = -s * dx + c * dy
        px = np.floor(u / sc * k).astype(np.int64)
        py = np.floor((visina_pt - v / sc) * k).astype(np.int64)
        ok = (px >= 0) & (py >= 0) & (px < klase_lista.shape[1]) & (py < klase_lista.shape[0])
        blok = np.zeros(X.shape, np.uint8)
        blok[ok] = klase_lista[py[ok], px[ok]]
        out[row:row + blok.shape[0]] = blok
    return out


def obuhvat(klase: np.ndarray) -> np.ndarray:
    """Obojeno + zatvorene ulice, bez legende, mora i crta: najveće cjeline."""
    # Otvaranje briše tanke obojene crte (crvena crtkana granica obalnog
    # pojasa, rubovi legende) — inače ih zatvaranje spoji s gradom, a
    # popunjavanje rupa upiše cijelo more između crte i obale.
    obojeno = ndimage.binary_opening((klase > 0) & (klase != MORE), iterations=2)
    more = ndimage.uniform_filter((klase == MORE).astype(np.float32), 15) > 0.08
    r = ZATVARANJE_M / KORAK
    dil = ndimage.distance_transform_edt(~obojeno) <= r
    zat = ((ndimage.distance_transform_edt(dil) > r) | obojeno) & ~more
    # Rupe (neobojeno okruženo gradom) su ulice, pruga, groblje — osim ako
    # su more zatvoreno lukobranima.
    rupe = ndimage.binary_fill_holes(zat) & ~zat
    oz, n = ndimage.label(rupe)
    if n:
        morsko = ndimage.mean(more | (klase == MORE), oz, index=np.arange(1, n + 1))
        zat |= np.isin(oz, np.flatnonzero(morsko < 0.02) + 1)
    oznake, n = ndimage.label(zat)
    if n == 0:
        return zat
    vel = ndimage.sum(zat, oznake, index=np.arange(1, n + 1))
    # Glavni grad je daleko najveći; odvojeni dijelovi obuhvata (npr. Žnjan
    # preko kanala, luka Lora) ostaju ako su veći od 1 % najvećeg — legenda
    # lista je izvan MREZA_BBOX ili je manja od toga.
    zadrzi = np.flatnonzero(vel >= 0.01 * vel.max()) + 1
    return np.isin(oznake, zadrzi)


def pregled(klase: np.ndarray, put: str) -> None:
    boje = np.zeros((KLASA_PROMET + 1, 3), np.uint8)
    boje[0] = (255, 255, 255)
    for i, (h, _, _) in enumerate(PALETA, start=1):
        boje[i] = [int(h[j:j + 2], 16) for j in (1, 3, 5)]
    boje[KLASA_PROMET] = (200, 200, 200)
    Image.fromarray(boje[klase]).resize((W // 3, H // 3), Image.NEAREST).save(put)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    samo = set(sys.argv[1:])
    izvjestaj = []
    for plan in PLANOVI:
        if samo and plan["id"] not in samo:
            continue
        print(plan["id"])
        put = preuzmi(plan)
        rgb, dpi, visina = renderiraj(put, plan["afin"][0])
        print(f"  list {rgb.shape[1]}×{rgb.shape[0]} px @ {dpi:.1f} dpi")
        kl, cisto, tamno = klasificiraj(rgb, plan.get("klasa", 12), plan.get("srafura", False))
        del rgb
        kl = popuni(vecina(zatvori_srafuru(kl, tamno), cisto), tamno)
        if plan.get("srafura"):
            kl = vrati_krhotine_t(kl)
        del cisto, tamno
        g = na_rescetku(kl, plan, dpi, visina)
        del kl
        m = obuhvat(g)
        g = np.where(m, np.where((g == 0) | (g == MORE), KLASA_PROMET, g), 0).astype(np.uint8)
        np.save(os.path.join(OUT, f"klase-{plan['id']}.npy"), g)
        pregled(g, os.path.join(OUT, f"pregled-{plan['id']}.png"))
        ha = {PALETA[i - 1][1] if i <= len(PALETA) else "promet": round(float((g == i).sum()) * KORAK * KORAK / 1e4, 1)
              for i in range(1, KLASA_PROMET + 1)}
        ukupno = round(float((g > 0).sum()) * KORAK * KORAK / 1e4, 1)
        print(f"  obuhvat {ukupno} ha", ha)
        izvjestaj.append({k: plan[k] for k in ("id", "godina", "naziv", "napomena")} | {"ha": ha, "ukupno_ha": ukupno})
    # Kad se izvodi samo dio godina, ostale se zadrže iz prethodnog izvođenja.
    put_mreze = os.path.join(OUT, "mreza.json")
    if samo and os.path.exists(put_mreze):
        with open(put_mreze) as f:
            stari = {p["id"]: p for p in json.load(f).get("planovi", [])}
        stari.update({p["id"]: p for p in izvjestaj})
        izvjestaj = [stari[p["id"]] for p in PLANOVI if p["id"] in stari]
    with open(put_mreze, "w") as f:
        json.dump({
            "crs": "EPSG:3765", "bbox": MREZA_BBOX, "korak": KORAK, "w": W, "h": H,
            "klase": [{"i": i, "kod": k, "naziv": n, "boja": b} for i, (b, k, n) in enumerate(PALETA, start=1)]
                     + [{"i": KLASA_PROMET, "kod": "P", "naziv": "Ulice, pruga, groblja i ostalo što plan ne boji namjenom", "boja": "#c8c8c8"}],
            "planovi": izvjestaj,
        }, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
