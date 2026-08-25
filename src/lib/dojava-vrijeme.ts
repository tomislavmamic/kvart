/**
 * Dan i sat dojave — račun koji obrazac radi prije nego što išta pošalje.
 *
 * Stoji izvan sučelja jer je to jedini dio obrasca koji može tiho pogriješiti:
 * sat u budućnosti, sat koji prijelaz na ljetno vrijeme preskoči, ili „jučer”
 * u pola jedan noću. Dojava s krivim satom nije loša dojava nego kriva — spoji
 * se s tuđim vjetrom i pokvari ružu, a nitko to poslije ne može razlučiti.
 */

/** Ispisuje sat kao raspon, da se vidi da dojava pokriva cijeli sat. */
export function imeSata(sat: number): string {
  return `${String(sat).padStart(2, "0")}–${String((sat + 1) % 24).padStart(2, "0")} h`;
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
 * @param sat Puni sat, 0–23.
 * @param sada Trenutak od kojega se računa.
 */
export function uTrenutak(danas: boolean, sat: number, sada: Date = new Date()): Date {
  const d = new Date(sada);
  if (!danas) d.setDate(d.getDate() - 1);
  d.setHours(sat, 0, 0, 0);
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
