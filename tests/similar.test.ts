// "Aceito parecido" with real product names/prices seen on 2026-11-06.
import { describe, expect, it } from "vitest";
import { parseSize } from "@/features/catalog/size";
import type { ChainId, ChainProduct } from "@/features/catalog/types";
import { findSubstitutes, substituteSearchTerm } from "@/features/equivalence/similar";
import { baseTokens, matchScore } from "@/features/matching/match";

let n = 0;
function p(chain: ChainId, name: string, brand: string, sizeText: string, priceCents: number): ChainProduct {
  return {
    chain,
    sku: String(++n),
    name,
    brand,
    priceCents,
    regularPriceCents: null,
    promoText: null,
    sizeText,
    size: parseSize(sizeText),
    category: null,
    url: `https://example.pt/${n}`,
    imageUrl: null,
    available: true,
    ean: null,
  };
}

// Leite meio gordo 1 L
const mimosaMG = p("continente", "Leite UHT Meio Gordo Mimosa", "Mimosa", "emb. 1 lt", 100);
const vigorFresco = p("continente", "Leite Meio Gordo Fresco Vigor", "Vigor", "emb. 1 lt", 114);
const auchanMG = p(
  "auchan",
  "LEITE UHT AUCHAN MEIO GORDO 1L",
  "AUCHAN",
  "LEITE UHT AUCHAN MEIO GORDO 1L",
  85,
);
const auchanMGsemLactose = p(
  "auchan",
  "LEITE UHT SEM LACTOSE AUCHAN MEIO GORDO 1L",
  "AUCHAN",
  "LEITE UHT SEM LACTOSE AUCHAN MEIO GORDO 1L",
  107,
);
const pdMG = p("pingodoce", "Leite UHT Meio Gordo", "Pingo Doce", "1 L", 85);
const pdMatinal = p("pingodoce", "Leite UHT Meio Gordo", "Matinal", "1 L", 100);
const continente6x1 = p("continente", "Leite UHT Meio Gordo Continente", "Continente", "emb. 6 x 1 lt", 510);
const mimosaMagro = p("pingodoce", "Leite UHT Magro", "Mimosa", "1 L", 80);
const achocolatado = p("pingodoce", "Leite Achocolatado Meio Gordo", "Pingo Doce", "1 L", 70);
const mimosaMLabel = p(
  "auchan",
  "LEITE UHT M/GORDO MIMOSA MEIO GORDO 1L",
  "MIMOSA",
  "LEITE UHT M/GORDO MIMOSA MEIO GORDO 1L",
  95,
);

const milk = [
  vigorFresco,
  auchanMG,
  auchanMGsemLactose,
  pdMG,
  pdMatinal,
  continente6x1,
  mimosaMagro,
  achocolatado,
  mimosaMLabel,
];

describe("findSubstitutes — leite meio gordo 1 L (Mimosa, 1,00 €)", () => {
  const subs = findSubstitutes(mimosaMG, milk);
  const names = subs.map((s) => `${s.product.chain}:${s.product.brand}`);
  const skus = subs.map((s) => s.product.sku);

  it("offers the store brands, cheapest first (deterministic tie by chain)", () => {
    expect(names).toEqual(["auchan:AUCHAN", "pingodoce:Pingo Doce", "auchan:MIMOSA"]);
    expect(subs[0].unitCents).toBe(85);
  });

  it("never offers: more expensive, other fat level, flavoured, lactose-free, other pack format", () => {
    for (const bad of [
      vigorFresco,
      pdMatinal,
      mimosaMagro,
      achocolatado,
      auchanMGsemLactose,
      continente6x1,
    ]) {
      expect(skus).not.toContain(bad.sku);
    }
  });
});

describe("findSubstitutes — never changes flavour or dietary attributes", () => {
  const protein = p("continente", "Leite Proteína sem Lactose Mimosa", "Mimosa", "emb. 1 lt", 249);
  const pdProtein = p("pingodoce", "Leite Magro com Proteína sem Lactose", "Pingo Doce", "1 L", 189);
  const pdCacao = p("pingodoce", "Leite Proteico com Cacau sem Lactose", "Mimosa", "1 L", 219);
  const auchanCacao = p(
    "auchan",
    "LEITE MAGRO UHT MIMOSA SEM LACTOSE + PROTEINA CACAU 1L",
    "MIMOSA",
    "LEITE MAGRO UHT MIMOSA SEM LACTOSE + PROTEINA CACAU 1L",
    219,
  );
  const regular = p("auchan", "LEITE UHT AUCHAN MAGRO 1L", "AUCHAN", "LEITE UHT AUCHAN MAGRO 1L", 80);

  it("plain protein milk → only plain protein lactose-free milk (seen live: cacao was offered)", () => {
    expect(
      findSubstitutes(protein, [pdProtein, pdCacao, auchanCacao, regular]).map((s) => s.product.sku),
    ).toEqual([pdProtein.sku]);
  });
});

describe("findSubstitutes — atum (drained weight)", () => {
  const ramirez = p(
    "continente",
    "Atum em Óleo Ramirez",
    "Ramirez",
    "emb. 120 gr (peso escorrido 78 gr)",
    198,
  );
  const contAtum = p(
    "continente",
    "Atum Posta em Óleo Vegetal Continente",
    "Continente",
    "emb. 120 gr (peso escorrido 85 gr)",
    99,
  );
  const auchanAtum = p(
    "auchan",
    "ATUM POSTA AUCHAN EM ÓLEO 120 (78) G",
    "AUCHAN",
    "ATUM POSTA AUCHAN EM ÓLEO 120 (78) G",
    93,
  );
  const pdAtum = p("pingodoce", "Atum Posta em Óleo", "Pingo Doce", "0.085 Kg", 99);
  const bigCan = p(
    "continente",
    "Atum Posta em Óleo Continente",
    "Continente",
    "emb. 385 gr (peso escorrido 250 gr)",
    274,
  );

  it("compares by drained weight and matches Pingo Doce's drained-only size", () => {
    const subs = findSubstitutes(ramirez, [contAtum, auchanAtum, pdAtum, bigCan]);
    // per drained kg: Continente 99/85 = 11,65 · Pingo Doce 99/85 = 11,65 · Auchan 93/78 = 11,92
    // tie at 11,65 → the more similar name first ("Atum Posta em Óleo" beats "… Óleo Vegetal")
    expect(subs.map((s) => s.product.chain)).toEqual(["pingodoce", "continente", "auchan"]);
    expect(subs.map((s) => s.unitCents)).toEqual([1165, 1165, 1192]);
  });

  it("same-product matching also works across gross vs drained sizes", () => {
    const pdRamirez = p("pingodoce", "Atum em Óleo", "Ramirez", "0.078 Kg", 116);
    expect(matchScore(ramirez, pdRamirez)).toBeGreaterThan(0.8);
  });
});

describe("baseTokens", () => {
  it("removes 'Pingo Doce' as a phrase — 'doce de leite' keeps its 'doce'", () => {
    expect(baseTokens("Doce de Leite Pingo Doce", "Pingo Doce")).toEqual(new Set(["doce", "leite"]));
  });
  it("normalizes M/GORDO and 0% LACTOSE", () => {
    expect(baseTokens("LEITE M/GORDO 0% LACTOSE", null)).toEqual(
      new Set(["leite", "meiogordo", "sem", "lactose"]),
    );
  });
});

describe("substituteSearchTerm", () => {
  it("base name without brand", () => {
    expect(substituteSearchTerm(mimosaMG)).toBe("leite meiogordo");
  });
});
