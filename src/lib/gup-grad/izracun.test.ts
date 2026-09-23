import assert from "node:assert/strict";
import test from "node:test";

import { izracunajGodinu, pokrivenost, procijeniKomad, type Komad } from "@/lib/gup-grad/izracun";
import { ZADANA_PRAVILA, type Pravila } from "@/lib/gup-grad/pravila";

function komad(dio: Partial<Komad> = {}): Komad {
  return { klasa: 2, n: 100, zk: 0, z25: 0, pr: 0, os: 0, ze: 0, g: 0, ...dio };
}

const udio: Pravila = ZADANA_PRAVILA;
const prag: Pravila = { ...ZADANA_PRAVILA, nacin: "prag", prag: 0.2 };
const cijela: Pravila = { ...ZADANA_PRAVILA, nacin: "cijela" };

test("udio: iskorišten je samo pokriveni dio", () => {
  const r = procijeniKomad(komad({ zk: 30, z25: 30, g: 1 }), "M/K5", udio);
  assert.equal(r.iskoristeno, 30);
  assert.equal(r.uSkladu, 30);
  assert.equal(r.uSuprotnosti, 0);
});

test("prag: kuća na 30 % čestice broji cijelu česticu, na 10 % samo tlocrt", () => {
  assert.equal(procijeniKomad(komad({ zk: 30, g: 1 }), "M/K5", prag).iskoristeno, 100);
  assert.equal(procijeniKomad(komad({ zk: 10, g: 1 }), "M/K5", prag).iskoristeno, 10);
});

test("cijela: krhotina ispod najmanjeg traga ne pretvara česticu u iskorištenu", () => {
  assert.equal(procijeniKomad(komad({ zk: 2, g: 1 }), "M/K5", cijela).iskoristeno, 2);
  assert.equal(procijeniKomad(komad({ zk: 5, g: 1 }), "M/K5", cijela).iskoristeno, 100);
});

test("kuća u zaštitnom zelenilu je u suprotnosti, cesta kroz njega nije", () => {
  const r = procijeniKomad(komad({ zk: 20, pr: 30, g: 1 }), "Z5", udio);
  assert.equal(r.uSuprotnosti, 20);
  assert.equal(r.uSkladu, 30);
});

test("kombinirana namjena M/K5 dopušta i stanovanje i poslovanje", () => {
  assert.equal(procijeniKomad(komad({ zk: 20, g: 1 }), "M/K5", udio).uSuprotnosti, 0);
  assert.equal(procijeniKomad(komad({ zk: 20, g: 2 }), "M/K5", udio).uSuprotnosti, 0);
  // čista gospodarska zona stanovanje ne dopušta
  assert.equal(procijeniKomad(komad({ zk: 20, g: 1 }), "I/K", udio).uSuprotnosti, 20);
});

test("zgrada iz 3D modela koje nema u katastru: suprotna u zelenilu, dopuštena u gospodarskoj", () => {
  const k = komad({ zk: 0, z25: 25 });
  assert.equal(procijeniKomad(k, "Z1", udio).uSuprotnosti, 25);
  assert.equal(procijeniKomad(k, "I/K", udio).uSuprotnosti, 0);
  // izvor samo katastar tu zgradu ne vidi
  assert.equal(procijeniKomad(k, "Z1", { ...udio, zgrade: "katastar" }).iskoristeno, 0);
});

test("preklopljena mjerenja ne daju više od površine komada", () => {
  const d = pokrivenost(komad({ zk: 70, z25: 80, pr: 50, os: 40, g: 1 }), udio);
  assert.equal(d.reduce((s, [, v]) => s + v, 0), 100);
  assert.deepEqual(d.map(([v]) => v), ["stambena", "neevidentirana", "promet"]);
});

test("izracunajGodinu zbraja po klasi i množi pikselom", () => {
  const r = izracunajGodinu(
    {
      klasePx: { 2: 1000, 11: 500 },
      komadi: [komad({ zk: 40, g: 1 }), komad({ klasa: 11, zk: 10, g: 1 })],
      pikselM2: 4,
    },
    udio,
  );
  const m = r.find((x) => x.kod === "M/K5")!;
  const z = r.find((x) => x.kod === "Z5")!;
  assert.equal(m.ukupnoM2, 4000);
  assert.equal(m.iskoristenoM2, 160);
  assert.equal(z.uSuprotnostiM2, 40);
  assert.equal(z.suprotnoPoVrstiM2.stambena, 40);
});
