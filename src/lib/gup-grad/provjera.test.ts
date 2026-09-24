import assert from "node:assert/strict";
import test from "node:test";

import { izracunajGodinu, komadIzNiza } from "@/lib/gup-grad/izracun";
import { ZADANA_PRAVILA } from "@/lib/gup-grad/pravila";
import { sklad, sudCestice, uZoniKrhotina, type SvojstvaCestice } from "@/lib/gup-grad/provjera";

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

test("sklad s planom sudi samo iskorišteno", () => {
  assert.equal(sklad(0, 0), "nema");
  assert.equal(sklad(800, 0), "po-planu");
  // krhotina ispod 10 m² ne čini česticu protivnom
  assert.equal(sklad(800, 8), "po-planu");
  assert.equal(sklad(300, 50), "djelomicno");
  assert.equal(sklad(300, 200), "protivno");
});

test("tri osi čestice: namjena, iskorištenost kao broj, sklad; slobodno po razlogu", () => {
  // prazna čestica u M/K5 (100 px), od toga 40 px širokog slobodnog
  const prazna: SvojstvaCestice = { i: 0, ko: "SPLIT", kc: "2/1", a: 400, k: { "2025": [[2, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40]] } };
  const s = sudCestice(prazna, 2025, ZADANA_PRAVILA);
  assert.equal(s.pretezita?.kod, "M/K5");
  assert.equal(s.iskoristenost, 0);
  assert.equal(s.sklad, "nema");
  assert.equal(s.slobodno.usko, 240);
  assert.equal(s.slobodno.zaGradnju, 160);
  assert.equal(s.slobodnoNijeZaGradnju, false);
  // sva uska: slobodno, ali nije za gradnju
  const uska = sudCestice({ ...prazna, k: { "2025": [[2, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] } }, 2025, ZADANA_PRAVILA);
  assert.equal(uska.slobodnoNijeZaGradnju, true);
  // gotovo sva ulica: namjena „Ulice”
  const ulica = sudCestice({ ...prazna, k: { "2025": [[2, 100, 0, 0, 0, 98, 0, 0, 0, 0, 0, 0, 0, 0]] } }, 2025, ZADANA_PRAVILA);
  assert.equal(ulica.jeUlica, true);
  assert.equal(ulica.iskoristenost, null);
});

test("godina bez komada daje praznu, slobodnu česticu", () => {
  const s = sudCestice(cestica, 2006, ZADANA_PRAVILA);
  assert.equal(s.komadi.length, 0);
  assert.equal(s.iskoristenost, null);
  assert.equal(s.sklad, "nema");
  assert.equal(s.pretezita, null);
});

test("karta: uski pojas je ostatak, a posuđena okućnica iskorištena kao kod /gup", () => {
  // prazna čestica u M/K5, 100 px, od toga 40 px širokog slobodnog
  const prazna: SvojstvaCestice = { i: 0, ko: "SPLIT", kc: "2/1", a: 400, k: { "2025": [[2, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40]] } };
  const s = sudCestice(prazna, 2025, ZADANA_PRAVILA);
  assert.equal(s.komadi[0].usko, 240);
  assert.equal(s.ostatak, 240);
  // 30 px su vrt susjedne kuće (10 px od toga uz kuću protivnu planu)
  const v = sudCestice(prazna, 2025, ZADANA_PRAVILA, 4, new Set(), undefined, new Map([[2, [30, 10] as const]]));
  assert.equal(v.komadi[0].vrtSusjeda, 120);
  assert.equal(v.iskoristeno, 120);
  assert.equal(Math.round(v.uSuprotnosti), 40);
  // vrt se uzima prvo od uskog pojasa
  assert.equal(v.komadi[0].usko, 120);
});

test("čestica kojoj je u zoni tek krhotina (more, luka) crta se samo obrisom", () => {
  // k.č. 15991 k.o. Split: 591 ha mora, u zonama ~0,3 ha
  assert.equal(uZoniKrhotina({ m2: 3000, ulica: 400 }, 5_908_888), true);
  // obična čestica sva u zoni, i ona uz rub obuhvata s pola u zoni
  assert.equal(uZoniKrhotina(sudCestice(cestica, 2025, ZADANA_PRAVILA), cestica.a), false);
  assert.equal(uZoniKrhotina({ m2: 400, ulica: 0 }, 800), false);
  // bez površine iz katastra nema suda
  assert.equal(uZoniKrhotina({ m2: 0, ulica: 0 }, 0), false);
});
