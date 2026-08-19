import assert from "node:assert/strict";
import test from "node:test";

import { OKVIR } from "@/generated/karepovac-karta";
import { sastaviPolje } from "@/lib/polje-dima";
import { izvediStrujnice } from "@/lib/strujnice";

/** Kut prve i zadnje točke putanje, u kompasnim stupnjevima. */
function osPutanje(d: string): number {
  const brojevi = d
    .replace(/[ML]/g, " ")
    .trim()
    .split(/[\s]+/)
    .map(Number);
  const x0 = brojevi[0];
  const y0 = brojevi[1];
  const x1 = brojevi[brojevi.length - 2];
  const y1 = brojevi[brojevi.length - 1];
  return ((Math.atan2(x1 - x0, -(y1 - y0)) * 180) / Math.PI + 360) % 360;
}

/** Najmanji kut između dva kompasna smjera. */
function razlikaKuta(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

test("strujnice prate smjer vjetra koji sada puše", () => {
  for (const smjerOd of [112.5, 230, 45]) {
    const polje = sastaviPolje({ smjerOd, brzina: 2, dubina: 120 });
    const { putanje } = izvediStrujnice(polje, smjerOd);
    assert.ok(putanje.length > 10, `${smjerOd}°: samo ${putanje.length} putanja`);

    const osi = putanje.map(osPutanje);
    const ocekivano = (smjerOd + 180) % 360;
    const promasaj = osi.filter((os) => razlikaKuta(os, ocekivano) > 45).length;
    assert.ok(
      promasaj <= osi.length * 0.15,
      `${smjerOd}°: ${promasaj} od ${osi.length} putanja ide na svoju stranu`,
    );
  }
});

test("putanje ostaju u okviru karte", () => {
  const polje = sastaviPolje({ smjerOd: 112.5, brzina: 1.2, dubina: 80 });
  for (const d of izvediStrujnice(polje, 112.5).putanje) {
    const brojevi = d.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number);
    for (let i = 0; i < brojevi.length; i += 2) {
      assert.ok(
        brojevi[i] > -40 && brojevi[i] < OKVIR.sirina + 40,
        `x izvan okvira: ${brojevi[i]}`,
      );
      assert.ok(
        brojevi[i + 1] > -40 && brojevi[i + 1] < OKVIR.visina + 40,
        `y izvan okvira: ${brojevi[i + 1]}`,
      );
    }
  }
});

test("skretanje je stvarno, ali ne divlje", () => {
  const plitko = izvediStrujnice(
    sastaviPolje({ smjerOd: 112.5, brzina: 1.2, dubina: 80 }),
    112.5,
  ).skretanje;
  assert.ok(plitko.medijan >= 1 && plitko.medijan < 25, `medijan ${plitko.medijan}°`);
  assert.ok(plitko.najvece > plitko.medijan);
  assert.ok(plitko.najvece < 90, "skretanje preko 90° znači da polje ide natrag");

  const duboko = izvediStrujnice(
    sastaviPolje({ smjerOd: 112.5, brzina: 1.2, dubina: 600 }),
    112.5,
  ).skretanje;
  assert.ok(
    duboko.medijan <= plitko.medijan,
    "u dubokom sloju teren ne stigne skrenuti struju",
  );
});

test("i pri tišini se dobiju putanje, po smjeru koji bi vjetar imao", () => {
  const polje = sastaviPolje({ smjerOd: 112.5, brzina: 0, dubina: 80 });
  const { putanje, skretanje } = izvediStrujnice(polje, 112.5);
  assert.ok(putanje.length > 10, "prazna kartica nije opcija");
  assert.equal(skretanje.medijan, 0, "bez polja nema ni skretanja");
});
