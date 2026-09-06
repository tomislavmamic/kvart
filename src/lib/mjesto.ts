/**
 * Mjesto dojave: koliko točno smije biti i gdje uopće smije biti.
 *
 * Dvije stvari koje se ovdje sudaraju. Model raspršenja ima razlučivost od
 * nekoliko stotina metara — točnija koordinata ne bi rekla ništa više o
 * zraku. Ali točna koordinata iz preglednika govori i o dojavitelju: na
 * desetak metara, to je kuća. Zato se zaokružuje **prije** spremanja, pa
 * točnijeg zapisa nigdje ni nema.
 *
 * (Isti postupak je drugdje u projektu bio pogreška: koordinata mjerne
 * postaje bila je zaokružena na tri decimale i promašila stvarnu točku za
 * 72 m. Razlika je u tome što se ondje zaokruživalo mjesto koje se zna, a
 * ovdje mjesto koje se ne smije znati.)
 */

/** Koliko decimala ostaje; treća je ~111 m po širini i ~81 m po dužini. */
const DECIMALA = 3;

/**
 * Okvir unutar kojeg dojava ima smisla: kvart i okolica, s rubom.
 *
 * Dojava iz Zagreba nije dojava o Karepovcu nego pogreška ili šala, a jedna
 * takva točka razvukla bi svaku kartu koja se na dojave osloni.
 */
export const OKVIR_DOJAVE = {
  jug: 43.45,
  sjever: 43.6,
  zapad: 16.35,
  istok: 16.65,
} as const;

/**
 * Što okvir doista obuhvaća, riječima za obrazac: od Kaštela do Stobreča i
 * Solina, ne samo Dračevac i Bilice. Obrazac je nekad tvrdio da bilježi samo
 * kvart, a odbijao je tek Zagreb — rečenica mora govoriti ono što kod radi.
 */
export const OPIS_OKVIRA = "Split s okolicom, od Kaštela do Stobreča";

export type Mjesto = { lat: number; lng: number };

/**
 * Zaokružuje mjesto na ~100 m.
 *
 * @param mjesto Koordinate iz preglednika ili s karte.
 * @returns Zaokružene koordinate.
 */
export function zaokruziMjesto(mjesto: Mjesto): Mjesto {
  const k = 10 ** DECIMALA;
  return {
    lat: Math.round(mjesto.lat * k) / k,
    lng: Math.round(mjesto.lng * k) / k,
  };
}

/** Je li mjesto unutar okvira u kojem dojava uopće nešto znači. */
export function uOkviru(mjesto: Mjesto): boolean {
  return (
    Number.isFinite(mjesto.lat) &&
    Number.isFinite(mjesto.lng) &&
    mjesto.lat >= OKVIR_DOJAVE.jug &&
    mjesto.lat <= OKVIR_DOJAVE.sjever &&
    mjesto.lng >= OKVIR_DOJAVE.zapad &&
    mjesto.lng <= OKVIR_DOJAVE.istok
  );
}

/**
 * Čita mjesto iz obrasca; vraća `null` kad ga nema ili nije upotrebljivo.
 *
 * Mjesto je dobrodošlo, ali nije uvjet: dojava bez njega i dalje nosi sat i
 * jačinu, a to je ono što ruži treba.
 */
export function procitajMjesto(
  lat: unknown,
  lng: unknown,
): Mjesto | null {
  if (lat === null || lat === undefined || lat === "") return null;
  if (lng === null || lng === undefined || lng === "") return null;
  const mjesto = { lat: Number(lat), lng: Number(lng) };
  if (!uOkviru(mjesto)) return null;
  return zaokruziMjesto(mjesto);
}
