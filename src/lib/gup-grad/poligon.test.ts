import assert from "node:assert/strict";
import test from "node:test";

import { ispod, povrsina, razinaZaUdio, sirinaNaVisini, type Tocka } from "@/lib/gup-grad/poligon";

const kvadrat: Tocka[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const trokut: Tocka[] = [
  [0, 10],
  [10, 10],
  [5, 0],
];

test("površina i rez ispod crte", () => {
  assert.equal(povrsina(kvadrat), 100);
  assert.equal(povrsina(ispod(kvadrat, 4)), 60);
});

test("razina punjenja daje traženi udio i u nepravilnom obliku", () => {
  assert.ok(Math.abs(razinaZaUdio(kvadrat, 0.3) - 7) < 1e-6);
  for (const u of [0.1, 0.5, 0.9]) {
    const y = razinaZaUdio(trokut, u);
    assert.ok(Math.abs(povrsina(ispod(trokut, y)) / povrsina(trokut) - u) < 1e-6);
  }
  assert.equal(razinaZaUdio(trokut, 0), 10);
  assert.equal(razinaZaUdio(trokut, 1), 0);
});

test("širina na visini", () => {
  assert.equal(sirinaNaVisini(trokut, 5), 5);
  assert.equal(sirinaNaVisini(kvadrat, 20), 0);
});
