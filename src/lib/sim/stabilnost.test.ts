import assert from "node:assert/strict";
import test from "node:test";

import { mnoziteljRazreda, NEUTRALNO, razredStabilnosti } from "./stabilnost";

test("Turnerova shema: sunčan dan uz slab vjetar je A, vedra noć uz slab vjetar je F", () => {
  assert.equal(razredStabilnosti(1.5, 800, 10), 0);
  assert.equal(razredStabilnosti(1.5, 0, 10), 5);
  assert.equal(razredStabilnosti(1.5, 0, 80), 4);
  assert.equal(razredStabilnosti(7, 800, 10), 2);
  assert.equal(razredStabilnosti(7, 0, 10), 3);
});

test("množitelj je 1 u razredu D i ide log-glatko prema krajevima", () => {
  assert.equal(mnoziteljRazreda(NEUTRALNO, 0.5, 2.5), 1);
  assert.equal(mnoziteljRazreda(0, 0.5, 2.5), 0.5);
  assert.equal(mnoziteljRazreda(5, 0.5, 2.5), 2.5);
  assert.ok(Math.abs(mnoziteljRazreda(4, 1, 4) - 2) < 1e-9);
  assert.equal(mnoziteljRazreda(2, 1, 1), 1);
});
