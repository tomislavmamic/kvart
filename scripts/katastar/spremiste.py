"""Gdje živi spremište katastarskih čestica s DGU-a (puni ga osvjezi.py).

Spremište nije u gitu (~40 MB, a mijenja se sa svakim osvježavanjem).
Leži u data/sources/katastar-dgu/ glavne kopije repozitorija — roditelja
zajedničke .git mape — pa ga svi worktreeovi istog klona dijele i
osvježavaju samo promjenama. KATASTAR_DGU=<mapa> ga premješta.
"""
from __future__ import annotations

import os
import subprocess


def mapa() -> str:
    if os.environ.get("KATASTAR_DGU"):
        return os.path.abspath(os.environ["KATASTAR_DGU"])
    git = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return os.path.join(os.path.dirname(git), "data", "sources", "katastar-dgu")


def cestice() -> str:
    """Putanja do cestice.gpkg (slojevi `cestice` i `katastarske_opcine`)."""
    put = os.path.join(mapa(), "cestice.gpkg")
    if not os.path.exists(put):
        raise SystemExit(f"nema {put} — prvo pokreni: npm run katastar:osvjezi")
    return put


def jednodijelne(geometrije):
    """Jednodijelni MultiPolygon natrag u Polygon.

    GeoPackage sloj ima jednu vrstu geometrije, pa pyogrio pri pisanju sve
    čestice podigne u MultiPolygon. Bez ovoga svježe skinuta čestica nije
    „jednaka” istoj iz spremišta, a izvoz bi promijenio vrstu svih čestica.
    """
    import numpy as np
    import shapely

    g = np.array(geometrije, dtype=object)
    jedan = (shapely.get_type_id(g) == 6) & (shapely.get_num_geometries(g) == 1)
    g[jedan] = shapely.get_geometry(g[jedan], 0)
    return g
