import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { oznakaDojavitelja, zaboraviDojavitelja } from "./dojavitelj";

/** Najmanji `localStorage` koji provjerama treba. */
function lazniSpremnik(pukni = false) {
  const podatci = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (pukni) throw new Error("nema spremnika");
      return podatci.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (pukni) throw new Error("nema spremnika");
      podatci.set(k, v);
    },
    removeItem: (k: string) => {
      if (pukni) throw new Error("nema spremnika");
      podatci.delete(k);
    },
  };
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = lazniSpremnik();
});

test("oznaka se stvori jednom i ostaje ista", () => {
  const prva = oznakaDojavitelja();
  assert.ok(prva && prva.length >= 32, "oznaka mora biti dovoljno duga");
  assert.equal(oznakaDojavitelja(), prva, "druga dojava nosi istu oznaku");
});

test("dva preglednika ne dijele oznaku", () => {
  const prvi = oznakaDojavitelja();
  (globalThis as { localStorage?: unknown }).localStorage = lazniSpremnik();
  assert.notEqual(oznakaDojavitelja(), prvi);
});

test("brisanje vraća dojavitelja na početak", () => {
  const prva = oznakaDojavitelja();
  zaboraviDojavitelja();
  assert.notEqual(oznakaDojavitelja(), prva, "poslije brisanja je nova osoba");
});

test("preglednik bez spremnika šalje dojavu bez oznake, umjesto da pukne", () => {
  (globalThis as { localStorage?: unknown }).localStorage = lazniSpremnik(true);
  assert.equal(oznakaDojavitelja(), null);
  assert.doesNotThrow(() => zaboraviDojavitelja());
});
