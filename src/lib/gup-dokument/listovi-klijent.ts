/**
 * Podaci o listovima u pregledniku i navod mjesta na listu.
 *
 * Skočni prozor čestice slaže navod `list:<list>:<x>,<y>` iz mjesta klika;
 * takav navod nije u popisu navoda (nema ga što unaprijed izračunati), pa ga
 * ProzorNavoda razriješi ovdje — iz veličine i uklapanja lista.
 */
import { okvirOkoTocke, procitajNavodTocke, putNavoda } from "./id";
import { izdanjaLista, putLista } from "./izdanja";
import type { List, Ulomak } from "./model";

let listovi: Promise<Record<string, List>> | null = null;

/** Svi listovi, jednom po učitavanju stranice (statični /api/gup/listovi). */
export function listoviKlijent(): Promise<Record<string, List>> {
  listovi ??= fetch("/api/gup/listovi")
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, List>>) : {}))
    .catch(() => {
      listovi = null;
      return {};
    });
  return listovi;
}

/** Adresa lista približenog na točku (za poveznicu bez JavaScripta i za gumb u prozoru). */
export function putTocke(l: List, tocka: [number, number]): string {
  if (!l.uklapanje) return putLista(l.id);
  const o = okvirOkoTocke(l.uklapanje, tocka);
  return `${putLista(l.id)}?okvir=${o.map((v) => v.toFixed(4)).join(",")}&tocka=${tocka.map((v) => v.toFixed(5)).join(",")}`;
}

/** Ulomak za navod mjesta na listu; null ako navod nije takav ili lista nema. */
export function ulomakTocke(id: string, sviListovi: Record<string, List>): Ulomak | null {
  const n = procitajNavodTocke(id);
  const l = n && sviListovi[n.list];
  if (!n || !l?.uklapanje) return null;
  return {
    id,
    naslov: `${l.naslov} · ${l.izvor}`,
    opis: "službeni list oko čestice — krug je mjesto na koje si kliknuo",
    href: putTocke(l, n.tocka) || putNavoda(id),
    izdanje: izdanjaLista(l.id)[0]?.id ?? "2015",
    list: { ...l, okvir: okvirOkoTocke(l.uklapanje, n.tocka), tocka: n.tocka },
  };
}
