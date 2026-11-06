// Vitest global setup: makes sure the test database exists and is migrated.
// Uses TEST_DATABASE_URL (default: local docker Postgres, database "supermkt_test").
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDb } from "@/shared/db/client";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/supermkt_test";

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!exists) await admin.unsafe(`create database "${name.replace(/"/g, "")}"`);
  } catch (e) {
    throw new Error(`Test DB unavailable at ${adminUrl.host} — run \`make db\` first. (${e})`);
  } finally {
    await admin.end();
  }

  const { client, db } = createDb(TEST_DATABASE_URL);
  await migrate(db, { migrationsFolder: "drizzle" });
  await client.end();
}
