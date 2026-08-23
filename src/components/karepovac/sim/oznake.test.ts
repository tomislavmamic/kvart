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

test("svaka postaja vjetra ima provjereno mjesto", () => {
  // AZO ne objavljuje koordinate; izmišljena točka na karti izgleda jednako
  // pouzdano kao izmjerena, pa se te postaje ne zabadaju.
  // Sve su nađene na terenu ili u popisu izvora; nijedna nije pogođena.
  assert.ok(Math.abs(POSTAJE.split3.lat - 43.504211) < 1e-5);
  assert.ok(Math.abs(POSTAJE.split2.lat - 43.518471) < 1e-5);
  assert.equal(POSTAJE.marjan.lat, 43.508333);
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

test("postaja sa satnim nizom prati klizač, i u prošlosti", () => {
  // AZO objavljuje satni niz, pa Split-2 ne mora čekati sadašnji sat.
  const niz = {
    sat: "2026-08-21T15:00:00.000Z",
    smjerOd: 45,
    brzina: 2.2,
    tisina: false,
    izvor: "split2" as const,
  };
  const n = natpisVjetra(kadar(), "Split-2", undefined, niz);
  assert.equal(n.vrijednost, "2,2 SI");
  assert.equal(n.nema, false, "niz ima povijest, pa brojka stoji i unatrag");
});

test("satni niz ima prednost pred zadnjim očitanjem", () => {
  const niz = {
    sat: "2026-08-21T15:00:00.000Z",
    smjerOd: 45,
    brzina: 2.2,
    tisina: false,
    izvor: "split2" as const,
  };
  const n = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "Split-2", OCITANJE, niz);
  assert.equal(n.vrijednost, "2,2 SI", "za odabrani sat vrijedi niz, ne zadnje očitanje");
});
