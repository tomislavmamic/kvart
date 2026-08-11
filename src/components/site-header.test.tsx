import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { SiteHeaderView } from "./site-header";

const renderHeader = (open: boolean) =>
  renderToStaticMarkup(
    <SiteHeaderView
      pathname="/karepovac"
      open={open}
      onToggle={() => undefined}
      onClose={() => undefined}
    />,
  );

test("site navigation stays compact until the full row fits", () => {
  const closedMarkup = renderHeader(false);
  const openMarkup = renderHeader(true);

  assert.match(
    closedMarkup,
    /max-w-7xl/,
    "site header should have enough room for all desktop links",
  );
  assert.match(
    closedMarkup,
    /<nav class="[^"]*xl:flex[^"]*">/,
    "full navigation should begin at the xl breakpoint",
  );
  assert.match(
    closedMarkup,
    /<button[^>]*class="[^"]*xl:hidden[^"]*"/,
    "hamburger should remain visible below xl",
  );
  assert.match(
    openMarkup,
    /<nav id="mobile-nav" class="[^"]*xl:hidden[^"]*">/,
    "dropdown should remain available below xl",
  );
  assert.doesNotMatch(closedMarkup, /(?:^|\s)lg:flex(?:\s|$)/);
  assert.doesNotMatch(closedMarkup, /(?:^|\s)lg:hidden(?:\s|$)/);
});
