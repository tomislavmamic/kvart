import assert from "node:assert/strict";
import test from "node:test";

import {
  DULJINA_TRAGA_M,
  TRAG_TOCAKA,
  UBRZANJE,
  stvoriRoj,
} from "@/lib/sim/tragovi-vjetra";

const GW = 8;
const GH = 8;
const SIRINA_M = 6400;
const VISINA_M = 6400;

/** Polje jednolikog vjetra: `vx` prema istoku, `vy` prema jugu, u m/s. */
function jednoliko(vx: number, vy: number) {
  return {
    vx: new Float32Array(GW * GH).fill(vx),
    vy: new Float32Array(GW * GH).fill(vy),
  };
}

function roj(vx: number, vy: number, broj = 200) {
  const r = stvoriRoj(SIRINA_M, VISINA_M, 1000);
  r.postaviBroj(broj);
  const { vx: fx, vy: fy } = jednoliko(vx, vy);
  r.postaviPolje(fx, fy, GW, GH);
  return r;
}

/** Točke jednog repa, od najstarije prema najnovijoj. */
function rep(r: ReturnType<typeof roj>, n: number): [number, number][] {
  const baza = n * TRAG_TOCAKA * 2;
  const g = r.glava[n];
  const tocke: [number, number][] = [];
  for (let k = 0; k < TRAG_TOCAKA; k += 1) {
    const i = baza + ((g + 1 + k) % TRAG_TOCAKA) * 2;
    tocke.push([r.trag[i], r.trag[i + 1]]);
  }
  return tocke;
}

test("čestica se rodi s cijelim repom, ne s praznim", () => {
  const r = roj(3, 0);
  const t = rep(r, 0);
  assert.equal(t.length, TRAG_TOCAKA);
  // Rep je put kojim je zrak došao: pri vjetru s zapada sve su starije točke
  // zapadnije od glave, i to redom.
  for (let k = 1; k < t.length; k += 1) {
    assert.ok(t[k][0] > t[k - 1][0], `točka ${k} mora biti istočnije od prethodne`);
  }
  assert.ok(
    Math.abs(t[t.length - 1][1] - t[0][1]) < 1e-6,
    "bez vjetra prema jugu rep ne smije skretati",
  );
});

test("rep pokriva isti put i pri jakom i pri slabom vjetru", () => {
  // Ovo je jedina namjerna razlika prema uzorima: rep se mjeri putem, ne
  // vremenom, jer bi pri gradskom vjetru od 0,5 m/s vremenom zadan rep spao na
  // nekoliko piksela — i to baš pri tišini, kad se nad kvartom nakuplja.
  for (const brzina of [0.5, 4, 12]) {
    const t = rep(roj(brzina, 0), 0);
    const prijedeno = (t[t.length - 1][0] - t[0][0]) * SIRINA_M;
    assert.ok(
      Math.abs(prijedeno - DULJINA_TRAGA_M) < 1,
      `pri ${brzina} m/s rep pokriva ${prijedeno.toFixed(1)} m, a treba ${DULJINA_TRAGA_M}`,
    );
  }
});

test("čestica putuje brzinom vjetra, ubrzanom za prikaz", () => {
  // Duljina repa je normirana, brzina nije: koliko treperaja treba da rep
  // otputuje svoju duljinu, toliko ondje puše.
  for (const brzina of [1, 5]) {
    const r = roj(brzina, 0);
    const prije: number[] = [];
    for (let n = 0; n < r.broj; n += 1) prije.push(rep(r, n).at(-1)![0]);
    r.korak(0.1);
    const pomaci: number[] = [];
    for (let n = 0; n < r.broj; n += 1) {
      pomaci.push((rep(r, n).at(-1)![0] - prije[n]) * SIRINA_M);
    }
    // Sredina, ne prosjek: onih nekoliko čestica kojima je u ovoj desetinki
    // istekao vijek nikne drugdje, pa im pomak nije pomak.
    pomaci.sort((a, b) => a - b);
    const sredina = pomaci[pomaci.length >> 1];
    assert.ok(
      Math.abs(sredina - brzina * UBRZANJE * 0.1) < 1,
      `pri ${brzina} m/s u desetinki prikaza prešla je ${sredina.toFixed(1)} m`,
    );
  }
});

test("vjetar prema jugu vodi rep prema jugu", () => {
  const r = roj(0, 3);
  const t = rep(r, 0);
  // `v` raste prema jugu; glava mora biti južnija od repa.
  assert.ok(t[t.length - 1][1] > t[0][1]);
});

test("roj se ne isprazni ni nakon što ga vjetar odnese preko okvira", () => {
  // Pri 8 m/s i šezdesetorostrukom ubrzanju zrak prijeđe 6,4 km u trinaest
  // sekundi prikaza; bez ponovne sjetve karta bi tada bila prazna.
  const r = roj(8, 0, 400);
  for (let i = 0; i < 1500; i += 1) r.korak(1 / 60);
  let uOkviru = 0;
  for (let n = 0; n < r.broj; n += 1) {
    const [u, v] = rep(r, n).at(-1)!;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) uOkviru += 1;
  }
  assert.ok(uOkviru > r.broj * 0.7, `u okviru je ostalo ${uOkviru} od ${r.broj}`);
});

test("čestice se ne skupe u jedan kut", () => {
  const r = roj(2, 1.5, 400);
  for (let i = 0; i < 600; i += 1) r.korak(1 / 60);
  const kvadranti = [0, 0, 0, 0];
  for (let n = 0; n < r.broj; n += 1) {
    const [u, v] = rep(r, n).at(-1)!;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    kvadranti[(v < 0.5 ? 0 : 2) + (u < 0.5 ? 0 : 1)] += 1;
  }
  for (const [i, k] of kvadranti.entries()) {
    assert.ok(k > r.broj * 0.1, `kvadrant ${i} ima samo ${k} čestica`);
  }
});

test("i najslabiji vjetar pomiče česticu, a ne samo njezine uzorke", () => {
  // Uzorci repa se zapisuju svakih trinaest metara; kad bi položaj čestice
  // živio samo u njima, pri 0,2 m/s se ne bi micala ništa dok se korak ne
  // navrši, pa bi cijela karta poskakivala umjesto da teče.
  const r = roj(0.2, 0);
  const prije = rep(r, 0).at(-1)![0];
  r.korak(1 / 60);
  const prijedeno = (rep(r, 0).at(-1)![0] - prije) * SIRINA_M;
  assert.ok(prijedeno > 0.1, `u jednom koraku prešla je ${prijedeno.toFixed(3)} m`);
});

test("prozirnost se pali i gasi, pa nitko ne iskrsne ni ne nestane naglo", () => {
  const r = roj(1, 0, 50);
  for (let n = 0; n < r.broj; n += 1) {
    const z = r.zivot(n);
    assert.ok(z >= 0 && z <= 1, "prozirnost mora biti između nule i jedinice");
  }
  // Novorođena je čestica nevidljiva i tek se pali.
  const s = stvoriRoj(SIRINA_M, VISINA_M, 10);
  s.postaviBroj(1);
  const { vx, vy } = jednoliko(1, 0);
  s.postaviPolje(vx, vy, GW, GH);
  let najveca = 0;
  for (let i = 0; i < 2000; i += 1) {
    s.korak(1 / 60);
    najveca = Math.max(najveca, s.zivot(0));
  }
  assert.ok(najveca > 0.9, "čestica se mora do kraja upaliti");
});

test("tišina ne pomiče ništa, ali roj ostaje složen", () => {
  const r = roj(0, 0, 100);
  const prije = rep(r, 0).at(-1)!;
  r.korak(0.5);
  const poslije = rep(r, 0).at(-1)!;
  assert.ok(Math.abs(poslije[0] - prije[0]) < 1e-9);
  assert.ok(Math.abs(poslije[1] - prije[1]) < 1e-9);
});

test("duga stanka ne trzne roj naprijed za cijelo njezino trajanje", () => {
  const r = roj(3, 0, 20);
  const prije = rep(r, 0).at(-1)![0];
  // Kartica u pozadini pa povratak: `dt` naraste na desetke sekundi.
  r.korak(30);
  const skok = (rep(r, 0).at(-1)![0] - prije) * SIRINA_M;
  assert.ok(skok < 3 * UBRZANJE * 0.5, `roj je skočio ${skok.toFixed(0)} m`);
});

test("bez polja se ne miče ništa i ne puca", () => {
  const r = stvoriRoj(SIRINA_M, VISINA_M, 10);
  r.postaviBroj(5);
  r.korak(1);
  assert.equal(r.broj, 5);
});

test("novi sat pri mirovanju presloži roj, jer se sam neće razići", () => {
  const r = stvoriRoj(SIRINA_M, VISINA_M, 100);
  r.postaviBroj(60);
  const zapad = jednoliko(3, 0);
  r.postaviPolje(zapad.vx, zapad.vy, GW, GH);
  const prije = rep(r, 0);

  // Bez sjetve novi sat ne dira zatečene repove: dok se roj miče, oni ionako
  // otputuju za koji trenutak.
  const jug = jednoliko(0, 3);
  r.postaviPolje(jug.vx, jug.vy, GW, GH);
  assert.deepEqual(rep(r, 0), prije, "bez zahtjeva se roj ne dira");

  // Sa sjetvom repovi odmah prate novo polje.
  r.postaviPolje(jug.vx, jug.vy, GW, GH, true);
  const t = rep(r, 0);
  assert.ok(
    Math.abs(t[t.length - 1][0] - t[0][0]) < 1e-6,
    "pri vjetru prema jugu rep više ne smije ležati po istoku",
  );
  assert.ok(t[t.length - 1][1] > t[0][1], "rep mora voditi prema jugu");
});
