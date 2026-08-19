import assert from "node:assert/strict";
import test from "node:test";

import { OSNOVE_DIMA } from "@/generated/karepovac-polje";
import { razineDubine, sastaviPolje } from "@/lib/polje-dima";

/** Raspakirava polje natrag u m/s, kako ga čita simulacija. */
function ocitaj(polje: ReturnType<typeof sastaviPolje>): {
  vx: Float64Array;
  vy: Float64Array;
} {
  const bx = new Uint8Array(Buffer.from(polje.vx, "base64"));
  const by = new Uint8Array(Buffer.from(polje.vy, "base64"));
  const vx = new Float64Array(bx.length);
  const vy = new Float64Array(by.length);
  for (let i = 0; i < bx.length; i += 1) {
    vx[i] = (bx[i] / 255) * 2 * polje.skala - polje.skala;
    vy[i] = (by[i] / 255) * 2 * polje.skala - polje.skala;
  }
  return { vx, vy };
}

function sredina(a: Float64Array): number {
  let z = 0;
  for (let i = 0; i < a.length; i += 1) z += a[i];
  return z / a.length;
}

test("razine dubine drže rubove i idu po logaritmu", () => {
  const razine = [25, 55, 120];
  assert.deepEqual(razineDubine(razine, 10), [0, 0, 0], "ispod najplićeg");
  assert.deepEqual(razineDubine(razine, 900), [2, 2, 0], "iznad najdubljeg");
  assert.deepEqual(razineDubine(razine, 25), [0, 0, 0], "točno na razini");

  const [a, b, udio] = razineDubine(razine, Math.sqrt(25 * 55));
  assert.equal(a, 0);
  assert.equal(b, 1);
  assert.ok(
    Math.abs(udio - 0.5) < 1e-9,
    `geometrijska sredina mora pasti na pola, a pala je na ${udio}`,
  );
});

test("smjer vjetra okreće polje", () => {
  // Meteorološki smjer je onaj IZ kojega puše, pa vjetar iz istoka nosi na
  // zapad — u okviru ulijevo, dakle vx mora biti negativan.
  const izIstoka = ocitaj(sastaviPolje({ smjerOd: 90, brzina: 2, dubina: 120 }));
  assert.ok(sredina(izIstoka.vx) < -1, `nosi udesno (${sredina(izIstoka.vx)})`);
  assert.ok(Math.abs(sredina(izIstoka.vy)) < 0.4, "ne bi smjelo nositi po visini");

  // Sjevernjak nosi prema jugu; y u okviru raste prema jugu.
  const izSjevera = ocitaj(sastaviPolje({ smjerOd: 0, brzina: 2, dubina: 120 }));
  assert.ok(sredina(izSjevera.vy) > 1, `nosi prema gore (${sredina(izSjevera.vy)})`);
});

test("azimut polja prati smjer nošenja", () => {
  for (const smjerOd of [0, 45, 112.5, 200, 300]) {
    const polje = sastaviPolje({ smjerOd, brzina: 1.5, dubina: 260 });
    const ocekivano = (smjerOd + 180) % 360;
    const razlika = Math.abs(((polje.azimut - ocekivano + 540) % 360) - 180);
    assert.ok(
      razlika < 15,
      `iz ${smjerOd}° polje nosi na ${polje.azimut}°, a treba oko ${ocekivano}°`,
    );
  }
});

test("brzina skalira polje, a tišina ga ugasi", () => {
  const slabo = sastaviPolje({ smjerOd: 112.5, brzina: 1, dubina: 120 });
  const jako = sastaviPolje({ smjerOd: 112.5, brzina: 4, dubina: 120 });
  assert.ok(
    Math.abs(jako.najveca / slabo.najveca - 4) < 0.01,
    `četiri puta jači vjetar mora dati četiri puta brže polje (${jako.najveca / slabo.najveca})`,
  );

  const tisina = sastaviPolje({ smjerOd: 112.5, brzina: 0, dubina: 120 });
  assert.equal(tisina.najveca, 0, "bez vjetra polje ne smije nositi");
  const { vx, vy } = ocitaj(tisina);
  for (let i = 0; i < vx.length; i += 1) {
    assert.ok(Math.abs(vx[i]) < 1e-5 && Math.abs(vy[i]) < 1e-5, `ćelija ${i} nosi`);
  }
});

test("plići sloj skreće struju jače nego duboki", () => {
  const os = (dubina: number) => {
    const { vx, vy } = ocitaj(sastaviPolje({ smjerOd: 270, brzina: 2, dubina }));
    // Vjetar sa zapada nosi točno na istok; svaki vy je skretanje s te osi.
    let skret = 0;
    for (let i = 0; i < vx.length; i += 1) skret += Math.abs(Math.atan2(vy[i], vx[i]));
    return (skret / vx.length) * (180 / Math.PI);
  };

  const plitko = os(120);
  const duboko = os(600);
  assert.ok(plitko > duboko * 2, `sloj od 120 m (${plitko.toFixed(1)}°) mora skretati `
    + `osjetno više od onog od 600 m (${duboko.toFixed(1)}°)`);
  assert.ok(plitko < 30, "skretanje preko 30° u prosjeku znači da je polje puklo");
});

test("osnove pokrivaju i noćni i dnevni sloj", () => {
  assert.ok(OSNOVE_DIMA.dubine[0] <= 25, "noćni sloj zna pasti na desetke metara");
  assert.ok(
    OSNOVE_DIMA.dubine[OSNOVE_DIMA.dubine.length - 1] >= 500,
    "razvijeni dnevni sloj ide preko pola kilometra",
  );
  assert.equal(
    OSNOVE_DIMA.osnove.length,
    OSNOVE_DIMA.dubine.length,
    "svaka razina mora imati svoju osnovu",
  );
});
