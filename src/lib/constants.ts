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
  "Građanska inicijativa stanovnika splitskih kvartova Dračevac i Bilice: prijavite problem, pratite status i pridružite se raspravi.";
