// Price collector entry point. Runs daily (cron on the VPS → `docker compose run --rm collector`).
// One module per chain under src/collector/<chain>.ts — added in spec 001.
// Rule: collectors are deterministic (HTTP + parsing). No AI here.

const collectors: { chain: string; run: () => Promise<number> }[] = [];

for (const c of collectors) {
  const n = await c.run();
  console.log(`✅ ${c.chain}: ${n} prices`);
}
if (collectors.length === 0) console.log("No collectors registered yet (see specs/).");

export {};
