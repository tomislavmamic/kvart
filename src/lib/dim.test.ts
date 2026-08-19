import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OKVIR } from "@/generated/karepovac-karta";
import { POLJE_DIMA } from "@/generated/karepovac-polje";
import { ljestvicaBoja, stvoriDim } from "@/lib/dim";

/** Zagrijava simulaciju do ustaljenog stanja. */
function pusti(sim: ReturnType<typeof stvoriDim>, sekundi: number): void {
  const dt = 1 / 60;
  for (let s = 0; s < sekundi * 60; s += 1) sim.korak(dt);
}

test("polje vjetra nosi prema kvartu, ne od njega", () => {
  // Ploha je na istoku okvira, kvart na zapadu; perjanica mora ići ulijevo.
  const sim = stvoriDim(POLJE_DIMA, { cestica: 12_000 });
  pusti(sim, 20);
  const g = sim.crtaj();

  const lijevo = tezisteX(g, sim.sirina, sim.visina);
  assert.ok(
    lijevo < 0.55,
    `težište perjanice je na ${lijevo.toFixed(2)} širine — ne ide prema kvartu`,
  );
});

test("perjanica prijeđe kvart do zapadnog ruba", () => {
  const sim = stvoriDim(POLJE_DIMA, { cestica: 12_000 });
  pusti(sim, 30);
  const g = sim.crtaj();

  let doseg = sim.sirina;
  for (let i = 0; i < sim.sirina; i += 1) {
    let zbroj = 0;
    for (let j = 0; j < sim.visina; j += 1) zbroj += g[j * sim.sirina + i];
    if (zbroj / sim.visina > 0.02) {
      doseg = i;
      break;
    }
  }
  assert.ok(doseg < sim.sirina * 0.2, `perjanica staje na koloni ${doseg}`);
});

test("naleti se razlikuju — puls se nije izgladio", () => {
  const sim = stvoriDim(POLJE_DIMA, { cestica: 12_000 });
  pusti(sim, 20);

  const kol = Math.round(sim.sirina * 0.42);
  const uzorci: number[] = [];
  for (let s = 0; s < 900; s += 1) {
    sim.korak(1 / 60);
    if (s % 6 === 0) {
      const g = sim.crtaj();
      let zbroj = 0;
      for (let j = 0; j < sim.visina; j += 1) zbroj += g[j * sim.sirina + kol];
      uzorci.push(zbroj);
    }
  }
  const omjer = Math.max(...uzorci) / Math.max(Math.min(...uzorci), 1e-6);
  assert.ok(omjer > 2, `naleti se ne razlikuju dovoljno (${omjer.toFixed(1)}×)`);
});

test("žarišta stežu perjanicu — jednolik izvor daje mrlju", () => {
  const usko = stvoriDim(POLJE_DIMA, { cestica: 12_000, zarista: 1 });
  const siroko = stvoriDim(POLJE_DIMA, { cestica: 12_000, zarista: 40 });
  pusti(usko, 25);
  pusti(siroko, 25);

  assert.ok(
    pokrivenost(usko.crtaj()) < pokrivenost(siroko.crtaj()),
    "jedno žarište mora pokriti manje okvira nego četrdeset",
  );
});

test("gustoća ostaje ograničena — perjanica ne poplavi okvir", () => {
  const sim = stvoriDim(POLJE_DIMA, { cestica: 12_000 });
  pusti(sim, 60);
  const dio = pokrivenost(sim.crtaj());
  assert.ok(dio > 0.03, `perjanica je prazna (${(dio * 100).toFixed(1)} %)`);
  assert.ok(dio < 0.6, `perjanica je poplavila okvir (${(dio * 100).toFixed(1)} %)`);
});

test("simulacija je determinističa", () => {
  const a = stvoriDim(POLJE_DIMA, { cestica: 4_000 });
  const b = stvoriDim(POLJE_DIMA, { cestica: 4_000 });
  pusti(a, 8);
  pusti(b, 8);
  assert.deepEqual(Array.from(a.crtaj()), Array.from(b.crtaj()));
});

test("čestice se vraćaju u optjecaj, bez curenja", () => {
  const sim = stvoriDim(POLJE_DIMA, { cestica: 4_000 });
  pusti(sim, 60);
  const zivih = sim.zivih();
  assert.ok(zivih > 0, "nijedna čestica nije živa");
  assert.ok(zivih <= sim.cestica, "živih je više nego što ih uopće ima");
});

test("ljestvica boja ide od prozirnog do zasićenog", () => {
  const lut = ljestvicaBoja();
  assert.equal(lut[3], 0, "najniža razina mora biti prozirna");
  assert.ok(lut[255 * 4 + 3] > 200, "najviša razina mora biti gotovo neprozirna");
  // neprozirnost raste jednolično
  for (let i = 1; i < 256; i += 1) {
    assert.ok(
      lut[i * 4 + 3] >= lut[(i - 1) * 4 + 3] - 1,
      `neprozirnost pada na razini ${i}`,
    );
  }
});

function pokrivenost(g: Float32Array): number {
  let n = 0;
  for (let i = 0; i < g.length; i += 1) if (g[i] > 0.02) n += 1;
  return n / g.length;
}

function tezisteX(g: Float32Array, W: number, H: number): number {
  let zbroj = 0;
  let tezina = 0;
  for (let j = 0; j < H; j += 1) {
    for (let i = 0; i < W; i += 1) {
      const v = g[j * W + i];
      zbroj += v * i;
      tezina += v;
    }
  }
  return tezina > 0 ? zbroj / tezina / W : 0.5;
}

test("polje dima stoji u istom okviru kao ostale karte", () => {
  const okvirOmjer = OKVIR.sirina / OKVIR.visina;
  const poljeOmjer = POLJE_DIMA.gw / POLJE_DIMA.gh;
  assert.ok(
    Math.abs(okvirOmjer - poljeOmjer) < 0.03,
    `okvir ${okvirOmjer.toFixed(3)} ≠ polje ${poljeOmjer.toFixed(3)} — `
      + "perjanica bi bila razvučena preko karte",
  );
});

test("granice okvira se nisu razišle između skripti", () => {
  const procitaj = (put: string) => readFileSync(put, "utf8");
  const dijeljeno = procitaj("scripts/okvir.py");
  const kartica = procitaj("scripts/izvedi-karepovac-karticu.py");

  const brojke = (tekst: string, uzorak: RegExp) => {
    const pogodak = tekst.match(uzorak);
    assert.ok(pogodak, `ne nalazim granice u ${uzorak}`);
    return pogodak.slice(1, 5).map(Number);
  };

  assert.deepEqual(
    brojke(dijeljeno, /ZAPAD, JUG, ISTOK, SJEVER = ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)/),
    brojke(kartica, /^Z, J, I, S = ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)/m),
    "scripts/okvir.py i izvedi-karepovac-karticu.py moraju gledati isti kvart",
  );
});

test("čestica koja izađe iz polja nestane, a ne ostane zauvijek u kutu", () => {
  // Prije je čestica malo izvan ruba uzimala brzinu izvan niza, dobivala NaN
  // i time preskakala provjeru ruba — pa se skupljala u ćeliji (0, 0) i ondje
  // svijetlila kao da je ondje izvor. Vidjelo se tek kad perjanica ode drugamo.
  const sim = stvoriDim(POLJE_DIMA, { cestica: 8_000 });
  for (let i = 0; i < 400; i += 1) sim.korak(0.05);
  const g = sim.crtaj();

  let najvise = 0;
  for (let i = 0; i < g.length; i += 1) if (g[i] > najvise) najvise = g[i];
  const kut = Math.max(g[0], g[1], g[sim.sirina], g[sim.sirina + 1]);

  assert.ok(najvise > 0, "polje mora imati nešto u sebi");
  assert.ok(
    kut < najvise * 0.05,
    `kut (0, 0) drži ${kut.toFixed(4)}, a najviše u polju je ${najvise.toFixed(4)}`,
  );
});
