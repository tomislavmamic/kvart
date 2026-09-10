import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LegendaTvari } from "@/components/karepovac/sim/legenda-tvari";
import type { PostavkePrikaza } from "@/components/karepovac/sim/sim-scena";
import { bojaZa, uGradijent } from "@/lib/sim/ljestvica";

const PRIKAZ: PostavkePrikaza = {
  tvari: {
    merkaptani: { vidljiv: true, boja: "modra", jacina: 1 },
    sumporovodik: { vidljiv: true, boja: "jantar", jacina: 1 },
  },
  vjetar: true,
  mirovanje: false,
};

test("obje tvari imaju vlastitu legendu iz ljestvice karte", () => {
  const html = renderToStaticMarkup(<LegendaTvari prikaz={PRIKAZ} naPromjenu={() => {}} />);
  assert.equal(html.match(/aria-pressed="true"/g)?.length, 2);
  assert.ok(html.indexOf("Merkaptani") < html.indexOf("H₂S"));
  for (const tvar of ["merkaptani", "sumporovodik"] as const) {
    assert.ok(html.includes(uGradijent(bojaZa(PRIKAZ.tvari[tvar].boja, tvar).ljestvica)));
  }
});

test("skrivena tvar zadržava legendu i stanje se ne oslanja samo na boju", () => {
  const prikaz = { ...PRIKAZ, tvari: { ...PRIKAZ.tvari, merkaptani: { ...PRIKAZ.tvari.merkaptani, vidljiv: false, jacina: 2 } } };
  const html = renderToStaticMarkup(<LegendaTvari prikaz={prikaz} naPromjenu={() => {}} />);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /skriveno/);
  assert.match(html, /line-through/);
  assert.match(html, /2,0×/);
});

test("klik na legendu mijenja samo odabranu tvar", () => {
  const promjene: [string, boolean][] = [];
  const prikaz = LegendaTvari({ prikaz: PRIKAZ, naPromjenu: (tvar, vidljiv) => promjene.push([tvar, vidljiv]) });
  prikaz.props.children[0].props.onClick();
  assert.deepEqual(promjene, [["merkaptani", false]]);
  assert.equal(PRIKAZ.tvari.sumporovodik.vidljiv, true);
});
