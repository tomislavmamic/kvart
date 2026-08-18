export const NEIGHBORHOODS = {
  dracevac: "Dračevac",
  bilice: "Bilice",
} as const;

export type Neighborhood = keyof typeof NEIGHBORHOODS;

export const CATEGORIES = {
  promet: "Promet i sigurnost",
  ceste: "Ceste i nogostupi",
  voda: "Vodovod i odvodnja",
  rasvjeta: "Javna rasvjeta",
  zelenilo: "Zelenilo i javne površine",
  otpad: "Otpad",
  urbanizam: "Urbanizam i gradnja",
  ostalo: "Ostalo",
} as const;

export type Category = keyof typeof CATEGORIES;

/**
 * Jačina mirisa u dojavi, od najslabije prema najjačoj. Poredak je nosiv —
 * ruža dojava i usporedba s modelom računaju s njim, pa se ne smije presložiti.
 */
export const ODOUR_STRENGTHS = {
  slabo: "Slabo — primijetim ako obratim pozornost",
  osjetno: "Osjetno — jasno se prepoznaje",
  jako: "Jako — smeta i unutra",
  nepodnosivo: "Nepodnošljivo — zatvaram prozore",
} as const;

export type OdourStrength = keyof typeof ODOUR_STRENGTHS;

/** Kratka imena za grafikone, gdje cijela rečenica ne stane. */
export const ODOUR_STRENGTH_SHORT: Record<OdourStrength, string> = {
  slabo: "slabo",
  osjetno: "osjetno",
  jako: "jako",
  nepodnosivo: "nepodnošljivo",
};

export const STATUSES = {
  objavljeno: "Objavljeno",
  poslano_gradu: "Poslano gradu",
  u_tijeku: "U tijeku",
  rijeseno: "Riješeno",
  odbijeno: "Odbijeno",
  na_cekanju: "Na čekanju",
} as const;

export type Status = keyof typeof STATUSES;

/** Tailwind classes per status, used for badges. */
export const STATUS_COLORS: Record<Status, string> = {
  objavljeno: "bg-sky-100 text-sky-800",
  poslano_gradu: "bg-violet-100 text-violet-800",
  u_tijeku: "bg-amber-100 text-amber-800",
  rijeseno: "bg-emerald-100 text-emerald-800",
  odbijeno: "bg-rose-100 text-rose-800",
  na_cekanju: "bg-zinc-200 text-zinc-700",
};

export const SITE_NAME = "Naš kvart — Dračevac i Bilice";
export const SITE_DESCRIPTION =
  "Razgovaraj sa susjedima, istraži kvart, prati Karepovac te prijavi ili pregledaj probleme.";
