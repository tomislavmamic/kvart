import assert from "node:assert/strict";
import test from "node:test";

import { primijeniVjetar, slozOcitanja } from "@/lib/sim/dohvat";
import { slozCrtu, SATI_UNATRAG, SATI_ZALETA, SATI_UNAPRIJED } from "@/lib/sim/kadrovi";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";

const SADA = new Date("2026-08-21T15:00:00.000Z");

function crtaNaModelu() {
  const vjetrovi = new Map<string, SatniVjetar>();
  const dubine = new Map<string, number>();
  for (let i = -(SATI_UNATRAG + SATI_ZALETA); i <= SATI_UNAPRIJED; i += 1) {
    const sat = new Date(SADA.getTime() + i * 3600000).toISOString();
    vjetrovi.set(sat, { sat, smjerOd: 200, brzina: 4, tisina: false, izvor: "model" });
    dubine.set(sat, 300);
  }
  return slozCrtu(SADA, vjetrovi, dubine, new Map());
}

function izmjeren(sat: string): SatniVjetar {
  return { sat, smjerOd: 112.5, brzina: 1.2, tisina: false, izvor: "split3" };
}

test("izmjereni vjetar zamjenjuje modelski i mijenja oznaku izvora", () => {
  const crta = crtaNaModelu();
  const sat = new Date(SADA.getTime() - 3 * 3600000).toISOString();
  const spojena = primijeniVjetar(crta, new Map([[sat, izmjeren(sat)]]));
  const kadar = spojena.kadrovi.find((k) => k.sat === sat)!;
  assert.equal(kadar.izvor, "split3");
  assert.equal(kadar.stanje?.smjerOd, 112.5);
  assert.equal(kadar.stanje?.brzina, 1.2);
});

test("dubina sloja ostaje modelska i kad vjetar dođe s postaje", () => {
  const crta = crtaNaModelu();
  const sat = new Date(SADA.getTime() - 3 * 3600000).toISOString();
  const spojena = primijeniVjetar(crta, new Map([[sat, izmjeren(sat)]]));
  const kadar = spojena.kadrovi.find((k) => k.sat === sat)!;
  assert.equal(kadar.stanje?.dubina, 300, "postaja dubinu sloja ne mjeri");
});

test("prognozirani sat ne prima izmjereni vjetar", () => {
  const crta = crtaNaModelu();
  const sat = new Date(SADA.getTime() + 2 * 3600000).toISOString();
  const spojena = primijeniVjetar(crta, new Map([[sat, izmjeren(sat)]]));
  const kadar = spojena.kadrovi.find((k) => k.sat === sat)!;
  assert.equal(kadar.izvor, "model", "izmjerene budućnosti nema");
});

test("satovi koje mjerenje ne pokriva ostaju na modelu", () => {
  const crta = crtaNaModelu();
  const sat = new Date(SADA.getTime() - 3 * 3600000).toISOString();
  const spojena = primijeniVjetar(crta, new Map([[sat, izmjeren(sat)]]));
  const drugi = spojena.kadrovi.find((k) => k.pomak === -4)!;
  assert.equal(drugi.izvor, "model");
  assert.equal(
    spojena.kadrovi.length,
    crta.kadrovi.length,
    "spajanje ne smije dodati ni oduzeti kadar",
  );
});

test("zalet dobiva izmjereni vjetar jednako kao vidljivi kadrovi", () => {
  const crta = crtaNaModelu();
  const sat = crta.zalet[0].sat;
  const spojena = primijeniVjetar(crta, new Map([[sat, izmjeren(sat)]]));
  assert.equal(spojena.zalet[0].izvor, "split3");
});

test("mjerenja obiju postaja slažu se na isti sat, svako sa svojom tvari", () => {
  const k1 = `<table>
    <tr><th>datum</th><th>sat</th><th>H2S</th></tr>
    <tr><td>21.08.2026</td><td>3:00</td><td>2.758</td></tr></table>`;
  const k2 = `<table>
    <tr><th>datum</th><th>sat</th><th>metil+etilmerkaptan</th></tr>
    <tr><td>21.08.2026</td><td>3:00</td><td>-</td></tr></table>`;
  const po = slozOcitanja(new Map([["k1", [k1]], ["k2", [k2]]]));
  const sat = po.get("2026-08-21T00:00:00.000Z")!;
  assert.equal(sat.length, 2, "obje postaje na istom satu");
  assert.equal(sat.find((o) => o.postaja === "k1")?.vrijednost, 2.758);
  assert.equal(
    sat.find((o) => o.postaja === "k2")?.vrijednost,
    null,
    "postaja koja šuti ostaje vidljiva, s prazninom",
  );
});

test("dvije stranice iste postaje ne udvostručuju očitanje", () => {
  const stranica = `<table>
    <tr><th>datum</th><th>sat</th><th>H2S</th></tr>
    <tr><td>21.08.2026</td><td>3:00</td><td>2.758</td></tr></table>`;
  const po = slozOcitanja(new Map([["k1", [stranica, stranica]]]));
  assert.equal(po.get("2026-08-21T00:00:00.000Z")?.length, 1);
});
