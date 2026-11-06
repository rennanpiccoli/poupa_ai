// Auchan (Salesforce Commerce Cloud). Fixture: tests/fixtures/auchan/.
import * as cheerio from "cheerio";
import type { ChainParser, ChainProduct } from "./types";
import { absolute, clean, jsonAttr, parseProductJsonLd, tileImage } from "./parse-common";
import { parseSize, toCents } from "./size";

const BASE = "https://www.auchan.pt";

interface Gtm {
  name?: string;
  id?: string;
  price?: string | number;
  brand?: string;
  category?: string;
}

export const auchan: ChainParser = {
  searchUrl: (term) => `${BASE}/pt/pesquisa?q=${encodeURIComponent(term)}`,

  parseSearch(html) {
    const $ = cheerio.load(html);
    const out: ChainProduct[] = [];
    $(".product-tile").each((_, el) => {
      const t = $(el);
      const gtm = jsonAttr<Gtm>(t.attr("data-gtm"));
      const urls = jsonAttr<{ absoluteProductUrl?: string; productUrl?: string }>(t.attr("data-urls"));
      const sku = t.attr("data-pid") ?? gtm?.id;
      const shownPrice = t
        .find(".price .sales .value[content], .sales .value[content]")
        .first()
        .attr("content");
      const priceCents = toCents(shownPrice ?? gtm?.price ?? "");
      const url = absolute(urls?.absoluteProductUrl ?? urls?.productUrl, BASE);
      const name = clean(gtm?.name) ?? clean(t.find(".auc-product-tile__name, a.link").first().text());
      if (!sku || priceCents === null || !url || !name) return;

      const regular = t.find(".strike-through .value[content], .auc-price__stricked .value[content]").first();
      const regularPriceCents = regular.length ? toCents(regular.attr("content") ?? "") : null;

      out.push({
        chain: "auchan",
        sku,
        name,
        brand: clean(gtm?.brand),
        priceCents,
        regularPriceCents: regularPriceCents && regularPriceCents > priceCents ? regularPriceCents : null,
        // The "Promoção" label shows on almost every Auchan tile (not a real promo signal) → ignored.
        promoText: null,
        sizeText: null, // Auchan has no size field: it lives in the name ("… 1 LT")
        size: parseSize(name),
        category: clean(gtm?.category),
        url,
        imageUrl: tileImage(t, sku),
        available: true, // no availability marker on search tiles
        ean: null,
      });
    });
    return out;
  },

  parseProduct: (html) =>
    parseProductJsonLd("auchan", html, ($) => $(".prices .sales .value[content]").first().attr("content")),
};
