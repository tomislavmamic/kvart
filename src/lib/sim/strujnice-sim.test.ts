import assert from "node:assert/strict";
import test from "node:test";

import { izvediStrujnice } from "@/lib/sim/strujnice-sim";

const GW = 64;
const GH = 64;
const OKVIR = 6400;

/** Jednoliko polje zadane brzine prema istoku i jugu. */
function jednoliko(ux: number, uy: number) {
  const vx = new Float32Array(GW * GH).fill(ux);
  const vy = new Float32Array(GW * GH).fill(uy);
  return { vx, vy };
}

test("strujnice teku niz vjetar", () => {
  const { vx, vy } = jednoliko(2, 0);
  const s = izvediStrujnice(vx, vy, GW, GH, OKVIR, OKVIR);
  assert.ok(s.length > 50, `premalo strujnica: ${s.length}`);
  for (const p of s) {
    assert.ok(
      p.tocke[p.tocke.length - 1][0] > p.tocke[0][0],
      "vjetar prema istoku mora nositi putanju udesno",
    );
  }
});

test("vrijeme uz putanju raste i mjeri stvarno putovanje", () => {
  const { vx, vy } = jednoliko(2, 0);
  const p = izvediStrujnice(vx, vy, GW, GH, OKVIR, OKVIR)[0];
  for (let i = 1; i < p.vremena.length; i += 1) {
    assert.ok(p.vremena[i] > p.vremena[i - 1], "vrijeme mora rasti");
  }
  // Pri 2 m/s zrak 100 m prijeđe za 50 s; putanja od 100 m mora dati oko toga.
  const put = (p.tocke[10][0] - p.tocke[0][0]) * OKVIR;
  const ocekivano = put / 2;
  assert.ok(
    Math.abs(p.vremena[10] - ocekivano) / ocekivano < 0.05,
    `${p.vremena[10].toFixed(1)} s za ${put.toFixed(0)} m pri 2 m/s`,
  );
});

test("dvostruko jači vjetar isti put prijeđe za pola vremena", () => {
  const sporo = izvediStrujnice(...Object.values(jednoliko(1, 0)) as [Float32Array, Float32Array], GW, GH, OKVIR, OKVIR)[0];
  const brzo = izvediStrujnice(...Object.values(jednoliko(2, 0)) as [Float32Array, Float32Array], GW, GH, OKVIR, OKVIR)[0];
  const omjer = sporo.vremena[20] / brzo.vremena[20];
  assert.ok(Math.abs(omjer - 2) < 0.02, `omjer je ${omjer.toFixed(3)}, mora biti 2`);
});

test("tišina ne daje strujnice umjesto da ih izmisli", () => {
  const { vx, vy } = jednoliko(0, 0);
  assert.deepEqual(izvediStrujnice(vx, vy, GW, GH, OKVIR, OKVIR), []);
});

test("putanje ostaju unutar okvira", () => {
  const { vx, vy } = jednoliko(1.5, -1.5);
  for (const p of izvediStrujnice(vx, vy, GW, GH, OKVIR, OKVIR)) {
    for (const [x, y] of p.tocke) {
      assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `točka izvan okvira: ${x}, ${y}`);
    }
  }
});

test("korak je stalne duljine, pa točke ne ovise o brzini", () => {
  const spor = izvediStrujnice(...Object.values(jednoliko(0.5, 0)) as [Float32Array, Float32Array], GW, GH, OKVIR, OKVIR)[0];
  const brz = izvediStrujnice(...Object.values(jednoliko(5, 0)) as [Float32Array, Float32Array], GW, GH, OKVIR, OKVIR)[0];
  const razmak = (p: typeof spor) => p.tocke[5][0] - p.tocke[4][0];
  assert.ok(
    Math.abs(razmak(spor) - razmak(brz)) < 1e-6,
    "razmak točaka mora biti isti; brzina se vidi u vremenu, ne u gustoći",
  );
});
