import assert from "node:assert/strict";
import test from "node:test";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Karepovac navigation keeps its grid until all six links fit", async () => {
  const projectNav = await import("./project-nav");
  const KarepovacProjectNavView = Reflect.get(
    projectNav,
    "KarepovacProjectNavView",
  ) as ((props: { pathname: string }) => ReactNode) | undefined;

  assert.ok(
    KarepovacProjectNavView,
    "project navigation should expose its rendered view for the route contract",
  );

  const markup = renderToStaticMarkup(
    createElement(KarepovacProjectNavView, { pathname: "/karepovac" }),
  );

  assert.match(
    markup,
    /<div class="[^"]*md:flex[^"]*">/,
    "the single-row project navigation should begin at md",
  );
  assert.doesNotMatch(
    markup,
    /(?:^|\s)sm:flex(?:\s|$)/,
    "the project navigation should not compress into one row at 640px",
  );
  assert.equal((markup.match(/md:whitespace-nowrap/g) ?? []).length, 6);
  assert.equal((markup.match(/href="\/karepovac/g) ?? []).length, 6);
  assert.match(markup, /aria-current="page"[^>]*>Pregled</);
});
