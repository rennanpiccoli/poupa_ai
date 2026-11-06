import { appDeps } from "@/features/catalog/deps";
import { normalizeTerm, search } from "@/features/catalog/search";
import { unitPrice } from "@/features/catalog/size";

// GET /api/search?q=leite+proteina → products per chain (cached 24 h), with €/L·kg·un.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (normalizeTerm(q).length < 2) {
    return Response.json({ error: "Escreve pelo menos 2 letras." }, { status: 400 });
  }
  const results = await search(q, appDeps());
  const chains = Object.fromEntries(
    Object.entries(results).map(([chain, r]) => [
      chain,
      {
        ...r,
        products: r.products.map((p) => ({ ...p, unit: p.size ? unitPrice(p.priceCents, p.size) : null })),
      },
    ]),
  );
  return Response.json({ term: normalizeTerm(q), chains });
}
