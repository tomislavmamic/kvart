import assert from "node:assert/strict";
import test from "node:test";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

import {
  cijenaFaze,
  IZVOR_PLOHE,
  obodPodrucja,
  opisPodrucja,
  PRIJEDLOZI_POSTAJA,
} from "./prijedlozi-postaja";

test("svi prijedlozi leže u okviru simulatora i imaju jedinstvene oznake", () => {
  const g = SIM_POLJE.granice;
  const ids = new Set<string>();
  for (const p of PRIJEDLOZI_POSTAJA) {
    // Zastavica mora odgovarati stvarnosti u oba smjera: neoznačena točka je
    // u polju, označena je izvan njega. Inače kartica tvrdi nešto što nije.
    const uPolju = p.lat > g.jug && p.lat < g.sjever && p.lon > g.zapad && p.lon < g.istok;
    assert.equal(uPolju, !p.izvanPolja, p.id);
    assert.ok(!ids.has(p.id), `dvostruki id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.cijena[0] <= p.cijena[1] && p.oprema.length > 0 && p.velicine.length > 0);
  }
});

test("faza A je jeftina i sadrži jarbol na plohi i H₂S u naselju", () => {
  const [od, do_] = cijenaFaze("A");
  assert.ok(od >= 3000 && do_ <= 12000, `${od}–${do_}`);
  const a = PRIJEDLOZI_POSTAJA.filter((p) => p.faza === "A").map((p) => p.id);
  assert.ok(a.includes("ploha-jarbol") && a.includes("dracevac-7b"));
});

test("ime i mjesto stoje uz stvarnu adresu, a ne uz stranu svijeta", () => {
  const po = new Map(PRIJEDLOZI_POSTAJA.map((p) => [p.id, p]));
  // Točka koju je vlasnik prepoznao kao Solin doista leži u Solinu, pa to
  // moraju reći i ime i mjesto — o tome ovisi tko postaju plaća.
  const solin = po.get("solin-rub");
  assert.ok(solin);
  assert.match(solin.naziv, /Solin/);
  assert.match(solin.mjesto, /Grad Solin/);
  assert.match(solin.uvjeti, /Grad Solin/);
  for (const p of PRIJEDLOZI_POSTAJA) {
    assert.ok(p.mjesto.length > 12, `${p.id} nema mjesto`);
    // Ime mjesta, ne opis smjera: „Rub Solina” i slično više ne prolazi.
    assert.ok(!/^Rub /.test(p.naziv), p.id);
  }
});

test("sjeveroistok i najčešća os više nisu prazni", () => {
  const ids = new Set(PRIJEDLOZI_POSTAJA.map((p) => p.id));
  // Popis se dosad vodio za izmjerenom pogreškom, a sva su opažanja bila sa
  // zapada; ove tri točke pokrivaju smjerove u kojima ništa nismo mjerili.
  for (const id of ["mravince", "kucine", "kampus"]) assert.ok(ids.has(id), id);
  const kampus = PRIJEDLOZI_POSTAJA.find((p) => p.id === "kampus");
  assert.ok(kampus?.izvanPolja, "kampus je izvan polja i to mora pisati");
});

test("područje obuhvaća predloženu točku i zatvara prsten", () => {
  const m = (lat: number) => [111320 * Math.cos((lat * Math.PI) / 180), 110540] as const;
  for (const p of PRIJEDLOZI_POSTAJA) {
    const prsten = obodPodrucja(p);
    assert.ok(prsten.length >= 10, p.id);
    assert.deepEqual(prsten[0], prsten[prsten.length - 1], `${p.id} nije zatvoren`);
    const [mx, my] = m(p.lat);
    if (p.podrucje.vrsta === "krug") {
      for (const [lon, lat] of prsten) {
        const d = Math.hypot((lon - p.lon) * mx, (lat - p.lat) * my);
        assert.ok(Math.abs(d - p.podrucje.polumjerM) < 1, `${p.id} ${d}`);
      }
      continue;
    }
    // Sidro mora ležati u vlastitom isječku, inače kartica i karta lažu.
    const dx = (p.lon - IZVOR_PLOHE.lon) * mx;
    const dy = (p.lat - IZVOR_PLOHE.lat) * my;
    const d = Math.hypot(dx, dy);
    const az = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    assert.ok(d >= p.podrucje.odM && d <= p.podrucje.doM, `${p.id} udaljenost ${Math.round(d)}`);
    assert.ok(az >= p.podrucje.odAz && az <= p.podrucje.doAz, `${p.id} azimut ${Math.round(az)}`);
  }
});

test("opis područja govori isto što karta crta", () => {
  for (const p of PRIJEDLOZI_POSTAJA) {
    const opis = opisPodrucja(p);
    if (p.podrucje.vrsta === "krug") {
      assert.match(opis, new RegExp(`${p.podrucje.polumjerM}`));
    } else {
      assert.match(opis, new RegExp(`${p.podrucje.odAz}–${p.podrucje.doAz}°`));
    }
  }
});
