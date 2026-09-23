import assert from "node:assert/strict";
import test from "node:test";

import { izracunajGodinu } from "@/lib/gup-grad/izracun";
import { ZADANA_PRAVILA } from "@/lib/gup-grad/pravila";
import { stanje, sudCestice, type SvojstvaCestice } from "@/lib/gup-grad/provjera";

// kuća (stambena, katastar) na česti u M/K5 i komad u zaštitnom zelenilu s garažom i kućom
const cestica: SvojstvaCestice = {
  i: 0,
  ko: "SPLIT",
  kc: "1/1",
  a: 800,
  k: { "2025": [[2, 150, 30, 32, 5, 0, 0, 1], [11, 50, 10, 10, 0, 0, 0, 1]] },
};

test("sud čestice zbraja komade istim pravilima kao /gup", () => {
  const s = sudCestice(cestica, 2025, ZADANA_PRAVILA);
  assert.equal(s.m2, 800);
  assert.equal(s.komadi.length, 2);
  assert.equal(s.pretezita?.kod, "M/K5");
  // isto što izracunajGodinu pripisuje tim komadima
  const r = izracunajGodinu(
    {
      klasePx: { 2: 150, 11: 50 },
      komadi: cestica.k["2025"]!.map(([klasa, n, zk, z25, pr, os, ze, g]) => ({ klasa, n, zk, z25, pr, os, ze, g })),
      pikselM2: 4,
    },
    ZADANA_PRAVILA,
  );
  const zbroj = r.reduce((a, x) => a + x.iskoristenoM2, 0);
  assert.equal(s.iskoristeno, zbroj);
  assert.equal(s.uSuprotnosti, 40);
  assert.deepEqual(s.komadi[1].protivneVrste, ["stambena"]);
});

test("stanja: slobodna, u skladu, djelomično i protivno", () => {
  assert.equal(stanje(1000, 10, 0), "slobodna");
  // velika čestica s trakom ceste uz rub ostaje slobodna
  assert.equal(stanje(5000, 100, 0), "slobodna");
  assert.equal(stanje(1000, 300, 0), "u-skladu");
  assert.equal(stanje(1000, 300, 50), "djelomicno-protivno");
  assert.equal(stanje(1000, 300, 200), "protivno");
  // krhotina ispod 10 m² ne čini česticu protivnom
  assert.equal(stanje(1000, 300, 8), "u-skladu");
});

test("godina bez komada daje praznu, slobodnu česticu", () => {
  const s = sudCestice(cestica, 2006, ZADANA_PRAVILA);
  assert.equal(s.komadi.length, 0);
  assert.equal(s.stanje, "slobodna");
  assert.equal(s.pretezita, null);
});
