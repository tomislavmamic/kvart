import assert from "node:assert/strict";
import test from "node:test";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

import { adresaDojave, adresaDojaveZaSat, imeTocke, razinaUTocki, tockaIzAdrese, udaljenostM } from "./tocka";

const PLOHA = SIM_POLJE.izvor;

test("točka blizu naselja dobiva ime naselja, dalje smjer i udaljenost od plohe", () => {
  assert.equal(imeTocke({ lat: 43.5245, lng: 16.5013 }, PLOHA), "kod naselja Dračevac");
  const ime = imeTocke({ lat: 43.5215, lng: 16.54 }, PLOHA);
  assert.match(ime, /km istočno od plohe$/);
});

test("adresa dojave nosi mjesto zaokruženo na četiri decimale, i čita se natrag", () => {
  assert.equal(adresaDojave({ lat: 43.527789, lng: 16.50401 }), "/karepovac/dojava?lat=43.5278&lng=16.504");
  // Sat koji se gleda putuje s mjestom: dojava opisuje ono što je na karti.
  assert.equal(
    adresaDojave({ lat: 43.527789, lng: 16.50401 }, "2026-09-04T21:00:00.000Z"),
    "/karepovac/dojava?lat=43.5278&lng=16.504&sat=2026-09-04T21%3A00%3A00.000Z",
  );
  assert.equal(adresaDojaveZaSat("2026-09-04T21:00:00.000Z"), "/karepovac/dojava?sat=2026-09-04T21%3A00%3A00.000Z");
  assert.deepEqual(tockaIzAdrese("43.5278,16.504"), { lat: 43.5278, lng: 16.504 });
  assert.equal(tockaIzAdrese("x"), null);
});

test("razina u točki čita ćelije oko točke, a izvan okvira daje „nema”", () => {
  const sirina = 200;
  const visina = 200;
  const bajtovi = new Uint8Array(sirina * visina);
  // Jaka gustoća u ćeliji u kojoj leži Dračevac.
  const g = SIM_POLJE.granice;
  const t = { lat: 43.5245, lng: 16.5013 };
  const x = Math.floor(((t.lng - g.zapad) / (g.istok - g.zapad)) * sirina);
  const y = Math.floor(((g.sjever - t.lat) / (g.sjever - g.jug)) * visina);
  for (let dy = -6; dy <= 6; dy += 1) for (let dx = -6; dx <= 6; dx += 1) bajtovi[(y + dy) * sirina + x + dx] = 250;
  assert.equal(razinaUTocki({ bajtovi, sirina, visina }, g, "sumporovodik", 1, t), "jako");
  assert.equal(razinaUTocki({ bajtovi, sirina, visina }, g, "sumporovodik", 1, { lat: 43.51, lng: 16.53 }), "nema");
  assert.equal(razinaUTocki({ bajtovi, sirina, visina }, g, "sumporovodik", 1, { lat: 43.6, lng: 16.7 }), "nema");
  assert.ok(udaljenostM(t, PLOHA) > 500 && udaljenostM(t, PLOHA) < 1200);
});
