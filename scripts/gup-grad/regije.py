#!/usr/bin/env python3
"""Gdje je unutar čestice zauzeto, a gdje slobodno — na rešetki od 2 m.

Karta na /gup boji čestice po zbrojevima (koliko je iskorišteno), ali ne
pokazuje GDJE. Ova skripta svaki piksel čestice razvrsta u jednu regiju, istim
redom kojim izracun.ts broji:

  1 zgrada · 2 gradilište · 3 ulica · 4 parkiralište · 5 okoliš javne
  ustanove · 6 uređeno (šport, igralište, trg) · 7 infrastruktura ·
  8 održavano zelenilo · 9 okućnica · 10 slobodno za gradnju · 11 preusko ·
  12 premalo · 13 odredbe ne dopuštaju gradnju · 14 neizgradiv teren

Sve što ima položaj (zgrade, ulice, parkirališta…) čita se iz maski koje je
zapisao cestice.py. Okućnica položaja nema — izračun zna samo koliko joj
zemljišta treba (regije.ts). Ovdje se crta na slobodnim pikselima komada:
prvo na uskim pojasevima (izracun.ts ih okućnici daje prvo), pa na onima
NAJBLIŽIMA zgradi, dok se ne potroši; to je prikaz, ne međa građevne čestice.
Razlog zbog kojeg slobodno nije za gradnju je iz izračuna po komadu, a
„preusko” iz iste maske širine kao u cestice.py.

Uz regiju svaki piksel nosi sklad s planom (0 nema suda, 1 po planu,
2 protivno) i klasu namjene. Izlaz su PNG pločice u Web Mercatoru u kojima su
BROJEVI, ne boje (R = klasa, G = regija, B = sklad, A = 255 na čestici);
karta ih boji u pregledniku prema odabranom načinu „Boja karte”.

  public/geo/gup-grad/regije/<godina>/<red>_<stupac>.png
  public/geo/gup-grad/regije.json    {korak, pločice po godini s granicama}

Pokretanje (poslije cestice.py i regije.ts):
  /opt/homebrew/bin/python3 scripts/gup-grad/regije.py
"""
from __future__ import annotations

import json
import os
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rasteriziraj as R  # noqa: E402

KARTA = os.path.join(R.ROOT, "public", "geo", "gup-grad")
IZLAZ = os.path.join(KARTA, "regije")
MASKE = os.path.join(R.OUT, "maske.npz")
GODINE = [("gup-2006", 2006), ("gup-2015", 2015), ("gup-2025", 2025)]

ZGRADA, GRADILISTE, ULICA, PARKIRALISTE, JAVNA, UREDJENO, INFRA, ZELENILO = range(1, 9)
OKUCNICA, SLOBODNO, USKO, PREMALO, ZABRANJENO, NEIZGRADIVO = range(9, 15)

# vrsta korištenja po pikselu, za sklad s planom (imena kao VrstaKoristenja u pravila.ts)
VRSTE = ["", "stambena", "gospodarska", "javna", "pomocna", "ostala", "neevidentirana",
         "gradiliste", "promet", "parkiraliste", "javna", "uredjeno", "ostala", "zelenilo"]
# ručni pregled (rucno_vrste u cestice.json) → regija i vrsta, kao RUCNO_KAO u izracun.ts
RUCNO = {"parkiraliste": (PARKIRALISTE, 9), "javna": (JAVNA, 10), "uredjeno": (UREDJENO, 11),
         "zelenilo": (ZELENILO, 13), "gradiliste": (GRADILISTE, 7), "izgradjeno": (ZGRADA, 6),
         "promet": (ULICA, 8), "infrastruktura": (INFRA, 12), "neizgradivo": (NEIZGRADIVO, 0)}
KORAK_MERC = 2.5  # m Web Mercatora (~1,8 m na tlu) — blizu izvornih 2 m
PLOCICA = 512


def regije_godine(m, kl, ts, rucno) -> tuple[np.ndarray, np.ndarray]:
    """Regija i sklad za svaki piksel čestice u obuhvatu, za jednu godinu."""
    from scipy import ndimage

    ids = m["ids"]
    u = (ids > 0) & (kl > 0) & m["obuhvat"]
    reg = np.zeros(kl.shape, np.uint8)
    vrsta = np.zeros(kl.shape, np.uint8)

    def stavi(maska, r, v):
        x = maska & u & (reg == 0)
        reg[x] = r
        vrsta[x] = v

    zk = m["zk"]
    zgrada = (zk > 0) | m["z25"]
    # zgrade: katastarska skupina 1–5, inače samo u 3D modelu
    for s in range(1, 6):
        stavi(zk == s, ZGRADA, s)
    stavi(m["z25"], ZGRADA, 6)
    stavi(m["gr"], GRADILISTE, 7)
    stavi(m["pr"], ULICA, 8)
    stavi(m["pa"], PARKIRALISTE, 9)
    stavi(m["jv"], JAVNA, 10)
    stavi(m["os"], UREDJENO, 11)
    stavi(m["inf"], INFRA, 12)
    stavi(m["ze"], ZELENILO, 13)

    # komad = čestica × klasa; podaci iz izračuna po komadu
    kljuc = ids.astype(np.int64) * 64 + kl
    okuc, prot, zast = {}, {}, {}
    for c, k, px, p, z in ts["komadi"]:
        kk = (c + 1) * 64 + k
        okuc[kk], prot[kk], zast[kk] = px, p, z

    # cijeli komad je ulica (izračun ga izuzima cijelog): sve osim zgrada
    ulice = np.array([kk for kk, z in zast.items() if z & 8], np.int64)
    if len(ulice):
        x = u & np.isin(kljuc, ulice) & ~zgrada
        reg[x] = ULICA
        vrsta[x] = 8

    # ručni pregled popunjava ono što je na čestici ostalo slobodno
    for vr, cestice in rucno.items():
        if vr not in RUCNO:
            continue
        r, v = RUCNO[vr]
        stavi(np.isin(ids, cestice), r, v)

    # okućnica: slobodni pikseli komada, koliko izračun kaže — prvo uski
    # (pojasevi oko kuće; izracun.ts ih okućnici daje prvo), pa najbliži zgradi
    slob = u & (reg == 0)
    udaljenost = ndimage.distance_transform_edt(~zgrada)
    k_s = kljuc[slob]
    d_s = udaljenost[slob]
    w_s = m[f"siroko_{GOD}"][slob]
    red = np.lexsort((d_s, w_s, k_s))
    ks = k_s[red]
    _, prvi, inv = np.unique(ks, return_index=True, return_inverse=True)
    rang = np.arange(len(ks)) - prvi[inv]
    treba = np.array([okuc.get(int(x), 0) for x in np.unique(ks)], np.int64)[inv]
    je_okuc = np.zeros(len(ks), bool)
    je_okuc[red] = rang < treba
    ri, ci = np.nonzero(slob)
    reg[ri[je_okuc], ci[je_okuc]] = OKUCNICA

    # ostatak slobodnog po razlogu
    slob = u & (reg == 0)
    zast_px = np.zeros(slob.sum(), np.int64)
    kz = kljuc[slob]
    uk, inv = np.unique(kz, return_inverse=True)
    zast_px = np.array([zast.get(int(x), 0) for x in uk], np.int64)[inv]
    siroko = m[f"siroko_{GOD}"][slob]
    r_s = np.full(len(kz), SLOBODNO, np.uint8)
    r_s[(zast_px & 4) > 0] = PREMALO
    r_s[~siroko] = USKO
    r_s[(zast_px & 2) > 0] = NEIZGRADIVO
    r_s[(zast_px & 1) > 0] = ZABRANJENO
    reg[slob] = r_s

    # sklad s planom: vrsta korištenja dopuštena u namjeni piksela
    kodovi = ts["klase"]
    dop = np.zeros((64, len(VRSTE)), bool)
    for ind, kod in kodovi.items():
        dopusteno = set(ts["dopusteno"].get(kod, []))
        for vi, ime in enumerate(VRSTE):
            dop[int(ind), vi] = bool(ime) and ime in dopusteno
    skl = np.where(vrsta > 0, np.where(dop[kl, vrsta], 1, 2), 0).astype(np.uint8)
    # ulica izuzeta iz zone nije ni u skladu ni protivna; u P jest namjena
    p_ind = next(int(i) for i, k in kodovi.items() if k == "P")
    skl[(reg == ULICA) & (vrsta == 8) & (kl != p_ind)] = 0
    # okućnica dijeli sud zgrade uz koju je (udio protivnog po komadu)
    o = reg == OKUCNICA
    ko = kljuc[o]
    uk, inv = np.unique(ko, return_inverse=True)
    pr_o = np.array([prot.get(int(x), 0) for x in uk])[inv]
    skl[o] = np.where(pr_o >= 0.5, 2, 1)
    skl[~u] = 0
    return reg, skl


def mercator(slika: np.ndarray):
    """Rešetka EPSG:3765 → Web Mercator, najbližim susjedom (brojevi, ne boje)."""
    from pyproj import Transformer

    u_3765 = Transformer.from_crs(3857, 3765, always_xy=True)
    u_3857 = Transformer.from_crs(3765, 3857, always_xy=True)
    x0, y0, x1, y1 = R.MREZA_BBOX
    xs, ys = u_3857.transform([x0, x1, x0, x1], [y0, y0, y1, y1])
    mx0, mx1, my0, my1 = min(xs), max(xs), min(ys), max(ys)
    w = int((mx1 - mx0) / KORAK_MERC)
    h = int((my1 - my0) / KORAK_MERC)
    out = np.zeros((h, w, 4), np.uint8)
    stupci = mx0 + (np.arange(w) + 0.5) * KORAK_MERC
    for r0 in range(0, h, 256):
        redovi = my1 - (np.arange(r0, min(h, r0 + 256)) + 0.5) * KORAK_MERC
        MX, MY = np.meshgrid(stupci, redovi)
        X, Y = u_3765.transform(MX, MY)
        c_ = np.floor((X - x0) / R.KORAK).astype(np.int64)
        r_ = np.floor((y1 - Y) / R.KORAK).astype(np.int64)
        ok = (c_ >= 0) & (r_ >= 0) & (c_ < slika.shape[1]) & (r_ < slika.shape[0])
        v = np.zeros(MX.shape + (4,), np.uint8)
        v[ok] = slika[r_[ok], c_[ok]]
        out[r0:r0 + v.shape[0]] = v
    return out, (mx0, my1)


def main() -> None:
    global GOD
    from PIL import Image
    from pyproj import Transformer

    m = dict(np.load(MASKE))
    d = json.load(open(os.path.join(R.ROOT, "data", "gup-grad", "cestice.json")))
    vrste = d.get("rucno_vrste", [])
    rucno: dict[str, list[int]] = {}
    for i, r in enumerate(d["cestice"].get("rucno", [])):
        if r:
            rucno.setdefault(vrste[r - 1], []).append(i + 1)  # ids su 1-based
    rucno = {k: np.array(v) for k, v in rucno.items()}

    if os.path.isdir(IZLAZ):
        shutil.rmtree(IZLAZ)
    u_4326 = Transformer.from_crs(3857, 4326, always_xy=True)
    indeks = {"korak": KORAK_MERC, "godine": {}}
    for gid, god in GODINE:
        GOD = god
        kl = np.load(os.path.join(R.OUT, f"klase-{gid}.npy"))
        ts = json.load(open(os.path.join(R.OUT, f"regije-{god}.json")))
        reg, skl = regije_godine(m, kl, ts, rucno)
        slika = np.zeros(kl.shape + (4,), np.uint8)
        na = reg > 0
        slika[..., 0] = np.where(na, kl, 0)
        slika[..., 1] = reg
        slika[..., 2] = skl
        slika[..., 3] = np.where(na, 255, 0)
        merc, (mx0, my1) = mercator(slika)
        del slika
        mapa = os.path.join(IZLAZ, str(god))
        os.makedirs(mapa, exist_ok=True)
        plocice = []
        for r in range(0, merc.shape[0], PLOCICA):
            for c in range(0, merc.shape[1], PLOCICA):
                t = merc[r:r + PLOCICA, c:c + PLOCICA]
                if not t[..., 3].any():
                    continue
                ime = f"{r // PLOCICA}_{c // PLOCICA}.png"
                Image.fromarray(t, "RGBA").save(os.path.join(mapa, ime), optimize=True)
                w_, s_ = u_4326.transform(mx0 + c * KORAK_MERC, my1 - (r + t.shape[0]) * KORAK_MERC)
                e_, n_ = u_4326.transform(mx0 + (c + t.shape[1]) * KORAK_MERC, my1 - r * KORAK_MERC)
                plocice.append({"url": f"/geo/gup-grad/regije/{god}/{ime}",
                                "granice": [[round(s_, 6), round(w_, 6)], [round(n_, 6), round(e_, 6)]]})
        indeks["godine"][str(god)] = plocice
        vel = sum(os.path.getsize(os.path.join(mapa, f)) for f in os.listdir(mapa))
        n = np.bincount(reg[na], minlength=15) * R.KORAK * R.KORAK / 1e4
        print(god, len(plocice), "pločica", round(vel / 1e6, 1), "MB;",
              "ha po regiji:", {i: round(float(x), 1) for i, x in enumerate(n) if x})
    with open(os.path.join(KARTA, "regije.json"), "w") as f:
        json.dump(indeks, f)


GOD = 0

if __name__ == "__main__":
    main()
