import assert from "node:assert/strict";
import test from "node:test";

import { razina } from "@/lib/dim";
import { SIDRO_SIMULATORA } from "@/lib/sim/ljestvica";
import { izBajta, PROZOR, uBajt, zapisiGustocu } from "@/lib/sim/zapis-gustoce";

const S = SIDRO_SIMULATORA;

test("sidro pada na sredinu prozora", () => {
  assert.equal(uBajt(S, S), 128, "log₁₀(1) = 0, dakle sredina");
});

test("prazna ćelija je nula, ne najmanja vrijednost", () => {
  assert.equal(uBajt(0, S), 0);
  assert.equal(uBajt(-1, S), 0, "gustoća ne može biti negativna");
  assert.equal(izBajta(0, S), 0);
});

test("zapis se vraća u gustoću unutar koraka bajta", () => {
  for (const g of [S * 0.01, S * 0.5, S, S * 10, S * 100]) {
    const natrag = izBajta(uBajt(g, S), S);
    const omjer = natrag / g;
    assert.ok(
      Math.abs(Math.log10(omjer)) < 0.02,
      `${g} se vratilo kao ${natrag} (omjer ${omjer.toFixed(3)})`,
    );
  }
});

test("prozor pokriva cijelu ljestvicu prikaza s viškom", () => {
  // Ljestvica prikaza ide od 0,03× do 100× praga mirisa. Za sumporovodik je
  // sidro 1,99× praga, pa je najniža vidljiva gustoća 0,03/1,99 = 0,015 sidra,
  // a najviša 100/1,99 = 50 sidara.
  assert.ok(10 ** PROZOR.od < 0.015, "dno prozora mora biti ispod ruba ljestvice");
  assert.ok(10 ** PROZOR.do > 50, "vrh prozora mora biti iznad ruba ljestvice");
});

test("jača emisija je pomak zapisa, ne novi račun", () => {
  // Ovo je tvrdnja na kojoj stoji cijeli zapis: množenje gustoće mora biti
  // isto što i zbrajanje na ljestvici. Ako ovo padne, klizač jačine laže.
  const g = S * 0.4;
  const mnozitelj = 3;
  const izravno = razina(g * mnozitelj, "sumporovodik", S);
  const raspon = Math.log10(100) - Math.log10(0.03);
  const pomaknuto = razina(g, "sumporovodik", S) + Math.log10(mnozitelj) / raspon;
  assert.ok(
    Math.abs(izravno - pomaknuto) < 1e-12,
    `izravno ${izravno}, pomakom ${pomaknuto}`,
  );
});

test("razlika među tvarima jednako je pomak", () => {
  const g = S * 0.4;
  const raspon = Math.log10(100) - Math.log10(0.03);
  // 1,135/0,571 za H₂S naspram 2,36/0,138 za merkaptane.
  const pomak = Math.log10((2.36 / 0.138) / (1.135 / 0.571)) / raspon;
  const izravno = razina(g, "merkaptani", S);
  assert.ok(
    Math.abs(izravno - (razina(g, "sumporovodik", S) + pomak)) < 1e-9,
    "jedna tekstura mora moći poslužiti obje tvari",
  );
});

test("cijela slika se zapisuje bez gubitka duljine", () => {
  const ulaz = Float32Array.from([0, S * 0.1, S, S * 1000, S * 1e9]);
  const izlaz = zapisiGustocu(ulaz, S);
  assert.equal(izlaz.length, ulaz.length);
  assert.equal(izlaz[0], 0);
  assert.equal(izlaz[4], 255, "iznad prozora se zasiti, ne prelije");
  assert.ok(izlaz[1] < izlaz[2] && izlaz[2] < izlaz[3], "poredak se čuva");
});
