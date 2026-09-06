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

/** Zadnji sat koji generirani niz zračne luke pokriva (početak sata, UTC). */
export const ZADNJI_SAT_LUKE = new Date(PRVI_SAT + (VJETAR.sati - 1) * 3_600_000);

function dekodiraj(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export type Vjetar = {
  smjer: number;
  brzina: number;
  /**
   * Vjetra praktički nema: smjer tada ništa ne znači i sat ne ide ni u jedan
   * krak ruže, nego se broji kao tišina. Prag je isti kao u satnom vjetru
   * (`TISINA` u `sim/vrijeme-satno.ts`).
   */
  tisina: boolean;
};

/** Ispod ove brzine vjetar je tišina; isto kao `TISINA` u `sim/vrijeme-satno.ts`. */
export const TISINA_MS = 0.5;

/**
 * Najkraći težinski vektor sata koji još nosi smjer, u m/s. Sat u kojem je
 * puhalo 2 m/s sa svih strana ima prosjek brzine 2, a vektor blizu nule —
 * smjer mu je slučajan koliko i tišini.
 */
const NAJKRACI_VEKTOR_MS = 0.3;

/** Izvor vjetra u satu; pozivatelj ga zamjenjuje da spoji dojave s arhivom. */
export type IzvorVjetra = (sat: Date) => Vjetar | null;

/**
 * Vraća vjetar zračne luke u satu u kojem se miris osjetio — iz generiranog
 * niza (`npm run izvedi-vjetar`), koji se obnavlja rukom i zato uvijek
 * negdje završava. Za sate poslije njegova kraja postoji arhiva u bazi
 * (`vjetarIzArhive`); ova je funkcija samo pričuva za sate prije nje.
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
  const ms = brzina * VJETAR.korakBrzine;
  return {
    smjer: smjer * VJETAR.korakSmjera,
    brzina: ms,
    tisina: ms < TISINA_MS,
  };
}

/**
 * Postaje iz arhive koje smiju voditi ružu, po prvenstvu.
 *
 * Isti red kao pravilo satnog vjetra (`satniVjetar` u `vjetar-sat.ts`):
 * najprije izmjereni AZO niz, Split-3 pa Split-2, jer su prošli provjeru
 * prema izmjerenom H₂S-u; gdje AZO sat nije javio, opažanje koje bi tada
 * vodilo kartu — redom kojim ih `vjetar.ts` bira (`REDOSLIJED`). Zračna
 * luka je zadnja: noću, kad se epizode događaju, nema moć razlučivanja.
 *
 * Popis stoji ovdje, a ne uvozi se iz `vjetar.ts`, jer taj modul pri uvozu
 * vuče dohvat i adrese izvora — a ruži treba samo redoslijed imena.
 */
export const POSTAJE_ZA_RUZU = [
  "split3",
  "split2",
  "vrboran",
  "marjan",
  "pujanke",
  "solin",
  "zrnovnica",
  "aerodrom",
  "ldsp",
] as const;

/**
 * Jedna postaja u jednom satu, kako je stigla iz arhive — već sažeta po satu.
 *
 * Neverin javlja svakih pet minuta, AZO jednom na sat; upit sažima oboje na
 * sat, i to vektorski i težinski po brzini (prosjek `brzina·sin(smjer)` i
 * `brzina·cos(smjer)`), jer aritmetički prosjek 350° i 10° daje jug umjesto
 * sjevera, a očitanje od 0,0 m/s ne smije glasati o smjeru koliko i ono od
 * 4 m/s.
 */
export type SatArhive = {
  station: string;
  /** Sat kao broj sati od epohe (`floor(epoha / 3600)`), u UTC-u. */
  sat: number;
  /** Prosjek `brzina·sin(smjer)` i `brzina·cos(smjer)` očitanja u satu, m/s. */
  sinBrzina: number;
  cosBrzina: number;
  /** Prosječna brzina u m/s. */
  brzina: number;
};

/**
 * Slaže vjetar po satu iz arhive: za svaki sat prva postaja po prvenstvu
 * koja ga je javila.
 *
 * Dvije stvari koje ovdje ne ulaze kao smjer:
 *
 * - **Sat koji još traje.** U njemu su tek jedno-dva Neverinova očitanja, a
 *   AZO-ov sat stigne tek kad završi i onda po prvenstvu nadjača — krak bi se
 *   preko noći tiho premjestio. Dojava za tekući sat zato čeka da sat prođe.
 * - **Tišina.** Sat s prosječnom brzinom ispod `TISINA_MS` ili s težinskim
 *   vektorom kraćim od `NAJKRACI_VEKTOR_MS` (vjetar se vrtio na sve strane)
 *   vraća se s `tisina: true`: ruža ga broji, ali ne u krak — očitanje
 *   „315° i 0,0 m/s” nije sjeverozapadnjak.
 *
 * @param redovi Sažeti sati po postaji iz `wind_readings`.
 * @param sada Trenutak; sat koji ga sadrži još nije završio.
 * @returns Vjetar po satu, ključ je isti broj sata kao u `SatArhive.sat`.
 */
export function vjetarIzArhive(
  redovi: readonly SatArhive[],
  sada: Date = new Date(),
): Map<number, Vjetar> {
  const prvenstvo = new Map<string, number>(
    POSTAJE_ZA_RUZU.map((p, i) => [p, i]),
  );
  const tekuciSat = Math.floor(sada.getTime() / 3_600_000);
  const najbolji = new Map<number, { rang: number; vjetar: Vjetar }>();
  for (const red of redovi) {
    const rang = prvenstvo.get(red.station);
    if (rang === undefined) continue;
    if (red.sat >= tekuciSat) continue;
    if (![red.sinBrzina, red.cosBrzina, red.brzina].every(Number.isFinite)) continue;
    const dosad = najbolji.get(red.sat);
    if (dosad && dosad.rang <= rang) continue;
    const duljina = Math.hypot(red.sinBrzina, red.cosBrzina);
    const smjer =
      ((Math.atan2(red.sinBrzina, red.cosBrzina) * 180) / Math.PI + 360) % 360;
    najbolji.set(red.sat, {
      rang,
      vjetar: {
        smjer: Math.round(smjer * 10) / 10,
        brzina: red.brzina,
        tisina: red.brzina < TISINA_MS || duljina < NAJKRACI_VEKTOR_MS,
      },
    });
  }
  return new Map([...najbolji].map(([sat, { vjetar }]) => [sat, vjetar]));
}

/**
 * Izvor vjetra koji najprije gleda arhivu, pa generirani niz zračne luke.
 *
 * Arhiva ide prva iako je mlađa: u njoj su postaje koje su prošle provjeru
 * (AZO, Vrboran, Marjan), a niz zračne luke je pričuva za sate od prije nego
 * što je arhiva počela. Sat koji nema ni jedno ni drugo ostaje bez vjetra i
 * broji se u `bezVjetra` — ne izmišlja se.
 *
 * @param arhiva Vjetar po satu iz `vjetarIzArhive`.
 */
export function spojiVjetar(arhiva: ReadonlyMap<number, Vjetar>): IzvorVjetra {
  return (sat) =>
    arhiva.get(Math.floor(sat.getTime() / 3_600_000)) ?? vjetarUSatu(sat);
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
  /**
   * Opažanja u satima bez vjetra (tišina): imaju podatak, ali ne i smjer,
   * pa ne stoje ni u jednom kraku. Broje se odvojeno od `bezVjetra`, jer
   * za njih se ne čeka ništa — sat je izmjeren i bio je tih.
   */
  tisina: number;
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
export function satiDojave(dojava: Dojava): number[] {
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
 * Svi sati koje dojave pokrivaju, bez ponavljanja — za upit prema arhivi.
 *
 * @param dojave Dojave čiji se sati traže.
 * @returns Brojevi sati (`floor(epoha / 3600)`), rastuće.
 */
export function satiDojava(dojave: readonly Dojava[]): number[] {
  const sati = new Set<number>();
  for (const d of dojave) for (const sat of satiDojave(d)) sati.add(sat);
  return [...sati].sort((a, b) => a - b);
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
 * 4. **Tišina nije smjer.** Sat u kojem vjetra praktički nije bilo broji se
 *    u `tisina`, ne u krak — ruža govori odakle je puhalo, a tada nije.
 *
 * @param dojave Dojave koje ulaze u zbroj.
 * @param vjetar Odakle se čita vjetar za sat; zadano generirani niz luke,
 *   stranica daje `spojiVjetar` s arhivom.
 * @returns Ružu po sektorima, s udjelima i koliko je opažanja ostalo bez vjetra.
 */
export function ruzaDojava(
  dojave: readonly Dojava[],
  vjetar: IzvorVjetra = vjetarUSatu,
): RuzaDojava {
  const tezine = new Array<number>(SEKTORA).fill(0);
  const broj = new Array<number>(SEKTORA).fill(0);
  const brojBez = new Array<number>(SEKTORA).fill(0);
  let uporabljeno = 0;
  let bezVjetra = 0;
  let tisina = 0;

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
    const v = vjetar(new Date(opazanje.sat * 3_600_000));
    if (!v) {
      bezVjetra += 1;
      continue;
    }
    if (v.tisina) {
      tisina += 1;
      continue;
    }
    const s = sektor(v.smjer);
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

  return { tezine, broj, brojBez, udio, uporabljeno, bezVjetra, tisina, sazeto };
}
