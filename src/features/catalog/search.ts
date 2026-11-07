// Search across chains with a 24 h cache in Postgres (ADR 0003).
// Each chain is independent: one failing never blocks the others.
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { chainProducts, searchCache } from "@/shared/db/schema";
import type { Fetcher } from "./fetch";
import { PARSERS } from "./parsers";
import { CHAINS, type ChainId, type ChainProduct } from "./types";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ERROR_RETRY_MS = 10 * 60 * 1000;

/** "  Leite  PROTEÍNA " → "leite proteina" (the cache key). */
export function normalizeTerm(term: string): string {
  return term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

export type ChainStatus = "fresh" | "cached" | "stale" | "error";

export interface ChainSearch {
  status: ChainStatus; // fresh = fetched now · cached = < 24 h · stale = site failed, old results · error = nothing
  products: ChainProduct[];
  fetchedAt: Date | null;
  error: string | null;
}

export interface SearchDeps {
  db: Db;
  fetcher: Fetcher;
  now?: () => Date;
  chains?: readonly ChainId[];
}

export async function search(term: string, deps: SearchDeps): Promise<Record<ChainId, ChainSearch>> {
  const key = normalizeTerm(term);
  if (key.length < 2) throw new Error("termo de pesquisa demasiado curto");
  const chains = deps.chains ?? CHAINS;
  const results = await Promise.all(chains.map((c) => searchChain(key, c, deps)));
  return Object.fromEntries(chains.map((c, i) => [c, results[i]])) as Record<ChainId, ChainSearch>;
}

async function searchChain(term: string, chain: ChainId, deps: SearchDeps): Promise<ChainSearch> {
  const { db } = deps;
  const now = deps.now?.() ?? new Date();
  const [cached] = await db
    .select()
    .from(searchCache)
    .where(and(eq(searchCache.term, term), eq(searchCache.chainId, chain)));

  if (cached) {
    const age = now.getTime() - cached.fetchedAt.getTime();
    if (!cached.error && age < CACHE_TTL_MS) {
      return {
        status: "cached",
        products: await loadProducts(db, chain, cached.skus),
        fetchedAt: cached.fetchedAt,
        error: null,
      };
    }
    if (cached.error && age < ERROR_RETRY_MS) return staleOrError(db, chain, cached.skus, cached.error, null);
  }

  try {
    const html = await deps.fetcher(chain, PARSERS[chain].searchUrl(term));
    const products = PARSERS[chain].parseSearch(html);
    await saveProducts(db, products, now);
    await db
      .insert(searchCache)
      .values({ term, chainId: chain, skus: products.map((p) => p.sku), error: null, fetchedAt: now })
      .onConflictDoUpdate({
        target: [searchCache.term, searchCache.chainId],
        set: { skus: sql`excluded.skus`, error: null, fetchedAt: now },
      });
    // Re-read so cached EANs (from product pages) come along.
    return {
      status: "fresh",
      products: await loadProducts(
        db,
        chain,
        products.map((p) => p.sku),
      ),
      fetchedAt: now,
      error: null,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    // Keep the last good skus so the user still sees something (marked stale).
    await db
      .insert(searchCache)
      .values({ term, chainId: chain, skus: cached?.skus ?? [], error, fetchedAt: now })
      .onConflictDoUpdate({
        target: [searchCache.term, searchCache.chainId],
        set: { error, fetchedAt: now },
      });
    return staleOrError(db, chain, cached?.skus ?? [], error, cached?.fetchedAt ?? null);
  }
}

async function staleOrError(
  db: Db,
  chain: ChainId,
  skus: string[],
  error: string,
  fetchedAt: Date | null,
): Promise<ChainSearch> {
  const products = await loadProducts(db, chain, skus);
  return { status: products.length ? "stale" : "error", products, fetchedAt, error };
}

/** Upsert search-tile data. Never overwrites EAN/details fetched from product pages. */
export async function saveProducts(db: Db, products: ChainProduct[], now: Date) {
  if (products.length === 0) return;
  const rows = dedupe(products).map((p) => ({
    chainId: p.chain,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    priceCents: p.priceCents,
    regularPriceCents: p.regularPriceCents,
    promoText: p.promoText,
    sizeText: p.sizeText,
    sizeDimension: p.size?.dimension ?? null,
    sizeAmount: p.size?.amount ?? null,
    sizePacks: p.size?.packs ?? null,
    sizeDrained: p.size?.drained ?? null,
    category: p.category,
    url: p.url,
    imageUrl: p.imageUrl,
    available: p.available,
    priceSeenAt: now,
  }));
  const ex = (col: string) => sql.raw(`excluded.${col}`);
  await db
    .insert(chainProducts)
    .values(rows)
    .onConflictDoUpdate({
      target: [chainProducts.chainId, chainProducts.sku],
      set: {
        name: ex("name"),
        brand: ex("brand"),
        priceCents: ex("price_cents"),
        regularPriceCents: ex("regular_price_cents"),
        promoText: ex("promo_text"),
        sizeText: ex("size_text"),
        sizeDimension: ex("size_dimension"),
        sizeAmount: ex("size_amount"),
        sizePacks: ex("size_packs"),
        sizeDrained: ex("size_drained"),
        category: ex("category"),
        url: ex("url"),
        imageUrl: sql`coalesce(excluded.image_url, ${chainProducts.imageUrl})`,
        available: ex("available"),
        priceSeenAt: ex("price_seen_at"),
      },
    });
}

/** Same sku can appear twice on a page (e.g. sponsored tile); Postgres rejects that in one upsert. */
function dedupe(products: ChainProduct[]): ChainProduct[] {
  const seen = new Map<string, ChainProduct>();
  for (const p of products) if (!seen.has(p.sku)) seen.set(p.sku, p);
  return [...seen.values()];
}

export async function loadProducts(db: Db, chain: ChainId, skus: string[]): Promise<ChainProduct[]> {
  if (skus.length === 0) return [];
  const rows = await db
    .select()
    .from(chainProducts)
    .where(and(eq(chainProducts.chainId, chain), inArray(chainProducts.sku, skus)));
  const bySku = new Map(rows.map((r) => [r.sku, r]));
  return skus.flatMap((sku) => {
    const r = bySku.get(sku);
    return r ? [rowToProduct(r)] : [];
  });
}

export function rowToProduct(r: typeof chainProducts.$inferSelect): ChainProduct {
  return {
    chain: r.chainId as ChainId,
    sku: r.sku,
    name: r.name,
    brand: r.brand,
    priceCents: r.priceCents,
    regularPriceCents: r.regularPriceCents,
    promoText: r.promoText,
    sizeText: r.sizeText,
    size:
      r.sizeDimension && r.sizeAmount !== null
        ? {
            dimension: r.sizeDimension as "volume" | "mass" | "count",
            amount: r.sizeAmount,
            packs: r.sizePacks ?? 1,
            ...(r.sizeDrained !== null ? { drained: r.sizeDrained } : {}),
          }
        : null,
    category: r.category,
    url: r.url,
    imageUrl: r.imageUrl,
    available: r.available,
    ean: r.ean,
    seenAt: r.priceSeenAt,
  };
}
