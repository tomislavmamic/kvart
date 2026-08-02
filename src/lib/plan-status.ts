/**
 * Koji je GUP na snazi — na jednom mjestu.
 *
 * Dosad je odgovor bio razasut po jedanaest niski: „po GUP-u 2015., na snazi”
 * u dosjeu, „nacrt 2024. (javna rasprava)” u registru slojeva, „povučen je
 * nakon javne rasprave i nije donesen” na /plan. Te tvrdnje su se razišle i
 * ništa ih nije držalo na okupu — a riječ je o tome koji akt pravno vrijedi
 * nad nečijom zemljom.
 *
 * Odsad je to jedna vrijednost s izvorom. Promjena statusa plana je izmjena
 * OVE datoteke, uz navod, i ništa drugo.
 *
 * `izvor` nije ukras. „Ništa bez izvora” je zapisana obveza, a tvrdnja da je
 * neki plan na snazi mijenja ljudima odluke o gradnji. Dok je `izvor` prazan,
 * sučelje navodi godinu plana, ali NE tvrdi da je na snazi — vidi
 * `natpisPlana()`. Radije nepotpuno nego nepotkrijepljeno.
 */

export interface StatusPlana {
  /** Godina lista koji se čita kao važeći. */
  godina: number;
  /** Sloj koji taj list crta. */
  layerId: string;
  /** Putanja do lista, za poslužiteljski dosje. */
  url: string;
  /**
   * Odluka kojom je plan donesen — broj i glasilo. `null` znači da navod
   * još nije upisan, pa se „na snazi” ne izriče.
   */
  izvor: string | null;
}

/** Plan koji se čita kao važeći. */
export const NA_SNAZI: StatusPlana = {
  godina: 2024,
  layerId: "gup-2024-namjena",
  url: "/geo/planovi/gup-2024-namjena.geojson",
  izvor: null,
};

/** Prethodni plan — ostaje da se vidi što se promijenilo. */
export const PRETHODNI: StatusPlana = {
  godina: 2015,
  layerId: "gup-2015-namjena",
  url: "/geo/planovi/gup-2015-namjena.geojson",
  izvor: null,
};

/**
 * Kako se plan navodi uz tvrdnju o namjeni.
 *
 * S navodom: „po GUP-u 2024., na snazi (Službeni glasnik …)”.
 * Bez navoda: „po GUP-u 2024.” — godina se zna, pravni status se ne tvrdi.
 */
export function natpisPlana(p: StatusPlana): string {
  return p.izvor
    ? `po GUP-u ${p.godina}., na snazi (${p.izvor})`
    : `po GUP-u ${p.godina}.`;
}
