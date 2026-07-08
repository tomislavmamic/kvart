import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// postgres.js works against both local Postgres and Neon (TCP).
// `prepare: false` keeps it compatible with Neon's connection pooler.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
