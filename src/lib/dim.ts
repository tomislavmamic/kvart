/**
 * Širenje mirisa s plohe, računato u pregledniku.
 *
 * Prije je ovo bila statična toplinska karta i zato je izgledalo kao mrlja.
 * Ono što daje izgled dima:
 *
 * 1. Izvor nije jednolik. Plin izlazi na pukotinama pokrova i oko zdenaca, pa
 *    model bira žarišta. Kad ploha emitira jednoliko, perjanica izlazi kao
 *    mrlja široka koliko i odlagalište — jer to onda i jest.
 * 2. Vrtložni šum nema divergencije (uzima se okomiti gradijent potencijala),
 *    pa se čestice ne skupljaju u grudu nego razvlače u niti.
 *
 * Tri stvari koje su prije bile krive, pa se isplati znati zašto su sad ovakve:
 *
 * - **Izvor je neprekidan.** Ploha ne diše u naletima; plin curi kroz pokrov
 *   cijelo vrijeme. Prije je izvor stajao između pulseva, pa se vidjelo kako
 *   izlaze odvojeni oblaci — a to nije ono što se događa.
 * - **Gustoća se skuplja i prazni sama.** Čestica ne umire od starosti nego
 *   zato što je vjetar odnese iz okvira. Pri slabom vjetru ostaje dulje, pa ih
 *   je više u zraku i prizor potamni; pri jakom se okvir isprazni. To je jedina
 *   stvar u prikazu koja odgovara na pitanje „hoće li se nakupiti”.
 * - **Vrijeme teče poznatim ubrzanjem.** Brzina nošenja izvodi se iz stvarne
 *   brzine vjetra i stvarne veličine okvira (vidi `UBRZANJE`), a ne iz broja
 *   koji je izgledao dobro.
 *
 * Polje vjetra dolazi izvana, složeno za vjetar koji trenutačno puše
 * (`src/lib/polje-dima.ts`). Ovdje se iz njega čita samo brzina — koliko će
 * se zraka nad kvartom zadržati posljedica je toga, a ne postavka.
 *
 * Modul ne dira DOM, da se može provjeriti i izvan preglednika.
 */

/** Polje vjetra iz `npm run izvedi-polje-dima`. */
export type PoljeDima = {
  readonly gw: number;
  readonly gh: number;
  readonly skala: number;
  readonly vx: string;
  readonly vy: string;
  readonly maska: string;
  /**
   * Debljina miješanog sloja za koju je polje složeno, u metrima.
   *
   * Nosi zastojno širenje: plitak sloj znači noćnu inverziju, u kojoj se
   * zrak razlijeva oko plohe umjesto da ide za javljenim smjerom. Bez nje
   * se uzima da je sloj plitak, pa širenje ovisi samo o brzini.
   */
  readonly dubina?: number;
};

/**
 * Isto polje, ali raspakirano — kakvo ga simulator slaže sat po sat.
 *
 * Prikaz na `/karepovac` dobiva jedno polje za jedan slučaj vremena i base64
 * je ondje prirodan: zapis dolazi iz generiranog modula i raspakira se jednom.
 * Simulator mijenja polje svakoga sata i računa ga u radniku, gdje `Buffer`
 * ne postoji, pa bi put kroz base64 bio i suvišan i neprenosiv.
 */
export type SirovoPolje = {
  readonly gw: number;
  readonly gh: number;
  readonly skala: number;
  readonly vx: Uint8Array;
  readonly vy: Uint8Array;
  readonly maska: Uint8Array;
  /** Debljina miješanog sloja, u metrima; vidi `PoljeDima.dubina`. */
  readonly dubina?: number;
};

/**
 * Koliko stvarnih sekundi prođe u jednoj sekundi prikaza.
 *
 * Vjetar od 1,2 m/s prijeđe okvir širok 2,6 km za oko 36 minuta. U stvarnom
 * vremenu gledatelj ne bi vidio da se išta miče. Zato vrijeme teče ubrzano —
 * ali jednim jedinim brojem, jednakim za sve slučajeve vremena, pa omjer
 * između slabog i jakog vjetra ostaje istinit. Pri ovoj vrijednosti slab
 * istočnjak prijeđe okvir za nekih 36 sekundi, a sjeveroistočnjak za 12.
 */
export const UBRZANJE = 60;

/**
 * Veličina okvira stranice u metrima.
 *
 * Izvodi se iz `OKVIR` u `@/generated/karepovac-karta`
 * (`sirina / pxPoMetru`). Ovdje stoji kao zadana vrijednost da modul ostane
 * bez ovisnosti; provjera u `dim.test.ts` pazi da se ta dva ne raziđu.
 */
export const OKVIR_M = { sirina: 2623, visina: 1294 } as const;

export type Postavke = {
  /** Širina rešetke gustoće u ćelijama. */
  sirina?: number;
  /**
   * Najveći broj čestica u zraku odjednom.
   *
   * Samo zrnatost, ne i svjetlina: čestica nosi masu obrnuto razmjernu
   * njihovu broju, pa dvostruko manje čestica daje jednako tamnu perjanicu.
   * Zadano je odabrano tako da kadar stane u desetak milisekundi na
   * prosječnom prijenosniku — prije ih je bilo tri puta više i prikaz je
   * padao ispod šezdeset sličica.
   */
  cestica?: number;
  /** Sekundi prikaza u kojima izvor ispusti `cestica` čestica. */
  punjenje?: number;
  /** Koliko stvarnih sekundi prođe u sekundi prikaza. */
  ubrzanje?: number;
  /** Širina okvira u metrima. */
  metaraX?: number;
  /** Visina okvira u metrima. */
  metaraY?: number;
  /** Sekundi do pune težine čestice; samo da izvor ne pukne. */
  pojava?: number;
  /**
   * Sekundi prikaza u kojima težina padne na `1/e` — prorjeđivanje.
   *
   * Nije kemija nego ono što se ne vidi: miješanje uvis i raspršenje ispod
   * praga. Uz zadano ubrzanje ovo je oko četrdeset minuta stvarnog zraka, što
   * odgovara zadržavanju u prizemnom sloju pod noćnom inverzijom. Duljim
   * vremenom se prizor pri tišini puni još minutama nakon učitavanja.
   */
  raspad?: number;
  /** Sekundi prikaza nakon kojih se čestica briše, ma gdje bila. */
  vijek?: number;
  /** Jačina vrtložnog šuma. */
  vrtlog?: number;
  /** Koliko cijela perjanica polako vijuga poprečno na vjetar. */
  vijuganje?: number;
  /** Koliko vrtlog nadjača nošenje vjetrom. */
  snaga?: number;
  /** Krupnoća vitica; veće znači sitnije. */
  mjerilo?: number;
  /** Koliko vrtlog naraste kad se perjanica razvije. */
  sirenje?: number;
  /** Sekundi prikaza do punog širenja perjanice. */
  rastVrtloga?: number;
  /** Brzina kojom se vitice premeću; premalo je smrznuto, previše treperi. */
  vrtnja?: number;
  /** Broj prolaza zamućenja; bez toga se vide zrnca, a ne dim. */
  zamucenje?: number;
  /** Broj žarišta na plohi. */
  zarista?: number;
  /** Ispod koje srednje brzine počinje zastojno širenje, u m/s. */
  pragZastoja?: number;
  /** Koliko se vrtlog najviše pojača pri potpunoj tišini. */
  zastojnoSirenje?: number;
  /** Do koje dubine sloja zastojno širenje vrijedi u punoj mjeri, u m. */
  zastojPlitko?: number;
  /** Od koje dubine sloja zastojnog širenja više nema, u m. */
  zastojDuboko?: number;
};

export type Simulacija = {
  readonly sirina: number;
  readonly visina: number;
  readonly cestica: number;
  korak(dt: number): void;
  crtaj(): Float32Array;
  zivih(): number;
  /** Ukupno ispuštenih čestica od početka; za provjeru da izvor ne staje. */
  ispusteno(): number;
  /** Sekundi prikaza koliko treba da se gustoća ustali; ovisi o vjetru. */
  readonly zagrijavanje: number;
  postavi(ime: keyof Postavke, vrijednost: number): void;
  /**
   * Mijenja polje vjetra, a čestice ostavlja gdje jesu.
   *
   * Simulator na `/karepovac/sim` ide sat po sat i svakom satu pripada drugi
   * vjetar. Kad bi se za svaki sat gradila nova simulacija, zrak koji je
   * prethodni sat digao s plohe nestao bi na prijelazu — a upravo to
   * zadržavanje je ono što crta treba pokazati.
   *
   * Maska se ne dira: ploha je ista bez obzira na vrijeme.
   */
  postaviPolje(polje: SirovoPolje): void;
};

/**
 * Ispod koje srednje brzine vjetra u okviru počinje zastojno širenje, u m/s.
 *
 * Smjer vjetra dolazi s anemometara kilometrima daleko i pri slabom vjetru
 * je šum — a prikaz ga je uzimao doslovno, pa je i pri tišini cijela
 * perjanica poslušno curila u jednu stranu. Model raspršenja je na dvije
 * godine mjerenja H₂S-a uz plohu pokazao suprotno: pri tišini meandar
 * razmaže zrak na sve strane, a satne vrijednosti nose potpis zastoja, ne
 * smjera (vidi `oblacici.K_PO_RAZREDU` i `bazdari-izvor.py`).
 */
const PRAG_ZASTOJA = 1.0;

/**
 * Raspon dubine miješanog sloja preko kojega zastojno širenje slabi, u m.
 *
 * Zastoj nije samo slab vjetar nego slab vjetar **pod poklopcem**: plitka
 * noćna inverzija drži zrak pri tlu i meandar ga razlijeva oko plohe. Kad je
 * sloj dubok, i slab se prizemni vjetar miješa s višim slojevima, pa nit niz
 * javljeni smjer nije laž. Puno širenje vrijedi do `plitko`, iznad `duboko`
 * ga nema, između pada pravocrtno po logaritmu dubine — istom ljestvicom po
 * kojoj se polje vjetra interpolira (`razineDubine`).
 */
const ZASTOJ_DUBINA = { plitko: 60, duboko: 400 } as const;

/**
 * Koliko se vrtlog najviše pojača pri potpunoj tišini.
 *
 * Vrtložni šum nema divergencije, pa pojačanje ne stvara ni izvor ni ponor
 * mase — samo mijenja omjer između razmazivanja i nošenja, u korist
 * razmazivanja, onako kako mjerenja kažu da pri tišini i jest.
 *
 * Vrijednost je ugođena na dvije godine satnog H₂S-a uz plohu, pogonom
 * `scripts/ocijeni-sim.ts`: bez pojačanja Spearman na godini izvan uzorka
 * 0,09, s pojačanjem 2,5 → 0,108, s 4 → 0,117 (noću 0,144); 6 ne donosi
 * ništa više. Isto ugađanje pomaknulo je i `ZASTOJ_DUBINA.duboko` na 400 m.
 * Prag brzine ostaje 1 m/s: jače dizanje praga dobiva još mrvicu na
 * mjerenjima, ali dira i izgled prikaza pri slabom vjetru, koji čuvaju
 * provjere u `dim.test.ts`.
 */
const ZASTOJNO_SIRENJE = 4.0;

/**
 * Težina zastoja po dubini sloja: 1 pod plitkom inverzijom, 0 nad dubokim
 * miješanjem. Polje bez dubine (stariji zapis) računa se kao plitko, da se
 * širenje ne izgubi tiho.
 */
function tezinaDubine(
  dubina: number | undefined,
  plitko: number,
  duboko: number,
): number {
  if (dubina === undefined) return 1;
  if (dubina <= plitko) return 1;
  if (dubina >= duboko) return 0;
  return 1 - Math.log(dubina / plitko) / Math.log(duboko / plitko);
}

const ZADANO = {
  sirina: 200,
  cestica: 30_000,
  punjenje: 45,
  ubrzanje: UBRZANJE,
  metaraX: OKVIR_M.sirina,
  metaraY: OKVIR_M.visina,
  pojava: 0.6,
  raspad: 40,
  vijek: 160,
  vrtlog: 1.9,
  snaga: 0.12,
  vijuganje: 0.31,
  mjerilo: 4.2,
  sirenje: 0.55,
  rastVrtloga: 25,
  vrtnja: 0.16,
  zamucenje: 3,
  zarista: 12,
  pragZastoja: PRAG_ZASTOJA,
  zastojnoSirenje: ZASTOJNO_SIRENJE,
  zastojPlitko: ZASTOJ_DUBINA.plitko,
  zastojDuboko: ZASTOJ_DUBINA.duboko,
} as const;

/**
 * Masa koju izvor ispusti u jednoj sekundi prikaza, u jedinicama `crtaj`.
 *
 * Čestica nosi ovoliko podijeljeno brojem čestica u sekundi, pa gustoća ne
 * ovisi o tome koliko je čestica netko odabrao — manji broj daje zrnatiju,
 * ali jednako tamnu perjanicu.
 *
 * Broj je proizvoljan, ali mora stajati sam za sebe. Kad je bio izveden iz
 * zadanog broja čestica, smanjenje tog broja radi brzine podijelilo je sve
 * gustoće — i `SIDRO_KARTICE`, dakle cijela ljestvica boja, tiho je
 * prestala odgovarati. Mijenjati samo zajedno sa sidrom ljestvice.
 */
const EMISIJA_PO_SEKUNDI = 2000;

/**
 * Koliko prijelaza okvira treba da se gustoća ustali.
 *
 * Jedan prijelaz samo provuče prvu nit; ravnoteža dotoka i odlaska nastupi
 * nakon drugoga. Izmjereno pri slabom istočnjaku, gdje je najsporije.
 */
const PRIJELAZA_DO_USTALJENJA = 2.2;


/**
 * Koliko se čestice razilaze u fazi vrtložnog šuma.
 *
 * Šum je jedno jedino polje sinusa, pa bi bez ovoga cijela perjanica disala
 * uglas: masa u okviru njihala se ravnomjerno gore-dolje svakih pedesetak
 * sekundi, što izgleda kao da izvor pulsira — a to je upravo ono što ovdje
 * ne smije izgledati. S razilaženjem ostaje struktura vitica, a zajedničkog
 * takta nema.
 */
const FAZA_VRTLOGA = 8;

type Parametri = { -readonly [K in keyof typeof ZADANO]: number };

function raspakiraj(s: string): Uint8Array {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) a[i] = bin.charCodeAt(i);
  return a;
}

/** Determinističan niz, da se provjera ponovi jednako. */
function generator(sjeme: number): () => number {
  let s = sjeme;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Bira žarišta na plohi i ponavlja ćelije razmjerno njihovoj jakosti. */
function zarista(
  celije: readonly number[],
  koliko: number,
  gw: number,
  gh: number,
  slucaj: () => number,
): Float64Array {
  const n = celije.length / 2;
  const tocke: { i: number; j: number; r: number; w: number }[] = [];
  for (let k = 0; k < koliko; k += 1) {
    const s = Math.floor(slucaj() * n) * 2;
    tocke.push({
      i: celije[s],
      j: celije[s + 1],
      r: 2 + slucaj() * 4,
      w: 0.35 + slucaj() * 0.65,
    });
  }

  const izvor: number[] = [];
  for (let k = 0; k < n; k += 1) {
    const ci = celije[k * 2];
    const cj = celije[k * 2 + 1];
    let jakost = 0;
    for (const t of tocke) {
      const dd = (ci - t.i) ** 2 + (cj - t.j) ** 2;
      jakost += t.w * Math.exp(-dd / (2 * t.r * t.r));
    }
    const puta = Math.min(6, Math.round(jakost * 5));
    for (let m = 0; m < puta; m += 1) izvor.push(ci / gw, cj / gh);
  }
  if (izvor.length === 0) {
    for (let k = 0; k < n; k += 1) {
      izvor.push(celije[k * 2] / gw, celije[k * 2 + 1] / gh);
    }
  }
  return Float64Array.from(izvor);
}

/** Mekan otisak čestice; uska jezgra izgleda kao pijesak, ne kao dim. */
function jezgra(): Float32Array {
  const j = new Float32Array(25);
  let zbroj = 0;
  for (let a = -2; a <= 2; a += 1) {
    for (let b = -2; b <= 2; b += 1) {
      const w = Math.exp(-(a * a + b * b) / 2.6);
      j[(a + 2) * 5 + (b + 2)] = w;
      zbroj += w;
    }
  }
  for (let k = 0; k < 25; k += 1) j[k] /= zbroj;
  return j;
}

/** Raspakira base64 polje u sirovo, bez ovisnosti o `Buffer`. */
export function raspakirajPolje(polje: PoljeDima): SirovoPolje {
  return {
    gw: polje.gw,
    gh: polje.gh,
    skala: polje.skala,
    vx: raspakiraj(polje.vx),
    vy: raspakiraj(polje.vy),
    maska: raspakiraj(polje.maska),
    dubina: polje.dubina,
  };
}

export function stvoriDim(polje: PoljeDima, postavke: Postavke = {}): Simulacija {
  return stvoriDimSirovo(raspakirajPolje(polje), postavke);
}

export function stvoriDimSirovo(
  polje: SirovoPolje,
  postavke: Postavke = {},
): Simulacija {
  const par: Parametri = { ...ZADANO, ...postavke };
  const { gw, gh } = polje;
  // Polje se smije zamijeniti u hodu, pa ovo nisu konstante nego stanje.
  let skala = polje.skala;
  let dubina = polje.dubina;
  let VX = polje.vx;
  let VY = polje.vy;
  const MK = polje.maska;

  const W = par.sirina;
  const H = Math.max(2, Math.round((W * gh) / gw));
  const N = par.cestica;
  // Gustoća je masa po ćeliji, pa bi na gušćoj rešetci ista perjanica ispala
  // blijeđa — ista masa razmazana po četiri puta više ćelija. Ljestvica boja
  // je usidrena na jednoj gustoći, pa bi promjena razlučivosti radi ljepše
  // slike tiho isprala boju. Zato se masa čestice mjeri prema zadanoj rešetci.
  const REF_W = ZADANO.sirina;
  const REF_H = Math.max(2, Math.round((REF_W * gh) / gw));
  const povrsina = (W * H) / (REF_W * REF_H);

  const slucaj = generator(1);
  const celije: number[] = [];
  for (let j = 0; j < gh; j += 1) {
    for (let i = 0; i < gw; i += 1) {
      if (MK[j * gw + i] > 128) celije.push(i, j);
    }
  }
  // Srednja brzina u okviru odlučuje koliko prikaz treba da se ustali: pri
  // tišini se zrak dugo nakuplja, pri buri je okvir pun za nekoliko sekundi.
  // Ista brojka nosi i zastojno širenje, pa se osvježava kad simulator
  // podmetne polje drugog sata (`postaviPolje`).
  function izmjeriSrednju(): number {
    let zbrojBrzina = 0;
    for (let i = 0; i < VX.length; i += 1) {
      zbrojBrzina += Math.hypot(
        (VX[i] / 255) * 2 * skala - skala,
        (VY[i] / 255) * 2 * skala - skala,
      );
    }
    return Math.max(zbrojBrzina / Math.max(1, VX.length), 0.05);
  }
  let srednjaBrzina = izmjeriSrednju();

  const izvor = zarista(celije, par.zarista, gw, gh, slucaj);
  const nIzvor = izvor.length / 2;

  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const dob = new Float32Array(N);
  const pomak = new Float32Array(N);
  const ziv = new Uint8Array(N);
  const gust = new Float32Array(W * H);
  const pomocno = new Float32Array(W * H);
  const JEZ = jezgra();

  const slobodne = new Int32Array(N);
  let nSlobodnih = N;
  for (let i = 0; i < N; i += 1) slobodne[i] = i;

  let t = 0;
  let ostatak = 0;
  let ukupnoIspusteno = 0;

  function uzmi(A: Uint8Array, fx: number, fy: number): number {
    // Rub se pridržava: čestica koja je maločas izašla iz polja i dalje mora
    // dobiti brzinu. Bez pridržavanja indeks izlazi iz niza, `A[…]` vrati
    // `undefined`, brzina postane NaN — a NaN prolazi kroz svaku usporedbu s
    // rubom, pa se čestica nikad ne ugasi nego zauvijek stoji u kutu.
    const x = Math.min(Math.max(fx, 0), 1) * (gw - 1);
    const y = Math.min(Math.max(fy, 0), 1) * (gh - 1);
    const i0 = x | 0;
    const j0 = y | 0;
    const i1 = i0 + 1 < gw ? i0 + 1 : i0;
    const j1 = j0 + 1 < gh ? j0 + 1 : j0;
    const tx = x - i0;
    const ty = y - j0;
    const a = A[j0 * gw + i0];
    const b = A[j0 * gw + i1];
    const c = A[j1 * gw + i0];
    const d = A[j1 * gw + i1];
    const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    return (v / 255) * 2 * skala - skala;
  }

  /** Potencijal vrtložnog šuma; brzina mu je okomiti gradijent. */
  function psi(x: number, y: number, vrijeme: number): number {
    const m = par.mjerilo;
    return (
      Math.sin(x * m + vrijeme * 0.55) * Math.cos(y * m * 1.31 - vrijeme * 0.42) +
      0.52 *
        Math.sin(x * m * 2.17 - vrijeme * 0.91) *
        Math.cos(y * m * 1.87 + vrijeme * 0.73) +
      0.27 *
        Math.sin(x * m * 4.1 + vrijeme * 1.4) *
        Math.cos(y * m * 3.7 - vrijeme * 1.1)
    );
  }

  /**
   * Težina čestice po dobi: brzo se pojavi, pa se polako prorjeđuje.
   *
   * Prorjeđivanje nije kemija nego ono što se ne vidi — miješanje uvis i
   * raspršenje ispod praga. Bez njega bi se pri bezvjetrici okvir zasitio i
   * ostao jednolično taman.
   */
  function tezina(d: number): number {
    return Math.min(1, d / par.pojava) * Math.exp(-d / par.raspad);
  }

  function rodi(n: number): void {
    const s = Math.floor(slucaj() * nIzvor) * 2;
    px[n] = izvor[s] + (slucaj() - 0.5) * 0.006;
    py[n] = izvor[s + 1] + (slucaj() - 0.5) * 0.006;
    dob[n] = 0;
    pomak[n] = slucaj();
    ziv[n] = 1;
  }

  function ugasi(n: number): void {
    ziv[n] = 0;
    slobodne[nSlobodnih] = n;
    nSlobodnih += 1;
  }

  function korak(dt: number): void {
    t += dt;

    // Izvor curi jednoliko. Kad nema slobodnih čestica, dug se ne pamti —
    // inače bi se, čim se okvir isprazni, sve odjednom ispustilo kao nalet.
    ostatak += (par.cestica / par.punjenje) * dt;
    while (ostatak >= 1 && nSlobodnih > 0) {
      ostatak -= 1;
      nSlobodnih -= 1;
      rodi(slobodne[nSlobodnih]);
      ukupnoIspusteno += 1;
    }
    if (nSlobodnih === 0) ostatak = 0;

    // Okvir je dvostruko širi nego viši, pa ista brzina u m/s prijeđe manji
    // dio okvira vodoravno nego okomito. S jednim koeficijentom za oboje bi
    // perjanica bila razvučena u smjeru sjever-jug.
    const kx = (par.ubrzanje / par.metaraX) * dt;
    const ky = (par.ubrzanje / par.metaraY) * dt;

    // Pri tišini pod plitkim slojem razmazivanje nadjača nošenje: smjer je
    // tada šum, a mjerenja uz plohu kažu da se zrak razlije oko plohe, ne u
    // nit niz javljeni smjer. Puno pojačanje traži oboje — slab vjetar i
    // plitak sloj; duboko miješanje ga gasi i pri tišini.
    const zastoj =
      1 +
      par.zastojnoSirenje *
        Math.max(0, 1 - srednjaBrzina / par.pragZastoja) *
        tezinaDubine(dubina, par.zastojPlitko, par.zastojDuboko);

    const e = 0.004;
    for (let n = 0; n < N; n += 1) {
      if (!ziv[n]) continue;
      dob[n] += dt;
      if (dob[n] > par.vijek) {
        ugasi(n);
        continue;
      }
      const x = px[n];
      const y = py[n];
      let vx = uzmi(VX, x, y);
      let vy = uzmi(VY, x, y);

      // Atmosferska perjanica ne drži ravnu os: sporiji, veliki vrtlozi nose
      // cijeli njezin presjek čas na jednu, čas na drugu stranu. Ovaj pomak
      // namjerno nema fazu po čestici, pa se ne poništi kad se gustoća zbroji.
      // Val putuje niz smjer vjetra; sitni vrtlog ispod njega i dalje raspliće
      // rubove, ali više ne mora sam glumiti i meandar i turbulenciju.
      const brzina = Math.hypot(vx, vy);
      if (brzina > 0.03) {
        const fazaVijuganja = t * 0.13 + (x * vx + y * vy) * 7.5 / brzina;
        const poprecno =
          Math.sin(fazaVijuganja) * brzina * par.vijuganje * par.vrtlog;
        const nx = -vy / brzina;
        const ny = vx / brzina;
        vx += nx * poprecno;
        vy += ny * poprecno;
      }

      // Blizu plohe je mlaz, dalje se raspliće.
      const a =
        par.vrtlog * (0.22 + par.sirenje * Math.min(1, dob[n] / par.rastVrtloga));
      const tt = t * par.vrtnja + pomak[n] * FAZA_VRTLOGA;
      const dx = (psi(x, y + e, tt) - psi(x, y - e, tt)) / (2 * e);
      const dy = (psi(x + e, y, tt) - psi(x - e, y, tt)) / (2 * e);
      vx += dy * a * par.snaga * zastoj;
      vy += -dx * a * par.snaga * zastoj;

      px[n] = x + vx * kx;
      py[n] = y + vy * ky;
      // Napisano obrnuto namjerno: ovako se gasi i čestica čiji je položaj
      // ispao NaN, jer NaN ne zadovoljava nijednu usporedbu.
      if (
        !(px[n] >= -0.02 && px[n] <= 1.02 && py[n] >= -0.02 && py[n] <= 1.02)
      ) {
        ugasi(n);
      }
    }
  }

  function zamuti(prolaza: number): void {
    for (let p = 0; p < prolaza; p += 1) {
      for (let j = 0; j < H; j += 1) {
        for (let i = 0; i < W; i += 1) {
          const k = j * W + i;
          const l = i > 0 ? gust[k - 1] : gust[k];
          const d = i < W - 1 ? gust[k + 1] : gust[k];
          pomocno[k] = (l + gust[k] * 2 + d) * 0.25;
        }
      }
      for (let j = 0; j < H; j += 1) {
        for (let i = 0; i < W; i += 1) {
          const k = j * W + i;
          const g = j > 0 ? pomocno[k - W] : pomocno[k];
          const d = j < H - 1 ? pomocno[k + W] : pomocno[k];
          gust[k] = (g + pomocno[k] * 2 + d) * 0.25;
        }
      }
    }
  }

  function crtaj(): Float32Array {
    gust.fill(0);
    const masa = ((EMISIJA_PO_SEKUNDI * par.punjenje) / par.cestica) * povrsina;
    for (let n = 0; n < N; n += 1) {
      if (!ziv[n]) continue;
      const w = tezina(dob[n]) * masa;
      if (w <= 0.002) continue;
      const i0 = (px[n] * W) | 0;
      const j0 = (py[n] * H) | 0;
      for (let dj = -2; dj <= 2; dj += 1) {
        const jj = j0 + dj;
        if (jj < 0 || jj >= H) continue;
        for (let di = -2; di <= 2; di += 1) {
          const ii = i0 + di;
          if (ii < 0 || ii >= W) continue;
          gust[jj * W + ii] += w * JEZ[(dj + 2) * 5 + (di + 2)];
        }
      }
    }
    zamuti(par.zamucenje);
    return gust;
  }

  return {
    sirina: W,
    visina: H,
    cestica: N,
    // Gustoća se ustali kad dotok i odlazak dođu u ravnotežu, a to traje
    // nekoliko prijelaza okvira. Gornja granica postoji jer se pri tišini
    // nikad ne bi ustalilo do kraja, a donja jer i pri buri treba vidjeti
    // kako se nit razvija.
    zagrijavanje: Math.min(
      120,
      Math.max(
        4,
        (PRIJELAZA_DO_USTALJENJA * par.metaraX) / (par.ubrzanje * srednjaBrzina),
        // Pri tišini vjetar ne odnosi ništa, pa ravnotežu postavlja
        // prorjeđivanje; dotad se prizor još puni pred očima.
        2.5 * par.raspad,
      ),
    ),
    korak,
    crtaj,
    zivih: () => ziv.reduce((a: number, b) => a + b, 0),
    ispusteno: () => ukupnoIspusteno,
    postavi: (ime, vrijednost) => {
      par[ime as keyof Parametri] = vrijednost;
    },
    postaviPolje: (novo) => {
      if (novo.gw !== gw || novo.gh !== gh) {
        // Položaji čestica su udjeli okvira, pa bi rešetka drugog oblika
        // značila da je i okvir drugi — a onda čestice više nisu ondje gdje
        // misle da jesu. Bolje glasno nego tiho krivo.
        throw new Error("Polje druge rešetke ne pripada istoj simulaciji");
      }
      VX = novo.vx;
      VY = novo.vy;
      skala = novo.skala;
      dubina = novo.dubina;
      srednjaBrzina = izmjeriSrednju();
    },
  };
}

/** Postaja mjeri dvije stvari koje smrde; ovo su ključevi za odabir. */
export type Tvar = "sumporovodik" | "merkaptani";

/** Postaje uz vrijednosti boja; `crtaj` ih ne poznaje, samo prikaz. */
export type Ljestvica = readonly (readonly [
  number,
  readonly [number, number, number, number],
])[];

/**
 * Perjanica sumporovodika: pijesak, jantar, žeravica, rđa.
 *
 * Dno ljestvice je prozirno, i to dugo. Zrak s plohe doista dođe do svakog
 * ugla okvira, ali obojiti ga sav znači obojiti cijelu kartu; boja počinje
 * tek negdje oko praga mirisa, pa se obojeno čita kao „ovdje se osjeti”.
 *
 * Prijelaz je gladak namjerno. Isproban je oštar korak na samom pragu i
 * izgledao je kao izolinija na karti tlaka — perjanica je dobila tvrd rub i
 * prestala izgledati kao zrak.
 */
export const LJESTVICA: Ljestvica = [
  [0, [255, 247, 214, 0]],
  [0.26, [255, 244, 208, 0]],
  [0.42, [250, 224, 140, 84]],
  [0.58, [245, 176, 66, 148]],
  [0.74, [232, 116, 40, 196]],
  [0.88, [198, 58, 42, 226]],
  [1, [124, 24, 44, 248]],
];

/**
 * Perjanica merkaptana: inje, procijep, modrica, ponoć.
 *
 * Hladna os namjerno. Kod najčešćeg oblika slabijeg razlikovanja boja
 * (deuteranopija) topla ljestvica ostaje žuto-smeđa, a ova plavo-ljubičasta,
 * pa se dvije tvari razlikuju i bez raspoznavanja crvene i zelene.
 */
export const LJESTVICA_MERKAPTANA: Ljestvica = [
  [0, [238, 245, 255, 0]],
  [0.26, [232, 242, 255, 0]],
  [0.42, [178, 214, 246, 84]],
  [0.58, [122, 166, 228, 148]],
  [0.74, [98, 112, 200, 196]],
  [0.88, [104, 64, 162, 226]],
  [1, [58, 22, 88, 248]],
];

/**
 * Što se mjeri, koliko ga ima i pri kojoj se količini osjeti.
 *
 * Razine su medijan izmjeren na postajama Karepovac 1 i 2, po probranim
 * mjesecima (vidi `scripts/postaje.py` — mjeseci u kojima je uređaj šutio ne
 * ulaze). Pragovi mirisa su iz Nagata (2003), mjereni metodom trokutnih
 * vrećica i preračunati u µg/m³ pri 25 °C.
 *
 * Omjer te dvije brojke je ono zbog čega prikaz uopće razlikuje tvari:
 * sumporovodika je oko dva puta više nego što treba da se osjeti, a
 * merkaptana sedamnaest. Zato zrak može smrdjeti i u satu u kojem je
 * sumporovodik uredan.
 */
export const TVARI = {
  sumporovodik: {
    naziv: "Sumporovodik",
    kratica: "H₂S",
    /** Medijan na postaji Karepovac 1, µg/m³. */
    razina: 1.135,
    /** Prag mirisa, µg/m³. */
    prag: 0.571,
    ljestvica: LJESTVICA,
  },
  merkaptani: {
    naziv: "Merkaptani",
    kratica: "CH₃SH",
    /** Medijan metilmerkaptana na postaji Karepovac 2, µg/m³. */
    razina: 2.36,
    /** Prag mirisa, µg/m³. */
    prag: 0.138,
    ljestvica: LJESTVICA_MERKAPTANA,
  },
} as const;

/** Koliko je puta izmjerena razina iznad praga na kojem se tvar osjeti. */
export function mirisneJedinice(tvar: Tvar): number {
  return TVARI[tvar].razina / TVARI[tvar].prag;
}

/**
 * Gustoća iz `crtaj` koja na okviru kartice odgovara izmjerenom medijanu.
 *
 * Prikaz računa čestice, a ne mikrograme. Da bi se iz njega ipak moglo
 * čitati hoće li se osjetiti, ljestvica se sidri u mjerenje — ali u ono
 * jedino koje postoji: postaju Karepovac 1, u udolini 676 m jugoistočno od
 * plohe. Staro je sidro (10,9) izjednačavalo gustoću **nad samom plohom** s
 * medijanom te postaje, kao da postaja stoji na odlagalištu — pa je svaka
 * ćelija tvrdila višestruko veću koncentraciju nego što model, provjeren na
 * mjerenjima, smije tvrditi.
 *
 * Sad se sidri regresijom: dvije godine satne gustoće na mjestu postaje
 * (`scripts/ocijeni-sim.ts`, lanac stvarnih sati) prema izmjerenom H₂S-u
 * daje nagib µg/m³ po jedinici gustoće i pozadinu 1,27 µg/m³ — istu koju
 * neovisno nalazi i bazdareni model oblačića (1,26). Sidro je medijan
 * mjerenja podijeljen nagibom, prevezen na ovaj okvir omjerom gustoća nad
 * plohom u oba okvira (ćelije su različite veličine, pa isti zrak daje
 * različit broj). Nagib nosi širok raspon (95 %: pola–dvostruko), jer je
 * prijemnik jedan i u udolini — ali smjer popravka je nedvojben: stara je
 * ljestvica na ovom okviru pretjerivala oko 1,8 puta, a na okviru
 * simulatora oko četiri (omjer okvira R = 0,26, medijan po 4 326 sati).
 *
 * Izvođenje: `OKVIR=zrak npx tsx scripts/ocijeni-sim.ts …` pa regresija u
 * bilješci uz `SIDRO_SIMULATORA`; oblik perjanice čuva kanarinac u
 * `dim.test.ts` — kad on padne, sidro treba izvesti iznova.
 */
export const SIDRO_KARTICE = 19.9;

/**
 * Raspon ljestvice u mirisnim jedinicama — koliko puta iznad praga mirisa.
 *
 * Širok je namjerno, preko tri reda veličine. Uži raspon zasiti sredinu
 * perjanice u jednu plohu boje, pa se izgubi ono što se u njoj događa; ovako
 * i jezgra ima nijanse. Donji kraj je ispod praga jer se rub mora imati gdje
 * izgubiti, a gornji iznad izmjerenih vrhova.
 */
export const MIRISNI_RASPON = { od: 0.03, do: 100 } as const;

const _RASPON_OD = Math.log10(MIRISNI_RASPON.od);
const _RASPON_SIRINA = Math.log10(MIRISNI_RASPON.do) - _RASPON_OD;

/**
 * Pretvara gustoću iz `crtaj` u položaj na ljestvici boja.
 *
 * Ljestvica je logaritamska jer je i miris takav: razlika između deset i
 * dvadeset puta iznad praga osjeti se otprilike koliko i razlika između
 * jednom i dvaput iznad. Uz to, linearna ljestvica bi merkaptane prikazala
 * kao jednolično zasićenu plohu preko cijelog kadra.
 *
 * Args:
 *   g: Gustoća iz `Simulacija.crtaj`.
 *   tvar: Koja se tvar prikazuje.
 *   sidro: Gustoća koja odgovara medijanu izmjerenom na postaji Karepovac 1.
 *     Ovisi o okviru: ista perjanica na okviru s krupnijim ćelijama daje
 *     veći broj, jer u ćeliju stane više zraka. Simulator zato nosi svoje
 *     (`SIDRO_SIMULATORA`).
 *
 * Returns:
 *   Broj između 0 i 1 za `ljestvicaBoja`.
 */
export function razina(
  g: number,
  tvar: Tvar,
  sidro: number = SIDRO_KARTICE,
): number {
  const jedinica = (mirisneJedinice(tvar) * g) / sidro;
  if (!(jedinica > 0)) return 0;
  const v = (Math.log10(jedinica) - _RASPON_OD) / _RASPON_SIRINA;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Gdje na ljestvici stoji prag mirisa — ondje ljestvice imaju korak. */
export const PRAG_NA_LJESTVICI = -_RASPON_OD / _RASPON_SIRINA;

/** Gradi tablicu boja za 256 razina, da se ne računa po pikselu. */
export function ljestvicaBoja(ljestvica: Ljestvica = LJESTVICA): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const v = i / 255;
    for (let k = 0; k < ljestvica.length - 1; k += 1) {
      const [a, ca] = ljestvica[k];
      const [b, cb] = ljestvica[k + 1];
      if (v < b || k === ljestvica.length - 2) {
        const f = Math.max(0, Math.min(1, (v - a) / (b - a)));
        for (let c = 0; c < 4; c += 1) lut[i * 4 + c] = ca[c] * (1 - f) + cb[c] * f;
        break;
      }
    }
  }
  return lut;
}
