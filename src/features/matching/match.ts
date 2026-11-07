// "Is this the same product?" for chains without EAN (Pingo Doce). Pure and deterministic.
// Rule: same brand + same size (amount and packs) + similar base name.
// Base-name similarity is a weighted Dice score: variant words (flavours, fat level…) weigh more,
// so "Leite Proteína" vs "Leite Proteína Cacau" is clearly different.
import type { ChainProduct } from "@/features/catalog/types";

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "e",
  "a",
  "o",
  "em",
  "para",
  "emb",
  "pack",
  "embalagem",
  "uht",
  "mais",
  "un",
  "unid",
]);

/** Spelling variants → one form. */
const SYNONYMS: Record<string, string> = {
  proteico: "proteina",
  proteica: "proteina",
  proteinas: "proteina",
  pistachio: "pistacio",
  chocolate: "cacau",
  choco: "cacau",
  achocolatado: "cacau",
};

/** Words that make two products different when only one of them has it. */
const VARIANT_WORDS = new Set([
  "cacau",
  "morango",
  "baunilha",
  "cafe",
  "caramelo",
  "pistacio",
  "banana",
  "frutos",
  "vermelhos",
  "framboesa",
  "coco",
  "limao",
  "laranja",
  "manga",
  "bio",
  "zero",
  "light",
  "salgado",
  "acucarado",
]);
const VARIANT_WEIGHT = 3;

/**
 * Fat level is often implicit ("Leite Proteína" is skimmed), so having it on one side only is a
 * small difference. But two different levels (magro vs meio-gordo) = different product.
 */
const FAT_WORDS = new Set(["magro", "meiogordo", "gordo", "integral"]);

function fatConflict(a: Set<string>, b: Set<string>): boolean {
  const fa = [...a].filter((t) => FAT_WORDS.has(t));
  const fb = [...b].filter((t) => FAT_WORDS.has(t));
  return fa.length > 0 && fb.length > 0 && !fa.some((t) => fb.includes(t));
}

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const SIZE_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:ml|cl|dl|lts?|l|kgs?|kg|grs?|gr|g|un|uni)\b/g;

/** Name without brand, size, stopwords; synonyms unified. Order-independent set. */
export function baseTokens(name: string, brand: string | null): Set<string> {
  let text = ` ${strip(name)} `;
  // Remove the brand as a whole phrase ("Pingo Doce"), so "doce de leite" keeps its "doce".
  const b = strip(brand ?? "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (b)
    text = text.replace(
      new RegExp(`(^|[^a-z0-9])${b.replace(/ /g, "[^a-z0-9]+")}(?=[^a-z0-9]|$)`, "g"),
      "$1 ",
    );
  text = text
    .replace(/\(\s*[\d.,]+\s*\)/g, " ") // "120 (78) g" → "120 g" before removing the size
    .replace(SIZE_RE, " ")
    .replace(/\bm\s*\/\s*gordo\b/g, "meiogordo")
    .replace(/\bmeio[\s-]+gordo\b/g, "meiogordo")
    .replace(/\b0\s*%\s*lactose\b/g, "sem lactose")
    .replace(/\bx\b/g, " ");
  const out = new Set<string>();
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw || /^\d+$/.test(raw) || STOPWORDS.has(raw)) continue;
    out.add(SYNONYMS[raw] ?? raw);
  }
  return out;
}

/** Dietary words: "sem lactose" / "proteína" / "sem glúten" must not be swapped for the regular one. */
const DIETARY_WORDS = new Set(["proteina", "lactose", "gluten"]);
const DIETARY_WEIGHT = 2;

const weight = (t: string) =>
  VARIANT_WORDS.has(t) ? VARIANT_WEIGHT : DIETARY_WORDS.has(t) ? DIETARY_WEIGHT : 1;

/** Weighted Dice similarity of two token sets, 0..1. */
export function similarity(a: Set<string>, b: Set<string>): number {
  let common = 0;
  let total = 0;
  for (const t of a) {
    total += weight(t);
    if (b.has(t)) common += weight(t);
  }
  for (const t of b) total += weight(t);
  return total === 0 ? 0 : (2 * common) / total;
}

export const sameBrand = (a: string | null, b: string | null) =>
  !!a && !!b && strip(a).replace(/[^a-z0-9]/g, "") === strip(b).replace(/[^a-z0-9]/g, "");

/** Amounts a size can be compared by: gross and, for canned food, drained weight. */
export const comparableAmounts = (s: NonNullable<ChainProduct["size"]>) =>
  s.drained !== undefined ? [s.amount, s.drained] : [s.amount];

/**
 * Same dimension, same packs, amount within `tolerance`. Pingo Doce shows only the drained weight
 * of canned food (0.078 kg) where others show "120 gr (peso escorrido 78 gr)" → any amount may match.
 */
export function sizesMatch(a: ChainProduct["size"], b: ChainProduct["size"], tolerance: number): boolean {
  if (!a || !b || a.dimension !== b.dimension || a.packs !== b.packs) return false;
  return comparableAmounts(a).some((x) =>
    comparableAmounts(b).some((y) => Math.abs(x - y) <= Math.max(x, y) * tolerance),
  );
}

/** Same size for "same product": 1 % tolerance (0.33 L ≈ 330 ml). */
export const sameSize = (a: ChainProduct["size"], b: ChainProduct["size"]) => sizesMatch(a, b, 0.01);

const attributes = (tokens: Set<string>) =>
  [...tokens]
    .filter((t) => VARIANT_WORDS.has(t) || DIETARY_WORDS.has(t))
    .sort()
    .join(",");

/**
 * Base-name similarity ignoring brand and size. 0 when the products are incompatible:
 * different fat level, or different flavour/dietary words ("Leite Proteína" vs "… Cacau").
 * Used both for "same product" (match) and "acceptable substitute" (equivalence).
 */
export function nameScore(a: ChainProduct, b: ChainProduct): number {
  const ta = baseTokens(a.name, a.brand);
  const tb = baseTokens(b.name, b.brand);
  if (fatConflict(ta, tb) || attributes(ta) !== attributes(tb)) return 0;
  return similarity(ta, tb);
}

/** Same product? 0 when brand or size differ; otherwise nameScore (which also checks attributes). */
export function matchScore(target: ChainProduct, candidate: ChainProduct): number {
  if (!sameBrand(target.brand, candidate.brand) || !sameSize(target.size, candidate.size)) return 0;
  return nameScore(target, candidate);
}

export const AUTO_SCORE = 0.8; // link without asking
export const AUTO_MARGIN = 0.1; // …and clearly ahead of the runner-up
export const ASK_SCORE = 0.5; // below this, not even suggested

export type MatchDecision =
  | { kind: "auto"; candidate: ChainProduct; score: number }
  | { kind: "ask"; candidates: { candidate: ChainProduct; score: number }[] }
  | { kind: "none" };

export function decideMatch(
  target: ChainProduct,
  candidates: ChainProduct[],
  rejectedSkus: Set<string> = new Set(),
): MatchDecision {
  const ranked = candidates
    .filter((c) => !rejectedSkus.has(c.sku))
    .map((candidate) => ({ candidate, score: matchScore(target, candidate) }))
    .filter((x) => x.score >= ASK_SCORE)
    // deterministic: score desc, then sku asc
    .sort((x, y) => y.score - x.score || x.candidate.sku.localeCompare(y.candidate.sku));

  const [best, second] = ranked;
  if (!best) return { kind: "none" };
  if (best.score >= AUTO_SCORE && (!second || best.score - second.score >= AUTO_MARGIN)) {
    return { kind: "auto", candidate: best.candidate, score: best.score };
  }
  return { kind: "ask", candidates: ranked.slice(0, 3) };
}

/** Search text to find the same product in another chain: "mimosa leite proteina sem lactose". */
export function searchTermFor(p: ChainProduct): string {
  const tokens = [...baseTokens(p.name, p.brand)].slice(0, 5);
  return [strip(p.brand ?? ""), ...tokens].filter(Boolean).join(" ");
}
