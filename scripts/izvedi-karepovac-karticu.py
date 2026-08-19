#!/usr/bin/env python3
"""Izvodi geometriju kartica za /karepovac iz slojeva koje već imamo.

Kartice na stranici moraju stajati nad istim kvartom, u istom mjerilu i s istim
sjeverom — inače se prikazi ne mogu usporediti. Zato se sva geometrija projicira
jednom, u zajednički okvir, i sprema kao gotove SVG putanje.

Ulazi su slojevi iz `public/geo`: izohipse iz DGU-ova LiDAR-a, zgrade i ulice iz
OSM-a, granice kvarta, tokovi izvedeni D8 analizom reljefa i obris odlagališta.

Polje vjetra nije podatak nego izvod: iz izohipsi se interpolira model visina, iz
njega nagib, a iz nagiba polje koje ne ide uz padinu nego je obilazi. Odatle
strujnice na kartici vjetra i podatak koliko polje skreće od smjera na otvorenom.

Pokretanje: `npm run izvedi-karepovac`
"""

import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import okvir  # noqa: E402

KORIJEN = Path(__file__).resolve().parent.parent
GEO = KORIJEN / "public" / "geo"
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-karta.ts"

# Okvir stoji u `scripts/okvir.py`, da ga dijele i ova skripta i polje dima.
# Dok je stajao ovdje u vlastitoj kopiji, prva promjena granica razišla bi
# kartice i perjanicu za nekoliko stotina metara — a to se na karti ne vidi kao
# greška nego kao loše poklapanje slojeva.
Z, J, I, S = okvir.ZAPAD, okvir.JUG, okvir.ISTOK, okvir.SJEVER
SIRINA = okvir.SIRINA
M_PO_LON = okvir.M_PO_LON
M_PO_LAT = okvir.M_PO_LAT
SIRINA_M = okvir.SIRINA_M
VISINA_M = okvir.VISINA_M
VISINA = okvir.VISINA
PX_PO_M = okvir.PX_PO_M


def ucitaj(ime: str) -> dict:
    put = GEO / f"{ime}.geojson"
    if not put.exists():
        sys.exit(f"Nedostaje sloj: {put.relative_to(KORIJEN)}")
    return json.loads(put.read_text(encoding="utf8"))


def projiciraj(t) -> tuple[float, float]:
    """Pretvara par (lon, lat) u piksele okvira."""
    return okvir.projiciraj(t[0], t[1])


def dijelovi(geom: dict) -> list:
    vrsta, k = geom["type"], geom["coordinates"]
    if vrsta == "LineString":
        return [k]
    if vrsta == "MultiLineString":
        return k
    if vrsta == "Polygon":
        return k
    if vrsta == "MultiPolygon":
        return [p for poly in k for p in poly]
    return []


def pojednostavi(t: list, tol: float) -> list:
    """Douglas-Peucker; bez njega su izohipse desetak puta veće nego treba."""
    if len(t) < 3:
        return t
    ax, ay = t[0]
    bx, by = t[-1]
    dx, dy = bx - ax, by - ay
    naz = math.hypot(dx, dy)
    naj, gdje = -1.0, 0
    for i in range(1, len(t) - 1):
        px, py = t[i]
        d = (
            math.hypot(px - ax, py - ay)
            if naz == 0
            else abs(dy * px - dx * py + bx * ay - by * ax) / naz
        )
        if d > naj:
            naj, gdje = d, i
    if naj <= tol:
        return [t[0], t[-1]]
    return pojednostavi(t[: gdje + 1], tol)[:-1] + pojednostavi(t[gdje:], tol)


def putanja(t: list, zatvori: bool = False) -> str:
    d = "".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}" for i, (x, y) in enumerate(t))
    return d + ("Z" if zatvori else "")


def vidljivo(t: list) -> bool:
    return any(-30 <= x <= SIRINA + 30 and -30 <= y <= VISINA + 30 for x, y in t)


def sloj(znacajke, tol: float, zatvori: bool, uvjet=None) -> str:
    out = []
    for geom, svojstva in znacajke:
        if uvjet and not uvjet(svojstva):
            continue
        for prsten in dijelovi(geom):
            t = [projiciraj(p) for p in prsten]
            if not vidljivo(t):
                continue
            t = pojednostavi(t, tol)
            if len(t) >= 2:
                out.append(putanja(t, zatvori))
    return "".join(out)


def znacajke(ime: str):
    for f in ucitaj(ime)["features"]:
        yield f["geometry"], (f["properties"] or {})


def u_poligonu(t, prsten) -> bool:
    x, y = t
    unutra = False
    n = len(prsten)
    for i in range(n):
        x1, y1 = prsten[i]
        x2, y2 = prsten[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                unutra = not unutra
    return unutra


# ------------------------------------------------------------------ podloga --

izohipse = list(znacajke("izohipse"))
granice = {s["naziv"]: g for g, s in znacajke("granica")}
ploha_znacajke = list(znacajke("karepovac"))
ploha_geom = [g for g, s in ploha_znacajke if s.get("naziv") == "Karepovac"][0]
ploha_prsten = ploha_geom["coordinates"][0]
ploha_px = [projiciraj(p) for p in ploha_prsten]

PODLOGA = {
    "izohipseSporedne": sloj(izohipse, 0.7, False, lambda s: not s.get("glavna")),
    "izohipseGlavne": sloj(izohipse, 0.5, False, lambda s: s.get("glavna")),
    "zgrade": sloj(znacajke("zgrade"), 0.45, True),
    "ulice": sloj(znacajke("ulice"), 0.5, False),
    "granicaDracevac": sloj([(granice["Dračevac"], {})], 0.4, True),
    "granicaBilice": sloj([(granice["Bilice"], {})], 0.4, True),
    "ploha": sloj([(ploha_geom, {})], 0.4, True),
    "plohaManja": sloj(
        [(g, s) for g, s in ploha_znacajke if s.get("naziv") != "Karepovac"], 0.4, True
    ),
}

sx = sum(p[0] for p in ploha_px) / len(ploha_px)
sy = sum(p[1] for p in ploha_px) / len(ploha_px)


def do_ruba_m(lon: float, lat: float) -> float:
    return min(
        math.hypot((lon - q[0]) * M_PO_LON, (lat - q[1]) * M_PO_LAT)
        for q in ploha_prsten
    )


# --------------------------------------------------------------- nadmorske ---

vrhovi = []
for geom, svojstva in izohipse:
    for linija in dijelovi(geom):
        for t in linija[::3]:
            vrhovi.append((t[0], t[1], svojstva["visina"]))


def visina(lon: float, lat: float) -> float:
    return min(vrhovi, key=lambda v: (v[0] - lon) ** 2 * 0.52 + (v[1] - lat) ** 2)[2]


def raspon(prsten) -> list[int]:
    h = [
        s["visina"]
        for g, s in izohipse
        for ln in dijelovi(g)
        if any(u_poligonu(t, prsten) for t in ln)
    ]
    return [int(min(h)), int(max(h))]


VISINE = {
    "tijelo": raspon(ploha_prsten),
    "dracevac": raspon(granice["Dračevac"]["coordinates"][0]),
    "bilice": raspon(granice["Bilice"]["coordinates"][0]),
}

# ------------------------------------------------------------------- točke ---

zgrade = ucitaj("zgrade")["features"]
zone = {n: g["coordinates"][0] for n, g in granice.items()}
kandidati = []
for f in zgrade:
    prsten = f["geometry"]["coordinates"][0]
    c = (
        sum(p[0] for p in prsten) / len(prsten),
        sum(p[1] for p in prsten) / len(prsten),
    )
    zona = next((n for n, r in zone.items() if u_poligonu(c, r)), None)
    if zona:
        kandidati.append({"lon": c[0], "lat": c[1], "zona": zona, "d": do_ruba_m(*c)})

VISINE["najblizaKuca"] = round(min(k["d"] for k in kandidati))

CILJEVI = [180, 340, 520, 700, 800, 980, 1180, 1400]
TOCKE = []
zauzeto = set()
for cilj in CILJEVI:
    naj = min(
        (k for k in kandidati if (round(k["lon"], 4), round(k["lat"], 4)) not in zauzeto),
        key=lambda k: abs(k["d"] - cilj),
    )
    zauzeto.add((round(naj["lon"], 4), round(naj["lat"], 4)))
    x, y = projiciraj((naj["lon"], naj["lat"]))
    TOCKE.append(
        {
            "x": round(x, 1),
            "y": round(y, 1),
            "d": round(naj["d"]),
            "zona": naj["zona"],
            "visina": int(visina(naj["lon"], naj["lat"])),
        }
    )
TOCKE.sort(key=lambda t: t["d"])

# ------------------------------------------------------------- azimut i polje -

def azimut_prema(prsten) -> float:
    zx = sum(p[0] for p in prsten) / len(prsten)
    zy = sum(p[1] for p in prsten) / len(prsten)
    cx = sum(p[0] for p in ploha_prsten) / len(ploha_prsten)
    cy = sum(p[1] for p in ploha_prsten) / len(ploha_prsten)
    return (
        math.degrees(math.atan2((zx - cx) * M_PO_LON, (zy - cy) * M_PO_LAT)) + 360
    ) % 360


AZIMUT = round(azimut_prema(zone["Dračevac"]))
UX, UY = math.sin(math.radians(AZIMUT)), -math.cos(math.radians(AZIMUT))

CELIJA = 5.0
NX, NY = int(SIRINA / CELIJA) + 3, int(VISINA / CELIJA) + 3
GX0 = GY0 = -CELIJA
POLA = 16.0
indeks: dict = {}
tocke_px = []
for lon, lat, h in vrhovi:
    x, y = projiciraj((lon, lat))
    if -90 <= x <= SIRINA + 90 and -90 <= y <= VISINA + 90:
        indeks.setdefault((int(x // POLA), int(y // POLA)), []).append(len(tocke_px))
        tocke_px.append((x, y, h))


def uzorak(x: float, y: float):
    bx, by = int(x // POLA), int(y // POLA)
    blizu: list[int] = []
    r = 1
    while not blizu and r <= 5:
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                blizu.extend(indeks.get((bx + dx, by + dy), ()))
        r += 1
    if not blizu:
        return None
    naj = sorted(blizu, key=lambda i: (tocke_px[i][0] - x) ** 2 + (tocke_px[i][1] - y) ** 2)[:10]
    br = naz = 0.0
    for i in naj:
        d2 = (tocke_px[i][0] - x) ** 2 + (tocke_px[i][1] - y) ** 2 + 0.4
        br += tocke_px[i][2] / d2
        naz += 1 / d2
    return br / naz


dmv = [[uzorak(GX0 + i * CELIJA, GY0 + j * CELIJA) or 0.0 for i in range(NX)] for j in range(NY)]
for _ in range(2):
    novo = [red[:] for red in dmv]
    for j in range(1, NY - 1):
        for i in range(1, NX - 1):
            novo[j][i] = (
                dmv[j][i] * 4 + dmv[j - 1][i] + dmv[j + 1][i] + dmv[j][i - 1] + dmv[j][i + 1]
            ) / 8
    dmv = novo

ravno = [v for red in dmv for v in red]
HMIN, HMAX = min(ravno), max(ravno)
HRASPON = max(HMAX - HMIN, 1.0)

nagib = [[(0.0, 0.0)] * NX for _ in range(NY)]
for j in range(NY):
    for i in range(NX):
        i0, i1 = max(i - 1, 0), min(i + 1, NX - 1)
        j0, j1 = max(j - 1, 0), min(j + 1, NY - 1)
        nagib[j][i] = (
            (dmv[j][i1] - dmv[j][i0]) / ((i1 - i0) * CELIJA),
            (dmv[j1][i] - dmv[j0][i]) / ((j1 - j0) * CELIJA),
        )

NAGIB0, BETA_MAX, UBRZANJE = 0.13, 0.72, 0.55


def dvolinearno(polje, x, y, zadano):
    fx, fy = (x - GX0) / CELIJA, (y - GY0) / CELIJA
    i, j = int(fx), int(fy)
    if i < 0 or j < 0 or i >= NX - 1 or j >= NY - 1:
        return zadano
    tx, ty = fx - i, fy - j
    a, b, c, d = polje[j][i], polje[j][i + 1], polje[j + 1][i], polje[j + 1][i + 1]
    if isinstance(a, tuple):
        return tuple(
            (u * (1 - tx) + v * tx) * (1 - ty) + (p * (1 - tx) + q * tx) * ty
            for u, v, p, q in zip(a, b, c, d)
        )
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def vjetar(x: float, y: float):
    gx, gy = dvolinearno(nagib, x, y, (0.0, 0.0))
    g2 = gx * gx + gy * gy
    vx, vy = UX, UY
    if g2 > 1e-9:
        g = math.sqrt(g2)
        nx_, ny_ = gx / g, gy / g
        beta = BETA_MAX * g / (g + NAGIB0)
        skalar = vx * nx_ + vy * ny_
        vx -= beta * skalar * nx_
        vy -= beta * skalar * ny_
    m = math.hypot(vx, vy)
    if m < 1e-6:
        return UX, UY, 0.35
    h = dvolinearno(dmv, x, y, HMIN)
    return vx / m, vy / m, (0.55 + 0.45 * m) * (1 + UBRZANJE * (h - HMIN) / HRASPON)


def prati(x, y, koraka, dt, granica=90.0):
    izlaz = [(x, y)]
    for _ in range(koraka):
        dx1, dy1, s1 = vjetar(x, y)
        mx, my = x + dx1 * s1 * dt * 0.5, y + dy1 * s1 * dt * 0.5
        dx2, dy2, s2 = vjetar(mx, my)
        x += dx2 * s2 * dt
        y += dy2 * s2 * dt
        if not (-granica <= x <= SIRINA + granica and -granica <= y <= VISINA + granica):
            break
        izlaz.append((x, y))
    return izlaz


odstupanja = []
for j in range(4, NY - 4, 3):
    for i in range(4, NX - 4, 3):
        dx, dy, _ = vjetar(GX0 + i * CELIJA, GY0 + j * CELIJA)
        odstupanja.append(math.degrees(math.acos(max(-1, min(1, dx * UX + dy * UY)))))
odstupanja.sort()
SKRETANJE = {
    "medijan": round(odstupanja[len(odstupanja) // 2]),
    "najvece": round(odstupanja[-1]),
}

PX, PY = -UY, UX
CX, CY = SIRINA / 2, VISINA / 2
STRUJNICE = []
for k in range(40):
    poprijeko = ((k + 0.5) / 40 - 0.5) * 2.6 * VISINA
    t = prati(
        CX + PX * poprijeko - UX * 0.85 * SIRINA,
        CY + PY * poprijeko - UY * 0.85 * SIRINA,
        460,
        3.0,
        granica=1200.0,
    )
    unutra = [
        i for i, (x, y) in enumerate(t)
        if -20 <= x <= SIRINA + 20 and -20 <= y <= VISINA + 20
    ]
    if len(unutra) < 14:
        continue
    dio = t[unutra[0] : unutra[-1] + 1][::2]
    if len(dio) >= 8:
        STRUJNICE.append(putanja(pojednostavi(dio, 0.4)))

# ------------------------------------------------------------------ tokovi ---

tokovi = []
for f in ucitaj("tokovi")["features"]:
    k = f["geometry"]["coordinates"]
    if len(k) < 2:
        continue
    if visina(*k[0]) < visina(*k[-1]):
        k = k[::-1]
    tokovi.append(k)

po_pocetku: dict = {}
for i, k in enumerate(tokovi):
    po_pocetku.setdefault((round(k[0][0], 5), round(k[0][1], 5)), []).append(i)

# Model otjecanja ne pokriva samo tijelo plohe, pa su sjeme oni tokovi čiji
# izvor leži najbliže njezinu rubu.
sjeme = [i for i, k in enumerate(tokovi) if do_ruba_m(*k[0]) < 260]
odabrani = set(sjeme)
red = list(sjeme)
while red:
    i = red.pop()
    kraj = (round(tokovi[i][-1][0], 5), round(tokovi[i][-1][1], 5))
    for j in po_pocetku.get(kraj, []):
        if j not in odabrani:
            odabrani.add(j)
            red.append(j)

TOKOVI = {
    "sPlohe": "".join(
        putanja(pojednostavi([projiciraj(p) for p in tokovi[i]], 0.6))
        for i in sorted(odabrani)
    ),
    "ostalo": "".join(
        putanja(pojednostavi([projiciraj(p) for p in k], 0.7))
        for i, k in enumerate(tokovi)
        if i not in odabrani
    ),
    "izvori": [
        {"x": round(projiciraj(tokovi[i][0])[0], 1), "y": round(projiciraj(tokovi[i][0])[1], 1)}
        for i in sjeme
    ],
}

# ------------------------------------------------------------------- ceste ---

blizu = []
for f in ucitaj("ulice")["features"]:
    for linija in dijelovi(f["geometry"]):
        if min(do_ruba_m(*p) for p in linija) < 400:
            blizu.append(putanja(pojednostavi([projiciraj(p) for p in linija], 0.5)))
CESTE_UZ_PLOHU = "".join(blizu)

# ------------------------------------------------------- prstenovi i mreža ---


def prsten_px(metara: float) -> str:
    r = metara * PX_PO_M
    return (
        f"M{sx - r:.1f} {sy:.1f}a{r:.1f} {r:.1f} 0 1 0 {2 * r:.1f} 0"
        f"a{r:.1f} {r:.1f} 0 1 0 {-2 * r:.1f} 0Z"
    )


PRSTENI = [
    {"metara": m, "d": prsten_px(m), "istaknut": m == 800} for m in (400, 800, 1200)
]

celija = 375 * PX_PO_M
xs = [p[0] for p in ploha_px]
ys = [p[1] for p in ploha_px]
gx0 = math.floor(min(xs) / celija) * celija
gy0 = math.floor(min(ys) / celija) * celija
VIIRS = []
i = 0
while gx0 + i * celija < max(xs) + celija:
    j = 0
    while gy0 + j * celija < max(ys) + celija:
        cx, cy = gx0 + i * celija, gy0 + j * celija
        pogodak = any(cx <= x <= cx + celija and cy <= y <= cy + celija for x, y in ploha_px)
        VIIRS.append(
            {"x": round(cx, 1), "y": round(cy, 1), "a": round(celija, 1), "pogodak": pogodak}
        )
        j += 1
    i += 1

# ------------------------------------------------------------- blizi okvir ---

rub = 34.0
x0, x1 = min(xs) - rub, max(xs) + rub
y0, y1 = min(ys) - rub, max(ys) + rub
omjer = SIRINA / VISINA
sir, vis = x1 - x0, y1 - y0
if sir / vis < omjer:
    nova = vis * omjer
    x0 -= (nova - sir) / 2
    sir = nova
else:
    nova = sir / omjer
    y0 -= (nova - vis) / 2
    vis = nova

# ---------------------------------------------------------------- ispis TS ---


def ts(vrijednost) -> str:
    return json.dumps(vrijednost, ensure_ascii=False, separators=(",", ":"))


OKVIR = {
    "viewBox": f"0 0 {SIRINA:.0f} {VISINA}",
    "sirina": SIRINA,
    "visina": VISINA,
    "pxPoMetru": round(PX_PO_M, 5),
    "mjerilo500": round(500 * PX_PO_M, 1),
    "srediste": [round(sx, 1), round(sy, 1)],
    "azimut": AZIMUT,
}

BLIZI_OKVIR = {
    "viewBox": f"{x0:.1f} {y0:.1f} {sir:.1f} {vis:.1f}",
    "x": round(x0, 1),
    "y": round(y0, 1),
    "sirina": round(sir, 1),
    "visina": round(vis, 1),
    "mjerilo200": round(200 * PX_PO_M, 1),
}

redovi = [
    "// Generirano iz public/geo/*.geojson.",
    "// Pokretanje: npm run izvedi-karepovac \u2014 ne ure\u0111ivati ru\u010dno.",
    "",
    f"export const OKVIR = {ts(OKVIR)} as const;",
    "",
    f"export const BLIZI_OKVIR = {ts(BLIZI_OKVIR)} as const;",
    "",
    f"export const PODLOGA = {ts(PODLOGA)} as const;",
    "",
    f"export const VISINE = {ts(VISINE)} as const;",
    "",
    f"export const TOCKE = {ts(TOCKE)} as const;",
    "",
    f"export const TOKOVI = {ts(TOKOVI)} as const;",
    "",
    f"export const CESTE_UZ_PLOHU = {ts(CESTE_UZ_PLOHU)};",
    "",
    f"export const PRSTENI = {ts(PRSTENI)} as const;",
    "",
    f"export const VIIRS = {ts(VIIRS)} as const;",
    "",
    f"export const STRUJNICE = {ts(STRUJNICE)} as const;",
    "",
    f"export const SKRETANJE = {ts(SKRETANJE)} as const;",
    "",
]

IZLAZ.parent.mkdir(parents=True, exist_ok=True)
IZLAZ.write_text("\n".join(redovi), encoding="utf8")

print(f"okvir {SIRINA:.0f}x{VISINA} px, {SIRINA_M:.0f}x{VISINA_M:.0f} m")
print(f"azimut prema kvartu {AZIMUT}°, skretanje polja {SKRETANJE}")
print(f"visine {VISINE}")
print(f"točaka {len(TOCKE)}, tokova s plohe {len(odabrani)} (sjeme {len(sjeme)})")
print(f"strujnica {len(STRUJNICE)}, VIIRS ćelija {len(VIIRS)}")
print(f"zapisano {IZLAZ.relative_to(KORIJEN)} ({IZLAZ.stat().st_size // 1024} kB)")
