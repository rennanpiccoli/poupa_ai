// Package size parsing + unit price. Pure and deterministic.
// Inputs are the size strings the chains actually show (see tests for real examples):
//   Continente "emb. 6 x 33 cl" · Auchan "ÁGUA … 6X1.5L" · Pingo Doce "4 x0.25 L"

export type Dimension = "volume" | "mass" | "count";

export interface Size {
  dimension: Dimension;
  /** Total amount in base units: ml, g or units. */
  amount: number;
  /** Number of packs (6 in "6 x 1 L"). 1 when not a multipack. */
  packs: number;
}

const UNITS: Record<string, { dimension: Dimension; factor: number }> = {
  ml: { dimension: "volume", factor: 1 },
  cl: { dimension: "volume", factor: 10 },
  dl: { dimension: "volume", factor: 100 },
  l: { dimension: "volume", factor: 1000 },
  lt: { dimension: "volume", factor: 1000 },
  lts: { dimension: "volume", factor: 1000 },
  litro: { dimension: "volume", factor: 1000 },
  litros: { dimension: "volume", factor: 1000 },
  g: { dimension: "mass", factor: 1 },
  gr: { dimension: "mass", factor: 1 },
  grs: { dimension: "mass", factor: 1 },
  gramas: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  kgs: { dimension: "mass", factor: 1000 },
  un: { dimension: "count", factor: 1 },
  uni: { dimension: "count", factor: 1 },
  unid: { dimension: "count", factor: 1 },
  unidades: { dimension: "count", factor: 1 },
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join("|");
// optional "6 x" / "6x" / "6 X" multipack prefix, then amount + unit not followed by a letter
const SIZE_RE = new RegExp(String.raw`(?:(\d+)\s*[x×]\s*)?(${NUM})\s*(${UNIT})(?![\p{L}])`, "giu");

const toNumber = (s: string) => Number(s.replace(",", "."));

export function parseSize(text: string): Size | null {
  const t = text
    .toLowerCase()
    .normalize("NFC")
    .replace(/\([^)]*\)/g, " "); // "1000 gr (8 un)" → the parenthetical is a detail

  const matches = [...t.matchAll(SIZE_RE)];
  if (matches.length > 0) {
    // Sizes come at the end of product names ("… COM 99% ÁGUA 3X64UN") → take the last one.
    const m = matches[matches.length - 1];
    const packs = m[1] ? Number(m[1]) : 1;
    const unit = UNITS[m[3]];
    const amount = Math.round(packs * toNumber(m[2]) * unit.factor * 1000) / 1000;
    if (amount <= 0) return null;
    return { dimension: unit.dimension, amount, packs };
  }

  if (/\bmeia\s+d[uú]zia\b/u.test(t)) return { dimension: "count", amount: 6, packs: 1 };
  if (/\bd[uú]zia\b/u.test(t)) return { dimension: "count", amount: 12, packs: 1 };
  // Sold by weight: "BOLO … KG" with no number → price is per kg.
  if (/(?:^|\s)kg\s*$/u.test(t.trim())) return { dimension: "mass", amount: 1000, packs: 1 };
  // Sold per unit: "CROISSANT … PRODUÇÃO PRÓPRIA UN"
  if (/(?:^|\s)un\s*$/u.test(t.trim())) return { dimension: "count", amount: 1, packs: 1 };
  return null;
}

export type UnitLabel = "L" | "kg" | "un";

/** Price per litre / kg / unit, in integer cents (rounded). */
export function unitPrice(priceCents: number, size: Size): { cents: number; per: UnitLabel } {
  if (size.dimension === "count") return { cents: Math.round(priceCents / size.amount), per: "un" };
  return {
    cents: Math.round((priceCents * 1000) / size.amount),
    per: size.dimension === "volume" ? "L" : "kg",
  };
}

/** Euros string → integer cents. Accepts "2.49", "2,49", "2,49 €", 2.49. */
export function toCents(price: string | number): number | null {
  const digits = typeof price === "number" ? "" : price.replace(/[^\d.,]/g, "");
  if (typeof price === "string" && !/\d/.test(digits)) return null;
  const n = typeof price === "number" ? price : toNumber(digits);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
