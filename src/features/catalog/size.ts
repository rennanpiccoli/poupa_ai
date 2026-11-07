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
  /** Drained weight (canned food), total in g. Pingo Doce shows only this one as the size. */
  drained?: number;
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
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Amount used to compare prices: drained weight when known (what you actually eat). */
export const comparableAmount = (s: Size) => s.drained ?? s.amount;

export function parseSize(text: string): Size | null {
  let t = text.toLowerCase().normalize("NFC");

  // Drained weight, before parentheses are dropped:
  //   Continente "emb. 120 gr (peso escorrido 85 gr)" · Auchan "ATUM … 120 (78) G"
  let drainedRaw: number | null = null;
  const pe = t.match(new RegExp(String.raw`peso\s+escorrido\s+(${NUM})\s*(${UNIT})(?![\p{L}])`, "u"));
  if (pe && UNITS[pe[2]]?.dimension === "mass") drainedRaw = toNumber(pe[1]) * UNITS[pe[2]].factor;
  t = t.replace(
    new RegExp(String.raw`(${NUM})\s*\((${NUM})\)\s*(${UNIT})(?![\p{L}])`, "gu"),
    (_, gross, drained, unit) => {
      if (UNITS[unit]?.dimension === "mass") drainedRaw = toNumber(drained) * UNITS[unit].factor;
      return `${gross} ${unit}`;
    },
  );
  // "120GX5" (unit before the pack count) → "5 x 120 g"
  t = t.replace(new RegExp(String.raw`(${NUM})\s*(${UNIT})\s*[x×]\s*(\d+)(?![\d.,])`, "gu"), "$3 x $1 $2");
  t = t.replace(/\([^)]*\)/g, " "); // "1000 gr (8 un)" → the parenthetical is a detail

  const matches = [...t.matchAll(SIZE_RE)];
  if (matches.length > 0) {
    // Sizes come at the end of product names ("… COM 99% ÁGUA 3X64UN") → take the last one.
    const m = matches[matches.length - 1];
    const packs = m[1] ? Number(m[1]) : 1;
    const unit = UNITS[m[3]];
    const amount = round(packs * toNumber(m[2]) * unit.factor);
    if (amount <= 0) return null;
    const size: Size = { dimension: unit.dimension, amount, packs };
    if (drainedRaw !== null && unit.dimension === "mass" && drainedRaw < amount / packs + 1e-9) {
      size.drained = round(packs * drainedRaw);
    }
    return size;
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
    cents: Math.round((priceCents * 1000) / comparableAmount(size)),
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
