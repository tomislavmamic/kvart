import assert from "node:assert/strict";
import test from "node:test";

import { imeSata, satiZaDan, uRasponu, uTrenutak } from "./dojava-vrijeme";

test("sat se ispisuje kao raspon, i ponoć se ne prelije u 24", () => {
  assert.equal(imeSata(0), "00–01 h");
  assert.equal(imeSata(14), "14–15 h");
  assert.equal(imeSata(23), "23–00 h");
});

test("danas se ne nudi sat koji još nije došao, jučer stoji cijeli", () => {
  const sada = new Date(2026, 7, 25, 14, 37);
  assert.deepEqual(satiZaDan(true, sada).at(-1), 14, "tekući sat je zadnji");
  assert.equal(satiZaDan(true, sada).length, 15);
  assert.equal(satiZaDan(false, sada).length, 24, "jučer ima svih 24");

  // U pola jedan noću danas nudi samo ponoćni sat — ne nijedan.
  const nocu = new Date(2026, 7, 25, 0, 30);
  assert.deepEqual(satiZaDan(true, nocu), [0]);
});

test("jučer se računa po datumu, pa ga prijelaz na ljetno vrijeme ne pomakne", () => {
  // 29. 3. 2026. u 2 h kazaljka skače na 3 h: taj dan ima 23 sata. Oduzimanje
  // 24 h u milisekundama promašilo bi sat, pomak datuma ne.
  const poslijePrijelaza = new Date(2026, 2, 30, 10, 0);
  const jucer = uTrenutak(false, 10, poslijePrijelaza);
  assert.equal(jucer.getDate(), 29, "jučer je 29., ma koliko sati taj dan imao");
  assert.equal(jucer.getHours(), 10, "i to u deset, ne u devet");
});

test("odabrani trenutak nosi puni sat i traženi dan", () => {
  const sada = new Date(2026, 7, 25, 14, 37);
  const danas = uTrenutak(true, 9, sada);
  assert.equal(danas.getDate(), 25);
  assert.equal(danas.getHours(), 9);
  assert.equal(danas.getMinutes(), 0);
  assert.equal(danas.getSeconds(), 0);
  assert.equal(danas.getMilliseconds(), 0);
});

test("raspon prima zadnjih trideset dana, ali ne budućnost", () => {
  const sada = new Date(2026, 7, 25, 14, 0);
  assert.ok(uRasponu(uTrenutak(true, 13, sada), 30, sada));
  assert.ok(uRasponu(uTrenutak(false, 23, sada), 30, sada), "jučer navečer valja");
  assert.equal(
    uRasponu(new Date(sada.getTime() + 3 * 3_600_000), 30, sada),
    false,
    "budućnost ne",
  );
  assert.equal(
    uRasponu(new Date(sada.getTime() - 31 * 86_400_000), 30, sada),
    false,
    "prestaro ne",
  );
});
