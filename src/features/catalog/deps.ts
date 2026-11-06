// App-wide dependencies for route handlers: the app DB + ONE shared fetcher, so the
// per-chain request queue (politeness) is shared by all requests of this server.
import { db } from "@/shared/db/client";
import { httpFetcher, type Fetcher } from "./fetch";
import type { SearchDeps } from "./search";

let fetcher: Fetcher | undefined;

export function appDeps(): SearchDeps {
  fetcher ??= httpFetcher();
  return { db: db(), fetcher };
}
