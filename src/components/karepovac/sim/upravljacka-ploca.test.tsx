import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { UpravljackaPloca, type PloceStanje } from "@/components/karepovac/sim/upravljacka-ploca";
import { ZADANA_BOJA } from "@/lib/sim/ljestvica";
import type { Kadar } from "@/lib/sim/kadrovi";

const STANJE: PloceStanje = {
  prikaz: {
    tvari: {
      sumporovodik: { vidljiv: true, boja: ZADANA_BOJA.sumporovodik, jacina: 1 },
      merkaptani: { vidljiv: false, boja: ZADANA_BOJA.merkaptani, jacina: 1 },
    },
    strelice: true,
    cestice: true,
    mirovanje: false,
  },
  podloga: "karta",
  reljef: false,
  zgrade: false,
  postaje: true,
};

const KADAR: Kadar = {
  sat: "2026-08-21T15:00:00.000Z",
  pomak: -1,
  vrsta: "izmjereno",
  dostupnost: "spreman",
  stanje: { smjerOd: 112.5, brzina: 1.2, dubina: 80 },
  vjetar: { sat: "2026-08-21T15:00:00.000Z", smjerOd: 112.5, brzina: 1.2, tisina: false, izvor: "split3" },
  izvor: "split3",
  ocitanja: [
    { postaja: "k1", tvar: "sumporovodik", vrijednost: 2.758, jedinica: "µg/m³", ispodGranice: false },
    { postaja: "k2", tvar: "merkaptani", vrijednost: null, jedinica: "µg/m³", ispodGranice: false },
  ],
};

function nacrtaj(stanje: PloceStanje = STANJE, kadar: Kadar | null = KADAR) {
  return renderToStaticMarkup(
    <UpravljackaPloca
      stanje={stanje}
      kadar={kadar}
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

test("postaja koja šuti ostaje vidljiva, s prazninom", () => {
  const html = nacrtaj();
  assert.match(html, /Karepovac 2/);
  assert.match(html, /Nema mjerenja/, "šutnja se piše, ne prešućuje");
  assert.match(html, /2,758/, "izmjereno se pokazuje kako jest");
});

test("prognozirani sat ne pokazuje mjerenja nego kaže da ih nema", () => {
  const html = nacrtaj(STANJE, { ...KADAR, vrsta: "prognoza", pomak: 2, ocitanja: [] });
  assert.match(html, /Sat još nije prošao/);
  assert.doesNotMatch(html, /2,758/, "budućnost ne smije nositi mjerenje");
});
