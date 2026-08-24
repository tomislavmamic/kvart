"""Provjere podesive fizike u `oblacici.py`.

Pokretanje: /opt/homebrew/bin/python3 -m unittest scripts.test_oblacici_ugodba
(ili izravno: /opt/homebrew/bin/python3 scripts/test_oblacici_ugodba.py)
"""

from __future__ import annotations

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import oblacici  # noqa: E402
from reljef_polje import RASPRSENJE, gladi, maska_plohe, ucitaj_reljef  # noqa: E402


def _roj_jednog(razred: int, dob: float) -> oblacici.Roj:
    """Roj s jednim oblačićem zadanog razreda i starosti, bez puta."""
    return oblacici.Roj(
        x=np.array([0.0]),
        y=np.array([0.0]),
        put=np.array([0.0]),
        dob=np.array([dob]),
        masa=np.array([1.0]),
        razred=np.array([razred]),
        ux=np.array([0.0]),
        uy=np.array([0.0]),
    )


def _tocke_izvora() -> np.ndarray:
    maska = maska_plohe(RASPRSENJE)
    yi, xi = np.nonzero(maska)
    return np.stack(
        [
            RASPRSENJE.x0 + (xi + 0.5) * RASPRSENJE.dx,
            RASPRSENJE.y1 - (yi + 0.5) * RASPRSENJE.dx,
        ],
        1,
    )


def _sati_tisine(n: int, razred: int = 5, brzina: float = 0.5) -> list[oblacici.Sat]:
    return [
        oblacici.Sat(
            t=f"2025-01-01T{h:02d}:00Z",
            smjer=320.0,
            brzina=brzina,
            dubina=60.0,
            razred=razred,
        )
        for h in range(n)
    ]


class Zadano(unittest.TestCase):
    def test_zadana_ugodba_je_ugodeni_model(self) -> None:
        """Zadano = ugođena fizika: vrtloženje raste sa stabilnošću, bez
        meandra i drenaže (u ugađanju nisu dodali ništa povrh vrtloženja)."""
        ug = oblacici.Ugodba()
        self.assertEqual(ug.k_vrtlozenje, oblacici.K_PO_RAZREDU)
        self.assertEqual(ug.k_vrtlozenje[:3], (oblacici.K_VRTLOZENJE,) * 3)
        self.assertEqual(ug.k_vrtlozenje[3:], (6.0, 45.0, 120.0))
        self.assertEqual(ug.meander, 0.0)
        self.assertEqual(ug.drenaza, 0.0)
        self.assertEqual(ug.najmanja_brzina, oblacici.NAJMANJA_BRZINA)


class VrtlozenjePoRazredu(unittest.TestCase):
    def test_siri_stabilni_oblacic_a_nestabilni_ne_dira(self) -> None:
        k = np.array([1.0, 1.0, 1.0, 1.0, 1.0, 30.0])
        mirni, _ = _roj_jednog(5, 3600.0).sirine(k)
        stari, _ = _roj_jednog(5, 3600.0).sirine(np.ones(6))
        # sqrt(30² + 2·30·3600) ≈ 466 m naspram sqrt(30² + 2·3600) ≈ 89 m.
        self.assertGreater(mirni[0], 4 * stari[0])
        a_novi, _ = _roj_jednog(0, 3600.0).sirine(k)
        a_stari, _ = _roj_jednog(0, 3600.0).sirine(np.ones(6))
        self.assertAlmostEqual(float(a_novi[0]), float(a_stari[0]))


class Drenaza(unittest.TestCase):
    def test_ide_nizbrdo_i_slabi_na_ravnome(self) -> None:
        du, dv = oblacici._polje_drenaze(RASPRSENJE)
        self.assertEqual(du.shape, (RASPRSENJE.ny, RASPRSENJE.nx))
        snaga = np.hypot(du, dv)
        self.assertLessEqual(float(snaga.max()), 1.0 + 1e-6)
        self.assertGreater(float(snaga.max()), 0.9)
        self.assertLess(float(snaga.min()), 0.1)
        # Na ćeliji s izrazitim nagibom drenaža pokazuje prema nižem terenu.
        z = gladi(ucitaj_reljef(RASPRSENJE), 12)
        i, j = np.unravel_index(int(snaga.argmax()), snaga.shape)
        korak = 3
        i2 = int(np.clip(i - round(float(dv[i, j])) * korak, 0, RASPRSENJE.ny - 1))
        j2 = int(np.clip(j + round(float(du[i, j])) * korak, 0, RASPRSENJE.nx - 1))
        self.assertLess(z[i2, j2], z[i, j])


class Meander(unittest.TestCase):
    def test_rasprsi_perjanicu_pri_slabom_vjetru(self) -> None:
        """Uz meander tišina ne smije svu perjanicu poslati niz jedan smjer.

        Prijemnik uzvjetar od plohe (nasuprot javljenom smjeru) uz meander
        mora dobiti znatno više nego bez njega.
        """
        tocke = _tocke_izvora()
        teziste = tocke.mean(0)
        uzvjetar = np.array([[teziste[0] - 500.0, teziste[1] - 420.0]])
        sati = _sati_tisine(6)

        def zadnji(ug: oblacici.Ugodba) -> float:
            vrijednost = 0.0
            for _, v in oblacici.prodji(
                sati, tocke, 1.0, RASPRSENJE, prijemnici=uzvjetar, ugodba=ug
            ):
                vrijednost = float(v[0])
            return vrijednost

        stara = (oblacici.K_VRTLOZENJE,) * 6
        bez = zadnji(oblacici.Ugodba(k_vrtlozenje=stara))
        s_meandrom = zadnji(oblacici.Ugodba(k_vrtlozenje=stara, meander=60.0))
        self.assertGreater(s_meandrom, 2 * bez)


if __name__ == "__main__":
    unittest.main()
