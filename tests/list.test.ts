import { describe, expect, it } from "vitest";
import { EMPTY_LIST, listReducer, loadList, type ListState } from "@/features/shopping-list/list";
import { eur, seenLabel } from "@/shared/format";

const leite = {
  chain: "continente" as const,
  sku: "7652960",
  name: "Leite Proteína sem Lactose Mimosa",
  brand: "Mimosa",
  sizeText: "emb. 1 lt",
  imageUrl: null,
};

describe("listReducer", () => {
  it("adds as 'similar' with qty 1; adding again increments", () => {
    let s = listReducer(EMPTY_LIST, { type: "add", item: leite });
    expect(s.items[0]).toMatchObject({ id: "continente:7652960", qty: 1, mode: "similar" });
    s = listReducer(s, { type: "add", item: leite });
    expect(s.items).toHaveLength(1);
    expect(s.items[0].qty).toBe(2);
  });

  it("qty 0 removes; qty is capped at 99", () => {
    let s = listReducer(EMPTY_LIST, { type: "add", item: leite });
    s = listReducer(s, { type: "qty", id: "continente:7652960", qty: 500 });
    expect(s.items[0].qty).toBe(99);
    s = listReducer(s, { type: "qty", id: "continente:7652960", qty: 0 });
    expect(s.items).toEqual([]);
  });

  it("mode and stops", () => {
    let s = listReducer(EMPTY_LIST, { type: "add", item: leite });
    s = listReducer(s, { type: "mode", id: "continente:7652960", mode: "exact" });
    s = listReducer(s, { type: "stops", maxStops: 3 });
    expect(s).toMatchObject({ maxStops: 3, items: [{ mode: "exact" }] });
  });
});

describe("loadList", () => {
  it("round-trips", () => {
    const s: ListState = listReducer(EMPTY_LIST, { type: "add", item: leite });
    expect(loadList(JSON.stringify(s))).toEqual(s);
  });
  it("never crashes on garbage", () => {
    expect(loadList("{nope")).toEqual(EMPTY_LIST);
    expect(loadList(JSON.stringify({ items: [{ id: 1 }], maxStops: 9 }))).toEqual(EMPTY_LIST);
    expect(loadList(null)).toEqual(EMPTY_LIST);
  });
});

describe("format", () => {
  it("eur", () => expect(eur(194).replace(/\s/g, " ")).toBe("1,94 €"));
  it("seenLabel", () => {
    const now = new Date("2026-11-06T15:00:00");
    expect(seenLabel(new Date("2026-11-06T08:00:00"), new Date(now))).toBe("hoje");
    expect(seenLabel(new Date("2026-11-05T23:00:00"), new Date(now))).toBe("ontem");
    expect(seenLabel(new Date("2026-11-03T10:00:00"), new Date(now))).toBe("há 3 dias");
  });
});
