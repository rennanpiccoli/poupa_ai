// Per-file helper for integration tests: a Drizzle instance on the test DB + table reset.
import { afterAll } from "vitest";
import { createDb } from "@/shared/db/client";

const url = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/supermkt_test";

export function testDb() {
  const { client, db } = createDb(url);
  afterAll(() => client.end());
  const reset = () => client`truncate chain_products, search_cache, product_matches`;
  return { db, reset };
}
