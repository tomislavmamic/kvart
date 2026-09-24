/**
 * Izračun površina po namjeni GUP-a: ukupno, iskorišteno, u skladu s
 * planom, u suprotnosti s njim i premali ostaci.
 *
 * Čiste funkcije bez I/O-a: ulaz su mjerenja iz data/gup-grad/cestice.json
 * (vidi podaci.ts) i pravila (pravila.ts). Sve odluke o tome što se broji
 * žive u pravilima; ovdje je samo aritmetika nad komadima čestica.
 */
import { KLASE, KLASA_PO_INDEKSU, type Godina, type KodKlase } from "./model";
import type { Pravila, VrstaKoristenja } from "./pravila";

/** Što je ručni pregled ortofotom rekao o čestici (data/gup-grad/pregled/rucno.json). */
export type RucnaVrsta =
  | "parkiraliste"
  | "javna"
  | "uredjeno"
  | "zelenilo"
  | "gradiliste"
  /** zgrade ima, a nema je ni u katastru ni u 3D modelu */
  | "izgradjeno"
  | "promet"
  | "infrastruktura"
  /** stijena, strmina, jaruga — ne može se graditi, a nije ni iskorišteno */
  | "neizgradivo"
  /** pregledano, doista prazno */
  | "slobodno";

const RUCNO_KAO: Partial<Record<RucnaVrsta, VrstaKoristenja>> = {
  parkiraliste: "parkiraliste",
  javna: "javna",
  uredjeno: "uredjeno",
  zelenilo: "zelenilo",
  gradiliste: "gradiliste",
  izgradjeno: "neevidentirana",
  promet: "promet",
  infrastruktura: "ostala",
};

/** Jedan komad čestice (dio čestice u jednoj klasi), u pikselima. */
export interface Komad {
  /** Indeks čestice u cestice.json; treba samo pravilu o ostacima. */
  cestica?: number;
  klasa: number;
  /** površina komada */
  n: number;
  /** pod zgradom iz katastra */
  zk: number;
  /** pod zgradom iz gradskog 3D modela (Objekti_Split_2025) */
  z25: number;
  /** bruto površina zgrada 3D modela: pikseli pod zgradom × broj etaža */
  kat?: number;
  /** pod ulicom ili nogostupom */
  pr: number;
  /** pod parkiralištem ili garažnim nizom */
  pa?: number;
  /** pod okolišem javne ustanove (škola, vrtić, bolnica, crkva) */
  jv?: number;
  /** pod grobljem, športskim terenom, igralištem, trgom */
  os: number;
  /** pod infrastrukturom (trafostanica, vodosprema, benzinska, pruga) */
  inf?: number;
  /** pod održavanim javnim zelenilom ili parkom */
  ze: number;
  /** pod gradilištem */
  gr?: number;
  /** pretežita skupina katastarske zgrade (0 = nema) */
  g: number;
  /** ispravak iz ručnog pregleda cijele čestice */
  rucno?: RucnaVrsta;
}

/** Polja komada, redom kako ih piše scripts/gup-grad/cestice.py. */
export const POLJA_KOMADA = ["cestica", "klasa", "n", "zk", "z25", "kat", "pr", "pa", "jv", "os", "inf", "ze", "gr", "g"] as const;

/**
 * Komad iz niza brojeva redom POLJA_KOMADA, od indeksa `od`. S `bezCestice`
 * niz počinje od `klasa` (kako komade nose pločice karte).
 */
export function komadIzNiza(a: ArrayLike<number>, od = 0, bezCestice = false): Komad {
  const k: Record<string, number> = {};
  const prvo = bezCestice ? 1 : 0;
  for (let j = prvo; j < POLJA_KOMADA.length; j++) k[POLJA_KOMADA[j]] = a[od + j - prvo];
  return k as unknown as Komad;
}

/**
 * Što odredbe za područje urbanog pravila komada kažu o gradnji (odredbe.ts),
 * u pikselima. Bez toga komad se broji bez pravila iz odredbi.
 */
export interface UvjetiKomada {
  /** Najmanja građevna čestica (Ppmin) u pikselima; 0 = odredbe je ne propisuju. */
  najmanjaPx: number;
  /** Najveći koeficijent izgrađenosti; null = odredbe ga ne propisuju. */
  kig: number | null;
  /** Najveći koeficijent iskorištenosti (bruto površina / čestica); null = ne propisuju. */
  kis?: number | null;
  /** Dopuštaju li odredbe ondje novu gradnju te namjene na slobodnom zemljištu. */
  novaGradnja: boolean;
  pikselM2: number;
}

export interface Procjena {
  /** Površina komada koja pripada zoni (bez izuzete ulice). */
  n: number;
  /** Ulica izuzeta iz zone (pripisuje se P). */
  ulica: number;
  iskoristeno: number;
  uSkladu: number;
  uSuprotnosti: number;
  poVrsti: Partial<Record<VrstaKoristenja, number>>;
  /** Slobodno, ali odredbe ondje ne dopuštaju novu gradnju. */
  zabranjeno: number;
  /** Slobodno, ali ručni pregled kaže da se ne može graditi (stijena, strmina). */
  neizgradivo: number;
  /** Dio okućnice koji je protivan planu (dijeli sud zgrade uz koju je). */
  okucnicaProtivno?: number;
}

const VRSTA_ZGRADE: Record<number, VrstaKoristenja> = {
  1: "stambena",
  2: "gospodarska",
  3: "javna",
  4: "pomocna",
  5: "ostala",
};

/**
 * Zgrade kojima pripada građevna čestica. Pomoćne (garaže, spremišta) stoje
 * na tuđoj; „ostale” (6xx–9xx) su i dvorane i hale od tisuća m², pa nose
 * svoju — sitna nadstrešnica ionako ne prijeđe prag `najmanjiTrag`.
 */
const GLAVNE: ReadonlySet<VrstaKoristenja> = new Set(["stambena", "gospodarska", "javna", "ostala", "neevidentirana", "gradiliste"]);

/**
 * Koliko komada je ulica koja ne pripada zoni. U samoj P (ulice,
 * infrastruktura) ništa se ne izuzima — ondje je ulica upravo namjena.
 */
export function ulicaKomada(k: Komad, kod: KodKlase, p: Pravila): number {
  if (!p.ulice.izuzmi || kod === "P" || k.n <= 0) return 0;
  const u = Math.min(k.pr, k.n);
  return u >= p.ulice.pragUlicneCestice * k.n ? k.n : u;
}

/**
 * Što na komadu stoji, bez preklapanja: redom zgrade, gradilište, promet,
 * parkirališta, javne ustanove, uređeno, infrastruktura, zelenilo, pa
 * ispravak iz ručnog pregleda za ostatak. `ulica` je već izuzeta iz
 * komada, pa se ne broji ni kao promet.
 */
function dijeloviKomada(k: Komad, p: Pravila, ulica: number) {
  const dijelovi: [VrstaKoristenja, number][] = [];
  let slobodno = k.n - ulica;
  let zgrada = 0;
  const dodaj = (vrsta: VrstaKoristenja, px: number) => {
    const v = Math.min(Math.max(px, 0), slobodno);
    if (v <= 0) return 0;
    slobodno -= v;
    const i = dijelovi.findIndex(([x]) => x === vrsta);
    if (i >= 0) dijelovi[i][1] += v;
    else dijelovi.push([vrsta, v]);
    return v;
  };

  if (p.racunaj.zgrade) {
    // Katastar zna vrstu zgrade, 3D model zna koliko je stvarno sagrađeno.
    const upisano = p.zgrade === "model3d" ? Math.min(k.zk, k.z25) : k.zk;
    const neupisano = p.zgrade === "katastar" ? 0 : Math.max(0, k.z25 - k.zk);
    // Katastarska zgrada bez pretežite skupine ne postoji (g > 0 kad je
    // zk > 0), ali krhotina na rubu može imati zk > 0 i g = 0.
    const vrsta = VRSTA_ZGRADE[k.g] ?? "ostala";
    const v = dodaj(vrsta, upisano);
    if (GLAVNE.has(vrsta)) zgrada += v;
    zgrada += dodaj("neevidentirana", neupisano);
  }
  if (p.racunaj.gradilista) zgrada += dodaj("gradiliste", k.gr ?? 0);
  if (p.racunaj.promet && ulica <= 0) dodaj("promet", k.pr);
  if (p.racunaj.parkiralista) dodaj("parkiraliste", k.pa ?? 0);
  if (p.racunaj.javneUstanove) dodaj("javna", k.jv ?? 0);
  if (p.racunaj.uredjeno) dodaj("uredjeno", k.os);
  if (p.racunaj.infrastruktura) dodaj("ostala", k.inf ?? 0);
  if (p.racunaj.zelenilo) dodaj("zelenilo", k.ze);
  const rucno = p.racunaj.rucniPregled && k.rucno ? RUCNO_KAO[k.rucno] : undefined;
  if (rucno) {
    const v = dodaj(rucno, slobodno);
    if (GLAVNE.has(rucno)) zgrada += v;
  }
  return { dijelovi, zgrada };
}

export function pokrivenost(k: Komad, p: Pravila, ulica = 0): [VrstaKoristenja, number][] {
  return dijeloviKomada(k, p, ulica).dijelovi;
}

/**
 * Za `nacin: "gradevna"`: koliko nepokrivenog komada pripada građevnoj
 * čestici zgrade koja na njemu stoji.
 *
 * Zgrada treba tlocrt / kig i bruto površina / kis zemljišta, a ne manje od
 * Ppmin. Što preostane
 * je slobodno samo ako je samo za sebe barem nova građevna čestica (Ppmin;
 * gdje ga odredbe ne propisuju, čestica kakvu ima postojeća zgrada) i ako
 * odredbe ondje dopuštaju novu gradnju. Inače je i to okućnica.
 */
function okucnicaKomada(
  n: number,
  pokriveno: number,
  zgrada: number,
  bruto: number,
  p: Pravila,
  u?: UvjetiKomada,
): number {
  const pikselM2 = u?.pikselM2 ?? 4;
  if (zgrada * pikselM2 < p.gradevna.najmanjaZgradaM2 || zgrada < p.najmanjiTrag * n) return 0;
  const slobodno = Math.max(0, n - pokriveno);
  const kig = u?.kig ?? p.gradevna.zadaniKig;
  const kis = u?.kis ?? null;
  // zgrada troši više od onoga što traži kig (tlocrt) i kis (bruto površina)
  const poKig = kig ? zgrada / kig : kis ? 0 : n;
  const poKis = kis ? Math.max(bruto, zgrada) / kis : 0;
  const potrebno = Math.max(poKig, poKis, u?.najmanjaPx ?? 0);
  let okucnica = Math.min(slobodno, Math.max(0, potrebno - pokriveno));
  const ostaje = slobodno - okucnica;
  const zaNovu = u?.najmanjaPx || potrebno;
  if (ostaje < zaNovu || (p.postujZabraneGradnje && u && !u.novaGradnja)) okucnica += ostaje;
  return okucnica;
}

export function procijeniKomad(k: Komad, kod: KodKlase, p: Pravila, u?: UvjetiKomada): Procjena {
  const ulica = ulicaKomada(k, kod, p);
  const n = k.n - ulica;
  const { dijelovi, zgrada } = dijeloviKomada(k, p, ulica);
  const pokriveno = dijelovi.reduce((s, [, v]) => s + v, 0);
  const udio = n > 0 ? pokriveno / n : 0;

  let mnozitelj = 1;
  if (pokriveno > 0) {
    const cijeli =
      (p.nacin === "prag" && udio >= p.prag) ||
      (p.nacin === "cijela" && udio >= p.najmanjiTrag);
    if (cijeli) mnozitelj = n / pokriveno;
  }

  const dopusteno = p.dopusteno[kod];
  const out: Procjena = {
    n,
    ulica,
    iskoristeno: 0,
    uSkladu: 0,
    uSuprotnosti: 0,
    poVrsti: {},
    zabranjeno: 0,
    neizgradivo: 0,
  };
  // sud zgrada, za okućnicu: dijeli ga u omjeru u kojem su zgrade po planu
  let zgradeSklad = 0;
  let zgradeSve = 0;
  for (const [vrsta, v] of dijelovi) {
    const px = v * mnozitelj;
    out.iskoristeno += px;
    out.poVrsti[vrsta] = (out.poVrsti[vrsta] ?? 0) + px;
    const ok = dopusteno.includes(vrsta);
    if (ok) out.uSkladu += px;
    else out.uSuprotnosti += px;
    if (GLAVNE.has(vrsta) || vrsta === "pomocna") {
      zgradeSve += px;
      if (ok) zgradeSklad += px;
    }
  }
  if (p.nacin === "gradevna") {
    const okucnica = okucnicaKomada(n, pokriveno, zgrada, k.kat ?? 0, p, u);
    if (okucnica > 0) {
      const r = zgradeSve > 0 ? zgradeSklad / zgradeSve : 1;
      out.iskoristeno += okucnica;
      out.poVrsti.okucnica = okucnica;
      out.uSkladu += okucnica * r;
      out.uSuprotnosti += okucnica * (1 - r);
      out.okucnicaProtivno = okucnica * (1 - r);
    }
  }
  const slobodno = Math.max(0, n - out.iskoristeno);
  if (slobodno > 0) {
    if (p.racunaj.rucniPregled && k.rucno === "neizgradivo") out.neizgradivo = slobodno;
    else if (p.postujZabraneGradnje && u && !u.novaGradnja) out.zabranjeno = slobodno;
  }
  return out;
}

/** CSR popis susjednih čestica: susjedi i-te su lista[od[i]:od[i+1]]. */
export interface Susjedi {
  od: number[];
  lista: number[];
}

/**
 * Premali ostaci: komadi čiji slobodni dio ne može služiti namjeni.
 *
 * Slobodni dio komada manji od najmanje građevne čestice koju odredbe
 * propisuju za njegovo područje i namjenu (`najmanjaPx`, odredbe.ts) je ostatak,
 * osim ako se preko slobodne čestice iste namjene (iskorišteno ispod
 * `slobodnaUdio`) spaja s drugim slobodnim komadima i zajedno dosežu tu
 * površinu. Vrt uz kuću i vrt uz susjednu kuću se ne spajaju — obje su
 * čestice iskorištene — ali vrt uz praznu česticu se spaja s njom.
 *
 * Vraća indeks komada → slobodni pikseli koji su ostatak.
 */
export function ostaci(
  komadi: readonly Komad[],
  procjene: readonly Procjena[],
  susjedi: Susjedi,
  p: Pravila,
  /** Najmanja građevna čestica za komad, u pikselima; 0 = odredbe je ne propisuju. */
  najmanjaPx: (k: Komad) => number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!p.ostaci.ukljuci) return out;
  const slobodno = procjene.map((r) => Math.max(0, r.n - r.iskoristeno - r.zabranjeno - r.neizgradivo));

  // iskorištenost po čestici, preko svih njezinih komada
  const poCestici = new Map<number, { n: number; isk: number }>();
  komadi.forEach((k, i) => {
    if (k.cestica === undefined) return;
    const c = poCestici.get(k.cestica) ?? { n: 0, isk: 0 };
    c.n += procjene[i].n;
    c.isk += procjene[i].iskoristeno;
    poCestici.set(k.cestica, c);
  });
  const slobodnaCestica = (c: number) => {
    const x = poCestici.get(c);
    return !!x && x.n > 0 && x.isk < p.ostaci.slobodnaUdio * x.n;
  };

  const komadPo = new Map<string, number>();
  komadi.forEach((k, i) => {
    if (k.cestica !== undefined) komadPo.set(`${k.cestica}:${k.klasa}`, i);
  });

  // union-find nad komadima sa slobodnim dijelom
  const roditelj = komadi.map((_, i) => i);
  const korijen = (i: number): number => {
    while (roditelj[i] !== i) {
      roditelj[i] = roditelj[roditelj[i]];
      i = roditelj[i];
    }
    return i;
  };
  komadi.forEach((k, i) => {
    if (k.cestica === undefined || slobodno[i] <= 0 || !slobodnaCestica(k.cestica)) return;
    for (let t = susjedi.od[k.cestica]; t < susjedi.od[k.cestica + 1]; t++) {
      const j = komadPo.get(`${susjedi.lista[t]}:${k.klasa}`);
      if (j !== undefined && slobodno[j] > 0) roditelj[korijen(i)] = korijen(j);
    }
  });
  const zbroj = new Map<number, number>();
  komadi.forEach((_, i) => {
    if (slobodno[i] > 0) zbroj.set(korijen(i), (zbroj.get(korijen(i)) ?? 0) + slobodno[i]);
  });

  komadi.forEach((k, i) => {
    if (slobodno[i] <= 0) return;
    const najmanje = najmanjaPx(k);
    if (najmanje > 0 && (zbroj.get(korijen(i)) ?? 0) < najmanje) out.set(i, slobodno[i]);
  });
  return out;
}

export interface RezultatKlase {
  kod: KodKlase;
  ukupnoM2: number;
  iskoristenoM2: number;
  uSkladuM2: number;
  uSuprotnostiM2: number;
  /** Slobodno, ali premalo za namjenu i bez slobodnog susjeda. */
  ostatakM2: number;
  /** Slobodno, ali odredbe ondje ne dopuštaju novu gradnju (samo rekonstrukcija, zaštita). */
  zabranjenoM2: number;
  /** Slobodno, ali ručni pregled kaže da se ne može graditi. */
  neizgradivoM2: number;
  /** Za zonu: ulice izuzete iz nje. Za P: ulice pribrojene iz drugih zona. */
  uliceM2: number;
  /** Iskorišteno po vrsti — za opis u tooltipu. */
  poVrstiM2: Partial<Record<VrstaKoristenja, number>>;
  /** Samo dio u suprotnosti, po vrsti. */
  suprotnoPoVrstiM2: Partial<Record<VrstaKoristenja, number>>;
}

export interface UlazGodine {
  /** Površina svake klase u obuhvatu, u pikselima (i izvan čestica). */
  klasePx: Record<number, number>;
  komadi: readonly Komad[];
  pikselM2: number;
  /** Bez susjeda nema pravila o ostacima. */
  susjedi?: Susjedi;
  /** Što odredbe kažu o gradnji na komadu; bez toga nema ostataka ni zabrana. */
  uvjeti?: (k: Komad) => UvjetiKomada;
}

/** Procjene svih komada godine i ostaci među njima. */
export function procijeniGodinu(ulaz: UlazGodine, p: Pravila) {
  const uvjeti = ulaz.komadi.map((k) => ulaz.uvjeti?.(k));
  const procjene = ulaz.komadi.map((k, i) => {
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    return kl ? procijeniKomad(k, kl.kod, p, uvjeti[i]) : null;
  });
  const prazna: Procjena = { n: 0, ulica: 0, iskoristeno: 0, uSkladu: 0, uSuprotnosti: 0, poVrsti: {}, zabranjeno: 0, neizgradivo: 0 };
  const ost = ulaz.susjedi && ulaz.uvjeti
    ? ostaci(
        ulaz.komadi,
        procjene.map((r) => r ?? prazna),
        ulaz.susjedi,
        p,
        (k) => ulaz.uvjeti?.(k).najmanjaPx ?? 0,
      )
    : new Map<number, number>();
  return { procjene, ostaci: ost };
}

export function izracunajGodinu(ulaz: UlazGodine, p: Pravila): RezultatKlase[] {
  const po = new Map<number, RezultatKlase>();
  for (const kl of KLASE) {
    po.set(kl.indeks, {
      kod: kl.kod,
      ukupnoM2: (ulaz.klasePx[kl.indeks] ?? 0) * ulaz.pikselM2,
      iskoristenoM2: 0,
      uSkladuM2: 0,
      uSuprotnostiM2: 0,
      ostatakM2: 0,
      zabranjenoM2: 0,
      neizgradivoM2: 0,
      uliceM2: 0,
      poVrstiM2: {},
      suprotnoPoVrstiM2: {},
    });
  }
  const ulice = po.get(KLASE.find((k) => k.kod === "P")!.indeks)!;
  const { procjene, ostaci: ost } = procijeniGodinu(ulaz, p);
  const m2 = ulaz.pikselM2;
  ulaz.komadi.forEach((k, i) => {
    const kl = KLASA_PO_INDEKSU.get(k.klasa);
    const r = po.get(k.klasa);
    const pr = procjene[i];
    if (!kl || !r || !pr) return;
    r.iskoristenoM2 += pr.iskoristeno * m2;
    r.uSkladuM2 += pr.uSkladu * m2;
    r.uSuprotnostiM2 += pr.uSuprotnosti * m2;
    r.ostatakM2 += (ost.get(i) ?? 0) * m2;
    r.zabranjenoM2 += pr.zabranjeno * m2;
    r.neizgradivoM2 += pr.neizgradivo * m2;
    for (const [vrsta, v] of Object.entries(pr.poVrsti) as [VrstaKoristenja, number][]) {
      r.poVrstiM2[vrsta] = (r.poVrstiM2[vrsta] ?? 0) + v * m2;
      const protivno = vrsta === "okucnica" ? (pr.okucnicaProtivno ?? 0) : p.dopusteno[kl.kod].includes(vrsta) ? 0 : v;
      if (protivno > 0) r.suprotnoPoVrstiM2[vrsta] = (r.suprotnoPoVrstiM2[vrsta] ?? 0) + protivno * m2;
    }
    // Ulica izuzeta iz zone seli u P, gdje je iskorištena po planu.
    if (pr.ulica > 0) {
      const u = pr.ulica * m2;
      r.ukupnoM2 -= u;
      r.uliceM2 += u;
      ulice.ukupnoM2 += u;
      ulice.uliceM2 += u;
      ulice.iskoristenoM2 += u;
      ulice.uSkladuM2 += u;
      ulice.poVrstiM2.promet = (ulice.poVrstiM2.promet ?? 0) + u;
    }
  });
  // Komadi su izrezani čestičnom rešetkom, a ukupno klasom iz obuhvata;
  // na rubu obuhvata iskorišteno smije premašiti ukupno za piksel-dva.
  for (const r of po.values()) {
    r.ukupnoM2 = Math.max(0, r.ukupnoM2);
    if (r.iskoristenoM2 > r.ukupnoM2) {
      const f = r.ukupnoM2 / r.iskoristenoM2;
      r.iskoristenoM2 = r.ukupnoM2;
      r.uSkladuM2 *= f;
      r.uSuprotnostiM2 *= f;
    }
    r.zabranjenoM2 = Math.min(r.zabranjenoM2, r.ukupnoM2 - r.iskoristenoM2);
    r.neizgradivoM2 = Math.min(r.neizgradivoM2, r.ukupnoM2 - r.iskoristenoM2 - r.zabranjenoM2);
    r.ostatakM2 = Math.min(r.ostatakM2, r.ukupnoM2 - r.iskoristenoM2 - r.zabranjenoM2 - r.neizgradivoM2);
  }
  return [...po.values()].filter((r) => r.ukupnoM2 > 0);
}

/** Ostaci godine kao parovi [čestica, klasa] — za kartu provjere. */
export function ostaciGodine(ulaz: UlazGodine, p: Pravila): [number, number][] {
  const { ostaci: ost } = procijeniGodinu(ulaz, p);
  return [...ost.keys()]
    .map((i) => ulaz.komadi[i])
    .filter((k) => k.cestica !== undefined)
    .map((k) => [k.cestica!, k.klasa]);
}

export type RezultatiPoGodini = Record<Godina, RezultatKlase[]>;
