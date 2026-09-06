/**
 * Situacija: što karta mora reći u pet sekundi, izvedeno iz jednog kadra.
 *
 * Model daje gustoću po ćeliji; čovjek pita „smrdi li kod mene, koliko,
 * kamo ide, hoće li biti bolje i koliko ste sigurni”. Ovaj modul je most:
 * iz gustoće jednog sata (i susjednih sati, za trend) slaže sažetak u
 * riječima i razinama, bez ijedne brojke koju model ne smije tvrditi.
 *
 * Pravila koja ovdje vrijede i koje prikaz ne smije zaobići:
 *
 * 1. **Razina se izvodi iz istog mjerila kao boja na karti** (`razina` iz
 *    `dim.ts`, sidro simulatora), pa sažetak i karta ne mogu reći dvoje.
 * 2. **Pouzdanost nikad nije „visoka” za prognozirani sat** ni za sat čiji
 *    vjetar dolazi iz modela umjesto s postaje, ni pri tišini (smjer je
 *    tada šum). Razlozi se ispisuju, ne samo ocjena.
 * 3. **„Ne znamo” je drukčije od „ne smrdi”.** Kad kadar nije dostupan ili
 *    je pouzdanost niska, područje ne smije biti označeno kao čisto.
 * 4. Sažetak je čista funkcija nad podatcima, bez DOM-a, da se provjerava
 *    u Nodeu i da ga hindcast može ocijeniti kao i gustoću.
 */

import { MIRISNI_RASPON, PRAG_NA_LJESTVICI, razina, type Tvar } from "@/lib/dim";
import type { Dostupnost, VrstaKadra } from "@/lib/sim/kadrovi";
import { SIDRO_SIMULATORA } from "@/lib/sim/ljestvica";
import { imeIzvora, type IzvorVjetra } from "@/lib/sim/vrijeme-satno";
import { izBajta } from "@/lib/sim/zapis-gustoce";

/** Razina mirisa u riječima; poredak je i poredak jačine. */
export type Razina = "nema" | "moguce" | "slabo" | "osjetno" | "jako";

export const RAZINE: readonly Razina[] = ["nema", "moguce", "slabo", "osjetno", "jako"];

export type Pouzdanost = "visoka" | "srednja" | "niska";

export type Trend = "bolje" | "stabilno" | "gore" | "nepoznato";

/** Naseljeno područje za koje se sažetak izvodi. */
export type Podrucje = {
  readonly id: string;
  readonly naziv: string;
  /** Središte, WGS84. */
  readonly lat: number;
  readonly lon: number;
  /** Polumjer u metrima unutar kojega se ćelije uzimaju (visoki percentil, ne najveća). */
  readonly polumjerM: number;
};

export type StanjePodrucja = {
  readonly podrucje: Podrucje;
  readonly razina: Razina;
  /**
   * Udio ćelija područja iznad praga „moguće”; 0–1. Zamjena za
   * vjerojatnost dok model ne nosi ansambl — i tako se i naziva u prikazu:
   * „zahvaćenost”, ne „vjerojatnost”.
   */
  readonly zahvacenost: number;
};

export type Situacija = {
  readonly sat: string;
  readonly vrsta: VrstaKadra;
  /** Najviša razina nad naseljenim područjima (ne nad samom plohom). */
  readonly razina: Razina;
  readonly podrucja: readonly StanjePodrucja[];
  /** Kamo zrak s plohe ide; `null` pri tišini ili promjenjivom vjetru. */
  readonly nosi: { readonly azimut: number; readonly opis: string } | null;
  readonly trend: Trend;
  readonly pouzdanost: Pouzdanost;
  /** Zašto je pouzdanost takva; prikaz ih ispisuje na zahtjev. */
  readonly razlozi: readonly string[];
  /** Sljedeći sat na crti u kojem se razina mijenja, ako je poznat. */
  readonly promjena: { readonly sat: string; readonly razina: Razina } | null;
  readonly izvorVjetra: IzvorVjetra | null;
};

/**
 * Naseljena područja oko plohe, s približnim središtima.
 *
 * Dračevac i Bilice su iz `public/geo/granica.geojson` (težišta obrisa);
 * ostala su ručno postavljena prema karti i nose oznaku da su približna.
 * Polumjer od 400 m pokriva jezgru naselja, ne njegov rub; to je namjerno —
 * sažetak govori o mjestu gdje ljudi jesu, a rub bi bio lažna preciznost.
 */
export const PODRUCJA: readonly Podrucje[] = [
  { id: "dracevac", naziv: "Dračevac", lat: 43.5245, lon: 16.5013, polumjerM: 450 },
  { id: "bilice", naziv: "Bilice", lat: 43.5261, lon: 16.4935, polumjerM: 450 },
  { id: "mostine", naziv: "Mostine", lat: 43.5249, lon: 16.4895, polumjerM: 350 },
  { id: "kila", naziv: "Kila", lat: 43.5215, lon: 16.4915, polumjerM: 400 },
  { id: "neslanovac", naziv: "Neslanovac", lat: 43.5200, lon: 16.4820, polumjerM: 400 },
  { id: "solin", naziv: "Solin", lat: 43.5350, lon: 16.4930, polumjerM: 600 },
  { id: "kucine", naziv: "Kučine", lat: 43.5435, lon: 16.5135, polumjerM: 400 },
  { id: "mravince", naziv: "Mravince", lat: 43.5385, lon: 16.5290, polumjerM: 450 },
  { id: "kamen", naziv: "Kamen", lat: 43.5170, lon: 16.5290, polumjerM: 450 },
  { id: "sirobuja", naziv: "Sirobuja", lat: 43.5105, lon: 16.5085, polumjerM: 400 },
  { id: "vrboran", naziv: "Vrboran / Mejaši", lat: 43.5150, lon: 16.4965, polumjerM: 400 },
  { id: "pujanke", naziv: "Pujanke", lat: 43.5160, lon: 16.4735, polumjerM: 450 },
];

// ---------------------------------------------------------------------------
// Izvod: iz bajtova gustoće jednog sata u sažetak u riječima.
// ---------------------------------------------------------------------------

/**
 * Granice razina, u **mirisnim jedinicama** (koliko puta iznad praga mirisa).
 *
 * Zašto baš ove brojke: ljestvica boja (`LJESTVICA` u `dim.ts`) ima
 * postaje na 0,42 / 0,58 / 0,74 / 0,88 položaja, što je oko praga pa svakih
 * pola reda veličine (≈ 3,3× / 12× / 38× praga). Riječi prate te korake, malo
 * zaobljene, da svaka riječ odgovara jednoj boji: „moguće” je blijedožuta
 * koja se tek nazire, „slabo” jantar, „osjetno” narančasta, „jako” crvena.
 *
 * - `nema`: ispod 0,6 praga — ni nos ni boja to ne vide;
 * - `moguce`: pojas oko praga (0,6–2×) — netko osjeti, netko ne;
 * - `slabo`: 2–6× praga;
 * - `osjetno`: 6–20× praga;
 * - `jako`: iznad 20× praga.
 *
 * Koraci su uzastopni logaritamski (≈ ×3,3 svaki), pa je „jako” tri koraka
 * iznad „moguće” — isto onoliko koliko ljestvica boja prijeđe od blijedog do
 * crvenog. Položaj na ljestvici izvodi `polozajGranice`, a ne upisuje se
 * ručno, da promjena raspona ljestvice ne razdvoji riječ od boje.
 */
export const GRANICE_RAZINA: Readonly<Record<Exclude<Razina, "nema">, number>> = {
  moguce: 0.6,
  slabo: 2,
  osjetno: 6,
  jako: 20,
};

/**
 * Koji postotak ćelija područja mora prijeći granicu da mu se razina prizna.
 *
 * Osamdeseti percentil, ne najveća ćelija: perjanica je zrnata (čestice, pa
 * zamućenje), a jedna vruća ćelija na rubu naselja nije naselje. Ni medijan:
 * on bi zanemario polovicu naselja koja je pod perjanicom.
 */
export const PERCENTIL_PODRUCJA = 0.8;

/** Položaj na ljestvici boja (0–1) na kojem stoji granica razine. */
export function polozajGranice(razina: Exclude<Razina, "nema">): number {
  return PRAG_NA_LJESTVICI + Math.log10(GRANICE_RAZINA[razina]) / _SIRINA_LJESTVICE;
}

/**
 * Razina u riječima za položaj na ljestvici boja.
 *
 * Args:
 *   polozaj: Izlaz `razina()` iz `dim.ts`, 0–1.
 *
 * Returns:
 *   Riječ; `nema` ispod prve granice.
 */
export function razinaZaPolozaj(polozaj: number): Razina {
  if (polozaj >= polozajGranice("jako")) return "jako";
  if (polozaj >= polozajGranice("osjetno")) return "osjetno";
  if (polozaj >= polozajGranice("slabo")) return "slabo";
  if (polozaj >= polozajGranice("moguce")) return "moguce";
  return "nema";
}

/** Redni broj razine; veći je gore. */
export function stupanj(razina: Razina): number {
  return RAZINE.indexOf(razina);
}

/** Riječi kojima prikaz imenuje razine; legenda i kartica moraju biti iste. */
export const RIJECI_RAZINA: Readonly<Record<Razina, string>> = {
  nema: "nema naznaka",
  moguce: "moguće",
  slabo: "slabo",
  osjetno: "osjetno",
  jako: "jako",
};

export const RIJECI_TRENDA: Readonly<Record<Trend, string>> = {
  bolje: "slabi",
  stabilno: "bez promjene",
  gore: "jača",
  nepoznato: "trend nepoznat",
};

export const RIJECI_POUZDANOSTI: Readonly<Record<Pouzdanost, string>> = {
  visoka: "visoka",
  srednja: "srednja",
  niska: "niska",
};

/** Slika gustoće jednog sata, kako je zapisuje `zapisiGustocu`. */
export type SlikaSata = {
  /** Bajtovi iz `zapisiGustocu(gustoca, SIDRO_SIMULATORA)`; redak 0 je sjever. */
  readonly bajtovi: Uint8Array;
  readonly sirina: number;
  readonly visina: number;
};

export type Granice = {
  readonly zapad: number;
  readonly jug: number;
  readonly istok: number;
  readonly sjever: number;
};

/** Vjetar kadra, sveden na ono što sažetak treba; `promjenjiv` javlja METAR. */
export type VjetarSituacije = {
  readonly smjerOd: number;
  readonly brzina: number;
  readonly tisina: boolean;
  readonly izvor: IzvorVjetra;
  readonly promjenjiv?: boolean;
};

/** Kadar, sveden na polja koja sažetak čita. */
export type KadarSituacije = {
  readonly sat: string;
  readonly pomak: number;
  readonly vrsta: VrstaKadra;
  readonly dostupnost: Dostupnost;
  readonly vjetar: VjetarSituacije | null;
  readonly izvor: IzvorVjetra | null;
};

/** Susjedni sat na crti, s već izvedenom ukupnom razinom ako je izračunat. */
export type SusjedniSat = {
  readonly sat: string;
  readonly pomak: number;
  readonly dostupnost: Dostupnost;
  /** `null` dok radnici sat nisu izračunali (ili kad je nedostupan). */
  readonly razina: Razina | null;
};

export type UlazSituacije = {
  readonly kadar: KadarSituacije;
  /** `null` dok radnici sat nisu izračunali. */
  readonly slika: SlikaSata | null;
  readonly granice: Granice;
  readonly tvar: Tvar;
  /** Jačina izvora koju gledatelj bira; zadano 1. */
  readonly jacina?: number;
  /** Prethodni satovi, od najbližeg unatrag (−1, −2, …). */
  readonly prije?: readonly SusjedniSat[];
  /** Sljedeći satovi, redom (+1, +2, …). */
  readonly poslije?: readonly SusjedniSat[];
  readonly podrucja?: readonly Podrucje[];
};

/** Ispod ove brzine smjer je već nesiguran, iako još nije tišina. */
const SLAB_VJETAR = 1;

/** Metara po stupnju zemljopisne širine; za dužinu se množi kosinusom širine. */
const M_PO_STUPNJU_SIRINE = 110_574;
const M_PO_STUPNJU_DUZINE_NA_EKVATORU = 111_320;

const _SIRINA_LJESTVICE = Math.log10(MIRISNI_RASPON.do) - Math.log10(MIRISNI_RASPON.od);

/** Osam strana, kamo nosi; riječi su u dativu jer stoje iza „prema”. */
const PREMA = [
  "sjeveru",
  "sjeveroistoku",
  "istoku",
  "jugoistoku",
  "jugu",
  "jugozapadu",
  "zapadu",
  "sjeverozapadu",
] as const;

/**
 * Kamo vjetar nosi, iz meteorološkog smjera iz kojega puše.
 *
 * Args:
 *   smjerOd: Odakle puše, u stupnjevima.
 *
 * Returns:
 *   Azimut kamo nosi i opis „prema …”.
 */
export function kamoNosi(smjerOd: number): { azimut: number; opis: string } {
  const azimut = (((smjerOd + 180) % 360) + 360) % 360;
  const strana = PREMA[Math.round(azimut / 45) % 8];
  return { azimut, opis: `prema ${strana}` };
}

/**
 * Ocjenjuje razinu po naseljenim područjima iz slike jednoga sata.
 *
 * Args:
 *   slika: Bajtovi gustoće sata.
 *   granice: Zemljopisni obuhvat slike.
 *   tvar: Tvar za koju se razina računa.
 *   jacina: Jačina izvora u odnosu na bazdarenu.
 *   podrucja: Područja koja se ocjenjuju.
 *
 * Returns:
 *   Stanje svakog područja, istim redom kao `podrucja`.
 */
export function ocijeniPodrucja(
  slika: SlikaSata,
  granice: Granice,
  tvar: Tvar,
  jacina: number = 1,
  podrucja: readonly Podrucje[] = PODRUCJA,
): StanjePodrucja[] {
  const { bajtovi, sirina, visina } = slika;
  const sirinaStupnjeva = granice.istok - granice.zapad;
  const visinaStupnjeva = granice.sjever - granice.jug;
  const granicaMoguce = polozajGranice("moguce");

  return podrucja.map((p) => {
    const mPoStupnjuDuzine =
      M_PO_STUPNJU_DUZINE_NA_EKVATORU * Math.cos((p.lat * Math.PI) / 180);
    const polumjerLon = p.polumjerM / mPoStupnjuDuzine;
    const polumjerLat = p.polumjerM / M_PO_STUPNJU_SIRINE;
    // Okvir ćelija oko središta, pa se krug provjerava samo unutar njega.
    const x0 = Math.max(0, Math.floor(((p.lon - polumjerLon - granice.zapad) / sirinaStupnjeva) * sirina));
    const x1 = Math.min(sirina - 1, Math.ceil(((p.lon + polumjerLon - granice.zapad) / sirinaStupnjeva) * sirina));
    const y0 = Math.max(0, Math.floor(((granice.sjever - (p.lat + polumjerLat)) / visinaStupnjeva) * visina));
    const y1 = Math.min(visina - 1, Math.ceil(((granice.sjever - (p.lat - polumjerLat)) / visinaStupnjeva) * visina));

    const polozaji: number[] = [];
    for (let y = y0; y <= y1; y += 1) {
      const lat = granice.sjever - ((y + 0.5) / visina) * visinaStupnjeva;
      const dy = (lat - p.lat) * M_PO_STUPNJU_SIRINE;
      for (let x = x0; x <= x1; x += 1) {
        const lon = granice.zapad + ((x + 0.5) / sirina) * sirinaStupnjeva;
        const dx = (lon - p.lon) * mPoStupnjuDuzine;
        if (dx * dx + dy * dy > p.polumjerM * p.polumjerM) continue;
        const g = izBajta(bajtovi[y * sirina + x], SIDRO_SIMULATORA) * jacina;
        polozaji.push(razina(g, tvar, SIDRO_SIMULATORA));
      }
    }

    if (!polozaji.length) {
      // Područje izvan okvira polja: model o njemu ne zna ništa, ali ni to
      // nije „nema” — samo nema ćelija. Ostaje bez razine i bez zahvaćenosti.
      return { podrucje: p, razina: "nema", zahvacenost: 0 };
    }
    polozaji.sort((a, b) => a - b);
    const percentil = polozaji[Math.min(polozaji.length - 1, Math.floor(PERCENTIL_PODRUCJA * polozaji.length))];
    const zahvaceno = polozaji.filter((v) => v >= granicaMoguce).length;
    return {
      podrucje: p,
      razina: razinaZaPolozaj(percentil),
      zahvacenost: zahvaceno / polozaji.length,
    };
  });
}

/** Najviša razina među područjima. */
export function ukupnaRazina(podrucja: readonly StanjePodrucja[]): Razina {
  let najvisa: Razina = "nema";
  for (const p of podrucja) if (stupanj(p.razina) > stupanj(najvisa)) najvisa = p.razina;
  return najvisa;
}

function spustiPouzdanost(p: Pouzdanost, na: Pouzdanost): Pouzdanost {
  const red: Pouzdanost[] = ["niska", "srednja", "visoka"];
  return red[Math.min(red.indexOf(p), red.indexOf(na))];
}

function nizeZaJedan(p: Pouzdanost): Pouzdanost {
  return p === "visoka" ? "srednja" : "niska";
}

function brojHr(x: number, decimala = 1): string {
  return x.toFixed(decimala).replace(".", ",");
}

/**
 * Izvodi sažetak situacije za jedan sat crte.
 *
 * Args:
 *   ulaz: Kadar, njegova slika, obuhvat, tvar i susjedni satovi.
 *
 * Returns:
 *   Situacija; bez slike razina je `nema` uz nisku pouzdanost i razlog,
 *   jer „još nije izračunato” ne smije izgledati kao „čisto”.
 */
export function izvediSituaciju(ulaz: UlazSituacije): Situacija {
  const { kadar, slika, granice, tvar } = ulaz;
  const jacina = ulaz.jacina ?? 1;
  const prije = ulaz.prije ?? [];
  const poslije = ulaz.poslije ?? [];
  const razlozi: string[] = [];

  const nedostupan = kadar.dostupnost === "nedostupno";
  const podrucja =
    slika && !nedostupan ? ocijeniPodrucja(slika, granice, tvar, jacina, ulaz.podrucja) : [];
  const razinaSata = ukupnaRazina(podrucja);

  // Kamo nosi: iz vjetra kadra; tišina i promjenjiv smjer ne nose nikamo
  // određeno, pa je bolje ne crtati strelicu nego crtati krivu.
  const v = kadar.vjetar;
  const nosi = v && !v.tisina && !v.promjenjiv ? kamoNosi(v.smjerOd) : null;

  // Pouzdanost kreće od najviše i spušta se za svaki razlog, nikad diže.
  let pouzdanost: Pouzdanost = "visoka";

  if (nedostupan || !slika) {
    pouzdanost = "niska";
    razlozi.push(
      nedostupan ? "Za ovaj sat nema podataka o vjetru." : "Ovaj sat još nije izračunat.",
    );
  }

  if (kadar.vrsta === "prognoza") {
    // Prognoza nikad nije „visoka”; tri sata unaprijed ni „srednja” — vjetar
    // modela na 2–11 km mreži za tri sata zna promašiti i smjer i sat.
    pouzdanost = spustiPouzdanost(pouzdanost, kadar.pomak >= 3 ? "niska" : "srednja");
    razlozi.push(
      kadar.pomak >= 3
        ? `Prognoza ${kadar.pomak} h unaprijed: vjetar je iz modela i može promašiti sat i smjer.`
        : `Prognoza ${kadar.pomak} h unaprijed: vjetar je iz modela, ne s postaje.`,
    );
  } else if (kadar.izvor === "model") {
    pouzdanost = spustiPouzdanost(pouzdanost, "srednja");
    razlozi.push("Vjetar za ovaj sat nije izmjeren nego uzet iz modela (Open-Meteo).");
  } else if (kadar.izvor) {
    razlozi.push(`Vjetar je izmjeren na postaji ${imeIzvora(kadar.izvor)}.`);
  }

  if (v?.tisina) {
    pouzdanost = "niska";
    razlozi.push("Tišina: pri vjetru ispod 0,5 m/s smjer je šum, a zrak se skuplja oko plohe.");
  } else if (v?.promjenjiv) {
    pouzdanost = "niska";
    razlozi.push("Postaja javlja promjenjiv smjer vjetra.");
  } else if (v && v.brzina < SLAB_VJETAR) {
    pouzdanost = spustiPouzdanost(pouzdanost, "srednja");
    razlozi.push(`Slab vjetar (${brojHr(v.brzina)} m/s): smjer je nesiguran.`);
  }

  const susjedi = [...prije.slice(0, 2), ...poslije.slice(0, 1)];
  const nedostupniSusjedi = susjedi.filter((s) => s.dostupnost === "nedostupno").length;
  if (nedostupniSusjedi > 0) {
    pouzdanost = nizeZaJedan(pouzdanost);
    razlozi.push(
      nedostupniSusjedi === 1
        ? "Susjednom satu nedostaje vjetar, pa zalet nije potpun."
        : "Susjednim satovima nedostaje vjetar, pa zalet nije potpun.",
    );
  }

  if (!razlozi.length) razlozi.push("Vjetar je izmjeren, sat nije prognoza.");
  razlozi.push("Perjanicu crta model čestica; širina i doseg nisu provjereni mjerenjem.");

  // Trend: prema dvama prethodnim satovima koji su izračunati. Iznad obaju
  // je „gore”, ispod obaju „bolje”; između ili uz samo jedan sat — stabilno.
  const prethodne = prije
    .slice(0, 2)
    .map((s) => s.razina)
    .filter((r): r is Razina => r !== null);
  let trend: Trend = "nepoznato";
  if (slika && !nedostupan && prethodne.length) {
    const sad = stupanj(razinaSata);
    const najvisa = Math.max(...prethodne.map(stupanj));
    const najniza = Math.min(...prethodne.map(stupanj));
    trend = sad > najvisa ? "gore" : sad < najniza ? "bolje" : "stabilno";
  }

  // Sljedeća promjena: prvi sljedeći sat čija se razina razlikuje. Sat koji
  // još nije izračunat prekida potragu — ne obećava se ono što se ne zna.
  let promjena: Situacija["promjena"] = null;
  if (slika && !nedostupan) {
    for (const s of poslije) {
      if (s.razina === null) break;
      if (s.razina !== razinaSata) {
        promjena = { sat: s.sat, razina: s.razina };
        break;
      }
    }
  }

  return {
    sat: kadar.sat,
    vrsta: kadar.vrsta,
    razina: razinaSata,
    podrucja,
    nosi,
    trend,
    pouzdanost,
    razlozi,
    promjena,
    izvorVjetra: kadar.izvor,
  };
}

/**
 * Rečenica ispod naslova kad perjanica ne dotiče naselja.
 *
 * Kad je pouzdanost niska, naslov kaže „Ne znamo pouzdano”, a ova rečenica
 * kaže **zašto** — i mora reći isti razlog koji stoji među razlozima iza
 * „zašto?”. Do 4. 9. 2026. stajalo je jedno te isto („Model za ovaj sat nema
 * pouzdan vjetar”) i za tišinu na postaji 1,1 km od kvarta, pa je kartica
 * na jednom mjestu tvrdila da vjetar nije izmjeren, a na drugom da jest.
 * Razlog se bira po istom redu po kojem `izvediSituaciju` spušta
 * pouzdanost: tišina i promjenjiv smjer prije svega (oni je ruše na
 * „nisku” bez obzira na izvor), pa prognoza, pa model, pa rupe u zaletu.
 *
 * Args:
 *   situacija: Sažetak sata.
 *   kadar: Kadar iz kojega je izveden; treba samo vrsta i vjetar.
 *
 * Returns:
 *   Rečenica za razinu „nema”; `null` kad naselja jesu dotaknuta (tada
 *   naslov nosi razinu i podnaslov ne treba).
 */
export function podnaslov(
  situacija: Pick<Situacija, "razina" | "pouzdanost" | "izvorVjetra">,
  kadar: Pick<KadarSituacije, "vrsta" | "vjetar" | "pomak">,
): string | null {
  if (situacija.razina !== "nema") return null;
  if (situacija.pouzdanost !== "niska") return "Perjanica ne dotiče nijedno naselje oko plohe.";
  const v = kadar.vjetar;
  if (v?.tisina) {
    return "Tišina: vjetar ispod 0,5 m/s ne nosi zrak nikamo određeno, pa „ništa” ne znači „čisto”.";
  }
  if (v?.promjenjiv) {
    return "Postaja javlja promjenjiv smjer, pa se ne zna kamo zrak ide; „ništa” ne znači „čisto”.";
  }
  if (kadar.vrsta === "prognoza") {
    return `Prognoza ${kadar.pomak} h unaprijed: vjetar je iz modela, ne s postaje, pa „ništa” ne znači „čisto”.`;
  }
  if (situacija.izvorVjetra === "model") {
    return "Vjetar za ovaj sat nije izmjeren nego uzet iz modela, pa „ništa” ne znači „čisto”.";
  }
  return "Zalet ovog sata nije potpun, pa „ništa” ne znači „čisto”.";
}
