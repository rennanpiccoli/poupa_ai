import { describe, expect, it } from "vitest";
import { parseSize, toCents, unitPrice } from "@/features/catalog/size";

// Real strings seen on the chains' sites (2026-11-06).
describe("parseSize", () => {
  it.each([
    // Continente ("emb. …")
    ["emb. 1 lt", "volume", 1000, 1],
    ["emb. 2,5 lt", "volume", 2500, 1],
    ["emb. 6 x 33 cl", "volume", 1980, 6],
    ["emb. 4 x 1,5 lt", "volume", 6000, 4],
    ["emb. 250 ml", "volume", 250, 1],
    ["emb. 500 gr", "mass", 500, 1],
    ["emb. 2 kg", "mass", 2000, 1],
    ["emb. 2 x 125 gr", "mass", 250, 2],
    ["emb. 1000 gr (8 un)", "mass", 1000, 1],
    ["emb. 12 un", "count", 12, 1],
    ["emb. 432 un (9 x 48 un)", "count", 432, 1],
    // Auchan (size inside the product name)
    ["LEITE MAGRO UHT MIMOSA SEM LACTOSE +PROTEINA 1 LT", "volume", 1000, 1],
    ["AGUA MINERAL LUSO PET 6X1.5L (SDR)", "volume", 9000, 6],
    ["ÁGUA COM GÁS PEDRAS SALGADAS 6X0.33L", "volume", 1980, 6],
    ["ÁGUA DE NASCENTE AUCHAN 6 X 0.5 L", "volume", 3000, 6],
    ["IOGURTE AUCHAN GREGO NATURAL 4X150G", "mass", 600, 4],
    ["ARROZ AGULHA BOM SUCESSO 1KG", "mass", 1000, 1],
    ["TOALHITAS AUCHAN BABY COM 99% ÁGUA 3X64UN", "count", 192, 3],
    ["OVOS AUCHAN GALINHAS SOLO CLASSE XL 6UN", "count", 6, 1],
    ["OVOS D'AVOZINHA CLASSE L MEIA DÚZIA", "count", 6, 1],
    ["BOLO DOCE DE OVOS PRODUÇÃO PRÓPRIA KG", "mass", 1000, 1],
    ["CROISSANT DA CASA COM DOCE OVO PRODUÇÃO PRÓPRIA UN", "count", 1, 1],
    // Pingo Doce ("… | 1,94 €/L")
    ["1 L", "volume", 1000, 1],
    ["4 x0.25 L", "volume", 1000, 4],
    ["8 x0.17 Kg", "mass", 1360, 8],
    ["0.125 Kg", "mass", 125, 1],
  ])("%s", (text, dimension, amount, packs) => {
    expect(parseSize(text)).toEqual({ dimension, amount, packs });
  });

  it("returns null when there is no size", () => {
    expect(parseSize("Leite Proteína sem Lactose Mimosa")).toBeNull();
    expect(parseSize("Iogurte 0% gordura")).toBeNull();
  });

  it("does not read a unit glued to a word ('1 litrão', '2 grão')", () => {
    expect(parseSize("grão de bico 2 grão")).toBeNull();
  });
});

describe("unitPrice", () => {
  it("€/L for volume", () => {
    // 6 x 33 cl at 3,99 € → 3.99 / 1.98 L = 2,02 €/L
    expect(unitPrice(399, { dimension: "volume", amount: 1980, packs: 6 })).toEqual({ cents: 202, per: "L" });
  });
  it("€/kg for mass", () => {
    expect(unitPrice(129, { dimension: "mass", amount: 500, packs: 1 })).toEqual({ cents: 258, per: "kg" });
  });
  it("€/un for count", () => {
    expect(unitPrice(299, { dimension: "count", amount: 12, packs: 1 })).toEqual({ cents: 25, per: "un" });
  });
});

describe("toCents", () => {
  it.each([
    ["2.49", 249],
    ["2,49", 249],
    ["1,94 €", 194],
    [1.99, 199],
    [0.1 + 0.2, 30],
  ])("%s → %i", (input, cents) => expect(toCents(input)).toBe(cents));
  it("rejects garbage", () => expect(toCents("abc")).toBeNull());
});
