import assert from "node:assert/strict";
import test from "node:test";

import { PRETPOSTAVLJENO, type ZrakSada } from "@/lib/vjetar";
import {
  imeVjetra,
  nosiPremaKvartu,
  opisiSkretanje,
  opisiSlabuPostaju,
  opisiZrak,
} from "@/lib/zrak-rijeci";

function stanje(dio: Partial<ZrakSada["vjetar"]> | null, izvor: ZrakSada["izvor"] = "uzivo"): ZrakSada {
  const vjetar = dio
    ? {
        postaja: "ldsp" as const,
        smjerOd: 112,
        brzina: 1.4,
        tisina: false,
        promjenjiv: false,
        opazeno: "2026-08-19T20:30:00.000Z",
        ...dio,
      }
    : null;
  return {
    stanje: {
      smjerOd: vjetar?.smjerOd ?? PRETPOSTAVLJENO.smjerOd,
      brzina: vjetar?.brzina ?? PRETPOSTAVLJENO.brzina,
      dubina: 60,
    },
    vjetar,
    ocitanja: vjetar ? [vjetar] : [],
    mijesanje: { dubina: 60, vrijeme: "2026-08-19T20:00Z" },
    izvor,
  };
}

test("vjetrovi nose domaća imena", () => {
  assert.equal(imeVjetra(90), "levant");
  assert.equal(imeVjetra(135), "jugo");
  assert.equal(imeVjetra(45), "bura");
  assert.equal(imeVjetra(315), "maestral");
  assert.equal(imeVjetra(360), "tramontana", "puni krug je isto sjever");
});

test("na kvart nosi samo vjetar s istoka do jugoistoka", () => {
  // Ploha je na 112° gledano iz sredine kvarta, pa nosi ono što puše otud.
  assert.equal(nosiPremaKvartu(112), true);
  assert.equal(nosiPremaKvartu(90), true);
  assert.equal(nosiPremaKvartu(300), false, "maestral nosi na drugu stranu");
  assert.equal(nosiPremaKvartu(200), false);
});

test("tišina se ne opisuje kao smjer", () => {
  const opis = opisiZrak(stanje({ brzina: 0.2, tisina: true }));
  assert.equal(opis.stanje, "stoji");
  assert.match(opis.recenica, /ne odlazi nikamo/);
  assert.doesNotMatch(opis.recenica, /prema kvartu/);
  assert.match(opis.natpis, /tišina/);
});

test("promjenjiv vjetar ne tvrdi kamo zrak ide", () => {
  const opis = opisiZrak(stanje({ promjenjiv: true, brzina: 1.5 }));
  assert.equal(opis.stanje, "nepoznato");
  assert.match(opis.recenica, /se ne može reći kamo/);
});

test("kad izvor šuti, prikaz to kaže i ne glumi sadašnjost", () => {
  const opis = opisiZrak(stanje(null, "pretpostavka"));
  assert.equal(opis.stanje, "nepoznato");
  assert.equal(opis.kada, null);
  assert.match(opis.recenica, /ne možemo dohvatiti/);
});

test("rečenica govori kamo zrak ide, nikad koliko mirisa nosi", () => {
  for (const dio of [{}, { smjerOd: 300 }, { brzina: 0.1, tisina: true }]) {
    const opis = opisiZrak(stanje(dio));
    for (const zabranjeno of ["miris je", "granic", "opasn", "µg", "ppb"]) {
      assert.doesNotMatch(opis.recenica, new RegExp(zabranjeno, "i"), zabranjeno);
    }
    assert.match(opis.recenica, /sloj/i, "dubina sloja mora stajati uz smjer");
  }
});

test("vrijeme opažanja piše se po domaćem satu", () => {
  const opis = opisiZrak(stanje({}));
  // 20:30 UTC ljeti je 22:30 u Splitu.
  assert.equal(opis.kada, "22:30");
});

test("kad kartu vodi zračna luka, uz nju ide ograda", () => {
  const osnova = {
    smjerOd: 112,
    brzina: 1.4,
    tisina: false,
    promjenjiv: false,
    opazeno: "2026-08-19T20:30:00.000Z",
  };
  for (const postaja of ["ldsp", "aerodrom"] as const) {
    const tekst = opisiSlabuPostaju({ ...osnova, postaja });
    assert.ok(tekst, postaja);
    assert.match(tekst, /noću nije pogađao epizode/);
  }
  for (const postaja of ["split3", "split2", "marjan"] as const) {
    assert.equal(opisiSlabuPostaju({ ...osnova, postaja }), null, postaja);
  }
});

test("rečenica o skretanju ne proturječi vlastitoj brojci", () => {
  // Ovo je bila greška uživo: kartica je tvrdila da struja „obilazi padinu”
  // i uz to ispisivala skretanje od 1°. Rečenica je bila pisana za plitak
  // sloj, a brojka je u međuvremenu postala živa.
  const jedva = opisiSkretanje({ medijan: 1, najvece: 2 });
  assert.doesNotMatch(jedva, /obilazi|ne penje/, `pri 1° piše: ${jedva}`);
  assert.match(jedva, /jedva/);

  const jako = opisiSkretanje({ medijan: 9, najvece: 51 });
  assert.match(jako, /obilazi/, `pri 9° piše: ${jako}`);

  const srednje = opisiSkretanje({ medijan: 4, najvece: 30 });
  assert.doesNotMatch(srednje, /obilazi/);
  assert.match(srednje, /zavija/);
});

test("rečenica o skretanju uvijek nosi obje brojke", () => {
  for (const [medijan, najvece] of [[0, 1], [1, 2], [3, 12], [9, 51], [20, 70]]) {
    const r = opisiSkretanje({ medijan, najvece });
    assert.match(r, new RegExp(`${medijan}°`), `nedostaje medijan u: ${r}`);
    assert.match(r, new RegExp(`${najvece}°`), `nedostaje najveće u: ${r}`);
  }
});
