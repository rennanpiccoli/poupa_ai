// HTTP layer for the chains' sites. The only place that talks to them.
// Politeness: one request at a time per chain, browser-like User-Agent, hard timeout.
import type { ChainId } from "./types";

export type Fetcher = (chain: ChainId, url: string) => Promise<string>;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export function httpFetcher(timeoutMs = 8000): Fetcher {
  const queues = new Map<ChainId, Promise<unknown>>();

  return (chain, url) => {
    const run = async () => {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "pt-PT,pt;q=0.9" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    };
    // Chain this request after the previous one for the same chain (errors don't block the queue).
    const next = (queues.get(chain) ?? Promise.resolve()).catch(() => {}).then(run);
    queues.set(chain, next);
    return next;
  };
}
