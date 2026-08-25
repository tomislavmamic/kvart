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

test("kratka epizoda je jedan sat s mirisom, ne dio sata", () => {
  // Sat u kojem je bilo mirisa broji se cijeli: to je jedinica koju ruža
  // koristi i po kojoj je usporediva s terenskom metodom.
  const pocetak = new Date(2026, 7, 25, 14, 0);
  assert.equal(krajEpizode(pocetak, 15), null);
  assert.equal(krajEpizode(pocetak, 30), null);
  assert.equal(krajEpizode(pocetak, 60), null);
  assert.equal(krajEpizode(pocetak, null), null, "nepoznato trajanje je jedan sat");
});

test("duga epizoda pokriva onoliko sati koliko doista traje", () => {
  const pocetak = new Date(2026, 7, 25, 14, 0);
  const kraj = krajEpizode(pocetak, 180);
  assert.ok(kraj);
  // 180 minuta od 14 h pokriva sate 14, 15 i 16 — svaki sa svojim vjetrom.
  assert.equal(kraj!.getHours(), 16);
  assert.equal(krajEpizode(pocetak, 61)!.getHours(), 15, "sat i minuta su dva sata");
  assert.equal(krajEpizode(pocetak, 120)!.getHours(), 15, "točno dva sata su dva sata");
});
