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
 * Za svaki način brojanja (INACICE u pravila.ts): „po odredbama” ima
 * okućnicu, „sve s gradnjom” broji cijeli komad sa zgradom, „samo tlocrt”
 * nema ni jedno ni drugo. Što god je iskorišteno a nema položaja, ovdje je
 * „okućnica” (okucnicaPx).
 *
 * Izlaz: .cache/gup-grad/regije-<način>-<godina>.json
 *   { dopusteno: { <kod>: [vrsta…] }, klase: { <indeks>: <kod> },
 *     komadi: [[cestica, klasa, okucnicaPx, okucnicaProtivnoUdio, zastavice], …] }
 *   zastavice: 1 zabranjeno, 2 neizgradivo, 4 premalo (skupina ispod Ppmin),
 *              8 cijeli komad je ulica, 16 slobodno čeka propisani plan užeg
 *              područja (rezim.ts)
 *
 * Pokretanje:  npx tsx scripts/gup-grad/regije.ts   (poslije cestice.py)
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { pokrivenost, procijeniGodinu, sirokoKomada, slobodnoKomada } from "../../src/lib/gup-grad/izracun";
import { GODINE, KLASA_PO_INDEKSU, KLASE } from "../../src/lib/gup-grad/model";
import { ucitajMjerenja, ucitajOdredbe, ulazGodine } from "../../src/lib/gup-grad/podaci";
import { INACICE } from "../../src/lib/gup-grad/pravila";

async function main() {
  const [d, o] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const mapa = path.join(process.cwd(), ".cache", "gup-grad");
  mkdirSync(mapa, { recursive: true });
  for (const { id, pravila: p } of INACICE) {
    for (const g of GODINE) {
      const u = ulazGodine(d, g, p, o);
      const { procjene, ostaci } = procijeniGodinu(u, p);
      const komadi: number[][] = [];
      u.komadi.forEach((k, i) => {
        const r = procjene[i];
        const kl = KLASA_PO_INDEKSU.get(k.klasa);
        if (!r || !kl || k.cestica === undefined) return;
        // iskorišteno bez položaja: okućnica („po odredbama”) ili ostatak
        // komada koji se broji cijeli („sve s gradnjom”)
        const pokriveno = pokrivenost(k, p, r.ulica).reduce((a, [, v]) => a + v, 0);
        const bezPolozaja = Math.max(0, r.iskoristeno - pokriveno);
        const protivno = r.okucnicaProtivno !== undefined && (r.poVrsti.okucnica ?? 0) > 0
          ? r.okucnicaProtivno / r.poVrsti.okucnica!
          : r.iskoristeno > 0 ? r.uSuprotnosti / r.iskoristeno : 0;
        const usko = slobodnoKomada(r) - sirokoKomada(k, r, p);
        const premalo = (ostaci.get(i) ?? 0) - usko > 0.5;
        const zastavice =
          (r.zabranjeno > 0 ? 1 : 0) | (r.neizgradivo > 0 ? 2 : 0) | (premalo ? 4 : 0) | (r.n <= 0 && r.ulica > 0 ? 8 : 0) | ((r.cekaPlan ?? 0) > 0 ? 16 : 0);
        komadi.push([k.cestica, k.klasa, Math.round(bezPolozaja), Math.round(protivno * 100) / 100, zastavice]);
      });
      const put = path.join(mapa, `regije-${id}-${g}.json`);
      writeFileSync(
        put,
        JSON.stringify({
          dopusteno: p.dopusteno,
          klase: Object.fromEntries(KLASE.map((k) => [k.indeks, k.kod])),
          komadi,
        }),
      );
      console.log(id, g, komadi.length, "komada →", put);
    }
  }
}

void main();
