import assert from "node:assert/strict";
import test from "node:test";

import { KATEGORIJA_PO_KODU, KATEGORIJE, ZONA_GRADNJE, kategorija } from "./gradnja";
import { KLASE, type KodKlase } from "./model";
import { REGIJE } from "./regije";

const indeks = (kod: KodKlase) => KLASE.find((k) => k.kod === kod)!.indeks;
const id = (klasa: KodKlase, regija: number, neuredeno = false) => KATEGORIJA_PO_KODU.get(kategorija(indeks(klasa), regija, neuredeno))?.id;

test("svaka klasa namjene ima zonu gradnje, a kategorije jedinstvene kodove", () => {
  for (const k of KLASE) assert.ok(ZONA_GRADNJE[k.kod], k.kod);
  assert.equal(new Set(KATEGORIJE.map((k) => k.kod)).size, KATEGORIJE.length);
  assert.ok(KATEGORIJE.every((k) => k.kod > 0 && k.kod < 256));
});

test("zauzeto mjesto priječi gradnju u svakoj namjeni", () => {
  for (const kod of ["S", "M/K5", "I/K", "Z1", "P"] as const) {
    assert.equal(id(kod, REGIJE.zgrada), "zgrada");
    assert.equal(id(kod, REGIJE.okucnica), "okucnica");
    assert.equal(id(kod, REGIJE.parkiraliste), "koristeno");
    assert.equal(id(kod, REGIJE.ulica), "ulica");
  }
});

test("slobodno: namjena odlučuje prije razloga iz izračuna", () => {
  assert.equal(id("Z1", REGIJE.slobodno), "bez-zgrada");
  assert.equal(id("R4", REGIJE.usko), "bez-zgrada");
  assert.equal(id("P", REGIJE.slobodno), "rezerva-prometa");
  assert.equal(id("S", REGIJE.slobodno), "stambeno");
  assert.equal(id("M/K5", REGIJE.slobodno), "stambeno");
  assert.equal(id("I/K", REGIJE.slobodno), "nestambeno");
  assert.equal(id("T", REGIJE.slobodno), "nestambeno");
});

test("odredbe, UPU i veličina", () => {
  assert.equal(id("S", REGIJE.zabranjeno), "samo-rekonstrukcija");
  assert.equal(id("M/K5", REGIJE.premalo), "premalo");
  assert.equal(id("I/K", REGIJE.usko), "premalo");
  assert.equal(id("M/K5", REGIJE.ceka), "ceka-upu");
  assert.equal(id("M/K5", REGIJE.ceka, true), "uz-cestu-stambeno");
  assert.equal(id("S", REGIJE.ceka, true), "uz-cestu-stambeno");
  assert.equal(id("I/K", REGIJE.ceka, true), "uz-cestu-nestambeno");
  assert.equal(id("T", REGIJE.ceka, true), "uz-cestu-nestambeno");
  assert.equal(id("I/K", REGIJE.ceka), "ceka-upu");
  // javne i društvene zgrade smiju se graditi i prije UPU-a (čl. 105. st. 5.)
  assert.equal(id("D", REGIJE.ceka), "nestambeno");
});

test("neobojeni koridor ulice s lista 1: slobodno nije za gradnju, zauzeto ostaje zauzeto", () => {
  const koridor = (klasa: KodKlase, regija: number) => KATEGORIJA_PO_KODU.get(kategorija(indeks(klasa), regija, false, true))?.id;
  assert.equal(koridor("M/K5", REGIJE.slobodno), "koridor");
  assert.equal(koridor("S", REGIJE.ceka), "koridor");
  assert.equal(koridor("I/K", REGIJE.premalo), "koridor");
  assert.equal(koridor("M/K5", REGIJE.zgrada), "zgrada");
  assert.equal(koridor("S", REGIJE.ulica), "ulica");
  assert.equal(kategorija(0, REGIJE.slobodno, false, true), 0);
});

test("piksel bez čestice ili nepoznate klase nema kategoriju", () => {
  assert.equal(kategorija(0, REGIJE.slobodno, false), 0);
  assert.equal(kategorija(indeks("S"), 0, false), 0);
});
