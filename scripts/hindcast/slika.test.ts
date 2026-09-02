import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";

import { naslikaj, slikaPng, uPng } from "./slika";

test("PNG ima ispravno zaglavlje i dimenzije", () => {
  const png = uPng(new Uint8Array(2 * 3 * 4).fill(200), 2, 3);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(png.buffer, png.byteOffset);
  assert.equal(dv.getUint32(16), 2);
  assert.equal(dv.getUint32(20), 3);
  // IDAT se da raspakirati u (širina·4+1)·visina bajtova.
  const idat = png.indexOf("IDAT");
  const duljina = dv.getUint32(idat - 4);
  const sirovo = inflateSync(png.subarray(idat + 4, idat + 4 + duljina));
  assert.equal(sirovo.length, (2 * 4 + 1) * 3);
});

test("gusta ćelija se oboji, prazna ostane podloga", () => {
  const g = new Float32Array(10 * 10);
  g[5 * 10 + 5] = 1000;
  const s = naslikaj(g, 10, 10, { uvecanje: 1 });
  const puna = s.rgba.subarray((5 * 10 + 5) * 4, (5 * 10 + 5) * 4 + 3);
  const prazna = s.rgba.subarray((1 * 10 + 1) * 4, (1 * 10 + 1) * 4 + 3);
  assert.ok(puna[1] < 160 && puna[2] < 120, `obojena: ${[...puna]}`);
  assert.ok(prazna[0] > 220, `podloga: ${[...prazna]}`);
  assert.ok(slikaPng(g, 10, 10).length > 50);
});
