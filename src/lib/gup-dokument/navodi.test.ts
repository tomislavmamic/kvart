import assert from "node:assert/strict";
import { test } from "node:test";

import { dekodirajOznake } from "./id";
import { imenaNavoda, razrijesi } from "./navodi";

/**
 * Svaki navod mora se naći u tekstu — inače skočni prozor ne bi imao što
 * pokazati. Kad se izvadak odredbi ili izvlačenje teksta promijeni, ovaj test
 * kaže koji citat više ne stoji u dokumentu.
 */
test("svaki navod se razrješava u ulomak", async () => {
  const imena = await imenaNavoda();
  assert.ok(imena.length > 250, `premalo navoda: ${imena.length}`);
  const nerazrijeseni: string[] = [];
  for (const id of imena) {
    const u = await razrijesi(id);
    if (!u) nerazrijeseni.push(id);
    else if (!u.list) assert.ok(u.blokovi?.length, id);
  }
  assert.deepEqual(nerazrijeseni, []);
});

test("ulomak ističe citat i vodi na isto mjesto u cijelom tekstu", async () => {
  const u = await razrijesi("sve-namjene-2015");
  assert.ok(u);
  assert.equal(u.naslov, "Sl. gl. 55/14 · čl. 8 · str. 3");
  const b = u.blokovi!.find((x) => x.oznake);
  assert.ok(b);
  const [a, z] = b.oznake![0];
  assert.equal(b.t.slice(a, z).slice(0, 30), "Na površinama svih namjena gra");
  const url = new URL(u.href, "https://x");
  assert.equal(url.pathname, "/gup/dokument");
  assert.equal(url.hash, `#${b.id}`);
  assert.deepEqual(dekodirajOznake(url.searchParams.get("oznaci")!), [[b.id, b.oznake]]);
});

test("citat s izostavljanjem ističe oba dijela, ne ono između", async () => {
  const u = await razrijesi("sirina-cestice-2015");
  const b = u!.blokovi!.find((x) => x.oznake)!;
  assert.equal(b.oznake!.length, 2);
  assert.match(b.t.slice(...b.oznake![1]), /šmin=10 m$/);
});

test("navod članka obuhvaća cijeli članak bez oznaka", async () => {
  const u = await razrijesi("obveza-plana-2015");
  assert.equal(u!.naslov, "Sl. gl. 55/14 · čl. 104–105 · str. 79");
  assert.equal(u!.blokovi![0].t, "Članak 104.");
  assert.ok(u!.blokovi!.some((b) => b.t === "Članak 105."));
  assert.ok(u!.blokovi!.every((b) => !b.oznake));
  assert.equal(new URL(u!.href, "https://x").hash, "#cl-104");
});

test("izmjene 3/08 u izdanju 2006. imaju sidra s predmetkom", async () => {
  const imena = await imenaNavoda();
  const id = imena.find((i) => i.startsWith("gradnja-2006-"))!;
  const u = await razrijesi(id);
  assert.equal(new URL(u!.href, "https://x").pathname, "/gup/dokument/2006");
});

test("navod lista vodi na list s okvirom", async () => {
  const u = await razrijesi("z6-legenda-2025");
  assert.equal(u!.list!.id, "namjena-2025");
  assert.match(u!.href, /^\/gup\/dokument\/list\/namjena-2025\?okvir=0\.8060,/);
});

/**
 * Navod napisan u kodu (<Navod id="…">, navodHtml, rezim.ts, list po godini)
 * mora postojati — inače bi poveznica otvorila prazan prozor.
 */
test("svaki navod spomenut u kodu postoji", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const path = await import("node:path");
  const { LIST_NAMJENE, LIST_URBANIH_PRAVILA, navodNamjena } = await import("./id");
  const datoteke: string[] = [];
  const hodaj = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) hodaj(p);
      else if (/\.tsx?$/.test(f) && !f.endsWith(".test.ts") && !p.endsWith(path.join("gup-dokument", "navodi.ts"))) datoteke.push(p);
    }
  };
  hodaj(path.join(process.cwd(), "src"));
  const trazeni = new Set<string>();
  const oblik = /["`]((?:list|obveza-plana|preporuka-plana|marjan|z6|sve-namjene|ppmin-250|sirina-cestice|clanak)-[A-Za-z0-9_-]+?)["`]/g;
  for (const f of datoteke) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(oblik)) if (!m[1].endsWith("-")) trazeni.add(m[1]);
    for (const m of t.matchAll(/navodNamjena\((\d{4}), "([^"]+)"\)/g)) trazeni.add(navodNamjena(m[1], m[2]));
  }
  for (const g of ["2006", "2015"]) {
    trazeni.add(`marjan-${g}`);
    trazeni.add(`obveza-plana-${g}`);
  }
  for (const l of [...Object.values(LIST_NAMJENE), ...Object.values(LIST_URBANIH_PRAVILA)]) trazeni.add(`list-${l}`);
  const imena = new Set(await imenaNavoda());
  const nema = [...trazeni].filter((id) => !imena.has(id));
  assert.ok(trazeni.size > 25, `premalo nađenih navoda u kodu: ${trazeni.size}`);
  assert.deepEqual(nema, []);
});

test("karta traži navode najmanje čestice i gradnje pod istim imenima", async () => {
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { navodGradnja, navodPpmin } = await import("./id");
  const imena = new Set(await imenaNavoda());
  const o = (f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "data", "gup-grad", "odredbe", f), "utf8"));
  const nema: string[] = [];
  for (const [g, tab] of Object.entries(o("ppmin.json").godine as Record<string, Record<string, { citat: string }>>))
    for (const [kod, v] of Object.entries(tab)) if (v.citat && !imena.has(navodPpmin(g, kod))) nema.push(navodPpmin(g, kod));
  for (const [g, tab] of Object.entries(o("gradnja.json").godine as Record<string, Record<string, { citat: string }>>))
    for (const [kod, v] of Object.entries(tab)) if (v.citat && !imena.has(navodGradnja(g, kod))) nema.push(navodGradnja(g, kod));
  assert.deepEqual(nema, []);
});
