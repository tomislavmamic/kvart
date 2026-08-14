/**
 * Vremeplov: rez između dviju snimaka istog mjesta u različitim godinama.
 *
 * Zašto rez, a ne klizač kroz niz godina. Provjerene su tri epohe — HOK
 * (otprilike 1970-e), DOF 2011. i DOF 2023. — i razmaknute su neravnomjerno.
 * Vremenska crta kroz njih obećava gustoću podataka koje nema; susjed koji
 * povuče klizač očekuje da će vidjeti i 2015. i 2018., a ondje nema ničega.
 * Rez između dvije IZABRANE godine ne obećava ništa što ne isporučuje.
 *
 * Zadano je 2011. ⇄ 2023., jer je to razdoblje u kojem je radna zona i
 * nastala — dakle jedini par na kojem se u kvartu doista nešto vidi.
 *
 * Modul je namjerno bez Leafleta i bez DOM-a: sve što ovdje stoji je odluka o
 * stanju, pa se da ispitati bez karte (vidi tests/vremeplov.test.ts).
 */
import type { BaseLayer } from "./map-views";

export interface Vremeplov {
  /** Podloga lijevo od razdjelnika — starija. */
  lijevo: string;
  /** Podloga desno od razdjelnika — novija. */
  desno: string;
}

/** Podloge koje uopće mogu ući u vremeplov: samo snimke s godinom. */
export function snimke(podloge: BaseLayer[]): BaseLayer[] {
  return podloge
    .filter((b) => b.godina !== undefined)
    .sort((a, b) => (a.godina ?? 0) - (b.godina ?? 0));
}

/**
 * Može li se vremeplov uopće ponuditi.
 *
 * Za rez trebaju dvije snimke. S jednom bi biralo postojalo, a pritisak na
 * njega ne bi mogao dati ništa — gore od izostanka.
 */
export function vremeplovMoguc(podloge: BaseLayer[]): boolean {
  return snimke(podloge).length >= 2;
}

/**
 * Zadani par: najstarija i najnovija snimka.
 *
 * Returns:
 *   Par podloga ili `null` ako ih nema dovoljno.
 */
export function zadaniVremeplov(podloge: BaseLayer[]): Vremeplov | null {
  const s = snimke(podloge);
  if (s.length < 2) return null;
  return { lijevo: s[0].id, desno: s[s.length - 1].id };
}

/**
 * Prihvaća par samo ako obje strane postoje i nisu ista podloga.
 *
 * Ista podloga s obje strane je rez koji ništa ne dijeli: razdjelnik se vidi,
 * povlači se, a slika se ne mijenja. To je kvar koji izgleda kao kvar karte.
 *
 * Args:
 *   podloge: Registar podloga.
 *   par: Kandidat, obično iz adrese.
 *
 * Returns:
 *   Isti par ako je valjan, inače `null`.
 */
export function valjanVremeplov(
  podloge: BaseLayer[],
  par: Vremeplov | null,
): Vremeplov | null {
  if (!par || par.lijevo === par.desno) return null;
  const dopustene = new Set(snimke(podloge).map((b) => b.id));
  if (!dopustene.has(par.lijevo) || !dopustene.has(par.desno)) return null;
  return par;
}

/**
 * Zamjena jedne strane, uz čuvanje pravila da strane moraju biti različite.
 *
 * Kad se odabere podloga koja već stoji nasuprot, strane se ZAMIJENE umjesto
 * da se odabir odbije. Odbijanje bi bio pritisak koji ne radi ništa; zamjena
 * je ono što je čovjek i htio — vidjeti isti par okrenut.
 */
export function postaviStranu(
  par: Vremeplov,
  strana: "lijevo" | "desno",
  podlogaId: string,
): Vremeplov {
  const druga = strana === "lijevo" ? par.desno : par.lijevo;
  if (podlogaId === druga) return { lijevo: par.desno, desno: par.lijevo };
  return { ...par, [strana]: podlogaId };
}

/** Zapis para u adresu: „starija,novija”. */
export function uAdresu(par: Vremeplov): string {
  return `${par.lijevo},${par.desno}`;
}

/**
 * Čitanje para iz adrese.
 *
 * Args:
 *   podloge: Registar podloga.
 *   vrijednost: Sadržaj parametra `vremeplov`, ako ga adresa ima.
 *
 * Returns:
 *   Valjan par ili `null` — neispravna adresa gasi vremeplov, ne ruši kartu.
 */
export function izAdrese(
  podloge: BaseLayer[],
  vrijednost: string | null,
): Vremeplov | null {
  if (!vrijednost) return null;
  const [lijevo, desno] = vrijednost.split(",");
  if (!lijevo || !desno) return null;
  return valjanVremeplov(podloge, { lijevo, desno });
}

/**
 * Natpis strane za `aria-valuetext` razdjelnika.
 *
 * „62 %” nikome ništa ne znači; „62 %, lijevo Ortofoto 2011., desno Ortofoto
 * (DOF 2023)” je ono što se zapravo gleda. Isti razlog kao kod klizača
 * namjene.
 */
export function natpisPodloge(podloge: BaseLayer[], id: string): string {
  return podloge.find((b) => b.id === id)?.label ?? id;
}
