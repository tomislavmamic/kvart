import assert from "node:assert/strict";
import test from "node:test";

import { izracunajGodinu, komadIzNiza } from "@/lib/gup-grad/izracun";
import { ZADANA_PRAVILA } from "@/lib/gup-grad/pravila";
import { stanje, sudCestice, type SvojstvaCestice } from "@/lib/gup-grad/provjera";

// kuća (stambena, katastar) na česti u M/K5 i komad u zaštitnom zelenilu s garažom i kućom
const cestica: SvojstvaCestice = {
  i: 0,
  ko: "SPLIT",
  kc: "1/1",
  a: 800,
  k: { "2025": [[2, 150, 30, 32, 32, 5, 0, 0, 0, 0, 0, 0, 1], [11, 50, 10, 10, 10, 0, 0, 0, 0, 0, 0, 0, 1]] },
};

test("sud čestice zbraja komade istim pravilima kao /gup", () => {
  const s = sudCestice(cestica, 2025, ZADANA_PRAVILA);
  // 5 px ulice (20 m²) izuzeto iz zone
  assert.equal(s.m2, 780);
  assert.equal(s.ulica, 20);
  assert.equal(s.komadi.length, 2);
  assert.equal(s.pretezita?.kod, "M/K5");
  // isto što izracunajGodinu pripisuje tim komadima
  const r = izracunajGodinu(
    {
      klasePx: { 2: 150, 11: 50 },
      komadi: cestica.k["2025"]!.map((a) => komadIzNiza(a, 0, true)),
      pikselM2: 4,
    },
    ZADANA_PRAVILA,
  );
  // ulica izuzeta iz zone ide u P; čestica je broji kao `ulica`, ne kao iskorišteno
  const zbroj = r.filter((x) => x.kod !== "P").reduce((a, x) => a + x.iskoristenoM2, 0);
  assert.equal(r.find((x) => x.kod === "P")?.uliceM2, s.ulica);
  assert.equal(s.iskoristeno, zbroj);
  // kuća u Z5 nosi cijeli komad kao okućnicu, i sve je protivno (50 px)
  assert.equal(s.uSuprotnosti, 200);
  assert.deepEqual(s.komadi[1].protivneVrste, ["stambena", "okucnica"]);
  // okućnica kuće po planu nije protivna
  assert.deepEqual(s.komadi[0].protivneVrste, []);
});

test("stanja: slobodna, u skladu, djelomično i protivno", () => {
  assert.equal(stanje(1000, 10, 0), "slobodna");
  // velika čestica s trakom ceste uz rub ostaje slobodna
  assert.equal(stanje(5000, 100, 0), "slobodna");
  assert.equal(stanje(1000, 800, 0), "u-skladu");
  // iskorištena, a četvrtina i više slobodno za gradnju
  assert.equal(stanje(1000, 300, 0), "djelomicno-slobodna");
  assert.equal(stanje(1000, 300, 50), "djelomicno-protivno");
  assert.equal(stanje(1000, 300, 200), "protivno");
  // krhotina ispod 10 m² ne čini česticu protivnom
  assert.equal(stanje(1000, 800, 8), "u-skladu");
  // slobodni dio sav ostatak → ostatak; gotovo sve ulica → ulica
  assert.equal(stanje(200, 0, 0, 0, 200), "ostatak");
  // slobodno, ali odredbe ne dopuštaju gradnju
  assert.equal(stanje(2000, 0, 0, 0, 0, 2000), "ostatak");
  assert.equal(stanje(1000, 300, 0, 0, 0, 700), "u-skladu");
  assert.equal(stanje(10, 0, 0, 990, 0), "ulica");
});

test("godina bez komada daje praznu, slobodnu česticu", () => {
  const s = sudCestice(cestica, 2006, ZADANA_PRAVILA);
  assert.equal(s.komadi.length, 0);
  assert.equal(s.stanje, "slobodna");
  assert.equal(s.pretezita, null);
});
