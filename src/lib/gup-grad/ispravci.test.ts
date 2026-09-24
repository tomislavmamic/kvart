import assert from "node:assert/strict";
import test from "node:test";

import { NAJDULJA_NAPOMENA, provjeriIspravak } from "@/lib/gup-grad/ispravci";

const dobar = { ko: "SPLIT", kc: "4599/24", godina: "2025", vrsta: "parkiraliste", stanje: "slobodna", namjena: "S", lat: "43.5178", lng: "16.446" };

test("ispravak: dobar prijedlog prolazi, s koordinatom u Splitu", () => {
  const r = provjeriIspravak(dobar);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.ispravak.godina, 2025);
  assert.equal(r.ispravak.vrsta, "parkiraliste");
  assert.equal(r.ispravak.lat, 43.5178);
  assert.equal(r.ispravak.napomena, null);
});

test("ispravak: nepoznata vrsta, godina ili čestica se odbijaju", () => {
  assert.equal(provjeriIspravak({ ...dobar, vrsta: "dvorac" }).ok, false);
  assert.equal(provjeriIspravak({ ...dobar, vrsta: "" }).ok, false);
  assert.equal(provjeriIspravak({ ...dobar, godina: "1999" }).ok, false);
  assert.equal(provjeriIspravak({ ...dobar, kc: " " }).ok, false);
});

test("ispravak: „drugo” traži napomenu; napomena se reže, koordinata izvan Splita odbacuje", () => {
  assert.equal(provjeriIspravak({ ...dobar, vrsta: "drugo" }).ok, false);
  const r = provjeriIspravak({ ...dobar, vrsta: "drugo", napomena: "x".repeat(900), lat: "45.8", lng: "15.9" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.ispravak.napomena?.length, NAJDULJA_NAPOMENA);
  assert.equal(r.ispravak.lat, null);
});
