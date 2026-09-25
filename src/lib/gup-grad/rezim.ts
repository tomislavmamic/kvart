/**
 * Planski režim čestice: gradi li se po GUP-u, po planu užeg područja koji je
 * na snazi, ili nova gradnja čeka plan koji GUP propisuje, a nije donesen.
 *
 * Namjena sama ne kaže može li se na slobodnoj čestici graditi. Gdje je na
 * snazi UPU, DPU ili stari PUP, gradi se po njemu (a on može biti stroži od
 * GUP-a: UPU Bilice II–Mostine iz 1998. dopušta stanovanje na najviše 25 %
 * zone). Gdje GUP propisuje izradu plana užeg područja, a plana nema:
 *
 *  - GUP 2006./2015. (Sl. gl. 1/06, 55/14, čl. 104–105): u nisko
 *    konsolidiranim područjima (urbana pravila 3.x) gradi se samo na temelju
 *    propisanog plana; u konsolidiranim i temeljem GUP-a. Do donošenja plana
 *    dopuštene su samo ulice i infrastruktura (čl. 105).
 *  - Prijedlog 2025. (čl. 103): obvezni su samo planovi za neuređene dijelove
 *    neizgrađenog građevinskog područja, urbanu preobrazbu i urbanu sanaciju
 *    (ispune na listu 4.d); ostali obuhvati su preporuka i do plana se gradi
 *    neposrednom provedbom GUP-a (st. 4).
 *
 * Bitovi dolaze s listova 4.c/4.d (scripts/gup-grad/planski-rezim.py).
 */
import type { Godina, KodKlase } from "./model";

/** Bitovi s lista, isti kao u scripts/gup-grad/planski-rezim.py. */
export const REZIM = {
  VAZECI: 1,
  OBVEZA: 2,
  SANACIJA: 4,
  PREOBRAZBA: 8,
  NEUREDENO: 16,
  MARJAN: 32,
} as const;

export type PlanskiRezim =
  /** Gradi se neposrednom provedbom GUP-a. */
  | "neposredno"
  /** Na snazi je plan užeg područja; gradi se po njemu, ne po GUP-u. */
  | "vazeci"
  /** GUP propisuje plan užeg područja koji nije donesen; nova gradnja čeka. */
  | "ceka";

/** Prijedlog 2025.: vrsta područja iz lista 4.d zbog koje gradnja čeka UPU. */
export type PodrucjeCekanja = "sanacija" | "preobrazba" | "neuredeno";

export interface Rezim {
  rezim: PlanskiRezim;
  /** Samo za „ceka” u prijedlogu 2025. */
  podrucje?: PodrucjeCekanja;
  /** Kratko objašnjenje za kartu: zašto baš taj režim. */
  razlog: string;
  /** Odredba ili list na kojem to piše: navod GUP-a (src/lib/gup-dokument/navodi.ts) i kako ga nazvati. */
  navod?: string;
  izvor?: string;
}

/**
 * Zone u kojima slobodno zemljište znači mjesto za novu zgradu, pa režim
 * mijenja koliko ga je za gradnju. U zelenilu, športu i ulicama slobodno je
 * slobodno bez obzira na planove užeg područja.
 */
const GRADEVNE: readonly KodKlase[] = ["S", "M/K5", "I/K", "D", "T"];
export const rezimVrijedi = (kod: KodKlase) => GRADEVNE.includes(kod);

const NEPOSREDNO: Rezim = { rezim: "neposredno", razlog: "neposredna provedba GUP-a" };

/** Nisko konsolidirano područje urbanog pravila (3.1–3.6). */
export function niskoKonsolidirano(kodPravila: string | null): boolean {
  return !!kodPravila && kodPravila.startsWith("3.");
}

export function planskiRezim(bitovi: number, godina: Godina, kodPravila: string | null): Rezim {
  if (bitovi & REZIM.VAZECI)
    return {
      rezim: "vazeci",
      razlog: "na snazi je plan užeg područja (UPU, DPU ili PUP)",
      navod: { 2006: "list-vazeci-planovi-2008", 2015: "list-vazeci-planovi-2014", 2025: "list-planske-mjere-2025" }[godina],
      izvor: "list 4.d",
    };
  if (godina === 2025) {
    const clanak103 = { navod: "obveza-plana-2025", izvor: "prijedlog 2025., čl. 103" };
    if (bitovi & REZIM.SANACIJA)
      return { rezim: "ceka", podrucje: "sanacija", razlog: "područje urbane sanacije — gradnja tek po UPU-u", ...clanak103 };
    if (bitovi & REZIM.PREOBRAZBA)
      return { rezim: "ceka", podrucje: "preobrazba", razlog: "područje urbane preobrazbe — gradnja tek po UPU-u", ...clanak103 };
    if (bitovi & REZIM.NEUREDENO)
      return { rezim: "ceka", podrucje: "neuredeno", razlog: "neuređeni dio građevinskog područja — gradnja tek po UPU-u", ...clanak103 };
    if (bitovi & REZIM.OBVEZA)
      return {
        rezim: "neposredno",
        razlog: "UPU je samo preporučen — do njega neposredna provedba GUP-a",
        navod: "preporuka-plana-2025",
        izvor: "prijedlog 2025., čl. 103. st. 4",
      };
    return NEPOSREDNO;
  }
  const g = godina === 2006 ? "2006" : "2015";
  if (bitovi & REZIM.MARJAN)
    return { rezim: "ceka", razlog: "Marjan — čeka prostorni plan područja posebnih obilježja", navod: `marjan-${g}`, izvor: "čl. 105" };
  if (bitovi & REZIM.OBVEZA) {
    if (niskoKonsolidirano(kodPravila))
      return {
        rezim: "ceka",
        razlog: "propisan je plan užeg područja koji nije donesen; u nisko konsolidiranom području gradnja tek po njemu",
        navod: `obveza-plana-${g}`,
        izvor: "čl. 104–105",
      };
    return {
      rezim: "neposredno",
      razlog: "propisan je plan užeg područja, ali u konsolidiranom području gradi se i po GUP-u",
      navod: `obveza-plana-${g}`,
      izvor: "čl. 104",
    };
  }
  return NEPOSREDNO;
}
