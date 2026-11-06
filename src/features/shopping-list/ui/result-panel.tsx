"use client";

import { useState } from "react";
import { CHAIN_NAMES, CHAINS, type ChainId } from "@/features/catalog/types";
import type { ListState } from "@/features/shopping-list/list";
import { eur, seenLabel } from "@/shared/format";
import type { CompareJson } from "./api";
import { ChainBadge } from "./chain-badge";

interface Props {
  result: CompareJson;
  list: ListState;
  onAnswer: (chain: ChainId, sku: string, key: string, accept: boolean) => void;
}

export function ResultPanel({ result, list, onAnswer }: Props) {
  const plans = result.bestByStops;
  const sameAsBest = (p: (typeof plans)[number]) =>
    !!p &&
    !!result.best &&
    p.totalCents === result.best.totalCents &&
    p.chains.join() === result.best.chains.join();
  const bestIdx = Math.max(0, plans.findIndex(sameAsBest));
  const [tab, setTab] = useState(bestIdx);
  const plan = plans[tab] ?? result.best;
  const byId = new Map(list.items.map((i) => [i.id, i]));

  const questions = result.items.flatMap((item) =>
    (Object.entries(item.pending) as [ChainId, NonNullable<(typeof item.pending)[ChainId]>][]).map(
      ([chain, cands]) => ({
        item,
        chain,
        cand: cands[0],
      }),
    ),
  );

  if (!plan) return <p className="text-sm text-zinc-500">Sem preços suficientes para comparar.</p>;

  // "Everything in one store": total per chain + items it doesn't have.
  const perChain = CHAINS.map((chain) => {
    let total = 0;
    let missing = 0;
    for (const i of list.items) {
      const c = result.choices[i.id]?.[chain];
      if (c) total += c.product.priceCents * i.qty;
      else missing++;
    }
    return { chain, total, missing };
  }).filter((c) => c.missing < list.items.length);
  const cheapestFull = Math.min(...perChain.filter((c) => c.missing === 0).map((c) => c.total));

  return (
    <section className="flex flex-col gap-3">
      {plans.length > 1 && (
        <div className="flex rounded-xl bg-zinc-100 p-1 text-sm">
          {plans.map((p, idx) =>
            p ? (
              <button
                key={idx}
                onClick={() => setTab(idx)}
                className={`flex-1 rounded-lg px-2 py-2 ${tab === idx ? "bg-white font-semibold shadow-sm" : "text-zinc-500"}`}
              >
                {idx + 1} {idx === 0 ? "loja" : "lojas"}
                <span className="block text-xs font-normal">{eur(p.totalCents)}</span>
              </button>
            ) : null,
          )}
        </div>
      )}

      <div className="rounded-xl bg-emerald-600 px-4 py-3 text-white">
        <p className="text-sm opacity-90">
          Total{" "}
          {plan.chains.length > 1
            ? `em ${plan.chains.length} lojas`
            : `no ${CHAIN_NAMES[plan.chains[0] as ChainId] ?? ""}`}
        </p>
        <p className="text-3xl font-bold tabular-nums">{eur(plan.totalCents)}</p>
        {tab > 0 && plans[0] && plans[0].totalCents > plan.totalCents && (
          <p className="text-sm">Poupas {eur(plans[0].totalCents - plan.totalCents)} face a ir só a 1 loja</p>
        )}
        {plan.missing.length > 0 && (
          <p className="mt-1 text-sm">
            ⚠️ Sem preço para: {plan.missing.map((id) => byId.get(id)?.name ?? id).join(", ")}
          </p>
        )}
      </div>

      {perChain.length > 1 && (
        <div className="rounded-xl bg-white px-3 py-2">
          <p className="mb-1 text-xs font-medium text-zinc-500">Se comprasses tudo numa só loja</p>
          <ul className="flex flex-col gap-1 text-sm">
            {perChain.map(({ chain, total, missing }) => (
              <li key={chain} className="flex items-center justify-between">
                <ChainBadge chain={chain} />
                <span
                  className={`tabular-nums ${total === cheapestFull && !missing ? "font-semibold text-emerald-700" : ""}`}
                >
                  {eur(total)}
                  {missing > 0 && (
                    <span className="ml-1 text-xs text-amber-700">
                      (falta{missing > 1 ? `m ${missing}` : " 1"})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium">É o mesmo produto?</p>
          {questions.map(({ item, chain, cand }) => (
            <div key={`${item.id}-${chain}`} className="flex flex-col gap-1 text-sm">
              <p>
                <span className="text-zinc-500">{byId.get(item.id)?.name}</span> →{" "}
                <ChainBadge chain={chain} /> <b>{cand.candidate.name}</b> {cand.candidate.sizeText} ·{" "}
                {eur(cand.candidate.priceCents)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onAnswer(chain, cand.candidate.sku, item.key, true)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white"
                >
                  Sim
                </button>
                <button
                  onClick={() => onAnswer(chain, cand.candidate.sku, item.key, false)}
                  className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-zinc-300"
                >
                  Não
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {CHAINS.filter((c) => plan.chains.includes(c)).map((chain) => {
        const ids = Object.entries(plan.assignment)
          .filter(([, c]) => c === chain)
          .map(([id]) => id);
        const subtotal = ids.reduce(
          (sum, id) => sum + (result.choices[id][chain]?.product.priceCents ?? 0) * (byId.get(id)?.qty ?? 1),
          0,
        );
        return (
          <div key={chain} className="rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
              <ChainBadge chain={chain} />
              <span className="text-sm font-semibold tabular-nums">{eur(subtotal)}</span>
            </div>
            <ul className="divide-y divide-zinc-100">
              {ids.map((id) => {
                const item = byId.get(id);
                const choice = result.choices[id][chain]!;
                const p = choice.product;
                const all = CHAINS.filter((c) => result.choices[id][c]);
                return (
                  <li key={id} className="px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 underline-offset-2 hover:underline"
                      >
                        {item && item.qty > 1 && <span className="font-medium">{item.qty}× </span>}
                        {p.name} <span className="text-zinc-500">{p.sizeText}</span>
                      </a>
                      <span className="shrink-0 tabular-nums">{eur(p.priceCents)}</span>
                    </div>
                    {choice.substitute && (
                      <p className="text-xs text-emerald-700">Trocado: era {item?.name}</p>
                    )}
                    {p.regularPriceCents && (
                      <p className="text-xs text-amber-700">
                        Promoção (antes {eur(p.regularPriceCents)}){p.promoText ? ` · ${p.promoText}` : ""}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1 text-xs">
                      {all.map((c) => {
                        const ch = result.choices[id][c]!;
                        return (
                          <a
                            key={c}
                            href={ch.product.url}
                            target="_blank"
                            rel="noreferrer"
                            title={ch.product.name}
                            className={`rounded-md px-1.5 py-0.5 tabular-nums ${c === chain ? "bg-emerald-100 font-medium text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}
                          >
                            {CHAIN_NAMES[c]} {eur(ch.product.priceCents)}
                            {ch.substitute && " ≈"}
                          </a>
                        );
                      })}
                      {all.length < CHAINS.length && (
                        <span className="px-1.5 py-0.5 text-zinc-400">
                          sem em{" "}
                          {CHAINS.filter((c) => !all.includes(c))
                            .map((c) => CHAIN_NAMES[c])
                            .join(", ")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      preço visto {seenLabel(p.seenAt)}
                      {all.some((c) => result.choices[id][c]!.substitute) && " · ≈ = parecido"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
