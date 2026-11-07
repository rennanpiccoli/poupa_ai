// Orchestrates a list comparison: resolve each item across chains, find substitutes for
// "similar" items, run compareList, and mark products as used (for the daily refresh).
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { chainProducts } from "@/shared/db/schema";
import { search, type SearchDeps } from "@/features/catalog/search";
import { CHAINS, type ChainId, type ChainProduct } from "@/features/catalog/types";
import { findSubstitutes, substituteSearchTerm } from "@/features/equivalence/similar";
import { resolveProduct, type Candidate } from "@/features/matching/resolve";
import { compareList, type Comparison, type ItemOptions } from "@/features/smart-split/compare";

export const CompareRequest = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        chain: z.enum(CHAINS),
        sku: z.string().min(1).max(32),
        qty: z.number().int().min(1).max(99),
        mode: z.enum(["exact", "similar"]),
      }),
    )
    .min(1)
    .max(60),
  maxStops: z.number().int().min(1).max(3),
  chains: z.array(z.enum(CHAINS)).min(1).optional(), // future: chains with a store in the radius
});
export type CompareRequest = z.infer<typeof CompareRequest>;

export interface CompareResponse extends Comparison {
  items: {
    id: string;
    key: string;
    pending: Partial<Record<ChainId, Candidate[]>>; // "É este?" questions for this item
  }[];
}

export async function compare(req: CompareRequest, deps: SearchDeps): Promise<CompareResponse> {
  const chains = req.chains ?? [...CHAINS];
  const scopedDeps = { ...deps, chains };

  // Items are independent; per-chain request queues keep the sites safe.
  const resolved = await Promise.all(
    req.items.map(
      async (
        item,
      ): Promise<ItemOptions & { key: string; pending: CompareResponse["items"][0]["pending"] }> => {
        const r = await resolveProduct(item.chain, item.sku, deps);
        const exact = Object.fromEntries(
          Object.entries(r.offers).filter(([c]) => chains.includes(c as ChainId)),
        ) as ItemOptions["exact"];
        let substitutes: ItemOptions["substitutes"] = [];
        if (item.mode === "similar") {
          const source = r.offers[item.chain]!;
          const found = await search(substituteSearchTerm(source), scopedDeps);
          const candidates = Object.values(found).flatMap((x) => x.products);
          // Exact offers in other chains are not "substitutes" even when Pingo Doce lacks an EAN.
          const exactIds = new Set(Object.values(exact).map((p) => `${p!.chain}:${p!.sku}`));
          substitutes = findSubstitutes(
            source,
            candidates.filter((c) => !exactIds.has(`${c.chain}:${c.sku}`)),
          );
        }
        return {
          id: item.id,
          qty: item.qty,
          mode: item.mode,
          exact,
          substitutes,
          key: r.key,
          pending: r.pending,
        };
      },
    ),
  );

  const result = compareList(resolved, chains, req.maxStops);
  await markUsed(
    deps,
    Object.values(result.choices).flatMap((c) => Object.values(c).map((ch) => ch!.product)),
  );
  return {
    ...result,
    items: resolved.map((r) => ({ id: r.id, key: r.key, pending: r.pending })),
  };
}

async function markUsed(deps: SearchDeps, products: ChainProduct[]) {
  const now = deps.now?.() ?? new Date();
  for (const chain of CHAINS) {
    const skus = products.filter((p) => p.chain === chain).map((p) => p.sku);
    if (skus.length === 0) continue;
    await deps.db
      .update(chainProducts)
      .set({ lastUsedAt: now })
      .where(and(eq(chainProducts.chainId, chain), inArray(chainProducts.sku, skus)));
  }
}
