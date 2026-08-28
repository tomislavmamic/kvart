#!/usr/bin/env python3
"""Koliko su blizu postaje s `neverin.hr`, mjereno kao i sve ostale.

`docs/provjera-izvora-vjetra.md` završava ogradom da je najbliži anemometar na
4,3 km. Ova skripta odgovara na pitanje koliko bi ta ograda bila manja kad bi se
smjelo koristiti postaje koje objavljuje `neverin.hr` — vidi
`docs/neverin-postaje.md` za odgovor i za razlog zašto nijedna nije priključena.

Koordinate su prepisane iz odgovora `core.neverin.hr/stations/<slug>/last`
(polja `lat`, `lon`, `elevation`), dohvaćenog ručno 28. 8. 2026. Ovdje stoje kao
brojke upravo zato da skripta ne mora zvati tuđi poslužitelj: uvjeti korištenja
neverin.hr zabranjuju skriptirani pristup, pa ga u repozitoriju i nema.

Mjeri se istom ravninskom formulom i od istih dviju referentnih točaka kao u
`izvedi-karepovac-karticu.py` — od središta kvarta i od težišta plohe — da su
brojke usporedive s onima u `src/generated/karepovac-karta.ts`. Postojeće
postaje računaju se zajedno s novima; ako im brojke ispadnu kao u generiranom
modulu, formula je potvrđena.

Pokretanje: `python3 scripts/neverin_postaje.py`
"""

from __future__ import annotations

import math

_LAT0 = 43.52425  # sredina okvira, kao u scripts/okvir.py
M_PO_LON = 111320 * math.cos(math.radians(_LAT0))
M_PO_LAT = 110574

#: `KVART_CENTER` iz `src/lib/map-views.ts`.
KVART = (43.5249, 16.4993)

# Težište plohe nije ovdje izravno dostupno (računa ga `izvedi-karepovac-
# karticu.py` iz obrisa), pa se izvodi unatrag iz postaje Karepovac 1, koja u
# `src/generated/karepovac-karta.ts` stoji 676 m od njega na azimutu 140°.
_K1 = (43.516650515206784, 16.51691228544307)
_D, _AZ = 676.0, 140.0
PLOHA = (
    _K1[0] - _D * math.cos(math.radians(_AZ)) / M_PO_LAT,
    _K1[1] - _D * math.sin(math.radians(_AZ)) / M_PO_LON,
)

#: Postaje koje model danas koristi; koordinate iz `scripts/postaje_vjetra.py`.
POSTOJECE = (
    ("Split-3", "AZO", 43.50421139510805, 16.453605895567744, None),
    ("Split-2", "AZO", 43.5184711569566, 16.44246833781461, None),
    ("Split-Marjan", "DHMZ", 43.508333, 16.426333, 122),
    ("Split-aerodrom / LDSP", "DHMZ/METAR", 43.539, 16.301, 16),
)

#: Kandidati s `neverin.hr`; `mreza` je tko postaju doista drži, a ne relej.
NEVERIN = (
    ("Split-Vrboran", "Neverin", 43.515261, 16.496216, 74),
    ("Split-Duilovo", "Wunderground", 43.505000, 16.498000, 7),
    ("Split-Pujanke", "Wunderground", 43.516000, 16.473000, 82),
    ("Solin", "Wunderground", 43.544000, 16.484000, 63),
    ("Stobreč", "Wunderground", 43.502000, 16.521000, 17),
    ("Kaštel Sućurac-HPD Kozjak", "Neverin", 43.567569, 16.424115, 460),
)


def odnos(od: tuple[float, float], lat: float, lon: float) -> tuple[float, float]:
    """Vraća (udaljenost u km, azimut u stupnjevima) od zadane točke."""
    dx = (lon - od[1]) * M_PO_LON
    dy = (lat - od[0]) * M_PO_LAT
    return math.hypot(dx, dy) / 1000.0, (math.degrees(math.atan2(dx, dy)) + 360) % 360


def glavno() -> None:
    """Ispisuje sve postaje poredane po udaljenosti od kvarta."""
    print(f"težište plohe ≈ {PLOHA[0]:.6f}, {PLOHA[1]:.6f}\n")
    print(f"{'postaja':28s} {'mreža':14s} {'od kvarta':>16s} {'od plohe':>16s}  visina")
    print("-" * 88)

    redci = []
    for skup, tko in ((POSTOJECE, "sada"), (NEVERIN, "neverin")):
        for ime, mreza, lat, lon, vis in skup:
            dk, ak = odnos(KVART, lat, lon)
            dp, ap = odnos(PLOHA, lat, lon)
            redci.append((dk, ime, mreza, dk, ak, dp, ap, vis, tko))

    for _, ime, mreza, dk, ak, dp, ap, vis, tko in sorted(redci):
        v = f"{vis} m" if vis is not None else "—"
        print(
            f"{ime:28s} {mreza:14s} {dk:7.2f} km {ak:4.0f}°"
            f" {dp:7.2f} km {ap:4.0f}°  {v:>6s}  [{tko}]"
        )


if __name__ == "__main__":
    glavno()
