import assert from "node:assert/strict";
import test from "node:test";

import { checkRateLimit } from "./rate-limit";

test("zadana ograda je pet na sat po ključu, pa se prozor otvori nakon sata", () => {
  const memorija = new Map();
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i += 1) {
    assert.ok(checkRateLimit("1.2.3.4", { now: t0 + i, memorija }), `${i + 1}. prolazi`);
  }
  assert.equal(checkRateLimit("1.2.3.4", { now: t0 + 10, memorija }), false, "šesti ne");
  assert.ok(checkRateLimit("5.6.7.8", { now: t0 + 10, memorija }), "drugi ključ ima svoj brojač");
  assert.ok(
    checkRateLimit("1.2.3.4", { now: t0 + 3_600_001, memorija }),
    "poslije sata prozor kreće iznova",
  );
});

test("spremnici se ne miješaju: dojave ne troše ogradu prijava, ni obrnuto", () => {
  const memorija = new Map();
  const now = 5_000_000;
  for (let i = 0; i < 5; i += 1) checkRateLimit("ista-adresa", { now, memorija });
  assert.equal(checkRateLimit("ista-adresa", { now, memorija }), false, "prijave su potrošene");
  assert.ok(
    checkRateLimit("ista-adresa", { bucket: "dojava-adresa", max: 60, now, memorija }),
    "dojave s iste adrese i dalje prolaze",
  );
});

test("dojave: granica je po pregledniku, pa susjedi iza istog NAT-a ne smetaju jedni drugima", () => {
  const memorija = new Map();
  const now = 9_000_000;
  const poDojavitelju = { bucket: "dojava", max: 20, now, memorija };
  for (let i = 0; i < 20; i += 1) assert.ok(checkRateLimit("nos-a", poDojavitelju));
  assert.equal(checkRateLimit("nos-a", poDojavitelju), false, "dvadeset prva istog nosa ne");
  assert.ok(checkRateLimit("nos-b", poDojavitelju), "drugi nos s iste mreže prolazi");
});
