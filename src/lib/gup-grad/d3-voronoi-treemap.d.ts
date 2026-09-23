// d3-voronoi-treemap (Kcnarf, BSD-3) ne nosi tipove; ovo je dio API-ja koji koristimo.
declare module "d3-voronoi-treemap" {
  import type { HierarchyNode } from "d3-hierarchy";

  interface VoronoiTreemap {
    <T>(root: HierarchyNode<T>): void;
    clip(polygon: [number, number][]): VoronoiTreemap;
    prng(fn: () => number): VoronoiTreemap;
    maxIterationCount(n: number): VoronoiTreemap;
    convergenceRatio(r: number): VoronoiTreemap;
    minWeightRatio(r: number): VoronoiTreemap;
  }

  export function voronoiTreemap(): VoronoiTreemap;
}
