import assert from "node:assert/strict";
import test from "node:test";
import { brojTragova, NAJMANJE_TRAGOVA, NAJVISE_TRAGOVA } from "./gustoca-tragova";

test("uvećanje prorjeđuje tragove umjesto da produljene repove gomila na zaslonu", () => {
  const povrsina = 1920 * 900;
  assert.equal(brojTragova(povrsina, 10), brojTragova(povrsina, 12));
  assert.ok(brojTragova(povrsina, 14) <= brojTragova(povrsina, 12) * 0.26);
  assert.ok(brojTragova(povrsina, 16) < brojTragova(povrsina, 14));
  assert.ok(brojTragova(povrsina, 17) < 60);
});

test("telefon i veliki zaslon zadržavaju ograničen broj tragova", () => {
  assert.equal(brojTragova(390 * 844, 17), NAJMANJE_TRAGOVA);
  assert.ok(brojTragova(390 * 844, 14) < brojTragova(1920 * 900, 14));
  assert.equal(brojTragova(7680 * 4320, 10), NAJVISE_TRAGOVA);
});
