// Integration: search() against the test Postgres, with a fake fetcher serving the fixtures.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Fetcher } from "@/features/catalog/fetch";
import { CACHE_TTL_MS, ERROR_RETRY_MS, normalizeTerm, search } from "@/features/catalog/search";
import type { ChainId } from "@/features/catalog/types";
import { chainProducts } from "@/shared/db/schema";
import { testDb } from "./setup/test-db";

const { db, reset } = testDb();
const html = (c: ChainId) => readFileSync(`tests/fixtures/${c}/search.html`, "utf8");

function fakeFetcher(fail: ChainId[] = []) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (chain, url) => {
    calls.push(chain);
    if (fail.includes(chain)) throw new Error("HTTP 503");
    expect(url).toContain("leite%20proteina");
    return html(chain);
  };
  return { fetcher, calls };
}

const T0 = new Date("2026-11-06T10:00:00Z");
const at = (ms: number) => () => new Date(T0.getTime() + ms);

beforeEach(() => reset());

describe("normalizeTerm", () => {
  it("lowercases, strips accents and extra spaces", () => {
    expect(normalizeTerm("  Leite  PROTEÍNA! ")).toBe("leite proteina");
  });
});

describe("search", () => {
  it("1st call hits the chains, 2nd call (same term, < 24 h) comes from the cache", async () => {
    const f = fakeFetcher();
    const first = await search("leite proteina", { db, fetcher: f.fetcher, now: at(0) });
    expect(f.calls.sort()).toEqual(["auchan", "continente", "pingodoce"]);
    expect(first.continente.status).toBe("fresh");
    expect(first.pingodoce.products[0]).toMatchObject({ sku: "951765", priceCents: 194 });

    const second = await search("Leite Proteína", { db, fetcher: f.fetcher, now: at(60_000) });
    expect(f.calls).toHaveLength(3); // no new requests
    expect(second.continente.status).toBe("cached");
    expect(second.continente.products.map((p) => p.sku)).toEqual(first.continente.products.map((p) => p.sku));
    expect(second.auchan.products[0]).toEqual(first.auchan.products[0]);
  });

  it("refetches after 24 h", async () => {
    const f = fakeFetcher();
    await search("leite proteina", { db, fetcher: f.fetcher, now: at(0) });
    const later = await search("leite proteina", { db, fetcher: f.fetcher, now: at(CACHE_TTL_MS + 1) });
    expect(f.calls).toHaveLength(6);
    expect(later.auchan.status).toBe("fresh");
  });

  it("a failing chain does not block the others; it retries after 10 min", async () => {
    const f = fakeFetcher(["auchan"]);
    const r = await search("leite proteina", { db, fetcher: f.fetcher, now: at(0) });
    expect(r.auchan).toMatchObject({ status: "error", products: [], error: "HTTP 503" });
    expect(r.continente.status).toBe("fresh");

    await search("leite proteina", { db, fetcher: f.fetcher, now: at(60_000) });
    expect(f.calls.filter((c) => c === "auchan")).toHaveLength(1); // error cached briefly

    const ok = fakeFetcher();
    const retried = await search("leite proteina", { db, fetcher: ok.fetcher, now: at(ERROR_RETRY_MS + 1) });
    expect(retried.auchan.status).toBe("fresh");
    expect(ok.calls).toEqual(["auchan"]); // the others were still cached
  });

  it("serves last known results as 'stale' when the site fails after the cache expired", async () => {
    await search("leite proteina", { db, fetcher: fakeFetcher().fetcher, now: at(0) });
    const r = await search("leite proteina", {
      db,
      fetcher: fakeFetcher(["pingodoce"]).fetcher,
      now: at(CACHE_TTL_MS + 1),
    });
    expect(r.pingodoce.status).toBe("stale");
    expect(r.pingodoce.products).toHaveLength(6);
  });

  it("keeps an EAN already known when the search tile is saved again", async () => {
    await search("leite proteina", { db, fetcher: fakeFetcher().fetcher, now: at(0) });
    await db.update(chainProducts).set({ ean: "5603722522093" }).where(eq(chainProducts.sku, "7652960"));
    const r = await search("leite proteina", {
      db,
      fetcher: fakeFetcher().fetcher,
      now: at(CACHE_TTL_MS + 1),
    });
    expect(r.continente.products[0]).toMatchObject({ sku: "7652960", ean: "5603722522093" });
  });

  it("rejects a too-short term", async () => {
    await expect(search(" a ", { db, fetcher: fakeFetcher().fetcher })).rejects.toThrow(/curto/);
  });
});
