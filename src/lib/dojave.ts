import { VJETAR } from "@/generated/karepovac-vjetar";
import type { OdourStrength } from "@/lib/constants";

/** Koliko sektora ima ruža; 16 je isto što nose i ruže mjerenja. */
export const SEKTORA = 16;

export const SEKTOR_IMENA = [
  "S", "SSI", "SI", "ISI", "I", "IJI", "JI", "JJI",
  "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ",
] as const;

/**
 * Težina po jačini. Dojava „nepodnošljivo” nosi više od dojave „slabo”, jer
 * ruža treba pokazati gdje je bilo najgore, a ne samo tko je stigao javiti.
 * Raspon je namjerno uzak: tri puta, ne deset, da jedna dojava ne pregazi
 * dvadeset drugih.
 */
export const TEZINA: Record<OdourStrength, number> = {
  slabo: 1,
  osjetno: 1.7,
  jako: 2.4,
  nepodnosivo: 3,
};

const SMJEROVI = dekodiraj(VJETAR.smjer);
const BRZINE = dekodiraj(VJETAR.brzina);
const PRVI_SAT = Date.parse(VJETAR.prviSat);

function dekodiraj(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export type Vjetar = { smjer: number; brzina: number };

/**
 * Vraća izmjereni vjetar u satu u kojem se miris osjetio.
 *
 * @param kada Vrijeme dojave.
 * @returns Smjer iz kojega je puhalo u stupnjevima i brzinu u m/s, ili `null`
 *   ako za taj sat nema mjerenja — bilo zato što je izvan niza, bilo zato što
 *   zračna luka toga sata nije javila.
 */
export function vjetarUSatu(kada: Date): Vjetar | null {
  const index = Math.floor((kada.getTime() - PRVI_SAT) / 3_600_000);
  if (index < 0 || index >= VJETAR.sati) return null;
  const smjer = SMJEROVI[index];
  const brzina = BRZINE[index];
  if (smjer === VJETAR.nema || brzina === VJETAR.nema) return null;
  return {
    smjer: smjer * VJETAR.korakSmjera,
    brzina: brzina * VJETAR.korakBrzine,
  };
}

/** Vraća sektor ruže za smjer iz kojega puše. */
export function sektor(smjer: number): number {
  const korak = 360 / SEKTORA;
  return Math.floor((((smjer + korak / 2) % 360) + 360) % 360 / korak);
}

/**
 * Najviše sati koliko jedan raspon smije nositi.
 *
 * Raspon je zamišljen kao „smrdjelo je od devet do jedanaest”, a ne kao
 * cijeli dan: bez granice bi jedna dojava od dvanaest sati nadglasala
 * dvadeset kratkih, i to bez ijednog dodatnog opažanja iza sebe.
 */
export const NAJDULJI_RASPON_SATI = 6;

export type Dojava = {
  /** Sat u kojem je miris počeo, zaokružen na puni sat. */
  occurredAt: Date;
  /**
   * Kraj razdoblja; prazno znači jedan sat.
   *
   * Epizoda kraća od sata nema kraj i broji se kao jedan sat s mirisom —
   * vjetar se mjeri po satu, pa je sat najsitnija jedinica koja se s njim
   * da spojiti. Koliko je epizoda doista trajala pamti se odvojeno
   * (`durationMin`), da se petnaest minuta i puni sat ne zapišu jednako.
   */
  endedAt?: Date | null;
  /** Je li se miris osjetio; dojava „ne smrdi” ima laž. */
  smelled?: boolean;
  /** Jačina; nema je kad se miris nije osjetio. */
  strength?: OdourStrength | null;
  /** Nasumična oznaka preglednika, bez veze s identitetom. */
  reporterId?: string | null;
};

/** Jedno opažanje: jedan dojavitelj, jedan sat. */
type Opazanje = {
  sat: number;
  smelled: boolean;
  tezina: number;
};

export type RuzaDojava = {
  /** Zbroj težina po sektoru, od sjevera nadesno. */
  tezine: number[];
  /** Broj opažanja s mirisom po sektoru. */
  broj: number[];
  /** Broj opažanja bez mirisa po sektoru — „bio sam, nije smrdjelo”. */
  brojBez: number[];
  /**
   * Udio opažanja u kojima je smrdjelo, po sektoru; `null` gdje nema
   * nijednog opažanja.
   *
   * Ovo je jedina brojka u ruži koja ne ovisi o tome koliko je tko voljan
   * javljati: sektor s tri dojave od pet opažanja smrdi češće od sektora s
   * deset dojava od pedeset, iako je drugi „veći”.
   */
  udio: (number | null)[];
  /** Koliko je opažanja ušlo u ružu i koliko ih čeka podatak o vjetru. */
  uporabljeno: number;
  bezVjetra: number;
  /** Koliko je opažanja sažeto jer je isti dojavitelj javio isti sat. */
  sazeto: number;
};

/**
 * Razlaže dojavu na satna opažanja.
 *
 * Dojava s rasponom nosi po jedno opažanje za svaki puni sat koji pokriva —
 * jer svaki od tih sati ima svoj izmjereni vjetar, i upravo je to ono što
 * ružu čini upotrebljivom. Raspon dulji od `NAJDULJI_RASPON_SATI` reže se,
 * a raspon unatrag (kraj prije početka) svodi se na jedan sat.
 */
function satiDojave(dojava: Dojava): number[] {
  const pocetak = Math.floor(dojava.occurredAt.getTime() / 3_600_000);
  // Kraj se umanjuje za trenutak: epizoda od 14.00 do 15.00 provedena je u
  // satu 14, a ne i u satu 15 — u 15.00 je već gotova.
  const kraj = dojava.endedAt
    ? Math.floor((dojava.endedAt.getTime() - 1) / 3_600_000)
    : pocetak;
  if (!(kraj > pocetak)) return [pocetak];
  const zadnji = Math.min(kraj, pocetak + NAJDULJI_RASPON_SATI - 1);
  const sati: number[] = [];
  for (let h = pocetak; h <= zadnji; h += 1) sati.push(h);
  return sati;
}

/**
 * Slaže ružu dojava: svako opažanje dobiva sat, svaki sat svoj izmjereni vjetar.
 *
 * Ovo ne treba nikakav model raspršenja i vrijedi samo za sebe. Ako se vrh
 * ruže poklopi sa smjerom u kojem leži Karepovac, to je nalaz i bez ijedne
 * jednadžbe; ako se ne poklopi, to je jednako tako nalaz.
 *
 * Tri stvari koje ruža radi, a nisu očite:
 *
 * 1. **Broji i tišinu.** Dojava „bio sam, nije smrdjelo” ide u `brojBez`, pa
 *    se iz sektora može čitati *udio*, a ne samo zbroj. Bez toga zbroj mjeri
 *    koliko je tko voljan javljati jednako koliko i koliko je smrdjelo.
 * 2. **Raspon je više sati.** Dojava od 21 do 23 h nosi tri opažanja, svako
 *    sa svojim vjetrom — jer se vjetar u te tri sata mogao okrenuti. Iz istog
 *    razloga epizoda od petnaest minuta koja počne u 14.50 nosi dva: dotiče
 *    i sat 14 i sat 15.
 * 3. **Isti nos u istom satu broji se jednom.** Dva javljanja istog
 *    dojavitelja za isti sat su jedno opažanje (uzima se jače), inače bi
 *    jedan uporan dojavitelj sam nacrtao ružu.
 *
 * @param dojave Dojave koje ulaze u zbroj.
 * @returns Ružu po sektorima, s udjelima i koliko je opažanja ostalo bez vjetra.
 */
export function ruzaDojava(dojave: readonly Dojava[]): RuzaDojava {
  const tezine = new Array<number>(SEKTORA).fill(0);
  const broj = new Array<number>(SEKTORA).fill(0);
  const brojBez = new Array<number>(SEKTORA).fill(0);
  let uporabljeno = 0;
  let bezVjetra = 0;

  // Sažimanje po dojavitelju i satu. Dojava bez oznake preglednika (stari
  // zapisi, ili tko je oznaku obrisao) ne smije se sažeti ni s čim — svaka
  // takva dobiva svoj ključ, jer o njoj ne znamo je li isti nos ili nije.
  const poKljucu = new Map<string, Opazanje>();
  let redni = 0;
  for (const dojava of dojave) {
    const smelled = dojava.smelled ?? true;
    const tezina = smelled ? TEZINA[dojava.strength ?? "osjetno"] : 0;
    const oznaka = dojava.reporterId ?? `bez-oznake-${(redni += 1)}`;
    for (const sat of satiDojave(dojava)) {
      const kljuc = `${oznaka}@${sat}`;
      const dosad = poKljucu.get(kljuc);
      // Jače opažanje nadjačava slabije: tko je javio i „slabo” i „jako” za
      // isti sat, opisao je isti sat dvaput, a ne dva puta smrad.
      if (
        !dosad ||
        (smelled && !dosad.smelled) ||
        (smelled === dosad.smelled && tezina > dosad.tezina)
      ) {
        poKljucu.set(kljuc, { sat, smelled, tezina });
      }
    }
  }

  const sazeto = [...dojave].reduce((n, d) => n + satiDojave(d).length, 0)
    - poKljucu.size;

  for (const opazanje of poKljucu.values()) {
    const vjetar = vjetarUSatu(new Date(opazanje.sat * 3_600_000));
    if (!vjetar) {
      bezVjetra += 1;
      continue;
    }
    const s = sektor(vjetar.smjer);
    if (opazanje.smelled) {
      tezine[s] += opazanje.tezina;
      broj[s] += 1;
    } else {
      brojBez[s] += 1;
    }
    uporabljeno += 1;
  }

  const udio = broj.map((n, i) => {
    const ukupno = n + brojBez[i];
    return ukupno > 0 ? n / ukupno : null;
  });

  return { tezine, broj, brojBez, udio, uporabljeno, bezVjetra, sazeto };
}
