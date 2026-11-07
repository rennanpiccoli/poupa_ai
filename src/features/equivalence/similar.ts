// "Aceito parecido" V0 (spec 001, task 7). Pure and deterministic — no AI, no nutrition data yet.
// A substitute must have: the same base name without brand (similarity ≥ SIMILAR_SCORE, no flavour
// or fat-level conflict), the same pack count, size within ±10 %, be available, and be cheaper per L/kg/un.
// Nutrition-based equivalence (Open Food Facts) is a later spec.
import type { ChainProduct } from "@/features/catalog/types";
import { unitPrice } from "@/features/catalog/size";
import { baseTokens, nameScore, sizesMatch } from "@/features/matching/match";

// 0.65 lets "Atum em Óleo" ≈ "Atum Posta em Óleo Vegetal"; flavour/dietary/fat words keep real
// differences far below it (see tests/similar.test.ts).
export const SIMILAR_SCORE = 0.65;
export const SIZE_TOLERANCE = 0.1;

export interface Substitute {
  product: ChainProduct;
  score: number; // base-name similarity 0..1
  unitCents: number; // €/L, €/kg or €/un in cents
}

export const sizeClose = (a: ChainProduct["size"], b: ChainProduct["size"]) =>
  sizesMatch(a, b, SIZE_TOLERANCE);

/** Cheaper-per-unit substitutes for `target`, best first. Never includes the target itself. */
export function findSubstitutes(target: ChainProduct, candidates: ChainProduct[]): Substitute[] {
  if (!target.size) return [];
  const targetUnit = unitPrice(target.priceCents, target.size).cents;
  const seen = new Set<string>();
  const out: Substitute[] = [];

  for (const c of candidates) {
    const id = `${c.chain}:${c.sku}`;
    if (seen.has(id) || (c.chain === target.chain && c.sku === target.sku)) continue;
    seen.add(id);
    if (!c.available || !c.size || !sizeClose(target.size, c.size)) continue;
    if (target.ean && c.ean === target.ean) continue; // same product in another chain: that's matching, not a swap
    const score = nameScore(target, c);
    if (score < SIMILAR_SCORE) continue;
    const unitCents = unitPrice(c.priceCents, c.size).cents;
    if (unitCents >= targetUnit) continue;
    out.push({ product: c, score, unitCents });
  }

  // Deterministic: cheapest per unit, then most similar, then chain/sku.
  return out.sort(
    (a, b) =>
      a.unitCents - b.unitCents ||
      b.score - a.score ||
      a.product.chain.localeCompare(b.product.chain) ||
      a.product.sku.localeCompare(b.product.sku),
  );
}

/** Search text for substitutes: base name without brand ("leite proteina sem lactose"). */
export function substituteSearchTerm(p: ChainProduct): string {
  return [...baseTokens(p.name, p.brand)].slice(0, 5).join(" ");
}
