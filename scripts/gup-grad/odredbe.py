#!/usr/bin/env python3
"""Najmanje građevne čestice (Ppmin) iz odredbi GUP-a → sažeta tablica.

Ulaz: data/gup-grad/odredbe/izvor/ppmin-<godina>.json — izvadak odredbi za
provođenje po području urbanog pravila, s citatom i stranicom:
  2006: Sl. gl. 1/06 s izmjenama 3/08
  2015: pročišćeni tekst Sl. gl. 55/14
  2025: prijedlog ID GUP-a za ponovnu javnu raspravu (travanj 2025.)
Svaki citat je provjeren doslovno prema tekstu izvornika.

Izlaz: data/gup-grad/odredbe/ppmin.json — za svaku godinu i kod pravila
popis vrijednosti po vrsti korištenja:
  stanovanje   slobodnostojeća, dvojna, interpolacija, općenito, niz i
               vrijednosti za mješovitu namjenu (M1/M2)
  gospodarska  poslovna, proizvodna, zanatska (uklj. „nestambene” u M1)
  javna        zdravstvena, javna i društvena
Koje se vrste uzimaju u obzir odlučuje src/lib/gup-grad/pravila.ts.

Pokretanje:  python3 scripts/gup-grad/odredbe.py
"""
from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAPA = os.path.join(ROOT, "data", "gup-grad", "odredbe")

GOSPODARSKA = re.compile(r"poslovn|proizvod|zanat|TTTS|nestamben|\bK\b", re.I)
JAVNA = re.compile(r"zdravstv|javn|društv", re.I)
STANOVANJE = re.compile(r"mješovit|\bM1\b|\bM2\b|stamben|slobodnostoje", re.I)
TIPOVI = ("slobodnostojeca", "dvojna", "interpolacija", "opcenito", "niz")


def vrsta_namjene(tekst: str) -> str | None:
    # „stambeno-poslovne građevine” (M2) su stanovanje; „nestambene” u M1 nisu
    if re.search(r"stambeno", tekst, re.I) and not re.search(r"nestamben", tekst, re.I):
        return "stanovanje"
    if GOSPODARSKA.search(tekst):
        return "gospodarska"
    if JAVNA.search(tekst):
        return "javna"
    if STANOVANJE.search(tekst):
        return "stanovanje"
    return None


def izvor(e: dict, dokument: str) -> str:
    str_ = e.get("stranica_glasnika") or e.get("stranica_pdf")
    oznaka = "str." if e.get("stranica_glasnika") else "str. PDF-a"
    return f"{dokument}, {e.get('odjeljak', '')}".strip(", ") + (f", {oznaka} {str_}" if str_ else "")


def main() -> None:
    out = {"opis": "Izvedeno skriptom scripts/gup-grad/odredbe.py iz data/gup-grad/odredbe/izvor/.", "godine": {}, "opca": {}}
    for god, dok in ((2006, "Sl. gl. 1/06 i 3/08"), (2015, "Sl. gl. 55/14"), (2025, "prijedlog ID GUP-a, 2025.")):
        d = json.load(open(os.path.join(MAPA, "izvor", f"ppmin-{god}.json")))
        tab = {}
        for e in d["urbana_pravila"]:
            kod = re.sub(r"\s+", "", e["kod"])
            kod = "GP" if kod.startswith("GP") else kod
            pp = e.get("ppmin") or {}
            v: dict[str, list] = {"stanovanje": [], "gospodarska": [], "javna": []}
            for t in TIPOVI:
                if isinstance(pp.get(t), (int, float)):
                    v["stanovanje"].append({"tip": t, "m2": pp[t]})
            for x in pp.get("po_namjeni", []) or []:
                if not isinstance(x.get("m2"), (int, float)):
                    continue
                vr = vrsta_namjene(x.get("namjena", ""))
                if vr:
                    v[vr].append({"tip": x.get("namjena", ""), "m2": x["m2"]})
            for x in pp.get("varijante", []) or []:
                if isinstance(x.get("m2"), (int, float)):
                    vr = vrsta_namjene(x.get("uvjet", "") + " " + x.get("tip", "")) or "stanovanje"
                    v[vr].append({"tip": f"varijanta: {x.get('tip', '')}", "m2": x["m2"]})
            if kod in tab:  # GP1…GP11 → GP: spoji
                for k in v:
                    tab[kod][k].extend(v[k])
                continue
            tab[kod] = {**v, "naziv": e.get("naziv", ""), "izvor": izvor(e, dok), "citat": e.get("citat", ""),
                        "napomena": e.get("napomena", "")}
        out["godine"][str(god)] = tab
        out["opca"][str(god)] = [
            {"opis": o.get("opis", ""), "m2": o.get("m2"), "uvjet": o.get("uvjet", ""), "citat": o.get("citat", "")}
            for o in d.get("opca_pravila", [])
        ]
        s = {k: sum(1 for x in tab.values() if x[k]) for k in ("stanovanje", "gospodarska", "javna")}
        print(god, len(tab), "područja; s Ppmin:", s)
    with open(os.path.join(MAPA, "ppmin.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
