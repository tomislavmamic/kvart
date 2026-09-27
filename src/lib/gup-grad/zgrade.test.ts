import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { FeatureCollection } from "geojson";

import type { SvojstvaCestice } from "@/lib/gup-grad/provjera";

/** Ručni ispravci skupine zgrade (scripts/gup-grad/cestice.py, ispravi-zgrade.py). */
interface IspravakZgrade {
  ko: number;
  broj: number;
  katastar: string;
  skupina: number;
  napomena: string;
  izvori: string[];
}

const ispravci = (
  JSON.parse(readFileSync(path.join(process.cwd(), "data", "gup-grad", "pregled", "zgrade.json"), "utf8")) as {
    zgrade: IspravakZgrade[];
  }
).zgrade;

test("ispravak zgrade ima skupinu, napomenu i izvore", () => {
  assert.ok(ispravci.length > 0);
  for (const z of ispravci) {
    assert.ok(z.skupina >= 1 && z.skupina <= 5, `${z.ko}/${z.broj}`);
    assert.ok(z.napomena.length > 20 && z.izvori.length > 0, `${z.ko}/${z.broj}`);
    // ispravak mijenja skupinu, inače nije potreban
    assert.notEqual(Math.floor(Number(z.katastar.split(" ")[0]) / 100), z.skupina);
  }
});

test("poslovna zgrada na Dračevcu 4d broji se kao poslovna, s napomenom na čestici", () => {
  const dir = path.join(process.cwd(), "public", "geo", "gup-grad", "cestice");
  const cestica = readdirSync(dir)
    .flatMap((f) => (JSON.parse(readFileSync(path.join(dir, f), "utf8")) as FeatureCollection).features)
    .map((f) => f.properties as SvojstvaCestice)
    .find((s) => s.ko === "SPLIT" && s.kc === "285/1");
  assert.ok(cestica?.zn);
  // komad je [klasa, n, zk, z25, kat, pr, pa, jv, os, inf, ze, gr, g, us]: g je skupina zgrade
  for (const komadi of Object.values(cestica.k)) for (const k of komadi ?? []) assert.equal(k[12], 2);
});
