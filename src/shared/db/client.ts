import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/shared/config";
import * as schema from "./schema";

export function createDb(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return { client, db: drizzle(client, { schema }) };
}

export type Db = ReturnType<typeof createDb>["db"];

let app: ReturnType<typeof createDb> | undefined;
const appDb = () => (app ??= createDb(config().DATABASE_URL));

/** Raw postgres client of the app (used by /api/health and migrate). */
export const sql = () => appDb().client;

/** Drizzle instance of the app. Tests use createDb() with TEST_DATABASE_URL instead. */
export const db = () => appDb().db;
