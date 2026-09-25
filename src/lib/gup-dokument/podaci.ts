/**
 * Čitanje GUP-a kao dokumenta s diska (data/gup-grad/dokument/, izvodi
 * scripts/gup-grad/dokument.py). Samo na poslužitelju i samo pri gradnji:
 * stranice dokumenta i navoda su statične.
 */
import { readFile } from "fs/promises";
import path from "path";

import type { Dokument, DokumentId, List } from "./model";
import { indeksiraj, type IndeksDokumenta } from "./tekst";

const MAPA = path.join(process.cwd(), "data", "gup-grad", "dokument");

const dokumenti = new Map<DokumentId, Promise<Dokument>>();
const indeksi = new Map<DokumentId, Promise<IndeksDokumenta>>();
let listovi: Promise<Record<string, List>> | null = null;

export function ucitajDokument(id: DokumentId): Promise<Dokument> {
  let p = dokumenti.get(id);
  if (!p) {
    p = readFile(path.join(MAPA, `${id}.json`), "utf8").then((s) => JSON.parse(s) as Dokument);
    dokumenti.set(id, p);
  }
  return p;
}

export function indeksDokumenta(id: DokumentId): Promise<IndeksDokumenta> {
  let p = indeksi.get(id);
  if (!p) {
    p = ucitajDokument(id).then((d) => indeksiraj(d.blokovi));
    indeksi.set(id, p);
  }
  return p;
}

export function ucitajListove(): Promise<Record<string, List>> {
  listovi ??= readFile(path.join(MAPA, "listovi.json"), "utf8").then((s) => {
    const d = JSON.parse(s) as { listovi: Record<string, Omit<List, "id">> };
    return Object.fromEntries(Object.entries(d.listovi).map(([id, l]) => [id, { id, ...l }]));
  });
  return listovi;
}
