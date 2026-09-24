/**
 * Prihvaćeni prijedlozi ispravka karte provjere GUP-a (tablica
 * `gup_ispravci`, moderacija na /admin/gup) → data/gup-grad/pregled/ispravci.json.
 *
 * cestice.py ih primjenjuje kao ručni pregled ortofotom, s prednošću pred
 * rucno.json (prijedlog je noviji i gleda česticu na licu mjesta). Za istu
 * česticu vrijedi najnoviji prihvaćeni. „Drugo” nema vrste koju izračun
 * razumije, pa se samo ispisuje — odluči i upiši ga ručno.
 *
 * Pokretanje:  npm run gup-grad:ispravci   (pa npm run gup-grad:cestice)
 */
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

import { gupIspravci } from "../../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const IZLAZ = path.join("data", "gup-grad", "pregled", "ispravci.json");

async function glavno() {
  const client = postgres(connectionString!, { prepare: false });
  try {
    const redovi = await drizzle(client)
      .select()
      .from(gupIspravci)
      .where(eq(gupIspravci.status, "prihvaceno"))
      .orderBy(asc(gupIspravci.createdAt));
    const po = new Map<string, (typeof redovi)[number]>();
    const drugo: typeof redovi = [];
    for (const r of redovi) {
      if (r.vrsta === "drugo") drugo.push(r);
      else po.set(`${r.ko}\t${r.kc}`, r); // noviji pregazi stariji
    }
    const cestice = [...po.values()].map((r) => ({
      ko: r.ko,
      kc: r.kc,
      vrsta: r.vrsta,
      napomena: r.napomena ?? "",
      prijedlog: r.id,
      datum: r.createdAt.toISOString().slice(0, 10),
    }));
    mkdirSync(path.dirname(IZLAZ), { recursive: true });
    writeFileSync(
      IZLAZ,
      JSON.stringify(
        {
          opis:
            "Prihvaćeni prijedlozi ispravka s karte provjere GUP-a (tablica gup_ispravci, /admin/gup), izvezeni " +
            "skriptom scripts/gup-grad/ispravci.ts. cestice.py ih primjenjuje kao ručni pregled, s prednošću pred rucno.json.",
          cestice,
        },
        null,
        1,
      ) + "\n",
    );
    console.log(`${cestice.length} čestica → ${IZLAZ}`);
    for (const r of drugo) console.log(`„drugo” (upiši ručno): k.o. ${r.ko} k.č. ${r.kc} — ${r.napomena}`);
  } finally {
    await client.end();
  }
}

void glavno();
