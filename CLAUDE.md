# Poupa.ai (super_mkt_app)

Mobile web app (PWA) that compares supermarket prices in Portugal and splits a shopping list across 1–3 chains to save the most.
Tier: mvp · Stack: Next.js 16 (TS strict) + Postgres (Drizzle) in docker compose, deployed to a VPS · User language: pt-BR (UI: pt-PT)

## Commands
- install: `make install`
- run: `make run` (starts Postgres in docker, applies migrations, `next dev` on :3000)
- test: `make test`
- lint: `make lint` (eslint + tsc + prettier --check)
- other: `make migration` (after schema change) · `make collect` (run price collectors once) · `make build` (prod image)

## Map (read on demand, not upfront)
- Product / scope → docs/product.md
- Architecture → docs/architecture.md
- Decisions → docs/decisions/
- Learnings (check before debugging or choosing an approach) → docs/learnings.md
- Runbooks → docs/runbooks/
- External tools (docs summaries: check before searching the web) → docs/references/
- Feature specs → specs/
- Roadmap → docs/roadmap.md
- Next.js 16 has breaking changes vs training data → AGENTS.md (read `node_modules/next/dist/docs/` before writing Next code)

## Working rules
- User decides structural/costly/production changes. Ask one question at a time: recommendation + why + tiny example.
- Answer simple by default, in pt-BR; go technical only when asked.
- Right-size: cost of error decides robustness. Say plainly when robustness is needed.
- Follow existing patterns in the code before introducing new ones.
- Done = tests pass + lint clean + docs touched by the change updated.
- One fact, one home: never duplicate info across docs; link. Before editing a doc, find all mentions of the thing.
- After a validated fix/decision: offer once "Registro no learnings?". Seen twice → offer promotion to Rules below.
- No secrets in git or docs. `.env` + `.env.example`.

## Project rules
- Deterministic first: no LLM call where rules/data/code can do it. Any LLM use must be cached and justified in a spec. → docs/decisions/0002-deterministic-first.md
- Product key = EAN (barcode). Money = integer cents. Never floats for money.
- Domain logic in `src/features/<feature>/` is pure (no I/O) and unit-tested. I/O lives in `src/shared/db`, `src/collector`, route handlers.
- Migrations are an explicit step (`make migrate` / deploy.sh), never at app startup. Keep them backward compatible (rollback restores image, not schema).

## Rules (promoted from learnings)
<!-- - Rule. → docs/learnings.md#anchor -->
