// Core schema (spec 001). Money = integer cents. Chain ids come from src/features/catalog/types.ts (CHAINS).
// Canonical product key = EAN when known, else "<chain>:<sku>" — see docs/decisions/0003-on-demand-prices.md.
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** One product as sold by one chain, with its latest observed price. */
export const chainProducts = pgTable(
  "chain_products",
  {
    chainId: text("chain_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    priceCents: integer("price_cents").notNull(),
    regularPriceCents: integer("regular_price_cents"),
    promoText: text("promo_text"),
    sizeText: text("size_text"),
    sizeDimension: text("size_dimension"), // "volume" | "mass" | "count"
    sizeAmount: doublePrecision("size_amount"), // ml, g or units
    sizePacks: integer("size_packs"),
    sizeDrained: doublePrecision("size_drained"), // drained weight in g (canned food)
    category: text("category"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    available: boolean("available").notNull().default(true),
    ean: text("ean"), // from the product page; never set for Pingo Doce
    priceSeenAt: ts("price_seen_at").notNull().defaultNow(), // when this price was read
    detailsFetchedAt: ts("details_fetched_at"), // when the product page (EAN) was read
    lastUsedAt: ts("last_used_at"), // last time it was in someone's comparison → daily refresh
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.sku] }), index("chain_products_ean_idx").on(t.ean)],
);

/** Search results per (term, chain). Fresh for 24 h. */
export const searchCache = pgTable(
  "search_cache",
  {
    term: text("term").notNull(), // normalized: lowercase, no accents, single spaces
    chainId: text("chain_id").notNull(),
    skus: text("skus").array().notNull(), // result order as shown by the chain
    error: text("error"), // set when the chain failed; short retry instead of 24 h
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.term, t.chainId] })],
);

/**
 * Links a chain product to a canonical key (EAN) when it has no EAN of its own (Pingo Doce),
 * or records that a user rejected a suggested link (never suggest it again).
 */
export const productMatches = pgTable(
  "product_matches",
  {
    chainId: text("chain_id").notNull(),
    sku: text("sku").notNull(),
    canonicalKey: text("canonical_key").notNull(),
    method: text("method").notNull(), // "rule" | "user"
    status: text("status").notNull(), // "confirmed" | "rejected"
    score: real("score"), // rule similarity 0..1 (null for user decisions)
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.sku, t.canonicalKey] }),
    index("product_matches_key_idx").on(t.canonicalKey),
  ],
);
