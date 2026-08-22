import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("/igra is nothing but the model, with every control in one column", async () => {
  const route = await import("./page").catch(() => null);
  assert.ok(route, "the /igra route should exist");

  const markup = renderToStaticMarkup(createElement(route.default));
  // Naslov postoji, ali iza gumba — ne preko terena.
  assert.match(markup, /<h1[^>]*>Kvart u pokretu<\/h1>/);
  assert.match(markup, /id="igra-o-maketi"[^>]*hidden/);
  assert.match(markup, /Zatvori maketu/, "the only way out is a cross in the corner");
  assert.match(markup, /<canvas[^>]+aria-label="3D maketa reljefa Dračevca i Bilica"/);
  assert.match(markup, /href="\/svg"/);
  assert.match(markup, /Pauziraj animaciju/);
  assert.match(markup, /Povećaj prikaz/);
  assert.match(markup, /Smanji prikaz/);
  assert.match(markup, /Vrati cijeli kvart/);
  assert.match(markup, /Povuci za zaokretanje/);
  assert.match(markup, /kotačićem ili prstima približi/);
  assert.match(markup, /O maketi i izvorima/);
  assert.match(markup, /Preuveličaj visine/);
  assert.match(markup, /Preuveličanje visina, sada 2 puta/);
  // Pripis izvora je uvjet licencije, pa mora stajati u dokumentu i onda kad
  // je ploča zatvorena — sakriven smije biti, izostavljen ne.
  assert.match(markup, /OpenStreetMap \(ODbL\)/);
  assert.match(markup, /DGU|LiDAR/);
  assert.match(markup, /GIS Grada Splita/);
});
