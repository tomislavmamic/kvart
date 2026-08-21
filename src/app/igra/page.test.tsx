import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("/igra exposes an orbitable accessible relief model with an SVG fallback", async () => {
  const route = await import("./page").catch(() => null);
  assert.ok(route, "the /igra route should exist");

  const markup = renderToStaticMarkup(createElement(route.default));
  assert.match(markup, /<h1[^>]*>Kvart u pokretu<\/h1>/);
  assert.match(markup, /<canvas[^>]+aria-label="3D maketa reljefa Dračevca i Bilica"/);
  assert.match(markup, /href="\/svg"/);
  assert.match(markup, /Pauziraj animaciju/);
  assert.match(markup, /Povećaj prikaz/);
  assert.match(markup, /Smanji prikaz/);
  assert.match(markup, /Vrati cijeli kvart/);
  assert.match(markup, /Povuci za zaokretanje/);
  assert.match(markup, /kotačićem ili prstima približi/);
  assert.match(markup, /Preuveličaj visine/);
  assert.match(markup, /Preuveličanje visina, sada 2 puta/);
  assert.match(markup, /OpenStreetMap/);
  assert.match(markup, /DGU|LiDAR/, "the relief source must be cited in the first viewport");
});
