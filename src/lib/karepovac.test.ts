import assert from "node:assert/strict";
import test from "node:test";

import {
  KAREPOVAC_BUDGET_CATEGORIES,
  KAREPOVAC_DATA_KINDS,
  KAREPOVAC_NAV,
  KAREPOVAC_PHASES,
  KAREPOVAC_PUBLIC_STATE,
} from "./karepovac";

test("preparation stage never presents unavailable public facts", () => {
  assert.equal(KAREPOVAC_PUBLIC_STATE.status, "U pripremi");
  assert.equal(KAREPOVAC_PUBLIC_STATE.hasLiveMeasurements, false);
  assert.equal(KAREPOVAC_PUBLIC_STATE.hasPublicStations, false);
  assert.equal(KAREPOVAC_PUBLIC_STATE.donationUrl, null);
  assert.equal(KAREPOVAC_PUBLIC_STATE.fundingGoal, null);
  assert.equal(KAREPOVAC_PUBLIC_STATE.amountRaised, null);
});

test("all public Karepovac pages are declared once", () => {
  assert.deepEqual(
    KAREPOVAC_NAV.map(({ href }) => href),
    [
      "/karepovac",
      "/karepovac/ukljuci-se",
      "/karepovac/metodologija",
      "/karepovac/podaci",
      "/karepovac/financije",
      "/karepovac/postaje",
    ],
  );
  assert.equal(KAREPOVAC_NAV[4]?.label, "Novac i troškovi");
});

test("measurement, official source, and wind estimate stay distinct", () => {
  assert.deepEqual(
    KAREPOVAC_DATA_KINDS.map(({ id }) => id),
    ["community", "official", "estimated"],
  );
  assert.equal(new Set(KAREPOVAC_DATA_KINDS.map(({ label }) => label)).size, 3);
  assert.equal(KAREPOVAC_DATA_KINDS[0]?.label, "Izmjereno na našoj postaji");
});

test("the preparation record covers every delivery phase and cost family", () => {
  assert.equal(KAREPOVAC_PHASES[0]?.status, "Sada");
  assert.equal(KAREPOVAC_PHASES[0]?.title, "Dogovor o projektu");
  assert.equal(KAREPOVAC_PHASES.at(-1)?.title, "Objava mjerenja");
  assert.ok(KAREPOVAC_PHASES.length >= 4);

  assert.deepEqual(
    KAREPOVAC_BUDGET_CATEGORIES.map(({ id }) => id),
    [
      "sensors",
      "controllers",
      "enclosures",
      "power",
      "calibration",
      "connectivity",
      "maintenance",
      "contingency",
    ],
  );
  assert.ok(KAREPOVAC_BUDGET_CATEGORIES.every(({ amount }) => amount === null));
});
