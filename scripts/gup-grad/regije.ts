/**
 * Ulaz za scripts/gup-grad/regije.py: koliko je čega u svakom komadu čestice
 * po zadanim pravilima (izracun.ts), da se na rešetki od 2 m može
 * naslikati GDJE je unutar čestice zauzeto, a gdje slobodno.
 *
 * Većina toga već ima položaj (zgrade, ulice, parkirališta… u maskama iz
 * cestice.py). Izračun bez položaja zna samo koliko: okućnicu (zemljište
 * koje zgrada treba po kig/kis/Ppmin, i ono posuđeno od susjedne čestice) i
 * razlog zbog kojeg slobodno nije za gradnju. To je ovdje, po komadu.
 *
 * Izlaz: .cache/gup-grad/regije-<godina>.json
 *   { dopusteno: { <kod>: [vrsta…] }, klase: { <indeks>: <kod> },
 *     komadi: [[cestica, klasa, okucnicaPx, okucnicaProtivnoUdio, zastavice], …] }
 *   zastavice: 1 zabranjeno, 2 neizgradivo, 4 premalo (skupina ispod Ppmin),
 *              8 cijeli komad je ulica
 *
 * Pokretanje:  npx tsx scripts/gup-grad/regije.ts   (poslije cestice.py)
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { procijeniGodinu, sirokoKomada, slobodnoKomada } from "../../src/lib/gup-grad/izracun";
import { GODINE, KLASE } from "../../src/lib/gup-grad/model";
import { ucitajMjerenja, ucitajOdredbe, ulazGodine } from "../../src/lib/gup-grad/podaci";
import { ZADANA_PRAVILA } from "../../src/lib/gup-grad/pravila";

async function main() {
  const [d, o] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const p = ZADANA_PRAVILA;
  const mapa = path.join(process.cwd(), ".cache", "gup-grad");
  mkdirSync(mapa, { recursive: true });
  for (const g of GODINE) {
    const u = ulazGodine(d, g, p, o);
    const { procjene, ostaci } = procijeniGodinu(u, p);
    const komadi: number[][] = [];
    u.komadi.forEach((k, i) => {
      const r = procjene[i];
      if (!r || k.cestica === undefined) return;
      const okucnica = r.poVrsti.okucnica ?? 0;
      const usko = slobodnoKomada(r) - sirokoKomada(k, r, p);
      const premalo = (ostaci.get(i) ?? 0) - usko > 0.5;
      const zastavice =
        (r.zabranjeno > 0 ? 1 : 0) | (r.neizgradivo > 0 ? 2 : 0) | (premalo ? 4 : 0) | (r.n <= 0 && r.ulica > 0 ? 8 : 0);
      komadi.push([
        k.cestica,
        k.klasa,
        Math.round(okucnica),
        okucnica > 0 ? Math.round(((r.okucnicaProtivno ?? 0) / okucnica) * 100) / 100 : 0,
        zastavice,
      ]);
    });
    const put = path.join(mapa, `regije-${g}.json`);
    writeFileSync(
      put,
      JSON.stringify({
        dopusteno: p.dopusteno,
        klase: Object.fromEntries(KLASE.map((k) => [k.indeks, k.kod])),
        komadi,
      }),
    );
    console.log(g, komadi.length, "komada →", put);
  }
}

void main();
