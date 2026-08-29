import assert from "node:assert/strict";
import test from "node:test";

import {
  redoviIzDubina,
  redoviIzOcitanja,
  redoviIzSerija,
} from "@/lib/arhiva-zraka";
import type { Vjetar } from "@/lib/vjetar";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";

function ocitanje(dio: Partial<Vjetar> = {}): Vjetar {
  return {
    postaja: "vrboran",
    smjerOd: 111,
    brzina: 0.6,
    tisina: false,
    promjenjiv: false,
    opazeno: "2026-08-29T13:25:00.000Z",
    ...dio,
  };
}

test("promjenjiv smjer ulazi u arhivu kao praznina, ne kao stupanj", () => {
  const [red] = redoviIzOcitanja([ocitanje({ promjenjiv: true, smjerOd: 112.5 })]);
  assert.equal(red.directionDeg, null);
  assert.equal(red.speedMs, 0.6);
});

test("nalet se sprema kad ga postaja javi, inače je prazan", () => {
  const [sNaletom, bez] = redoviIzOcitanja([
    ocitanje({ naleti: 2.6 }),
    ocitanje({ postaja: "split3" }),
  ]);
  assert.equal(sNaletom.gustMs, 2.6);
  assert.equal(bez.gustMs, null);
});

test("serije se razlažu po postaji, a modelski sat ne ulazi", () => {
  const sat = (izvor: SatniVjetar["izvor"]): SatniVjetar => ({
    sat: "2026-08-29T12:00:00.000Z",
    smjerOd: 240,
    brzina: 1.7,
    tisina: false,
    izvor,
  });
  const serije = new Map([
    ["split3" as const, new Map([["2026-08-29T12:00:00.000Z", sat("split3")]])],
    ["split2" as const, new Map([["2026-08-29T12:00:00.000Z", sat("model")]])],
  ]);
  const redovi = redoviIzSerija(serije);
  assert.equal(redovi.length, 1);
  assert.equal(redovi[0].station, "split3");
  assert.equal(redovi[0].directionDeg, 240);
});

test("prognozirana dubina ne ulazi dok joj sat ne prođe", () => {
  const sada = new Date("2026-08-29T13:30:00Z");
  const dubine = new Map([
    ["2026-08-29T12:00:00.000Z", 420],
    ["2026-08-29T13:00:00.000Z", 460],
    ["2026-08-29T14:00:00.000Z", 500],
  ]);
  const redovi = redoviIzDubina(dubine, sada);
  assert.deepEqual(
    redovi.map((r) => [r.observedAt.toISOString(), r.depthM]),
    [
      ["2026-08-29T12:00:00.000Z", 420],
      ["2026-08-29T13:00:00.000Z", 460],
    ],
  );
  assert.ok(redovi.every((r) => r.source === "openmeteo"));
});
