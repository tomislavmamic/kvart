/**
 * Roj čestica koje za sobom vuku rep — vjetar kao tragovi zraka.
 *
 * Ovo je način na koji vjetar prikazuju karte kojima ljudi ovdje ionako
 * vjeruju (Neverin, Windy): nema ni strelica ni nacrtanih strujnica, nego
 * stotine repova koji putuju s vjetrom i blijede prema kraju. Razlog nije samo
 * ljepota. Strelica pokazuje smjer u jednoj točki, a nacrtana strujnica je
 * nepomična šara koju oko čita kao cestu; rep je jedino od toga troje što
 * pokazuje **kojim putem** i **kojom brzinom** zrak ide, bez ijedne oznake
 * koju bi trebalo tumačiti.
 *
 * Ovdje je samo račun: čestice žive u udjelima okvira (0–1 prema istoku i 0–1
 * prema jugu), pa ovaj modul ne zna ni za Three ni za MapLibre i dade se
 * provjeriti. Pretvorbu u koordinate karte i crtanje radi `sim/tragovi.ts`.
 *
 * ## Rep se mjeri putem, ne vremenom
 *
 * Uzori repu daju stalno **trajanje**, pa mu duljina ispadne razmjerna brzini.
 * Njima to prolazi jer im je vjetar morski, pet do dvadeset metara u sekundi.
 * Nad ovim kvartom vjetar je gradski, često ispod dva, i takav bi rep spao na
 * nekoliko piksela — karta puna crtica umjesto struje. Zato se rep ovdje
 * zadaje **putem**: uvijek pokriva istih ~520 m, a koliko mu treba da ih
 * prijeđe, toliko ondje puše. Brzina time ostaje netaknuta — mijenja se samo
 * to koliko se repa vidi.
 *
 * Isti je zaključak stajao i iza razmaka poteza po nekadašnjim strujnicama:
 * vremenom zadana mjera pri tišini se sažme baš kad je najpotrebnija.
 *
 * ## Tri stvari koje roj mora sam od sebe raditi
 *
 * **Rep ne raste čekanjem.** Novorođena čestica odmah dobiva cijeli rep,
 * izveden unatrag kroz polje — to je put kojim je taj zrak došao. Bez toga bi
 * čestice nicale kao točke, a pri poštovanju želje za mirovanjem, gdje se ne
 * miče ništa, ne bi se vidjelo baš ništa.
 *
 * **Roj se ne smije skupiti.** Polje ima mjesta gdje se struje sastaju; pusti
 * li se čestice da ondje samo stoje, za pola minute je pola karte prazno.
 * Zato se broji gustoća po gruboj rešetki: u pretrpanoj ćeliji čestice brže
 * stare, a nove se siju u najprazniju od pet nasumice pogođenih ćelija.
 *
 * **Nitko ne nestaje naglo.** Vijek se troši, ali se na oba kraja prozirnost
 * pali i gasi; tko izađe iz okvira, ne briše se nego mu se pokrene nestajanje.
 */

/**
 * Koliko se sekundi stvarnog vjetra prijeđe u sekundi prikaza.
 *
 * Isto ubrzanje kojim teče i perjanica (`UBRZANJE` u `dim.ts`), da dvije
 * stvari na istoj karti ne mjere vrijeme različito.
 */
export const UBRZANJE = 60;

/** Koliko metara puta pokriva rep jedne čestice. */
export const DULJINA_TRAGA_M = 520;

/** Koliko točaka pamti rep; razmak među njima je stalan po putu. */
export const TRAG_TOCAKA = 40;

/** Razmak dviju točaka repa, u metrima. */
export const KORAK_M = DULJINA_TRAGA_M / (TRAG_TOCAKA - 1);

/**
 * Svaka koliko se točaka repa uzima u crtanju.
 *
 * Rep je gušći nego što oku treba: zavoji nad ovim okvirom su blagi, pa ih
 * devetnaest poteza opiše jednako dobro kao trideset devet.
 */
export const PODJELA_TRAGA = 2;

/** Koliko poteza ima najduži rep. */
export const POTEZA_PO_TRAGU = Math.floor((TRAG_TOCAKA - 1) / PODJELA_TRAGA);

/**
 * Najkraći rep, kao udio najduljega.
 *
 * Kad bi svi repovi bili jednako dugi, polje bi se čitalo kao počešljana
 * šara — pravilna, a vjetar nije pravilan. Svakoj se čestici pri rođenju
 * odredi koliko će joj se repa vidjeti, pa uzorak ostane isti a slika ne
 * ispadne kao češalj.
 */
const NAJKRACI_UDIO = 0.55;

/**
 * Koliko metara puta čestica prijeđe prije nego je zamijeni nova.
 *
 * Tri duljine repa: dovoljno da se vidi kamo je otišla, prekratko da se roj
 * stigne skupiti u struje.
 */
const VIJEK_M = 3 * DULJINA_TRAGA_M;

/** Koliko se puta pali i gasi prozirnost na krajevima vijeka. */
const NESTAJANJE_M = 190;

/**
 * Vjetar koji se česticama pribraja da i pri tišini ostare.
 *
 * Bez njega bi vijek zadan putem u bezvjetrici trajao vječno, pa se roj nikad
 * ne bi presložio ondje gdje se struje sastaju i brzina padne na ništa.
 */
const MIRNI_VJETAR = 0.25;

/** Korak računa, u sekundama prikaza. */
const KORAK_S = 1 / 60;

/** Rešetka po kojoj se broji gustoća čestica, po osi. */
const MREZA = 12;

/** Koliko puta iznad prosjeka ćelija mora biti da joj se čestice požure. */
const PRETRPANOST = 2.5;

/** Koliko puta brže stari čestica u pretrpanoj ćeliji. */
const ZURBA = 4;

/**
 * Najviše koraka po jednom pozivu.
 *
 * Karta zna stajati (druga kartica, uspavano računalo) pa se `dt` nakupi. Bez
 * granice bi se roj nakon svakog povratka trznuo naprijed za cijelu stanku.
 */
const NAJVISE_KORAKA = 6;

/** Koliko izvan okvira čestica smije otići prije nego joj krene nestajanje. */
const RUB = 0.05;

type Polje = {
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly gw: number;
  readonly gh: number;
};

export type Roj = {
  /** Točke repova kao udjeli okvira, po česticama: `[u, v]` po točki. */
  readonly trag: Float32Array;
  /** Za svaku česticu, mjesto najnovije točke u njezinu prstenu. */
  readonly glava: Int32Array;
  /** Koliki se udio repa svakoj čestici crta; zadan pri rođenju. */
  readonly udio: Float32Array;
  /** Koliko je čestica živo; ostatak polja je zauzet, ali se ne crta. */
  readonly broj: number;
  /**
   * Postavlja polje vjetra u m/s po ćeliji.
   *
   * Args:
   *   preslozi: Da se roj posije nanovo. Traži se kad se roj ne miče (želja za
   *     mirovanjem), jer bi inače repovi ostali oni iz prošlog sata.
   */
  postaviPolje(
    vx: Float32Array,
    vy: Float32Array,
    gw: number,
    gh: number,
    preslozi?: boolean,
  ): void;
  /** Postavlja koliko se čestica nosi; nove se odmah posiju. */
  postaviBroj(n: number): void;
  /** Pomiče roj za `dt` sekundi prikaza. */
  korak(dt: number): void;
  /** Prozirnost čestice zbog njezina vijeka, 0 kad je se ne crta. */
  zivot(n: number): number;
};

/** Bilinearno očitanje polja u udjelima okvira. */
function uzorak(A: Float32Array, gw: number, gh: number, u: number, v: number): number {
  const fx = Math.min(1, Math.max(0, u)) * (gw - 1);
  const fy = Math.min(1, Math.max(0, v)) * (gh - 1);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const i1 = Math.min(gw - 1, i0 + 1);
  const j1 = Math.min(gh - 1, j0 + 1);
  const tx = fx - i0;
  const ty = fy - j0;
  const a = A[j0 * gw + i0];
  const b = A[j0 * gw + i1];
  const c = A[j1 * gw + i0];
  const d = A[j1 * gw + i1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Glatki prijelaz 0→1; obična crta se na paljenju i gašenju vidi kao trzaj. */
function glatko(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Stvara roj tragova.
 *
 * Args:
 *   sirinaM: Širina okvira u metrima.
 *   visinaM: Visina okvira u metrima.
 *   najvise: Za koliko se čestica unaprijed zauzima mjesto.
 *
 * Returns:
 *   Roj; dok mu se ne zada polje i broj, ne radi ništa.
 */
export function stvoriRoj(sirinaM: number, visinaM: number, najvise: number): Roj {
  const trag = new Float32Array(najvise * TRAG_TOCAKA * 2);
  const glava = new Int32Array(najvise);
  /** Prijeđeni put, u metrima; ujedno je i mjera vijeka. */
  const dob = new Float32Array(najvise);
  /** Put od zadnje zapisane točke repa, u metrima. */
  const putic = new Float32Array(najvise);
  const udio = new Float32Array(najvise);
  const mreza = new Uint16Array(MREZA * MREZA);
  // Jedan zajednički par umjesto niza po pozivu: ovo se zove desetke tisuća
  // puta po slici, a svaki bi novi niz bio smeće za skupljanje.
  const ocitanje = new Float64Array(2);

  let polje: Polje | null = null;
  let broj = 0;
  let ostatak = 0;

  /** Očitava vjetar u točki; `vy` je brzina prema jugu, kao i `v`. */
  function vjetar(u: number, v: number): void {
    if (!polje) {
      ocitanje[0] = 0;
      ocitanje[1] = 0;
      return;
    }
    ocitanje[0] = uzorak(polje.vx, polje.gw, polje.gh, u, v);
    ocitanje[1] = uzorak(polje.vy, polje.gw, polje.gh, u, v);
  }

  function celija(u: number, v: number): number {
    const i = Math.min(MREZA - 1, Math.max(0, Math.floor(u * MREZA)));
    const j = Math.min(MREZA - 1, Math.max(0, Math.floor(v * MREZA)));
    return j * MREZA + i;
  }

  function prebroji(): void {
    mreza.fill(0);
    for (let n = 0; n < broj; n += 1) {
      if (dob[n] >= VIJEK_M) continue;
      const baza = n * TRAG_TOCAKA * 2;
      const g = glava[n];
      mreza[celija(trag[baza + g * 2], trag[baza + g * 2 + 1])] += 1;
    }
  }

  /** Najpraznija od pet nasumice pogođenih ćelija; odmah se i zauzme. */
  function odaberiCeliju(): number {
    let najbolja = Math.floor(Math.random() * MREZA * MREZA);
    let najmanje = mreza[najbolja];
    for (let i = 1; i < 5; i += 1) {
      const c = Math.floor(Math.random() * MREZA * MREZA);
      if (mreza[c] < najmanje) {
        najmanje = mreza[c];
        najbolja = c;
      }
    }
    mreza[najbolja] += 1;
    return najbolja;
  }

  /**
   * Sije česticu i odmah joj izvodi rep unatrag kroz polje.
   *
   * Rep se izvodi korakom po **putu**, pa ima jednako točaka i jednaku duljinu
   * bez obzira puše li jako ili slabo.
   *
   * Args:
   *   n: Koja se čestica sije.
   *   prvi: Je li ovo prva sjetva; tada se dob razbaca da roj ne izumre odjednom.
   */
  function rodi(n: number, prvi: boolean): void {
    const c = odaberiCeliju();
    const i = c % MREZA;
    const j = (c - i) / MREZA;
    let u = (i + Math.random()) / MREZA;
    let v = (j + Math.random()) / MREZA;

    const baza = n * TRAG_TOCAKA * 2;
    const zadnja = TRAG_TOCAKA - 1;
    trag[baza + zadnja * 2] = u;
    trag[baza + zadnja * 2 + 1] = v;
    for (let k = zadnja - 1; k >= 0; k -= 1) {
      vjetar(u, v);
      const brzina = Math.hypot(ocitanje[0], ocitanje[1]);
      // U tišini rep nema kamo; točke ostaju jedna na drugoj i ispadne mrlja,
      // što je točno ono što se ondje i događa.
      if (brzina > 1e-4) {
        u -= (ocitanje[0] / brzina) * (KORAK_M / sirinaM);
        v -= (ocitanje[1] / brzina) * (KORAK_M / visinaM);
      }
      trag[baza + k * 2] = u;
      trag[baza + k * 2 + 1] = v;
    }
    glava[n] = zadnja;
    putic[n] = 0;
    udio[n] = NAJKRACI_UDIO + Math.random() * (1 - NAJKRACI_UDIO);
    dob[n] = prvi ? Math.random() * VIJEK_M : 0;
  }

  function pomakniSve(prag: number): void {
    for (let n = 0; n < broj; n += 1) {
      const baza = n * TRAG_TOCAKA * 2;
      let g = glava[n];
      let u = trag[baza + g * 2];
      let v = trag[baza + g * 2 + 1];

      vjetar(u, v);
      const brzina = Math.hypot(ocitanje[0], ocitanje[1]);
      const put = (brzina + MIRNI_VJETAR) * UBRZANJE * KORAK_S;

      dob[n] += mreza[celija(u, v)] > prag ? put * ZURBA : put;
      if (dob[n] >= VIJEK_M) {
        rodi(n, false);
        continue;
      }

      const du = (ocitanje[0] * UBRZANJE * KORAK_S) / sirinaM;
      const dv = (ocitanje[1] * UBRZANJE * KORAK_S) / visinaM;
      u += du;
      v += dv;
      // Izlazak iz okvira nije brisanje: čestica nastavi svojim putem, samo
      // joj se pokrene gašenje, pa rep izađe van a ne prepolovi se na rubu.
      if ((u < -RUB || u > 1 + RUB || v < -RUB || v > 1 + RUB)
        && dob[n] < VIJEK_M - NESTAJANJE_M) {
        dob[n] = VIJEK_M - NESTAJANJE_M;
      }

      // Glava prstena je uvijek živi položaj čestice; starije su točke uzorci
      // razmaknuti punim korakom puta. Kad se korak navrši, dotadašnja se
      // glava pribije na mjesto gdje je taj korak zaista pun — ne na kraj ovog
      // koraka računa, jer bi inače razmak uzoraka pri jakom vjetru poskakivao
      // za trećinu — pa se otvara nova glava.
      const ds = brzina * UBRZANJE * KORAK_S;
      putic[n] += ds;
      while (putic[n] >= KORAK_M) {
        putic[n] -= KORAK_M;
        const nazad = ds > 0 ? putic[n] / ds : 0;
        trag[baza + g * 2] = u - du * nazad;
        trag[baza + g * 2 + 1] = v - dv * nazad;
        g = (g + 1) % TRAG_TOCAKA;
      }
      trag[baza + g * 2] = u;
      trag[baza + g * 2 + 1] = v;
      glava[n] = g;
    }
  }

  return {
    trag,
    glava,
    udio,
    get broj() {
      return broj;
    },

    postaviPolje(vx, vy, gw, gh, preslozi = false) {
      const prvo = polje === null;
      polje = { vx, vy, gw, gh };
      // Roj se pri promjeni sata inače ne sije nanovo: repovi izvedeni u
      // prošlom polju za koji trenutak ionako otputuju, a ponovna bi sjetva
      // cijelu kartu trznula baš dok gledatelj vuče vremensku crtu. Kad se
      // roj ne miče, to otputovanje nikad ne dođe, pa se mora presložiti.
      if (!prvo && !preslozi) return;
      prebroji();
      for (let n = 0; n < broj; n += 1) rodi(n, true);
    },

    postaviBroj(n) {
      const novi = Math.max(0, Math.min(najvise, Math.round(n)));
      if (novi === broj) return;
      const stari = broj;
      broj = novi;
      if (!polje || novi <= stari) return;
      prebroji();
      for (let i = stari; i < novi; i += 1) rodi(i, true);
    },

    korak(dt) {
      if (!polje || broj === 0 || !(dt > 0)) return;
      prebroji();
      const prag = (broj / (MREZA * MREZA)) * PRETRPANOST;
      ostatak = Math.min(ostatak + dt, KORAK_S * NAJVISE_KORAKA);
      while (ostatak >= KORAK_S) {
        ostatak -= KORAK_S;
        pomakniSve(prag);
      }
    },

    zivot(n) {
      const t = dob[n];
      if (t <= 0 || t >= VIJEK_M) return 0;
      return Math.min(glatko(t / NESTAJANJE_M), glatko((VIJEK_M - t) / NESTAJANJE_M));
    },
  };
}
