#!/usr/bin/env python3
"""Izdvaja katastarske čestice na kojima GUP dopušta stanovanje, a prazne su.

Sloj odgovara na jedno pitanje: gdje se u kvartu još može graditi stan.
Čestica prolazi ako zadovolji sva tri uvjeta:

  1. leži u zoni GUP-a koja dopušta stanovanje (S, M1, M2, M3, K5 —
     u kvartu se pojavljuju M1, K5 i spojena klasa M/K5),
  2. nije na trasi prometnice ni druge infrastrukture iz plana,
  3. na njoj nema zgrade.

Tri stvari koje treba znati prije čitanja brojki:

PODLOGA NAMJENE JE TRAG RASTERA, NE SLUŽBENI VEKTOR. GUP se ne objavljuje
kao vektorski sloj; plohe su ovdje dobivene praćenjem lista GUP-a na 1 m/px
i ručnim smještanjem (vidi scripts/trace-plans.py). Rub plohe zna odstupati
nekoliko metara, pa se namjena čestici ne pripisuje dodirom nego VEĆINOM
površine — čestica je stambena ako je ≥50 % njezine površine u stambenoj
zoni. Zbog istog razloga koridor mora pokriti ≥10 % čestice da bi je
oborio; sitni preklop je greška uklapanja, a ne cesta.

KLASA "M/K5" JE NERAZLUČENA, ALI TO OVDJE NE ŠKODI. List objema namjenama
daje istu boju (#e0a000) i razlikuju se samo otisnutim slovom, koje OCR
nije uvijek pročitao. Obje članice — M (mješovita) i K5 (poslovna namjena
i stanovanje) — dopuštaju stanovanje, pa nerazlučena ploha ulazi u račun
bez ograde.

"NIJE IZGRAĐENA" JE UNIJA ČETIRI EVIDENCIJE. Nijedna nije potpuna: Grad
2025. i OSM daju po ~9 ha tlocrta u kvartu, katastarski objekti tek 4,7 ha.
Uzima se unija jer je skuplja greška proglasiti praznom česticu na kojoj
kuća stoji nego obrnuto.

Rezultat: public/geo/analiza/stambeno-slobodno.geojson (EPSG:4326)
          public/geo/analiza/_stambeno-slobodno.json  (izvještaj s brojkama)

Sloj se računa po GUP-u 2015., dakle po planu NA SNAZI. Nacrt izmjena iz
2024. daje se pod `--godina 2024` i piše u zasebne datoteke; on još nije
donesen, pa ne smije stajati kao zatečeno stanje.

Pokretanje:  /opt/homebrew/bin/python3 scripts/slobodne-parcele.py [--godina 2015]
Traži:       GDAL s Python vezama (samo /opt/homebrew/bin/python3 ih ima)
"""
from __future__ import annotations

import argparse
import json
import math
import os
from typing import Any, Iterator

from osgeo import ogr, osr

ogr.UseExceptions()

KORIJEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(KORIJEN, "public", "geo")
IZLAZ = os.path.join(GEO, "analiza")

# Račun ide u HTRS96/TM jer se u njemu površina mjeri u metrima; ulaz i
# izlaz su 4326 kakav karta traži.
EPSG_RACUN = 3765

GRANICA = os.path.join(GEO, "granica.geojson")
KATASTAR = os.path.join(GEO, "grad", "katastar.geojson")
DALEKOVOD = os.path.join(GEO, "grad", "struja-vn-110.geojson")

# Postojeće ulice kao osi. Koridori s lista GUP-a nisu dovoljni: praćeni su
# s rastera i pregrubi su (176 ploha na cijelom listu), pa su kroz njih
# prošle čestice koje su očito cesta. Osi su iz OSM-a i gradske evidencije
# i pufraju se po razredu ceste — jedna širina za sve pojela bi dvorišta uz
# uske servisne puteve, a magistralu ostavila preuskom.
ULICE = os.path.join(GEO, "ulice.geojson")
DIONICE = os.path.join(GEO, "grad", "ceste-dionice.geojson")
DRZAVNE = os.path.join(GEO, "grad", "drzavne-ceste.geojson")
NERAZVRSTANE = os.path.join(GEO, "grad", "ceste-nerazvrstane.geojson")

POLA_SIRINE: dict[str, float] = {
    "trunk": 9.0,
    "trunk_link": 6.0,
    "primary": 7.0,
    "secondary": 6.0,
    "residential": 4.0,
    "unclassified": 4.0,
    "service": 3.0,
    "track": 2.5,
    "footway": 1.5,
    "path": 1.5,
    "steps": 1.5,
}
POLA_ZADANO = 4.0
POLA_DIONICE = 4.0   # gradske dionice nemaju razred
POLA_DRZAVNE = 9.0
POLA_NERAZVRSTANE = 4.0  # registar nerazvrstanih cesta Grada Splita

GODINA_NA_SNAZI = 2015
GODINE = (2015, 2024)


PROMJENE = os.path.join(GEO, "planovi", "gup-promjene-2015-2024.geojson")


def _namjena(godina: int) -> str:
    return os.path.join(GEO, "planovi", f"gup-{godina}-namjena.geojson")


def _promet(godina: int) -> str:
    return os.path.join(GEO, "planovi", f"gup-{godina}-promet.geojson")


def _ime(godina: int, izvori: dict[str, Any]) -> str:
    """Ime datoteke: obuhvat daje osnovu, nacrt dodaje godinu."""
    osnova = izvori["ime"]
    return osnova if godina == GODINA_NA_SNAZI else f"{osnova}-{godina}"

ZGRADE = [
    os.path.join(GEO, "grad", "zgrade-2025.geojson"),
    os.path.join(GEO, "grad", "zgrade-visine.geojson"),
    os.path.join(GEO, "grad", "katastar-objekti.geojson"),
    os.path.join(GEO, "zgrade.geojson"),
]

# Isti račun vrti se na dva obuhvata. `kvart` je Dračevac i Bilice po
# službenoj granici; `sire` je cijeli prozor na kojem je namjena praćena
# (4,0 × 3,3 km, vidi KVART_3765 u trace-plans.py) — dakle sve za što
# uopće postoji podloga namjene, a to je granica podatka, ne izbor.
# Podloge za `sire` vadi scripts/izvadi-sire.py iz GIS izvoza Grada.
SIRE = os.path.join(GEO, "sire")

# Prozor praćene namjene u EPSG:3765 — služi kao granica obuhvata `sire`.
PROZOR_3765 = (497574, 4818898, 501617, 4822231)

OBUHVATI: dict[str, dict[str, Any]] = {
    "kvart": {
        "granica": GRANICA,
        "katastar": KATASTAR,
        "zgrade": ZGRADE,
        "ulice": os.path.join(GEO, "ulice.geojson"),
        "dionice": os.path.join(GEO, "grad", "ceste-dionice.geojson"),
        "drzavne": os.path.join(GEO, "grad", "drzavne-ceste.geojson"),
        "nerazvrstane": os.path.join(GEO, "grad", "ceste-nerazvrstane.geojson"),
        "dalekovod": os.path.join(GEO, "grad", "struja-vn-110.geojson"),
        "ime": "stambeno-slobodno",
    },
    "sire": {
        "granica": None,  # pravokutnik PROZOR_3765, vidi granica_obuhvata()
        "katastar": os.path.join(SIRE, "katastar.geojson"),
        "zgrade": [os.path.join(SIRE, f"{n}.geojson")
                   for n in ("zgrade", "zgrade-2d", "katastar-objekti")],
        "ulice": os.path.join(SIRE, "ulice.geojson"),
        "dionice": os.path.join(SIRE, "ceste-dionice.geojson"),
        "drzavne": os.path.join(SIRE, "drzavne-ceste.geojson"),
        "nerazvrstane": os.path.join(SIRE, "ceste-nerazvrstane.geojson"),
        "dalekovod": os.path.join(SIRE, "dalekovod.geojson"),
        "ime": "stambeno-slobodno-sire",
    },
}

# Namjene GUP-a u kojima je stanovanje dopušteno. Popis je iz tumača
# znakova lista (vidi VOKABULAR u scripts/trace-plans.py): S je čisto
# stambena, M1/M2/M3 su mješovite sa stanovanjem, K5 je poslovna namjena
# I stanovanje. Poslovna K/K3/K4 i gospodarska I stanovanje NE dopuštaju,
# pa ih ovdje nema.
STAMBENE: frozenset[str] = frozenset({"S", "M1", "M2", "M3", "M/K5", "K5"})

UDIO_U_KVARTU = 0.5   # čestica pripada kvartu ako je toliko njezine površine unutra
UDIO_NAMJENE = 0.5    # čestica je stambena ako je toliko u stambenoj zoni

# Iznad ovoga čestica NIJE gradilište nego sama cesta — takve se izbacuju u
# cijelosti. Mjereno je jasno razdvojeno: 18 čestica ima ≥79 % pokriveno
# cestom, sljedeća je na 47 %, pa prag pada u prazninu i ne reže ništa
# sporno. Čestice ispod praga ostaju, ali im cesta otkine dio slobodne
# površine — što onda hvata pravilo o najmanjoj građevnoj čestici.
UDIO_JE_CESTA = 0.6

# Nerazvrstana cesta koja česticom PROLAZI, a ne okrzne joj ugao, čini je
# neupotrebljivom bez obzira na to koliko površine ostane sa strane. Mjeri
# se duljina osi unutar čestice u odnosu na njezinu dulju stranu. Izmjereno
# u kvartu: 4 %, 21 %, 23 %, 24 %, zatim 38 %, 60 %, 182 % — prag pada u
# prazninu između 24 i 38, pa ne reže ništa sporno.
KROZ_CESTICU = 0.30

# Bez pristupa na cestu nema gradnje. Odredbe su izričite: „građevna
# čestica mora imati pristup na javnoprometnu površinu”, a „pristupni put
# do građevne čestice je najmanje širine 3,0 m”. Prag je zato 3 m — toliko
# treba da se do ceste uopće može provući pristupni put. Takve se čestice
# NE izbacuju nego boje crveno: zemljište postoji i namjena ga dopušta, ali
# dok se pristup ne riješi (služnost, nova ulica), na njemu se ne gradi.
PRISTUP_M = 3.0

BOJA_SLOBODNO = "#16a34a"
BOJA_BEZ_PRISTUPA = "#dc2626"

# Razlozi koje nijedan sloj ne nosi, a poznati su s terena. Ovo je RUČNI
# popis i takav mora ostati vidljiv: svaka stavka je tvrdnja koju podaci ne
# potvrđuju, pa ide s obrazloženjem i mora se moći provjeriti.
#
# k.č. 506/3 — izlaz iz tunela. Provjereno u svim slojevima koje imamo:
# najbliži tunel u OSM-u je 222 m daleko (D1), nijedan plan (GUP, UPU, DPU)
# ne spominje tunel, a ortofoto na toj čestici pokazuje obrađenu zemlju uz
# rub ceste. Podatak dolazi s terena i ovdje stoji upravo zato što ga
# nijedan sloj ne bi uhvatio.
RUCNO_IZUZETO: dict[str, str] = {
    "506/3": "izlaz iz tunela (podatak s terena, nema ga ni u jednom sloju)",
}

# Zaštitni koridor nadzemnog 110 kV dalekovoda, 15 m sa svake strane osi.
# Podzemni vodovi se ne oduzimaju — kabel u zemlji ne prazni česticu.
KORIDOR_DALEKOVODA = 15.0

# Prag ispod kojeg tlocrt nije zgrada nego razilaženje evidencija: četiri
# izvora crtaju istu kuću s pomakom do ~2 m, pa susjedna kuća zna zagristi
# metar-dva u česticu. Strogi račun (bilo kakav tlocrt) ide usporedno.
SITAN_TLOCRT = 20.0

# Najmanja građevna čestica — doslovno iz Odredbi za provođenje GUP-a,
# „Posebna pravila – mješovita namjena M1”, koja se po odredbi za K5
# („Odgovarajuće se primjenjuju urbana pravila za mješovitu namjenu M1 i
# poslovnu namjenu K”) primjenjuju i na K5, jedinu stambenu zonu u kvartu:
#
#   Ppmin=500 m² za novu slobodnostojeću građevinu (šmin fronte 14 m),
#   Ppmin=400 m² za dvojne građevine,
#   Ppmin=300 m² ako se čestica formira IZMEĐU DVIJE IZGRAĐENE.
#
# 300 m² je dakle apsolutni pod — ispod toga plan ne dopušta ništa ni u
# najpovoljnijem slučaju, pa takve čestice ispadaju. 500 m² je normalan
# slučaj i vodi se kao zasebna brojka.
PPMIN_POD = 300.0
PPMIN_SLOBODNOSTOJECA = 500.0

# Najmanja širina čestice na kojoj išta stane. Odredbe za M1 traže
# „minimalna udaljenost građevine od granica čestice je 3,0 m” — dva takva
# odmaka pojedu 6 m, pa je na užoj čestici širina građevine nula. Prag zato
# nije procjena nego izravna posljedica odredbe.
NAJUZA = 6.0

# Uska čestica ostaje samo ako je uz susjednu prislonjena DUGOM stranom —
# tada susjedu proširuje i zajedno nose građevinu. Spojene kratkom stranom
# (nadovezane u niz) i dalje daju samo dulju traku, na kojoj se ne gradi.
# Mjeri se udio vlastite duljine koji dodiruje susjeda.
UDIO_DUGE_STRANE = 0.5


def _transformacija() -> osr.CoordinateTransformation:
    """Iz WGS84 u HTRS96/TM, s osima u redoslijedu x,y."""
    izvor = osr.SpatialReference()
    izvor.ImportFromEPSG(4326)
    izvor.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    cilj = osr.SpatialReference()
    cilj.ImportFromEPSG(EPSG_RACUN)
    cilj.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(izvor, cilj)


U_METRE = _transformacija()


def _plohe(g: ogr.Geometry) -> Iterator[ogr.Geometry]:
    """Rastavlja bilo koju geometriju na pojedinačne poligone.

    MakeValid od samopresjeka zna vratiti GEOMETRYCOLLECTION s crtama i
    točkama u njoj; njih se ovdje tiho odbacuje jer nemaju površinu.
    """
    ime = g.GetGeometryName()
    if ime == "POLYGON":
        yield g
    elif ime in ("MULTIPOLYGON", "GEOMETRYCOLLECTION"):
        for i in range(g.GetGeometryCount()):
            yield from _plohe(g.GetGeometryRef(i))


def ucitaj(put: str) -> list[tuple[dict[str, Any], ogr.Geometry]]:
    """Čita GeoJSON i vraća parove (atributi, geometrija u EPSG:3765)."""
    ds = ogr.Open(put)
    if ds is None:
        raise FileNotFoundError(put)
    sloj = ds.GetLayer(0)
    out: list[tuple[dict[str, Any], ogr.Geometry]] = []
    for f in sloj:
        g = f.GetGeometryRef()
        if g is None:
            continue
        g = g.Clone()
        g.Transform(U_METRE)
        if not g.IsValid():
            g = g.MakeValid()
        out.append((f.items(), _sazmi(g)))
    return out


def _sazmi(g: ogr.Geometry) -> ogr.Geometry:
    """Svodi GEOMETRYCOLLECTION na same plohe.

    MakeValid od razvedene čestice zna vratiti zbirku u kojoj uz poligone
    vise i crte i točke s mjesta samopresjeka. Takva geometrija ruši
    Boundary() (GEOS je ne podržava nad zbirkom), a crte i točke ionako
    nemaju površinu. U širem obuhvatu takvih čestica ima; u kvartu ih
    nije bilo, pa se problem pokazao tek na 27 000 čestica.
    """
    if g.GetGeometryName() != "GEOMETRYCOLLECTION":
        return g
    plohe = list(_plohe(g))
    if not plohe:
        return g
    if len(plohe) == 1:
        return plohe[0].Clone()
    skup = ogr.Geometry(ogr.wkbMultiPolygon)
    for p in plohe:
        skup.AddGeometry(p)
    return skup


def spoji(geometrije: list[ogr.Geometry]) -> ogr.Geometry:
    """Unija poligona u jedan (multi)poligon."""
    skup = ogr.Geometry(ogr.wkbMultiPolygon)
    for g in geometrije:
        for p in _plohe(g):
            skup.AddGeometry(p)
    if skup.GetGeometryCount() == 0:
        return ogr.Geometry(ogr.wkbMultiPolygon)
    return skup.UnionCascaded()


def _u_sloj(geometrije: list[ogr.Geometry], ime: str) -> ogr.Layer:
    """Radni sloj u memoriji — daje prostorni indeks za brzo presijecanje.

    Bez indeksa je ovo 1300 čestica × 3500 zgrada presjeka; s njim se po
    čestici gleda tek nekoliko susjeda.
    """
    upravljac = ogr.GetDriverByName("Memory")
    ds = upravljac.CreateDataSource(ime)
    sloj = ds.CreateLayer(ime, geom_type=ogr.wkbPolygon)
    for g in geometrije:
        for p in _plohe(g):
            f = ogr.Feature(sloj.GetLayerDefn())
            f.SetGeometry(p)
            sloj.CreateFeature(f)
    sloj._ds = ds  # type: ignore[attr-defined]  # inače ga GC pokupi
    return sloj


def presjek_povrsina(sloj: ogr.Layer, cestica: ogr.Geometry) -> float:
    """Površina dijela čestice koju pokriva sloj, u m².

    Presjeci se skupljaju pa spajaju, a ne zbrajaju: susjedne zgrade iz
    četiri evidencije se preklapaju i zbroj bi istu kuću brojio dvaput.
    """
    sloj.SetSpatialFilter(cestica)
    dijelovi = []
    for f in sloj:
        g = f.GetGeometryRef()
        if g is None or not g.Intersects(cestica):
            continue
        d = g.Intersection(cestica)
        if not d.IsEmpty():
            dijelovi.append(d)
    sloj.SetSpatialFilter(None)
    if not dijelovi:
        return 0.0
    return spoji(dijelovi).GetArea()


def granica_obuhvata(izvori: dict[str, Any]) -> ogr.Geometry:
    """Područje na kojem se računa.

    Za kvart je to službena granica Dračevca i Bilica; za širi obuhvat
    pravokutnik prozora na kojem je namjena praćena, jer izvan njega
    podloge naprosto nema.
    """
    if izvori["granica"]:
        return spoji([g for _, g in ucitaj(izvori["granica"])])
    x0, y0, x1, y1 = PROZOR_3765
    prsten = ogr.Geometry(ogr.wkbLinearRing)
    for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)):
        prsten.AddPoint_2D(x, y)
    okvir = ogr.Geometry(ogr.wkbPolygon)
    okvir.AddGeometry(prsten)
    return okvir


def _ulice(izvori: dict[str, Any]) -> list[ogr.Geometry]:
    """Postojeće ulice kao plohe — osi pufrane po razredu ceste.

    Registar nerazvrstanih cesta Grada Splita mora biti među izvorima:
    to su ceste kojima Grad upravlja i koje u ovom kvartu prolaze kroz
    čestice (npr. Ulica Bilice II kroz k.č. 506/3). OSM ih ne pokriva sve.
    """
    izlaz = []
    for props, g in ucitaj(izvori["ulice"]):
        if "LINE" in g.GetGeometryName():
            izlaz.append(g.Buffer(POLA_SIRINE.get(props.get("highway"),
                                                  POLA_ZADANO)))
    for kljuc, pola in (("dionice", POLA_DIONICE), ("drzavne", POLA_DRZAVNE),
                        ("nerazvrstane", POLA_NERAZVRSTANE)):
        for _, g in ucitaj(izvori[kljuc]):
            if "LINE" in g.GetGeometryName():
                izlaz.append(g.Buffer(pola))
    return izlaz


def koridori(ulice: list[ogr.Geometry],
              izvori: dict[str, Any]) -> list[ogr.Geometry]:
    """Trase koje prazne česticu: ulice, prometnice GUP-a i dalekovod.

    Tri izvora jer nijedan sam ne pokriva: postojeće ulice hvataju ono što
    je već cesta, koridori s listova GUP-a ono što je tek planirano (bijele
    plohe koje trace-plans.py vadi posebnim prolazom jer bijela nije klasa
    namjene), a dalekovod ulazi samo ako je nadzemni i pufran zaštitnim
    koridorom — kabel u zemlji ne prazni česticu.

    Uzima se UNIJA prometnica iz obiju godina, iste za oba računa. Nacrt
    2024. u kvartu ne mijenja nijednu cestu (njegove stavke 3.a Promet sve
    padaju izvan kvarta), pa je razlika između listova — 176 ploha naspram
    532 — samo kvaliteta praćenja, ne odluka plana. Da se uzimala godina po
    godina, čestice bi ispadale i ulazile prema tome koji je list bolje
    isprepariran: k.č. 13904/2 ide sa 71 % koridora na 1 %.
    """
    plan = [g for godina in GODINE for _, g in ucitaj(_promet(godina))]
    dalekovod = [g.Buffer(KORIDOR_DALEKOVODA)
                 for props, g in ucitaj(izvori["dalekovod"])
                 if props.get("vrsta") == "nadzemna"]
    print(f"  koridori: {len(ulice)} postojećih ulica + {len(plan)} ploha "
          f"iz oba lista + {len(dalekovod)} dionica dalekovoda")
    return ulice + plan + dalekovod


def namjena_po_kodu(godina: int) -> dict[str, ogr.Geometry]:
    """Plohe namjene po kodu; za nacrt očišćene od šuma uklapanja.

    Listovi 2015. i 2024. praćeni su i ručno smješteni svaki za sebe, s
    nesigurnošću od nekoliko metara. Medijan čestice u kvartu je 174 m², pa
    taj pomak česticu prebaci iz zone u zonu: k.č. 627/1 ispadne 100 % K5 po
    jednom listu i 0 % po drugom, iako plan ondje ništa ne mijenja. Uspoređivati
    dva takva sloja izravno znači čitati šum kao odluku.

    Zato nacrt ne ulazi cijeli nego samo ondje gdje je promjena stvarno
    utvrđena — u plohama iz `gup-promjene-2015-2024.geojson`, koje su
    izračunate nad rasterima na zajedničkoj mreži od 1 m i očišćene od
    registracijske trake morfološkim otvaranjem. Izvan njih vrijedi plan na
    snazi. Rezultat je „2015. plus ono što nacrt doista mijenja”.
    """
    baza: dict[str, list[ogr.Geometry]] = {}
    for p, g in ucitaj(_namjena(GODINA_NA_SNAZI)):
        baza.setdefault(str(p.get("kod")), []).append(g)
    if godina == GODINA_NA_SNAZI:
        return {k: spoji(v) for k, v in baza.items()}

    nacrt: dict[str, list[ogr.Geometry]] = {}
    for p, g in ucitaj(_namjena(godina)):
        nacrt.setdefault(str(p.get("kod")), []).append(g)
    promjene = spoji([g for _, g in ucitaj(PROMJENE)])
    print(f"  ispravak nacrta: {promjene.GetArea() / 1e4:.2f} ha stvarnih "
          f"promjena; izvan njih vrijedi {GODINA_NA_SNAZI}.")

    out: dict[str, ogr.Geometry] = {}
    for kod in set(baza) | set(nacrt):
        staro = spoji(baza.get(kod, [])).Difference(promjene)
        novo = spoji(nacrt.get(kod, [])).Intersection(promjene)
        g = staro.Union(novo)
        if not g.IsEmpty():
            out[kod] = g
    return out


def namjena_cestice(
    sloj_po_kodu: dict[str, ogr.Layer], cestica: ogr.Geometry, povrsina: float
) -> tuple[float, dict[str, float]]:
    """Udio čestice u stambenim zonama i razdioba po kodu namjene."""
    po_kodu: dict[str, float] = {}
    for kod, sloj in sloj_po_kodu.items():
        a = presjek_povrsina(sloj, cestica)
        if a > 0:
            po_kodu[kod] = a
    stambeno = sum(a for k, a in po_kodu.items() if k in STAMBENE)
    return (stambeno / povrsina if povrsina else 0.0), po_kodu


def pravokutnik(g: ogr.Geometry) -> tuple[float, float]:
    """Širina i duljina čestice, kao stranice pravokutnika iste mjere.

    Iz površine A i opsega P rješava se w+L=P/2, w·L=A. To je točno za
    pravokutne čestice, a katastarske to uglavnom jesu. Naivna mjera
    4A/opseg ovdje NE valja: za dugu traku daje ~2w, dakle dvostruko
    preširoko, pa bi prag propustio i najtanje slivere. Ako rješenja nema
    (zaobljen ili razveden oblik), čestica nije traka i vodi se kao kvadrat.
    """
    a = g.GetArea()
    poluopseg = g.Boundary().Length() / 2
    d = poluopseg * poluopseg - 4 * a
    if d < 0:
        strana = math.sqrt(a) if a > 0 else 0.0
        return strana, strana
    korijen = math.sqrt(d)
    return (poluopseg - korijen) / 2, (poluopseg + korijen) / 2


def _oslobodi(cestica: ogr.Geometry, slojevi: dict[str, Any]) -> ogr.Geometry:
    """Dio čestice koji je slobodan: u stambenoj zoni, bez zgrade i ceste.

    Kreće se od presjeka sa stambenom zonom, jer većina površine odlučuje
    ulazi li čestica u sloj, ali ostatak nije gradilište: k.č. 419/1 je po
    nacrtu 64 % K5 i 36 % R2 (rekreacija), k.č. 630/3 je 52 % M/K5 i 48 %
    Z5 — na tim trećinama i polovicama stan se ne gradi.
    """
    slobodno = cestica.Intersection(slojevi["stambeno"])
    for kljuc in ("zgrade", "koridori"):
        slojevi[kljuc].SetSpatialFilter(slobodno)
        smetnje = [f.GetGeometryRef().Clone() for f in slojevi[kljuc]]
        slojevi[kljuc].SetSpatialFilter(None)
        if smetnje:
            slobodno = slobodno.Difference(spoji(smetnje))
    return slobodno


def ocijeni(
    cestica: ogr.Geometry,
    props: dict[str, Any],
    slojevi: dict[str, Any],
) -> tuple[ogr.Geometry, dict[str, Any]]:
    """Slobodna geometrija i sve mjere jedne čestice.

    Geometrija se vraća uz mjere jer prag najmanje građevne čestice treba
    POVEZAN komad, a ne zbroj krhotina — cesta koja česticu presiječe
    ostavlja dvije polovice, i nijedna nije 500 m² zato što zajedno jesu.
    """
    povrsina = cestica.GetArea()
    udio_stambeno, po_kodu = namjena_cestice(slojevi["namjena"], cestica, povrsina)
    zgrada = presjek_povrsina(slojevi["zgrade"], cestica)
    koridor = presjek_povrsina(slojevi["koridori"], cestica)

    kroz = sum(q.Intersection(cestica).Length()
               for q in slojevi["osi_cesta"] if q.Intersects(cestica))
    pristup = cestica.Distance(slojevi["ceste"])

    slobodno = _oslobodi(cestica, slojevi)

    glavna = max(po_kodu.items(), key=lambda kv: kv[1])[0] if po_kodu else None
    sirina, duljina = pravokutnik(cestica)
    return slobodno, {
        "ko": props.get("ko"),
        "cestica": props.get("cestica"),
        "povrsina_m2": round(povrsina, 1),
        "sirina_m": round(sirina, 1),
        "duljina_m": round(duljina, 1),
        "namjena": glavna,
        "udio_stambeno": round(udio_stambeno, 3),
        "zgrada_m2": round(zgrada, 1),
        "udio_koridora": round(koridor / povrsina, 3) if povrsina else 0.0,
        # Duljina osi nerazvrstane ceste unutar čestice, kao udio njezine
        # dulje strane — koliko cesta kroz nju prolazi, a ne koliko je jede.
        "cesta_kroz": round(kroz / duljina, 3) if duljina else 0.0,
        # Udaljenost do najbliže postojeće ceste. Sud o pristupu donosi se
        # nad nakupinom, ne ovdje — vidi po_skupinama().
        "pristup_m": round(pristup, 1),
        # Slobodno i u stambenoj zoni, i bez zgrade, i izvan trase.
        "slobodno_m2": round(max(slobodno.GetArea(), 0.0), 1),
    }


def prolazi(m: dict[str, Any]) -> bool:
    """Uvjeti koji se sude po samoj čestici.

    Veličina se NE provjerava ovdje nego nad skupinama susjednih čestica
    (vidi skupine()): dvije male čestice jedna uz drugu spajaju se u jednu
    građevnu, pa svaka zasebno pala bi na pragu koji zajedno prelaze.
    """
    return (
        m["udio_stambeno"] >= UDIO_NAMJENE
        and m["udio_koridora"] < UDIO_JE_CESTA
        and m["cesta_kroz"] < KROZ_CESTICU
        and m["zgrada_m2"] <= SITAN_TLOCRT
        and m["cestica"] not in RUCNO_IZUZETO
    )


# Do koliko se čestice smatraju susjednima. Katastarske čestice dijele
# među točno, ali praćene i pufrane geometrije ostave mikroprocjep, pa
# nula ne bi spojila ni ono što na terenu doista graniči.
DODIR = 0.5


def susjedstva(geometrije: list[ogr.Geometry]) -> list[list[int]]:
    """Za svaku česticu popis onih čije okvire dodiruje, po indeksu.

    Bez ovoga su i spajanje u nakupine i provjera uskih traka O(n²) nad
    punom geometrijom: u kvartu je to 90 čestica i prolazi u trenu, ali na
    širem obuhvatu ih je nekoliko tisuća, a svaka usporedba nosi Buffer i
    Distance. Okviri se presijecaju cijelo, pa gruba mreža odbaci golemu
    većinu parova prije nego što geometrija uopće dođe na red.
    """
    okviri = [g.GetEnvelope() for g in geometrije]
    kutija = 50.0  # m; veće od DODIR-a, dovoljno sitno da mreža reže
    mreza: dict[tuple[int, int], list[int]] = {}
    for i, (x0, x1, y0, y1) in enumerate(okviri):
        for cx in range(int((x0 - DODIR) // kutija), int((x1 + DODIR) // kutija) + 1):
            for cy in range(int((y0 - DODIR) // kutija),
                            int((y1 + DODIR) // kutija) + 1):
                mreza.setdefault((cx, cy), []).append(i)

    out: list[list[int]] = []
    for i, (x0, x1, y0, y1) in enumerate(okviri):
        blizu: set[int] = set()
        for cx in range(int((x0 - DODIR) // kutija), int((x1 + DODIR) // kutija) + 1):
            for cy in range(int((y0 - DODIR) // kutija),
                            int((y1 + DODIR) // kutija) + 1):
                blizu.update(mreza.get((cx, cy), ()))
        blizu.discard(i)
        out.append([j for j in blizu
                    if okviri[j][0] - DODIR <= x1 and okviri[j][1] + DODIR >= x0
                    and okviri[j][2] - DODIR <= y1 and okviri[j][3] + DODIR >= y0])
    return out


def _dodir_m(g: ogr.Geometry, ostali: list[ogr.Geometry]) -> float:
    """Duljina ruba kojim čestica dodiruje ijednu od ostalih, u metrima.

    Rub se siječe s napuhnutim susjedom, a ne izravno s njim: katastarske
    međe se u pravilu poklapaju, ali praćena i pufrana geometrija ostavi
    mikroprocjep na kojem bi točan presjek dao nulu.
    """
    rub = g.Boundary()
    # Spaja se u parovima, a ne UnionCascaded — taj prima samo multipoligone.
    # Unija, a ne zbroj: susjedi se na uglovima preklope za širinu DODIR-a i
    # zbroj bi te komadiće brojio dvaput, uvijek u korist zadržavanja trake.
    spoj = None
    for q in ostali:
        if g.Distance(q) > DODIR:
            continue
        dio = rub.Intersection(q.Buffer(DODIR))
        if dio.IsEmpty():
            continue
        spoj = dio if spoj is None else spoj.Union(dio)
    return spoj.Length() if spoj is not None else 0.0


def bez_uskih(
    izlazne: list[tuple[dict[str, Any], ogr.Geometry]]
) -> tuple[list[tuple[dict[str, Any], ogr.Geometry]], int]:
    """Izbacuje uske trake koje ni uz susjeda ne postaju gradilište.

    Traka užа od NAJUZA sama ne nosi građevinu. Spašava je samo to da je uz
    susjednu česticu prislonjena dugom stranom — tada je proširuje. Dodir
    kratkom stranom ne vrijedi: dvije trake spojene u niz i dalje su traka.

    Prolazi se u krug jer izbacivanje mijenja susjedstvo: traka koja se
    držala samo za drugu traku ostaje bez oslonca kad ta ispadne.
    """
    preostali = list(izlazne)
    izbaceno = 0
    while True:
        geometrije = [g for _, g in preostali]
        blizu = susjedstva(geometrije)
        pao = None
        for i, (m, g) in enumerate(preostali):
            if m["sirina_m"] >= NAJUZA:
                continue
            ostali = [geometrije[j] for j in blizu[i]]
            if _dodir_m(g, ostali) < UDIO_DUGE_STRANE * m["duljina_m"]:
                pao = i
                break
        if pao is None:
            return preostali, izbaceno
        preostali.pop(pao)
        izbaceno += 1


def skupine(izlazne: list[tuple[dict[str, Any], ogr.Geometry]]) -> list[list[int]]:
    """Povezane nakupine susjednih čestica, kao popisi indeksa.

    Susjedne slobodne čestice mogu se spojiti u jednu građevnu, pa se prag
    najmanje površine primjenjuje na nakupinu, a ne na pojedinu česticu.
    Obično stablo unije; čestica ih je stotinjak pa je O(n²) usporedba
    jeftinija od prostornog indeksa.
    """
    roditelj = list(range(len(izlazne)))

    def korijen(i: int) -> int:
        while roditelj[i] != i:
            roditelj[i] = roditelj[roditelj[i]]
            i = roditelj[i]
        return i

    blizu = susjedstva([g for _, g in izlazne])
    for i in range(len(izlazne)):
        for j in blizu[i]:
            if j > i and izlazne[i][1].Distance(izlazne[j][1]) <= DODIR:
                roditelj[korijen(i)] = korijen(j)

    nakupine: dict[int, list[int]] = {}
    for i in range(len(izlazne)):
        nakupine.setdefault(korijen(i), []).append(i)
    return list(nakupine.values())


def _najveci_komad(geometrije: list[ogr.Geometry]) -> float:
    """Površina najvećeg POVEZANOG komada slobodne zemlje, u m².

    Zbroj krhotina nije gradilište. Cesta koja prolazi kroz česticu (ili
    kroz nakupinu) ostavlja dva odvojena komada, a građevina stane samo u
    jedan — pa u prag ulazi najveći, ne zbroj.
    """
    spoj = spoji([g for g in geometrije if not g.IsEmpty()])
    if spoj.IsEmpty():
        return 0.0
    return max((p.GetArea() for p in _plohe(spoj)), default=0.0)


def _oznaci(m: dict[str, Any], broj: int, clanova: int, slobodno: float,
            pristup: float) -> dict[str, Any]:
    """Dodaje čestici podatke o njezinoj nakupini i boju za kartu.

    Pristup je svojstvo građevne čestice, dakle NAKUPINE, a ne pojedine
    katastarske: ako spojeni komad negdje dodiruje cestu, do njega se
    dolazi, pa i zaleđe iza njega ima pristup. Zato ovdje stiže već
    izračunata najmanja udaljenost među članovima.
    """
    bez_pristupa = pristup > PRISTUP_M
    return {
        **m,
        "skupina": broj,
        "skupina_cestica": clanova,
        # Najveći povezan komad, ne zbroj — vidi _najveci_komad().
        "skupina_slobodno_m2": round(slobodno, 1),
        "skupina_pristup_m": round(pristup, 1),
        "bez_pristupa": bez_pristupa,
        "boja": BOJA_BEZ_PRISTUPA if bez_pristupa else BOJA_SLOBODNO,
    }


def po_skupinama(
    izlazne: list[tuple[dict[str, Any], ogr.Geometry]],
    slobodne: dict[int, ogr.Geometry],
) -> tuple[list[tuple[dict[str, Any], ogr.Geometry]], dict[str, Any]]:
    """Izbacuje nakupine premale za gradnju i označava preostale.

    Mjeri se SLOBODNA i POVEZANA površina nakupine, ne katastarska: dio
    čestice pod cestom ili zgradom ne nosi građevinu, a ni dvije polovice
    razdvojene cestom ne zbrajaju se u jednu građevnu česticu.
    """
    zadrzane: list[tuple[dict[str, Any], ogr.Geometry]] = []
    odbaceno = {"skupina": 0, "cestica": 0, "m2": 0.0}
    veliki = 0
    nedostupne = 0

    def povezano(clanovi: list[int]) -> float:
        return _najveci_komad([slobodne[id(izlazne[i][0])] for i in clanovi])

    for broj, clanovi in enumerate(
        sorted(skupine(izlazne), key=lambda c: -povezano(c)), start=1
    ):
        slobodno = povezano(clanovi)
        if slobodno < PPMIN_POD:
            odbaceno["skupina"] += 1
            odbaceno["cestica"] += len(clanovi)
            odbaceno["m2"] += slobodno
            continue
        if slobodno >= PPMIN_SLOBODNOSTOJECA:
            veliki += 1
        pristup = min(izlazne[i][0]["pristup_m"] for i in clanovi)
        if pristup > PRISTUP_M:
            nedostupne += 1
        for i in clanovi:
            zadrzane.append((_oznaci(izlazne[i][0], broj, len(clanovi),
                                     slobodno, pristup), izlazne[i][1]))
    return zadrzane, {
        "odbacene_premale": {
            "skupina": odbaceno["skupina"],
            "cestica": odbaceno["cestica"],
            "ha": round(odbaceno["m2"] / 10000, 2),
        },
        "skupina": len({m["skupina"] for m, _ in zadrzane}),
        "skupina_od_500_m2": veliki,
        "skupina_bez_pristupa": nedostupne,
        "cestica_bez_pristupa": sum(1 for m, _ in zadrzane if m["bez_pristupa"]),
    }


def _u_4326(g: ogr.Geometry) -> ogr.Geometry:
    natrag = osr.CoordinateTransformation(
        _sr(EPSG_RACUN), _sr(4326)
    )
    k = g.Clone()
    k.Transform(natrag)
    return k


def _sr(epsg: int) -> osr.SpatialReference:
    sr = osr.SpatialReference()
    sr.ImportFromEPSG(epsg)
    sr.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return sr


def _pragovi() -> dict[str, float]:
    """Svi pragovi na jednom mjestu, da izvještaj kaže po čemu je sudio."""
    return {
        "udio_u_kvartu": UDIO_U_KVARTU,
        "udio_namjene": UDIO_NAMJENE,
        "udio_je_cesta": UDIO_JE_CESTA,
        "kroz_cesticu": KROZ_CESTICU,
        "sitan_tlocrt_m2": SITAN_TLOCRT,
        "koridor_dalekovoda_m": KORIDOR_DALEKOVODA,
        "ppmin_pod_m2": PPMIN_POD,
        "ppmin_slobodnostojeca_m2": PPMIN_SLOBODNOSTOJECA,
        "najuza_m": NAJUZA,
        "udio_duge_strane": UDIO_DUGE_STRANE,
        "pristup_m": PRISTUP_M,
    }


def _po_namjeni(zadrzane: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """Razdioba slobodne površine po kodu namjene."""
    out: dict[str, dict[str, float]] = {}
    for m in zadrzane:
        r = out.setdefault(m["namjena"], {"cestica": 0, "ha": 0.0})
        r["cestica"] += 1
        r["ha"] = round(r["ha"] + m["slobodno_m2"] / 10000, 2)
    return out


def izvjestaj(mjere: list[dict[str, Any]], u_kvartu: int, godina: int,
              zadrzane: list[dict[str, Any]], skupine_izv: dict[str, Any],
              siroke: list[dict[str, Any]]) -> dict[str, Any]:
    """Brojke: koliko čestica i koliko hektara ostaje na svakom koraku."""
    stambene = [m for m in mjere if m["udio_stambeno"] >= UDIO_NAMJENE]
    nije_cesta = [m for m in stambene if m["udio_koridora"] < UDIO_JE_CESTA]
    bez_prolaza = [m for m in nije_cesta if m["cesta_kroz"] < KROZ_CESTICU
                   and m["cestica"] not in RUCNO_IZUZETO]
    prazne = [m for m in bez_prolaza if m["zgrada_m2"] <= SITAN_TLOCRT]
    strogo = [m for m in zadrzane if m["zgrada_m2"] == 0.0]

    def zbroj(s: list[dict[str, Any]], polje: str = "povrsina_m2") -> float:
        return round(sum(m[polje] for m in s) / 10000, 2)

    return {
        "godina": godina,
        "na_snazi": godina == GODINA_NA_SNAZI,
        "izvor_namjene": os.path.relpath(_namjena(godina), KORIJEN),
        "stambene_namjene": sorted(STAMBENE),
        "pragovi": _pragovi(),
        "rucno_izuzeto": RUCNO_IZUZETO,
        "lijevak": [
            {"korak": "čestice u obuhvatu", "cestica": u_kvartu, "ha": zbroj(mjere)},
            {"korak": "u stambenoj zoni GUP-a", "cestica": len(stambene),
             "ha": zbroj(stambene)},
            {"korak": "nije sama cesta", "cestica": len(nije_cesta),
             "ha": zbroj(nije_cesta)},
            {"korak": "cesta ne prolazi kroz njih", "cestica": len(bez_prolaza),
             "ha": zbroj(bez_prolaza)},
            {"korak": "neizgrađene", "cestica": len(prazne), "ha": zbroj(prazne)},
            {"korak": f"nisu uska traka (<{NAJUZA:.0f} m bez duge strane)",
             "cestica": len(siroke), "ha": zbroj(siroke)},
            {"korak": f"u nakupini ≥{PPMIN_POD:.0f} m² slobodnog",
             "cestica": len(zadrzane), "ha": zbroj(zadrzane)},
        ],
        "rezultat": {
            "cestica": len(zadrzane),
            "ha": zbroj(zadrzane),
            "slobodna_ha": zbroj(zadrzane, "slobodno_m2"),
            "bez_ijednog_tlocrta": {"cestica": len(strogo), "ha": zbroj(strogo)},
            "po_namjeni": _po_namjeni(zadrzane),
            **skupine_izv,
        },
    }


def cestice_kvarta(kvart: ogr.Geometry,
                   izvori: dict[str, Any]) -> list[tuple[dict[str, Any], ogr.Geometry]]:
    """Čestice čija većina površine leži u kvartu.

    Kriterij je većina, a ne dodir ni središte: dodir bi pokupio susjedne
    kvartove, a središte zna ispasti izvan kod savijenih čestica.
    """
    sve = ucitaj(izvori["katastar"])
    parcele = [
        (p, g) for p, g in sve
        if g.Intersection(kvart).GetArea() >= UDIO_U_KVARTU * g.GetArea()
    ]
    print(f"  čestice: {len(parcele)} u kvartu (od {len(sve)} u izvatku)")
    return parcele


def zapisi(godina: int, izlazne: list[tuple[dict[str, Any], ogr.Geometry]],
           izv: dict[str, Any], izvori: dict[str, Any]) -> str:
    """Piše sloj i izvještaj; vraća putanju sloja."""
    os.makedirs(IZLAZ, exist_ok=True)
    zbirka = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": m,
                "geometry": json.loads(_u_4326(g).ExportToJson()),
            }
            for m, g in izlazne
        ],
    }
    put_sloja = os.path.join(IZLAZ, f"{_ime(godina, izvori)}.geojson")
    with open(put_sloja, "w", encoding="utf-8") as f:
        json.dump(zbirka, f, ensure_ascii=False)
    with open(os.path.join(IZLAZ, f"_{_ime(godina, izvori)}.json"), "w",
              encoding="utf-8") as f:
        json.dump(izv, f, ensure_ascii=False, indent=1)
    return put_sloja


def sloj_godine(godina: int,
                parcele: list[tuple[dict[str, Any], ogr.Geometry]],
                zgrade: ogr.Layer, izvori: dict[str, Any]) -> dict[str, Any]:
    """Računa sloj i izvještaj za jednu godinu GUP-a."""
    print(f"\nGUP {godina}" + (" (na snazi)" if godina == GODINA_NA_SNAZI
                               else " (nacrt, nije donesen)"))
    po_kodu = namjena_po_kodu(godina)
    stambeno = spoji([g for k, g in po_kodu.items() if k in STAMBENE])
    print(f"  namjena: {len(po_kodu)} kodova, stambeni "
          f"{sorted(set(po_kodu) & STAMBENE)} = "
          f"{stambeno.GetArea() / 1e4:.2f} ha")

    ulice = _ulice(izvori)
    slojevi = {
        "namjena": {k: _u_sloj([g], f"n{godina}{i}")
                    for i, (k, g) in enumerate(po_kodu.items())},
        "koridori": _u_sloj(koridori(ulice, izvori), f"k{godina}"),
        # Samo postojeće ceste — pristup se ne ostvaruje na planirani
        # koridor koji još nije izveden.
        "ceste": spoji(ulice),
        "zgrade": zgrade,
        "stambeno": stambeno,
        "osi_cesta": [g for _, g in ucitaj(izvori["nerazvrstane"])
                      if "LINE" in g.GetGeometryName()],
    }

    mjere: list[dict[str, Any]] = []
    izlazne: list[tuple[dict[str, Any], ogr.Geometry]] = []
    slobodne: dict[int, ogr.Geometry] = {}
    for p, g in parcele:
        slob, m = ocijeni(g, p, slojevi)
        mjere.append(m)
        if prolazi(m):
            slobodne[id(m)] = slob
            izlazne.append((m, g))

    siroke, uskih = bez_uskih(izlazne)
    zadrzane, skupine_izv = po_skupinama(siroke, slobodne)
    skupine_izv["odbacene_uske"] = uskih
    izv = izvjestaj(mjere, len(parcele), godina,
                    [m for m, _ in zadrzane], skupine_izv,
                    [m for m, _ in siroke])
    put_sloja = zapisi(godina, zadrzane, izv, izvori)

    ispisi(izv, put_sloja)
    return izv


def ispisi(izv: dict[str, Any], put_sloja: str) -> None:
    """Lijevak i rezultat na zaslon."""
    for korak in izv["lijevak"]:
        print(f"  {korak['korak']:38s} {korak['cestica']:5d} čestica  "
              f"{korak['ha']:7.2f} ha")
    r = izv["rezultat"]
    print(f"  → {r['cestica']} čestica u {r['skupina']} nakupina, "
          f"{r['ha']} ha (neto slobodno {r['slobodna_ha']} ha)")
    print(f"    nakupina ≥{PPMIN_SLOBODNOSTOJECA:.0f} m² (slobodnostojeća "
          f"građevina): {r['skupina_od_500_m2']}")
    print(f"    BEZ PRISTUPA NA CESTU (crveno): "
          f"{r['skupina_bez_pristupa']} nakupina / "
          f"{r['cestica_bez_pristupa']} čestica")
    print(f"    odbačeno kao uska traka: {r['odbacene_uske']} čestica")
    print(f"    odbačeno kao premalo: {r['odbacene_premale']['skupina']} "
          f"nakupina / {r['odbacene_premale']['cestica']} čestica "
          f"({r['odbacene_premale']['ha']} ha)")
    print(f"    bez ijednog tlocrta: {r['bez_ijednog_tlocrta']['cestica']} / "
          f"{r['bez_ijednog_tlocrta']['ha']} ha")
    print(f"  → {os.path.relpath(put_sloja, KORIJEN)}")


def main() -> None:
    """Sastavlja sloj i izvještaj, po godini GUP-a."""
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--godina", type=int, choices=GODINE, action="append",
                   help=f"godina GUP-a (zadano {GODINA_NA_SNAZI}; može se "
                        "ponoviti)")
    p.add_argument("--obuhvat", choices=sorted(OBUHVATI), default="kvart",
                   help="kvart (zadano) ili sire — cijeli praćeni prozor")
    args = p.parse_args()
    godine = args.godina or [GODINA_NA_SNAZI]
    izvori = OBUHVATI[args.obuhvat]

    print(f"Slobodne stambene čestice — obuhvat „{args.obuhvat}”")
    granica = granica_obuhvata(izvori)
    print(f"  područje: {granica.GetArea() / 1e4:.1f} ha")
    parcele = cestice_kvarta(granica, izvori)
    zgrade = _u_sloj([g for put in izvori["zgrade"] for _, g in ucitaj(put)],
                     "zgrade")
    print(f"  zgrade: {zgrade.GetFeatureCount()} tlocrta iz "
          f"{len(izvori['zgrade'])} evidencija")

    for godina in godine:
        sloj_godine(godina, parcele, zgrade, izvori)


if __name__ == "__main__":
    main()
