import assert from "node:assert/strict";
import test from "node:test";

import { natpisMjerenja, natpisVjetra } from "@/components/karepovac/sim/oznake";
import type { Kadar } from "@/lib/sim/kadrovi";
import { SIM_POSTAJE } from "@/lib/sim/postaje-satno";
import { POSTAJE, type Vjetar } from "@/lib/vjetar";

const K1 = SIM_POSTAJE[0];
const K2 = SIM_POSTAJE[1];

function kadar(p: Partial<Kadar> = {}): Kadar {
  return {
    sat: "2026-08-21T15:00:00.000Z",
    pomak: -1,
    vrsta: "izmjereno",
    dostupnost: "spreman",
    stanje: { smjerOd: 112.5, brzina: 1.2, dubina: 80 },
    vjetar: null,
    izvor: "split3",
    ocitanja: [
      { postaja: "k1", tvar: "sumporovodik", vrijednost: 2.758, jedinica: "µg/m³", ispodGranice: false },
      { postaja: "k2", tvar: "merkaptani", vrijednost: null, jedinica: "µg/m³", ispodGranice: false },
    ],
    ...p,
  };
}

const OCITANJE: Vjetar = {
  postaja: "marjan",
  smjerOd: 270,
  brzina: 3.4,
  tisina: false,
  promjenjiv: false,
  opazeno: "2026-08-21T15:00:00.000Z",
};

test("izmjerena vrijednost stoji uz svoju tvar", () => {
  const n = natpisMjerenja(kadar(), K1);
  assert.equal(n.kratica, "H₂S");
  assert.equal(n.vrijednost, "2,76");
  assert.equal(n.nema, false);
});

test("postaja koja šuti ostaje na karti, s prazninom umjesto nule", () => {
  const n = natpisMjerenja(kadar(), K2);
  assert.equal(n.vrijednost, "nema");
  assert.equal(n.nema, true, "šutnja se mora čitati drukčije od izmjerenog");
});

test("prognozirani sat ne nosi brojku", () => {
  const n = natpisMjerenja(kadar({ vrsta: "prognoza", ocitanja: [] }), K1);
  assert.equal(n.vrijednost, "—");
  assert.equal(n.nema, true);
});

test("bez kadra se ne izmišlja vrijednost", () => {
  assert.equal(natpisMjerenja(null, K1).vrijednost, "—");
});

test("postaja vjetra pokazuje brojku samo na sadašnjem satu", () => {
  const sada = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "Split-Marjan", OCITANJE);
  assert.equal(sada.vrijednost, "3,4 Z", "zapadnjak pri 3,4 m/s");
  assert.equal(sada.nema, false);

  // Isto očitanje, ali klizač je u prošlosti: DHMZ i METAR nemaju povijest,
  // pa bi ista brojka ondje bila tvrdnja koju nitko nije izmjerio.
  const prije = natpisVjetra(kadar(), "Split-Marjan", OCITANJE);
  assert.equal(prije.vrijednost, "bez povijesti");
  assert.equal(prije.nema, true);
});

test("postaja koja trenutačno ne javlja to i kaže", () => {
  const n = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "Split-Marjan", undefined);
  assert.equal(n.vrijednost, "šuti");
  assert.equal(n.nema, true);
});

test("tišina se piše riječju, jer smjer tada ništa ne znači", () => {
  const n = natpisVjetra(
    kadar({ vrsta: "sada", pomak: 0 }),
    "Split-Marjan",
    { ...OCITANJE, brzina: 0.2, tisina: true },
  );
  assert.equal(n.vrijednost, "tišina");
});

test("zabadaju se samo postaje kojima izvor objavljuje mjesto", () => {
  // AZO ne objavljuje koordinate; izmišljena točka na karti izgleda jednako
  // pouzdano kao izmjerena, pa se te postaje ne zabadaju.
  assert.equal(POSTAJE.split3.lat, null);
  assert.equal(POSTAJE.split2.lat, null);
  assert.equal(POSTAJE.marjan.lat, 43.508);
  assert.equal(POSTAJE.aerodrom.lon, 16.301);
  assert.deepEqual(
    [POSTAJE.aerodrom.lat, POSTAJE.aerodrom.lon],
    [POSTAJE.ldsp.lat, POSTAJE.ldsp.lon],
    "METAR mjeri na istoj zračnoj luci, pa je to jedna točka",
  );
});

test("postaje uz plohu stoje na izmjerenoj točki, ne na AZO-ovu zaokruženju", () => {
  assert.ok(
    Math.abs(K1.lat - 43.5166505) < 1e-6 && Math.abs(K1.lon - 16.5169123) < 1e-6,
    "koordinata mora biti precizna, ne zaokružena na tri decimale",
  );
  assert.deepEqual([K1.lat, K1.lon], [K2.lat, K2.lon], "obje postaje su na istom mjestu");
});
