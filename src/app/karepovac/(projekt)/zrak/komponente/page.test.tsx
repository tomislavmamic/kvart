import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { type ZrakSada } from "@/lib/vjetar";
import { slozi } from "@/lib/zrak";
import { PrikazKomponenti } from "./page";

const JUGO: ZrakSada = {
  stanje: { smjerOd: 112, brzina: 1.4, dubina: 60 },
  vjetar: {
    postaja: "ldsp",
    smjerOd: 112,
    brzina: 1.4,
    tisina: false,
    promjenjiv: false,
    opazeno: "2026-08-19T20:30:00.000Z",
  },
  mijesanje: { dubina: 60, vrijeme: "2026-08-19T20:00Z" },
  izvor: "uzivo",
  ocitanja: [],
};

function nacrtaj(): string {
  return renderToStaticMarkup(<PrikazKomponenti prikaz={slozi(JUGO)} />);
}

test("usporedna stranica prikazuje samo tri vizualna sloja", () => {
  const markup = nacrtaj();

  for (const [naziv, id] of [
    ["Podloga", "podloga"],
    ["Perjanica", "perjanica"],
    ["Natpisi", "natpisi"],
  ]) {
    assert.match(markup, new RegExp(`>${naziv}<`), `nedostaje odjeljak ${naziv}`);
    assert.match(
      markup,
      new RegExp(`<section[^>]*id="${id}"[^>]*data-component="${naziv}"`),
      `odjeljak ${naziv} nema stabilnu DOM oznaku`,
    );
  }

  assert.equal(markup.match(/<canvas\b/g)?.length, 1);
  assert.equal(markup.match(/<section\b/g)?.length, 3);
  assert.doesNotMatch(markup, /PrikazPoljaDima|PerjanicaSIzborom/);
  assert.doesNotMatch(markup, /<button\b|Otvori u karti|Boja pokazuje/);
  assert.equal(markup.match(/data-part="viewport"/g)?.length, 3);
});

test("ispod glavnih slojeva rastavlja podlogu na osam zasebno označenih slojeva", () => {
  const markup = nacrtaj();
  const slojevi = [
    ["Pozadina", "pozadina", "Podloga.Pozadina"],
    ["Sporedne izohipse", "izohipse-sporedne", "Podloga.IzohipseSporedne"],
    ["Glavne izohipse", "izohipse-glavne", "Podloga.IzohipseGlavne"],
    ["Zgrade", "zgrade", "Podloga.Zgrade"],
    ["Ulice", "ulice", "Podloga.Ulice"],
    ["Granica Dračevca", "granica-dracevac", "Podloga.GranicaDracevac"],
    ["Granica Bilica", "granica-bilice", "Podloga.GranicaBilice"],
    ["Reljef", "reljef", "Podloga.Reljef"],
  ] as const;

  for (const [naziv, id, komponenta] of slojevi) {
    assert.match(markup, new RegExp(`>${naziv}<`), `nedostaje sloj ${naziv}`);
    assert.match(
      markup,
      new RegExp(
        `<div[^>]*id="podloga-${id}"[^>]*data-component="${komponenta.replace(".", "\\.")}"[^>]*data-part="podloga-sloj"`,
      ),
      `sloj ${naziv} nema vlastiti označeni div`,
    );
  }

  assert.equal(markup.match(/data-part="podloga-sloj"/g)?.length, 8);
  assert.ok(
    markup.indexOf('data-component="Podloga.Pozadina"') >
      markup.indexOf('data-component="Natpisi"'),
    "rastavljena podloga mora biti ispod tri glavna sloja",
  );
});
