// Parser tests against real pages saved in tests/fixtures/ (search "leite proteina", 2026-11-06).
// If a fixture is refreshed (`npm run fixtures`), the expected prices below may need updating.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARSERS } from "@/features/catalog/parsers";
import { CHAINS, type ChainId } from "@/features/catalog/types";

const fixture = (chain: ChainId, page: "search" | "product") =>
  readFileSync(`tests/fixtures/${chain}/${page}.html`, "utf8");

const MIMOSA_EAN = "5603722522093";

describe.each(CHAINS)("%s search page", (chain) => {
  const products = PARSERS[chain].parseSearch(fixture(chain, "search"));

  it("parses every tile with the required fields", () => {
    expect(products).toHaveLength(6);
    for (const p of products) {
      expect(p.chain).toBe(chain);
      expect(p.sku).toMatch(/^\d+$/);
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.brand?.toLowerCase()).toBe("mimosa");
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.priceCents).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https:\/\/www\.[a-z]+\.pt\//);
      expect(p.url).toContain(p.sku);
      expect(p.imageUrl).toContain(p.sku);
      expect(p.size?.dimension).toBe("volume");
      expect(p.category).not.toMatch(/​/);
    }
  });

  it("is stable: same html → same output", () => {
    expect(PARSERS[chain].parseSearch(fixture(chain, "search"))).toEqual(products);
  });
});

describe("search tile details", () => {
  it("continente: hidden 'Indisponível' badge does not mark the product unavailable", () => {
    const [first] = PARSERS.continente.parseSearch(fixture("continente", "search"));
    expect(first).toMatchObject({
      sku: "7652960",
      name: "Leite Proteína sem Lactose Mimosa",
      priceCents: 249,
      sizeText: "emb. 1 lt",
      size: { dimension: "volume", amount: 1000, packs: 1 },
      available: true,
    });
  });

  it("auchan: size comes from the name; generic 'Promoção' label is ignored", () => {
    const [first] = PARSERS.auchan.parseSearch(fixture("auchan", "search"));
    expect(first).toMatchObject({
      sku: "3533088",
      priceCents: 199,
      promoText: null,
      sizeText: null,
      size: { dimension: "volume", amount: 1000, packs: 1 },
    });
  });

  it("pingodoce: current price (not the crossed-out one) + promo", () => {
    const [first, second] = PARSERS.pingodoce.parseSearch(fixture("pingodoce", "search"));
    expect(first).toMatchObject({
      sku: "951765",
      priceCents: 194,
      regularPriceCents: 249,
      promoText: "Promoção até 09/11",
      sizeText: "1 L",
      category: "Leite e Bebidas Vegetais/Leite Magro",
    });
    expect(second.size).toEqual({ dimension: "volume", amount: 750, packs: 3 });
  });
});

describe("product page", () => {
  it("continente: EAN from JSON-LD gtin13", () => {
    expect(PARSERS.continente.parseProduct(fixture("continente", "product"))).toMatchObject({
      sku: "7652960",
      ean: MIMOSA_EAN,
      priceCents: 249,
      brand: "Mimosa",
    });
  });

  it("auchan: EAN from JSON-LD gtin", () => {
    expect(PARSERS.auchan.parseProduct(fixture("auchan", "product"))).toMatchObject({
      sku: "3533088",
      ean: MIMOSA_EAN,
      priceCents: 199,
    });
  });

  it("pingodoce: no EAN, current price from the body", () => {
    expect(PARSERS.pingodoce.parseProduct(fixture("pingodoce", "product"))).toMatchObject({
      sku: "951765",
      ean: null,
      priceCents: 194,
      brand: "Mimosa",
    });
  });

  it("returns nulls (not a crash) on a page without product data", () => {
    expect(PARSERS.auchan.parseProduct("<html><body>erro</body></html>")).toMatchObject({
      ean: null,
      priceCents: null,
      sku: null,
    });
    expect(PARSERS.continente.parseSearch("<html></html>")).toEqual([]);
  });
});
