/**
 * Popis navoda GUP-a i njihovo razrješavanje u ulomak.
 *
 * Dvije vrste navoda:
 *  - imenovani, ovdje ispod — mjesta na koja se poziva tekst stranica (/gup);
 *  - izvedeni iz izvadaka odredbi (data/gup-grad/odredbe/izvor/): najmanja
 *    građevna čestica i nova gradnja po urbanom pravilu, i što namjena
 *    dopušta. Na njih se poziva karta čestica, imenima iz id.ts.
 *
 * Navod teksta je citat (ili više njih) sa stranicom izvornika; traži se u
 * tekstu dokumenta (tekst.ts), pa ulomak pokazuje doslovan tekst s istaknutim
 * citatom. Navod članka je cijeli članak. Navod lista je kartografski prikaz,
 * cijeli ili okvir na njemu (okvire daje scripts/gup-grad/okvir-lista.py).
 *
 * Samo na poslužitelju; ulomci idu pregledniku kroz /api/gup/navod/<id>.
 */
import { readFile } from "fs/promises";
import path from "path";

import { kodirajOznake, navodGradnja, navodNamjena, navodPpmin } from "./id";
import { izdanjaLista, izdanjeDokumenta, putLista, sidro } from "./izdanja";
import type { Blok, DokumentId, Okvir, Ulomak } from "./model";
import { indeksDokumenta, ucitajDokument, ucitajListove } from "./podaci";
import { nadjiCitat, spojiOznake, type Oznaka } from "./tekst";

export interface Citat {
  /** Doslovno iz izvornika; izostavljeno kao „…”. */
  t: string;
  /** Stranica izvornika na koju se citat poziva. */
  s?: number;
}

export type SpecNavoda =
  | { dok: DokumentId; citati: Citat[]; opis?: string }
  | { dok: DokumentId; clanak: string; doClanka?: string; opis?: string }
  | { list: string; okvir?: Okvir; opis?: string };

/** Imenovani navodi — mjesta na koja se poziva tekst na /gup. */
export const NAVODI: Record<string, SpecNavoda> = {
  "clanak-7-2015": {
    dok: "55-14",
    clanak: "cl-7",
    opis: "namjene površina, njihove boje i oznake na listu 1",
  },
  "sve-namjene-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Na površinama svih namjena grade se nove te održavaju i po potrebi rekonstruiraju postojeće ulice i trgovi, javna parkirališta te komunalne građevine i uređaji.",
        s: 3,
      },
    ],
    opis: "ulice, parkirališta i komunalne građevine dopuštene su u svakoj namjeni",
  },
  "z6-2015": {
    dok: "55-14",
    citati: [
      { t: "zaštitno i pejsažno zelenilo s postojećim građevinama Z6", s: 3 },
      { t: "Z6 je dijelom izgrađeni vrijedan obalni prostor Meja i Bačvica", s: 7 },
    ],
    opis: "zelenilo s postojećim građevinama (Z6)",
  },
  "ppmin-250-2015": {
    dok: "55-14",
    citati: [{ t: "za novu izgradnju dvojnih građevina Ppmin=250 m2", s: 36 }],
    opis: "najmanja građevna čestica za stanovanje u planu",
  },
  "sirina-cestice-2015": {
    dok: "55-14",
    citati: [
      {
        t: "za novu izgradnju dvojnih građevina Ppmin=300 m2 … minimalna širina fronte građevne čestice slobodnostojeće građevine (ulične strane parcele) šmin=10 m",
        s: 45,
      },
    ],
    opis: "najmanja širina građevne čestice",
  },
  "obveza-plana-2015": {
    dok: "55-14",
    clanak: "cl-104",
    doClanka: "cl-105",
    opis: "što se gradi u nisko konsolidiranim područjima do donošenja plana užeg područja",
  },
  "obveza-plana-2006": {
    dok: "1-06",
    clanak: "cl-104",
    doClanka: "cl-105",
    opis: "što se gradi u nisko konsolidiranim područjima do donošenja plana užeg područja",
  },
  "marjan-2006": {
    dok: "1-06",
    citati: [{ t: "Za područje Park-šume Marjan propisuje se izrada Prostornog plana područja posebnih obilježja Park-šume Marjan", s: 65 }],
    opis: "Marjan čeka prostorni plan područja posebnih obilježja",
  },
  "marjan-2015": {
    dok: "55-14",
    citati: [{ t: "Za područje Park-šume Marjan propisuje se izrada Prostornog plana područja posebnih obilježja Park-šume Marjan", s: 79 }],
    opis: "Marjan čeka prostorni plan područja posebnih obilježja",
  },
  "obveza-plana-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Područja unutar obuhvata GUP-a na kojima je gradnja moguća samo temeljem prostornog plana užeg područja … izgrađeni dijelovi građevinskog područja planirani za urbanu sanaciju",
        s: 143,
      },
    ],
    opis: "prijedlog 2025., čl. 103. st. 1: gdje gradnja čeka plan užeg područja",
  },
  "preporuka-plana-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Na područjima za koja se GUP-om propisuje izrada prostornog plana užeg područja, a koja ne spadaju u područja iz stavka 1. ovog članka, do izrade prostornog plana užeg područja gradnja je moguća neposrednom provedbom GUP-a, u skladu s odredbama GUP-a.",
        s: 144,
      },
    ],
    opis: "prijedlog 2025., čl. 103. st. 4: drugdje se do plana gradi po GUP-u",
  },
  "obuhvat-izvan-cekanja-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "na dijelovima obuhvata izvan područja iz stavka 1., do izrade prostornog plana užeg područja, gradnja je moguća neposrednom provedbom GUP-a, u skladu s odredbama GUP-a.",
        s: 144,
      },
    ],
    opis: "prijedlog 2025., čl. 103. st. 3: ostatak obuhvata propisanog plana gradi se po GUP-u",
  },
  "plan-na-snazi-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Na područjima unutar obuhvata GUP-a za koja su na snazi prostorni planovi užeg područja, gradnja je moguća samo temeljem prostornog plana užeg područja.",
        s: 144,
      },
    ],
    opis: "prijedlog 2025., čl. 103. st. 5: gdje je plan na snazi, gradi se samo po njemu",
  },
  "do-plana-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "do donošenja prostornih planova užeg područja za područja iz članka 103. stavka 1., omogućava se ishođenje lokacijskih dozvola i odgovarajućih akata za građenje",
        s: 145,
      },
    ],
    opis: "prijedlog 2025., čl. 105. st. 5: što se smije graditi dok plan užeg područja ne bude donesen",
  },
  "list-namjena-2008": { list: "namjena-2008" },
  "list-namjena-2014": { list: "namjena-2014" },
  "list-namjena-2025": { list: "namjena-2025" },
  "list-urbana-pravila-2012": { list: "urbana-pravila-2012" },
  "list-urbana-pravila-2014": { list: "urbana-pravila-2014" },
  "list-urbana-pravila-2025": { list: "urbana-pravila-2025" },
  "list-detaljniji-planovi-2008": { list: "detaljniji-planovi-2008" },
  "list-vazeci-planovi-2008": { list: "vazeci-planovi-2008" },
  "list-vazeci-planovi-2014": { list: "vazeci-planovi-2014" },
  "list-planske-mjere-2025": { list: "planske-mjere-2025" },
  "z6-legenda-2025": {
    list: "namjena-2025",
    okvir: [0.806, 0.52, 0.895, 0.635],
    opis: "Z6 u tumaču znakova prijedloga 2025.",
  },
  "z6-bacvice-2025": {
    list: "namjena-2025",
    okvir: [0.3, 0.74, 0.36, 0.9],
    opis: "oznake Z6 otisnute na listu 2025. (Bačvice)",
  },

  // ---- /gup/analiza: zašto bi prijedlog 2025. zaustavio gradnju do UPU-a

  "clanak-104-2015": { dok: "55-14", clanak: "cl-104", opis: "zahvati u konsolidiranim i niskokonsolidiranim područjima" },
  "clanak-105-2015": {
    dok: "55-14",
    clanak: "cl-105",
    opis: "obveza planova prema listu 4.c i što se do njihova donošenja smije graditi",
  },
  "clanak-70-2015": { dok: "55-14", clanak: "cl-70", opis: "urbana pravila 2.7 (konsolidirana područja)" },
  "clanak-49-do-plana-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Do odnošenja provedbenih dokumenata prostornog uređenja moguća je rekonstrukcija i prenamjena legalnih građevina u postojećim gabaritima.",
        s: 30,
      },
    ],
    opis: "postojeće građevine do donošenja plana: rekonstrukcija samo u postojećim gabaritima",
  },
  "clanak-49-izvan-obuhvata-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Legalne niske i srednje građevine stambene, stambeno poslovne i gospodarske namjene izvan obuhvata provedbenih dokumenata prostornog uređenja … mogu se rekonstruirati (uključujući nadograđivati)",
        s: 30,
      },
    ],
    opis: "nadogradnja legalnih kuća izvan obuhvata planova",
  },
  "clanak-49-dogradnja-2015": {
    dok: "55-14",
    citati: [{ t: "U nisko konsolidiranom području omogućava se dogradnja i nadogradnja postojećih, legalnih građevina prema urbanim pravilima.", s: 30 }],
    opis: "dogradnja i nadogradnja legalnih građevina u niskokonsolidiranom području",
  },
  "clanak-49-izgradeni-dijelovi-2015": {
    dok: "55-14",
    citati: [
      { t: "omogućava se primjena slijedećih uvjeta kroz izradu propisanog provedbenog dokumenta prostornog uređenja ili na drugi način utvrđen ovom Odlukom", s: 33 },
      { t: "minimalna površina građevne čestice je do 40% manja od propisane za odgovarajuće zone", s: 33 },
      { t: "maksimalna katnost E=Po+P+3", s: 34 },
      { t: "minimalna udaljenost od međe 1,0 m", s: 34 },
      { t: "odstupanje od potrebnog broja parkirališnih mjesta, uz obvezu plaćanja tržišne cijene", s: 34 },
    ],
    opis: "blaži uvjeti za izgrađene dijelove niskokonsolidiranih područja",
  },
  "pravilo-3-1-naslov-2015": {
    dok: "55-14",
    citati: [{ t: "3.1. Sanacija, uređivanje i urbana obnova djelomično izgrađenih prostora mješovite izgradnje", s: 29 }],
    opis: "naziv urbanog pravila 3.1",
  },
  "pravilo-3-1-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Omogućava se nova izgradnja, zamjena postojećih građevina i rekonstrukcija postojećih građevina te uređenje javnih prostora uz izradu provedbenog dokumenta prostornog uređenja, ukoliko je ovim odredbama utvrđena obveza izrade provedbenog dokumenta, a za ostalo temeljem ovog Plana uz slijedeće uvjete",
        s: 50,
      },
    ],
    opis: "urbano pravilo 3.1, mješovita namjena M1: plan gdje je propisan, „a za ostalo temeljem ovog Plana”",
  },
  "pravilo-3-1-interpolacija-2015": {
    dok: "55-14",
    citati: [{ t: "ukoliko se nova (jedna) građevna parcela formira između dvije izgrađene parcele Ppmin=300 m²", s: 50 }],
    opis: "urbano pravilo 3.1: nova čestica između dviju izgrađenih",
  },
  "pravilo-3-1-t1-2015": {
    dok: "55-14",
    citati: [{ t: "Moguća realizacija temeljem ovog Plana, prije donošenja propisanog provedbenog dokumenta prostornog uređenja.", s: 51 }],
    opis: "urbano pravilo 3.1, turistička namjena T1: gradnja prije plana",
  },
  "pravilo-3-1-dvorana-2015": {
    dok: "55-14",
    citati: [{ t: "omogućava se gradnja školske športske dvorane uz OŠ Stobreč prije donošenja propisanog provedbenog plana prostornog uređenja", s: 52 }],
    opis: "urbano pravilo 3.1: dvorana uz OŠ Stobreč prije plana",
  },
  "pravilo-3-1-streljana-2015": {
    dok: "55-14",
    citati: [{ t: "Realizacija je moguća na temelju natječaja prije donošenja propisanog provedbenog dokumenta prostornog uređenja", s: 53 }],
    opis: "urbano pravilo 3.1: Streljana Stobreč prije plana",
  },
  "pravilo-p29-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Omogućava se izdavanje akta za gradnju i realizacija hotela kao pojedinačnog zahvata P29 temeljem ovog Plana, prije donošenja propisanog provedbenog dokumenta prostornog uređenja",
        s: 55,
      },
    ],
    opis: "hotel P29 u Trsteničkoj uvali prije plana",
  },
  "pravilo-3-2-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Omogućava se izgradnja ulične mreže, komunalno opremanje i nova izgradnja uz izradu provedbenog dokumenta prostornog uređenja u granicama obuhvata utvrđenim ovim Planom",
        s: 53,
      },
    ],
    opis: "urbano pravilo 3.2 (nova regulacija): gradnja samo uz plan",
  },
  "pravilo-3-1-2006": {
    dok: "1-06",
    citati: [
      {
        t: "Omogućava se nova izgradnja, zamjena postojećih građevina i rekonstrukcija postojećih građevina te uređenje javnih prostora uz izradu UPU-a (u granicama obuhvata utvrđenim ovim Planom)",
        s: 44,
      },
    ],
    opis: "urbano pravilo 3.1 u izvornom planu: sva nova gradnja uz UPU",
  },
  "clanak-104-2006": { dok: "1-06", clanak: "cl-104", opis: "zahvati u konsolidiranim i niskokonsolidiranim područjima (2006.)" },
  "clanak-105-2006": { dok: "1-06", clanak: "cl-105", opis: "obveza planova i gradnja do njihova donošenja (2006.)" },
  "clanak-49-izvan-obuhvata-2006": {
    dok: "1-06",
    citati: [
      {
        t: "Legalne niske i srednje građevine stambene, stambeno poslovne i gospodarske namjene izvan obuhvata detaljnijih planova … mogu se rekonstruirati (uključujući nadograđivati)",
        s: 27,
      },
    ],
    opis: "nadogradnja legalnih kuća samo izvan obuhvata planova (2006.)",
  },
  "izmjena-pravila-3-1-2008": {
    dok: "3-08",
    citati: [
      {
        t: "U članku 73. naslovu „Posebna pravila – mješovita namjena M1“ stavku 1. riječi: „UPU-a (u granicama obuhvata utvrđenim ovim Planom) zamjenjuju se riječima: „detaljnijeg plana, ukoliko je ovim odredbama utvrđena obveza izrade detaljnijeg plana, a za ostalo temeljem ovog Plana“.",
        s: 20,
      },
    ],
    opis: "izmjene 2008.: odakle „a za ostalo temeljem ovog Plana” u pravilu 3.1",
  },
  "izmjena-clanka-49-2008": {
    dok: "3-08",
    citati: [
      { t: "Do donošenja detaljnijih planova moguća je rekonstrukcija i prenamjena legalnih građevina u postojećim gabaritima.", s: 11 },
      { t: "U nisko konsolidiranom području omogućava se dogradnja i nadogradnja postojećih, legalnih građevina prema urbanim pravilima.", s: 11 },
    ],
    opis: "izmjene 2008.: rekonstrukcija u postojećim gabaritima i dogradnja u niskokonsolidiranom području",
  },
  "clanak-105-popis-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Na temelju ovog Plana, do donošenja prostornih planova užeg područja za područja iz članka 103. stavka 1., omogućava se ishođenje lokacijskih dozvola i odgovarajućih akata za građenje za:",
        s: 145,
      },
      { t: "dijelove ulične mreže", s: 145 },
      { t: "manje građevine i uređaje prometne i komunalne infrastrukture", s: 145 },
      { t: "rekonstrukciju i sanaciju postojeće obale u postojećim lukama", s: 145 },
      { t: "javne i društvene građevine (nakon provedbe natječaja ukoliko je isti propisan ovim odredbama)", s: 145 },
      { t: "uređenje rekreacijskih površina otvorenih igrališta i drugih rekreacijskih sadržaja za zone R2", s: 145 },
      { t: "reciklažna dvorišta", s: 145 },
    ],
    opis: "prijedlog 2025., čl. 105. st. 5: cijeli popis onoga što se smije graditi prije plana",
  },
  "obveza-plana-4d-2025": {
    dok: "prijedlog-2025",
    citati: [{ t: "Utvrđuje se obveza/preporuka izrade prostornih planova užeg područja za obuhvate prema kartografskom prikazu br. 4.d", s: 144 }],
    opis: "prijedlog 2025., čl. 105. st. 2: obveza ili preporuka prema listu 4.d",
  },
  "clanak-104-brisanje-2025": {
    dok: "prijedlog-2025",
    citati: [{ t: "Članak 104. se briše.", s: 144 }],
    opis: "prijedlog 2025. briše čl. 104.",
  },
  "clanak-49b-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Ukoliko urbanim pravilima nije drugačije određeno, rekonstrukcija postojećih građevina dozvoljena je pod istim uvjetima propisanim ovim Planom za izgradnju novih građevina.",
        s: 53,
      },
    ],
    opis: "prijedlog 2025., čl. 49.b st. 2: rekonstrukcija pod uvjetima za novu gradnju",
  },
  "clanak-106-sanacija-2025": {
    dok: "prijedlog-2025",
    citati: [
      { t: "Urbana sanacija se odnosi prvenstveno na područja s prevladavajućom ozakonjenom izgradnjom koja se zadržava u prostoru", s: 145 },
      { t: "kroz uklanjanje (uz mogućnost nove gradnje) neuvjetnih građevina", s: 146 },
    ],
    opis: "prijedlog 2025., čl. 106. st. 2: čemu služe UPU-i urbane sanacije",
  },
  "clanak-106-preobrazba-2025": {
    dok: "prijedlog-2025",
    citati: [
      { t: "Područja urbane preobrazbe su ovim Planom u najvećem dijelu definirana kao kompleksni zahvati Gradskih projekata", s: 146 },
      { t: "pojedinačni zahvati P1, P15, P20, P34, P35 i P36", s: 146 },
      { t: "Brodogradilište, Sjeverna luka, zone proizvodne namjene na području Dujmovače, Smokovika i Bilica te manji istočni dio TTTS-a", s: 146 },
      { t: "Turska kula (Glavičine)", s: 146 },
    ],
    opis: "prijedlog 2025., čl. 106. st. 4: koja su područja urbane preobrazbe",
  },
  "obrazlozenje-neuredeno-2025": {
    dok: "obrazlozenje-2025",
    citati: [
      {
        t: "Neuređeni dio građevinskog područja određen je PPUG-om, na kartografskom prikazu građevinskih područja, pri čemu se načelno, kao osnovni kriterij „uređenosti“ uzima mogućnost priključenja na postojeću prometnu površinu u funkciji, minimalne širine 4 m",
        s: 6,
      },
    ],
    opis: "obrazloženje prijedloga GUP-a, § 2.1.1.3: neuređeni dio određuje PPUG, s kriterijem ceste od 4 m",
  },
  "obrazlozenje-sanacija-2025": {
    dok: "obrazlozenje-2025",
    citati: [{ t: "Područja urbane sanacije su većinom nisko konsolidirana područja na istočnom dijelu grada", s: 6 }],
    opis: "obrazloženje prijedloga GUP-a, § 2.1.1.2: što su područja urbane sanacije",
  },
  "obrazlozenje-preporuka-2025": {
    dok: "obrazlozenje-2025",
    citati: [
      {
        t: "zadržana obveza preporuka izrade većeg broja UPU-a za područja koja ne spadaju u nijednu od ove tri kategorije (kao planska preporuka, a ne zakonska obveza)",
        s: 6,
      },
    ],
    opis: "obrazloženje prijedloga GUP-a, § 2.1.1.4: izvan triju kategorija UPU je samo preporuka",
  },
  "obrazlozenje-gubitak-obveze-2025": {
    dok: "obrazlozenje-2025",
    citati: [
      {
        t: "za koja je dosadašnjim GUP-om bila obvezna izrada prostornog plana užeg područja (UPU-a), temeljem novog Zakona više se ne može propisati ta obveza, tako da gradnja postaje moguća izravno temeljem GUP-a",
        s: 2,
      },
    ],
    opis: "obrazloženje prijedloga GUP-a, § 1.3: gdje obveza UPU-a otpada, gradi se izravno prema GUP-u",
  },
  "obrazlozenje-ozakonjenje-2025": {
    dok: "obrazlozenje-2025",
    citati: [{ t: "Grada Split je dobio cca 15000 „novih postojećih“ građevina ali koje su protivne planskim odredbama", s: 25 }],
    opis: "obrazloženje prijedloga GUP-a: ozakonjene zgrade i strože odredbe",
  },
  "obrazlozenje-zabrana-2025": {
    dok: "obrazlozenje-2025",
    citati: [
      {
        t: "na područjima na kojima je Zakonom prozvana obveza donošenja UPU-a, prije njegovog donošenja ne može se izdati lokacijska dozvola i građevinska dozvola za građenje nove građevine",
        s: 6,
      },
    ],
    opis: "obrazloženje prijedloga GUP-a, § 2.1.1.4: gdje zakon traži UPU, do njegova donošenja nema dozvole za novu građevinu",
  },
  "odredba-ppug-6-2025": {
    dok: "ppug-odredbe-2025",
    citati: [
      {
        t: "Unutar neizgrađenih dijelova građevinskog područja utvrđeni su neuređeni dijelovi na kojima nije izgrađena planirana osnovna infrastruktura",
        s: 7,
      },
      { t: "Neizgrađeni dijelovi građevinskog područja koji nisu prikazani kao neuređeni smatraju se „uređenima“.", s: 7 },
    ],
    opis: "prijedlog izmjena PPUG-a, čl. 6. st. 1.: što je neuređeni dio i gdje je prikazan",
  },
  "odredba-ppug-6-izgradjeno-2025": {
    dok: "ppug-odredbe-2025",
    citati: [{ t: "Izgrađeni dio građevinskog područja je utvrđen na temelju podataka iz ortofoto snimke iz 2021. godine.", s: 7 }],
    opis: "prijedlog izmjena PPUG-a, čl. 6. st. 2.: izgrađeni dio prema ortofoto snimci iz 2021.",
  },
  "odredba-ppug-83-2025": {
    dok: "ppug-odredbe-2025",
    citati: [
      {
        t: "je usmjeravajućeg karaktera, što znači da je mogućnost gradnje na građevnim česticama koje su prikazane kao „uređene“ uvjetovana kumulativnim ispunjavanjem sljedećih uvjeta: da se građevna čestica nalazi uz prometnu površinu u funkciji minimalne širine 4 m",
        s: 76,
      },
    ],
    opis: "prijedlog izmjena PPUG-a, čl. 83. st. 5.: i na „uređenoj” čestici gradi se samo uz cestu od 4 m",
  },
  "odredba-ppug-86-2025": {
    dok: "ppug-odredbe-2025",
    citati: [{ t: "Za neuređene dijelove građevinskog područja izrada UPU-a je obvezna, dok je na preostalom području preporučena.", s: 78 }],
    opis: "prijedlog izmjena PPUG-a, čl. 86. st. 8. (novo 2025.): UPU je obvezan samo za neuređeni dio",
  },
  "obrazlozenje-ppug-metoda-2025": {
    dok: "ppug-obrazlozenje-2025",
    citati: [
      {
        t: "ovim je izmjenama napravljena detaljna analiza svih građevinskih područja te je izmijenjena podjela građevinskog područja na izgrađeni, neizgrađeni i neuređeni dio a sukladno stvarnom stanju na terenu prikazanom na službenoj državnoj digitalnoj ortofoto karti i na temelju recentnih zračnih snimaka",
        s: 16,
      },
    ],
    opis: "obrazloženje prijedloga PPUG-a, str. 16: jedini opis kako su čestice razvrstane",
  },
  "istok-ppug-2025": {
    list: "ppug-podrucja-istok-2025",
    okvir: [0, 0.03, 0.37, 0.43],
    opis: "prijedlog izmjena PPUG-a, list 4.4: građevinska područja istočnog Splita u mjerilu 1:5000, po katastarskim česticama",
  },
  "legenda-ppug-2025": {
    list: "ppug-podrucja-istok-2025",
    okvir: [0.836, 0.195, 0.96, 0.265],
    opis: "tumač lista 4.4 PPUG-a: izgrađeno, neizgrađeno i neuređeno (šrafirano)",
  },
  "clanak-103-karta-2025": {
    dok: "prijedlog-2025",
    citati: [{ t: "Područja iz prethodnog stavka prikazana su na kartografskom prikazu 4.d „Područja i dijelovi primjene planskih mjera zaštite“.", s: 144 }],
    opis: "prijedlog 2025., čl. 103. st. 2: područja su određena samo listom 4.d",
  },
  "clanak-106-neuredeno-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Neuređeni neizgrađeni dijelovi građevinskog područja većinom obuhvaćaju nisko konsolidirana područja na istočnom dijelu grada, a određeni su PPUG-om Splita.",
        s: 145,
      },
    ],
    opis: "prijedlog 2025., čl. 106. st. 1: neuređeni dijelovi određeni su PPUG-om",
  },
  "istok-4c-2008": {
    list: "detaljniji-planovi-2008",
    okvir: [0.4718, 0.0917, 0.6432, 0.4643],
    opis: "obveza izrade UPU-a u istočnom Splitu (Dračevac, Mostine, Harakovac)",
  },
  "legenda-4c-2008": {
    list: "detaljniji-planovi-2008",
    okvir: [0.803, 0.775, 0.875, 0.98],
    opis: "tumač znakova lista 4.c: obveza izrade UPU-a (plava rešetka) i DPU-a",
  },
  "istok-4b-2014": {
    list: "urbana-pravila-2014",
    okvir: [0.4781, 0.1291, 0.6456, 0.4794],
    opis: "urbana pravila u istočnom Splitu",
  },
  "istok-up-2025": {
    list: "urbana-pravila-2025",
    okvir: [0.4673, 0.1192, 0.6389, 0.481],
    opis: "urbana pravila u istočnom Splitu, prijedlog 2025.",
  },
  "istok-4d-2025": {
    list: "planske-mjere-2025",
    okvir: [0.4676, 0.1195, 0.6392, 0.4814],
    opis: "urbana sanacija, preobrazba i neuređeno u istočnom Splitu, prijedlog 2025.",
  },
  "legenda-4d-2025": {
    list: "planske-mjere-2025",
    okvir: [0.668, 0.025, 0.793, 0.245],
    opis: "tumač znakova lista 4.d: za sanaciju, preobrazbu i neuređeno plan je obvezan, drugdje preporučen",
  },
};

const IZVOR_ODREDBI = path.join(process.cwd(), "data", "gup-grad", "odredbe", "izvor");
const GODINE = [2006, 2015, 2025] as const;

function dokumentGodine(godina: number, dokument?: string): DokumentId {
  if (godina === 2006) return dokument === "3/08" ? "3-08" : "1-06";
  return godina === 2015 ? "55-14" : "prijedlog-2025";
}

interface UrbanoPraviloPpmin {
  kod: string;
  naziv?: string;
  citat?: string;
  dokument?: string;
  stranica_glasnika?: number;
  stranica_pdf?: number;
}
interface UrbanoPraviloGradnja {
  kod: string;
  naziv?: string;
  nova_stambena_citat?: string;
  dokument?: string;
  stranica?: number;
}
interface KlasaDopusteno {
  klasa: string;
  po_godini: Record<string, { citat?: string; stranica?: number; dodatni_citati?: { citat: string; stranica?: number }[] } | null>;
}

let svi: Promise<Map<string, SpecNavoda>> | null = null;

/** Svi navodi: imenovani i izvedeni iz izvadaka odredbi. */
export function sviNavodi(): Promise<Map<string, SpecNavoda>> {
  svi ??= (async () => {
    const m = new Map<string, SpecNavoda>(Object.entries(NAVODI));
    const citaj = async <T>(ime: string) => JSON.parse(await readFile(path.join(IZVOR_ODREDBI, ime), "utf8")) as T;
    for (const g of GODINE) {
      const pp = await citaj<{ urbana_pravila: UrbanoPraviloPpmin[] }>(`ppmin-${g}.json`);
      for (const e of pp.urbana_pravila) {
        if (!e.citat) continue;
        const spec: SpecNavoda = {
          dok: dokumentGodine(g, e.dokument),
          citati: [{ t: e.citat, s: e.stranica_glasnika ?? e.stranica_pdf }],
          opis: `najmanja građevna čestica, urbano pravilo ${e.kod}${e.naziv ? ` (${e.naziv})` : ""}`,
        };
        const kod = e.kod.replace(/\s+/g, "");
        if (!m.has(navodPpmin(g, kod))) m.set(navodPpmin(g, kod), spec);
        // list urbanih pravila gradske projekte GP1–GP11 crta kao jedno
        // područje „GP” (vidi odredbe.py), pa karta traži navod za „GP”
        if (kod.startsWith("GP") && !m.has(navodPpmin(g, "GP"))) m.set(navodPpmin(g, "GP"), spec);
      }
      const gr = await citaj<{ urbana_pravila: UrbanoPraviloGradnja[] }>(`gradnja-${g}.json`);
      for (const e of gr.urbana_pravila) {
        if (!e.nova_stambena_citat) continue;
        const id = navodGradnja(g, e.kod.replace(/\s+/g, ""));
        if (m.has(id)) continue;
        m.set(id, {
          dok: dokumentGodine(g, e.dokument),
          citati: [{ t: e.nova_stambena_citat, s: e.stranica }],
          opis: `nova stambena gradnja, urbano pravilo ${e.kod}${e.naziv ? ` (${e.naziv})` : ""}`,
        });
      }
    }
    const dop = await citaj<{ klase: KlasaDopusteno[] }>("dopusteno.json");
    for (const k of dop.klase) {
      for (const [g, v] of Object.entries(k.po_godini)) {
        if (!v) continue;
        // citat iz izmjena 3/08 izvadak označava „(3/08, čl. 7)”; ulomak je iz
        // jednog dokumenta (1/06), pa takav citat ne ulazi
        const citati = [
          ...(v.citat ? [{ t: v.citat, s: v.stranica }] : []),
          ...(v.dodatni_citati ?? []).map((c) => ({ t: c.citat, s: c.stranica })),
        ].filter((c) => !c.t.startsWith("(3/08"));
        if (!citati.length) continue;
        m.set(navodNamjena(g, k.klasa), { dok: dokumentGodine(Number(g)), citati, opis: `što odredbe dopuštaju u namjeni ${k.klasa}` });
      }
    }
    return m;
  })();
  return svi;
}

/** Članak kojemu blok pripada: najbliži prethodni blok članka. */
function clanakBloka(blokovi: Blok[], i: number): Blok | undefined {
  for (let j = i; j >= 0; j--) if (blokovi[j].v === "cl") return blokovi[j];
  return undefined;
}

/**
 * Prijedlog 2025. je odluka o izmjenama: njezin članak 116 kaže „Članak 103.
 * mijenja se i glasi: …”. Čitatelj traži članak plana, pa ga naslov navodi:
 * „čl. 116 (mijenja čl. 103)”.
 */
function izmjena(blokovi: Blok[], cl: Blok, doBloka: number): string {
  // zadnja rečenica „Članak N. mijenja se…” između naslova članka i navoda
  // (članak odluke može prvo mijenjati naslov, pa tek onda sam članak)
  for (let i = doBloka; i > blokovi.indexOf(cl); i--) {
    const t = blokovi[i].t;
    const m =
      /^Članak (\d+(?:\.[a-z])?)\.? (?:mijenja se|se mijenja|briše se)/.exec(t) ??
      /^Iza članka \d+(?:\.[a-z])?\.? dodaje se novi članak (\d+(?:\.[a-z])?)/.exec(t);
    if (m) return t.startsWith("Iza") ? ` (dodaje čl. ${m[1]})` : ` (mijenja čl. ${m[1]})`;
  }
  return "";
}

/** Uvodna rečenica popisa („…grade se:”) kad navod počinje stavkom. */
function uvod(blokovi: Blok[], i: number): number | null {
  for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
    const b = blokovi[j];
    if (b.v === "li") continue;
    return b.v === "p" && b.t.trimEnd().endsWith(":") ? j : null;
  }
  return null;
}

/** Ulomak navoda — ono što pokazuju skočni prozor i stranica navoda. Null ako ga nema ili se ne nađe. */
export async function razrijesi(id: string): Promise<Ulomak | null> {
  const spec = (await sviNavodi()).get(id);
  if (!spec) return null;

  if ("list" in spec) {
    const l = (await ucitajListove())[spec.list];
    if (!l) return null;
    const izd = izdanjaLista(l.id)[0];
    const okvir = spec.okvir;
    return {
      id,
      naslov: `${l.naslov} · ${l.izvor}`,
      opis: spec.opis,
      href: putLista(l.id) + (okvir ? `?okvir=${okvir.map((v) => v.toFixed(4)).join(",")}` : ""),
      izdanje: izd?.id ?? "2015",
      list: { ...l, okvir },
    };
  }

  const dok = await ucitajDokument(spec.dok);
  const izd = izdanjeDokumenta(spec.dok);
  const blokovi = dok.blokovi;
  let oznake: Oznaka[] = [];
  let odabrani: number[];

  if ("clanak" in spec) {
    const od = blokovi.findIndex((b) => b.a === spec.clanak);
    if (od < 0) return null;
    const zadnji = spec.doClanka ? blokovi.findIndex((b) => b.a === spec.doClanka) : od;
    if (zadnji < 0) return null;
    let kraj = zadnji + 1;
    while (kraj < blokovi.length && blokovi[kraj].v !== "cl" && !(blokovi[kraj].v === "n" && (blokovi[kraj].r ?? 5) <= 4)) kraj++;
    odabrani = Array.from({ length: kraj - od }, (_, k) => od + k);
  } else {
    const ind = await indeksDokumenta(spec.dok);
    for (const c of spec.citati) {
      const o = nadjiCitat(ind, c.t, c.s);
      if (!o) return null;
      oznake = oznake.concat(o);
    }
    const poBloku = spojiOznake(oznake);
    const skup = new Set(poBloku.keys());
    const prvi = Math.min(...skup);
    const u = blokovi[prvi].v === "li" ? uvod(blokovi, prvi) : null;
    if (u !== null) skup.add(u);
    odabrani = [...skup].sort((a, b) => a - b);
  }

  const poBloku = spojiOznake(oznake);
  const prviOznacen = oznake.length ? Math.min(...oznake.map((o) => o.blok)) : odabrani[0];
  const cl = clanakBloka(blokovi, prviOznacen);
  const s = blokovi[prviOznacen].s;
  const doCl = "clanak" in spec && spec.doClanka ? blokovi.find((b) => b.a === spec.doClanka)?.cl : undefined;
  const naslov = [dok.kratko, cl ? `čl. ${cl.cl}${doCl ? `–${doCl}` : ""}${izmjena(blokovi, cl, prviOznacen)}` : null, `str. ${s}`]
    .filter(Boolean)
    .join(" · ");
  const sidra = [...poBloku.entries()].map(([i, r]) => [sidro(izd, spec.dok, blokovi[i].id), r] as [string, [number, number][]]);
  const upit = sidra.length ? `?oznaci=${kodirajOznake(sidra)}` : "";
  const cilj = "clanak" in spec ? sidro(izd, spec.dok, spec.clanak) : sidro(izd, spec.dok, blokovi[prviOznacen].id);

  return {
    id,
    naslov,
    opis: spec.opis,
    href: `${izd.put}${upit}#${cilj}`,
    izdanje: izd.id,
    dokument: { id: dok.id, naslov: dok.naslov, izvor: dok.izvor, url: dok.url },
    blokovi: odabrani.map((i) => {
      const b = blokovi[i];
      return {
        id: sidro(izd, spec.dok, b.id),
        s: b.s,
        v: b.v,
        t: b.t,
        ...(b.nast ? { nast: true } : {}),
        ...(b.src ? { src: b.src, w: b.w, h: b.h } : {}),
        ...(poBloku.has(i) ? { oznake: poBloku.get(i) } : {}),
      };
    }),
  };
}

/** Imena svih navoda — za statične stranice i odgovore. */
export async function imenaNavoda(): Promise<string[]> {
  return [...(await sviNavodi()).keys()];
}
