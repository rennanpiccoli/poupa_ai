import { describe, expect, it } from "vitest";
import { smartSplit, type PriceTable } from "@/features/smart-split/split";

// leite 1€ / ovos 2€ / arroz 1.5€ — each chain is cheapest at something different.
const prices: PriceTable = {
  leite: { continente: 120, pingodoce: 100, auchan: 130 },
  ovos: { continente: 200, pingodoce: 250, auchan: 230 },
  arroz: { continente: 160, pingodoce: 170, auchan: 140 },
};
const chains = ["continente", "pingodoce", "auchan"];
const items = [
  { id: "leite", qty: 2 },
  { id: "ovos", qty: 1 },
  { id: "arroz", qty: 1 },
];

describe("smartSplit", () => {
  it("1 stop: picks the cheapest single chain for the whole list", () => {
    const { best } = smartSplit({ items, prices, chains, maxStops: 1 });
    // continente 120*2+200+160=600 · pingodoce 200+250+170=620 · auchan 260+230+140=630
    expect(best?.chains).toEqual(["continente"]);
    expect(best?.totalCents).toBe(600);
  });

  it("2 stops: splits the list to save more", () => {
    const { bestByStops, best } = smartSplit({ items, prices, chains, maxStops: 2 });
    // continente+pingodoce: leite PD 200 + ovos C 200 + arroz C 160 = 560
    // continente+auchan:    leite C 240 + ovos C 200 + arroz A 140 = 580
    expect(bestByStops[1]?.chains).toEqual(["continente", "pingodoce"]);
    expect(best?.totalCents).toBe(560);
    expect(best?.assignment).toEqual({ leite: "pingodoce", ovos: "continente", arroz: "continente" });
  });

  it("3 stops: uses every chain only if it is actually cheaper", () => {
    const { best } = smartSplit({ items, prices, chains, maxStops: 3 });
    // leite PD 200 + ovos C 200 + arroz A 140 = 540
    expect(best?.chains).toEqual(["auchan", "continente", "pingodoce"]);
    expect(best?.totalCents).toBe(540);
  });

  it("prefers a plan with no missing items over a cheaper incomplete one", () => {
    const p: PriceTable = { leite: { lidl: 50, continente: 120 }, ovos: { continente: 200 } };
    const { best } = smartSplit({
      items: [
        { id: "leite", qty: 1 },
        { id: "ovos", qty: 1 },
      ],
      prices: p,
      chains: ["lidl", "continente"],
      maxStops: 1,
    });
    expect(best?.chains).toEqual(["continente"]);
    expect(best?.missing).toEqual([]);
  });

  it("is deterministic on ties (alphabetical chain id)", () => {
    const p: PriceTable = { leite: { b: 100, a: 100 } };
    const { best } = smartSplit({
      items: [{ id: "leite", qty: 1 }],
      prices: p,
      chains: ["b", "a"],
      maxStops: 1,
    });
    expect(best?.chains).toEqual(["a"]);
  });
});
