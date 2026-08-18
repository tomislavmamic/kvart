import assert from "node:assert/strict";
import test from "node:test";

import { VJETAR } from "@/generated/karepovac-vjetar";

import { ruzaDojava, sektor, SEKTORA, SEKTOR_IMENA, vjetarUSatu } from "./dojave";

const PRVI_SAT = Date.parse(VJETAR.prviSat);

test("sektor pripada smjeru iz kojega puše, sjever obuhvaća obje strane nule", () => {
  assert.equal(SEKTOR_IMENA[sektor(0)], "S");
  assert.equal(SEKTOR_IMENA[sektor(359)], "S", "359° je i dalje sjever");
  assert.equal(SEKTOR_IMENA[sektor(11)], "S");
  assert.equal(SEKTOR_IMENA[sektor(12)], "SSI");
  assert.equal(SEKTOR_IMENA[sektor(90)], "I");
  assert.equal(SEKTOR_IMENA[sektor(112.5)], "IJI", "smjer u kojem leži Karepovac");
  assert.equal(SEKTOR_IMENA[sektor(270)], "Z");
});

test("vjetar se ne izmišlja izvan niza ni za sate koje luka nije javila", () => {
  assert.equal(vjetarUSatu(new Date(PRVI_SAT - 3_600_000)), null);
  assert.equal(vjetarUSatu(new Date(PRVI_SAT + VJETAR.sati * 3_600_000)), null);

  // Barem jedan sat unutar niza mora imati vjetar, inače je izvoz prazan.
  let imamo = 0;
  for (let i = 0; i < VJETAR.sati; i += 1) {
    if (vjetarUSatu(new Date(PRVI_SAT + i * 3_600_000))) imamo += 1;
  }
  assert.equal(imamo, VJETAR.imamo);
  assert.ok(imamo > VJETAR.sati / 2, "više od pola sati mora imati vjetar");
});

test("izmjereni vjetar stoji u granicama koje vjetar uopće može imati", () => {
  for (let i = 0; i < VJETAR.sati; i += 97) {
    const v = vjetarUSatu(new Date(PRVI_SAT + i * 3_600_000));
    if (!v) continue;
    assert.ok(v.smjer >= 0 && v.smjer < 360, `smjer ${v.smjer}`);
    assert.ok(v.brzina >= 0 && v.brzina < 60, `brzina ${v.brzina}`);
  }
});

test("ruža broji samo dojave kojima zna vjetar, ostale prijavi kao neriješene", () => {
  const uNizu = new Date(PRVI_SAT + 24 * 3_600_000);
  const izvanNiza = new Date(PRVI_SAT - 48 * 3_600_000);
  const ruza = ruzaDojava([
    { occurredAt: uNizu, strength: "jako" },
    { occurredAt: izvanNiza, strength: "slabo" },
  ]);

  assert.equal(ruza.tezine.length, SEKTORA);
  assert.equal(ruza.bezVjetra, 1, "dojava izvan niza ne smije ući u zbroj");
  assert.ok(ruza.uporabljeno <= 1);
  assert.equal(
    ruza.broj.reduce((a, b) => a + b, 0),
    ruza.uporabljeno,
    "zbroj po sektorima mora se poklopiti s brojem uporabljenih dojava",
  );
});

test("jača dojava nosi više, ali ne toliko da pregazi ostale", () => {
  const kada = new Date(PRVI_SAT + 24 * 3_600_000);
  if (!vjetarUSatu(kada)) return;

  const slaba = ruzaDojava([{ occurredAt: kada, strength: "slabo" }]);
  const jaka = ruzaDojava([{ occurredAt: kada, strength: "nepodnosivo" }]);
  const s = Math.max(...slaba.tezine);
  const j = Math.max(...jaka.tezine);
  assert.ok(j > s, "nepodnošljivo mora nositi više od slabog");
  assert.ok(j / s <= 4, "raspon težina mora ostati uzak");
});
