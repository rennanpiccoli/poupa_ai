import type { Size } from "./size";

export const CHAINS = ["continente", "pingodoce", "auchan"] as const;
export type ChainId = (typeof CHAINS)[number];

export const CHAIN_NAMES: Record<ChainId, string> = {
  continente: "Continente",
  pingodoce: "Pingo Doce",
  auchan: "Auchan",
};

/** One product as shown by one chain. Money in integer cents. */
export interface ChainProduct {
  chain: ChainId;
  sku: string; // chain's own product id
  name: string;
  brand: string | null;
  priceCents: number; // price you pay now (promo included)
  regularPriceCents: number | null; // crossed-out price when on promo
  promoText: string | null; // e.g. "Promoção até 09/11"
  sizeText: string | null; // as shown, e.g. "emb. 6 x 33 cl"
  size: Size | null;
  category: string | null;
  url: string;
  imageUrl: string | null;
  available: boolean;
  ean: string | null; // only from product pages (and never for Pingo Doce)
}

/** What a product page adds on top of the search tile. */
export interface ProductPage {
  chain: ChainId;
  sku: string | null;
  name: string | null;
  brand: string | null;
  ean: string | null;
  priceCents: number | null;
  imageUrl: string | null;
}

export interface ChainParser {
  searchUrl(term: string): string;
  parseSearch(html: string): ChainProduct[];
  parseProduct(html: string): ProductPage;
}
