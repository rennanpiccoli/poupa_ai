// Integration: resolveProduct() links the Mimosa milk across the 3 chains (test DB + fixtures).
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { Fetcher } from "@/features/catalog/fetch";
import { search } from "@/features/catalog/search";
import type { ChainId } from "@/features/catalog/types";
import { confirmMatch, resolveProduct } from "@/features/matching/resolve";
import { productMatches } from "@/shared/db/schema";
import { testDb } from "./setup/test-db";

const { db, reset } = testDb();
const fx = (c: ChainId, page: "search" | "product") =>
  readFileSync(`tests/fixtures/${c}/${page}.html`, "utf8");
const PRODUCT_SKU: Record<ChainId, string> = {
  continente: "7652960",
  auchan: "3533088",
  pingodoce: "951765",
};
const EAN = "5603722522093";

/** Serves fixtures. Product pages only exist for the fixture product; others have no data. */
function fakeSites() {
  const calls: string[] = [];
  const fetcher: Fetcher = async (chain, url) => {
    const isProduct = !/pesquisa|Search-Show/.test(url);
    calls.push(`${chain}:${isProduct ? "product" : "search"}`);
    if (!isProduct) return fx(chain, "search");
    return url.includes(PRODUCT_SKU[chain]) ? fx(chain, "product") : "<html></html>";
  };
  return { fetcher, calls };
}

beforeEach(async () => {
  await reset();
  await search("leite proteina", { db, fetcher: fakeSites().fetcher }); // user searched first
});

describe("resolveProduct", () => {
  it("from Continente: Auchan by EAN, Pingo Doce by rule (saved)", async () => {
    const sites = fakeSites();
    const r = await resolveProduct("continente", "7652960", { db, fetcher: sites.fetcher });

    expect(r.key).toBe(EAN);
    expect(r.offers.continente).toMatchObject({ priceCents: 249, ean: EAN });
    expect(r.offers.auchan).toMatchObject({ sku: "3533088", priceCents: 199, ean: EAN });
    expect(r.offers.pingodoce).toMatchObject({ sku: "951765", priceCents: 194 });
    expect(r.pending).toEqual({});

    const saved = await db.select().from(productMatches);
    expect(saved).toEqual([
      expect.objectContaining({ chainId: "pingodoce", sku: "951765", canonicalKey: EAN, method: "rule" }),
    ]);
  });

  it("second time: no requests at all (EANs and link remembered)", async () => {
    await resolveProduct("continente", "7652960", { db, fetcher: fakeSites().fetcher });
    const sites = fakeSites();
    const r = await resolveProduct("auchan", "3533088", { db, fetcher: sites.fetcher });
    expect(sites.calls).toEqual([]);
    expect(Object.keys(r.offers).sort()).toEqual(["auchan", "continente", "pingodoce"]);
  });

  it("from Pingo Doce (no EAN): borrows the EAN through a rule match", async () => {
    const r = await resolveProduct("pingodoce", "951765", { db, fetcher: fakeSites().fetcher });
    expect(r.key).toBe(EAN);
    expect(r.offers.continente?.sku).toBe("7652960");
    expect(r.offers.auchan?.sku).toBe("3533088");
  });

  it("a user rejection is remembered and the product is not linked again", async () => {
    await confirmMatch(db, "pingodoce", "951765", EAN, false);
    const r = await resolveProduct("continente", "7652960", { db, fetcher: fakeSites().fetcher });
    expect(r.offers.pingodoce).toBeUndefined();
  });

  it("a user confirmation wins over a rule link", async () => {
    await resolveProduct("continente", "7652960", { db, fetcher: fakeSites().fetcher }); // rule → 951765
    await confirmMatch(db, "pingodoce", "1016857", EAN, true); // user picks another one
    const r = await resolveProduct("continente", "7652960", { db, fetcher: fakeSites().fetcher });
    expect(r.offers.pingodoce?.sku).toBe("1016857");
  });
});
