import assert from "node:assert/strict";
import test from "node:test";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { KAREPOVAC_NAV } from "@/lib/karepovac";

test("traka projekta je na uskom zaslonu jedan red koji se pomiče, a od md se lomi", async () => {
  const projectNav = await import("./project-nav");
  const KarepovacProjectNavView = Reflect.get(
    projectNav,
    "KarepovacProjectNavView",
  ) as ((props: { pathname: string }) => ReactNode) | undefined;

  assert.ok(
    KarepovacProjectNavView,
    "traka mora izložiti svoj prikaz, da se ugovor o rutama dade provjeriti bez preglednika",
  );

  const markup = renderToStaticMarkup(
    createElement(KarepovacProjectNavView, { pathname: "/karepovac/zrak" }),
  );

  // Jedan red od 44 px umjesto rešetke od tri reda: pomiče se vodoravno, a od
  // md se smije prelomiti jer ondje sve stane.
  assert.match(markup, /<div[^>]*class="[^"]*overflow-x-auto[^"]*md:flex-wrap[^"]*"/);
  assert.doesNotMatch(markup, /grid-cols-3/);

  // Broj se čita iz popisa, a ne prepisuje: kad se doda stranica, provjera
  // i dalje mjeri ono što treba — da nijedna pilula ne prelomi natpis ni ne
  // stisne ispod 44 px.
  const pilule = markup.match(/<a\b[^>]*href="\/karepovac[^"]*"[^>]*>/g) ?? [];
  assert.equal(pilule.length, KAREPOVAC_NAV.length);
  for (const pilula of pilule) {
    assert.match(pilula, /whitespace-nowrap/);
    assert.match(pilula, /shrink-0/);
    assert.match(pilula, /min-h-11/);
  }
  assert.match(markup, /aria-current="page"[^>]*>Pregled</);

  // Znak da traka ide dalje postoji samo dok se pomiče (ispod md).
  assert.match(markup, /aria-hidden="true"[^>]*class="[^"]*md:hidden[^"]*"/);
});
