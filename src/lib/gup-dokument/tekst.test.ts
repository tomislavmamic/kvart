import assert from "node:assert/strict";
import { test } from "node:test";

import { dekodirajOznake, kodirajOznake } from "./id";
import type { Blok } from "./model";
import { dijeloviCitata, indeksiraj, nadjiCitat, normaliziraj, spojiOznake } from "./tekst";

const b = (id: string, s: number, t: string): Blok => ({ id, s, v: "p", t });

test("normalizacija: slova i brojke, m² kao m2, stari ñ kao đ", () => {
  assert.equal(normaliziraj("Ppmin=800 m²,").n, "ppmin800m2");
  assert.equal(normaliziraj("grañevina").n, normaliziraj("građevina").n);
  assert.equal(normaliziraj("„čeƟri”").n, "četiri");
  const { izvor } = normaliziraj("a, b");
  assert.deepEqual(izvor, [0, 3]);
});

test("citat se dijeli na izostavljanjima", () => {
  assert.deepEqual(dijeloviCitata("prvi dio … drugi dio... treći"), ["prvidio", "drugidio", "treći"]);
});

test("citat preko granice bloka i s izostavljanjem ističe točno citirano", () => {
  const ind = indeksiraj([
    b("s1-0", 1, "Uvod."),
    b("s1-1", 1, "Za novu gradnju Ppmin=500 m², kig=0,25, E=Po+P+2,"),
    b("s2-0", 2, "minimalna širina čestice šmin=12 m."),
  ]);
  const o = nadjiCitat(ind, "Ppmin=500 m2 … šmin=12 m")!;
  const m = spojiOznake(o);
  assert.deepEqual([...m.keys()], [1, 2]);
  const [[a, z]] = m.get(1)!;
  assert.equal(ind.blokovi[1].t.slice(a, z), "Ppmin=500 m²");
  const [[a2, z2]] = m.get(2)!;
  assert.equal(ind.blokovi[2].t.slice(a2, z2), "šmin=12 m");
});

test("isti tekst na dvije stranice: uzima se navedena", () => {
  const ind = indeksiraj([b("s3-0", 3, "Isto pravilo."), b("s9-0", 9, "Isto pravilo.")]);
  assert.equal(nadjiCitat(ind, "Isto pravilo", 9)![0].blok, 1);
  assert.equal(nadjiCitat(ind, "Isto pravilo", 3)![0].blok, 0);
  assert.equal(nadjiCitat(ind, "Nema toga", 3), null);
});

test("oznake u adresi: kodiranje i čitanje su inverzni", () => {
  const o: [string, [number, number][]][] = [
    ["s37-5", [[10, 80], [120, 160]]],
    ["3-08-s6-2", [[0, 44]]],
  ];
  assert.deepEqual(dekodirajOznake(kodirajOznake(o)), o);
});
