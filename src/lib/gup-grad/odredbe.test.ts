import assert from "node:assert/strict";
import test from "node:test";

import { najmanjaCestica, type TablicaPpmin } from "@/lib/gup-grad/odredbe";
import { ZADANA_PRAVILA } from "@/lib/gup-grad/pravila";

const pod = (d: Partial<TablicaPpmin["godine"][string][string]>) => ({
  naziv: "",
  izvor: "Sl. gl. 55/14, čl. 68, str. 46",
  citat: "",
  napomena: "",
  stanovanje: [],
  gospodarska: [],
  javna: [],
  ...d,
});

const tab: TablicaPpmin = {
  godine: {
    "2015": {
      "2.5": pod({
        stanovanje: [
          { tip: "slobodnostojeca", m2: 500 },
          { tip: "dvojna", m2: 400 },
          { tip: "interpolacija", m2: 300 },
          { tip: "M1 – čestica preko 1200 m2", m2: 1200 },
        ],
        gospodarska: [{ tip: "poslovna", m2: 1500 }],
      }),
      "2.2": pod({ stanovanje: [{ tip: "mješovita M2", m2: 1400 }] }),
      "1.2": pod({}),
    },
  },
};

test("stanovanje: najmanja od uključenih osnovnih vrsta gradnje", () => {
  assert.equal(najmanjaCestica(tab, 2015, "2.5", "M/K5", ZADANA_PRAVILA)?.m2, 300);
  const bezInterpolacije = {
    ...ZADANA_PRAVILA,
    ostaci: { ...ZADANA_PRAVILA.ostaci, tipovi: { ...ZADANA_PRAVILA.ostaci.tipovi, interpolacija: false } },
  };
  assert.equal(najmanjaCestica(tab, 2015, "2.5", "S", bezInterpolacije)?.m2, 400);
});

test("bez osnovnih vrsta vrijedi vrijednost po namjeni; gospodarska ima svoju", () => {
  assert.equal(najmanjaCestica(tab, 2015, "2.2", "M/K5", ZADANA_PRAVILA)?.m2, 1400);
  assert.equal(najmanjaCestica(tab, 2015, "2.5", "I/K", ZADANA_PRAVILA)?.m2, 1500);
});

test("bez odredbe, bez područja ili za zelenilo nema najmanje čestice", () => {
  assert.equal(najmanjaCestica(tab, 2015, "1.2", "M/K5", ZADANA_PRAVILA), null);
  assert.equal(najmanjaCestica(tab, 2015, null, "M/K5", ZADANA_PRAVILA), null);
  assert.equal(najmanjaCestica(tab, 2015, "2.5", "Z5", ZADANA_PRAVILA), null);
  assert.equal(najmanjaCestica(tab, 2006, "2.5", "M/K5", ZADANA_PRAVILA), null);
});
