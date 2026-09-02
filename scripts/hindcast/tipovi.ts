/**
 * Zajednički oblici podataka za povijesnu provjeru (hindcast) modela.
 *
 * Sve što provjera radi — učitavanje ulaza, vrtnja modela, ocjena — govori
 * ovim tipovima. Pravila koja vrijede posvuda:
 *
 * - **Vrijeme** je početak punog sata u UTC-u, kao `Date.toISOString()`:
 *   `2026-08-27T18:00:00.000Z`. Nikad mjesno, nikad kraj sata.
 * - **Smjer** je meteorološki, iz kojega puše, u stupnjevima 0–360.
 * - **Brzina** je u m/s na 10 m (ili na visini anemometra postaje).
 * - **Dubina** je debljina miješanog sloja u metrima, mjerena od tla.
 * - **Koncentracije** su u µg/m³; gustoća modela je u jedinicama
 *   `Simulacija.crtaj` (bezdimenzionalna, vidi `src/lib/dim.ts`).
 * - Svaki ulaz nosi **izvor**; sat bez izvora nije nula nego `null`.
 *
 * Ništa ovdje ne smije uvoziti iz preglednika ni iz Nexta: provjera se vrti
 * u Nodeu, u radnim nitima.
 */

/** Odakle vjetar za pojedini sat. `prognoza` je arhivirani Open-Meteo model. */
export type IzvorVjetraHindcast =
  | "split3"
  | "split2"
  | "marjan"
  | "ldsp"
  | "vrboran"
  | "era5"
  | "prognoza";

export type VjetarSata = {
  readonly smjerOd: number;
  readonly brzina: number;
  readonly izvor: IzvorVjetraHindcast;
  /** Smjer s jedne postaje, brzina s druge (kao `spoj` u `scripts/vjetar.py`). */
  readonly izvorBrzine?: IzvorVjetraHindcast;
};

export type DubinaSata = {
  readonly m: number;
  readonly izvor: "prognoza" | "era5";
};

/** Okolnosti koje model zasad ne koristi, ali ih provjera nosi uz sat. */
export type OkolnostiSata = {
  /** Kratkovalno zračenje na tlu, W/m². */
  readonly sunce: number | null;
  /** Naoblaka, %. */
  readonly oblaci: number | null;
  /** Temperatura na 2 m, °C. */
  readonly temperatura: number | null;
  /** Oborina u satu, mm. */
  readonly oborina: number | null;
  readonly izvor: "prognoza" | "era5";
};

/** Jedan sat ulaza u model, s podrijetlom svakog dijela. */
export type SatUlaza = {
  readonly sat: string;
  readonly vjetar: VjetarSata | null;
  readonly dubina: DubinaSata | null;
  readonly okolnosti: OkolnostiSata | null;
};

/**
 * Pravilo kojim se bira vjetar po satu.
 *
 * - `proizvodnja`: isto što i stranica — izmjereni AZO niz (Split-3, pa
 *   Split-2), a gdje ga nema, arhivirani model. Dubina uvijek modelska.
 * - `spoj`: smjer sa Split-3/Marjana/LDSP-a redom, brzina s Marjana/LDSP-a/
 *   ERA5 redom (kao `scripts/vjetar.py`).
 * - Pojedinačni izvori, za usporedbu.
 */
export type PraviloVjetra =
  | "proizvodnja"
  | "spoj"
  | "split3"
  | "marjan"
  | "ldsp"
  | "prognoza"
  | "era5";

export type Opazanje = {
  readonly sat: string;
  /** µg/m³. */
  readonly vrijednost: number;
  readonly ispodGranice: boolean;
  readonly izvor: "azo308" | "zavod-k1" | "zavod-k2";
};

export type Prijemnik = {
  readonly ime: string;
  readonly lat: number;
  readonly lon: number;
  readonly opis: string;
};

/** Satno opažanje iz dojave, razloženo po satima i dojavitelju. */
export type DojavaSat = {
  readonly sat: string;
  readonly prijemnik: string;
  readonly smrdi: boolean;
  /** 0 kad ne smrdi; inače težina iz `TEZINA` u `src/lib/dojave.ts`. */
  readonly tezina: number;
  readonly dojavitelj: string;
  readonly idDojave: number;
};

export type Opazanja = {
  /** Po satu; više izvora za isti sat ide u niz. */
  readonly h2s: readonly Opazanje[];
  readonly merkaptani: readonly Opazanje[];
  readonly dojave: readonly DojavaSat[];
};

/** Što je model rekao za jedan sat na jednom prijemniku. */
export type Predikcija = {
  readonly sat: string;
  readonly prijemnik: string;
  /** Gustoća H₂S-ove perjanice, jedinice `crtaj`, prosjek 3×3 ćelije. */
  readonly gustoca: number;
  /** Ista gustoća s merkaptanskim profilom izvora. */
  readonly merkaptani: number;
};

export type Razdoblje = { readonly od: string; readonly do: string };

/** Uloga razdoblja u provjeri; skup za ugađanje nikad nije i skup za ocjenu. */
export type Uloga = "ugadjanje" | "provjera" | "zadrzano";

export type Epizoda = {
  readonly id: string;
  readonly naziv: string;
  readonly razdoblje: Razdoblje;
  readonly uloga: Uloga;
  /** Zašto je epizoda u knjižnici: jak miris, tišina, promjena vjetra… */
  readonly vrsta: readonly string[];
  readonly opis: string;
};
