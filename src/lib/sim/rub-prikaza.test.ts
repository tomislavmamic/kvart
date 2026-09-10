import assert from "node:assert/strict";
import test from "node:test";

import { alfaRuba, SIRINA_RUBA } from "./rub-prikaza";

test("rub modela i sve izvan njega su prozirni", () => {
  for (const [vodoravno, okomito] of [[0, .5], [1, .5], [.5, 0], [.5, 1], [-.1, .5], [.5, 1.1]]) {
    assert.equal(alfaRuba(vodoravno, okomito), 0);
  }
});

test("središte ostaje nepromijenjeno, a prijelaz je jednak na sve četiri strane", () => {
  assert.equal(alfaRuba(.5, .5), 1);
  assert.equal(alfaRuba(SIRINA_RUBA, .5), 1);
  const pola = SIRINA_RUBA / 2;
  for (const [vodoravno, okomito] of [[pola, .5], [1 - pola, .5], [.5, pola], [.5, 1 - pola]]) {
    assert.ok(Math.abs(alfaRuba(vodoravno, okomito) - .5) < 1e-12);
  }
});
