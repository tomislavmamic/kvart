/**
 * Čestice sa slobodnim zemljištem za novu zgradu koje bi po prijedlogu GUP-a
 * 2025. čekalo UPU (cesticeZabrane u src/lib/gup-grad/zabrana-podaci.ts).
 * Ulaz za scripts/gup-grad/zabrana.py, koji im dodaje oblik i UPU.
 *
 * Izlaz: data/gup-grad/zabrana-cestice.json — cestice: [čestica, m²,
 * neizgrađena (0/1), zona]; sve: [čestica, izgrađena (0/1), javna (0/1)] za
 * svaku česticu koju dotiče zona za gradnju pod zabranom (javna: većinom
 * ulica, parkiralište, trg ili park). Čestica je indeks u
 * data/gup-grad/cestice.json.
 *
 * Pokretanje:  npx tsx scripts/gup-grad/zabrana-cestice.ts
 */
import { writeFileSync } from "fs";
import path from "path";

import { ucitajMjerenja, ucitajOdredbe } from "../../src/lib/gup-grad/podaci";
import { izracunZabrane } from "../../src/lib/gup-grad/zabrana-podaci";

async function main() {
  const [d, o] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const { slobodne, sve } = izracunZabrane(d, o);
  const c = slobodne.sort((a, b) => a.cestica - b.cestica);
  const put = path.join(process.cwd(), "data", "gup-grad", "zabrana-cestice.json");
  writeFileSync(
    put,
    JSON.stringify({
      opis: "Izvedeno skriptom scripts/gup-grad/zabrana-cestice.ts: slobodno zemljište za novu zgradu koje bi po prijedlogu GUP-a 2025. čekalo UPU, po čestici.",
      polja: ["cestica", "m2", "neizgradjena", "zona"],
      cestice: c.map((x) => [x.cestica, Math.round(x.m2), x.neizgradjena ? 1 : 0, x.zona]),
      polja_sve: ["cestica", "izgradjena", "javna"],
      sve: sve.map((x) => [x.cestica, x.izgradjena ? 1 : 0, x.javna ? 1 : 0]),
    }),
  );
  const ha = (v: number) => Math.round(v / 1e3) / 10;
  const n = c.filter((x) => x.neizgradjena);
  console.log(
    `${sve.length} čestica u zoni pod zabranom, ${sve.filter((x) => !x.izgradjena).length} neizgrađenih, ${sve.filter((x) => x.javna).length} javnih`,
  );
  console.log(`${c.length} čestica, ${ha(c.reduce((s, x) => s + x.m2, 0))} ha; neizgrađenih ${n.length}, ${ha(n.reduce((s, x) => s + x.m2, 0))} ha → ${path.relative(process.cwd(), put)}`);
}

main();
