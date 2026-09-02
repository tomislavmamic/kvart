import assert from "node:assert/strict";
import test from "node:test";

import { SATI_UNAPRIJED, SATI_UNATRAG } from "@/lib/sim/kadrovi";
import { crtaScenarija, IMENA_SCENARIJA, jeScenarij, SCENARIJI } from "@/lib/sim/scenariji";

test("svaki scenarij daje punu crtu i uvijek istu", () => {
  for (const ime of IMENA_SCENARIJA) {
    const crta = crtaScenarija(ime)!;
    assert.ok(crta, ime);
    assert.equal(crta.kadrovi.length, SATI_UNATRAG + 1 + SATI_UNAPRIJED, `${ime}: 28 kadrova`);
    assert.equal(crta.sada, SCENARIJI.get(ime)!.sada);
    assert.ok(crta.kadrovi.every((k) => k.dostupnost !== "nedostupno"), `${ime}: nema rupa`);
    assert.ok(
      crta.kadrovi.filter((k) => k.vrsta === "prognoza").every((k) => k.izvor === "model"),
      `${ime}: prognoza je iz modela`,
    );
    assert.deepEqual(crtaScenarija(ime), crta, `${ime}: isti ulaz, ista crta`);
  }
  assert.equal(crtaScenarija("nepostojeci"), null);
  assert.equal(jeScenarij("jak"), true);
  assert.equal(jeScenarij(""), false);
});

test("jak: noću lagan jugoistočnjak pod plitkim slojem, razred stabilan", () => {
  const sada = crtaScenarija("jak")!.kadrovi.find((k) => k.pomak === 0)!;
  assert.ok(sada.stanje!.smjerOd > 95 && sada.stanje!.smjerOd < 130, `smjer ${sada.stanje!.smjerOd}`);
  assert.ok(sada.stanje!.brzina >= 1 && sada.stanje!.brzina < 2, `brzina ${sada.stanje!.brzina}`);
  assert.ok(sada.stanje!.dubina <= 100, `dubina ${sada.stanje!.dubina}`);
  assert.equal(sada.izvor, "vrboran");
  assert.ok((sada.stanje!.stabilnost ?? 3) >= 4, `noćni razred je E ili F, ne ${sada.stanje!.stabilnost}`);
});

test("nista: danju nestabilan razred, jer je sunce visoko", () => {
  const sada = crtaScenarija("nista")!.kadrovi.find((k) => k.pomak === 0)!;
  assert.ok((sada.stanje!.stabilnost ?? 3) <= 2, `dnevni razred je A–C, ne ${sada.stanje!.stabilnost}`);
});

test("nesiguran: tišina i model, nijedna postaja ne javlja", () => {
  const crta = crtaScenarija("nesiguran")!;
  const oko = crta.kadrovi.filter((k) => k.pomak >= -3 && k.pomak <= 0);
  assert.ok(oko.every((k) => k.vjetar!.tisina), "tišina oko sadašnjeg sata");
  assert.ok(crta.kadrovi.every((k) => k.izvor === "model"), "sve iz modela");
  assert.ok(oko.every((k) => k.ocitanja.every((o) => o.vrijednost === null)), "postaje šute");
});

test("okret: smjer se između −4 h i +3 h okrene za oko 180°", () => {
  const crta = crtaScenarija("okret")!;
  const prije = crta.kadrovi.find((k) => k.pomak === -4)!.stanje!.smjerOd;
  const poslije = crta.kadrovi.find((k) => k.pomak === 3)!.stanje!.smjerOd;
  const d = (((poslije - prije) % 360) + 360) % 360;
  const okret = Math.min(d, 360 - d);
  assert.ok(Math.abs(okret - 180) < 45, `okret je ${okret}°, a ne oko 180°`);
});

test("prošli satovi nose očitanja, zadnja dva su prazna kao uživo", () => {
  const crta = crtaScenarija("jak")!;
  const staro = crta.kadrovi.find((k) => k.pomak === -5)!;
  assert.ok(staro.ocitanja.some((o) => o.vrijednost !== null));
  const sada = crta.kadrovi.find((k) => k.pomak === 0)!;
  assert.ok(sada.ocitanja.every((o) => o.vrijednost === null));
});
