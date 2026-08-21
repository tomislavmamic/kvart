import assert from "node:assert/strict";
import test from "node:test";

import {
  adresaTablice,
  celija,
  mjeseci,
  procitajTablicu,
  SIM_POSTAJE,
  uUtc,
} from "@/lib/sim/postaje-satno";

/** Tablica u obliku u kojem je Zavod objavljuje; k1 piše najnoviji sat prvi. */
const K1 = `
<table>
<tr><th>datum</th><th>sat</th><th>H2S</th><th>NH3</th></tr>
<tr><td></td><td></td><td>µg/m3</td><td>µg/m3</td></tr>
<tr><td>21.08.2026</td><td>3:00</td><td>2.758</td><td>13.000</td></tr>
<tr><td>21.08.2026</td><td>2:00</td><td>-</td><td>13.425</td></tr>
<tr><td>21.08.2026</td><td>1:00</td><td>&lt; 0.1</td><td>7.737</td></tr>
</table>`;

test("sat u tablici je kraj razdoblja, pa se pomiče za jedan unatrag", () => {
  const niz = procitajTablicu(K1, "H2S");
  assert.equal(niz.length, 3, "tri redka, tri sata");
  // „1:00” je razdoblje 00–01 h mjesno; ljeti je to 22:00 UTC prethodnog dana.
  assert.equal(niz[0].sat, "2026-08-20T22:00:00.000Z");
  assert.equal(niz[2].sat, "2026-08-21T00:00:00.000Z");
});

test("niz izlazi poredan po vremenu iako tablica ide unatrag", () => {
  const satovi = procitajTablicu(K1, "H2S").map((o) => o.sat);
  assert.deepEqual([...satovi].sort(), satovi, "mora biti rastuće");
});

test("crtica ostaje nepoznanica, a ne nula", () => {
  const niz = procitajTablicu(K1, "H2S");
  const dva = niz.find((o) => o.sat === "2026-08-20T23:00:00.000Z");
  assert.equal(dva?.vrijednost, null, "uređaj nije radio — to nije čist zrak");
});

test("nalaz ispod granice određivanja uzima polovicu granice i to kaže", () => {
  const [v, ispod] = celija("< 0.1");
  assert.equal(v, 0.05);
  assert.equal(ispod, true);
  assert.deepEqual(celija("2,758"), [2.758, false], "zarez je decimalni");
  assert.deepEqual(celija("-"), [null, false]);
});

test("stupac koji tablica ne nosi vraća prazno, a ne krivi stupac", () => {
  assert.deepEqual(procitajTablicu(K1, "metil+etilmerkaptan"), []);
  assert.deepEqual(procitajTablicu(K1, "datum"), [], "datum nije mjerenje");
});

test("ništa što nije tablica ne ruši čitanje", () => {
  assert.deepEqual(procitajTablicu(null, "H2S"), []);
  assert.deepEqual(procitajTablicu("<html>404</html>", "H2S"), []);
});

test("mjesno vrijeme se pretvara u UTC po dobu godine", () => {
  // Ljetno vrijeme: UTC+2.
  assert.equal(uUtc("21.08.2026", 0)?.toISOString(), "2026-08-20T22:00:00.000Z");
  // Zimsko: UTC+1.
  assert.equal(uUtc("21.01.2026", 0)?.toISOString(), "2026-01-20T23:00:00.000Z");
});

test("razdoblje preko prijelaza mjeseca traži oba mjeseca", () => {
  const od = new Date("2026-07-31T20:00Z");
  const do_ = new Date("2026-08-01T10:00Z");
  assert.deepEqual(mjeseci(od, do_), ["202607", "202608"]);
  assert.deepEqual(mjeseci(do_, do_), ["202608"], "unutar mjeseca samo jedan");
});

test("svaka postaja nosi svoju tvar i svoj stupac", () => {
  const tvari = SIM_POSTAJE.map((p) => p.tvar);
  assert.deepEqual([...new Set(tvari)], tvari, "dvije postaje, dvije tvari");
  assert.equal(
    adresaTablice("k1", "202608"),
    "http://www.zrak-zavod-split.info/k1Tab202608.html",
  );
});
