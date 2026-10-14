import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

// Reuse the client across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Database };

function getDb(): Database {
  if (!globalForDb.db) {
    // Pool size comes from the URL (`?max=5`); keep it small on serverless.
    const client = postgres(env.DATABASE_URL, { prepare: false });
    globalForDb.db = drizzle(client, { schema });
  }
  return globalForDb.db;
}

// Created on first use so that `next build` does not need DATABASE_URL.
export const db = new Proxy({} as Database, {
  get(_target, key) {
    const real = getDb();
    const value = Reflect.get(real, key);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Db = Database;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
