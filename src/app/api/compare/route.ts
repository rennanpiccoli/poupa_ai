import { appDeps } from "@/features/catalog/deps";
import { compare, CompareRequest } from "@/features/shopping-list/compare-service";

// POST /api/compare { items: [{id, chain, sku, qty, mode}], maxStops } → Smart Split plans.
export async function POST(request: Request) {
  const parsed = CompareRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Pedido inválido", issues: parsed.error.issues }, { status: 400 });
  }
  return Response.json(await compare(parsed.data, appDeps()));
}
