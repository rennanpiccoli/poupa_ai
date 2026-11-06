import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARSERS } from "@/features/catalog/parsers";
import type { ChainProduct } from "@/features/catalog/types";
import {
  baseTokens,
  decideMatch,
  matchScore,
  sameSize,
  searchTermFor,
  similarity,
} from "@/features/matching/match";

const search = (chain: "continente" | "auchan" | "pingodoce") =>
  PARSERS[chain].parseSearch(readFileSync(`tests/fixtures/${chain}/search.html`, "utf8"));

const continente = search("continente");
const auchan = search("auchan");
const pingodoce = search("pingodoce");
const mimosaC = continente[0]; // Leite Proteína sem Lactose Mimosa, 1 L
const mimosaA = auchan[0]; // LEITE MAGRO UHT MIMOSA SEM LACTOSE +PROTEINA 1 LT

describe("baseTokens", () => {
  it("drops brand, size, stopwords; unifies synonyms", () => {
    expect([...baseTokens("LEITE MAGRO UHT MIMOSA SEM LACTOSE +PROTEINA 1 LT", "MIMOSA")].sort()).toEqual([
      "lactose",
      "leite",
      "magro",
      "proteina",
      "sem",
    ]);
    expect([...baseTokens("Leite Proteico com Cacau sem Lactose", "Mimosa")].sort()).toEqual([
      "cacau",
      "lactose",
      "leite",
      "proteina",
      "sem",
    ]);
    expect(baseTokens("Leite Meio Gordo Pack 6", null).has("meiogordo")).toBe(true);
  });
});

describe("similarity", () => {
  it("a flavour word weighs more than a neutral word", () => {
    const plain = baseTokens("Leite Proteína sem Lactose", null);
    expect(similarity(plain, baseTokens("Leite Proteína Magro sem Lactose", null))).toBeGreaterThan(
      similarity(plain, baseTokens("Leite Proteína Cacau sem Lactose", null)) + 0.1,
    );
  });
});

describe("sameSize", () => {
  it("0.33 L ≈ 330 ml; packs must match", () => {
    expect(
      sameSize(
        { dimension: "volume", amount: 330, packs: 1 },
        { dimension: "volume", amount: 330, packs: 1 },
      ),
    ).toBe(true);
    expect(
      sameSize(
        { dimension: "volume", amount: 750, packs: 3 },
        { dimension: "volume", amount: 750, packs: 1 },
      ),
    ).toBe(false);
    expect(
      sameSize(
        { dimension: "volume", amount: 1000, packs: 1 },
        { dimension: "mass", amount: 1000, packs: 1 },
      ),
    ).toBe(false);
  });
});

describe("decideMatch on real Pingo Doce results", () => {
  it("Mimosa Proteína 1 L (Continente) → auto-links the plain one, not the cacao one", () => {
    const d = decideMatch(mimosaC, pingodoce);
    expect(d.kind).toBe("auto");
    if (d.kind === "auto") expect(d.candidate).toMatchObject({ sku: "951765", priceCents: 194 });
  });

  it("works the same starting from the Auchan name", () => {
    const d = decideMatch(mimosaA, pingodoce);
    expect(d.kind === "auto" && d.candidate.sku).toBe("951765");
  });

  it("3 x 250 ml cacao pack → links the cacao pack (same flavour + same packs)", () => {
    const cacaoPack = continente.find((p) => /cacau/i.test(p.name))!;
    const d = decideMatch(cacaoPack, pingodoce);
    expect(d.kind === "auto" && d.candidate.sku).toBe("866780");
  });

  it("different fat levels never match; fat level on one side only is fine", () => {
    const meioGordo: ChainProduct = { ...pingodoce[0], name: "Leite Proteína Meio Gordo sem Lactose" };
    expect(matchScore(mimosaA, meioGordo)).toBe(0); // Auchan says "magro"
    expect(matchScore(mimosaC, meioGordo)).toBeGreaterThan(0.8); // Continente doesn't say
  });

  it("never links across different sizes or brands", () => {
    const other: ChainProduct = { ...pingodoce[0], brand: "Continente" };
    expect(matchScore(mimosaC, other)).toBe(0);
    const smaller: ChainProduct = { ...pingodoce[0], size: { dimension: "volume", amount: 250, packs: 1 } };
    expect(matchScore(mimosaC, smaller)).toBe(0);
  });

  it("asks when two candidates are equally plausible", () => {
    const twin: ChainProduct = { ...pingodoce[0], sku: "999" };
    const d = decideMatch(mimosaC, [pingodoce[0], twin]);
    expect(d.kind).toBe("ask");
    if (d.kind === "ask") expect(d.candidates.map((c) => c.candidate.sku)).toEqual(["951765", "999"]);
  });

  it("skips candidates the user rejected", () => {
    expect(decideMatch(mimosaC, pingodoce, new Set(["951765"])).kind).not.toBe("auto");
  });

  it("returns none when nothing is similar", () => {
    expect(decideMatch(mimosaC, []).kind).toBe("none");
  });
});

describe("searchTermFor", () => {
  it("brand + base name", () => {
    expect(searchTermFor(mimosaC)).toBe("mimosa leite proteina sem lactose");
  });
});
