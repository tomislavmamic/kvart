import assert from "node:assert/strict";
import test from "node:test";

import {
  najbliziDostupan,
  SATI_UNAPRIJED,
  SATI_UNATRAG,
  SATI_ZALETA,
  satoviCrte,
  slozCrtu,
  slozKadar,
  type OcitanjePostaje,
} from "@/lib/sim/kadrovi";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";

const SADA = new Date("2026-08-21T15:00:00.000Z");

function vjetar(sat: string, izvor: SatniVjetar["izvor"] = "split3"): SatniVjetar {
  return { sat, smjerOd: 112.5, brzina: 1.2, tisina: false, izvor };
}

/** Puni niz koji pokriva zalet, prošlost i tri sata prognoze. */
function puniNizovi(unaprijed = SATI_UNAPRIJED) {
  const vjetrovi = new Map<string, SatniVjetar>();
  const dubine = new Map<string, number>();
  for (let i = -(SATI_UNATRAG + SATI_ZALETA); i <= unaprijed; i += 1) {
    const sat = new Date(SADA.getTime() + i * 3600000).toISOString();
    vjetrovi.set(sat, vjetar(sat, i > 0 ? "model" : "split3"));
    dubine.set(sat, 80);
  }
  return { vjetrovi, dubine };
}

const MJERENJE: OcitanjePostaje = {
  postaja: "k1",
  tvar: "sumporovodik",
  vrijednost: 2.758,
  jedinica: "µg/m³",
  ispodGranice: false,
};

test("crta ima 24 sata unatrag, sadašnji i tri unaprijed", () => {
  const { crta, zalet } = satoviCrte(SADA);
  assert.equal(crta.length, SATI_UNATRAG + 1 + SATI_UNAPRIJED, "28 kadrova");
  assert.equal(crta[0], "2026-08-20T15:00:00.000Z", "prvi je 24 h unatrag");
  assert.equal(crta.at(-1), "2026-08-21T18:00:00.000Z", "zadnji je +3 h");
  assert.equal(zalet.length, SATI_ZALETA, "zalet je izvan crte");
  assert.ok(zalet.at(-1)! < crta[0], "zalet prethodi crti");
});

test("bez prognoze crta staje na sadašnjem satu", () => {
  const { crta } = satoviCrte(SADA, 0);
  assert.equal(crta.length, SATI_UNATRAG + 1);
  assert.equal(crta.at(-1), SADA.toISOString());
});

test("prognozirani sat ne nosi mjerenja ni kad ih se ponudi", () => {
  const kadar = slozKadar("2026-08-21T16:00:00.000Z", 1, vjetar("x", "model"), 80, [MJERENJE]);
  assert.equal(kadar.vrsta, "prognoza");
  assert.deepEqual(kadar.ocitanja, [], "postaje budućnost ne mjere");
});

test("izmjereni sat zadržava mjerenje i oznaku izvora", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, vjetar("x"), 80, [MJERENJE]);
  assert.equal(kadar.vrsta, "izmjereno");
  assert.equal(kadar.izvor, "split3");
  assert.equal(kadar.ocitanja[0].vrijednost, 2.758);
  assert.equal(kadar.dostupnost, "spreman");
});

test("sat bez vjetra je rupa, ne kadar s pretpostavkom", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, undefined, 80, [MJERENJE]);
  assert.equal(kadar.dostupnost, "nedostupno");
  assert.equal(kadar.stanje, null, "ne izmišlja se slučaj vremena");
});

test("sat bez dubine sloja jednako je rupa", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, vjetar("x"), undefined);
  assert.equal(kadar.dostupnost, "nedostupno");
});

test("sat s vjetrom ali bez mjerenja stoji kao djelomičan", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, vjetar("x"), 80, [
    { ...MJERENJE, vrijednost: null },
  ]);
  assert.equal(kadar.dostupnost, "djelomicno", "polje se dade računati, mjerenja nema");
  assert.equal(kadar.ocitanja[0].vrijednost, null, "nedostatak ostaje nedostatak");
});

test("crta se slaže do zadnjeg sata koji prognoza doista pokriva", () => {
  const { vjetrovi, dubine } = puniNizovi(1);
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(crta.kadrovi.at(-1)?.pomak, 1, "prognoza seže dokle podataka ima");
  assert.equal(crta.kadrovi.filter((k) => k.vrsta === "prognoza").length, 1);
});

test("kadrovi zaleta stoje izvan crte i nose stanje", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(crta.zalet.length, SATI_ZALETA);
  assert.ok(crta.zalet.every((k) => k.stanje !== null), "zalet mora imati čime hraniti model");
  assert.ok(
    crta.kadrovi.every((k) => k.pomak >= -SATI_UNATRAG),
    "zalet se ne smije pojaviti među vidljivim kadrovima",
  );
});

test("sadašnji sat je jedini označen kao „sada”", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  const sada = crta.kadrovi.filter((k) => k.vrsta === "sada");
  assert.equal(sada.length, 1);
  assert.equal(sada[0].sat, SADA.toISOString());
  assert.equal(sada[0].pomak, 0);
});

test("mjerenja se vežu uz svoj sat, a ne uz susjedni", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const sat = new Date(SADA.getTime() - 3 * 3600000).toISOString();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map([[sat, [MJERENJE]]]));
  const nas = crta.kadrovi.find((k) => k.sat === sat);
  assert.equal(nas?.ocitanja[0].vrijednost, 2.758);
  const susjed = crta.kadrovi.find((k) => k.pomak === -2);
  assert.deepEqual(susjed?.ocitanja, [], "susjedni sat ostaje bez mjerenja");
});

test("rupa u nizu ne pomiče ostale kadrove", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const rupa = new Date(SADA.getTime() - 5 * 3600000).toISOString();
  vjetrovi.delete(rupa);
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(crta.kadrovi.length, SATI_UNATRAG + 1 + SATI_UNAPRIJED, "broj kadrova je isti");
  assert.equal(crta.kadrovi.find((k) => k.sat === rupa)?.dostupnost, "nedostupno");
  assert.equal(crta.kadrovi.find((k) => k.pomak === -4)?.dostupnost !== "nedostupno", true);
});

test("odabir pada na najbliži dostupan sat, a ne na prazan", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const rupa = new Date(SADA.getTime() - 5 * 3600000).toISOString();
  vjetrovi.delete(rupa);
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(najbliziDostupan(crta, -5)?.pomak, -4, "skače na susjedni, ne ostaje prazan");
  assert.equal(najbliziDostupan(crta, 0)?.pomak, 0);
});

test("kad nijedan sat nema vjetra, crta to prizna", () => {
  const crta = slozCrtu(SADA, new Map(), new Map(), new Map());
  assert.equal(najbliziDostupan(crta, 0), null);
  assert.ok(crta.kadrovi.every((k) => k.dostupnost === "nedostupno"));
});
