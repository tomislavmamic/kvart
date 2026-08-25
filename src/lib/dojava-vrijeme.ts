/**
 * Dan i sat dojave — račun koji obrazac radi prije nego što išta pošalje.
 *
 * Stoji izvan sučelja jer je to jedini dio obrasca koji može tiho pogriješiti:
 * sat u budućnosti, sat koji prijelaz na ljetno vrijeme preskoči, ili „jučer”
 * u pola jedan noću. Dojava s krivim satom nije loša dojava nego kriva — spoji
 * se s tuđim vjetrom i pokvari ružu, a nitko to poslije ne može razlučiti.
 *
 * Vrijeme se bira satom i minutom, kao na budilici. Minuta nije sitničarenje:
 * epizoda koja počne u 14.50 i traje petnaest minuta prelazi u sljedeći sat,
 * pa se mora spojiti s vjetrom **oba** sata. Dok se biralo samo „14–15 h”, ta
 * se epizoda cijela pripisivala prvom satu.
 */

/** Korak minutnog kotačića; sitnije od ovoga nitko ne pamti. */
export const KORAK_MINUTA = 5;

/** Dvoznamenkasti ispis sata ili minute, kao na budilici. */
export function dvoznamenkasto(broj: number): string {
  return String(broj).padStart(2, "0");
}

/**
 * Minute koje obrazac smije ponuditi za odabrani dan i sat.
 *
 * U tekućem satu ne postoji minuta koja još nije došla.
 */
export function minuteZaSat(
  danas: boolean,
  sat: number,
  sada: Date = new Date(),
): number[] {
  const sve = Array.from(
    { length: 60 / KORAK_MINUTA },
    (_, i) => i * KORAK_MINUTA,
  );
  if (!danas || sat < sada.getHours()) return sve;
  return sve.filter((m) => m <= sada.getMinutes());
}

/**
 * Sati koje obrazac smije ponuditi za odabrani dan.
 *
 * Danas se ne može javiti sat koji još nije došao; jučer stoji cijeli.
 *
 * @param danas Je li odabran današnji dan.
 * @param sada Trenutak od kojega se računa.
 */
export function satiZaDan(danas: boolean, sada: Date = new Date()): number[] {
  const najveci = danas ? sada.getHours() : 23;
  return Array.from({ length: najveci + 1 }, (_, i) => i);
}

/**
 * Trenutak iz odabranog dana i sata, u mjesnom vremenu preglednika.
 *
 * Dan se pomiče oduzimanjem od datuma, ne od milisekundi: dan prijelaza na
 * ljetno vrijeme nema 24 sata, pa bi oduzimanje 86 400 000 ms promašilo sat.
 *
 * @param danas Je li odabran današnji dan.
 * @param sat Sat, 0–23.
 * @param minuta Minuta unutar sata, 0–59.
 * @param sada Trenutak od kojega se računa.
 */
export function uTrenutak(
  danas: boolean,
  sat: number,
  minuta: number = 0,
  sada: Date = new Date(),
): Date {
  const d = new Date(sada);
  if (!danas) d.setDate(d.getDate() - 1);
  d.setHours(sat, minuta, 0, 0);
  return d;
}

/**
 * Je li odabrani trenutak unutar dopuštenog razdoblja.
 *
 * @param trenutak Odabrani početak.
 * @param danaUnatrag Koliko dana unatrag obrazac dopušta.
 * @param sada Trenutak od kojega se računa.
 */
export function uRasponu(
  trenutak: Date,
  danaUnatrag: number,
  sada: Date = new Date(),
): boolean {
  if (trenutak.getTime() > sada.getTime() + 3_600_000) return false;
  return trenutak.getTime() >= sada.getTime() - danaUnatrag * 86_400_000;
}
