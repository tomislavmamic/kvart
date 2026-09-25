/**
 * Popis navoda GUP-a i njihovo razrješavanje u ulomak.
 *
 * Dvije vrste navoda:
 *  - imenovani, ovdje ispod — mjesta na koja se poziva tekst stranica (/gup);
 *  - izvedeni iz izvadaka odredbi (data/gup-grad/odredbe/izvor/): najmanja
 *    građevna čestica i nova gradnja po urbanom pravilu, i što namjena
 *    dopušta. Na njih se poziva karta čestica, imenima iz id.ts.
 *
 * Navod teksta je citat (ili više njih) sa stranicom izvornika; traži se u
 * tekstu dokumenta (tekst.ts), pa ulomak pokazuje doslovan tekst s istaknutim
 * citatom. Navod članka je cijeli članak. Navod lista je kartografski prikaz,
 * cijeli ili okvir na njemu (okvire daje scripts/gup-grad/okvir-lista.py).
 *
 * Samo na poslužitelju; ulomci idu pregledniku kroz /api/gup/navod/<id>.
 */
import { readFile } from "fs/promises";
import path from "path";

import { kodirajOznake, navodGradnja, navodNamjena, navodPpmin } from "./id";
import { izdanjaLista, izdanjeDokumenta, putLista, sidro } from "./izdanja";
import type { Blok, DokumentId, Okvir, Ulomak } from "./model";
import { indeksDokumenta, ucitajDokument, ucitajListove } from "./podaci";
import { nadjiCitat, spojiOznake, type Oznaka } from "./tekst";

export interface Citat {
  /** Doslovno iz izvornika; izostavljeno kao „…”. */
  t: string;
  /** Stranica izvornika na koju se citat poziva. */
  s?: number;
}

export type SpecNavoda =
  | { dok: DokumentId; citati: Citat[]; opis?: string }
  | { dok: DokumentId; clanak: string; doClanka?: string; opis?: string }
  | { list: string; okvir?: Okvir; opis?: string };

/** Imenovani navodi — mjesta na koja se poziva tekst na /gup. */
export const NAVODI: Record<string, SpecNavoda> = {
  "clanak-7-2015": {
    dok: "55-14",
    clanak: "cl-7",
    opis: "namjene površina, njihove boje i oznake na listu 1",
  },
  "sve-namjene-2015": {
    dok: "55-14",
    citati: [
      {
        t: "Na površinama svih namjena grade se nove te održavaju i po potrebi rekonstruiraju postojeće ulice i trgovi, javna parkirališta te komunalne građevine i uređaji.",
        s: 3,
      },
    ],
    opis: "ulice, parkirališta i komunalne građevine dopuštene su u svakoj namjeni",
  },
  "z6-2015": {
    dok: "55-14",
    citati: [
      { t: "zaštitno i pejsažno zelenilo s postojećim građevinama Z6", s: 3 },
      { t: "Z6 je dijelom izgrađeni vrijedan obalni prostor Meja i Bačvica", s: 7 },
    ],
    opis: "zelenilo s postojećim građevinama (Z6)",
  },
  "ppmin-250-2015": {
    dok: "55-14",
    citati: [{ t: "za novu izgradnju dvojnih građevina Ppmin=250 m2", s: 36 }],
    opis: "najmanja građevna čestica za stanovanje u planu",
  },
  "sirina-cestice-2015": {
    dok: "55-14",
    citati: [
      {
        t: "za novu izgradnju dvojnih građevina Ppmin=300 m2 … minimalna širina fronte građevne čestice slobodnostojeće građevine (ulične strane parcele) šmin=10 m",
        s: 45,
      },
    ],
    opis: "najmanja širina građevne čestice",
  },
  "obveza-plana-2015": {
    dok: "55-14",
    clanak: "cl-104",
    doClanka: "cl-105",
    opis: "što se gradi u nisko konsolidiranim područjima do donošenja plana užeg područja",
  },
  "obveza-plana-2006": {
    dok: "1-06",
    clanak: "cl-104",
    doClanka: "cl-105",
    opis: "što se gradi u nisko konsolidiranim područjima do donošenja plana užeg područja",
  },
  "marjan-2006": {
    dok: "1-06",
    citati: [{ t: "Za područje Park-šume Marjan propisuje se izrada Prostornog plana područja posebnih obilježja Park-šume Marjan", s: 65 }],
    opis: "Marjan čeka prostorni plan područja posebnih obilježja",
  },
  "marjan-2015": {
    dok: "55-14",
    citati: [{ t: "Za područje Park-šume Marjan propisuje se izrada Prostornog plana područja posebnih obilježja Park-šume Marjan", s: 79 }],
    opis: "Marjan čeka prostorni plan područja posebnih obilježja",
  },
  "obveza-plana-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Područja unutar obuhvata GUP-a na kojima je gradnja moguća samo temeljem prostornog plana užeg područja … izgrađeni dijelovi građevinskog područja planirani za urbanu sanaciju",
        s: 143,
      },
    ],
    opis: "prijedlog 2025., čl. 103. st. 1: gdje gradnja čeka plan užeg područja",
  },
  "preporuka-plana-2025": {
    dok: "prijedlog-2025",
    citati: [
      {
        t: "Na područjima za koja se GUP-om propisuje izrada prostornog plana užeg područja, a koja ne spadaju u područja iz stavka 1. ovog članka, do izrade prostornog plana užeg područja gradnja je moguća neposrednom provedbom GUP-a, u skladu s odredbama GUP-a.",
        s: 144,
      },
    ],
    opis: "prijedlog 2025., čl. 103. st. 4: drugdje se do plana gradi po GUP-u",
  },
  "list-namjena-2008": { list: "namjena-2008" },
  "list-namjena-2014": { list: "namjena-2014" },
  "list-namjena-2025": { list: "namjena-2025" },
  "list-urbana-pravila-2012": { list: "urbana-pravila-2012" },
  "list-urbana-pravila-2014": { list: "urbana-pravila-2014" },
  "list-urbana-pravila-2025": { list: "urbana-pravila-2025" },
  "list-detaljniji-planovi-2008": { list: "detaljniji-planovi-2008" },
  "list-vazeci-planovi-2008": { list: "vazeci-planovi-2008" },
  "list-vazeci-planovi-2014": { list: "vazeci-planovi-2014" },
  "list-planske-mjere-2025": { list: "planske-mjere-2025" },
  "z6-legenda-2025": {
    list: "namjena-2025",
    okvir: [0.806, 0.52, 0.895, 0.635],
    opis: "Z6 u tumaču znakova prijedloga 2025.",
  },
  "z6-bacvice-2025": {
    list: "namjena-2025",
    okvir: [0.3, 0.74, 0.36, 0.9],
    opis: "oznake Z6 otisnute na listu 2025. (Bačvice)",
  },
};

const IZVOR_ODREDBI = path.join(process.cwd(), "data", "gup-grad", "odredbe", "izvor");
const GODINE = [2006, 2015, 2025] as const;

function dokumentGodine(godina: number, dokument?: string): DokumentId {
  if (godina === 2006) return dokument === "3/08" ? "3-08" : "1-06";
  return godina === 2015 ? "55-14" : "prijedlog-2025";
}

interface UrbanoPraviloPpmin {
  kod: string;
  naziv?: string;
  citat?: string;
  dokument?: string;
  stranica_glasnika?: number;
  stranica_pdf?: number;
}
interface UrbanoPraviloGradnja {
  kod: string;
  naziv?: string;
  nova_stambena_citat?: string;
  dokument?: string;
  stranica?: number;
}
interface KlasaDopusteno {
  klasa: string;
  po_godini: Record<string, { citat?: string; stranica?: number; dodatni_citati?: { citat: string; stranica?: number }[] } | null>;
}

let svi: Promise<Map<string, SpecNavoda>> | null = null;

/** Svi navodi: imenovani i izvedeni iz izvadaka odredbi. */
export function sviNavodi(): Promise<Map<string, SpecNavoda>> {
  svi ??= (async () => {
    const m = new Map<string, SpecNavoda>(Object.entries(NAVODI));
    const citaj = async <T>(ime: string) => JSON.parse(await readFile(path.join(IZVOR_ODREDBI, ime), "utf8")) as T;
    for (const g of GODINE) {
      const pp = await citaj<{ urbana_pravila: UrbanoPraviloPpmin[] }>(`ppmin-${g}.json`);
      for (const e of pp.urbana_pravila) {
        if (!e.citat) continue;
        const spec: SpecNavoda = {
          dok: dokumentGodine(g, e.dokument),
          citati: [{ t: e.citat, s: e.stranica_glasnika ?? e.stranica_pdf }],
          opis: `najmanja građevna čestica, urbano pravilo ${e.kod}${e.naziv ? ` (${e.naziv})` : ""}`,
        };
        const kod = e.kod.replace(/\s+/g, "");
        if (!m.has(navodPpmin(g, kod))) m.set(navodPpmin(g, kod), spec);
        // list urbanih pravila gradske projekte GP1–GP11 crta kao jedno
        // područje „GP” (vidi odredbe.py), pa karta traži navod za „GP”
        if (kod.startsWith("GP") && !m.has(navodPpmin(g, "GP"))) m.set(navodPpmin(g, "GP"), spec);
      }
      const gr = await citaj<{ urbana_pravila: UrbanoPraviloGradnja[] }>(`gradnja-${g}.json`);
      for (const e of gr.urbana_pravila) {
        if (!e.nova_stambena_citat) continue;
        const id = navodGradnja(g, e.kod.replace(/\s+/g, ""));
        if (m.has(id)) continue;
        m.set(id, {
          dok: dokumentGodine(g, e.dokument),
          citati: [{ t: e.nova_stambena_citat, s: e.stranica }],
          opis: `nova stambena gradnja, urbano pravilo ${e.kod}${e.naziv ? ` (${e.naziv})` : ""}`,
        });
      }
    }
    const dop = await citaj<{ klase: KlasaDopusteno[] }>("dopusteno.json");
    for (const k of dop.klase) {
      for (const [g, v] of Object.entries(k.po_godini)) {
        if (!v) continue;
        // citat iz izmjena 3/08 izvadak označava „(3/08, čl. 7)”; ulomak je iz
        // jednog dokumenta (1/06), pa takav citat ne ulazi
        const citati = [
          ...(v.citat ? [{ t: v.citat, s: v.stranica }] : []),
          ...(v.dodatni_citati ?? []).map((c) => ({ t: c.citat, s: c.stranica })),
        ].filter((c) => !c.t.startsWith("(3/08"));
        if (!citati.length) continue;
        m.set(navodNamjena(g, k.klasa), { dok: dokumentGodine(Number(g)), citati, opis: `što odredbe dopuštaju u namjeni ${k.klasa}` });
      }
    }
    return m;
  })();
  return svi;
}

/** Članak kojemu blok pripada: najbliži prethodni blok članka. */
function clanakBloka(blokovi: Blok[], i: number): Blok | undefined {
  for (let j = i; j >= 0; j--) if (blokovi[j].v === "cl") return blokovi[j];
  return undefined;
}

/**
 * Prijedlog 2025. je odluka o izmjenama: njezin članak 116 kaže „Članak 103.
 * mijenja se i glasi: …”. Čitatelj traži članak plana, pa ga naslov navodi:
 * „čl. 116 (mijenja čl. 103)”.
 */
function izmjena(blokovi: Blok[], cl: Blok, doBloka: number): string {
  // zadnja rečenica „Članak N. mijenja se…” između naslova članka i navoda
  // (članak odluke može prvo mijenjati naslov, pa tek onda sam članak)
  for (let i = doBloka; i > blokovi.indexOf(cl); i--) {
    const t = blokovi[i].t;
    const m =
      /^Članak (\d+(?:\.[a-z])?)\.? (?:mijenja se|se mijenja|briše se)/.exec(t) ??
      /^Iza članka \d+(?:\.[a-z])?\.? dodaje se novi članak (\d+(?:\.[a-z])?)/.exec(t);
    if (m) return t.startsWith("Iza") ? ` (dodaje čl. ${m[1]})` : ` (mijenja čl. ${m[1]})`;
  }
  return "";
}

/** Uvodna rečenica popisa („…grade se:”) kad navod počinje stavkom. */
function uvod(blokovi: Blok[], i: number): number | null {
  for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
    const b = blokovi[j];
    if (b.v === "li") continue;
    return b.v === "p" && b.t.trimEnd().endsWith(":") ? j : null;
  }
  return null;
}

/** Ulomak navoda — ono što pokazuju skočni prozor i stranica navoda. Null ako ga nema ili se ne nađe. */
export async function razrijesi(id: string): Promise<Ulomak | null> {
  const spec = (await sviNavodi()).get(id);
  if (!spec) return null;

  if ("list" in spec) {
    const l = (await ucitajListove())[spec.list];
    if (!l) return null;
    const izd = izdanjaLista(l.id)[0];
    const okvir = spec.okvir;
    return {
      id,
      naslov: `${l.naslov} · ${l.izvor}`,
      opis: spec.opis,
      href: putLista(l.id) + (okvir ? `?okvir=${okvir.map((v) => v.toFixed(4)).join(",")}` : ""),
      izdanje: izd?.id ?? "2015",
      list: { ...l, okvir },
    };
  }

  const dok = await ucitajDokument(spec.dok);
  const izd = izdanjeDokumenta(spec.dok);
  const blokovi = dok.blokovi;
  let oznake: Oznaka[] = [];
  let odabrani: number[];

  if ("clanak" in spec) {
    const od = blokovi.findIndex((b) => b.a === spec.clanak);
    if (od < 0) return null;
    const zadnji = spec.doClanka ? blokovi.findIndex((b) => b.a === spec.doClanka) : od;
    if (zadnji < 0) return null;
    let kraj = zadnji + 1;
    while (kraj < blokovi.length && blokovi[kraj].v !== "cl" && !(blokovi[kraj].v === "n" && (blokovi[kraj].r ?? 5) <= 4)) kraj++;
    odabrani = Array.from({ length: kraj - od }, (_, k) => od + k);
  } else {
    const ind = await indeksDokumenta(spec.dok);
    for (const c of spec.citati) {
      const o = nadjiCitat(ind, c.t, c.s);
      if (!o) return null;
      oznake = oznake.concat(o);
    }
    const poBloku = spojiOznake(oznake);
    const skup = new Set(poBloku.keys());
    const prvi = Math.min(...skup);
    const u = blokovi[prvi].v === "li" ? uvod(blokovi, prvi) : null;
    if (u !== null) skup.add(u);
    odabrani = [...skup].sort((a, b) => a - b);
  }

  const poBloku = spojiOznake(oznake);
  const prviOznacen = oznake.length ? Math.min(...oznake.map((o) => o.blok)) : odabrani[0];
  const cl = clanakBloka(blokovi, prviOznacen);
  const s = blokovi[prviOznacen].s;
  const doCl = "clanak" in spec && spec.doClanka ? blokovi.find((b) => b.a === spec.doClanka)?.cl : undefined;
  const naslov = [dok.kratko, cl ? `čl. ${cl.cl}${doCl ? `–${doCl}` : ""}${izmjena(blokovi, cl, prviOznacen)}` : null, `str. ${s}`]
    .filter(Boolean)
    .join(" · ");
  const sidra = [...poBloku.entries()].map(([i, r]) => [sidro(izd, spec.dok, blokovi[i].id), r] as [string, [number, number][]]);
  const upit = sidra.length ? `?oznaci=${kodirajOznake(sidra)}` : "";
  const cilj = "clanak" in spec ? sidro(izd, spec.dok, spec.clanak) : sidro(izd, spec.dok, blokovi[prviOznacen].id);

  return {
    id,
    naslov,
    opis: spec.opis,
    href: `${izd.put}${upit}#${cilj}`,
    izdanje: izd.id,
    dokument: { id: dok.id, naslov: dok.naslov, izvor: dok.izvor, url: dok.url },
    blokovi: odabrani.map((i) => {
      const b = blokovi[i];
      return {
        id: sidro(izd, spec.dok, b.id),
        s: b.s,
        v: b.v,
        t: b.t,
        ...(b.nast ? { nast: true } : {}),
        ...(b.src ? { src: b.src, w: b.w, h: b.h } : {}),
        ...(poBloku.has(i) ? { oznake: poBloku.get(i) } : {}),
      };
    }),
  };
}

/** Imena svih navoda — za statične stranice i odgovore. */
export async function imenaNavoda(): Promise<string[]> {
  return [...(await sviNavodi()).keys()];
}
