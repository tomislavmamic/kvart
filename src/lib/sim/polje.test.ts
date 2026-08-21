import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import { razloziOsnove, slozi } from "@/lib/sim/polje";

/** Prave osnove s diska; provjera mora stajati na onome što se i isporučuje. */
function osnove() {
  const b = readFileSync("public/karepovac/sim-polje.bin");
  return razloziOsnove(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/** Raspakirava polje natrag u m/s, kako ga čita simulacija. */
function ocitaj(p: ReturnType<typeof slozi>) {
  const vx = new Float64Array(p.vx.length);
  const vy = new Float64Array(p.vy.length);
  for (let i = 0; i < p.vx.length; i += 1) {
    vx[i] = (p.vx[i] / 255) * 2 * p.skala - p.skala;
    vy[i] = (p.vy[i] / 255) * 2 * p.skala - p.skala;
  }
  return { vx, vy };
}

function sredina(a: Float64Array): number {
  let z = 0;
  for (let i = 0; i < a.length; i += 1) z += a[i];
  return z / a.length;
}

test("datoteka je one duljine koju zaglavlje najavljuje", () => {
  const o = osnove();
  assert.equal(o.gw, SIM_POLJE.gw);
  assert.equal(o.razine.length, SIM_POLJE.dubine.length);
  assert.equal(o.maska.length, SIM_POLJE.gw * SIM_POLJE.gh);
});

test("kriva duljina se ne razlaže tiho", () => {
  assert.throws(() => razloziOsnove(new ArrayBuffer(1000)), /očekuje se/);
});

test("ploha je unutar obuhvata i nije prazna", () => {
  const o = osnove();
  let celija = 0;
  for (let i = 0; i < o.maska.length; i += 1) if (o.maska[i] > 128) celija += 1;
  assert.ok(celija > 100, `ploha ima ${celija} ćelija, premalo`);
  assert.ok(celija < o.maska.length * 0.1, "ploha ne smije progutati okvir");
});

test("vjetar s istoka nosi zrak prema zapadu", () => {
  const { vx } = ocitaj(slozi({ smjerOd: 90, brzina: 3, dubina: 600 }, osnove()));
  assert.ok(sredina(vx) < 0, `prema zapadu znači vx < 0, a bilo je ${sredina(vx)}`);
});

test("vjetar s juga nosi zrak prema sjeveru, dakle prema vrhu okvira", () => {
  const { vy } = ocitaj(slozi({ smjerOd: 180, brzina: 3, dubina: 600 }, osnove()));
  // U rešetki prikaza y raste prema jugu, pa je „prema sjeveru” negativan vy.
  assert.ok(sredina(vy) < 0, `prema sjeveru znači vy < 0, a bilo je ${sredina(vy)}`);
});

test("dvostruka brzina daje dvostruko polje", () => {
  const o = osnove();
  const a = ocitaj(slozi({ smjerOd: 112.5, brzina: 1, dubina: 120 }, o));
  const b = ocitaj(slozi({ smjerOd: 112.5, brzina: 2, dubina: 120 }, o));
  const odnos = sredina(b.vx) / sredina(a.vx);
  assert.ok(Math.abs(odnos - 2) < 0.02, `omjer je ${odnos}, a mora biti 2`);
});

test("tišina ne dijeli nulom i daje polje bez gibanja", () => {
  const p = slozi({ smjerOd: 112.5, brzina: 0, dubina: 80 }, osnove());
  assert.ok(p.skala > 0, "ljestvica mora ostati veća od nule");
  const { vx, vy } = ocitaj(p);
  assert.ok(Math.abs(sredina(vx)) < 1e-6 && Math.abs(sredina(vy)) < 1e-6);
});

test("plići sloj skreće zrak jače od dubokog", () => {
  const o = osnove();
  const plitko = ocitaj(slozi({ smjerOd: 112.5, brzina: 1.2, dubina: 25 }, o));
  const duboko = ocitaj(slozi({ smjerOd: 112.5, brzina: 1.2, dubina: 600 }, o));
  const raspon = (a: Float64Array) => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] < min) min = a[i];
      if (a[i] > max) max = a[i];
    }
    return max - min;
  };
  assert.ok(
    raspon(plitko.vx) > raspon(duboko.vx),
    "pod plitkim slojem reljef mora više razvući polje",
  );
});

test("maska se dijeli među satovima i ne kopira se za svaki", () => {
  const o = osnove();
  const a = slozi({ smjerOd: 90, brzina: 1, dubina: 80 }, o);
  const b = slozi({ smjerOd: 270, brzina: 5, dubina: 300 }, o);
  assert.equal(a.maska, b.maska, "ploha je ista bez obzira na vrijeme");
});
