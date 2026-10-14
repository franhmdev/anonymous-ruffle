import { config } from "dotenv";
import postgres from "postgres";

/**
 * All e2e traffic comes from 127.0.0.1, so repeated local runs hit the per-IP
 * rate limits. Reset the counters before each local run (never against a
 * deployed environment).
 */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  config({ path: [".env.local", ".env"], quiet: true });
  if (!process.env.DATABASE_URL) return;
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await sql`delete from rate_limits`;
  } finally {
    await sql.end();
  }
}
