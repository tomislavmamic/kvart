#!/usr/bin/env python3
"""Izvodi geometriju kartica za /karepovac iz slojeva koje već imamo.

Kartice na stranici moraju stajati nad istim kvartom, u istom mjerilu i s istim
sjeverom — inače se prikazi ne mogu usporediti. Zato se sva geometrija projicira
jednom, u zajednički okvir, i sprema kao gotove SVG putanje.

Ulazi su slojevi iz `public/geo`: izohipse iz DGU-ova LiDAR-a, zgrade i ulice iz
OSM-a, granice kvarta, tokovi izvedeni D8 analizom reljefa i obris odlagališta.

Polja vjetra ovdje više nema. Skripta ga je nekoć imala — vlastiti izvod iz
nagiba, s ugođenim koeficijentima — i iz njega su izlazile strujnice i mjera
skretanja. Otkad se polje slaže za vjetar koji trenutačno puše
(`src/lib/polje-dima.ts`, `src/lib/strujnice.ts`), taj je izvod bio četvrto
mjesto na kojem je pisala fizika reljefa, nije ga nitko više čitao, a nosio je
osam kilobajta u svakom posjetu. Uklonjen je; ovdje ostaje sama geometrija.

Pokretanje: `npm run izvedi-karepovac`
"""

import array
import gzip
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import okvir  # noqa: E402
import postaje  # noqa: E402
import postaje_vjetra  # noqa: E402

KORIJEN = Path(__file__).resolve().parent.parent
GEO = KORIJEN / "public" / "geo"
IZLAZ = KORIJEN / "src" / "generated" / "karepovac-karta.ts"
IZLAZ_POSTAJE = GEO / "postaje-zraka.geojson"
IZLAZ_VJETAR = GEO / "postaje-vjetra.geojson"

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
ploha_geom = [g for g, s in znacajke("karepovac") if s.get("naziv") == "Karepovac"][0]
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


# ------------------------------------------------------------------ postaje --
#
# Službene postaje ne stoje u kvartu nego s druge strane odlagališta, u
# udolini prema Kamenu. To je najvažnija ograda oko svega što model tvrdi, jer
# se na tom jednom prijemniku bazdari jačina izvora — pa mu mjesto mora stajati
# na karti, a ne samo u opisu metodologije.
#
# Točka pada **izvan** okvira kvarta, oko 190 m južno od donjeg ruba. Ne
# rasteže se zato okvir: južno od njega nema ni izohipsi ni zgrada (slojevi su
# izrezani na kvart), a rasterske slojeve raspršenja ne bi se dalo pomaknuti
# bez ponovnog godišnjeg računa. Umjesto toga se sprema i položaj u pikselima i
# koliko je izvan, pa prikaz može nacrtati oznaku na rubu i reći koliko dalje.

_VISINE_ZAGLAVLJE = json.loads(
    (GEO / "reljef" / "visine.json").read_text(encoding="utf8")
)
with gzip.open(GEO / "reljef" / "visine.bin.gz", "rb") as _f:
    _VISINE = array.array("h")
    _VISINE.frombytes(_f.read())


def visina_lidar(lon: float, lat: float) -> float | None:
    """Nadmorska visina tla iz DGU-ova LiDAR reljefa, u metrima.

    Izohipse iz `izohipse.geojson` ovdje ne pomažu: izrezane su na kvart i
    prestaju na 16,5115° E, a postaja je istočnije od toga.

    Args:
        lon: Zemljopisna dužina u stupnjevima, WGS84.
        lat: Zemljopisna širina u stupnjevima, WGS84.

    Returns:
        Visinu u metrima ili `None` ako je točka izvan mreže ili bez podatka.
    """
    z = _VISINE_ZAGLAVLJE
    c = round((lon - z["zapad"]) / (z["istok"] - z["zapad"]) * z["stupaca"])
    r = round((z["sjever"] - lat) / (z["sjever"] - z["jug"]) * z["redaka"])
    if not (0 <= r < z["redaka"] and 0 <= c < z["stupaca"]):
        return None
    v = _VISINE[r * z["stupaca"] + c]
    return None if v == z["prazno"] else v / 10.0


def _teziste(prsten) -> tuple[float, float]:
    """Težište poligona po površini, ne prosjek vrhova.

    Prosjek vrhova vuče prema strani na kojoj je obris gušće opisan, a obris
    plohe to jest — istočni rub ima terase, zapadni je ravna crta. Razlika je
    na Karepovcu ~190 m, dakle petina udaljenosti do postaje.
    """
    a = cx = cy = 0.0
    for i in range(len(prsten) - 1):
        x1, y1 = prsten[i]
        x2, y2 = prsten[i + 1]
        k = x1 * y2 - x2 * y1
        a += k
        cx += (x1 + x2) * k
        cy += (y1 + y2) * k
    if a == 0:
        return (
            sum(t[0] for t in prsten) / len(prsten),
            sum(t[1] for t in prsten) / len(prsten),
        )
    return cx / (3 * a), cy / (3 * a)


_PX, _PY = _teziste(ploha_prsten)


def _od_plohe(lon: float, lat: float) -> tuple[float, float]:
    """Vraća (udaljenost u metrima, azimut u stupnjevima) od sredine plohe."""
    dx = (lon - _PX) * M_PO_LON
    dy = (lat - _PY) * M_PO_LAT
    return math.hypot(dx, dy), (math.degrees(math.atan2(dx, dy)) + 360) % 360


def _kut(a: float, b: float) -> float:
    """Najmanji kut između dva azimuta, u stupnjevima."""
    return abs((a - b + 180) % 360 - 180)


_AZ_DRACEVAC = azimut_prema(zone["Dračevac"])
_AZ_BILICE = azimut_prema(zone["Bilice"])

POSTAJE = []
for _p in postaje.POSTAJE:
    _x, _y = projiciraj((_p.lon, _p.lat))
    _d, _az = _od_plohe(_p.lon, _p.lat)
    _izvan = max(0.0, (okvir.JUG - _p.lat)) * M_PO_LAT
    POSTAJE.append(
        {
            "oznaka": _p.oznaka,
            "naziv": _p.naziv,
            "opis": _p.opis,
            "lat": _p.lat,
            "lon": _p.lon,
            "x": round(_x, 1),
            "y": round(_y, 1),
            "visina": round(visina_lidar(_p.lon, _p.lat) or _p.visina, 1),
            "odPlohe": round(_d),
            "azimut": round(_az),
            "kutDracevac": round(_kut(_az, _AZ_DRACEVAC)),
            "kutBilice": round(_kut(_az, _AZ_BILICE)),
            "uOkviru": 0 <= _x <= SIRINA and 0 <= _y <= VISINA,
            "izvanOkviraM": round(_izvan),
        }
    )

def _vrh_unutar(prsten) -> float:
    """Najviša točka LiDAR-a **unutar** poligona, u metrima.

    Po obrisu se ne smije mjeriti: obris plohe ide podnožjem tijela, pa uzduž
    njega piše 85 m, dok je zaravnjeni vrh 35 m više.
    """
    z = _VISINE_ZAGLAVLJE
    lon = [t[0] for t in prsten]
    lat = [t[1] for t in prsten]
    d_lon = (z["istok"] - z["zapad"]) / z["stupaca"]
    d_lat = (z["sjever"] - z["jug"]) / z["redaka"]
    naj = 0.0
    korak = 3  # svaka treća ćelija; korak mreže je 3 m, ploha je 500 m široka
    c = int((min(lon) - z["zapad"]) / d_lon)
    while c < (max(lon) - z["zapad"]) / d_lon:
        r = int((z["sjever"] - max(lat)) / d_lat)
        while r < (z["sjever"] - min(lat)) / d_lat:
            t = (z["zapad"] + (c + 0.5) * d_lon, z["sjever"] - (r + 0.5) * d_lat)
            if u_poligonu(t, prsten):
                v = visina_lidar(*t)
                if v is not None and v > naj:
                    naj = v
            r += korak
        c += korak
    return naj


#: Vrh plohe iz LiDAR-a, radi visinske razlike prema postaji.
VRH_PLOHE = round(_vrh_unutar(ploha_prsten), 1)


# ------------------------------------------------------------ vjetrokazi ---
#
# Anemometri s kojih model uzima vjetar. Nijedan nije bliže od četiri
# kilometra i svi su na zapadu; to je druga velika ograda oko modela, uz onu
# o mjestu mjerne postaje. Udaljenosti se ovdje računaju, a ne prepisuju —
# `src/lib/vjetar.ts` ih je dotad držao kao ručno upisane brojke.
#
# Mjeri se od dvije referentne točke jer se u tekstu koriste obje: sučelje
# govori „N km od kvarta”, a rasprava o modelu mjeri od izvora, dakle od plohe.

_KVART = (43.5249, 16.4993)  # KVART_CENTER iz src/lib/map-views.ts


def _odnos(od: tuple[float, float], lon: float, lat: float) -> tuple[float, float]:
    """Vraća (udaljenost u km, azimut u stupnjevima) od zadane točke."""
    dx = (lon - od[1]) * M_PO_LON
    dy = (lat - od[0]) * M_PO_LAT
    return math.hypot(dx, dy) / 1000.0, (math.degrees(math.atan2(dx, dy)) + 360) % 360


POSTAJE_VJETRA = []
for _v in postaje_vjetra.POSTAJE_VJETRA:
    _dk, _ak = _odnos(_KVART, _v.lon, _v.lat)
    _dp, _ap = _odnos((_PY, _PX), _v.lon, _v.lat)
    POSTAJE_VJETRA.append(
        {
            "oznaka": _v.oznaka,
            "naziv": _v.naziv,
            "mreza": _v.mreza,
            "lat": _v.lat,
            "lon": _v.lon,
            "visina": _v.visina,
            "podrijetlo": _v.podrijetlo,
            "odKvartaKm": round(_dk, 1),
            "azimutOdKvarta": round(_ak),
            "odPloheKm": round(_dp, 1),
            "azimutOdPlohe": round(_ap),
        }
    )

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
    # Granice u WGS84, da se u prikazu može projicirati i točka koje ovdje
    # nema — bez druge kopije istih brojki na strani preglednika.
    "granice": {"zapad": Z, "jug": J, "istok": I, "sjever": S},
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
    f"export const POSTAJE = {ts(POSTAJE)} as const;",
    "",
    f"export const VRH_PLOHE = {ts(VRH_PLOHE)};",
    "",
    f"export const POSTAJE_VJETRA = {ts(POSTAJE_VJETRA)} as const;",
    "",
    "",
    "",
]

IZLAZ.parent.mkdir(parents=True, exist_ok=True)
IZLAZ.write_text("\n".join(redovi), encoding="utf8")

# Isti podatak i kao geojson, jer ga `/karta` uzima kao sloj s pribadačama.
IZLAZ_POSTAJE.write_text(
    json.dumps(
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        k: v
                        for k, v in p.items()
                        if k not in ("x", "y", "uOkviru", "izvanOkviraM")
                    },
                    "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
                }
                for p in POSTAJE
            ],
        },
        ensure_ascii=False,
        indent=1,
    )
    + "\n",
    encoding="utf8",
)

IZLAZ_VJETAR.write_text(
    json.dumps(
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": p,
                    "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
                }
                for p in POSTAJE_VJETRA
            ],
        },
        ensure_ascii=False,
        indent=1,
    )
    + "\n",
    encoding="utf8",
)

print(f"okvir {SIRINA:.0f}x{VISINA} px, {SIRINA_M:.0f}x{VISINA_M:.0f} m")
print(f"azimut prema kvartu {AZIMUT}°")
print(f"visine {VISINE}")
print(f"točaka {len(TOCKE)}, tokova s plohe {len(odabrani)} (sjeme {len(sjeme)})")
print(f"VIIRS ćelija {len(VIIRS)}")
for _p in POSTAJE:
    print(
        f"{_p['naziv']}: {_p['visina']} m, {_p['odPlohe']} m od plohe na "
        f"{_p['azimut']}°, kut prema Dračevcu {_p['kutDracevac']}°, "
        + ("u okviru" if _p["uOkviru"] else f"{_p['izvanOkviraM']} m izvan okvira")
    )
print(f"vrh plohe {VRH_PLOHE} m")
for _v in POSTAJE_VJETRA:
    print(
        f"vjetar {_v['naziv']}: {_v['odKvartaKm']} km od kvarta na "
        f"{_v['azimutOdKvarta']}°, {_v['odPloheKm']} km od plohe"
    )
print(f"zapisano {IZLAZ.relative_to(KORIJEN)} ({IZLAZ.stat().st_size // 1024} kB)")
