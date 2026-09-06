import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { oznakaDojavitelja, postojecaOznaka, zaboraviDojavitelja } from "./dojavitelj";

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

test("čitanje oznake za „vaše dojave” ne stvara je — posjet ne obilježava preglednik", () => {
  assert.equal(postojecaOznaka(), null, "prije prve dojave nema oznake");
  assert.equal(postojecaOznaka(), null, "ni drugo čitanje je ne stvara");
  const stvorena = oznakaDojavitelja();
  assert.equal(postojecaOznaka(), stvorena, "poslije dojave čita istu");
  zaboraviDojavitelja();
  assert.equal(postojecaOznaka(), null, "poslije brisanja je opet nema");
});
