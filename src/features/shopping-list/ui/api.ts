// Client-side calls to our API + the JSON shapes they return.
import type { ChainSearch } from "@/features/catalog/search";
import type { ChainId, ChainProduct } from "@/features/catalog/types";
import type { CompareResponse } from "@/features/shopping-list/compare-service";
import type { ListState } from "@/features/shopping-list/list";

export type ProductJson = Omit<ChainProduct, "seenAt"> & {
  seenAt?: string;
  unit: { cents: number; per: "L" | "kg" | "un" } | null;
};

export interface SearchJson {
  term: string;
  chains: Record<ChainId, Omit<ChainSearch, "products"> & { products: ProductJson[] }>;
}

export type CompareJson = CompareResponse;

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Erro ${res.status}`);
  return body as T;
}

export async function searchProducts(q: string, signal?: AbortSignal): Promise<SearchJson> {
  return json(await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal }));
}

export async function compareList(list: ListState): Promise<CompareJson> {
  return json(
    await fetch("/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: list.items.map(({ id, chain, sku, qty, mode }) => ({ id, chain, sku, qty, mode })),
        maxStops: list.maxStops,
      }),
    }),
  );
}

export async function answerMatch(chain: ChainId, sku: string, key: string, accept: boolean) {
  return json(
    await fetch("/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chain, sku, key, accept }),
    }),
  );
}
