import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SKRIPTA = readFileSync("scripts/izvedi-raspesenje.py", "utf8");

test("pretpostavke računa stoje napisane uz brojku", () => {
  // Ove tri brojke nose cijeli rezultat. Ako se mijenjaju, mora se vidjeti u
  // razlici, a ne tiho promijeniti smisao objavljenih karata.
  assert.match(SKRIPTA, /^TOK = 3\.0$/m, "površinski tok u ouE/m²/s");
  assert.match(SKRIPTA, /^PMR = 2\.3$/m, "omjer vrh/prosjek");
  assert.match(SKRIPTA, /^PRAG = 1\.5$/m, "prag jako neugodnog mirisa");
});

test("skripta priznaje što joj nedostaje", () => {
  for (const rupa of [
    "Model nema pamćenje",
    "EN 13725",
    "CORINE",
    "25 km",
  ]) {
    assert.ok(
      SKRIPTA.includes(rupa),
      `zaglavlje mora spomenuti ograničenje: ${rupa}`,
    );
  }
});

test("prototip se ne poziva iz stranice", () => {
  // Dok brojke nisu bazdarene na mjerenju, ne smiju izaći pred ljude.
  const izvor = readFileSync("src/components/karepovac/karta-kartice.tsx", "utf8");
  assert.doesNotMatch(izvor, /raspesenje/);
});
