#!/usr/bin/env python3
"""Model raspršenja s pamćenjem: oblačići koji putuju satima, ne perjanica.

Studija u `docs/Karepovac Odour Dispersion Modeling.md` odbija ustaljene modele
za ovu obalu i traži nestacionarni Lagrangeov model. Razlog je jedan i cijeli:
ustaljeni model svaki sat računa iznova, kao da prije njega nije bilo ničega.
Zato ne može pokazati ni zastoj ni vraćanje — a upravo je vraćanje ono što se
ovdje događa, kad popodnevni povjetarac s mora odnese miris u brdo, a noćni ga
niz padinu vrati nad iste kuće.

Ovdje izvor svakoga sata ispusti nekoliko oblačića. Svaki dalje živi svojim
životom: nosi ga polje vjetra toga sata, raste s prijeđenim putem, i ostaje u
obuhvatu dok ga vjetar ne iznese van ili dok se ne razrijedi. Sat vremena
poslije nad kvartom stoje i oblačići ispušteni prije pet sati. To je pamćenje.

Doprinos jednog oblačića na tlu, s odbijanjem od tla:

    C = M / (2π σ_h²) · f_z · exp(−r² / (2σ_h²))

gdje je `f_z = max(2/(√(2π)·σ_z), 1/H)` — dok je oblačić tanji od miješanog
sloja širi se slobodno, a kad ga ispuni, dalje se razrjeđuje samo vodoravno.
Time inverzija radi ono što u prirodi i radi: poklopac. (Račun u `_vrhovi`
oduvijek uzima veće od toga dvoga; ovdje je dugo pisalo `min`, što bi svježi
oblačić razrijedilo kao da je već ispunio sloj — dakle šesnaest puta previše
na prijemniku blizu plohe.)

Rast σ ide po Briggsovim izrazima za otvoreno tlo, po Pasquillovu razredu
stabilnosti. Razred se određuje po Turnerovoj shemi iz brzine vjetra, sunčeva
zračenja i naoblake — dakle po onome što stvarno određuje miješanje, umjesto po
samoj dubini graničnog sloja kao dosad.

Što ovdje i dalje nedostaje:

- Baklja kao uzdignut izvor; sav se izvor tretira kao ploha pri tlu.
- Hrapavost podloge iz CORINE-a; turbulencija ovisi samo o razredu stabilnosti.
- Polje vjetra je dvodimenzionalno, pa perjanica obilazi greben, a ne ide preko.
- Jačina izvora je jedna brojka za cijelu godinu, bez faze sanacije.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from reljef_polje import (
    NAJTANJI_SLOJ,
    _sidro,
    RASPRSENJE,
    Obuhvat,
    gladi,
    polje_vjetra,
    ucitaj_reljef,
)

logger = logging.getLogger(__name__)

KORIJEN = Path(__file__).resolve().parent.parent
PREDMEMORIJA = KORIJEN / ".cache"

#: Koliko smjerova ide u knjižnicu polja vjetra; 36 znači korak od 10°.
SMJEROVA = 36
#: Dubine miješanog sloja za koje se polje računa; bira se najbliža.
DUBINE = (60.0, 150.0, 400.0, 1000.0)

#: Briggsovi koeficijenti za otvoreno tlo, po razredu A–F.
BRIGGS_Y = (0.22, 0.16, 0.11, 0.08, 0.06, 0.04)
BRIGGS_Z = (0.20, 0.12, 0.08, 0.06, 0.03, 0.016)
#: Popravni članovi uz σ_z; drže rast u granicama na kilometarskoj udaljenosti.
BRIGGS_Z_ISPRAVAK = (0.0, 0.0, 0.0002, 0.0015, 0.0003, 0.0003)
RAZREDI = "ABCDEF"

#: Vodoravno vrtloženje koje ne ovisi o putu; drži oblačić da raste i kad
#: vjetar stane. Bez toga zastoj daje beskonačnu koncentraciju. Ovo je stara,
#: jedina vrijednost — ostala je kao vrijednost za nestabilne razrede u
#: `K_PO_RAZREDU` i kao usporedba „stare fizike” u `bazdari-izvor.py`.
K_VRTLOZENJE = 1.0

#: Početna veličina oblačića: ćelija izvora i nekoliko metara po visini.
SIGMA_H0 = 30.0
SIGMA_Z0 = 3.0

#: Oblačić se odbacuje kad iziđe iz obuhvata, kad ostari ili kad se raširi.
NAJSTARIJI = 12 * 3600.0
NAJSIRI = 1200.0

#: Koliko oblačića izvor ispusti po satu. Ploha je velika i postaja je blizu,
#: pa premalo oblačića daje šum umjesto polja.
PO_SATU = 60
#: Koliko puta u satu izvor ispušta; oblačići tako izlaze raspoređeni po satu.
ISPUSTA = 60
#: Najveći put koji oblačić smije prijeći u jednom koraku. Satna vrijednost je
#: prosjek po svim koracima, jer oblačić kroz sat prijeđe put i doprinosi
#: usput — a ne samo ondje gdje se zatekne na kraju sata. Kad je korak predug,
#: oblačić jednostavno preskoči prijemnik.
PUT_PO_KORAKU = 100.0
KORAKA_NAJMANJE, KORAKA_NAJVISE = 12, 180
#: Koliko se puta u satu polje slika. Slikanje je skupo, a polje se u satu ne
#: mijenja toliko da bi se isplatilo slikati na svakom koraku.
SLIKANJA = 6

#: Najmanja brzina nošenja; ispod ovoga vrtloženje ionako preuzima.
NAJMANJA_BRZINA = 0.25

#: Vrtloženje po razredu stabilnosti A–F, u m²/s — ugođeno na mjerenjima.
#:
#: Stara postavka (1 m²/s za sve razrede) davala je oblačiću u tihoj noći
#: isti rast kao u vjetrovitom danu, pa je perjanica i pri tišini poslušno
#: išla za smjerom s anemometra 4–16 km daleko — a taj je smjer pri slabom
#: vjetru šum. Mjerenja H₂S-a na postaji u udolini (676 m jugoistočno od
#: težišta plohe, 74 m ispod vrha) pokazala su da satne vrijednosti nose
#: potpis zastoja i miješanja, ne smjera: sam razred stabilnosti objašnjava
#: više nego cijeli stari model.
#:
#: Zato u stabilnim razredima vrtloženje raste: meandar slabog vjetra kroz
#: sat razmaže perjanicu na stotine metara (uz 120 m²/s σ za sat naraste na
#: ~930 m, što je unutar onoga što mjerenja meandra pri tišini pokazuju).
#: Nestabilni razredi (A–C) se ne diraju — njihovu fiziku potvrđuje ozon.
#:
#: Vrijednosti su ugođene na prvoj godini mjerenja (2024./25.) i provjerene
#: na drugoj (2025./26.): Spearman na drugoj godini raste s −0,01 na +0,13,
#: noću na +0,21. Jače vrijednosti (do 220 m²/s) dobiju još ~0,005, ali su
#: fizikalno neobranjive, pa se ne uzimaju. Vidi `bazdari-izvor.py`.
K_PO_RAZREDU = (
    K_VRTLOZENJE, K_VRTLOZENJE, K_VRTLOZENJE,
    6.0, 45.0, 120.0,
)


@dataclass(frozen=True)
class Ugodba:
    """Podesivi dijelovi fizike raspršenja.

    Zadane vrijednosti su ugođeni model (kolovoz 2026.); staru fiziku daje
    `Ugodba(k_vrtlozenje=(K_VRTLOZENJE,) * 6)`. Uz vrtloženje po razredu
    ovdje stoje i dva zahvata koja su u ugađanju isprobana i **odbačena** —
    meandar smjera i drenaža niz padinu. Na drugoj godini mjerenja nijedan
    nije dodao ništa povrh vrtloženja (meandar +0,05 sam, +0,00 povrh;
    drenaža +0,04 sam, +0,00 povrh), pa su zadano isključeni, a ostaju kao
    ručke za buduće provjere:

    Attributes:
        k_vrtlozenje: Vodoravno vrtloženje po razredu stabilnosti A–F, u m²/s.
            Stara postavka drži jednu brojku za sve razrede, pa oblačić u
            tihoj noći raste jednako sporo kao u vjetrovitom danu — a upravo
            se u tihim noćima zrak nad plohom meandrom raznese na sve strane.
        meander: Lutanje smjera nošenja, u stupnjevima pri 1 m/s; širina
            lutanja je `meander / max(brzina, 0,5)`. Smjer s anemometara
            4–16 km daleko pri slabom vjetru je šum, a model ga je dosad
            uzimao doslovno i cijelu perjanicu slao u taj šum.
        meander_tau: Vrijeme korelacije lutanja, u sekundama.
        drenaza: Brzina otjecanja niz padinu pri punoj težini, u m/s. Radi
            samo u stabilnim razredima (E, F); noću se hladan zrak s plohe
            cijedi u udoline bez obzira na to što javlja daleki anemometar.
        drenaza_prag: Brzina vjetra pri kojoj drenaža nestaje, u m/s;
            težina je `clip(1 − brzina/prag, 0, 1)`.
        najmanja_brzina: Najmanja brzina nošenja, u m/s.
    """

    k_vrtlozenje: tuple[float, float, float, float, float, float] = K_PO_RAZREDU
    meander: float = 0.0
    meander_tau: float = 900.0
    drenaza: float = 0.0
    drenaza_prag: float = 2.0
    najmanja_brzina: float = NAJMANJA_BRZINA


#: METAR javlja smjer zaokružen na 10°. Stvarni vjetar nije stepenast, ali
#: godišnja slika sastavljena od zaokruženih smjerova jest: perjanice se slože
#: u trideset šest oštrih zraka koje izgledaju kao nalaz, a samo su korak
#: zapisa. Zato se svakom satu doda slučajan zaokret unutar razreda, čime se
#: vraća raspodjela kakva je bila prije zaokruživanja. Pojedini sat time
#: postaje neznatno netočniji, a godišnja slika točnija.
ROTACIJA_ZAPISA = 5.0
#: Granice dubine miješanja koje ERA5 zna prijeći.
NAJPLICE, NAJDUBLJE = 30.0, 2500.0


def razred_stabilnosti(brzina: float, sunce: float, oblaci: float) -> int:
    """Pasquillov razred stabilnosti po Turnerovoj shemi.

    Args:
        brzina: Brzina vjetra na 10 m, u m/s.
        sunce: Kratkovalno zračenje na tlu, u W/m².
        oblaci: Naoblaka u postotcima.

    Returns:
        Broj 0–5 za razrede A–F; A je najnestabilniji, F najstabilniji.
    """
    if sunce > 10.0:
        if sunce > 700.0:
            stupac = (0, 0, 1, 2, 2)
        elif sunce > 350.0:
            stupac = (1, 1, 2, 3, 3)
        else:
            stupac = (1, 2, 2, 3, 3)
    elif oblaci >= 50.0:
        stupac = (4, 4, 3, 3, 3)
    else:
        stupac = (5, 5, 4, 3, 3)
    redak = 0 if brzina < 2 else 1 if brzina < 3 else 2 if brzina < 5 else 3 if brzina < 6 else 4
    return stupac[redak]


def knjiznica_polja(obuhvat: Obuhvat = RASPRSENJE) -> np.ndarray:
    """Računa polja vjetra za sve smjerove i dubine; pamti ih u `.cache/`.

    Polje je linearno u brzini, pa se za svaki sat uzima polje za jedinicu
    brzine i pomnoži brzinom toga sata. Dubina ulazi nelinearno, pa se za nju
    računaju posebna polja.

    Smjer se ne zaokružuje na najbliži nego se miješaju dva susjedna polja
    (vidi `prodji`). Bez miješanja svi sati unutar istog razreda nose perjanicu
    u potpuno istom smjeru, pa se u godišnjoj slici pojave zrake — trideset
    šest oštrih krakova koji izgledaju kao nalaz, a samo su korak razreda.

    Args:
        obuhvat: Obuhvat računa.

    Returns:
        Polje oblika (SMJEROVA, len(DUBINE), 2, ny, nx), u m/s po jedinici
        brzine na otvorenom.
    """
    # Granica debljine sloja ulazi u ime datoteke jer ulazi i u rješenje.
    # Bez nje bi promjena granice tiho posegnula za starim poljima — a upravo
    # se tako i dogodilo da su dvije kopije istog računa dugo imale dvije
    # različite granice, a da se u proizvodu ništa nije pomaknulo.
    z = gladi(ucitaj_reljef(obuhvat), 3)
    # I granica debljine i visina na kojoj stoji dno sloja ulaze u rješenje, pa
    # ulaze i u ime datoteke. Bez toga promjena bilo čega od toga tiho posegne
    # za starim poljima i izgleda kao da nije ništa promijenila.
    put = PREDMEMORIJA / (
        f"polja-vjetra-{obuhvat.nx}x{obuhvat.ny}-{SMJEROVA}-{len(DUBINE)}"
        f"-s{NAJTANJI_SLOJ:.0f}-t{_sidro(z):.0f}.npy"
    )
    if put.exists():
        return np.load(put)

    polja = np.zeros(
        (SMJEROVA, len(DUBINE), 2, obuhvat.ny, obuhvat.nx), dtype=np.float32
    )
    for i in range(SMJEROVA):
        for j, dubina in enumerate(DUBINE):
            u, v = polje_vjetra(z, i * 360.0 / SMJEROVA, 1.0, dubina, obuhvat)
            polja[i, j, 0] = u
            polja[i, j, 1] = v
        logger.info("polja vjetra: %d/%d smjerova", i + 1, SMJEROVA)
    put.parent.mkdir(parents=True, exist_ok=True)
    np.save(put, polja)
    return polja


@dataclass
class Roj:
    """Živi oblačići u obuhvatu.

    Attributes:
        x: Položaji po istoku, u metrima (HTRS96/TM).
        y: Položaji po sjeveru, u metrima.
        put: Prijeđeni put svakog oblačića, u metrima.
        dob: Starost svakog oblačića, u sekundama.
        masa: Masa mirisa u oblačiću, u ouE.
        razred: Razred stabilnosti pri ispuštanju, 0–5.
        ux: Zadnja brzina prema istoku, u m/s.
        uy: Zadnja brzina prema sjeveru, u m/s.
    """

    x: np.ndarray
    y: np.ndarray
    put: np.ndarray
    dob: np.ndarray
    masa: np.ndarray
    razred: np.ndarray
    ux: np.ndarray
    uy: np.ndarray

    @classmethod
    def prazan(cls) -> Roj:
        """Vraća roj bez ijednog oblačića."""
        p = np.zeros(0)
        return cls(
            p, p.copy(), p.copy(), p.copy(), p.copy(),
            p.copy().astype(int), p.copy(), p.copy(),
        )

    def __len__(self) -> int:
        return len(self.x)

    def dodaj(self, drugi: Roj) -> None:
        """Pripaja novoispuštene oblačiće."""
        self.x = np.concatenate([self.x, drugi.x])
        self.y = np.concatenate([self.y, drugi.y])
        self.put = np.concatenate([self.put, drugi.put])
        self.dob = np.concatenate([self.dob, drugi.dob])
        self.masa = np.concatenate([self.masa, drugi.masa])
        self.razred = np.concatenate([self.razred, drugi.razred])
        self.ux = np.concatenate([self.ux, drugi.ux])
        self.uy = np.concatenate([self.uy, drugi.uy])

    def zadrzi(self, ostaje: np.ndarray) -> None:
        """Odbacuje oblačiće koje je vjetar iznio van ili koji su se raspali."""
        self.x = self.x[ostaje]
        self.y = self.y[ostaje]
        self.put = self.put[ostaje]
        self.dob = self.dob[ostaje]
        self.masa = self.masa[ostaje]
        self.razred = self.razred[ostaje]
        self.ux = self.ux[ostaje]
        self.uy = self.uy[ostaje]

    def osi(
        self, razmak: float, k_vrt: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Vraća poluosi oblačića: uzduž vjetra, poprijeko i po visini.

        Oblačići se ispuštaju u razmacima, pa pri jačem vjetru između dva
        susjedna ostane rupa šira od njih samih — prijemnik tada ne vidi
        perjanicu nego niz odvojenih mrlja. Zato se svaki oblačić rasteže
        uzduž vjetra na polovicu razmaka do sljedećega. Zbroj po nizu tada
        daje točno onu koncentraciju koju daje i neprekinuta perjanica, a
        oblik ostaje Lagrangeov.

        Args:
            razmak: Vrijeme između dva ispuštanja, u sekundama.
            k_vrt: Vrtloženje po razredu stabilnosti, u m²/s.

        Returns:
            Trojku (uzduž, poprijeko, po visini), sve u metrima.
        """
        sig_h, sig_z = self.sirine(k_vrt)
        pomak = np.hypot(self.ux, self.uy) * razmak / 2.0
        return np.sqrt(sig_h**2 + pomak**2), sig_h, sig_z

    def smjer(self) -> tuple[np.ndarray, np.ndarray]:
        """Vraća jedinični vektor smjera nošenja svakog oblačića."""
        brzina = np.hypot(self.ux, self.uy)
        gdje = brzina > 1e-6
        ex = np.where(gdje, self.ux / np.where(gdje, brzina, 1.0), 1.0)
        ey = np.where(gdje, self.uy / np.where(gdje, brzina, 1.0), 0.0)
        return ex, ey

    def sirine(self, k_vrt: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Vraća vodoravnu i okomitu širinu svakog oblačića, u metrima.

        Args:
            k_vrt: Vrtloženje po razredu stabilnosti A–F, u m²/s.
        """
        iy = np.array(BRIGGS_Y)[self.razred]
        iz = np.array(BRIGGS_Z)[self.razred]
        ispravak = np.array(BRIGGS_Z_ISPRAVAK)[self.razred]
        sig_h = np.sqrt(
            SIGMA_H0**2 + (iy * self.put) ** 2 + 2 * k_vrt[self.razred] * self.dob
        )
        sig_z = np.sqrt(
            SIGMA_Z0**2 + (iz * self.put / np.sqrt(1 + ispravak * self.put)) ** 2
        )
        return sig_h, sig_z


@dataclass(frozen=True)
class Sat:
    """Jedan sat vremena kakav model treba.

    Attributes:
        t: Sat u UTC-u, oblika `GGGG-MM-DDTHH:00Z`.
        smjer: Smjer iz kojega puše, u stupnjevima.
        brzina: Brzina vjetra na 10 m, u m/s.
        dubina: Dubina miješanog sloja, u metrima.
        razred: Pasquillov razred stabilnosti, 0–5.
    """

    t: str
    smjer: float
    brzina: float
    dubina: float
    razred: int


def slozi_sate(
    vjetrovi: dict[str, tuple[float, float]],
    okolnosti: dict[str, dict],
    rotacija: float = ROTACIJA_ZAPISA,
    sjeme: int = 11,
) -> list[Sat]:
    """Spaja vjetar i okolnosti u niz sati koji model može odraditi.

    Sati kojima nedostaje vjetar preskaču se; izvor tada i dalje ispušta, ali
    to se ovdje ne može pratiti, pa se u ispisu javlja koliko ih je bilo.

    Args:
        vjetrovi: Satni vjetar iz `vjetar.ucitaj`.
        okolnosti: Satne okolnosti iz `vjetar.uvjeti`.
        rotacija: Polovica razreda u kojem je smjer zapisan, u stupnjevima;
            unutar njega se smjer nasumično zaokrene. Nula isključuje zaokret.
        sjeme: Sjeme slučajnih brojeva, da je račun ponovljiv.

    Returns:
        Sate poredane po vremenu.
    """
    rng = np.random.default_rng(sjeme)
    sati = []
    for t in sorted(vjetrovi):
        o = okolnosti.get(t)
        if o is None or o.get("granicni") is None:
            continue
        smjer, brzina = vjetrovi[t]
        if rotacija:
            smjer = (smjer + rng.uniform(-rotacija, rotacija)) % 360.0
        sati.append(
            Sat(
                t=t,
                smjer=smjer,
                brzina=brzina,
                dubina=float(np.clip(o["granicni"], NAJPLICE, NAJDUBLJE)),
                razred=razred_stabilnosti(
                    brzina, float(o.get("sunce") or 0.0), float(o.get("oblaci") or 0.0)
                ),
            )
        )
    return sati


def _ispusti(
    izvor: np.ndarray, oer: float, razmak: float, razred: int,
    rng: np.random.Generator,
) -> Roj:
    """Ispušta oblačiće jednog ispuštanja, raspoređene po plohi izvora.

    Args:
        izvor: Točke izvora, oblika (n, 2), u HTRS96/TM.
        oer: Jačina izvora u ouE/s.
        razmak: Vrijeme koje ovo ispuštanje pokriva, u sekundama.
        razred: Pasquillov razred stabilnosti toga sata.
        rng: Izvor slučajnih brojeva.

    Returns:
        Novoispuštene oblačiće; zajedno nose emisiju jednog razmaka.
    """
    koliko = max(PO_SATU // ISPUSTA, 1)
    kljuc = rng.integers(0, len(izvor), koliko)
    return Roj(
        x=izvor[kljuc, 0] + rng.normal(0, SIGMA_H0, koliko),
        y=izvor[kljuc, 1] + rng.normal(0, SIGMA_H0, koliko),
        put=np.zeros(koliko),
        dob=np.zeros(koliko),
        masa=np.full(koliko, oer * razmak / koliko),
        razred=np.full(koliko, razred),
        ux=np.zeros(koliko),
        uy=np.zeros(koliko),
    )


def _vrhovi(
    roj: Roj, dubina: float, razmak: float, k_vrt: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Priprema ono što treba za očitanje: vrh, poluosi i smjer.

    Args:
        roj: Živi oblačići.
        dubina: Dubina miješanog sloja, u metrima.
        razmak: Vrijeme između dva ispuštanja, u sekundama.
        k_vrt: Vrtloženje po razredu stabilnosti, u m²/s.

    Returns:
        Petorku (vrh, poluos uzduž, poluos poprijeko, ex, ey).
    """
    uzduz, poprijeko, sig_z = roj.osi(razmak, k_vrt)
    # Dok je oblačić tanji od miješanog sloja, širenje po visini razrjeđuje ga
    # kao 2/(√(2π)·σ_z). Kad ispuni sloj, dalje po visini nema kamo — poklopac
    # ga zadrži, pa razrjeđenje stane na 1/H. Uzima se veće od toga dvoga: dok
    # se slobodno širi to je prvi član, a pod poklopcem drugi.
    f_z = np.maximum(2.0 / (math.sqrt(2 * math.pi) * sig_z), 1.0 / dubina)
    vrh = roj.masa / (2 * math.pi * uzduz * poprijeko) * f_z
    ex, ey = roj.smjer()
    return vrh, uzduz, poprijeko, ex, ey


def _doprinos(
    roj: Roj, dubina: float, razmak: float, k_vrt: np.ndarray,
    xs: np.ndarray, ys: np.ndarray,
) -> np.ndarray:
    """Koncentracija koju trenutačno stanje roja daje u zadanim točkama.

    Args:
        roj: Živi oblačići.
        dubina: Dubina miješanog sloja, u metrima.
        razmak: Vrijeme između dva ispuštanja, u sekundama.
        k_vrt: Vrtloženje po razredu stabilnosti, u m²/s.
        xs: Istočne koordinate točaka, u metrima.
        ys: Sjeverne koordinate točaka, u metrima.

    Returns:
        Koncentracija u ouE/m³ za svaku točku.
    """
    if not len(roj):
        return np.zeros(len(xs))
    vrh, uzduz, poprijeko, ex, ey = _vrhovi(roj, dubina, razmak, k_vrt)
    dx = xs[:, None] - roj.x[None, :]
    dy = ys[:, None] - roj.y[None, :]
    a = dx * ex[None, :] + dy * ey[None, :]
    c = -dx * ey[None, :] + dy * ex[None, :]
    return (
        vrh[None, :]
        * np.exp(
            -(a**2) / (2 * uzduz[None, :] ** 2) - c**2 / (2 * poprijeko[None, :] ** 2)
        )
    ).sum(1)


def _naslikaj(
    roj: Roj, dubina: float, razmak: float, k_vrt: np.ndarray,
    obuhvat: Obuhvat, polje: np.ndarray,
) -> None:
    """Pribraja trenutačno stanje roja u polje koncentracije pri tlu."""
    if not len(roj):
        return
    vrh, uzduz, poprijeko, ex, ey = _vrhovi(roj, dubina, razmak, k_vrt)
    for k in range(len(roj)):
        domet = 3.0 * max(uzduz[k], poprijeko[k])
        j0 = max(int((roj.x[k] - domet - obuhvat.x0) / obuhvat.dx), 0)
        j1 = min(int((roj.x[k] + domet - obuhvat.x0) / obuhvat.dx) + 1, obuhvat.nx)
        i0 = max(int((obuhvat.y1 - roj.y[k] - domet) / obuhvat.dx), 0)
        i1 = min(int((obuhvat.y1 - roj.y[k] + domet) / obuhvat.dx) + 1, obuhvat.ny)
        if j0 >= j1 or i0 >= i1:
            continue
        dx = obuhvat.x0 + (np.arange(j0, j1) + 0.5) * obuhvat.dx - roj.x[k]
        dy = obuhvat.y1 - (np.arange(i0, i1) + 0.5) * obuhvat.dx - roj.y[k]
        a = dx[None, :] * ex[k] + dy[:, None] * ey[k]
        c = -dx[None, :] * ey[k] + dy[:, None] * ex[k]
        polje[i0:i1, j0:j1] += vrh[k] * np.exp(
            -(a**2) / (2 * uzduz[k] ** 2) - c**2 / (2 * poprijeko[k] ** 2)
        )


def _polje_drenaze(obuhvat: Obuhvat) -> tuple[np.ndarray, np.ndarray]:
    """Jedinično polje otjecanja niz padinu, oslabljeno na ravnome.

    Reljef se gladi jače nego za polje vjetra: otjecanje ne slijedi svaki
    humak nego dolinsku skalu. Smjer je niz najveći pad, a težina raste s
    nagibom do punog učinka na 5 %, pa ravni teren ne otječe nikamo.

    Args:
        obuhvat: Obuhvat i korak rešetke.

    Returns:
        Par (u, v) jedinične brzine prema istoku i sjeveru, bez dimenzije.
    """
    z = gladi(ucitaj_reljef(obuhvat), 12)
    gi, gj = np.gradient(z)
    dz_dx = gj / obuhvat.dx
    dz_dn = -gi / obuhvat.dx
    nagib = np.hypot(dz_dx, dz_dn)
    tezina = np.clip(nagib / 0.05, 0.0, 1.0)
    s = np.where(nagib > 1e-9, nagib, 1.0)
    return (-dz_dx / s * tezina).astype(np.float32), (
        -dz_dn / s * tezina
    ).astype(np.float32)


def prodji(
    sati: list[Sat],
    izvor: np.ndarray,
    oer: float,
    obuhvat: Obuhvat = RASPRSENJE,
    prijemnici: np.ndarray | None = None,
    pamcenje: bool = True,
    sjeme: int = 7,
    ugodba: Ugodba | None = None,
):
    """Prolazi sat po sat i vraća satnu koncentraciju pri tlu.

    Args:
        sati: Niz sati iz `slozi_sate`, poredan po vremenu.
        izvor: Točke izvora, oblika (n, 2), u HTRS96/TM.
        oer: Jačina izvora u ouE/s.
        obuhvat: Obuhvat računa.
        prijemnici: Točke oblika (m, 2) u HTRS96/TM. Ako su zadane, vraća se
            samo vrijednost u njima — mnogo jeftinije od cijelog polja.
        pamcenje: Ako je laž, roj se prazni na kraju svakog sata — tako se
            dobiva usporedba s ustaljenim modelom bez pamćenja.
        sjeme: Sjeme slučajnih brojeva, da je račun ponovljiv.
        ugodba: Podesivi dijelovi fizike; bez nje vrijede zadane vrijednosti.

    Yields:
        Par (sat, vrijednosti). Vrijednosti su polje oblika (ny, nx) ili niz
        po prijemnicima, uvijek usrednjen po koracima unutar sata.
    """
    ug = ugodba if ugodba is not None else Ugodba()
    k_vrt = np.array(ug.k_vrtlozenje)
    polja = knjiznica_polja(obuhvat)
    dren_u, dren_v = (
        _polje_drenaze(obuhvat) if ug.drenaza > 0.0 else (None, None)
    )
    rng = np.random.default_rng(sjeme)
    roj = Roj.prazan()
    dubine = np.array(DUBINE)
    xs = prijemnici[:, 0] if prijemnici is not None else None
    ys = prijemnici[:, 1] if prijemnici is not None else None

    korak_smjera = 360.0 / SMJEROVA
    #: Trenutačni zaokret smjera zbog meandra; traje preko granice sata.
    zaokret = 0.0

    def mjesavina(smjer: float, i_dubina: int) -> tuple[np.ndarray, np.ndarray]:
        # Dva susjedna polja se miješaju po udjelu, umjesto da se smjer
        # zaokruži na najbliže. Polje je linearno u sve dvije komponente, pa
        # je mješavina i dalje polje kojemu je protok masa dosljedan.
        mjesto = (smjer % 360.0) / korak_smjera
        donji = int(np.floor(mjesto)) % SMJEROVA
        gornji = (donji + 1) % SMJEROVA
        udio = mjesto - np.floor(mjesto)
        u = polja[donji, i_dubina, 0] * (1 - udio) + polja[gornji, i_dubina, 0] * udio
        v = polja[donji, i_dubina, 1] * (1 - udio) + polja[gornji, i_dubina, 1] * udio
        return u, v

    for sat in sati:
        i_dubina = int(np.argmin(np.abs(dubine - sat.dubina)))
        brzina = max(sat.brzina, ug.najmanja_brzina)
        # Smjer s dalekog anemometra pri slabom vjetru je šum: umjesto da se
        # uzme doslovno, nošenje oko njega meandrira, i to šire što je vjetar
        # slabiji. Lutanje je Ornstein–Uhlenbeckovo, pa smjer ne skače nego
        # polako kruži, a preko sata se perjanica razmaže po lepezi.
        sirina_meandra = (
            min(ug.meander / max(sat.brzina, 0.5), 180.0) if ug.meander else 0.0
        )
        if not sirina_meandra:
            u, v = mjesavina(sat.smjer, i_dubina)
            u = u * brzina
            v = v * brzina

        # Noću se hladan zrak s plohe cijedi niz padinu u udoline, bez obzira
        # na to što javlja anemometar preko grada. Drenaža radi samo u
        # stabilnim razredima i gasi se kako vjetar jača.
        w_dren = (
            ug.drenaza * max(0.0, 1.0 - sat.brzina / ug.drenaza_prag)
            if dren_u is not None and sat.razred >= 4
            else 0.0
        )

        koraka = int(np.clip(
            math.ceil(brzina * 3600.0 / PUT_PO_KORAKU),
            KORAKA_NAJMANJE, KORAKA_NAJVISE,
        ))
        dt = 3600.0 / koraka
        po_ispustu = max(koraka // ISPUSTA, 1)
        po_slikanju = max(koraka // SLIKANJA, 1)
        razmak = po_ispustu * dt

        zbroj = (
            np.zeros(len(prijemnici)) if prijemnici is not None
            else np.zeros((obuhvat.ny, obuhvat.nx))
        )
        slika = 0
        for korak in range(koraka):
            if sirina_meandra:
                zaokret += -zaokret * dt / ug.meander_tau + rng.normal(
                    0.0, sirina_meandra * math.sqrt(2 * dt / ug.meander_tau)
                )
                u, v = mjesavina(sat.smjer + zaokret, i_dubina)
                u = u * brzina
                v = v * brzina
            if korak % po_ispustu == 0:
                roj.dodaj(_ispusti(izvor, oer, razmak, sat.razred, rng))
            if len(roj):
                j = np.clip(
                    ((roj.x - obuhvat.x0) / obuhvat.dx).astype(int), 0, obuhvat.nx - 1
                )
                i = np.clip(
                    ((obuhvat.y1 - roj.y) / obuhvat.dx).astype(int), 0, obuhvat.ny - 1
                )
                roj.ux, roj.uy = u[i, j], v[i, j]
                if w_dren:
                    roj.ux = roj.ux + w_dren * dren_u[i, j]
                    roj.uy = roj.uy + w_dren * dren_v[i, j]
                roj.x += roj.ux * dt
                roj.y += roj.uy * dt
                roj.put += np.hypot(roj.ux, roj.uy) * dt
                roj.dob += dt
            if prijemnici is not None:
                zbroj += _doprinos(roj, sat.dubina, razmak, k_vrt, xs, ys)
                slika += 1
            elif korak % po_slikanju == 0:
                _naslikaj(roj, sat.dubina, razmak, k_vrt, obuhvat, zbroj)
                slika += 1

        yield sat, zbroj / max(slika, 1)

        if pamcenje:
            _, sig_h, _ = roj.osi(razmak, k_vrt)
            roj.zadrzi(
                (roj.x > obuhvat.x0)
                & (roj.x < obuhvat.x1)
                & (roj.y > obuhvat.y0)
                & (roj.y < obuhvat.y1)
                & (roj.dob < NAJSTARIJI)
                & (sig_h < NAJSIRI)
            )
        else:
            roj = Roj.prazan()
