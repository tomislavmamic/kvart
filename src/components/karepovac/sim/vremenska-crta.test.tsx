import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";

import { VremenskaCrta } from "@/components/karepovac/sim/vremenska-crta";
import { SATI_UNAPRIJED, SATI_UNATRAG, SATI_ZALETA, slozCrtu } from "@/lib/sim/kadrovi";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";

const SADA = new Date("2026-09-05T12:00:00.000Z");

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

function nacrtaj(pomak = 0, gotovo = 0, promjene: Partial<ComponentProps<typeof VremenskaCrta>> = {}) {
  return renderToStaticMarkup(
    <VremenskaCrta
      crta={crta()}
      pomak={pomak}
      izracunati={new Set()}
      reproducira={false}
      sadaStvarno={new Date("2026-09-05T12:20:00.000Z")}
      napredak={{ gotovo, svjeze: gotovo, ukupno: 28, greska: null }}
      naReprodukciju={() => {}}
      naPromjenu={() => {}}
      {...promjene}
    />,
  );
}

test("traka nosi sat i napredak bez izvedenih razina mirisa", () => {
  const html = nacrtaj();
  assert.match(html, /type="range"/);
  assert.match(html, /aria-valuetext="14:00, sub, 05\. 09\., sada"/);
  assert.match(html, /Računam 0\/28/);
  assert.doesNotMatch(html, /miris u naseljima|background-color|href=/);
});

test("traka ostaje neutralna i ima dostupne kontrole", () => {
  const html = nacrtaj();
  assert.match(html, /aria-label="Pokreni prikaz po satima"/);
  assert.match(html, /aria-label="Sat koji se prikazuje"/);
  assert.match(html, /min="-24"/);
  assert.match(html, /max="3"/);
  assert.match(html, />Sada<\/button>/);
});

test("brojka nestaje kad je sve izračunato", () => {
  const html = nacrtaj(-3, 28);
  assert.doesNotMatch(html, /Računam|28\/28/);
  assert.match(html, /11:00/);
});

test("stara crta nudi zadnje podatke, ne tvrdi da su sadašnji", () => {
  const html = nacrtaj(0, 28, { sadaStvarno: new Date("2026-09-06T12:20:00.000Z") });
  assert.match(html, />Zadnje<\/button>/);
  assert.doesNotMatch(html, />Sada<\/button>/);
});

test("bez dostupnog sata reprodukcija i odabir su onemogućeni", () => {
  const pocetna = crta();
  const html = nacrtaj(0, 0, {
    crta: { ...pocetna, kadrovi: pocetna.kadrovi.map((kadar) => ({ ...kadar, dostupnost: "nedostupno" as const })) },
  });
  assert.equal(html.match(/disabled=""/g)?.length, 3);
  assert.match(html, /data-state="missing"/);
  assert.match(html, /nema podataka/);
});

test("greška je vidljiva, a model nije prikazan kao mjerenje", () => {
  const html = nacrtaj(0, 0, { napredak: { gotovo: 0, svjeze: 0, ukupno: 28, greska: "Izračun nije uspio" } });
  assert.match(html, /Izračun nije uspio/);
  assert.doesNotMatch(html, /Računam 0/);
  assert.match(html, /Model, ne mjerenje/);
});
