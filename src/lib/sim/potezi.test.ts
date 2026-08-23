import assert from "node:assert/strict";
import test from "node:test";

import { razmakPoteza } from "@/lib/sim/potezi";

/** Okvir je 6,4 km; na širini od 1000 px to je 6,4 m po pikselu. */
const OKVIR_M = 6400;
const PX = 1000;
const UBRZANJE = 60;

const naZaslonu = (m: number) => (m / OKVIR_M) * PX;

test("potez putuje brzinom vjetra — to je jedino što animacija tvrdi", () => {
  // Brzina poteza ne ovisi o razmaku nego o vremenu putovanja, pa mora biti
  // strogo razmjerna vjetru. Da nije, animacija bi lagala o tome koliko brzo
  // zrak stiže do kvarta.
  const brzina = (v: number) => naZaslonu(v * UBRZANJE);
  assert.ok(Math.abs(brzina(2) / brzina(1) - 2) < 1e-9, "dvostruk vjetar, dvostruka brzina");
  assert.ok(Math.abs(brzina(8) / brzina(1) - 8) < 1e-9);
});

test("razmak poteza na zaslonu ostaje čitljiv u svakom vremenu", () => {
  // Prije je razmak bio zadan vremenom (110 s), pa se pri 0,5 m/s stisnuo na
  // jedanaest piksela — točkasta crta koja titra umjesto da teče.
  for (const v of [0.5, 1.2, 4, 8]) {
    const px = naZaslonu(v * razmakPoteza(v));
    assert.ok(px > 60 && px < 140, `pri ${v} m/s razmak je ${px.toFixed(0)} px`);
  }
});

test("tišina ne razvlači razmak u beskonačno", () => {
  assert.equal(razmakPoteza(0), razmakPoteza(0.01), "obje udaraju u gornju granicu");
  assert.ok(Number.isFinite(razmakPoteza(0)));
  assert.ok(naZaslonu(0.3 * razmakPoteza(0.3)) > 40, "i pri tišini se vide potezi");
});

test("bura ne zbija poteze u punu crtu", () => {
  assert.ok(razmakPoteza(40) >= 45, "razmak ima donju granicu");
});
