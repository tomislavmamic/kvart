import assert from "node:assert/strict";
import test from "node:test";
import { pomakTipkom, rezovi } from "../src/lib/karta-klizac";

/**
 * Klizač bez DOM-a.
 *
 * Ispituje se ono što je račun — gdje pada rez i kamo ga tipka pomiče — jer
 * je upravo tipkovnički dio jednom već bio slomljen a da se rukom nije
 * primijetilo: razdjelnik je mišem radio, a tipkovnicom nije postojao
 * (WCAG 2.1.1, razina A).
 */

test("na pola je rez na pola, a obje strane pokrivaju cijelo okno", () => {
  const r = rezovi({ x: 0, y: 0 }, { x: 800, y: 600 }, 800, 0.5);
  assert.equal(r.lijevo, "rect(0px,400px,600px,0px)");
  assert.equal(r.desno, "rect(0px,800px,600px,400px)");
  assert.equal(r.drska, 400);
  assert.equal(r.posto, 50);
});

test("rez se računa u koordinatama sloja, a drška u koordinatama spremnika", () => {
  // Leaflet pri pomicanju karte pomiče sloj ispod nepomičnog spremnika. Jedan
  // sustav za oboje značio bi da rez putuje pri svakom povlačenju karte.
  const r = rezovi({ x: -120, y: -40 }, { x: 680, y: 560 }, 800, 0.25);
  assert.equal(r.lijevo, "rect(-40px,80px,560px,-120px)");
  assert.equal(r.desno, "rect(-40px,680px,560px,80px)");
  assert.equal(r.drska, 200);
});

test("krajnji položaji daju jednu stranu punu, drugu praznu", () => {
  const lijevi = rezovi({ x: 0, y: 0 }, { x: 800, y: 600 }, 800, 0);
  assert.equal(lijevi.drska, 0);
  assert.equal(lijevi.posto, 0);
  const desni = rezovi({ x: 0, y: 0 }, { x: 800, y: 600 }, 800, 1);
  assert.equal(desni.drska, 800);
  assert.equal(desni.posto, 100);
});

test("strelice pomiču rez za 2 %, PageUp/Down za 10 %", () => {
  assert.equal(pomakTipkom(0.5, "ArrowRight"), 0.52);
  assert.equal(pomakTipkom(0.5, "ArrowUp"), 0.52);
  assert.ok(Math.abs(pomakTipkom(0.5, "ArrowLeft")! - 0.48) < 1e-9);
  assert.ok(Math.abs(pomakTipkom(0.5, "ArrowDown")! - 0.48) < 1e-9);
  assert.ok(Math.abs(pomakTipkom(0.5, "PageUp")! - 0.6) < 1e-9);
  assert.ok(Math.abs(pomakTipkom(0.5, "PageDown")! - 0.4) < 1e-9);
});

test("Home i End bacaju rez na rub", () => {
  assert.equal(pomakTipkom(0.37, "Home"), 0);
  assert.equal(pomakTipkom(0.37, "End"), 1);
});

test("rez se ne može izgurati izvan okna", () => {
  assert.equal(pomakTipkom(0, "ArrowLeft"), 0);
  assert.equal(pomakTipkom(1, "ArrowRight"), 1);
  assert.equal(pomakTipkom(0.05, "PageDown"), 0);
});

test("tipke koje nisu za klizač vraćaju null i ne troše događaj", () => {
  // Vraćanje broja ovdje značilo bi `preventDefault` na svakoj tipki, pa se
  // s razdjelnika ne bi moglo ni tabom otići.
  for (const tipka of ["a", "Enter", "Escape", "Tab", " ", "Shift"]) {
    assert.equal(pomakTipkom(0.5, tipka), null, `${tipka} nije odbijena`);
  }
});
