import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { KAREPOVAC_PHASES } from "@/lib/karepovac";
import { PreparationBadge, PreparationNotice } from "./project-components";

test("obavijest o pripremi kaže koji je korak sada, iz plana, bez datuma", () => {
  const markup = renderToStaticMarkup(<PreparationNotice />);

  // Isti korak kao na pregledu: obavijest ne smije reći nešto drugo od plana.
  assert.match(markup, new RegExp(`Sada: ${KAREPOVAC_PHASES[0].title}`));
  assert.match(markup, /tko vodi projekt i tko smije primati donacije/);
  assert.match(markup, /Kad to bude, otvaraju se prijave i donacije/);
  // Datuma nema dok ga netko stvarno ne upiše.
  assert.doesNotMatch(markup, /Zadnja promjena/);
  // Bijela kartica sa značkom, ne žuta ploha.
  assert.doesNotMatch(markup, /bg-amber-50/);
  assert.match(markup, /U pripremi/);
});

test("sažeta obavijest zadržava korak, a ispušta rečenicu", () => {
  const markup = renderToStaticMarkup(<PreparationNotice compact />);
  assert.match(markup, /Sada: /);
  assert.doesNotMatch(markup, /Kad to bude/);
});

test("značka stanja nosi boje statusa „U tijeku”, jedine žute u sustavu", () => {
  const markup = renderToStaticMarkup(<PreparationBadge />);
  assert.match(markup, /bg-amber-100/);
  assert.match(markup, /text-amber-800/);
  assert.match(markup, />U pripremi</);
});
