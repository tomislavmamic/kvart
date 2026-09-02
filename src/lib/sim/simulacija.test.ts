import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { razina, SIDRO_KARTICE, UBRZANJE } from "@/lib/dim";
import { SIDRO_SIMULATORA } from "@/lib/sim/ljestvica";
import { razloziOsnove } from "@/lib/sim/polje";
import {
  korakZaBrzinu,
  odradiSatove,
  POSTAVKE_SIMULATORA,
  redoslijed,
  SEKUNDI_PO_SATU,
  ZALET_SATI,
  zaSat,
  type SatSimulacije,
} from "@/lib/sim/simulacija";

function osnove() {
  const b = readFileSync("public/karepovac/sim-polje.bin");
  return razloziOsnove(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/** Vrijeme na koje je ljestvica usidrena: slab istok-jugoistočnjak, plitak sloj. */
const REF = { smjerOd: 112.5, brzina: 1.2, dubina: 80 };

function niz(n: number, stanje = REF): SatSimulacije[] {
  return Array.from({ length: n }, (_, i) => ({ sat: `s${i}`, stanje }));
}

/** 99. postotak gustoće nad plohom — ista mjera kojom je sidro određeno. */
function nadPlohom(slika: ReturnType<typeof odradiSatove>, o: ReturnType<typeof osnove>) {
  const vrijednosti: number[] = [];
  for (let j = 0; j < slika.visina; j += 1) {
    for (let i = 0; i < slika.sirina; i += 1) {
      const mi = Math.min(o.gw - 1, Math.floor((i / slika.sirina) * o.gw));
      const mj = Math.min(o.gh - 1, Math.floor((j / slika.visina) * o.gh));
      if (o.maska[mj * o.gw + mi] > 128) vrijednosti.push(slika.gustoca[j * slika.sirina + i]);
    }
  }
  vrijednosti.sort((a, b) => a - b);
  return vrijednosti[Math.floor(0.99 * (vrijednosti.length - 1))];
}

test("zalet pokriva vijek čestice, inače kadar nije samodostatan", () => {
  // `vijek` je 160 s prikaza; pri ubrzanju od 60 to je 2,67 stvarnih sati.
  const vijekSati = 160 / (3600 / UBRZANJE);
  assert.ok(
    ZALET_SATI >= vijekSati,
    `zalet od ${ZALET_SATI} h ne pokriva vijek od ${vijekSati.toFixed(2)} h`,
  );
});

test("sat prikaza traje točno sat stvarnog vremena", () => {
  assert.equal(SEKUNDI_PO_SATU * UBRZANJE, 3600);
});

test("korak se steže kad vjetar ojača", () => {
  const celija = 25;
  assert.ok(korakZaBrzinu(8, celija) < korakZaBrzinu(1.2, celija));
  assert.ok(korakZaBrzinu(1.2, celija) <= 0.5, "korak ima gornju granicu");
  assert.ok(korakZaBrzinu(50, celija) >= 0.1, "i donju, da račun stane");
  assert.equal(korakZaBrzinu(0, celija), 0.5, "tišina ne dijeli nulom");
});

test("čestica po koraku ne prijeđe više od dopuštenog broja ćelija", () => {
  const celija = 25;
  for (const brzina of [0.5, 1.2, 3, 8]) {
    const dt = korakZaBrzinu(brzina, celija);
    const put = brzina * UBRZANJE * dt;
    assert.ok(
      put <= 2 * celija + 1e-9 || dt === 0.1,
      `pri ${brzina} m/s korak prijeđe ${put.toFixed(0)} m`,
    );
  }
});

test("za sat se uzima zalet i on sam, ne cijela crta", () => {
  const svi = niz(10);
  const uzeto = zaSat(svi, "s7");
  assert.equal(uzeto.length, ZALET_SATI + 1);
  assert.equal(uzeto.at(-1)?.sat, "s7", "traženi sat je posljednji");
  assert.equal(uzeto[0].sat, "s4");
});

test("najstariji sat uzima zalet koliko ga ima, bez pucanja", () => {
  const uzeto = zaSat(niz(10), "s1");
  assert.equal(uzeto.at(-1)?.sat, "s1");
  assert.equal(uzeto.length, 2, "prije njega postoji samo jedan sat");
});

test("sat kojega u nizu nema ne daje kadar", () => {
  assert.deepEqual(zaSat(niz(3), "nema"), []);
  assert.throws(() => odradiSatove([], osnove()), /Nema sata/);
});

test("računa se od odabranog sata prema van", () => {
  const satovi = ["a", "b", "c", "d", "e"];
  assert.deepEqual(redoslijed(satovi, "c").slice(0, 3), ["c", "b", "d"]);
  assert.equal(redoslijed(satovi, "c").length, satovi.length, "nijedan se ne gubi");
});

test("oblik perjanice nad plohom stoji — inače sidro treba izvesti iznova", () => {
  // Kanarinac za mjerilo gustoće simulatora; vidi istoimenu provjeru u
  // `dim.test.ts`. Sidro (`SIDRO_SIMULATORA`) izvodi se regresijom prema
  // mjerenjima i ovisi o obliku perjanice — kad se oblik promijeni, sidro se
  // ne prepisuje nego izvodi iznova.
  // 2. 9. 2026.: 19,33 → 30,0 uz E3 + E5 (spremnik za vijek, satni prosjek,
  // difuzija po razredu); sidro izvedeno iznova, vidi `ljestvica.ts`.
  const GUSTOCA_NAD_PLOHOM_REF = 30.0;
  const o = osnove();
  const slika = odradiSatove(zaSat(niz(8), "s7"), o);
  const izmjereno = nadPlohom(slika, o);
  assert.ok(
    Math.abs(izmjereno - GUSTOCA_NAD_PLOHOM_REF) / GUSTOCA_NAD_PLOHOM_REF < 0.1,
    `referenca je ${GUSTOCA_NAD_PLOHOM_REF}, a model daje ${izmjereno.toFixed(1)} — `
      + "oblik se promijenio, sidro izvedi iznova",
  );
});

test("sidro simulatora nije prepisano s užeg okvira", () => {
  // Ćelija je 32 m umjesto 13 m, pa ista perjanica ovdje daje veći broj.
  // Oba sidra izlaze iz iste regresije prema mjerenjima, a razlikuju se
  // upravo omjerom gustoća dvaju okvira — izjednače se jedino ako je netko
  // prepisao umjesto izveo.
  assert.ok(
    SIDRO_SIMULATORA > SIDRO_KARTICE * 1.5,
    `sidro ${SIDRO_SIMULATORA} nije osjetno veće od ${SIDRO_KARTICE}`,
  );
});

test("na sidru se sumporovodik čita kao oko dva puta iznad praga mirisa", () => {
  // Medijan uz plohu je 1,135 µg/m³, prag mirisa 0,571 — dakle 1,99×.
  const v = razina(SIDRO_SIMULATORA, "sumporovodik", SIDRO_SIMULATORA);
  const jedinica = 10 ** (v * (Math.log10(100) - Math.log10(0.03)) + Math.log10(0.03));
  assert.ok(Math.abs(jedinica - 1.99) < 0.05, `ispalo je ${jedinica.toFixed(2)}×`);
});

test("jača emisija diže razinu, slabija je spušta", () => {
  const slabo = razina(SIDRO_SIMULATORA * 0.5, "sumporovodik", SIDRO_SIMULATORA);
  const isto = razina(SIDRO_SIMULATORA, "sumporovodik", SIDRO_SIMULATORA);
  const jako = razina(SIDRO_SIMULATORA * 2, "sumporovodik", SIDRO_SIMULATORA);
  assert.ok(slabo < isto && isto < jako);
  assert.equal(razina(0, "sumporovodik", SIDRO_SIMULATORA), 0, "bez izvora nema boje");
});

test("merkaptani se pri istoj gustoći čitaju kao jači miris od H₂S", () => {
  const h = razina(SIDRO_SIMULATORA, "sumporovodik", SIDRO_SIMULATORA);
  const m = razina(SIDRO_SIMULATORA, "merkaptani", SIDRO_SIMULATORA);
  assert.ok(m > h, "isti zrak smrdi jače na merkaptane — zato se i razlikuju");
});

test("isti sat izračunat dvaput daje istu sliku", () => {
  const o = osnove();
  const a = odradiSatove(zaSat(niz(6), "s5"), o);
  const b = odradiSatove(zaSat(niz(6), "s5"), o);
  assert.deepEqual(Array.from(a.gustoca.slice(0, 400)), Array.from(b.gustoca.slice(0, 400)));
});

test("jak vjetar isprazni okvir, tišina ga napuni", () => {
  const o = osnove();
  const tiho = odradiSatove(zaSat(niz(6, { smjerOd: 112.5, brzina: 0.6, dubina: 60 }), "s5"), o);
  const bura = odradiSatove(zaSat(niz(6, { smjerOd: 45, brzina: 12, dubina: 900 }), "s5"), o);
  const zbroj = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
  assert.ok(
    zbroj(tiho.gustoca) > zbroj(bura.gustoca),
    "pri tišini se nad kvartom mora nakupiti više nego pri buri",
  );
});

test("slika ne dijeli spremnik s idućim satom", () => {
  const o = osnove();
  const svi = niz(8);
  const a = odradiSatove(zaSat(svi, "s5"), o);
  const prije = a.gustoca[a.gustoca.length >> 1];
  odradiSatove(zaSat(svi, "s6"), o);
  assert.equal(a.gustoca[a.gustoca.length >> 1], prije, "prethodni kadar mora preživjeti");
});

test("rešetka gustoće je ona koju postavke traže", () => {
  const slika = odradiSatove(zaSat(niz(5), "s4"), osnove());
  assert.equal(slika.sirina, POSTAVKE_SIMULATORA.sirina);
  assert.equal(slika.visina, slika.sirina, "okvir je kvadrat, pa je i rešetka");
});
