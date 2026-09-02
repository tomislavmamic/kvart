/**
 * Razred stabilnosti atmosfere po Turnerovoj shemi (Pasquill A–F).
 *
 * Model raspršenja dosad nije znao je li dan ili noć: prorjeđivanje uvis
 * (`raspad` u `dim.ts`) bilo je jednako pod ljetnim suncem i pod noćnom
 * inverzijom. A upravo ta razlika odlučuje hoće li se zrak s plohe
 * razrijediti za dvadeset minuta ili ostati pri tlu satima — u Briggsovim
 * izrazima σ_z raste desetak puta brže u razredu A nego u F.
 *
 * Isti izračun stoji u `scripts/oblacici.py` (`razred_stabilnosti`), gdje je
 * na dvije godine mjerenja pokazao da razred sam objašnjava više od starog
 * prijenosa. Ovdje je prepisan znak po znak, da se dva modela ne raziđu.
 *
 * Ulazi su ono što Open-Meteo daje po satu: kratkovalno zračenje na tlu
 * (W/m²) i naoblaka (%). Bez njih razred ostaje neutralan (D) — model se
 * tada ponaša kao prije, i to se vidi u `izvor` razreda.
 */

/** Razredi A–F kao 0–5; A je najnestabilniji, F najstabilniji. */
export const RAZREDI = "ABCDEF" as const;

/** Neutralan razred; vrijedi kad okolnosti nisu poznate. */
export const NEUTRALNO = 3;

/**
 * Pasquillov razred stabilnosti po Turnerovoj shemi.
 *
 * Args:
 *   brzina: Brzina vjetra na 10 m, u m/s.
 *   sunce: Kratkovalno zračenje na tlu, u W/m².
 *   oblaci: Naoblaka, u postotcima.
 *
 * Returns:
 *   Broj 0–5 za razrede A–F.
 */
export function razredStabilnosti(brzina: number, sunce: number, oblaci: number): number {
  let stupac: readonly number[];
  if (sunce > 10) {
    if (sunce > 700) stupac = [0, 0, 1, 2, 2];
    else if (sunce > 350) stupac = [1, 1, 2, 3, 3];
    else stupac = [1, 2, 2, 3, 3];
  } else if (oblaci >= 50) {
    stupac = [4, 4, 3, 3, 3];
  } else {
    stupac = [5, 5, 4, 3, 3];
  }
  const redak = brzina < 2 ? 0 : brzina < 3 ? 1 : brzina < 5 ? 2 : brzina < 6 ? 3 : 4;
  return stupac[redak];
}

/**
 * Množitelj koji glatko ide od `nestabilno` (razred A) do `stabilno`
 * (razred F), po logaritmu — jer i sam učinak (brzina rasta σ_z) raste
 * geometrijski od razreda do razreda.
 *
 * Args:
 *   razred: 0–5.
 *   nestabilno: Množitelj u razredu A.
 *   stabilno: Množitelj u razredu F.
 *
 * Returns:
 *   Množitelj za zadani razred; 1 u razredu D kad su oba jednaka 1.
 */
export function mnoziteljRazreda(razred: number, nestabilno: number, stabilno: number): number {
  const r = Math.min(5, Math.max(0, razred));
  // Razred D (3) je sidro: ondje množitelj mora biti 1 ma kakvi bili krajevi,
  // da neutralan dan ostane isti kao prije uvođenja razreda.
  const u = r <= 3 ? (3 - r) / 3 : (r - 3) / 2;
  const kraj = r <= 3 ? nestabilno : stabilno;
  return Math.exp(u * Math.log(Math.max(1e-6, kraj)));
}

/**
 * Vodoravno vrtloženje po razredu A–F, u m²/s — vrijednosti iz
 * `scripts/oblacici.py` (`K_PO_RAZREDU`), ugođene na prvoj godini mjerenja
 * H₂S-a uz plohu i provjerene na drugoj.
 *
 * U stabilnim razredima raste: meandar slabog vjetra kroz sat razmaže
 * perjanicu na stotine metara (uz 120 m²/s σ za sat naraste na ~930 m).
 * Nestabilni razredi drže staru vrijednost od 1 m²/s — ondje konvekcija
 * nosi uvis, ne ustranu.
 */
export const VRTLOZENJE_PO_RAZREDU: readonly number[] = [1, 1, 1, 6, 45, 120];
