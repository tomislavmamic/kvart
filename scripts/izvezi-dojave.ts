/**
 * Izvoz svih dojava mirisa u JSON, da se model može provjeriti na njima.
 *
 * Bazdarenje (`bazdari-izvor.py`) ocjenjuje model na jednoj postaji, i ta
 * postaja stoji s **krive** strane plohe — u udolini prema Kamenu, na 140°,
 * dok kvart leži na 290–293°. Ta ograda stoji zapisana u samom skriptu.
 * Dojave su jedini prijemnik s prave strane, pa su i jedina prilika da se
 * provjeri ono što bazdarenje ne može vidjeti.
 *
 * Izvozi se i ono što `getOdourReports` ne vraća: koordinata (bez nje se
 * dojava ne može staviti u model) i `hidden` (da se skriveno može izbaciti
 * ovdje, a ne tiho nedostajati).
 *
 * Pokretanje: npm run izvezi-dojave
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { writeFileSync } from "node:fs";
import postgres from "postgres";

import { odourReports } from "../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const IZLAZ = "data/dojave.json";

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function glavno() {
const redovi = await db.select().from(odourReports).orderBy(odourReports.occurredAt);

writeFileSync(
  IZLAZ,
  JSON.stringify(
    redovi.map((r) => ({
      ...r,
      occurredAt: r.occurredAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    null,
    2,
  ) + "\n",
);

const smrdjelo = redovi.filter((r) => r.smelled).length;
const sKoordinatom = redovi.filter((r) => r.lat !== null && r.lng !== null).length;
console.log(
  `${redovi.length} dojava (${smrdjelo} sa mirisom, ${redovi.length - smrdjelo} bez, ` +
    `${sKoordinatom} s koordinatom, ${redovi.filter((r) => r.hidden).length} skrivenih) → ${IZLAZ}`,
);
if (redovi.length > 0) {
  console.log(
    `raspon: ${redovi[0].occurredAt.toISOString()} … ${redovi[redovi.length - 1].occurredAt.toISOString()}`,
  );
}

await client.end();
}

void glavno();
