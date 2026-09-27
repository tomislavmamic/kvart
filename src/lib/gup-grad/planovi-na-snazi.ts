/**
 * Planovi na snazi: odluka o donošenju i odredbe koje se vežu uz mjesto na
 * terenu, pa se dade provjeriti jesu li provedene. Ključ je oznaka plana na
 * ISPU-u (svojstvo `ispu` u public/geo/gup-grad/planski-rezim-2025.geojson),
 * a mjesta na karti su u public/geo/gup-grad/elementi-planova.geojson
 * (scripts/gup-grad/elementi-planova.py), pod ključem odredbe.
 */

export interface OdredbaPlana {
  /** kratko, za natpis na karti */
  naslov: string;
  /** doslovno iz odluke */
  citat?: string;
  /** što je nacrtano, kad odluka o tome ne govori posebno */
  opis?: string;
  /** članak i točka odluke */
  gdje?: string;
  /** listovi grafičkog dijela na kojima je nacrtana */
  listovi: string;
  /** koliko je stabala nacrtano: toliko je točaka u elementi-planova.geojson */
  stabala: number;
}

export interface PlanNaSnazi {
  odluka: { naziv: string; url: string };
  odredbe: Record<string, OdredbaPlana>;
}

export const PLANOVI_NA_SNAZI: Record<string, PlanNaSnazi> = {
  // DPU dijela područja Dračevac: jedna građevna čestica (4 597 m²) južno od brze ceste
  DPU5: {
    odluka: {
      naziv: "Odluka o donošenju, Sl. gl. 23/04",
      url: "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?language=hr-HR&Command=Core_Download&EntryId=3559&PortalId=0",
    },
    odredbe: {
      drvored: {
        naslov: "Drvored visokih stablašica",
        citat:
          "Uz južnu granicu parcele zasaditi drvored visokih stablašica (zelenilo u potezu), a kolne otoke zasaditi cvjetnim grmovima.",
        gdje: "čl. 6., t. 2.6. Uređenje građevnih čestica",
        listovi: "2. Promet i 3. Uvjeti korištenja; list 4. Uvjeti gradnje isti drvored crta kao 13 zelenih krugova",
        stabala: 11,
      },
      "stabla-gradevina-2": {
        naslov: "Stabla uz građevinu 2",
        opis: "Odluka ih ne navodi posebno, ali ih plan crta uz južnu i istočnu stranu manje građevine, na istoku čestice.",
        listovi: "2. Promet i 3. Uvjeti korištenja",
        stabala: 8,
      },
    },
  },
};

/** Plan na snazi po oznaci s ISPU-a, ako o njemu znamo više od obuhvata. */
export const planNaSnazi = (ispu: string | undefined): PlanNaSnazi | undefined =>
  ispu ? PLANOVI_NA_SNAZI[ispu] : undefined;

/** „1 stablo”, „3 stabla”, „11 stabala”. */
export function stabala(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} stablo`;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return `${n} stabla`;
  return `${n} stabala`;
}
