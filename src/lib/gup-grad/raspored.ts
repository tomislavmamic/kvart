/**
 * Raspored ćelija infografike: Voronoijeva stabla-karta (d3-voronoi-treemap)
 * ili klasična pravokutna (d3-hierarchy treemap).
 *
 * Računa se na poslužitelju, jednom po godini i obliku, pa preglednik
 * dobiva gotove poligone. Voronoi ovisi o sin/cos (kružni rub) i o
 * slučajnim sjemenkama; na poslužitelju je sjeme fiksno, a hidracija ne
 * može naići na razliku između V8-a i Safarijeva stroja.
 */
import { hierarchy, treemap, treemapSquarify, type HierarchyNode } from "d3-hierarchy";
import { voronoiTreemap } from "d3-voronoi-treemap";

import { KLASE, SKUPINE, type KodKlase, type KodSkupine } from "./model";
import type { Tocka } from "./poligon";

export type Oblik = "voronoi" | "pravokutnici";

export interface Celija {
  kod: KodKlase;
  skupina: KodSkupine;
  poligon: Tocka[];
  /** Točka za natpis (težište poligona). */
  sredina: Tocka;
}

export interface Raspored {
  sirina: number;
  visina: number;
  celije: Celija[];
  /** Obrisi skupina — deblja bijela crta između skupina. */
  skupine: { kod: KodSkupine; poligon: Tocka[] }[];
}

interface Cvor {
  ime: string;
  skupina?: KodSkupine;
  kod?: KodKlase;
  povrsina?: number;
  djeca?: Cvor[];
}

type VoronoiCvor = HierarchyNode<Cvor> & { polygon?: [number, number][] & { site?: { x: number; y: number } } };
type RectCvor = HierarchyNode<Cvor> & { x0: number; x1: number; y0: number; y1: number };

function stablo(povrsine: Partial<Record<KodKlase, number>>): Cvor {
  return {
    ime: "GUP",
    djeca: SKUPINE.map((s) => ({
      ime: s.kod,
      skupina: s.kod,
      djeca: KLASE.filter((k) => k.skupina === s.kod && (povrsine[k.kod] ?? 0) > 0).map((k) => ({
        ime: k.kod,
        skupina: s.kod,
        kod: k.kod,
        povrsina: povrsine[k.kod],
      })),
    })).filter((s) => (s.djeca?.length ?? 0) > 0),
  };
}

/** Park-Miller: isto sjeme → isti raspored pri svakoj gradnji. */
function sjeme(s: number) {
  let x = s;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const zaokruzi = (p: readonly (readonly [number, number])[]): Tocka[] => p.map(([x, y]) => [r1(x), r1(y)] as const);

function teziste(p: readonly Tocka[]): Tocka {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    a += f;
    cx += (p[j][0] + p[i][0]) * f;
    cy += (p[j][1] + p[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return p[0];
  return [r1(cx / (3 * a)), r1(cy / (3 * a))];
}

export function voronoi(povrsine: Partial<Record<KodKlase, number>>, velicina = 1000): Raspored {
  const korijen = hierarchy(stablo(povrsine), (d) => d.djeca).sum((d) => d.povrsina ?? 0) as VoronoiCvor;
  // Kružni obris, 96 stranica — dovoljno glatko da se ne vide bridovi.
  const r = velicina / 2;
  const rub: [number, number][] = Array.from({ length: 96 }, (_, i) => {
    const t = (i / 96) * 2 * Math.PI;
    return [r + r * Math.cos(t), r + r * Math.sin(t)];
  });
  voronoiTreemap().clip(rub).prng(sjeme(20260923)).maxIterationCount(80).convergenceRatio(0.005)(korijen);

  const celije: Celija[] = (korijen.leaves() as VoronoiCvor[]).map((l) => {
    const poligon = zaokruzi(l.polygon ?? []);
    return { kod: l.data.kod!, skupina: l.data.skupina!, poligon, sredina: teziste(poligon) };
  });
  const skupine = ((korijen.children ?? []) as VoronoiCvor[]).map((s) => ({
    kod: s.data.skupina!,
    poligon: zaokruzi(s.polygon ?? []),
  }));
  return { sirina: velicina, visina: velicina, celije, skupine };
}

export function pravokutnici(povrsine: Partial<Record<KodKlase, number>>, sirina = 1000, visina = 640): Raspored {
  const korijen = hierarchy(stablo(povrsine), (d) => d.djeca)
    .sum((d) => d.povrsina ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  treemap<Cvor>().tile(treemapSquarify).size([sirina, visina]).paddingInner(0).round(false)(korijen);
  const pravokutnik = (n: RectCvor): Tocka[] =>
    zaokruzi([
      [n.x0, n.y0],
      [n.x1, n.y0],
      [n.x1, n.y1],
      [n.x0, n.y1],
    ]);
  const celije = (korijen.leaves() as RectCvor[]).map((l) => {
    const poligon = pravokutnik(l);
    return { kod: l.data.kod!, skupina: l.data.skupina!, poligon, sredina: teziste(poligon) };
  });
  const skupine = ((korijen.children ?? []) as RectCvor[]).map((s) => ({ kod: s.data.skupina!, poligon: pravokutnik(s) }));
  return { sirina, visina, celije, skupine };
}
