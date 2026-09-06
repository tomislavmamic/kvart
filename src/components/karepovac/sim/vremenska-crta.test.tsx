import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { VremenskaCrta } from "@/components/karepovac/sim/vremenska-crta";
import { SATI_UNAPRIJED, SATI_UNATRAG, SATI_ZALETA, slozCrtu } from "@/lib/sim/kadrovi";
import { bojaZa, ZADANA_BOJA } from "@/lib/sim/ljestvica";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";

/**
 * Traka na telefonu je zbijena (≈ 80 px) i nosi izlaz „Karepovac”, jer gore
 * ondje stoji samo skupljena kartica. Na širokom zaslonu je kao prije.
 */

const SADA = new Date("2026-09-05T12:00:00.000Z");
const LJESTVICA = bojaZa(ZADANA_BOJA.sumporovodik, "sumporovodik").ljestvica;

function crta() {
  const vjetrovi = new Map<string, SatniVjetar>();
  const dubine = new Map<string, number>();
  for (let i = -(SATI_UNATRAG + SATI_ZALETA); i <= SATI_UNAPRIJED; i += 1) {
    const sat = new Date(SADA.getTime() + i * 3600000).toISOString();
    vjetrovi.set(sat, { sat, smjerOd: 112, brzina: 1.2, tisina: false, izvor: i > 0 ? "model" : "split3" });
    dubine.set(sat, 80);
  }
  return slozCrtu(SADA, vjetrovi, dubine, new Map());
}

function nacrtaj(pomak = 0, gotovo = 0) {
  return renderToStaticMarkup(
    <VremenskaCrta
      crta={crta()}
      pomak={pomak}
      izracunati={new Set()}
      razine={new Map()}
      ljestvica={LJESTVICA}
      reproducira={false}
      mirovanje
      sadaStvarno={new Date("2026-09-05T12:20:00.000Z")}
      napredak={{ gotovo, svjeze: gotovo, ukupno: 28, greska: null }}
      naReprodukciju={() => {}}
      naPromjenu={() => {}}
    />,
  );
}

test("zaglavlje trake na telefonu nosi izlaz „Karepovac”, a brojka zagrijavanja je kratka", () => {
  const html = nacrtaj();
  const izlaz = html.match(/<a[^>]*aria-label="Karepovac — sve što pratimo"[^>]*>/)?.[0] ?? "";
  assert.match(izlaz, /href="\/karepovac"/);
  assert.match(izlaz, /sm:hidden/);
  assert.match(izlaz, /min-h-11/);
  assert.match(html, /<span class="hidden sm:inline">Računam <\/span>0\/28<span class="hidden sm:inline"> sati<\/span>/);
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuetext="14:00, sub, 05\. 09\., sada"/);
});

test("staza je na telefonu niska, a na širokom zaslonu kao prije", () => {
  const html = nacrtaj();
  const staza = html.match(/<div[^>]*role="slider"[^>]*>/)![0];
  assert.match(staza, /\bh-6\b/);
  assert.match(staza, /sm:h-12/);
  // Pločice od 10 px na telefonu, 16 px na širokom.
  assert.match(html, /class="absolute inset-x-0 top-0\.5 flex h-2\.5 gap-px sm:top-3 sm:h-4"/);
  // Brojke sati ostaju.
  assert.match(html, /leading-3 tabular-nums text-zinc-500 sm:leading-4/);
});

test("izvan sadašnjeg sata stoji „na sada” ispred izlaza; brojka nestaje kad je sve izračunato", () => {
  const html = nacrtaj(-3, 28);
  assert.ok(html.indexOf("na sada") < html.indexOf('href="/karepovac"'));
  assert.doesNotMatch(html, /0\/28|28\/28/);
});
