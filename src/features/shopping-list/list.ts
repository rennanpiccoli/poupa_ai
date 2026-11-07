// Shopping list kept on the device (localStorage). Pure reducer + (de)serialization.
import type { ChainId } from "@/features/catalog/types";
import type { ItemMode } from "@/features/smart-split/compare";

export interface ListItem {
  id: string; // `${chain}:${sku}` of the product the user picked
  chain: ChainId;
  sku: string;
  name: string;
  brand: string | null;
  sizeText: string | null;
  imageUrl: string | null;
  qty: number;
  mode: ItemMode;
}

export interface ListState {
  items: ListItem[];
  maxStops: 1 | 2 | 3;
}

export const EMPTY_LIST: ListState = { items: [], maxStops: 2 };

export type ListAction =
  | { type: "add"; item: Omit<ListItem, "id" | "qty" | "mode"> }
  | { type: "remove"; id: string }
  | { type: "qty"; id: string; qty: number }
  | { type: "mode"; id: string; mode: ItemMode }
  | { type: "stops"; maxStops: 1 | 2 | 3 }
  | { type: "clear" }
  | { type: "load"; state: ListState };

const MAX_QTY = 99;

export function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "add": {
      const id = `${action.item.chain}:${action.item.sku}`;
      const existing = state.items.find((i) => i.id === id);
      if (existing) {
        // adding the same product again = one more unit
        return listReducer(state, { type: "qty", id, qty: existing.qty + 1 });
      }
      return { ...state, items: [...state.items, { ...action.item, id, qty: 1, mode: "similar" }] };
    }
    case "remove":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "qty": {
      if (action.qty < 1) return listReducer(state, { type: "remove", id: action.id });
      const qty = Math.min(MAX_QTY, Math.floor(action.qty));
      return { ...state, items: state.items.map((i) => (i.id === action.id ? { ...i, qty } : i)) };
    }
    case "mode":
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, mode: action.mode } : i)),
      };
    case "stops":
      return { ...state, maxStops: action.maxStops };
    case "clear":
      return { ...state, items: [] };
    case "load":
      return action.state;
  }
}

/** Parse what was saved on the device; anything malformed → empty list (never crash). */
export function loadList(raw: string | null): ListState {
  if (!raw) return EMPTY_LIST;
  try {
    const data = JSON.parse(raw) as Partial<ListState>;
    const items = Array.isArray(data.items)
      ? data.items.filter(
          (i): i is ListItem =>
            !!i &&
            typeof i.id === "string" &&
            typeof i.sku === "string" &&
            typeof i.name === "string" &&
            ["continente", "pingodoce", "auchan"].includes(i.chain) &&
            Number.isInteger(i.qty) &&
            i.qty >= 1 &&
            (i.mode === "exact" || i.mode === "similar"),
        )
      : [];
    const maxStops = data.maxStops === 1 || data.maxStops === 2 || data.maxStops === 3 ? data.maxStops : 2;
    return { items, maxStops };
  } catch {
    return EMPTY_LIST;
  }
}

export const STORAGE_KEY = "poupa.list.v1";
