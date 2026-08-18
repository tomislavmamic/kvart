import assert from "node:assert/strict";
import test from "node:test";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { KAREPOVAC_NAV } from "@/lib/karepovac";

test("Karepovac navigation keeps its grid until every link fits", async () => {
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
    createElement(KarepovacProjectNavView, { pathname: "/karepovac/zrak" }),
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
  // Broj se čita iz popisa, a ne prepisuje: kad se doda stranica, provjera
  // i dalje mjeri ono što treba — da svaka poveznica stane u jedan redak.
  assert.equal(
    (markup.match(/md:whitespace-nowrap/g) ?? []).length,
    KAREPOVAC_NAV.length,
  );
  assert.equal(
    (markup.match(/href="\/karepovac/g) ?? []).length,
    KAREPOVAC_NAV.length,
  );
  assert.match(markup, /aria-current="page"[^>]*>Pregled</);
});
