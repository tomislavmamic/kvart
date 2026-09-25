"use client";

/**
 * Na cijelom tekstu GUP-a ističe navod s kojeg se došlo i skače na nj.
 *
 * Adresa nosi sve: `?oznaci=s37-5:10-80,s37-6:0-44#s37-5` (vidi id.ts,
 * kodirajOznake) — sidra blokova i raspone znakova. Isticanje ide kroz CSS
 * Custom Highlight API (`::highlight(navod)`): Range bez diranja DOM-a, pa
 * React ne nalazi tuđe čvorove u tekstu koji je sam iscrtao. Gdje API-ja nema
 * (Firefox prije 140), rasponi se omotaju u <mark>.
 *
 * Bez `oznaci`, a sa sidrom (#cl-104 iz navoda članka), samo bljesne ciljni blok.
 */
import { useEffect } from "react";

import { dekodirajOznake } from "@/lib/gup-dokument/id";

/** Range za [od, do) u tekstu elementa, preko svih njegovih tekstualnih čvorova. */
function raspon(el: Element, od: number, dokle: number): Range | null {
  const hod = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let pomak = 0;
  let pocet = false;
  for (let n = hod.nextNode() as Text | null; n; n = hod.nextNode() as Text | null) {
    const duz = n.data.length;
    if (!pocet && od <= pomak + duz) {
      r.setStart(n, od - pomak);
      pocet = true;
    }
    if (pocet && dokle <= pomak + duz) {
      r.setEnd(n, dokle - pomak);
      return r;
    }
    pomak += duz;
  }
  return null;
}

function bljesni(el: Element) {
  el.classList.remove("navod-blok--skok");
  // ponovno pokretanje animacije
  void (el as HTMLElement).offsetWidth;
  el.classList.add("navod-blok--skok");
}

export function Oznacivac() {
  useEffect(() => {
    const primijeni = () => {
      const q = new URLSearchParams(window.location.search).get("oznaci");
      const cilj = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
      if (!q) {
        if (cilj) bljesni(cilj);
        return;
      }
      const rasponi: Range[] = [];
      const blokovi: Element[] = [];
      for (const [sidro, r] of dekodirajOznake(q)) {
        const el = document.getElementById(sidro);
        if (!el) continue;
        blokovi.push(el);
        if (el.hasAttribute("data-tablica")) continue;
        for (const [a, b] of r) {
          const x = raspon(el, a, b);
          if (x) rasponi.push(x);
        }
      }
      if (!blokovi.length) return;
      const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
      const Highlight = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
      if (highlights && Highlight) {
        highlights.set("navod", new Highlight(...rasponi));
      } else {
        // od zadnjeg prema prvom, da omatanje ne pomakne još neobrađene raspone
        for (const r of [...rasponi].reverse()) {
          const m = document.createElement("mark");
          m.className = "navod-oznaka";
          try {
            r.surroundContents(m);
          } catch {
            // raspon preko granice elementa — ostaje neistaknut, blok ipak bljesne
          }
        }
      }
      for (const el of blokovi) el.classList.add("navod-blok");
      const prvi = blokovi[0];
      prvi.scrollIntoView({ block: "center" });
      bljesni(prvi);
    };
    // Stranica je dugačka: pričekaj da preglednik sam skoči na sidro, pa centriraj.
    const t = window.setTimeout(primijeni, 60);
    return () => window.clearTimeout(t);
  }, []);
  // Ovdje, a ne u globals.css: Lightning CSS pseudo-element ::highlight() još ne raščlanjuje.
  return <style>{"::highlight(navod){background-color:#fef3c6;color:inherit}"}</style>;
}
