import assert from "node:assert/strict";
import test from "node:test";

import { brojkeProvjere, postotak } from "./provjera";

test("brojke provjere dolaze iz STATUS.json, i to iz proizvodnog modela na svim dojavama", () => {
  const b = brojkeProvjere();
  assert.ok(b, "STATUS.json mora nositi ocjenu proizvodnog modela na dojavama");
  assert.ok(b.n > 0 && Number.isInteger(b.n));
  assert.ok(b.pod >= 0 && b.pod <= 1);
  assert.ok(b.far >= 0 && b.far <= 1);
  assert.ok(!Number.isNaN(Date.parse(b.azurirano)));
});

test("bez ocjene u očekivanom obliku nema brojki — ne izmišljaju se", () => {
  assert.equal(brojkeProvjere(null), null);
  assert.equal(brojkeProvjere({}), null);
  assert.equal(
    brojkeProvjere({
      azurirano: "2026-09-02T10:50:09.408Z",
      pokusi: [{ id: "polazno", nacin: "proizvodnja", ocjene: [{ uloga: "sve", h2s: { dojave: null } }] }],
    }),
    null,
    "dojave: null znači da provjere na dojavama nije bilo",
  );
  assert.equal(
    brojkeProvjere({
      azurirano: "2026-09-02T10:50:09.408Z",
      pokusi: [{ id: "e1", nacin: "proizvodnja", ocjene: [{ uloga: "sve", h2s: { dojave: { n: 15, POD: 0.5, FAR: 0.5 } } }] }],
    }),
    null,
    "tuđi pokus nije proizvodni model",
  );
  assert.deepEqual(
    brojkeProvjere({
      azurirano: "2026-09-02T10:50:09.408Z",
      pokusi: [{ id: "polazno", nacin: "proizvodnja", ocjene: [{ uloga: "sve", h2s: { dojave: { n: 15, POD: 0.5, FAR: 0.5556 } } }] }],
    }),
    { n: 15, pod: 0.5, far: 0.5556, azurirano: "2026-09-02T10:50:09.408Z" },
  );
});

test("postotak se zaokružuje i piše s razmakom, kako se u hrvatskom piše", () => {
  assert.equal(postotak(0.5556), "56 %");
  assert.equal(postotak(0.5), "50 %");
  assert.equal(postotak(0), "0 %");
});
