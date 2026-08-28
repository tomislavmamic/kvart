import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { UpravljackaPloca, type PloceStanje } from "@/components/karepovac/sim/upravljacka-ploca";
import { ZADANA_BOJA } from "@/lib/sim/ljestvica";

const STANJE: PloceStanje = {
  prikaz: {
    tvari: {
      sumporovodik: { vidljiv: true, boja: ZADANA_BOJA.sumporovodik, jacina: 1 },
      merkaptani: { vidljiv: false, boja: ZADANA_BOJA.merkaptani, jacina: 1 },
    },
    vjetar: true,
    mirovanje: false,
  },
  podloga: "karta",
  reljef: false,
  zgrade: false,
  postaje: true,
};

function nacrtaj(stanje: PloceStanje = STANJE) {
  return renderToStaticMarkup(
    <UpravljackaPloca
      stanje={stanje}
      naPrikaz={() => {}}
      naStanje={() => {}}
      naSredinu={() => {}}
    />,
  );
}

test("prikaz se ne predstavlja kao mjerenje", () => {
  const html = nacrtaj();
  assert.match(html, /Ovo je prikaz, ne mjerenje/, "ograda mora stajati u ploči");
  assert.match(html, /nisu\s*provjereni mjerenjem/, "mora reći što nije provjereno");
});

test("zadana jačina ne tvrdi da je izmjerena emisija", () => {
  const html = nacrtaj();
  assert.doesNotMatch(
    html,
    /koliko ploha ispušta prema mjerenjima/,
    "prikaz ne zna koliko ploha ispušta — to je bazdarenje, a ono ovdje ne ulazi",
  );
  assert.match(html, /Zadana jačina/, "1× je zadana jačina prikaza, ne izmjerena");
});

test("pojačan izvor se označuje kao zamišljen", () => {
  const jace: PloceStanje = {
    ...STANJE,
    prikaz: {
      ...STANJE.prikaz,
      tvari: { ...STANJE.prikaz.tvari, sumporovodik: { vidljiv: true, boja: "jantar", jacina: 3 } },
    },
  };
  assert.match(nacrtaj(jace), /Zamišljeni slučaj: 3,0× od zadanog/);
});

test("ploča ne nabraja mjerenja — ona stoje na karti, uz točku mjerenja", () => {
  const html = nacrtaj();
  assert.doesNotMatch(html, /2,758/, "brojka pripada pribadači, ne ploči");
  assert.match(html, /uz samu točku mjerenja/, "ploča mora reći gdje su brojke");
});
