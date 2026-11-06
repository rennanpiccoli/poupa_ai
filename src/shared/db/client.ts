import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/shared/config";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function sql() {
  client ??= postgres(config().DATABASE_URL, { max: 5, onnotice: () => {} });
  return client;
}

export function db() {
  return drizzle(sql(), { schema });
}
