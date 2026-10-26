import assert from "node:assert/strict";
import test from "node:test";

import { KATEGORIJA_PO_ID, KATEGORIJA_PO_KODU, KATEGORIJE, PLAN_NA_SNAZI, ZONA_GRADNJE, kategorija, kodNaKarti, kodPiksela, razlozi } from "./gradnja";
import { KLASE, type KodKlase } from "./model";
import { REGIJE } from "./regije";

const indeks = (kod: KodKlase) => KLASE.find((k) => k.kod === kod)!.indeks;
const id = (klasa: KodKlase, regija: number, neuredeno = false) => KATEGORIJA_PO_KODU.get(kategorija(indeks(klasa), regija, { neuredeno }))?.id;

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
  const koridor = (klasa: KodKlase, regija: number) => KATEGORIJA_PO_KODU.get(kategorija(indeks(klasa), regija, { koridor: true }))?.id;
  assert.equal(koridor("M/K5", REGIJE.slobodno), "koridor");
  assert.equal(koridor("S", REGIJE.ceka), "koridor");
  assert.equal(koridor("I/K", REGIJE.premalo), "koridor");
  assert.equal(koridor("M/K5", REGIJE.zgrada), "zgrada");
  assert.equal(koridor("S", REGIJE.ulica), "ulica");
  assert.equal(kategorija(0, REGIJE.slobodno, { koridor: true }), 0);
});

test("put i preusko: slobodno nije za gradnju, zauzeto i namjena bez zgrada ostaju", () => {
  const sa = (klasa: KodKlase, regija: number, u: { put?: boolean; preusko?: boolean }) =>
    KATEGORIJA_PO_KODU.get(kategorija(indeks(klasa), regija, u))?.id;
  assert.equal(sa("M/K5", REGIJE.slobodno, { put: true }), "put");
  assert.equal(sa("I/K", REGIJE.ceka, { put: true }), "put");
  assert.equal(sa("M/K5", REGIJE.zgrada, { put: true }), "zgrada");
  assert.equal(sa("Z1", REGIJE.slobodno, { put: true }), "bez-zgrada");
  assert.equal(sa("S", REGIJE.slobodno, { preusko: true }), "premalo");
  assert.equal(sa("I/K", REGIJE.slobodno, { preusko: true }), "premalo");
  assert.equal(sa("D", REGIJE.ceka, { preusko: true }), "premalo");
  // preusko ne mijenja ono što ionako nije za gradnju
  assert.equal(sa("M/K5", REGIJE.ceka, { preusko: true }), "ceka-upu");
  assert.equal(sa("S", REGIJE.zabranjeno, { preusko: true }), "samo-rekonstrukcija");
});

test("vojna zona, gradski projekt, golf i odmaci", () => {
  const sa = (klasa: KodKlase, regija: number, u: Parameters<typeof kategorija>[2] = {}) =>
    KATEGORIJA_PO_KODU.get(kategorija(indeks(klasa), regija, u))?.id;
  // vojna zona cijela, i izgrađena
  assert.equal(sa("N", REGIJE.slobodno), "vojska");
  assert.equal(sa("N", REGIJE.zgrada), "vojska");
  // gradski projekt: slobodno čeka projekt, izgrađeno ostaje izgrađeno
  assert.equal(sa("M/K5", REGIJE.slobodno, { gradskiProjekt: true }), "gradski-projekt");
  assert.equal(sa("I/K", REGIJE.ceka, { gradskiProjekt: true }), "gradski-projekt");
  assert.equal(sa("M/K5", REGIJE.zgrada, { gradskiProjekt: true }), "zgrada");
  // golf: igralište bez smještaja, ne zemljište za zgrade
  assert.equal(sa("R5", REGIJE.slobodno), "bez-zgrada");
  // zgrada ne stane uz odmake samo gdje bi se inače gradilo
  assert.equal(sa("S", REGIJE.slobodno, { odmaci: true }), "odmaci");
  assert.equal(sa("S", REGIJE.ceka, { odmaci: true, neuredeno: true }), "odmaci");
  assert.equal(sa("M/K5", REGIJE.ceka, { odmaci: true }), "ceka-upu");
  assert.equal(sa("S", REGIJE.slobodno, { odmak: true }), "odmak");
  assert.equal(sa("M/K5", REGIJE.slobodno, { ostatakKuce: true }), "ostatak-kuce");
  assert.equal(sa("M/K5", REGIJE.zgrada, { ostatakKuce: true }), "zgrada");
  assert.equal(sa("I/K", REGIJE.slobodno, { odmak: true }), "odmak");
});

test("bajt pločice nosi razlog i vlasnika javnog zemljišta", () => {
  for (const k of KATEGORIJE)
    for (const v of [0, 1, 2, 3, 4, PLAN_NA_SNAZI]) assert.deepEqual(razlozi(kodPiksela(k.kod, v)), { kategorija: k.kod, vlasnik: v });
  assert.ok(KATEGORIJE.every((k) => k.kod < 32));
});

test("piksel bez čestice ili nepoznate klase nema kategoriju", () => {
  assert.equal(kategorija(0, REGIJE.slobodno), 0);
  assert.equal(kategorija(indeks("S"), 0), 0);
});

test("na karti: javno kao javno (osim vojske), slobodno pod planom na snazi kao „po planu”", () => {
  const K = KATEGORIJA_PO_ID;
  assert.equal(kodNaKarti(K.stambeno.kod, 0), K.stambeno.kod);
  assert.equal(kodNaKarti(K.stambeno.kod, 2), K.javno.kod);
  assert.equal(kodNaKarti(K.vojska.kod, 1), K.vojska.kod);
  assert.equal(kodNaKarti(K.nestambeno.kod, PLAN_NA_SNAZI), K["po-planu"].kod);
});
