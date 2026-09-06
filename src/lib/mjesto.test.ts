import assert from "node:assert/strict";
import test from "node:test";

import { OKVIR_DOJAVE, OPIS_OKVIRA, procitajMjesto, uOkviru, zaokruziMjesto } from "./mjesto";

/** Metri po stupnju na širini kvarta; za provjeru koliko zaokruživanje briše. */
const M_PO_LAT = 111_130;
const M_PO_LNG = 111_320 * Math.cos((43.52 * Math.PI) / 180);

test("zaokruživanje briše kuću, a čuva ono što model može vidjeti", () => {
  const tocno = { lat: 43.521449, lng: 16.511544 };
  const grubo = zaokruziMjesto(tocno);
  const pomakM = Math.hypot(
    (grubo.lat - tocno.lat) * M_PO_LAT,
    (grubo.lng - tocno.lng) * M_PO_LNG,
  );
  assert.ok(pomakM < 80, `pomak je ${pomakM.toFixed(0)} m`);

  // Zrno mreže mora biti oko sto metara: dovoljno grubo da nije adresa,
  // dovoljno fino da model iz njega još nešto pročita.
  const zrnoLat = 0.001 * M_PO_LAT;
  const zrnoLng = 0.001 * M_PO_LNG;
  assert.ok(zrnoLat > 60 && zrnoLat < 160, `zrno po širini ${zrnoLat.toFixed(0)} m`);
  assert.ok(zrnoLng > 60 && zrnoLng < 160, `zrno po dužini ${zrnoLng.toFixed(0)} m`);
});

test("dvije susjedne kuće daju isto zaokruženo mjesto", () => {
  const a = zaokruziMjesto({ lat: 43.52141, lng: 16.51151 });
  const b = zaokruziMjesto({ lat: 43.52149, lng: 16.51159 });
  assert.deepEqual(a, b, "unutar zrna mreže dojave se ne razlikuju");
});

test("dojava izvan kvarta ne ulazi", () => {
  assert.ok(uOkviru({ lat: 43.52, lng: 16.51 }), "Dračevac je unutra");
  assert.equal(uOkviru({ lat: 45.81, lng: 15.98 }), false, "Zagreb nije");
  assert.equal(uOkviru({ lat: Number.NaN, lng: 16.5 }), false);
  assert.equal(uOkviru({ lat: OKVIR_DOJAVE.sjever + 0.01, lng: 16.5 }), false);
});

test("obrazac bez mjesta ne pada, a mjesto s greškom se odbacuje", () => {
  assert.equal(procitajMjesto(null, null), null);
  assert.equal(procitajMjesto("", ""), null);
  assert.equal(procitajMjesto("nije broj", "16.5"), null);
  assert.equal(procitajMjesto("45.81", "15.98"), null, "izvan okvira");
  assert.deepEqual(procitajMjesto("43.521449", "16.511544"), {
    lat: 43.521,
    lng: 16.512,
  });
});

test("opis okvira govori ono što okvir radi: Kaštela i Stobreč su unutra, Omiš nije", () => {
  assert.match(OPIS_OKVIRA, /Kaštel/);
  assert.match(OPIS_OKVIRA, /Stobreč/);
  assert.ok(uOkviru({ lat: 43.55, lng: 16.38 }), "Kaštel Sućurac");
  assert.ok(uOkviru({ lat: 43.503, lng: 16.526 }), "Stobreč");
  assert.ok(uOkviru({ lat: 43.54, lng: 16.49 }), "Solin");
  assert.equal(uOkviru({ lat: 43.44, lng: 16.69 }), false, "Omiš je izvan");
});
