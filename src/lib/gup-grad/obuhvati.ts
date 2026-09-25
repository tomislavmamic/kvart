/**
 * Planovi užeg područja s lista 4.d prijedloga GUP-a 2025. (scripts/gup-grad/
 * planski-obrisi.py → public/geo/gup-grad/planski-rezim-2025.geojson): što
 * se o planu da reći iz onoga što list nosi.
 */

export interface SvojstvaObuhvata {
  vrsta: "vazeci" | "propisan";
  /** redni broj u popisu svoje vrste u legendi lista */
  broj: number;
  naziv: string;
  ha: number;
  tocka: [number, number];
  /** važeći: brojevi Službenog glasnika Grada Splita, kako ih legenda nabraja */
  glasnik?: string;
  /** propisani: koliko obuhvata je u području gdje nova gradnja čeka plan */
  sanacija_ha?: number;
  preobrazba_ha?: number;
  neuredeno_ha?: number;
}

export interface Objave {
  /** godina prve objave: donošenje plana */
  donesen: number | null;
  /** godine kasnijih izmjena, bez pročišćenih tekstova i ispravaka */
  izmjene: number[];
}

/**
 * „12/09, 61/18, 1/19-ispravak, 2/19-pročišćeni tekst” → donesen 2009.,
 * izmjene [2018]. Broj glasnika zna biti i „2-98” ili „6-II/90”.
 */
export function objave(glasnik: string | undefined): Objave {
  const godine = (glasnik ?? "")
    .split(",")
    .map((dio) => {
      const m = dio.match(/\d+(?:-[IVX]+)?[/-](\d{2})\b/);
      if (!m) return null;
      const gg = Number(m[1]);
      return { godina: gg >= 50 ? 1900 + gg : 2000 + gg, izmjena: !/pročišćen|ispravak/i.test(dio) };
    })
    .filter((x) => x !== null);
  if (!godine.length) return { donesen: null, izmjene: [] };
  const [prva, ...ostale] = godine;
  const izmjene = [...new Set(ostale.filter((x) => x.izmjena).map((x) => x.godina))];
  return { donesen: prva.godina, izmjene };
}

/** Propisani plan: koliko obuhvata čeka plan, a koliko se do plana gradi po GUP-u. */
export function cekanje(s: SvojstvaObuhvata): { ceka: number; poGupu: number } {
  const ceka = (s.sanacija_ha ?? 0) + (s.preobrazba_ha ?? 0) + (s.neuredeno_ha ?? 0);
  return { ceka: Math.min(ceka, s.ha), poGupu: Math.max(0, s.ha - ceka) };
}
