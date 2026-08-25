import assert from "node:assert/strict";
import test from "node:test";

import { SATI_ZALETA_KARTICE, slozi } from "@/lib/zrak";
import type { ZrakSada } from "@/lib/vjetar";

const ZRAK: ZrakSada = {
  stanje: { smjerOd: 112, brzina: 1.4, dubina: 60 },
  vjetar: {
    postaja: "ldsp",
    smjerOd: 112,
    brzina: 1.4,
    tisina: false,
    promjenjiv: false,
    opazeno: "2026-08-24T10:00:00Z",
  },
  ocitanja: [],
  mijesanje: { dubina: 60, vrijeme: "2026-08-24T10:00:00Z" },
  izvor: "uzivo",
};

test("zalet nosi polje svakog prethodnog sata, s dubinom i brzinom", () => {
  // Kartica se grije kroz stvarne prošle sate, pa svako zaletno polje mora
  // nositi ono o čemu koračanje i zastojno širenje ovise: brzinu i dubinu.
  const prije = [
    { smjerOd: 40, brzina: 3.0, dubina: 300 },
    { smjerOd: 100, brzina: 0.6, dubina: 40 },
  ];
  const { zalet, polje } = slozi(ZRAK, prije);
  assert.equal(zalet?.length, prije.length);
  for (const [i, z] of (zalet ?? []).entries()) {
    assert.equal(z.brzina, prije[i].brzina);
    assert.equal(z.dubina, prije[i].dubina);
    assert.equal(z.gw, polje.gw);
    assert.equal(z.gh, polje.gh);
    assert.ok(z.vx.length > 0 && z.vy.length > 0);
    // Masku nosi samo glavno polje; zaletna je ne dupliciraju.
    assert.ok(!("maska" in z));
  }
});

test("bez zaleta kartica ostaje upotrebljiva", () => {
  const { zalet } = slozi(ZRAK);
  assert.deepEqual(zalet, []);
});

test("zalet kartice pokriva vidljivo pamćenje prikaza", () => {
  // `raspad` od 40 s prikaza uz ubrzanje 60 znači ~40 minuta stvarnog zraka
  // vidljivog u prizoru; dva sata zaleta to pokrivaju s pričuvom. Padne li
  // ova provjera, netko je produljio pamćenje prikaza — produljite i zalet.
  assert.ok(SATI_ZALETA_KARTICE >= 2);
});
