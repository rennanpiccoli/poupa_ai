"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { ChainId } from "@/features/catalog/types";
import { EMPTY_LIST, listReducer, loadList, STORAGE_KEY } from "@/features/shopping-list/list";
import { answerMatch, compareList, type CompareJson } from "./api";
import { ListPanel } from "./list-panel";
import { ResultPanel } from "./result-panel";
import { SearchPanel } from "./search-panel";

type Tab = "search" | "list" | "result";

export function ShoppingApp() {
  const [list, dispatch] = useReducer(listReducer, EMPTY_LIST);
  const [tab, setTab] = useState<Tab>("search");
  const [result, setResult] = useState<CompareJson | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  // Load the list saved on this device once, then save on every change.
  useEffect(() => {
    try {
      dispatch({ type: "load", state: loadList(localStorage.getItem(STORAGE_KEY)) });
    } catch {
      /* storage blocked: start empty */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* storage blocked: list lives only in memory */
    }
  }, [list]);

  async function runCompare() {
    setComparing(true);
    setError(null);
    try {
      setResult(await compareList(list));
      setTab("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao comparar");
    } finally {
      setComparing(false);
    }
  }

  async function answer(chain: ChainId, sku: string, key: string, accept: boolean) {
    await answerMatch(chain, sku, key, accept).catch(() => {});
    await runCompare();
  }

  const count = list.items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 bg-zinc-50/95 px-4 pt-4 pb-2 backdrop-blur">
        <h1 className="text-xl font-bold">
          Poupa<span className="text-emerald-600">.ai</span>
        </h1>
        <nav className="mt-3 flex gap-1 rounded-xl bg-zinc-200/60 p-1 text-sm">
          {(
            [
              ["search", "Pesquisar"],
              ["list", `Lista${count ? ` (${count})` : ""}`],
              ["result", "Resultado"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === "result" && !result}
              className={`flex-1 rounded-lg px-2 py-2 ${tab === t ? "bg-white font-semibold shadow-sm" : "text-zinc-600 disabled:opacity-40"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 pb-28">
        {tab === "search" && (
          <SearchPanel
            onAdd={(p) =>
              dispatch({
                type: "add",
                item: {
                  chain: p.chain,
                  sku: p.sku,
                  name: p.name,
                  brand: p.brand,
                  sizeText: p.sizeText,
                  imageUrl: p.imageUrl,
                },
              })
            }
          />
        )}
        {tab === "list" && <ListPanel list={list} dispatch={dispatch} />}
        {tab === "result" && result && <ResultPanel result={result} list={list} onAnswer={answer} />}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </main>

      {list.items.length > 0 && (
        <footer className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-zinc-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-600">Máximo de lojas</span>
            <div className="flex gap-1">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => dispatch({ type: "stops", maxStops: n })}
                  className={`h-8 w-8 rounded-lg ${list.maxStops === n ? "bg-emerald-600 text-white" : "bg-zinc-100"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={runCompare}
            disabled={comparing}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-60"
          >
            {comparing ? "A comparar preços…" : `Comparar ${count} ${count === 1 ? "produto" : "produtos"}`}
          </button>
        </footer>
      )}
    </div>
  );
}
