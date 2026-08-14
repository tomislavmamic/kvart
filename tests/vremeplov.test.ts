import assert from "node:assert/strict";
import test from "node:test";
import { BASE_LAYERS, type BaseLayer } from "../src/lib/map-views";
import {
  izAdrese,
  natpisPodloge,
  postaviStranu,
  snimke,
  uAdresu,
  valjanVremeplov,
  vremeplovMoguc,
  zadaniVremeplov,
} from "../src/lib/vremeplov";

/**
 * Vremeplov je stanje, ne crtež, pa se sav ispituje bez karte.
 *
 * Ispituje se nad izmišljenim registrom gdje god pravilo ne ovisi o stvarnim
 * podlogama: inače bi dodavanje jedne podloge oborilo test koji o njoj nema
 * što reći. Nad stvarnim BASE_LAYERS ostaje samo ono što je tvrdnja o
 * proizvodu — da vremeplov u kvartu doista ima što usporediti.
 */

const podloga = (id: string, godina?: number): BaseLayer => ({
  id,
  label: `Podloga ${id}`,
  url: `https://primjer.hr/${id}`,
  type: "wms",
  wmsLayers: "sloj",
  attribution: "izvor",
  skupina: godina ? "nekad" : "danas",
  ...(godina ? { godina } : {}),
});

const registar = [
  podloga("nova", 2023),
  podloga("bez-godine"),
  podloga("stara", 2011),
];

test("u vremeplov ulaze samo snimke s godinom, poredane po godini", () => {
  assert.deepEqual(
    snimke(registar).map((b) => b.id),
    ["stara", "nova"],
  );
});

test("bez dvije snimke vremeplov se ne nudi", () => {
  assert.equal(vremeplovMoguc([podloga("sama", 2011)]), false);
  assert.equal(vremeplovMoguc([podloga("a"), podloga("b")]), false);
  assert.equal(vremeplovMoguc(registar), true);
});

test("zadani par je najstarija i najnovija snimka", () => {
  assert.deepEqual(zadaniVremeplov(registar), {
    lijevo: "stara",
    desno: "nova",
  });
});

test("zadani par je null kad nema dovoljno snimaka", () => {
  assert.equal(zadaniVremeplov([podloga("sama", 2011)]), null);
});

test("ista podloga s obje strane nije valjan par", () => {
  // Rez koji ništa ne dijeli: razdjelnik se povlači, a slika stoji. To je
  // kvar koji izgleda kao kvar karte, pa se odbija prije nego se nacrta.
  assert.equal(
    valjanVremeplov(registar, { lijevo: "stara", desno: "stara" }),
    null,
  );
});

test("podloga bez godine ne može ući u par", () => {
  assert.equal(
    valjanVremeplov(registar, { lijevo: "bez-godine", desno: "nova" }),
    null,
  );
});

test("nepostojeća podloga ne može ući u par", () => {
  assert.equal(
    valjanVremeplov(registar, { lijevo: "nema-me", desno: "nova" }),
    null,
  );
});

test("odabir podloge koja već stoji nasuprot zamijeni strane", () => {
  // Odbijanje bi bio pritisak koji ne radi ništa; zamjena je ono što je
  // čovjek i htio — isti par okrenut.
  assert.deepEqual(
    postaviStranu({ lijevo: "stara", desno: "nova" }, "lijevo", "nova"),
    { lijevo: "nova", desno: "stara" },
  );
});

test("odabir druge podloge mijenja samo tu stranu", () => {
  const treca = [...registar, podloga("srednja", 2017)];
  assert.equal(snimke(treca).length, 3);
  assert.deepEqual(
    postaviStranu({ lijevo: "stara", desno: "nova" }, "desno", "srednja"),
    { lijevo: "stara", desno: "srednja" },
  );
});

test("adresa preživi krug: par → tekst → par", () => {
  const par = { lijevo: "stara", desno: "nova" };
  assert.equal(uAdresu(par), "stara,nova");
  assert.deepEqual(izAdrese(registar, uAdresu(par)), par);
});

test("neispravna adresa gasi vremeplov umjesto da sruši kartu", () => {
  for (const loše of [null, "", "stara", "stara,", ",nova", "a,b", "stara,stara"]) {
    assert.equal(izAdrese(registar, loše), null, `nije odbijeno: ${loše}`);
  }
});

test("natpis podloge pada na id kad podloge nema", () => {
  // Ide u aria-valuetext razdjelnika, pa mora dati nešto i za nepoznat id.
  assert.equal(natpisPodloge(registar, "nova"), "Podloga nova");
  assert.equal(natpisPodloge(registar, "nema-me"), "nema-me");
});

test("stvarni registar nudi vremeplov, i to preko ortofota", () => {
  // Tvrdnja o proizvodu: bez barem dvije snimke kvarta biralo bi postojalo,
  // a pritisak na njega ne bi mogao dati ništa.
  assert.ok(vremeplovMoguc(BASE_LAYERS));
  const zadani = zadaniVremeplov(BASE_LAYERS);
  assert.ok(zadani);
  assert.deepEqual(zadani, { lijevo: "dof-2011", desno: "dof" });
});
