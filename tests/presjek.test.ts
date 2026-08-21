import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { VISINE } from "../src/generated/karepovac-karta";
import { PRESJEK } from "../src/generated/karepovac-presjek";

const TOCKE = PRESJEK.tocke;
const NA_PLOHI = TOCKE.filter((t) => t.ploha);

test("presjek ide nizbrdo, od plohe prema kućama", () => {
  // Ovo je jedina tvrdnja koju slika iznosi sama za sebe. Kad bi pravac ikad
  // ispao okrenut, slika bi tvrdila suprotno od onoga što svi ondje znaju.
  assert.ok(NA_PLOHI.length > 10, "ploha se ne vidi na presjeku");
  assert.equal(TOCKE[0].ploha, true, "presjek ne počinje na plohi");
  assert.ok(
    TOCKE[0].z - TOCKE[TOCKE.length - 1].z > 50,
    `pad je samo ${(TOCKE[0].z - TOCKE[TOCKE.length - 1].z).toFixed(0)} m`,
  );
});

test("visine na presjeku slažu se s onima na karti", () => {
  // Dvije brojke o istoj plohi na dva mjesta mogu se raziću; ova provjera je
  // to čemu služi.
  const [donja, gornja] = VISINE.tijelo;
  const najvisa = Math.max(...NA_PLOHI.map((t) => t.vrh));
  const najniza = Math.min(...NA_PLOHI.map((t) => t.dno));
  assert.ok(
    najniza >= donja - 15 && najvisa <= gornja + 15,
    `presjek daje ${najniza.toFixed(0)}–${najvisa.toFixed(0)} m, `
      + `karta ${donja}–${gornja} m`,
  );
});

test("mjesta stoje po redu i unutar presjeka", () => {
  const m = PRESJEK.mjesta.map((x) => x.m);
  assert.deepEqual(
    PRESJEK.mjesta.map((x) => x.ime),
    ["Karepovac", "Dračevac", "Bilice"],
  );
  assert.ok(m[0] < m[1] && m[1] < m[2], `redoslijed je ${m.join(", ")}`);
  assert.ok(m[2] <= PRESJEK.duljinaM, "zadnje mjesto je izvan presjeka");
});

test("poklopac je plići kad se namiriše — to je cijeli nalaz slike", () => {
  const { sviM, najgoriM, sati } = PRESJEK.poklopac;
  assert.ok(sati > 5_000, `izvedeno iz samo ${sati} sati`);
  assert.ok(
    najgoriM < sviM * 0.8,
    `u najgorim satima poklopac je ${najgoriM} m, u običnima ${sviM} m — `
      + "razlike nema, pa slika nema što reći",
  );
});

test("poklopac stoji iznad plohe, a ne ispod nje", () => {
  // Krenuo sam s pretpostavkom da ploha viri iznad poklopca i da se zato
  // miris drži nizine. Podatci to ne kažu: i u najgorim satima poklopac je
  // iznad vrha plohe. Slika govori o plitkosti kutije, ne o tome da izvor
  // strši iz nje — pa nek ova provjera padne ako to netko ikad okrene.
  const poklopac = PRESJEK.sidroM + PRESJEK.poklopac.najgoriM;
  const vrhPlohe = Math.max(...NA_PLOHI.map((t) => t.vrh));
  assert.ok(
    poklopac > vrhPlohe,
    `poklopac ${poklopac} m nije iznad vrha plohe ${vrhPlohe.toFixed(0)} m`,
  );
});

test("presjek se crta bez uvoza karte i bez klijentskog koda", () => {
  const izvor = readFileSync(
    "src/components/karepovac/presjek-padine.tsx",
    "utf8",
  );
  assert.doesNotMatch(izvor, /"use client"/, "slika je nepomična, ne treba JS");
  assert.match(izvor, /aria-label=/, "slika mora imati opis za čitač zaslona");
  // Razvlačenje okomitog mjerila mora biti napisano, jer bez toga slika laže
  // o nagibu padine.
  assert.match(izvor, /RAZVUCENO/);
});
