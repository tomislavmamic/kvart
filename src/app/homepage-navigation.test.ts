import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "./page";

test("homepage presents one broad invitation and one four-journey dock", () => {
  const markup = renderToStaticMarkup(createElement(HomePage));

  assert.match(
    markup,
    /Razgovaraj sa susjedima, istraži kvart i uključi se\./,
  );
  assert.equal(
    (markup.match(/aria-label="Glavni načini sudjelovanja"/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(markup, /Najnovije aktivnosti/);
  assert.doesNotMatch(markup, /Kako ovo funkcionira/);
  assert.doesNotMatch(markup, /ukupno prijedloga/);
});
