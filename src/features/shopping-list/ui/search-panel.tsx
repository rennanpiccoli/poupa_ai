"use client";

import { useEffect, useState } from "react";
import { CHAIN_NAMES, type ChainId } from "@/features/catalog/types";
import { eur } from "@/shared/format";
import { searchProducts, type ProductJson, type SearchJson } from "./api";
import { ChainBadge } from "./chain-badge";

const MAX_RESULTS = 30;

/** Merge all chains, cheapest per L/kg/un first (products without size go last). */
function merged(data: SearchJson): ProductJson[] {
  return Object.values(data.chains)
    .flatMap((c) => c.products)
    .filter((p) => p.available)
    .sort(
      (a, b) =>
        (a.unit?.cents ?? Infinity) - (b.unit?.cents ?? Infinity) ||
        a.priceCents - b.priceCents ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_RESULTS);
}

export function SearchPanel({ onAdd }: { onAdd: (p: ProductJson) => void }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setData(await searchProducts(term, ctrl.signal));
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Erro na pesquisa");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 400); // debounce: wait until the user stops typing
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Results only make sense for the current term (≥ 2 letters); derived, not stored.
  const shown = q.trim().length >= 2 ? data : null;
  const failed = shown
    ? (Object.entries(shown.chains) as [ChainId, SearchJson["chains"][ChainId]][]).filter(
        ([, c]) => c.status === "error" || c.status === "stale",
      )
    : [];

  return (
    <section className="flex flex-col gap-3">
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Pesquisar produto (ex.: leite proteína)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
      />
      {loading && <p className="text-sm text-zinc-500">A pesquisar nas 3 lojas…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {failed.map(([chain, c]) => (
        <p key={chain} className="text-sm text-amber-700">
          {CHAIN_NAMES[chain]}{" "}
          {c.status === "stale" ? "não respondeu — a mostrar resultados anteriores" : "indisponível agora"}.
        </p>
      ))}
      {shown && !loading && merged(shown).length === 0 && (
        <p className="text-sm text-zinc-500">Sem resultados.</p>
      )}
      <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl bg-white">
        {shown &&
          merged(shown).map((p) => {
            const id = `${p.chain}:${p.sku}`;
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external chain images, no optimizer needed
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded bg-zinc-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-zinc-500">{[p.brand, p.sizeText].filter(Boolean).join(" · ")}</p>
                  <ChainBadge chain={p.chain} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{eur(p.priceCents)}</p>
                  {p.unit && (
                    <p className="text-xs text-zinc-500">
                      {eur(p.unit.cents)}/{p.unit.per}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    onAdd(p);
                    setAdded(id);
                    setTimeout(() => setAdded((a) => (a === id ? null : a)), 1200);
                  }}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white active:bg-emerald-700"
                  aria-label={`Adicionar ${p.name}`}
                >
                  {added === id ? "✓" : "+"}
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
