import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const OKVIR = readFileSync("scripts/okvir.py", "utf8");
const KARTICE = readFileSync("scripts/izvedi-karepovac-karticu.py", "utf8");
const POLJE = readFileSync("scripts/izvedi-polje-dima.py", "utf8");
const RELJEF = readFileSync("scripts/reljef_polje.py", "utf8");

// Zamjenjuje raniju provjeru u `src/lib/dim.test.ts`, koja je uspoređivala dvije
// kopije granica. Kopija je uklonjena, pa se sada pazi da se ne vrati.
test("granice okvira stoje na jednom mjestu", () => {
  // Sve kartice na /karepovac moraju stajati nad istim kvartom, u istom
  // mjerilu. Dok je svaka skripta držala vlastitu kopiju granica, prva
  // promjena razišla bi slojeve za nekoliko stotina metara — a to se na karti
  // ne vidi kao greška nego kao loše poklapanje.
  assert.match(
    OKVIR,
    /^ZAPAD, JUG, ISTOK, SJEVER = 16\.4867, 43\.5184, 16\.5192, 43\.5301$/m,
  );
  assert.match(OKVIR, /^SIRINA = 660\.0$/m);

  for (const [ime, izvor] of [
    ["izvedi-karepovac-karticu.py", KARTICE],
    ["izvedi-polje-dima.py", POLJE],
    ["reljef_polje.py", RELJEF],
  ] as const) {
    assert.doesNotMatch(
      izvor,
      /=\s*16\.4867|=\s*43\.5301|SIRINA\s*=\s*660/,
      `${ime} ne smije držati vlastitu kopiju granica okvira`,
    );
  }
});

test("skripte koje crtaju u okvir doista ga i uvoze", () => {
  for (const [ime, izvor] of [
    ["izvedi-karepovac-karticu.py", KARTICE],
    ["reljef_polje.py", RELJEF],
  ] as const) {
    assert.match(izvor, /^import okvir/m, `${ime} mora uvesti okvir`);
  }
});
