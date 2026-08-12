import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("the /svg prototype leads with the living Kvart scene and its data boundary", async () => {
  const { default: SvgPage } = await import("./page");
  const markup = renderToStaticMarkup(createElement(SvgPage));

  assert.match(markup, /<h1[^>]*>Kvart u pokretu<\/h1>/);
  assert.match(markup, /stilizirani model Dračevca i Bilica/i);
  assert.match(markup, /podacima Grada Splita/i);
  assert.match(markup, /OpenStreetMap/i);
  assert.match(markup, /kvart-diorama-rct-20260811/);
});
