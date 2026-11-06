// Helpers shared by the chain parsers. All pure.
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { ChainId, ProductPage } from "./types";
import { toCents } from "./size";

export const clean = (s: string | undefined | null): string | null => {
  // zero-width chars appear in Pingo Doce categories ("Leite Magro\u200b")
  const t = (s ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length ? t : null;
};

export function jsonAttr<T = Record<string, unknown>>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const absolute = (href: string | undefined | null, base: string): string | null =>
  href && href.trim() ? new URL(href.trim(), base).toString() : null;

/** Product photo inside a tile: the <img> whose src/data-src contains the sku (skips badges/labels). */
export function tileImage(t: cheerio.Cheerio<AnyNode>, sku: string): string | null {
  for (const el of t.find("img").toArray()) {
    const src = (el.attribs["data-src"] || el.attribs["src"] || "").trim();
    if (src && src.includes(sku)) return src;
  }
  return null;
}

const EAN_RE = /^\d{8}$|^\d{12,14}$/;

/** JSON-LD Product block → ProductPage. Body price (if given) wins over JSON-LD offers. */
export function parseProductJsonLd(
  chain: ChainId,
  html: string,
  bodyPrice?: ($: cheerio.CheerioAPI) => string | undefined,
): ProductPage {
  const $ = cheerio.load(html);
  let product: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    const j = jsonAttr<unknown>($(el).text());
    for (const node of Array.isArray(j) ? j : [j]) {
      if (node && typeof node === "object" && (node as { "@type"?: string })["@type"] === "Product") {
        product = node as Record<string, unknown>;
      }
    }
  });
  const p = (product ?? {}) as {
    name?: string;
    sku?: string;
    gtin13?: string;
    gtin?: string;
    brand?: { name?: string } | string;
    image?: string[] | string;
    offers?: { price?: string | number } | { price?: string | number }[];
  };
  const ean = [p.gtin13, p.gtin].map((x) => (x ? String(x).trim() : "")).find((x) => EAN_RE.test(x));
  const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const rawPrice = bodyPrice?.($) ?? offer?.price;
  return {
    chain,
    sku: p.sku ? String(p.sku) : null,
    name: clean(p.name),
    brand: clean(typeof p.brand === "string" ? p.brand : p.brand?.name),
    ean: ean ?? null,
    priceCents: rawPrice !== undefined ? toCents(rawPrice) : null,
    imageUrl: (Array.isArray(p.image) ? p.image[0] : p.image) ?? null,
  };
}
