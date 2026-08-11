import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PrimaryNavigation } from "./primary-navigation";

test("hero navigation renders all four journeys as one responsive dock", () => {
  const markup = renderToStaticMarkup(
    createElement(PrimaryNavigation, { variant: "hero" }),
  );

  assert.match(markup, /aria-label="Glavni načini sudjelovanja"/);
  assert.match(markup, /grid-cols-2/);
  assert.match(markup, /sm:grid-cols-4/);
  for (const label of ["Razgovor", "Karta", "Karepovac", "Problemi"]) {
    assert.equal((markup.match(new RegExp(`>${label}<`, "g")) ?? []).length, 1);
  }
});

test("problem submission marks the Problems journey as current", () => {
  const markup = renderToStaticMarkup(
    createElement(PrimaryNavigation, {
      variant: "header",
      pathname: "/prijavi",
    }),
  );

  assert.match(
    markup,
    /<a(?=[^>]*href="\/prijedlozi")(?=[^>]*aria-current="page")[^>]*>/,
  );
});
