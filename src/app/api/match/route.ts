import { z } from "zod";
import { appDeps } from "@/features/catalog/deps";
import { CHAINS } from "@/features/catalog/types";
import { confirmMatch } from "@/features/matching/resolve";

const Body = z.object({
  chain: z.enum(CHAINS),
  sku: z.string().min(1).max(32),
  key: z.string().min(1).max(64), // canonical key (EAN) of the item
  accept: z.boolean(),
});

// POST /api/match → answer to "É este?" (remembered forever, also for rejections).
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pedido inválido" }, { status: 400 });
  const { chain, sku, key, accept } = parsed.data;
  await confirmMatch(appDeps().db, chain, sku, key, accept);
  return Response.json({ ok: true });
}
