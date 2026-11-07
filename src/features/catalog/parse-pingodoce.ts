// Pingo Doce (Salesforce Commerce Cloud). Fixture: tests/fixtures/pingodoce/.
// No EAN anywhere on the site → products are matched by brand + name + size (see features/matching).
import * as cheerio from "cheerio";
import type { ChainParser, ChainProduct } from "./types";
import { absolute, clean, jsonAttr, parseProductJsonLd, tileImage } from "./parse-common";
import { parseSize, toCents } from "./size";

const BASE = "https://www.pingodoce.pt";

interface GtmInfo {
  items?: {
    item_id?: string;
    item_name?: string;
    item_brand?: string;
    item_category?: string;
    item_category2?: string;
    price?: number | string;
  }[];
}

export const pingodoce: ChainParser = {
  searchUrl: (term) =>
    `${BASE}/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?q=${encodeURIComponent(term)}`,

  parseSearch(html) {
    const $ = cheerio.load(html);
    const out: ChainProduct[] = [];
    $("div.product[data-pid]").each((_, el) => {
      const t = $(el);
      const item = jsonAttr<GtmInfo>(t.find("[data-gtm-info]").first().attr("data-gtm-info"))?.items?.[0];
      const sku = t.attr("data-pid") ?? item?.item_id;
      const priceCents = toCents(item?.price ?? t.find(".sales").first().text());
      const url = absolute(t.find("a[href*='/produtos/']").first().attr("href"), BASE);
      const name = clean(item?.item_name) ?? clean(t.find(".product-name, .pdp-link a").first().text());
      if (!sku || priceCents === null || !url || !name) return;

      // ".product-unit" = "3 x0.25 L | 3,96 €/L" → the size is before the "|"
      const sizeText = clean(t.find(".product-unit").first().text().split("|")[0]);
      const regular = t.find(".strike-through .value[content]").first();
      const regularPriceCents = regular.length ? toCents(regular.attr("content") ?? "") : null;

      out.push({
        chain: "pingodoce",
        sku,
        name,
        brand: clean(item?.item_brand) ?? clean(t.find(".product-brand-name").first().text()),
        priceCents,
        regularPriceCents: regularPriceCents && regularPriceCents > priceCents ? regularPriceCents : null,
        promoText: clean(t.find(".promo-message").first().text()),
        sizeText,
        size: sizeText ? parseSize(sizeText) : parseSize(name),
        category: clean([item?.item_category2, item?.item_category].filter(Boolean).join("/")),
        url,
        imageUrl: tileImage(t, sku),
        available: true,
        ean: null,
      });
    });
    return out;
  },

  // Body has both prices (current + crossed-out); the current one is under ".sales".
  parseProduct: (html) =>
    parseProductJsonLd("pingodoce", html, ($) => $(".sales .value[content]").first().attr("content")),
};
