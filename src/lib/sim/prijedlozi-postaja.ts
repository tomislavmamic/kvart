/**
 * Predložene mjerne postaje oko plohe — što, gdje, čime i pošto.
 *
 * Popis je isti kao u GitHubovu zahtjevu #28, samo s koordinatama, da se
 * na karti vidi **gdje** bi što stajalo i zašto baš ondje. Poredak je po
 * tome koliko koja stavka skida izmjerene pogreške modela
 * (`docs/hindcast/IZVJESCE.md`, `docs/STATUS.json` → K1–K4), ne po cijeni.
 *
 * Položaji su prijedlozi na stotinjak metara: točno mjesto ovisi o
 * dozvoli, napajanju i slobodnom horizontu, pa kartica to i kaže.
 * Cijene su okvirne, u eurima, za opremu bez montaže.
 *
 * ## Što je razmotreno i nije ušlo
 *
 * Stobreč (157°, 2,3 km) i Kamen (155°, 1,0 km): zrak s plohe ide u taj smjer
 * 0,4 % odnosno 0,5 % sati u dvije godine ulaza (`ulazi-proizvodnja`, isječak
 * ±15°). To je ujedno i slabost postojeće postaje k1 na 141° — 1,2 % sati —
 * zbog koje ocjena modela stoji na krivoj strani plohe (K1 u `docs/STATUS.json`).
 * Postaja ondje ne bi mjerila perjanicu nego pozadinu.
 */

/**
 * Područje u kojem postaja i dalje mjeri ono zbog čega je predložena.
 *
 * `krug` je za postaje vezane uz jedno mjesto (plato plohe, referentni
 * analizator): sve unutar polumjera daje isti podatak. `isjecak` je za postaje
 * koje mjere pad s udaljenošću i širinu perjanice: njima je bitan smjer od
 * plohe i udaljenost, a ne točka — dvorište sto metara dalje jednako služi
 * dok je u istom isječku.
 */
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

export type Podrucje =
  | { readonly vrsta: "krug"; readonly polumjerM: number }
  | {
      readonly vrsta: "isjecak";
      /** Udaljenost od izvora na plohi, u metrima. */
      readonly odM: number;
      readonly doM: number;
      /** Azimut od izvora, u stupnjevima od sjevera. */
      readonly odAz: number;
      readonly doAz: number;
    };

export type PrijedlogPostaje = {
  readonly id: string;
  /** Ime po mjestu na kojem stoji, onako kako ga zove tko ondje živi. */
  readonly naziv: string;
  /** Ulica, naselje i grad; provjereno na katastru, granicama naselja i OSM-u. */
  readonly mjesto: string;
  readonly lat: number;
  readonly lon: number;
  /** Gdje sve smije stajati, a da i dalje mjeri isto. */
  readonly podrucje: Podrucje;
  /**
   * Točka leži izvan polja koje simulator računa (6,4 km oko plohe).
   *
   * Postaja bi ondje mjerila, ali usporedba s modelom traži šire polje, pa to
   * kartica mora reći umjesto da šuti.
   */
  readonly izvanPolja?: true;
  /** Faza nabave: A prvo, B zatim, C po potrebi. */
  readonly faza: "A" | "B" | "C";
  /** Redni broj u #28, za vezu s tekstom. */
  readonly stavka: number;
  /** Što mjeri, kratko, za naslov kartice. */
  readonly mjeri: string;
  /** Što točno i kojim korakom. */
  readonly velicine: readonly string[];
  readonly oprema: readonly string[];
  /** Okvirna cijena opreme, € (od–do). */
  readonly cijena: readonly [number, number];
  /** Zašto baš ovdje i koju pogrešku modela skida. */
  readonly zasto: string;
  /** Što se na terenu treba dogovoriti. */
  readonly uvjeti: string;
};

export const PRIJEDLOZI_POSTAJA: readonly PrijedlogPostaje[] = [
  {
    id: "ploha-jarbol",
    naziv: "Plato Karepovca — jarbol",
    mjesto: "tijelo odlagališta, 205 m od najbližeg ruba; Kamen, Grad Split",
    lat: 43.5215,
    lon: 16.5105,
    podrucje: { vrsta: "krug", polumjerM: 150 },
    faza: "A",
    stavka: 1,
    mjeri: "vjetar, inverzija, tlak",
    velicine: [
      "smjer i brzina vjetra na 10 m, 1-minutni prosjek, raspršenje smjera (σθ) i nalet",
      "temperatura na 2 m i 10 m (razlika = jačina inverzije)",
      "tlak zraka na 0,1 hPa; po mogućnosti kratkovalno zračenje",
    ],
    oprema: [
      "2-D ultrazvučni anemometar (Gill WindSonic, Thies 2D ili jeftiniji Davis/Ecowitt ultrasonic)",
      "jarbol 10 m sa sidrenjem",
      "dva ventilirana termometra ±0,1 °C, barometar; piranometar po želji",
      "zapisivač s LTE/Wi-Fi i solarnim napajanjem",
    ],
    cijena: [1500, 3000],
    zasto:
      "Najbliži anemometar s arhivom je 4,3 km daleko, u zaklonu grada; noću ispod 1,5 m/s njegov je smjer šum, a model perjanicu nosi točno u taj šum. Ovo je jedini način da se lokalni vjetar i inverzija mjere ondje gdje plin izlazi — i da se Vrboran i Split-3 ocijene prema mjesnoj istini.",
    uvjeti: "Dozvola upravitelja plohe (Čistoća / Grad Split); plato podalje od ruba i strojeva, slobodan horizont.",
  },
  {
    id: "padina-sz",
    naziv: "Padina iznad Dračevca",
    mjesto: "uz Ulicu Dračevac, naselje Dračevac, Grad Split",
    lat: 43.5227,
    lon: 16.5058,
    podrucje: { vrsta: "isjecak", odM: 350, doM: 650, odAz: 277, doAz: 297 },
    faza: "B",
    stavka: 2,
    mjeri: "otjecanje niz padinu",
    velicine: ["smjer i brzina vjetra na 3 m, 1-minutni prosjek"],
    oprema: ["jeftiniji ultrazvučni anemometar na stupu 3 m", "zapisivač, solarno napajanje"],
    cijena: [300, 600],
    zasto:
      "Oko 480 m od izvora na plohi prema 287°, na padini između plohe i Dračevca. Noćno otjecanje hladnog zraka niz padinu gradske postaje ne vide, a najvjerojatnije objašnjava večernje dojave s Dračevca uz jugozapadnjak na Split-3.",
    uvjeti: "Privatno dvorište ili javni stup uz put; dogovor s vlasnikom.",
  },
  {
    id: "dno-bilice",
    naziv: "Mostine — dno udoline",
    mjesto: "između Ulice Zbora narodne garde i Ulice Bilice II, Mostine, Grad Split",
    lat: 43.5255,
    lon: 16.4895,
    podrucje: { vrsta: "isjecak", odM: 1600, doM: 2100, odAz: 276, doAz: 292 },
    faza: "B",
    stavka: 2,
    mjeri: "otjecanje niz padinu (doseg)",
    velicine: ["smjer i brzina vjetra na 3 m, 1-minutni prosjek"],
    oprema: ["jeftiniji ultrazvučni anemometar na stupu 3 m", "zapisivač, solarno napajanje"],
    cijena: [300, 600],
    zasto:
      "Druga točka na istoj padini, 1,5–2 km niže: dvije točke daju brzinu i doseg otjecanja koje model danas pogađa (pokus E6 nije se dao ocijeniti bez ovoga).",
    uvjeti: "Javni stup ili dvorište; dogovor s vlasnikom.",
  },
  {
    id: "dracevac-7b",
    naziv: "Dračevac — sjever naselja",
    mjesto: "Ulica Dračevac kod broja 7B, sjeverni dio naselja Dračevac, Grad Split",
    lat: 43.5278,
    lon: 16.504,
    podrucje: { vrsta: "isjecak", odM: 750, doM: 1150, odAz: 309, doAz: 329 },
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju + temperatura za inverziju",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek", "temperatura 2 m (par s jarbolom na plohi: razlika visina 80 m)"],
    oprema: ["elektrokemijski H₂S senzor s temperaturnom kompenzacijom (Alphasense H2S-B4 u kućištu, Aeroqual 500 ili gotova ppb postaja)", "ventilirani termometar", "zapisivač"],
    cijena: [700, 1600],
    zasto:
      "Sve dosadašnje ocjene modela dolaze s krive strane plohe (postaja u udolini na 140°). Dračevac je na 319°, 0,9 km od izvora, i odatle dolaze dojave. Tisuće sati odavde daju bazdarenje jačine i stopu lažnih uzbuna koje 15 dojava ne može.",
    uvjeti: "Dvorište ili balkon stanovnika (dojavitelj s Dračevca 7B je prirodan domaćin); struja iz kuće.",
  },
  {
    id: "bilice",
    naziv: "Bilice II",
    mjesto: "Ulica Bilice II, naselje Bilice, Grad Split",
    lat: 43.5261,
    lon: 16.4935,
    podrucje: { vrsta: "isjecak", odM: 1300, doM: 1800, odAz: 279, doAz: 299 },
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto: "Druga točka na osi prema kvartu, 1,5 km od plohe: s Dračevcem daje pad s udaljenošću koji model danas izmišlja.",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće.",
  },
  {
    id: "kila-mostine",
    naziv: "Stoci (Mostine)",
    mjesto: "Ulica Stoci, Mostine, Grad Split",
    lat: 43.5215,
    lon: 16.4915,
    podrucje: { vrsta: "isjecak", odM: 1300, doM: 1900, odAz: 258, doAz: 282 },
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju (bočno)",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto: "Bočna točka, 1,6 km ravno zapadno: kad ovdje ne smrdi, a na Dračevcu da, širina perjanice je izmjerena, ne pretpostavljena.",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće.",
  },
  {
    id: "solin-rub",
    naziv: "Solin — Priko vode",
    mjesto: "Ulica grada Vukovara, Kunćevi (MO Priko vode), Grad Solin; 1,2 km od središta Solina",
    lat: 43.535,
    lon: 16.493,
    podrucje: { vrsta: "isjecak", odM: 1800, doM: 2600, odAz: 303, doAz: 327 },
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju (doseg)",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto: "Najdalja točka, 2,1 km na 315°: dokle miris uopće doseže. Leži u gradu Solinu, a dojave odande već postoje (Matoševa).",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće. Točka je unutar Grada Solina, pa je Grad Solin ovdje prirodan vlasnik i plaćatelj postaje.",
  },
  {
    id: "k1-umjeravanje",
    naziv: "Uz postaju Karepovac 1",
    mjesto: "Put bunara, Kamen, Grad Split; 359 m izvan ruba plohe",
    lat: 43.51665,
    lon: 16.51691,
    podrucje: { vrsta: "krug", polumjerM: 60 },
    faza: "A",
    stavka: 4,
    mjeri: "H₂S — umjeravanje jeftinih senzora",
    velicine: ["H₂S na ppb razini, minutni zapis, usporedno s referentnim analizatorom Zavoda"],
    oprema: ["isti jeftini H₂S senzor kao u naseljima", "zapisivač"],
    cijena: [600, 1500],
    zasto:
      "Jeftini senzori vrijede samo umjereni prema referentnom uređaju. Dva tjedna ovdje prije razmještaja i jednom u pola godine daju svakom senzoru vlastitu krivulju.",
    uvjeti: "Dogovor sa Zavodom za javno zdravstvo SDŽ za mjesto uz ograđeni prostor postaje.",
  },
  {
    id: "ograda-metan",
    naziv: "Jugoistočna ograda plohe",
    mjesto: "17 m unutar ruba plohe, uz jugoistočnu ogradu; Kamen, Grad Split",
    lat: 43.5195,
    lon: 16.5135,
    podrucje: { vrsta: "isjecak", odM: 200, doM: 350, odAz: 124, doAz: 164 },
    faza: "C",
    stavka: 5,
    mjeri: "metan kao tragač plina s plohe",
    velicine: ["metan (ppm) točkasto ili otvorenim putem, minutni zapis"],
    oprema: ["NDIR/TDLAS točkasti senzor ili otvoreni put uz ogradu", "zapisivač"],
    cijena: [2000, 10000],
    zasto:
      "Emisija je u modelu jedna brojka (95 %: pola do dvostruko). Metan je robustan tragač istog toka plina, pa daje dnevnu krivulju izvora — uz tlak i temperaturu pokrova s jarbola na plohi. Ograda jugoistočno je niz najčešći noćni vjetar.",
    uvjeti: "Dozvola upravitelja plohe; napajanje na ogradi.",
  },
  {
    id: "mravince",
    naziv: "Mravince",
    mjesto: "naselje Mravince, Grad Solin",
    lat: 43.533,
    lon: 16.515,
    podrucje: { vrsta: "isjecak", odM: 1050, doM: 1600, odAz: 2, doAz: 22 },
    faza: "B",
    stavka: 4,
    mjeri: "H₂S sjeveroistočno od plohe",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto:
      "Prva točka sjeveroistočno od plohe. Zrak onamo ide 5,9 % sati, a u tišini ispod 2 m/s čak 9,7 % — otprilike kao prema Žnjanu, a odande nemamo nijedno mjerenje ni dojavu. Popis je dosad slijedio izmjerenu pogrešku modela, a sva su opažanja sa zapada i sjeverozapada, pa je sjeveroistok ostao slijep, a ne čist.",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće. Mravince su u Gradu Solinu, kao i Priko vode i Kučine.",
  },
  {
    id: "kucine",
    naziv: "Kučine",
    mjesto: "Put svetog Petra, naselje Kučine, Grad Solin",
    lat: 43.5365,
    lon: 16.5265,
    podrucje: { vrsta: "isjecak", odM: 1750, doM: 2400, odAz: 26, doAz: 46 },
    faza: "C",
    stavka: 4,
    mjeri: "H₂S sjeveroistočno (doseg)",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto:
      "Druga točka na sjeveroistočnoj osi, 2,1 km od plohe: s Mravincima daje pad s udaljenošću na strani na kojoj ga danas uopće ne mjerimo. Zrak onamo ide 5,5 % sati, u tišini 9,0 %.",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće.",
  },
  {
    id: "znjan",
    naziv: "Žnjan — Pazdigrad",
    mjesto: "Put Žnjana, Pazdigrad, gradski kotar Žnjan, Grad Split",
    lat: 43.5045,
    lon: 16.4908,
    podrucje: { vrsta: "isjecak", odM: 2150, doM: 2950, odAz: 212, doAz: 232 },
    faza: "C",
    stavka: 4,
    mjeri: "H₂S jugozapadno (doseg)",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto:
      "Jugozapadna os, 2,5 km od plohe: zrak onamo ide 7,4 % sati, ali samo 3,7 % tihih sati, pa je ovo najgušće naseljena strana s najmanjom vjerojatnošću da miris stigne. Postaja ondje najviše vrijedi kao provjera nulte razine u gradu.",
    uvjeti: "Dvorište, balkon ili javna zgrada; struja iz objekta.",
  },
  {
    id: "kampus",
    naziv: "Sveučilišni kampus",
    mjesto: "Ulica Ruđera Boškovića, Pisano Kame, gradski kotar Split 3, Grad Split",
    lat: 43.511,
    lon: 16.4682,
    izvanPolja: true,
    podrucje: { vrsta: "isjecak", odM: 3200, doM: 4300, odAz: 242, doAz: 262 },
    faza: "C",
    stavka: 4,
    mjeri: "H₂S na kraju najčešće osi",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto:
      "Zrak ide prema kampusu 25,7 % sati i 24,3 % tihih — to je najčešća os od svih devet dosadašnjih točaka. Na 3,7 km odgovara na pitanje dokle miris uopće nosi, a sveučilište ima i tko će uređaj održavati. Točka je izvan polja koje simulator računa, pa bi za usporedbu s modelom trebalo proširiti polje.",
    uvjeti: "Dogovor sa Sveučilištem u Splitu; struja i mreža iz zgrade.",
  },
];

/** Izvor perjanice na plohi; od njega se mjere isječci. */
export const IZVOR_PLOHE = SIM_POLJE.izvor;

/** Metara po stupnju zemljopisne širine, odnosno dužine na toj širini. */
function mjerila(lat: number): [number, number] {
  return [111_320 * Math.cos((lat * Math.PI) / 180), 110_540];
}

/** Točka na `dM` metara i azimutu `az` (stupnjevi od sjevera) od ishodišta. */
function tocka(lon0: number, lat0: number, dM: number, az: number): [number, number] {
  const [mLon, mLat] = mjerila(lat0);
  const r = (az * Math.PI) / 180;
  return [lon0 + (dM * Math.sin(r)) / mLon, lat0 + (dM * Math.cos(r)) / mLat];
}

/**
 * Obod područja u kojem postaja i dalje mjeri isto, kao zatvoreni prsten.
 *
 * Krug se crta oko same točke, isječak oko izvora na plohi — jer je isječku
 * smisao „isti smjer i ista udaljenost od plohe”, a ne blizina predloženom
 * dvorištu.
 */
export function obodPodrucja(p: PrijedlogPostaje, korak = 2): [number, number][] {
  if (p.podrucje.vrsta === "krug") {
    const n = 48;
    const prsten: [number, number][] = [];
    for (let i = 0; i <= n; i += 1) {
      prsten.push(tocka(p.lon, p.lat, p.podrucje.polumjerM, (360 * i) / n));
    }
    return prsten;
  }
  const { odM, doM, odAz, doAz } = p.podrucje;
  const { lon, lat } = IZVOR_PLOHE;
  const prsten: [number, number][] = [];
  for (let a = odAz; a < doAz; a += korak) prsten.push(tocka(lon, lat, doM, a));
  prsten.push(tocka(lon, lat, doM, doAz));
  for (let a = doAz; a > odAz; a -= korak) prsten.push(tocka(lon, lat, odM, a));
  prsten.push(tocka(lon, lat, odM, odAz));
  prsten.push(prsten[0]);
  return prsten;
}

/** Udaljenost u riječima: metri do kilometra, dalje kilometri s decimalom. */
function duljina(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Raspon s jednom mjernom jedinicom: „350–650 m”, „1,3–1,8 km”. */
function raspon(odM: number, doM: number): string {
  if (doM < 1000) return `${odM}–${doM} m`;
  const km = (v: number) => (v / 1000).toFixed(1).replace(".", ",");
  return `${km(odM)}–${km(doM)} km`;
}

/** Rečenica koja opisuje isto što karta crta, da se to dvoje ne raziđe. */
export function opisPodrucja(p: PrijedlogPostaje): string {
  if (p.podrucje.vrsta === "krug") {
    return `bilo gdje unutar ${duljina(p.podrucje.polumjerM)} od označene točke`;
  }
  const { odM, doM, odAz, doAz } = p.podrucje;
  return `bilo gdje u osjenčanom isječku: ${raspon(odM, doM)} od plohe, u smjeru ${odAz}–${doAz}°`;
}

/** Okvirna cijena faze, € (od–do), za natpis. */
export function cijenaFaze(faza: PrijedlogPostaje["faza"]): [number, number] {
  return PRIJEDLOZI_POSTAJA.filter((p) => p.faza === faza).reduce(
    (z, p) => [z[0] + p.cijena[0], z[1] + p.cijena[1]],
    [0, 0] as [number, number],
  );
}

export const ZAHTJEV_URL = "https://github.com/tomislavmamic/kvart/issues/28";
