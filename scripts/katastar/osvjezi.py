#!/usr/bin/env python3
"""Katastarske čestice Grada Splita s DGU-ove INSPIRE usluge — skida se samo ono
što se promijenilo od zadnjeg pokretanja.

Izvor:  https://api.uredjenazemlja.hr/services/inspire/cp/wfs
        (cp:CadastralParcel, cp:CadastralZoning). Anonimno, a katalog OSS-a
        za uslugu kaže „nema uvjeta za pristup i korištenje”. Usluga čita
        živu bazu: 22 od 22 provjerene čestice podudarale su se s OSS
        preglednikom u međama, ID-u i datumu, i one promijenjene istog dana.

Zamjenjuje gradski izvoz KATASTAR/CADASTRAL_PARCELS_2024_P.shp (izrađen
23. 5. 2024.). Pokriva istih devet katastarskih općina, a polja KO_NAZIV i
KC_BROJ zovu se isto kao ondje, pa potrošači trebaju promijeniti samo putanju.

Spremište (vidi spremiste.py; dijele ga svi worktreeovi jednog klona):
  <glavna kopija>/data/sources/katastar-dgu/
    cestice.gpkg    sloj `cestice` (EPSG:3765): KO_NAZIV, KC_BROJ, KO_MB
                    (matični broj KO), CESTICA_ID (isti kao u OSS-u),
                    POVRSINA (službena, m²; izmjerena gdje je DGU nema),
                    DATUM (dan zadnje promjene čestice)
                    sloj `katastarske_opcine`: KO_MB, KO_NAZIV, DATUM
    stanje.json     kad je zadnji put osvježeno i koliko je čestica po KO
    promjene.jsonl  redak po pokretanju: dodane, promijenjene, uklonjene

Kako se skida samo promijenjeno:
  1. Čestica nosi beginLifespanVersion, dan zadnje promjene. Jedan upit
     And(BBOX grada, datum ≥ zadnje osvježavanje − PREKLOP_DANA) vrati
     sve što se od tada promijenilo, u svim KO unutar okvira grada.
  2. Nestale čestice (dioba, spajanje, prijelaz u drugu KO) u tom upitu
     ne dolaze. Na zemljištu koje su pokrivale sad leži promijenjena
     čestica, pa se svaka lokalna čestica koju promijenjene prekrivaju
     provjeri po ID-u (fes:ResourceId). One kojih poslužitelj više nema
     brišu se.
  3. Na kraju se broj čestica po KO usporedi s poslužiteljem
     (resultType=hits). Promakne li nešto, broj se ne slaže, pa se takva
     KO skine cijela.
  Cijelo se skida i prvi put, s --puno i kad je zadnje puno skidanje
  starije od PUNO_NAJKASNIJE_DANA.

Hirovi poslužitelja (provjereno 24. 9. 2026.):
  - najviše 1000 objekata po upitu, izlaz samo GML 3.2;
  - prostorni upit traje ~15 s bez obzira na veličinu, atributni < 1 s,
    a LIKE nad brojem čestice (za prebrojavanje KO) ~1 min;
  - KVP `bbox=` radi za čestice, a fes:BBOX samo unutar fes:And;
  - KVP `resourceId=` gateway odbija praznim 400, fes:ResourceId radi;
  - datum se uspoređuje kao lokalni dan (22:00Z prethodnog dana prolazi
    filtar „≥ ovaj dan”), pa preklop od nekoliko dana ionako treba;
  - pod teretom vraća 503 ili ORA-01000, pa najviše TOKOVA upita odjednom.

Pokretanje:  npm run katastar:osvjezi            (samo promjene)
             npm run katastar:osvjezi -- --puno  (sve iznova)
Traži:       geopandas/pyogrio, shapely
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely.geometry import MultiPolygon, Polygon, box

from spremiste import jednodijelne, mapa as mapa_spremista

WFS = "https://api.uredjenazemlja.hr/services/inspire/cp/wfs"
# Katastarske općine Grada Splita, po matičnom broju — istih devet koje
# pokriva gradski izvoz. Imena dolaze s poslužitelja (ime SITNO nosi i
# jedna KO u Zagorju, pa se bira po broju, ne po imenu).
KO_GRADA = [329789, 329819, 329827, 329835, 329851, 329860, 329878, 339130, 339148]

NAJVISE = 1000  # poslužiteljev strop objekata po upitu
PLOCICA = 1000.0  # m, početna pločica punog skidanja; puna se dijeli na četiri
TOKOVA = 3
PREKLOP_DANA = 45
PUNO_NAJKASNIJE_DANA = 180
ID_PO_UPITU = 50
# Lokalna čestica je kandidat za brisanje kad je promijenjene prekrivaju
# barem ovoliko: rubni dodir i ±1 cm razlike u lomnim točkama nisu preklop.
PREKLOP_M2 = 1.0
PREKLOP_UDIO = 0.01

HR = ZoneInfo("Europe/Zagreb")
NS = {
    "wfs": "http://www.opengis.net/wfs/2.0",
    "gml": "http://www.opengis.net/gml/3.2",
    "cp": "http://inspire.ec.europa.eu/schemas/cp/4.0",
    "base": "http://inspire.ec.europa.eu/schemas/base/3.3",
    "gn": "http://inspire.ec.europa.eu/schemas/gn/4.0",
    "ows": "http://www.opengis.net/ows/1.1",
}
FES_NS = (
    'xmlns:fes="http://www.opengis.net/fes/2.0" '
    'xmlns:gml="http://www.opengis.net/gml/3.2" '
    'xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0"'
)
CRS = "urn:ogc:def:crs:EPSG::3765"
STUPCI = ["CESTICA_ID", "KO_MB", "KO_NAZIV", "KC_BROJ", "POVRSINA", "DATUM"]


# ---- poslužitelj -----------------------------------------------------------


class Posluzitelj:
    """GetFeature uz ponavljanje: poslužitelj pod teretom vraća 503 ili grešku baze."""

    def __init__(self) -> None:
        self.upita = 0
        self.sekundi = 0.0

    def get(self, params: dict[str, str], pokusaja: int = 5) -> ET.Element:
        q = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", **params}
        url = WFS + "?" + urllib.parse.urlencode(q)
        zadnja: Exception | None = None
        for i in range(pokusaja):
            t = time.time()
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "kvart-katastar/1.0"})
                with urllib.request.urlopen(req, timeout=300) as r:
                    tijelo = r.read()
                korijen = ET.fromstring(tijelo)
                if korijen.tag.endswith("ExceptionReport"):
                    poruka = "".join(korijen.itertext()).strip()
                    raise RuntimeError(poruka[:300])
                return korijen
            except (urllib.error.URLError, TimeoutError, ET.ParseError, RuntimeError, ConnectionError) as e:
                zadnja = e
                time.sleep(5 * (i + 1))
            finally:
                self.upita += 1
                self.sekundi += time.time() - t
        raise RuntimeError(f"upit nije uspio ni nakon {pokusaja} pokušaja: {zadnja}")


def filtar(*uvjeti: str) -> str:
    tijelo = uvjeti[0] if len(uvjeti) == 1 else "<fes:And>" + "".join(uvjeti) + "</fes:And>"
    return f"<fes:Filter {FES_NS}>{tijelo}</fes:Filter>"


def bbox_uvjet(b: tuple[float, float, float, float]) -> str:
    return (
        "<fes:BBOX><fes:ValueReference>cp:geometry</fes:ValueReference>"
        f'<gml:Envelope srsName="{CRS}"><gml:lowerCorner>{b[0]:.2f} {b[1]:.2f}</gml:lowerCorner>'
        f"<gml:upperCorner>{b[2]:.2f} {b[3]:.2f}</gml:upperCorner></gml:Envelope></fes:BBOX>"
    )


def od_datuma(dan: dt.date) -> str:
    return (
        "<fes:PropertyIsGreaterThanOrEqualTo><fes:ValueReference>cp:beginLifespanVersion</fes:ValueReference>"
        f"<fes:Literal>{dan.isoformat()}T00:00:00Z</fes:Literal></fes:PropertyIsGreaterThanOrEqualTo>"
    )


# ---- GML → zapisi ----------------------------------------------------------


def _tekst(el: ET.Element, put: str) -> str | None:
    e = el.find(put, NS)
    return e.text if e is not None and e.text else None


def _prsten(el: ET.Element) -> list[tuple[float, float]]:
    v = [float(x) for x in el.find(".//gml:posList", NS).text.split()]
    return list(zip(v[0::2], v[1::2]))


def _geometrija(el: ET.Element) -> Polygon | MultiPolygon:
    dijelovi = []
    for p in el.iter("{%s}Polygon" % NS["gml"]):
        vani = _prsten(p.find("gml:exterior", NS))
        rupe = [_prsten(r) for r in p.findall("gml:interior", NS)]
        dijelovi.append(Polygon(vani, rupe))
    return dijelovi[0] if len(dijelovi) == 1 else MultiPolygon(dijelovi)


def _dan(begin: str | None) -> str | None:
    """beginLifespanVersion → lokalni dan: 2026-08-31T22:00:00Z je 1. 9."""
    if not begin:
        return None
    t = dt.datetime.fromisoformat(begin.replace("Z", "+00:00"))
    return t.astimezone(HR).date().isoformat()


def cestice_iz(korijen: ET.Element) -> list[dict]:
    out = []
    for c in korijen.iterfind("wfs:member/cp:CadastralParcel", NS):
        ref = _tekst(c, "cp:nationalCadastralReference")
        if not ref or "-" not in ref:
            continue
        ko, broj = ref.split("-", 1)
        povrsina = _tekst(c, "cp:areaValue")
        geometrija = _geometrija(c.find("cp:geometry", NS))
        out.append({
            "CESTICA_ID": int(_tekst(c, "cp:inspireId//base:localId").removeprefix("CP.")),
            "KO_MB": int(ko),
            "KC_BROJ": _tekst(c, "cp:label") or broj,
            # Rijetka čestica nema službenu površinu (3 od 17 570 oko kvarta);
            # tad vrijedi izmjerena iz međa, da potrošači ne vide 0 m².
            "POVRSINA": float(povrsina) if povrsina else round(geometrija.area),
            "DATUM": _dan(_tekst(c, "cp:beginLifespanVersion")),
            "geometry": geometrija,
        })
    return out


# ---- skidanje ----------------------------------------------------------------


def katastarske_opcine(srv: Posluzitelj) -> gpd.GeoDataFrame:
    uvjeti = "".join(
        "<fes:PropertyIsEqualTo><fes:ValueReference>cp:nationalCadastalZoningReference</fes:ValueReference>"
        f"<fes:Literal>{mb}</fes:Literal></fes:PropertyIsEqualTo>"
        for mb in KO_GRADA
    )
    korijen = srv.get({"typeNames": "cp:CadastralZoning", "filter": filtar(f"<fes:Or>{uvjeti}</fes:Or>")})
    redovi = []
    for z in korijen.iterfind("wfs:member/cp:CadastralZoning", NS):
        redovi.append({
            "KO_MB": int(_tekst(z, "cp:nationalCadastalZoningReference")),
            "KO_NAZIV": _tekst(z, "cp:name//gn:text"),
            "DATUM": _dan(_tekst(z, "cp:beginLifespanVersion")),
            "geometry": _geometrija(z.find("cp:geometry", NS)),
        })
    ko = gpd.GeoDataFrame(redovi, geometry="geometry", crs=3765).sort_values("KO_MB").reset_index(drop=True)
    nema = sorted(set(KO_GRADA) - set(ko.KO_MB))
    if nema:
        raise SystemExit(f"poslužitelj nema katastarske općine {nema}")
    return ko


def _pokrij(podrucje, korak: float) -> list[tuple[float, float, float, float]]:
    x0, y0, x1, y1 = podrucje.bounds
    plocice = []
    for x in np.arange(x0, x1, korak):
        for y in np.arange(y0, y1, korak):
            b = (x, y, min(x + korak, x1), min(y + korak, y1))
            if podrucje.intersects(box(*b)):
                plocice.append(b)
    return plocice


def skini_podrucje(srv: Posluzitelj, podrucje, od: dt.date | None, plocice=None) -> dict[int, dict]:
    """Sve čestice (od `od` nadalje, ako je zadan) koje sijeku područje.

    Pločica koja vrati puni strop dijeli se na četiri i skida iznova.
    Vraća i čestice susjednih KO: trebaju za provjeru nestalih.
    """
    if plocice is None:
        plocice = _pokrij(podrucje, PLOCICA) if od is None else [podrucje.bounds]
    nadjeno: dict[int, dict] = {}
    t0, gotovo = time.time(), 0

    def jedna(b):
        if od is None:
            p = {"typeNames": "cp:CadastralParcel", "count": str(NAJVISE),
                 "bbox": ",".join(f"{v:.2f}" for v in b) + "," + CRS}
        else:
            p = {"typeNames": "cp:CadastralParcel", "count": str(NAJVISE),
                 "filter": filtar(bbox_uvjet(b), od_datuma(od))}
        return b, cestice_iz(srv.get(p))

    ukupno = 0
    with cf.ThreadPoolExecutor(TOKOVA) as bazen:
        red = list(plocice)
        while red:
            ukupno += len(red)
            iduci = []
            for b, cc in bazen.map(jedna, red):
                gotovo += 1
                if len(cc) >= NAJVISE:
                    x0, y0, x1, y1 = b
                    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
                    for d in [(x0, y0, xm, ym), (xm, y0, x1, ym), (x0, ym, xm, y1), (xm, ym, x1, y1)]:
                        if podrucje.intersects(box(*d)):
                            iduci.append(d)
                else:
                    for c in cc:
                        nadjeno[c["CESTICA_ID"]] = c
                if gotovo % 20 == 0:
                    print(f"    pločica {gotovo}/{ukupno + len(iduci)}, čestica {len(nadjeno)}, "
                          f"{time.time() - t0:.0f} s", flush=True)
            red = iduci
    print(f"    upita {gotovo}, čestica {len(nadjeno)}, {time.time() - t0:.0f} s", flush=True)
    return nadjeno


def po_id(srv: Posluzitelj, idovi: list[int]) -> dict[int, dict]:
    """Čestice po ID-u; one kojih poslužitelj više nema ne vraća."""
    nadjeno: dict[int, dict] = {}
    serije = [idovi[i:i + ID_PO_UPITU] for i in range(0, len(idovi), ID_PO_UPITU)]

    def jedna(serija):
        f = "".join(f'<fes:ResourceId rid="CP.{i}"/>' for i in serija)
        return cestice_iz(srv.get({"typeNames": "cp:CadastralParcel", "filter": filtar(f)}))

    with cf.ThreadPoolExecutor(TOKOVA) as bazen:
        for cc in bazen.map(jedna, serije):
            for c in cc:
                nadjeno[c["CESTICA_ID"]] = c
    return nadjeno


def prebroji(srv: Posluzitelj, mbovi: list[int]) -> dict[int, int]:
    def jedna(mb):
        f = filtar(
            '<fes:PropertyIsLike wildCard="*" singleChar="." escapeChar="!">'
            "<fes:ValueReference>cp:nationalCadastralReference</fes:ValueReference>"
            f"<fes:Literal>{mb}-*</fes:Literal></fes:PropertyIsLike>"
        )
        k = srv.get({"typeNames": "cp:CadastralParcel", "resultType": "hits", "filter": f})
        return mb, int(k.get("numberMatched"))

    with cf.ThreadPoolExecutor(TOKOVA) as bazen:
        return dict(bazen.map(jedna, mbovi))


# ---- spremište ---------------------------------------------------------------


def u_tablicu(zapisi, imena: dict[int, str]) -> gpd.GeoDataFrame:
    zapisi = list(zapisi)
    if not zapisi:
        return gpd.GeoDataFrame({s: [] for s in STUPCI}, geometry=[], crs=3765)
    g = gpd.GeoDataFrame(zapisi, geometry="geometry", crs=3765)
    g["KO_NAZIV"] = g.KO_MB.map(imena)
    return g[STUPCI + ["geometry"]]


def ucitaj(mapa: str) -> tuple[gpd.GeoDataFrame | None, dict]:
    put = os.path.join(mapa, "cestice.gpkg")
    stanje_put = os.path.join(mapa, "stanje.json")
    if not (os.path.exists(put) and os.path.exists(stanje_put)):
        return None, {}
    with open(stanje_put, encoding="utf-8") as f:
        stanje = json.load(f)
    cestice = gpd.read_file(put, layer="cestice", engine="pyogrio")
    cestice = cestice.set_geometry(jednodijelne(cestice.geometry.values), crs=3765)
    cestice["POVRSINA"] = cestice.POVRSINA.fillna(cestice.area.round())
    return cestice, stanje


def spremi(mapa: str, cestice: gpd.GeoDataFrame, ko: gpd.GeoDataFrame, stanje: dict, promjene: dict) -> None:
    os.makedirs(mapa, exist_ok=True)
    cestice = cestice.sort_values(["KO_MB", "KC_BROJ", "CESTICA_ID"]).reset_index(drop=True)
    privremeno = os.path.join(mapa, "cestice.tmp.gpkg")
    if os.path.exists(privremeno):
        os.remove(privremeno)
    # GPKG se piše pod privremenim imenom i tek onda zamjenjuje: prekine li
    # se pisanje, stara datoteka i stanje ostaju usklađeni.
    cestice.to_file(privremeno, layer="cestice", driver="GPKG", engine="pyogrio")
    ko.to_file(privremeno, layer="katastarske_opcine", driver="GPKG", engine="pyogrio")
    os.replace(privremeno, os.path.join(mapa, "cestice.gpkg"))
    with open(os.path.join(mapa, "stanje.json"), "w", encoding="utf-8") as f:
        json.dump(stanje, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(os.path.join(mapa, "promjene.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(promjene, ensure_ascii=False) + "\n")


def razlika(staro: gpd.GeoDataFrame | None, novo: gpd.GeoDataFrame) -> dict[str, list]:
    """Dodane, promijenjene i uklonjene čestice, kao [KO, broj, ID]."""
    def oznaka(r):
        return [r.KO_NAZIV, r.KC_BROJ, int(r.CESTICA_ID)]

    if staro is None:
        return {"dodano": [], "promijenjeno": [], "uklonjeno": []}
    s = staro.set_index("CESTICA_ID")
    n = novo.set_index("CESTICA_ID")
    dodano = n.index.difference(s.index)
    uklonjeno = s.index.difference(n.index)
    zajedno = n.index.intersection(s.index)
    a, b = s.loc[zajedno], n.loc[zajedno]
    isto_polje = (a.KC_BROJ.values == b.KC_BROJ.values) & (a.KO_MB.values == b.KO_MB.values) & (
        a.DATUM.fillna("").values == b.DATUM.fillna("").values)
    ista_geo = shapely.equals_exact(np.asarray(a.geometry.values), np.asarray(b.geometry.values), tolerance=0.005)
    promijenjeno = zajedno[~(isto_polje & ista_geo)]
    return {
        "dodano": [oznaka(r) for r in novo[novo.CESTICA_ID.isin(dodano)].itertuples()],
        "promijenjeno": [oznaka(r) for r in novo[novo.CESTICA_ID.isin(promijenjeno)].itertuples()],
        "uklonjeno": [oznaka(r) for r in staro[staro.CESTICA_ID.isin(uklonjeno)].itertuples()],
    }


# ---- tijek -------------------------------------------------------------------


def puno(srv: Posluzitelj, ko: gpd.GeoDataFrame, mbovi: list[int]) -> list[dict]:
    podrucje = shapely.union_all(ko[ko.KO_MB.isin(mbovi)].geometry.values)
    print(f"  skidam cijele KO {mbovi} …", flush=True)
    sve = skini_podrucje(srv, podrucje, None)
    return [c for c in sve.values() if c["KO_MB"] in mbovi]


def samo_promjene(srv: Posluzitelj, ko: gpd.GeoDataFrame, lokalno: gpd.GeoDataFrame, od: dt.date) -> gpd.GeoDataFrame:
    """Primijeni promjene od `od` na lokalne čestice (koraci 1 i 2 iz opisa)."""
    imena = dict(zip(ko.KO_MB, ko.KO_NAZIV))
    podrucje = shapely.union_all(ko.geometry.values)
    print(f"  promjene od {od} …", flush=True)
    promijenjene = skini_podrucje(srv, podrucje, od)
    nase = {i: c for i, c in promijenjene.items() if c["KO_MB"] in imena}
    print(f"  promijenjenih čestica: {len(nase)} u KO grada, {len(promijenjene) - len(nase)} u susjednim",
          flush=True)
    if not promijenjene:
        return lokalno

    # Lokalne čestice na koje su legle promijenjene — možda više ne postoje.
    ostale = lokalno[~lokalno.CESTICA_ID.isin(nase.keys())].reset_index(drop=True)
    njihove = np.asarray(ostale.geometry.values)
    geo = np.asarray([c["geometry"] for c in promijenjene.values()])
    lijevo, desno = shapely.STRtree(geo).query(njihove, predicate="intersects")
    presjek = shapely.area(shapely.intersection(njihove[lijevo], geo[desno]))
    prekriveno = pd.Series(presjek).groupby(lijevo).sum()
    povrsine = shapely.area(njihove)
    kandidati = [
        int(ostale.CESTICA_ID[i]) for i, p in prekriveno.items()
        if p > max(PREKLOP_M2, PREKLOP_UDIO * povrsine[i])
    ]
    # Čestica koja je prešla u KO izvan grada stigla je s tuđim KO_MB.
    kandidati += [int(i) for i in ostale.CESTICA_ID if int(i) in promijenjene and int(i) not in nase]
    kandidati = sorted(set(kandidati))
    zive = po_id(srv, kandidati) if kandidati else {}
    zive = {i: c for i, c in zive.items() if c["KO_MB"] in imena}
    nestale = set(kandidati) - set(zive)
    print(f"  prekrivenih lokalnih čestica: {len(kandidati)}; nestalo {len(nestale)}", flush=True)

    zadrzi = lokalno[~lokalno.CESTICA_ID.isin(set(nase) | set(zive) | nestale)]
    novo = u_tablicu(list(nase.values()) + list(zive.values()), imena)
    return pd.concat([zadrzi, novo], ignore_index=True)


def uskladi(srv: Posluzitelj, ko: gpd.GeoDataFrame, novo: gpd.GeoDataFrame, danas: dt.date) -> gpd.GeoDataFrame:
    """Korak 3: broj čestica po KO mora se slagati s poslužiteljem.

    Baza je živa, pa razlika najčešće znači upis dok je skidanje trajalo:
    prvo se zato ponovno dohvate promjene zadnja dva dana. Tek ako ni
    tada nije isto, KO se skida cijela.
    """
    imena = dict(zip(ko.KO_MB, ko.KO_NAZIV))

    def krive(mbovi):
        na_posluzitelju = prebroji(srv, mbovi)
        lokalno_po_ko = novo.KO_MB.value_counts().to_dict()
        krivo = [mb for mb in mbovi if lokalno_po_ko.get(mb, 0) != na_posluzitelju[mb]]
        opis = ", ".join(f"{imena[mb]} {lokalno_po_ko.get(mb, 0)} ≠ {na_posluzitelju[mb]}" for mb in krivo)
        return krivo, opis

    print("  brojim čestice po KO na poslužitelju …", flush=True)
    krivo, opis = krive(list(imena))
    if not krivo:
        return novo
    print(f"  ne slaže se ({opis}); dohvaćam promjene nastale tijekom rada …", flush=True)
    novo = samo_promjene(srv, ko, novo, danas - dt.timedelta(days=2))
    krivo, opis = krive(krivo)
    if not krivo:
        return novo
    print(f"  i dalje se ne slaže ({opis}); te KO skidam cijele.", flush=True)
    cijele = u_tablicu(puno(srv, ko, krivo), imena)
    novo = pd.concat([novo[~novo.KO_MB.isin(krivo)], cijele], ignore_index=True)
    krivo, opis = krive(krivo)
    if krivo:
        # Ostaje samo upis u posljednjim minutama; sljedeće ga pokretanje
        # pokupi kao promjenu.
        print(f"  ! nakon punog skidanja i dalje: {opis}", flush=True)
    return novo


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--puno", action="store_true", help="skini sve iznova, ne samo promjene")
    args = ap.parse_args()

    mapa = mapa_spremista()
    pocetak = dt.datetime.now(dt.timezone.utc)
    danas = pocetak.astimezone(HR).date()
    srv = Posluzitelj()
    lokalno, stanje = ucitaj(mapa)
    print(f"Spremište: {mapa}")

    ko = katastarske_opcine(srv)
    imena = dict(zip(ko.KO_MB, ko.KO_NAZIV))

    zadnje_puno = dt.date.fromisoformat(stanje["zadnje_puno"]) if stanje.get("zadnje_puno") else None
    razlog = (
        "nema spremišta" if lokalno is None
        else "--puno" if args.puno
        else f"zadnje puno skidanje {zadnje_puno}" if (danas - zadnje_puno).days > PUNO_NAJKASNIJE_DANA
        else None
    )
    if razlog:
        print(f"Puno skidanje ({razlog}).")
        novo = u_tablicu(puno(srv, ko, list(imena)), imena)
        nacin, zadnje_puno = "puno", danas
    else:
        od = dt.date.fromisoformat(stanje["zadnje_osvjezavanje"][:10]) - dt.timedelta(days=PREKLOP_DANA)
        print(f"Samo promjene (zadnje osvježavanje {stanje['zadnje_osvjezavanje'][:10]}).")
        novo = samo_promjene(srv, ko, lokalno, od)
        nacin = "promjene"

    novo = uskladi(srv, ko, novo, danas)

    novo = gpd.GeoDataFrame(novo, geometry="geometry", crs=3765)
    novo = novo.drop_duplicates("CESTICA_ID", keep="last")
    r = razlika(lokalno, novo)
    promjene = {
        "vrijeme": pocetak.isoformat(timespec="seconds"),
        "nacin": nacin,
        "cestica": int(len(novo)),
        **{k: (v if len(v) <= 5000 else len(v)) for k, v in r.items()},
    }
    stanje = {
        "izvor": WFS,
        "zadnje_osvjezavanje": pocetak.isoformat(timespec="seconds"),
        "zadnje_puno": zadnje_puno.isoformat(),
        "najnovija_promjena": novo.DATUM.dropna().max(),
        "cestica": int(len(novo)),
        "ko": {imena[mb]: int(n) for mb, n in sorted(novo.KO_MB.value_counts().items())},
    }
    spremi(mapa, novo, ko, stanje, promjene)
    print(
        f"Gotovo: {len(novo)} čestica; dodano {len(r['dodano'])}, promijenjeno {len(r['promijenjeno'])}, "
        f"uklonjeno {len(r['uklonjeno'])}. Upita {srv.upita}, {time.time() - pocetak.timestamp():.0f} s."
    )
    if nacin == "puno" or any(r.values()):
        print(
            "Izvedeni slojevi osvježavaju se zasebno:\n"
            "  npm run import-grad-geo -- katastar   čestice kvarta za kartu i dosje\n"
            "  npm run slobodne-parcele              slobodne čestice kvarta (traži GDAL)\n"
            "  npm run gup-grad:cestice              iskorištenost po GUP-u (traži .cache/gup-grad)"
        )


if __name__ == "__main__":
    sys.exit(main())
