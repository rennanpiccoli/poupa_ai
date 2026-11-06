import { CHAIN_NAMES, type ChainId } from "@/features/catalog/types";

const COLORS: Record<ChainId, string> = {
  continente: "bg-red-600",
  pingodoce: "bg-lime-600",
  auchan: "bg-rose-500",
};

export function ChainBadge({ chain }: { chain: ChainId }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600">
      <span className={`h-2 w-2 rounded-full ${COLORS[chain]}`} aria-hidden />
      {CHAIN_NAMES[chain]}
    </span>
  );
}
