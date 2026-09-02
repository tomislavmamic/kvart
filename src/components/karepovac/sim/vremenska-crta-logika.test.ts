import assert from "node:assert/strict";
import test from "node:test";

import type { Kadar } from "@/lib/sim/kadrovi";
import {
  jeNoc,
  mjesniSatBroj,
  nesigurnostKadra,
  nosiNatpis,
  pomakIzUdjela,
  sljedeciZaReprodukciju,
} from "@/components/karepovac/sim/vremenska-crta-logika";

function kadar(pomak: number, dostupnost: Kadar["dostupnost"] = "spreman"): Kadar {
  return {
    sat: `s${pomak}`,
    pomak,
    vrsta: pomak > 0 ? "prognoza" : pomak === 0 ? "sada" : "izmjereno",
    dostupnost,
    stanje: null,
    vjetar: null,
    izvor: null,
    ocitanja: [],
  };
}

test("mjesni sat je onaj sa zida u Splitu", () => {
  assert.equal(mjesniSatBroj("2026-08-27T18:00:00.000Z"), 20, "ljeti UTC+2");
  assert.equal(mjesniSatBroj("2026-01-27T18:00:00.000Z"), 19, "zimi UTC+1");
  assert.equal(mjesniSatBroj("2026-08-27T22:30:00.000Z"), 0, "ponoć je 0, ne 24");
});

test("noć je od 21 do 6", () => {
  assert.equal(jeNoc("2026-08-27T19:00:00.000Z"), true, "21 h");
  assert.equal(jeNoc("2026-08-27T18:00:00.000Z"), false, "20 h");
  assert.equal(jeNoc("2026-08-28T03:00:00.000Z"), true, "5 h");
  assert.equal(jeNoc("2026-08-28T04:00:00.000Z"), false, "6 h");
});

test("reprodukcija preskače rupe i vraća se na početak", () => {
  const kadrovi = [kadar(-2), kadar(-1, "nedostupno"), kadar(0), kadar(1)];
  assert.equal(sljedeciZaReprodukciju(kadrovi, -2), 0, "preskače −1");
  assert.equal(sljedeciZaReprodukciju(kadrovi, 1), -2, "s kraja na početak");
  assert.equal(sljedeciZaReprodukciju([kadar(0, "nedostupno")], 0), null);
});

test("položaj na traci daje cijeli pomak unutar raspona", () => {
  assert.equal(pomakIzUdjela(0, -24, 3), -24);
  assert.equal(pomakIzUdjela(1, -24, 3), 3);
  assert.equal(pomakIzUdjela(2, -24, 3), 3, "izvan trake se drži ruba");
  assert.equal(pomakIzUdjela(24 / 27, -24, 3), 0);
});

test("nesigurnost raste s odmakom prognoze, a prošlost je nema", () => {
  assert.equal(nesigurnostKadra({ vrsta: "izmjereno", pomak: -5 }), 0);
  assert.equal(nesigurnostKadra({ vrsta: "sada", pomak: 0 }), 0);
  assert.ok(nesigurnostKadra({ vrsta: "prognoza", pomak: 1 }) < nesigurnostKadra({ vrsta: "prognoza", pomak: 3 }));
  assert.equal(nesigurnostKadra({ vrsta: "prognoza", pomak: 3 }), 1);
});

test("natpis nosi svaki šesti mjesni sat", () => {
  assert.equal(nosiNatpis("2026-08-27T16:00:00.000Z"), true, "18 h");
  assert.equal(nosiNatpis("2026-08-27T17:00:00.000Z"), false, "19 h");
});
