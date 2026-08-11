import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SiteHeaderView } from "./site-header";

const renderHeader = (open: boolean) =>
  renderToStaticMarkup(
    createElement(SiteHeaderView, {
      pathname: "/karepovac",
      open,
      onToggle: () => undefined,
      onClose: () => undefined,
    }),
  );

test("site navigation stays compact until the full row fits", () => {
  const closedMarkup = renderHeader(false);
  const openMarkup = renderHeader(true);

  assert.match(
    closedMarkup,
    /max-w-7xl/,
    "site header should have enough room for the primary links",
  );
  assert.match(
    closedMarkup,
    /<div class="[^"]*xl:flex[^"]*">/,
    "the full navigation should wait until the planned xl breakpoint",
  );
  assert.match(
    closedMarkup,
    /<button[^>]*class="[^"]*xl:hidden[^"]*"/,
    "hamburger should remain visible below xl",
  );
  assert.match(
    openMarkup,
    /<div id="mobile-nav" class="[^"]*xl:hidden[^"]*">/,
    "dropdown should remain available below xl",
  );
  assert.doesNotMatch(closedMarkup, /(?:^|\s)lg:flex(?:\s|$)/);
  assert.doesNotMatch(closedMarkup, /(?:^|\s)lg:hidden(?:\s|$)/);
});

test("homepage header leaves the four journeys to the hero dock", () => {
  const markup = renderToStaticMarkup(
    createElement(SiteHeaderView, {
      pathname: "/",
      open: false,
      onToggle: () => undefined,
      onClose: () => undefined,
    }),
  );

  assert.match(markup, />Više</);
  assert.doesNotMatch(markup, /Glavni načini sudjelovanja/);
  assert.doesNotMatch(markup, /aria-label="Otvori izbornik"/);
});
