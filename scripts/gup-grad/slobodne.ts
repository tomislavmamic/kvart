/**
 * Slobodno zemljište po čestici u stambenim i mješovitim zonama (S, M/K5),
 * po zadanim pravilima — ulaz za ručni pregled ortofotom
 * (scripts/gup-grad/pregled.py). Za čestice iz rucno.json računa se kao da
 * ispravka nema, da se pregled može ponoviti.
 *
 * Izlaz: .cache/gup-grad/slobodne.json — [{ c, kod, pravilo, m2 }] za 2015.
 * i 2025. (veće od dvaju), silazno po površini; `pravilo` je područje
 * urbanog pravila (npr. 2.2 — naselja višestambenih zgrada).
 *
 * Pokretanje:  npx tsx scripts/gup-grad/slobodne.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { procijeniGodinu } from "../../src/lib/gup-grad/izracun";
import { KLASA_PO_INDEKSU, type Godina } from "../../src/lib/gup-grad/model";
import { kodPravila, ucitajMjerenja, ucitajOdredbe, ulazGodine } from "../../src/lib/gup-grad/podaci";
import { ZADANA_PRAVILA } from "../../src/lib/gup-grad/pravila";

const STAMBENE = new Set(["S", "M/K5"]);
const PRAVILA = { ...ZADANA_PRAVILA, racunaj: { ...ZADANA_PRAVILA.racunaj, rucniPregled: false } };

async function main() {
  const [d, o] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const slob = new Map<number, { kod: string; pravilo: string | null; m2: number }>();
  for (const g of [2015, 2025] as Godina[]) {
    const u = ulazGodine(d, g, PRAVILA, o);
    const { procjene, ostaci } = procijeniGodinu(u, PRAVILA);
    const po = new Map<number, { kod: string; pravilo: string | null; m2: number }>();
    u.komadi.forEach((k, i) => {
      const kod = KLASA_PO_INDEKSU.get(k.klasa)?.kod;
      const r = procjene[i];
      if (!kod || !STAMBENE.has(kod) || !r || k.cestica === undefined) return;
      const px = Math.max(0, r.n - r.iskoristeno - r.zabranjeno - r.neizgradivo - (ostaci.get(i) ?? 0));
      const x = po.get(k.cestica) ?? { kod, pravilo: kodPravila(d, g, k.cestica), m2: 0 };
      x.m2 += px * u.pikselM2;
      po.set(k.cestica, x);
    });
    for (const [c, x] of po) if (x.m2 > (slob.get(c)?.m2 ?? 0)) slob.set(c, x);
  }
  const out = [...slob.entries()]
    .filter(([, x]) => x.m2 >= 100)
    .map(([c, x]) => ({ c, kod: x.kod, pravilo: x.pravilo, m2: Math.round(x.m2) }))
    .sort((a, b) => b.m2 - a.m2);
  const put = path.join(process.cwd(), ".cache", "gup-grad", "slobodne.json");
  mkdirSync(path.dirname(put), { recursive: true });
  writeFileSync(put, JSON.stringify(out));
  console.log(`${out.length} čestica, ${(out.reduce((s, x) => s + x.m2, 0) / 1e4).toFixed(1)} ha slobodno → ${put}`);
}

void main();
