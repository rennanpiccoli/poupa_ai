import { describe, expect, it } from "vitest";
import type { ChainId, ChainProduct } from "@/features/catalog/types";
import { chooseForItem, compareList, type ItemOptions } from "@/features/smart-split/compare";

const prod = (chain: ChainId, sku: string, priceCents: number, available = true): ChainProduct => ({
  chain,
  sku,
  name: sku,
  brand: null,
  priceCents,
  regularPriceCents: null,
  promoText: null,
  sizeText: "1 L",
  size: { dimension: "volume", amount: 1000, packs: 1 },
  category: null,
  url: `https://x.pt/${sku}`,
  imageUrl: null,
  available,
  ean: null,
});
const sub = (p: ChainProduct) => ({ product: p, score: 0.9, unitCents: p.priceCents });

// Leite proteína: exact = Mimosa in 3 chains; substitute = Pingo Doce own brand 1,89 €
const leite: ItemOptions = {
  id: "leite",
  qty: 2,
  mode: "exact",
  exact: {
    continente: prod("continente", "mimosa-c", 249),
    auchan: prod("auchan", "mimosa-a", 199),
    pingodoce: prod("pingodoce", "mimosa-pd", 194),
  },
  substitutes: [sub(prod("pingodoce", "pd-brand", 189)), sub(prod("continente", "c-brand", 210))],
};
const arroz: ItemOptions = {
  id: "arroz",
  qty: 1,
  mode: "exact",
  exact: { continente: prod("continente", "cigala-c", 125), auchan: prod("auchan", "cigala-a", 164) },
  substitutes: [],
};
const CHAINS: ChainId[] = ["continente", "auchan", "pingodoce"];

describe("chooseForItem", () => {
  it("exact: only the same product", () => {
    const c = chooseForItem(leite);
    expect(c.pingodoce).toMatchObject({ product: { sku: "mimosa-pd" }, substitute: false });
    expect(c.continente).toMatchObject({ product: { sku: "mimosa-c" }, substitute: false });
  });

  it("similar: cheaper substitute per chain replaces the exact one", () => {
    const c = chooseForItem({ ...leite, mode: "similar" });
    expect(c.pingodoce).toMatchObject({ product: { sku: "pd-brand" }, substitute: true });
    expect(c.continente).toMatchObject({ product: { sku: "c-brand" }, substitute: true });
    expect(c.auchan).toMatchObject({ product: { sku: "mimosa-a" }, substitute: false });
  });

  it("unavailable products are never chosen", () => {
    const c = chooseForItem({ ...arroz, exact: { continente: prod("continente", "x", 100, false) } });
    expect(c.continente).toBeUndefined();
  });
});

describe("compareList", () => {
  it("1 stop vs 2 stops with savings", () => {
    const r = compareList([leite, arroz], CHAINS, 2);
    // 1 stop: Continente 249*2+125 = 623 (Auchan 199*2+164 = 562!) → Auchan 562
    expect(r.bestByStops[0]).toMatchObject({ chains: ["auchan"], totalCents: 562 });
    // 2 stops: leite PD 194*2 + arroz C 125 = 513
    expect(r.best).toMatchObject({ chains: ["continente", "pingodoce"], totalCents: 513 });
    expect(r.savingsCents).toBe(49);
  });

  it("'similar' makes the plan cheaper and says so in the choices", () => {
    const r = compareList([{ ...leite, mode: "similar" }, arroz], CHAINS, 2);
    expect(r.best?.totalCents).toBe(189 * 2 + 125);
    expect(r.choices.leite.pingodoce?.substitute).toBe(true);
  });

  it("no savings reported when 1 stop is already the best", () => {
    const r = compareList([arroz], CHAINS, 3);
    expect(r.savingsCents).toBe(0);
  });
});
