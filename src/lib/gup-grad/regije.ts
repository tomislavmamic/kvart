/**
 * Regije piksela u pločicama „dijelova čestice” (scripts/gup-grad/regije.py):
 * što je na kojem mjestu čestice, na rešetki od 2 m. Brojevi su u kanalu G
 * pločice; R je klasa namjene (model.ts, `indeks`).
 */
export const REGIJE = {
  zgrada: 1,
  gradiliste: 2,
  ulica: 3,
  parkiraliste: 4,
  javna: 5,
  uredjeno: 6,
  infrastruktura: 7,
  zelenilo: 8,
  okucnica: 9,
  slobodno: 10,
  usko: 11,
  premalo: 12,
  zabranjeno: 13,
  neizgradivo: 14,
  /** Slobodno i široko, ali nova gradnja čeka propisani plan užeg područja (rezim.ts). */
  ceka: 15,
} as const;

export type Regija = (typeof REGIJE)[keyof typeof REGIJE];
