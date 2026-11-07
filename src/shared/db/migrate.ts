// Explicit migration step (never hidden in app startup). Run: `make migrate`.
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "./client";

await migrate(db(), { migrationsFolder: process.env.MIGRATIONS_DIR ?? "drizzle" });
console.log("✅ migrations applied");
await sql().end();
