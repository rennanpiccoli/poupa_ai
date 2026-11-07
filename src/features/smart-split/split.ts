// Smart Split: pick the cheapest set of 1..maxStops chains for a shopping list.
// Pure and deterministic — no I/O, no AI. Money is always integer cents.
//
// Algorithm: brute force over every combination of k chains (k = 1..maxStops).
// With ~10 chains and k ≤ 3 that's ≤ 175 combos — instant, and exact (no heuristics).

export type ChainId = string;
export type ItemId = string;

export interface ListItem {
  id: ItemId;
  qty: number; // units to buy (≥ 1)
}

/** prices[itemId][chainId] = unit price in cents. Missing entry = not sold there. */
export type PriceTable = Record<ItemId, Partial<Record<ChainId, number>>>;

export interface SplitInput {
  items: ListItem[];
  prices: PriceTable;
  chains: ChainId[]; // candidate chains (e.g. those with a store within the radius)
  maxStops: number; // 1, 2 or 3
}

export interface SplitPlan {
  chains: ChainId[]; // chains actually visited, sorted
  totalCents: number; // cost of the items that could be bought
  assignment: Record<ItemId, ChainId>; // where each item is bought
  missing: ItemId[]; // items not available in any of the plan's chains
}

export interface SplitResult {
  /** Best plan for exactly k stops (index 0 = 1 stop). null if no combo of that size. */
  bestByStops: (SplitPlan | null)[];
  /** Best plan overall (fewest missing items, then cheapest, then fewest stops). */
  best: SplitPlan | null;
}

export function smartSplit(input: SplitInput): SplitResult {
  const chains = [...new Set(input.chains)].sort();
  const maxStops = Math.max(1, Math.min(input.maxStops, chains.length));
  const bestByStops: (SplitPlan | null)[] = [];

  for (let k = 1; k <= maxStops; k++) {
    let bestK: SplitPlan | null = null;
    for (const combo of combinations(chains, k)) {
      const plan = planFor(combo, input.items, input.prices);
      // Only count a combo as "k stops" if every chain in it is actually used.
      if (plan.chains.length !== k) continue;
      if (!bestK || compare(plan, bestK) < 0) bestK = plan;
    }
    bestByStops.push(bestK);
  }

  let best: SplitPlan | null = null;
  for (const plan of bestByStops) {
    if (plan && (!best || compare(plan, best) < 0)) best = plan;
  }
  return { bestByStops, best };
}

function planFor(combo: ChainId[], items: ListItem[], prices: PriceTable): SplitPlan {
  const assignment: Record<ItemId, ChainId> = {};
  const missing: ItemId[] = [];
  let totalCents = 0;

  for (const item of items) {
    let bestChain: ChainId | null = null;
    let bestPrice = Infinity;
    for (const chain of combo) {
      const price = prices[item.id]?.[chain];
      // Strict "<" + sorted combo = deterministic tie-break by chain id.
      if (price !== undefined && price < bestPrice) {
        bestPrice = price;
        bestChain = chain;
      }
    }
    if (bestChain === null) {
      missing.push(item.id);
    } else {
      assignment[item.id] = bestChain;
      totalCents += bestPrice * item.qty;
    }
  }

  const used = [...new Set(Object.values(assignment))].sort();
  return { chains: used, totalCents, assignment, missing };
}

/** Fewer missing items wins, then lower total, then fewer stops, then chain ids. */
function compare(a: SplitPlan, b: SplitPlan): number {
  return (
    a.missing.length - b.missing.length ||
    a.totalCents - b.totalCents ||
    a.chains.length - b.chains.length ||
    a.chains.join(",").localeCompare(b.chains.join(","))
  );
}

function* combinations<T>(arr: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield [...acc];
    return;
  }
  for (let i = start; i < arr.length; i++) {
    acc.push(arr[i]);
    yield* combinations(arr, k, i + 1, acc);
    acc.pop();
  }
}
