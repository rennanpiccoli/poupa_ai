"use client";

import type { Dispatch } from "react";
import type { ListAction, ListState } from "@/features/shopping-list/list";
import { ChainBadge } from "./chain-badge";

export function ListPanel({ list, dispatch }: { list: ListState; dispatch: Dispatch<ListAction> }) {
  if (list.items.length === 0) {
    return (
      <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-zinc-500">
        A lista está vazia. Pesquisa um produto e toca em <b>+</b>.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl bg-white">
      {list.items.map((i) => (
        <li key={i.id} className="flex flex-col gap-2 px-3 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{i.name}</p>
              <p className="text-xs text-zinc-500">{[i.brand, i.sizeText].filter(Boolean).join(" · ")}</p>
              <ChainBadge chain={i.chain} />
            </div>
            <button
              onClick={() => dispatch({ type: "remove", id: i.id })}
              className="text-sm text-zinc-400 active:text-red-600"
              aria-label={`Remover ${i.name}`}
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center rounded-lg border border-zinc-200">
              <button
                className="px-3 py-1 text-lg"
                onClick={() => dispatch({ type: "qty", id: i.id, qty: i.qty - 1 })}
                aria-label="Menos"
              >
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{i.qty}</span>
              <button
                className="px-3 py-1 text-lg"
                onClick={() => dispatch({ type: "qty", id: i.id, qty: i.qty + 1 })}
                aria-label="Mais"
              >
                +
              </button>
            </div>
            <div
              className="flex rounded-lg bg-zinc-100 p-0.5 text-xs"
              role="radiogroup"
              aria-label="Substituição"
            >
              {(
                [
                  ["exact", "Só este"],
                  ["similar", "Aceito parecido"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={i.mode === mode}
                  onClick={() => dispatch({ type: "mode", id: i.id, mode })}
                  className={`rounded-md px-2.5 py-1.5 ${i.mode === mode ? "bg-white font-medium shadow-sm" : "text-zinc-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
