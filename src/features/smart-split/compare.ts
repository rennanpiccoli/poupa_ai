// List → price table → Smart Split. Pure and deterministic (spec 001, task 8).
// Per item and chain we pick ONE product:
//   "exact"   → the same product in that chain (if sold and available there)
//   "similar" → the exact one, or a cheaper substitute in that chain (cheaper package price)
import type { ChainId, ChainProduct } from "@/features/catalog/types";
import type { Substitute } from "@/features/equivalence/similar";
import { smartSplit, type PriceTable, type SplitPlan } from "./split";

export type ItemMode = "exact" | "similar";

export interface ItemOptions {
  id: string;
  qty: number;
  mode: ItemMode;
  exact: Partial<Record<ChainId, ChainProduct>>; // same product per chain
  substitutes: Substitute[]; // cheaper similar products (any chain), from findSubstitutes
}

export interface ChainChoice {
  product: ChainProduct;
  substitute: boolean; // true = not the product the user picked
}

export interface Comparison {
  choices: Record<string, Partial<Record<ChainId, ChainChoice>>>; // itemId → chain → choice
  bestByStops: (SplitPlan | null)[];
  best: SplitPlan | null;
  /** best (any stops) vs the cheapest single chain; 0 when 1 stop is already best. */
  savingsCents: number;
}

export function chooseForItem(item: ItemOptions): Partial<Record<ChainId, ChainChoice>> {
  const out: Partial<Record<ChainId, ChainChoice>> = {};
  for (const [chain, p] of Object.entries(item.exact) as [ChainId, ChainProduct][]) {
    if (p.available) out[chain] = { product: p, substitute: false };
  }
  if (item.mode === "similar") {
    // Keep the cheapest package per chain; strict "<" keeps the exact product on ties and,
    // since substitutes come sorted (deterministic), the first of equal substitutes.
    for (const s of item.substitutes) {
      if (!s.product.available) continue;
      const current = out[s.product.chain];
      if (!current || s.product.priceCents < current.product.priceCents) {
        out[s.product.chain] = { product: s.product, substitute: true };
      }
    }
  }
  return out;
}

export function compareList(items: ItemOptions[], chains: ChainId[], maxStops: number): Comparison {
  const choices: Comparison["choices"] = {};
  const prices: PriceTable = {};
  for (const item of items) {
    const c = chooseForItem(item);
    choices[item.id] = c;
    prices[item.id] = Object.fromEntries(
      (Object.entries(c) as [ChainId, ChainChoice][]).map(([chain, ch]) => [chain, ch.product.priceCents]),
    );
  }
  const { bestByStops, best } = smartSplit({
    items: items.map((i) => ({ id: i.id, qty: i.qty })),
    prices,
    chains,
    maxStops,
  });
  const single = bestByStops[0];
  const savingsCents =
    best && single && best.missing.length === single.missing.length ? single.totalCents - best.totalCents : 0;
  return { choices, bestByStops, best, savingsCents };
}
