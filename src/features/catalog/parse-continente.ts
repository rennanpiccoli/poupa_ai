// Continente (Salesforce Commerce Cloud). Fixture: tests/fixtures/continente/.
import * as cheerio from "cheerio";
import type { ChainParser, ChainProduct } from "./types";
import { absolute, clean, jsonAttr, parseProductJsonLd, tileImage } from "./parse-common";
import { parseSize, toCents } from "./size";

const BASE = "https://www.continente.pt";

interface Impression {
  name?: string;
  id?: string;
  price?: number | string;
  brand?: string;
  category?: string;
}

export const continente: ChainParser = {
  searchUrl: (term) => `${BASE}/pesquisa/?q=${encodeURIComponent(term)}`,

  parseSearch(html) {
    const $ = cheerio.load(html);
    const out: ChainProduct[] = [];
    $(".product-tile").each((_, el) => {
      const t = $(el);
      const imp = jsonAttr<Impression>(t.attr("data-product-tile-impression"));
      const sku = imp?.id ?? t.find("[data-pid]").first().attr("data-pid");
      const priceCents = imp?.price !== undefined ? toCents(imp.price) : null;
      const url = absolute(t.find("a[href*='/produto/']").first().attr("href"), BASE);
      const name = clean(imp?.name) ?? clean(t.find(".pwc-tile--description").text());
      if (!sku || priceCents === null || !url || !name) return;

      const sizeText = clean(t.find(".pwc-tile--quantity").first().text());
      const regular = t.find(".pwc-discount-amount, .strike-through .value[content]").first();
      const regularPriceCents = regular.length ? toCents(regular.attr("content") ?? regular.text()) : null;
      // The "Indisponível" badge is always in the HTML; it only counts when not hidden.
      const unavailable = t.find(".dual-badge-unavailable-message").not(".d-none").length > 0;

      out.push({
        chain: "continente",
        sku,
        name,
        brand: clean(imp?.brand),
        priceCents,
        regularPriceCents: regularPriceCents && regularPriceCents > priceCents ? regularPriceCents : null,
        promoText: clean(t.find(".ct-product-tile-badge-promotion, .pwc-promo-message").first().text()),
        sizeText,
        size: sizeText ? parseSize(sizeText) : parseSize(name),
        category: clean(imp?.category),
        url,
        imageUrl: tileImage(t, sku),
        available: !unavailable,
        ean: null,
      });
    });
    return out;
  },

  parseProduct: (html) => parseProductJsonLd("continente", html),
};
