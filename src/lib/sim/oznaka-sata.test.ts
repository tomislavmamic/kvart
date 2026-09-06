import assert from "node:assert/strict";
import test from "node:test";

import {
  istiDan,
  kratkoImePostaje,
  natpisZastarjele,
  oznakaSata,
  opisIzvoraSata,
  opisIzvoraSataKratko,
  razmakSati,
  starost,
  zastarjela,
} from "@/lib/sim/oznaka-sata";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";
import type { Vjetar } from "@/lib/vjetar";

/** Gledatelj gleda u 23:36 po Splitu (21:36 Z); tekući sat je 21:00 Z. */
const GLEDATELJ = new Date("2026-09-04T21:36:00.000Z");

function ocitanje(postaja: Vjetar["postaja"], opazeno: string): Vjetar {
  return { postaja, smjerOd: 100, brzina: 1, tisina: false, promjenjiv: false, opazeno };
}

test("riječ uz sat izlazi iz sata gledatelja, ne iz oznake na kadru", () => {
  assert.equal(oznakaSata({ sat: "2026-09-04T21:00:00.000Z" }, GLEDATELJ), "sada");
  assert.equal(oznakaSata({ sat: "2026-09-04T18:00:00.000Z" }, GLEDATELJ), "prije 3 h");
  assert.equal(oznakaSata({ sat: "2026-09-04T23:00:00.000Z" }, GLEDATELJ), "prognoza +2 h");
  assert.equal(razmakSati("2026-09-03T17:00:00.000Z", GLEDATELJ), 28);
});

test("crta složena za prošli sat nikad se ne zove „sada”", () => {
  // Crta od jučer 17:00 Z, kakvu je Vercel posluživao 4. 9. 2026.
  const stara = "2026-09-03T17:00:00.000Z";
  assert.equal(zastarjela(stara, GLEDATELJ), true);
  assert.equal(oznakaSata({ sat: stara }, GLEDATELJ), "prije 28 h");
  assert.equal(natpisZastarjele(stara, GLEDATELJ), "podaci od 19:00, prije 28 h — osvježavam…");
  assert.equal(
    natpisZastarjele(stara, GLEDATELJ, "greska"),
    "podaci od 19:00, prije 28 h — osvježavanje nije uspjelo",
  );
});

test("crta iz tekućeg sata nije zastarjela ni pet minuta nakon prijelaza sata", () => {
  assert.equal(zastarjela("2026-09-04T21:00:00.000Z", GLEDATELJ), false);
  // Sat je prošao prije četiri minute; osvježavanje tek kreće.
  assert.equal(zastarjela("2026-09-04T21:00:00.000Z", new Date("2026-09-04T22:04:00.000Z")), false);
  assert.equal(zastarjela("2026-09-04T21:00:00.000Z", new Date("2026-09-04T22:06:00.000Z")), true);
});

test("starost očitanja je u minutama do sata, poslije u satima", () => {
  assert.equal(starost("2026-09-04T21:24:00.000Z", GLEDATELJ), "prije 12 min");
  assert.equal(starost("2026-09-04T19:30:00.000Z", GLEDATELJ), "prije 2 h");
  assert.equal(starost("2026-09-04T21:36:00.000Z", GLEDATELJ), "upravo sad");
});

test("izvor sata kaže kad je i gdje izmjeren, a za model kad je postaja zadnji put javila", () => {
  const sat = "2026-09-04T21:00:00.000Z";
  const sadaOcitanja = [
    ocitanje("vrboran", "2026-09-04T21:24:00.000Z"),
    ocitanje("split3", "2026-09-04T20:00:00.000Z"),
  ];
  const serije = new Map<Vjetar["postaja"], Map<string, SatniVjetar>>([
    ["split3", new Map([[ "2026-09-04T20:00:00.000Z", { sat: "2026-09-04T20:00:00.000Z", smjerOd: 100, brzina: 1, tisina: false, izvor: "split3" } ]])],
  ]);

  // Tekući sat vodi Neverinovo opažanje, promaknuto u sat.
  assert.equal(
    opisIzvoraSata({ sat, vrsta: "sada", izvor: "vrboran" }, sadaOcitanja, serije, GLEDATELJ),
    "izmjeren 23:24 (prije 12 min), Vrboran",
  );
  // Prošli sat iz AZO-ova satnog niza.
  assert.equal(
    opisIzvoraSata({ sat: "2026-09-04T20:00:00.000Z", vrsta: "izmjereno", izvor: "split3" }, sadaOcitanja, serije, GLEDATELJ),
    "izmjeren, Split-3 (satni prosjek)",
  );
  // Sat na modelu: kaže tko je zadnji javio.
  assert.equal(
    opisIzvoraSata({ sat, vrsta: "sada", izvor: "model" }, sadaOcitanja, serije, GLEDATELJ),
    "iz modela; zadnje očitanje Vrboran 23:24 (prije 12 min)",
  );
  assert.equal(opisIzvoraSata({ sat, vrsta: "sada", izvor: "model" }, [], serije, GLEDATELJ), "iz modela; nijedna postaja ne javlja");
  assert.equal(opisIzvoraSata({ sat, vrsta: "prognoza", izvor: "model" }, sadaOcitanja, serije, GLEDATELJ), "iz modela (prognoza)");
  assert.equal(opisIzvoraSata({ sat, vrsta: "sada", izvor: null }, sadaOcitanja, serije, GLEDATELJ), "nije poznat");
});

test("natpis stare crte za čitač zaslona ide bez glagola, a datum se piše samo kad nije današnji", () => {
  const stara = "2026-09-03T17:00:00.000Z";
  assert.equal(natpisZastarjele(stara, GLEDATELJ, null), "podaci od 19:00, prije 28 h");
  assert.equal(istiDan("2026-09-04T18:00:00.000Z", GLEDATELJ), true);
  assert.equal(istiDan("2026-09-03T21:00:00.000Z", GLEDATELJ), false);
  // Mjesni dan, ne UTC: 22:30 Z je 00:30 sutradan po Splitu.
  assert.equal(istiDan("2026-09-04T22:30:00.000Z", GLEDATELJ), false);
  assert.equal(kratkoImePostaje("vrboran"), "Vrboran");
  assert.equal(kratkoImePostaje("split3"), "Split-3");
  assert.equal(kratkoImePostaje("marjan"), "Marjan");
});

test("kratki opis izvora za skupljenu karticu: bez starosti, s trenutkom kad ga ima", () => {
  const sat = "2026-09-04T21:00:00.000Z";
  const sadaOcitanja = [ocitanje("vrboran", "2026-09-04T21:24:00.000Z")];
  const prazno = new Map<Vjetar["postaja"], Map<string, SatniVjetar>>();
  assert.equal(opisIzvoraSataKratko({ sat, vrsta: "sada", izvor: "vrboran" }, sadaOcitanja, prazno), "izmjeren 23:24, Vrboran");
  assert.equal(opisIzvoraSataKratko({ sat, vrsta: "izmjereno", izvor: "split3" }, [], prazno), "izmjeren, Split-3");
  assert.equal(opisIzvoraSataKratko({ sat, vrsta: "sada", izvor: "model" }, sadaOcitanja, prazno), "vjetar iz modela");
  assert.equal(opisIzvoraSataKratko({ sat, vrsta: "prognoza", izvor: "model" }, [], prazno), "prognoza, iz modela");
  assert.equal(opisIzvoraSataKratko({ sat, vrsta: "sada", izvor: null }, [], prazno), "vjetar nije poznat");
});
