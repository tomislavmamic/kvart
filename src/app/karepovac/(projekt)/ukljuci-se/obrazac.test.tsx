import assert from "node:assert/strict";
import test, { before } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { VRSTE_POMOCI } from "@/lib/ukljuci-se";
import type { ObrazacPomoci as Obrazac, PostajaZaIzbor } from "./obrazac";

/**
 * Obrazac uvozi poslužiteljsku radnju, a ona bazu, koja pri uvozu traži
 * `DATABASE_URL`. Klijent `postgres` ne spaja se dok ga se ne upita, pa je
 * lažna adresa dovoljna da se obrazac nacrta — a baze u testu nema ni ne
 * treba. Zato se obrazac uvozi tek nakon što je adresa postavljena.
 */
let ObrazacPomoci: typeof Obrazac;
before(async () => {
  process.env.DATABASE_URL ??= "postgres://test@localhost:5432/test";
  ({ ObrazacPomoci } = await import("./obrazac"));
});

const POSTAJE: readonly PostajaZaIzbor[] = [
  { id: "bilice", naziv: "Bilice II", mjesto: "Ulica Bilice II", faza: "A", stanovnik: true },
  { id: "ploha-jarbol", naziv: "Plato Karepovca — jarbol", mjesto: "tijelo odlagališta", faza: "A", stanovnik: false },
  { id: "padina-sz", naziv: "Padina iznad Dračevca", mjesto: "uz Ulicu Dračevac", faza: "B", stanovnik: true },
];

test("obrazac nudi tri vrste pomoći, postaje po fazama i ništa ne traži obvezno osim vrste", () => {
  const markup = renderToStaticMarkup(<ObrazacPomoci postaje={POSTAJE} />);

  for (const v of VRSTE_POMOCI) {
    assert.match(markup, new RegExp(v.natpis), v.natpis);
  }
  assert.match(markup, /<optgroup label="faza A — prvo">/);
  assert.match(markup, /<optgroup label="faza B — zatim">/);
  assert.match(markup, /\(traži ustanovu\)/);
  // Ništa unaprijed označeno kad se ne zna odakle je čovjek došao.
  assert.doesNotMatch(markup, /checked=""/);
  assert.match(markup, /<option value="" selected=""/);
  // Sve što nije obvezno tako i piše, a robotu je ostavljeno skriveno polje.
  assert.equal((markup.match(/nije obvezno/g) ?? []).length, 3);
  assert.match(markup, /name="website"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /Javi da mogu pomoći/);
});

test("s kartice postaje koja traži dvorište stiže se s odabranom postajom i označenim mjestom", () => {
  const markup = renderToStaticMarkup(
    <ObrazacPomoci postaje={POSTAJE} pocetnaPostaja="bilice" />,
  );
  assert.match(markup, /<option value="bilice" selected=""/);
  assert.match(markup, /<input[^>]*checked=""[^>]*value="mjesto"/);
  assert.doesNotMatch(markup, /<input[^>]*checked=""[^>]*value="znanje"/);
});

test("s kartice postaje koja traži ustanovu ne označava se mjesto unaprijed", () => {
  const markup = renderToStaticMarkup(
    <ObrazacPomoci postaje={POSTAJE} pocetnaPostaja="ploha-jarbol" />,
  );
  assert.match(markup, /<option value="ploha-jarbol" selected=""/);
  assert.doesNotMatch(markup, /checked=""/);
});

test("nepoznata postaja iz poveznice se prešućuje, ne ruši obrazac", () => {
  const markup = renderToStaticMarkup(
    <ObrazacPomoci postaje={POSTAJE} pocetnaPostaja="nepostojeca" />,
  );
  assert.match(markup, /<option value="" selected=""/);
});
