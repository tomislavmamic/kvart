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
 */

export type PrijedlogPostaje = {
  readonly id: string;
  readonly naziv: string;
  readonly lat: number;
  readonly lon: number;
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
    naziv: "Jarbol na plohi",
    lat: 43.5215,
    lon: 16.5105,
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
    naziv: "Padina prema Dračevcu",
    lat: 43.5227,
    lon: 16.5058,
    faza: "B",
    stavka: 2,
    mjeri: "otjecanje niz padinu",
    velicine: ["smjer i brzina vjetra na 3 m, 1-minutni prosjek"],
    oprema: ["jeftiniji ultrazvučni anemometar na stupu 3 m", "zapisivač, solarno napajanje"],
    cijena: [300, 600],
    zasto:
      "Oko 400 m od težišta plohe prema 290°, na padini između plohe i Dračevca. Noćno otjecanje hladnog zraka niz padinu gradske postaje ne vide, a najvjerojatnije objašnjava večernje dojave s Dračevca uz jugozapadnjak na Split-3.",
    uvjeti: "Privatno dvorište ili javni stup uz put; dogovor s vlasnikom.",
  },
  {
    id: "dno-bilice",
    naziv: "Dno udoline, Mostine/Bilice",
    lat: 43.5255,
    lon: 16.4895,
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
    naziv: "Dračevac",
    lat: 43.5278,
    lon: 16.504,
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju + temperatura za inverziju",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek", "temperatura 2 m (par s jarbolom na plohi: razlika visina 80 m)"],
    oprema: ["elektrokemijski H₂S senzor s temperaturnom kompenzacijom (Alphasense H2S-B4 u kućištu, Aeroqual 500 ili gotova ppb postaja)", "ventilirani termometar", "zapisivač"],
    cijena: [700, 1600],
    zasto:
      "Sve dosadašnje ocjene modela dolaze s krive strane plohe (postaja u udolini na 140°). Dračevac je na 293°, 0,5–1 km od plohe, i odatle dolaze dojave. Tisuće sati odavde daju bazdarenje jačine i stopu lažnih uzbuna koje 15 dojava ne može.",
    uvjeti: "Dvorište ili balkon stanovnika (dojavitelj s Dračevca 7B je prirodan domaćin); struja iz kuće.",
  },
  {
    id: "bilice",
    naziv: "Bilice",
    lat: 43.5261,
    lon: 16.4935,
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
    naziv: "Kila / Mostine",
    lat: 43.5215,
    lon: 16.4915,
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju (bočno)",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto: "Bočna točka, 2 km zapadno-jugozapadno: kad ovdje ne smrdi, a na Dračevcu da, širina perjanice je izmjerena, ne pretpostavljena.",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće.",
  },
  {
    id: "solin-rub",
    naziv: "Rub Solina",
    lat: 43.535,
    lon: 16.493,
    faza: "A",
    stavka: 4,
    mjeri: "H₂S u naselju (doseg)",
    velicine: ["H₂S na ppb razini, minutni zapis, satni prosjek"],
    oprema: ["elektrokemijski H₂S senzor s kompenzacijom", "zapisivač"],
    cijena: [600, 1500],
    zasto: "Najdalja točka, 3 km na 300°: dokle miris uopće doseže. Dojave iz Solina već postoje (Matoševa).",
    uvjeti: "Dvorište ili balkon stanovnika; struja iz kuće.",
  },
  {
    id: "k1-umjeravanje",
    naziv: "Uz postaju Karepovac 1",
    lat: 43.51665,
    lon: 16.51691,
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
    naziv: "Ograda niz vjetar",
    lat: 43.5195,
    lon: 16.5135,
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
];

/** Okvirna cijena faze, € (od–do), za natpis. */
export function cijenaFaze(faza: PrijedlogPostaje["faza"]): [number, number] {
  return PRIJEDLOZI_POSTAJA.filter((p) => p.faza === faza).reduce(
    (z, p) => [z[0] + p.cijena[0], z[1] + p.cijena[1]],
    [0, 0] as [number, number],
  );
}

export const ZAHTJEV_URL = "https://github.com/tomislavmamic/kvart/issues/28";
