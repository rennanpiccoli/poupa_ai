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
  meio: "meiogordo", // "meio gordo" → one token (see below)
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
  const brandWords = new Set(
    strip(brand ?? "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const text = strip(name)
    .replace(SIZE_RE, " ")
    .replace(/\bmeio[\s-]+gordo\b/g, "meiogordo")
    .replace(/\bx\b/g, " ");
  const out = new Set<string>();
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw || /^\d+$/.test(raw) || STOPWORDS.has(raw) || brandWords.has(raw)) continue;
    out.add(SYNONYMS[raw] ?? raw);
  }
  return out;
}

const weight = (t: string) => (VARIANT_WORDS.has(t) ? VARIANT_WEIGHT : 1);

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

/** Same dimension, same packs, amount within 1 % (e.g. 0.33 L ≈ 330 ml). */
export function sameSize(a: ChainProduct["size"], b: ChainProduct["size"]): boolean {
  if (!a || !b) return false;
  if (a.dimension !== b.dimension || a.packs !== b.packs) return false;
  return Math.abs(a.amount - b.amount) <= Math.max(a.amount, b.amount) * 0.01;
}

/** 0 when brand, size or fat level differ; otherwise base-name similarity. */
export function matchScore(target: ChainProduct, candidate: ChainProduct): number {
  if (!sameBrand(target.brand, candidate.brand) || !sameSize(target.size, candidate.size)) return 0;
  const a = baseTokens(target.name, target.brand);
  const b = baseTokens(candidate.name, candidate.brand);
  return fatConflict(a, b) ? 0 : similarity(a, b);
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
