import assert from "node:assert/strict";
import test from "node:test";

import {
  DOPUSTENE_MINUTE,
  JOS_TRAJE,
  krajEpizode,
  TRAJANJA,
} from "./dojava-trajanje";

test("ponuda ide od „ne znam” prema duljem, bez lažne preciznosti", () => {
  assert.equal(TRAJANJA[0].vrijednost, "", "prvo je „ne znam”, da se ne izmišlja");
  assert.equal(TRAJANJA.at(-1)?.vrijednost, JOS_TRAJE);
  const minute = DOPUSTENE_MINUTE;
  assert.deepEqual([...minute].sort((a, b) => a - b), minute, "rastuće");
  assert.ok(minute.includes(15), "petnaest minuta je tipična epizoda");
});

test("kraj je stvarni kraj, jer početak nosi i minutu", () => {
  const pocetak = new Date(2026, 7, 25, 14, 50);
  const kraj = krajEpizode(pocetak, 15);
  assert.ok(kraj);
  assert.equal(kraj!.getHours(), 15);
  assert.equal(kraj!.getMinutes(), 5, "14.50 plus petnaest minuta je 15.05");
  assert.equal(krajEpizode(pocetak, null), null, "nepoznato trajanje nema kraj");
});

test("duga epizoda traje točno onoliko koliko piše", () => {
  const pocetak = new Date(2026, 7, 25, 14, 0);
  assert.equal(krajEpizode(pocetak, 180)!.getHours(), 17);
  assert.equal(krajEpizode(pocetak, 60)!.getHours(), 15);
  assert.equal(krajEpizode(pocetak, 30)!.getMinutes(), 30);
});
