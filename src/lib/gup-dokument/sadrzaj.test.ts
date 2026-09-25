import assert from "node:assert/strict";
import { test } from "node:test";

import { izdanje } from "./izdanja";
import { ucitajDokument } from "./podaci";
import { razineNaslova, sadrzajDokumenta } from "./sadrzaj";

const n = (t: string, r: number) => ({ t, r });

test("nenumerirani naslov usred numeriranih je podnaslov, na rubovima ostaje", () => {
  assert.deepEqual(
    razineNaslova([
      n("GRAD SPLIT GRADSKO VIJEĆE", 1),
      n("9.2.1. Povijesne graditeljske cjeline", 3),
      n("ZONA „A“", 1),
      n("„4.1. UVJETI SMJEŠTAJA", 1),
      n("PRIJELAZNE I ZAVRŠNE ODREDBE", 1),
      n("1. Korištenje i namjena prostora 1:10.000", 5),
    ]),
    [1, 3, 4, 1, 1, 5],
  );
});

test("sadržaj plana na snazi: poglavlja redom, članci i stranice sa sidrima teksta", async () => {
  const izd = izdanje("2015")!;
  const s = sadrzajDokumenta(izd, await ucitajDokument("55-14"));
  const poglavlja = s.naslovi.filter((x) => x.r === 1).map((x) => x.t.split(" ")[0]);
  assert.deepEqual(poglavlja, ["GRAD", ...Array.from({ length: 12 }, (_, i) => `${i + 1}.`), "PRIJELAZNE"]);
  assert.ok(s.naslovi.some((x) => x.t === "8.6.10. Gradski projekt Dračevac" && x.r === 3 && x.s === 62));
  assert.ok(s.naslovi.every((x) => x.r <= 4));
  assert.deepEqual(s.clanci.find((c) => c.cl === "53"), { id: "cl-53", cl: "53", s: 36 });
  assert.equal(s.stranice[0].id, "str-2");
  assert.deepEqual(
    s.stranice.map((x) => x.s),
    [...new Set(s.stranice.map((x) => x.s))].sort((a, b) => a - b),
  );
});

test("drugi dokument izdanja dobiva sidra s predmetkom", async () => {
  const izd = izdanje("2006")!;
  const s = sadrzajDokumenta(izd, await ucitajDokument("3-08"));
  assert.equal(s.sidro, "dok-3-08");
  assert.equal(s.clanci[0].id, "3-08-cl-1");
  assert.equal(s.stranice[0].id, "3-08-str-2");
});
