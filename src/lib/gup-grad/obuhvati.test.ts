import assert from "node:assert/strict";
import test from "node:test";

import { cekanje, objave, type SvojstvaObuhvata } from "@/lib/gup-grad/obuhvati";

test("objave: prva je donošenje, izmjene bez pročišćenih tekstova i ispravaka", () => {
  assert.deepEqual(objave("12/09, 61/18, 1/19-ispravak, 2/19-pročišćeni tekst odredbi i grafike"), {
    donesen: 2009,
    izmjene: [2018],
  });
  assert.deepEqual(objave("23/04"), { donesen: 2004, izmjene: [] });
  // stari PUP i brojevi s crticom
  assert.deepEqual(objave("3/85, 9/85, 37/87, 6-II/90, 7/96"), { donesen: 1985, izmjene: [1985, 1987, 1990, 1996] });
  assert.deepEqual(objave("2-98, 1-07"), { donesen: 1998, izmjene: [2007] });
  assert.deepEqual(objave(undefined), { donesen: null, izmjene: [] });
});

test("cekanje: dio propisanog obuhvata koji čeka plan i ostatak po GUP-u", () => {
  const s: SvojstvaObuhvata = { vrsta: "propisan", broj: 18, naziv: "UPU Dračevac 2", ha: 29.9, tocka: [0, 0] };
  const r = cekanje({ ...s, sanacija_ha: 13.9, neuredeno_ha: 13.0, preobrazba_ha: 0.4 });
  assert.equal(Math.round(r.ceka * 10) / 10, 27.3);
  assert.equal(Math.round(r.poGupu * 10) / 10, 2.6);
  assert.deepEqual(cekanje({ ...s, sanacija_ha: 0, neuredeno_ha: 0, preobrazba_ha: 0 }), { ceka: 0, poGupu: 29.9 });
});
