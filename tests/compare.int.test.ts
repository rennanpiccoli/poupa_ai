// Integration: the full compare() with a seeded test DB and fixture "sites".
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { isNotNull } from "drizzle-orm";
import type { Fetcher } from "@/features/catalog/fetch";
import { search } from "@/features/catalog/search";
import type { ChainId } from "@/features/catalog/types";
import { compare } from "@/features/shopping-list/compare-service";
import { POST as comparePOST } from "@/app/api/compare/route";
import { POST as matchPOST } from "@/app/api/match/route";
import { chainProducts } from "@/shared/db/schema";
import { testDb } from "./setup/test-db";

const { db, reset } = testDb();
const fx = (c: ChainId, page: "search" | "product") =>
  readFileSync(`tests/fixtures/${c}/${page}.html`, "utf8");
const PRODUCT_SKU: Record<ChainId, string> = {
  continente: "7652960",
  auchan: "3533088",
  pingodoce: "951765",
};
const fetcher: Fetcher = async (chain, url) => {
  if (/pesquisa|Search-Show/.test(url)) return fx(chain, "search");
  return url.includes(PRODUCT_SKU[chain]) ? fx(chain, "product") : "<html></html>";
};

beforeEach(async () => {
  await reset();
  await search("leite proteina", { db, fetcher });
});

describe("compare()", () => {
  it("Mimosa Proteína x2 + cacao pack x1, up to 2 stops", async () => {
    const r = await compare(
      {
        items: [
          { id: "leite", chain: "continente", sku: "7652960", qty: 2, mode: "exact" },
          { id: "cacau", chain: "continente", sku: "6661374", qty: 1, mode: "exact" },
        ],
        maxStops: 2,
      },
      { db, fetcher },
    );
    // leite: C 2,49 · A 1,99 · PD 1,94 — cacau 3x250: C 3,30 · A 2,97 · PD 2,97
    expect(r.bestByStops[0]).toMatchObject({ chains: ["pingodoce"], totalCents: 194 * 2 + 297 });
    expect(r.best?.totalCents).toBe(194 * 2 + 297);
    expect(r.savingsCents).toBe(0);
    expect(r.items.find((i) => i.id === "leite")?.key).toBe("5603722522093");
  });

  it("marks the chosen products as used (daily refresh)", async () => {
    await compare(
      { items: [{ id: "leite", chain: "continente", sku: "7652960", qty: 1, mode: "exact" }], maxStops: 1 },
      { db, fetcher },
    );
    const used = await db.select().from(chainProducts).where(isNotNull(chainProducts.lastUsedAt));
    expect(used.map((u) => `${u.chainId}:${u.sku}`).sort()).toEqual([
      "auchan:3533088",
      "continente:7652960",
      "pingodoce:951765",
    ]);
  });

  it("respects a chain subset", async () => {
    const r = await compare(
      {
        items: [{ id: "leite", chain: "continente", sku: "7652960", qty: 1, mode: "exact" }],
        maxStops: 3,
        chains: ["continente", "auchan"],
      },
      { db, fetcher },
    );
    expect(r.best).toMatchObject({ chains: ["auchan"], totalCents: 199 });
    expect(r.choices.leite.pingodoce).toBeUndefined();
  });
});

describe("routes: input validation", () => {
  const post = (body: unknown) =>
    new Request("http://x/api", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

  it("compare rejects bad input with 400", async () => {
    expect((await comparePOST(post({ items: [], maxStops: 2 }))).status).toBe(400);
    expect(
      (
        await comparePOST(
          post({ items: [{ id: "a", chain: "lidl", sku: "1", qty: 1, mode: "exact" }], maxStops: 1 }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await comparePOST(new Request("http://x/api", { method: "POST", body: "not json" }))).status,
    ).toBe(400);
  });

  it("match rejects bad input with 400", async () => {
    expect((await matchPOST(post({ chain: "pingodoce", sku: "1" }))).status).toBe(400);
  });
});
