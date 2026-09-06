/**
 * Riječi o vremenu uz sat na kartici i traci — računane prema **satu
 * gledatelja**, ne prema satu poslužitelja.
 *
 * Crta nosi `vrsta` („sada”, „izmjereno”, „prognoza”) od trenutka kad je
 * složena. Ta je oznaka istinita samo dok traje taj sat: kartica ostavljena
 * otvorenom, ili crta koja je iz bilo kojeg razloga stigla stara, inače bi
 * pisala „sada” uz sat koji je prošao. Zato riječ uz sat ovdje izlazi iz
 * razlike između sata kadra i sata na zidu gledatelja, a `vrsta` ostaje ono
 * što jest — podatak o tome odakle je vjetar, ne o tome koliko je sati.
 *
 * Isto pravilo služi i za starost očitanja: „prije 12 min” uz vjetar koji
 * vodi kartu govori stanovniku ono što ga jedino zanima — je li ovo od sada
 * ili od jučer.
 */

import { vrhSata } from "@/lib/sim/vrijeme-satno";
import { POSTAJE, type Postaja, type Vjetar } from "@/lib/vjetar";
import type { IzvorVjetra, SatniVjetar } from "@/lib/sim/vrijeme-satno";

/**
 * Nakon koliko se crta smatra zastarjelom: sat traje šezdeset minuta, a pet
 * minuta viška pokriva osvježavanje koje je upravo krenulo.
 */
export const ZASTARJELO_NAKON_MS = 65 * 60_000;

const MJESNO = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const MJESNO_DAN = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  weekday: "short",
  day: "numeric",
  month: "numeric",
});

/** Sat i minute po mjesnom vremenu, „23:05”. */
export function satMjesno(iso: string | Date): string {
  return MJESNO.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Dan po mjesnom vremenu, „čet 4. 9.”. */
export function danMjesno(iso: string | Date): string {
  return MJESNO_DAN.format(typeof iso === "string" ? new Date(iso) : iso);
}

/**
 * Koliko je sati kadar udaljen od sata na zidu gledatelja.
 *
 * Args:
 *   sat: Početak sata kadra, puni ISO 8601.
 *   sadaStvarno: Sat gledatelja.
 *
 * Returns:
 *   Cijeli broj sati; 0 za tekući sat, pozitivno za prošle, negativno za
 *   buduće.
 */
export function razmakSati(sat: string, sadaStvarno: Date): number {
  return Math.round((vrhSata(sadaStvarno).getTime() - Date.parse(sat)) / 3_600_000);
}

/**
 * Riječ uz sat: „sada”, „prije n h” ili „prognoza +n h”, prema satu gledatelja.
 *
 * Args:
 *   kadar: Sat kadra.
 *   sadaStvarno: Sat gledatelja.
 *
 * Returns:
 *   Riječ koja stoji uz sat na kartici, traci i u čitaču zaslona.
 */
export function oznakaSata(kadar: { readonly sat: string }, sadaStvarno: Date): string {
  const razmak = razmakSati(kadar.sat, sadaStvarno);
  if (razmak === 0) return "sada";
  if (razmak > 0) return `prije ${razmak} h`;
  return `prognoza +${-razmak} h`;
}

/**
 * Je li crta starija od jednog sata prema satu gledatelja.
 *
 * Args:
 *   sadaCrte: `Crta.sada`, sat za koji je crta složena.
 *   sadaStvarno: Sat gledatelja.
 */
export function zastarjela(sadaCrte: string, sadaStvarno: Date): boolean {
  return sadaStvarno.getTime() - Date.parse(sadaCrte) > ZASTARJELO_NAKON_MS;
}

/**
 * Što kartica piše umjesto „sada” kad je crta stara: od kada su podaci i
 * koliko je to bilo prije.
 *
 * Args:
 *   sadaCrte: `Crta.sada`.
 *   sadaStvarno: Sat gledatelja.
 *   osvjezavanje: Što se s osvježavanjem događa, da rečenica ne obećava
 *     ono što ne radi.
 */
export function natpisZastarjele(
  sadaCrte: string,
  sadaStvarno: Date,
  osvjezavanje: "u tijeku" | "greska" | "mirno" | null = "u tijeku",
): string {
  const osnova = `podaci od ${satMjesno(sadaCrte)}, ${oznakaSata({ sat: sadaCrte }, sadaStvarno)}`;
  // Bez glagola za čitač zaslona: glagol se mijenja pri svakom pokušaju, a
  // `aria-live` bi svaku promjenu izgovorio iznova.
  if (osvjezavanje === null) return osnova;
  const rep =
    osvjezavanje === "greska"
      ? "osvježavanje nije uspjelo"
      : osvjezavanje === "u tijeku"
        ? "osvježavam…"
        : "osvježit će se";
  return `${osnova} — ${rep}`;
}

/** Je li sat istoga mjesnog dana kao i sat gledatelja; tada datum ne treba. */
export function istiDan(sat: string, sadaStvarno: Date): boolean {
  return MJESNO_DAN.format(new Date(sat)) === MJESNO_DAN.format(sadaStvarno);
}

/**
 * Koliko je očitanje staro, riječima: „prije 4 min”, „prije 2 h”.
 *
 * Args:
 *   opazeno: Trenutak očitanja, ISO 8601.
 *   sadaStvarno: Sat gledatelja.
 */
export function starost(opazeno: string, sadaStvarno: Date): string {
  const minuta = Math.max(0, Math.round((sadaStvarno.getTime() - Date.parse(opazeno)) / 60_000));
  if (minuta < 1) return "upravo sad";
  if (minuta < 60) return `prije ${minuta} min`;
  const sati = Math.floor(minuta / 60);
  if (sati < 24) return `prije ${sati} h`;
  return `prije ${Math.floor(sati / 24)} d`;
}

/**
 * Kratko ime postaje kako stoji uz sat: bez „Neverin.hr” u zagradi i bez
 * „Split-” ispred imena mjesta („Vrboran”, „Marjan”). Brojčane ostaju cijele
 * („Split-3”): samo „3” ne bi značilo ništa.
 */
export function kratkoImePostaje(postaja: Postaja): string {
  return POSTAJE[postaja].oznaka.replace(/\s*\(.*\)$/, "").replace(/^Split-(?=\p{L})/u, "");
}

/**
 * Trenutak očitanja koje vodi kadar, ako je poznat.
 *
 * AZO-ov satni niz nosi sat, ne trenutak; opažanje koje je promaknuto u
 * tekući sat (`dopuniSadasnjim`) nosi trenutak u `sadaOcitanja`.
 */
function opazenoZaIzvor(
  izvor: IzvorVjetra | null,
  sat: string,
  sadaOcitanja: readonly Vjetar[],
  serije: ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>,
): string | null {
  if (!izvor || izvor === "model") return null;
  if (serije.get(izvor)?.has(sat)) return sat;
  return sadaOcitanja.find((o) => o.postaja === izvor)?.opazeno ?? null;
}

/**
 * Najnovije očitanje vjetra s bilo koje postaje, za sat koji vodi model.
 *
 * Kad je vjetar iz modela, stanovnik i dalje pita kad je neka postaja zadnji
 * put javila — to je jedina mjera koliko je „model” daleko od stvarnosti.
 */
export function najnovijeOcitanje(sadaOcitanja: readonly Vjetar[]): Vjetar | null {
  let najnovije: Vjetar | null = null;
  for (const o of sadaOcitanja) {
    if (!najnovije || o.opazeno > najnovije.opazeno) najnovije = o;
  }
  return najnovije;
}

/**
 * Rečenica o izvoru vjetra za odabrani sat, s trenutkom i starošću.
 *
 * Args:
 *   kadar: Sat, vrsta i izvor kadra.
 *   sadaOcitanja: Trenutačna očitanja postaja, ako su stigla.
 *   serije: Satni nizovi po postaji, ako su stigli.
 *   sadaStvarno: Sat gledatelja.
 *
 * Returns:
 *   Npr. „izmjeren 23:35 (prije 12 min), Vrboran”, „izmjeren, Split-3 (satni
 *   prosjek)”, „iz modela; zadnje očitanje Vrboran 23:35 (prije 12 min)” ili
 *   „iz modela (prognoza)”. Kratko, jer mora stati u jedan redak na telefonu.
 */
export function opisIzvoraSata(
  kadar: { readonly sat: string; readonly vrsta: "izmjereno" | "sada" | "prognoza"; readonly izvor: IzvorVjetra | null },
  sadaOcitanja: readonly Vjetar[],
  serije: ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>,
  sadaStvarno: Date,
): string {
  if (kadar.vrsta === "prognoza") return "iz modela (prognoza)";
  if (!kadar.izvor) return "nije poznat";
  if (kadar.izvor === "model") {
    const zadnje = najnovijeOcitanje(sadaOcitanja);
    if (!zadnje) return "iz modela; nijedna postaja ne javlja";
    return `iz modela; zadnje očitanje ${kratkoImePostaje(zadnje.postaja)} ${satMjesno(zadnje.opazeno)} (${starost(zadnje.opazeno, sadaStvarno)})`;
  }
  const ime = kratkoImePostaje(kadar.izvor);
  const opazeno = opazenoZaIzvor(kadar.izvor, kadar.sat, sadaOcitanja, serije);
  if (opazeno === null) return `izmjeren, ${ime}`;
  if (opazeno === kadar.sat) return `izmjeren, ${ime} (satni prosjek)`;
  return `izmjeren ${satMjesno(opazeno)} (${starost(opazeno, sadaStvarno)}), ${ime}`;
}

/**
 * Kratka inačica za skupljenu karticu na telefonu: bez starosti u zagradi,
 * da s satom stane u jedan redak od 346 px („izmjeren 21:50, Vrboran”).
 */
export function opisIzvoraSataKratko(
  kadar: { readonly sat: string; readonly vrsta: "izmjereno" | "sada" | "prognoza"; readonly izvor: IzvorVjetra | null },
  sadaOcitanja: readonly Vjetar[],
  serije: ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>,
): string {
  if (kadar.vrsta === "prognoza") return "prognoza, iz modela";
  if (!kadar.izvor) return "vjetar nije poznat";
  if (kadar.izvor === "model") return "vjetar iz modela";
  const ime = kratkoImePostaje(kadar.izvor);
  const opazeno = opazenoZaIzvor(kadar.izvor, kadar.sat, sadaOcitanja, serije);
  if (opazeno === null || opazeno === kadar.sat) return `izmjeren, ${ime}`;
  return `izmjeren ${satMjesno(opazeno)}, ${ime}`;
}
