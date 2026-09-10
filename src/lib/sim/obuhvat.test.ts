import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { najveciPutCestice, stvoriDimSirovo, type SirovoPolje } from "@/lib/dim";
import { stvoriOs, prosiriGranice, udioLokalnogPolja } from "./obuhvat";
import { razloziOsnove, slozi } from "./polje";
import { obuhvatZaSatove, POSTAVKE_SIMULATORA } from "./simulacija";
import { stvoriRoj, TRAG_TOCAKA } from "./tragovi-vjetra";

test("rastegnuta rešetka čuva 200 lokalnih ćelija i ima točan inverz", () => {
  for (const mjerilo of [3, 20, 400, 1000]) {
    const os = stvoriOs(mjerilo);
    assert.ok(Math.abs(os.polozaj(0) - (1 - mjerilo) / 2) < 1e-8);
    assert.ok(Math.abs(os.polozaj(1) - (1 + mjerilo) / 2) < 1e-8);
    for (let indeks = 0; indeks <= 512; indeks += 1) {
      assert.ok(Math.abs(os.tekstura(os.polozaj(indeks / 512)) - indeks / 512) < 1e-12);
    }
    for (let indeks = 156; indeks < 356; indeks += 1) {
      assert.ok(Math.abs(os.tezine[indeks] - 1) < 1e-10);
    }
    assert.ok(os.tezine[0] < os.tezine[155]);
  }
});

test("granice se šire oko istog središta, lokalni vjetar se glatko spaja s pozadinom", () => {
  assert.deepEqual(prosiriGranice({ zapad: 1, istok: 3, jug: 4, sjever: 6 }, 3), { zapad: -1, istok: 5, jug: 2, sjever: 8 });
  assert.equal(udioLokalnogPolja(0, 1), 1);
  assert.equal(udioLokalnogPolja(-0.125, 0.5), 0.5);
  assert.equal(udioLokalnogPolja(0.5, 1.25), 0);
  assert.equal(udioLokalnogPolja(-10, 20), 0);
});

test("udaljeni tragovi koriste pozadinski vjetar i osvježavaju ga pri promjeni sata", () => {
  const roj = stvoriRoj(6400, 6400, 20, { od: [-10, -10], do: [-9, -9] });
  roj.postaviBroj(20);
  const lokalniX = new Float32Array(4).fill(10);
  const lokalniY = new Float32Array(4);
  for (const smjer of [-5, 5]) {
    roj.postaviPolje(lokalniX, lokalniY, 2, 2, true, [0, smjer]);
    for (let indeks = 0; indeks < roj.broj; indeks += 1) {
      const pocetak = indeks * TRAG_TOCAKA * 2;
      const glava = pocetak + roj.glava[indeks] * 2;
      const rep = pocetak + ((roj.glava[indeks] + 1) % TRAG_TOCAKA) * 2;
      assert.ok(Math.abs(roj.trag[glava] - roj.trag[rep]) < 1e-6);
      assert.ok((roj.trag[glava + 1] - roj.trag[rep + 1]) * smjer > 0);
    }
  }
});

function jednoliko(brzina: number): SirovoPolje {
  const maska = new Uint8Array(256);
  maska[8 * 16 + 8] = 255;
  return { gw: 16, gh: 16, skala: brzina, vx: new Uint8Array(256).fill(255), vy: new Uint8Array(256).fill(128), maska, pozadina: [brzina, 0] };
}

test("čestice i obje gustoće nastavljaju iza starog ruba", () => {
  const postavke = { metaraX: 6400, metaraY: 6400, cestica: 1000, punjenje: 160, vrtlog: 0, difuzija: 0, zamucenje: 0 };
  const lokalni = stvoriDimSirovo(jednoliko(10), postavke);
  const prosireni = stvoriDimSirovo(jednoliko(10), { ...postavke, prosireniPrikaz: 40 });
  for (let korak = 0; korak < 320; korak += 1) {
    lokalni.korak(0.5);
    prosireni.korak(0.5);
  }
  assert.ok(prosireni.zivih() > lokalni.zivih() * 10);
  assert.equal(prosireni.sirina, 512);
  for (const tvar of ["sumporovodik", "merkaptani"] as const) {
    const gustoca = prosireni.crtaj(tvar);
    let izvan = 0;
    let rub = 0;
    for (let redak = 0; redak < 512; redak += 1) {
      for (let stupac = 0; stupac < 512; stupac += 1) {
        const vrijednost = gustoca[redak * 512 + stupac];
        assert.ok(Number.isFinite(vrijednost));
        if (stupac > 356) izvan += vrijednost;
        if (stupac < 4 || stupac > 507 || redak < 4 || redak > 507) rub += vrijednost;
      }
    }
    assert.ok(izvan > 0);
    assert.equal(rub, 0);
  }
});

test("lokalna gustoća i položaj izvora ostaju jednaki pri proširenju", () => {
  const postavke = { metaraX: 6400, metaraY: 6400, cestica: 100, vrtlog: 0, difuzija: 0 };
  const lokalni = stvoriDimSirovo(jednoliko(0), postavke);
  const prosireni = stvoriDimSirovo(jednoliko(0), { ...postavke, prosireniPrikaz: 400 });
  for (let korak = 0; korak < 40; korak += 1) {
    lokalni.korak(0.5);
    prosireni.korak(0.5);
  }
  const prije = lokalni.crtaj();
  const poslije = prosireni.crtaj();
  for (let redak = 0; redak < 200; redak += 1) {
    for (let stupac = 0; stupac < 200; stupac += 1) {
      assert.ok(Math.abs(prije[redak * 200 + stupac] - poslije[(redak + 156) * 512 + stupac + 156]) < 1e-5);
    }
  }
});

test("obuhvat uzima najjači sat, lokalno ubrzanje, vijek, turbulenciju i difuziju", () => {
  const bajtovi = readFileSync("public/karepovac/sim-polje.bin");
  const osnove = razloziOsnove(bajtovi.buffer.slice(bajtovi.byteOffset, bajtovi.byteOffset + bajtovi.byteLength));
  const slab = { sat: "s0", stanje: { smjerOd: 270, brzina: 1, dubina: 120 } };
  const jak = { sat: "s1", stanje: { smjerOd: 90, brzina: 15, dubina: 25 } };
  const mirno = obuhvatZaSatove([slab], osnove);
  const oluja = obuhvatZaSatove([slab, jak], osnove);
  assert.ok(oluja > mirno);
  assert.equal(oluja, obuhvatZaSatove([jak, slab], osnove));
  assert.ok(oluja * 6400 * 0.455 > najveciPutCestice(15, 0.1, POSTAVKE_SIMULATORA) + 3200);
  const pozadina = slozi(jak.stanje, osnove).pozadina!;
  assert.ok(Math.abs(pozadina[0] + 15) < 1e-10 && Math.abs(pozadina[1]) < 1e-10);
  assert.throws(() => obuhvatZaSatove([{ ...slab, stanje: { ...slab.stanje, brzina: NaN } }], osnove), /Neispravan/);
});
