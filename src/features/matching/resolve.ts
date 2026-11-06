// Find the same product in every chain (spec 001, task 6).
//   Continente ↔ Auchan: search by EAN, confirmed on the product page (exact).
//   Pingo Doce (no EAN): rule match (match.ts); auto-links are saved in product_matches,
//   unclear ones are returned as `pending` for the user to confirm (confirmMatch).
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { chainProducts, productMatches } from "@/shared/db/schema";
import { PARSERS } from "@/features/catalog/parsers";
import { loadProducts, search, type SearchDeps } from "@/features/catalog/search";
import { CHAINS, type ChainId, type ChainProduct } from "@/features/catalog/types";
import { decideMatch, searchTermFor } from "./match";

export const isEan = (key: string) => /^\d{8,14}$/.test(key);

export interface Candidate {
  candidate: ChainProduct;
  score: number;
}

export interface ResolvedProduct {
  key: string; // canonical: EAN, or "<chain>:<sku>" when no EAN is known
  offers: Partial<Record<ChainId, ChainProduct>>;
  pending: Partial<Record<ChainId, Candidate[]>>; // "É este?" — user decides via confirmMatch
}

const MAX_EAN_CHECKS = 2; // product pages fetched per EAN search

export async function resolveProduct(
  chain: ChainId,
  sku: string,
  deps: SearchDeps,
): Promise<ResolvedProduct> {
  const { db } = deps;
  const [source] = await loadProducts(db, chain, [sku]);
  if (!source) throw new Error(`produto desconhecido: ${chain}/${sku}`);

  let key = (await ensureEan(source, deps)) ?? (await confirmedKeyOf(db, chain, sku)) ?? `${chain}:${sku}`;
  const offers: ResolvedProduct["offers"] = { [chain]: { ...source, ean: isEan(key) ? key : source.ean } };
  const pending: ResolvedProduct["pending"] = {};

  // A Pingo Doce product with no known link yet: borrow the EAN from a rule match elsewhere.
  if (!isEan(key)) {
    for (const other of CHAINS.filter((c) => c !== chain && c !== "pingodoce")) {
      const d = decideMatch(source, await candidatesIn(other, source, deps));
      if (d.kind !== "auto") continue;
      const ean = await ensureEan(d.candidate, deps);
      if (ean) {
        key = ean;
        await saveMatch(db, chain, sku, ean, "rule", "confirmed", d.score);
        break;
      }
    }
  }

  // Chains are independent (separate request queues) → resolve them in parallel.
  const finalKey = key;
  const others = CHAINS.filter((c) => c !== chain);
  const results = await Promise.all(others.map((other) => resolveIn(other, source, finalKey, deps)));
  others.forEach((other, i) => {
    const r = results[i];
    if (r.offer) offers[other] = r.offer;
    if (r.pending) pending[other] = r.pending;
  });
  return { key, offers, pending };
}

async function resolveIn(
  chain: ChainId,
  source: ChainProduct,
  key: string,
  deps: SearchDeps,
): Promise<{ offer: ChainProduct | null; pending: Candidate[] | null }> {
  const { db } = deps;
  if (isEan(key)) {
    const offer =
      chain === "pingodoce" ? await linkedOffer(db, chain, key) : await findByEan(chain, key, deps);
    if (offer) return { offer, pending: null };
  }
  const rejected = isEan(key) ? await rejectedSkus(db, chain, key) : new Set<string>();
  const d = decideMatch(source, await candidatesIn(chain, source, deps), rejected);
  if (d.kind === "auto") {
    if (chain === "pingodoce" && isEan(key))
      await saveMatch(db, chain, d.candidate.sku, key, "rule", "confirmed", d.score);
    return { offer: d.candidate, pending: null };
  }
  return { offer: null, pending: d.kind === "ask" ? d.candidates : null };
}

/** User answer to "É este?". Rejections are remembered so the candidate is never suggested again. */
export async function confirmMatch(db: Db, chain: ChainId, sku: string, key: string, accept: boolean) {
  await saveMatch(db, chain, sku, key, "user", accept ? "confirmed" : "rejected", null);
}

/** EAN of a Continente/Auchan product; reads the product page once and remembers it. */
export async function ensureEan(p: ChainProduct, deps: SearchDeps): Promise<string | null> {
  if (p.ean) return p.ean;
  if (p.chain === "pingodoce") return null;
  const { db } = deps;
  const [row] = await db
    .select({ ean: chainProducts.ean, detailsFetchedAt: chainProducts.detailsFetchedAt })
    .from(chainProducts)
    .where(and(eq(chainProducts.chainId, p.chain), eq(chainProducts.sku, p.sku)));
  if (row?.detailsFetchedAt) return row.ean;

  const now = deps.now?.() ?? new Date();
  let ean: string | null = null;
  let imageUrl: string | null = null;
  try {
    const page = PARSERS[p.chain].parseProduct(await deps.fetcher(p.chain, p.url));
    ean = page.ean;
    imageUrl = page.imageUrl;
  } catch {
    return null; // try again next time (detailsFetchedAt stays null)
  }
  await db
    .update(chainProducts)
    .set({ ean, detailsFetchedAt: now, ...(p.imageUrl ? {} : { imageUrl }) })
    .where(and(eq(chainProducts.chainId, p.chain), eq(chainProducts.sku, p.sku)));
  return ean;
}

async function findByEan(chain: ChainId, ean: string, deps: SearchDeps): Promise<ChainProduct | null> {
  const { db } = deps;
  const [known] = await db
    .select({ sku: chainProducts.sku })
    .from(chainProducts)
    .where(and(eq(chainProducts.chainId, chain), eq(chainProducts.ean, ean)));
  if (known) return (await loadProducts(db, chain, [known.sku]))[0] ?? null;

  // The chain's own search finds products by barcode; confirm on the product page.
  const found = (await search(ean, { ...deps, chains: [chain] }))[chain].products;
  for (const p of found.slice(0, MAX_EAN_CHECKS)) {
    if ((await ensureEan(p, deps)) === ean) return { ...p, ean };
  }
  return null;
}

async function candidatesIn(chain: ChainId, source: ChainProduct, deps: SearchDeps): Promise<ChainProduct[]> {
  return (await search(searchTermFor(source), { ...deps, chains: [chain] }))[chain].products;
}

async function linkedOffer(db: Db, chain: ChainId, key: string): Promise<ChainProduct | null> {
  const [m] = await db
    .select({ sku: productMatches.sku })
    .from(productMatches)
    .where(
      and(
        eq(productMatches.chainId, chain),
        eq(productMatches.canonicalKey, key),
        eq(productMatches.status, "confirmed"),
      ),
    )
    .orderBy(desc(productMatches.method)); // "user" before "rule": the user's choice wins
  return m ? ((await loadProducts(db, chain, [m.sku]))[0] ?? null) : null;
}

async function confirmedKeyOf(db: Db, chain: ChainId, sku: string): Promise<string | null> {
  const [m] = await db
    .select({ key: productMatches.canonicalKey })
    .from(productMatches)
    .where(
      and(
        eq(productMatches.chainId, chain),
        eq(productMatches.sku, sku),
        eq(productMatches.status, "confirmed"),
        isNotNull(productMatches.canonicalKey),
      ),
    );
  return m?.key ?? null;
}

async function rejectedSkus(db: Db, chain: ChainId, key: string): Promise<Set<string>> {
  const rows = await db
    .select({ sku: productMatches.sku })
    .from(productMatches)
    .where(
      and(
        eq(productMatches.chainId, chain),
        eq(productMatches.canonicalKey, key),
        eq(productMatches.status, "rejected"),
      ),
    );
  return new Set(rows.map((r) => r.sku));
}

async function saveMatch(
  db: Db,
  chain: ChainId,
  sku: string,
  key: string,
  method: "rule" | "user",
  status: "confirmed" | "rejected",
  score: number | null,
) {
  await db
    .insert(productMatches)
    .values({ chainId: chain, sku, canonicalKey: key, method, status, score })
    .onConflictDoUpdate({
      target: [productMatches.chainId, productMatches.sku, productMatches.canonicalKey],
      set: { method, status, score },
    });
}
