# 0001. Stack: Next.js PWA + Postgres no docker compose, deploy numa VPS

Data: 2026-11-06 · Status: aceita

## Contexto
Precisa estar usável no celular imediatamente (sem esperar aprovação de loja de apps), coletar preços diariamente e ser barato de manter para um grupo pequeno, com caminho para abrir ao público.

## Opções consideradas
1. **TypeScript full: Next.js (PWA) + Postgres (Drizzle) no docker compose, numa VPS.** Prós: uma linguagem só; PWA instalável hoje; tudo num lugar (app, banco, cron); sem dependência de serviços gerenciados. A referência PT mais próxima (price-lens) também é TS. Contras: a VPS e os backups ficam por nossa conta.
2. **Next.js + Supabase + Vercel + GitHub Actions (cron).** Prós: zero servidor. Contras: três serviços externos, limites de planos grátis, banco fora do nosso controle. Descartada por preferência do usuário por Postgres no compose.
3. **Python (FastAPI + HTMX) + SQLite numa VPS.** Prós: ótimo para scraping. Contras: a experiência PWA no celular dá mais trabalho; duas linguagens se o front crescer.
4. **App nativo/React Native.** Descartado agora: as lojas de apps atrasam o "usar hoje".

## Decisão
Opção 1. Uma única imagem Docker serve o app (Next `output: standalone`) e os jobs (`collector`, `migrate`, empacotados com esbuild em `dist/`). Repo no GitHub, CI nos PRs, merge na main → imagem no GHCR (tag = commit) → `deploy/deploy.sh` na VPS, com healthcheck e rollback.

## Consequências
- Fica fácil: rodar tudo localmente igual à produção (`docker compose`), deploy com rollback, um único runtime.
- Fica difícil: backups e segurança da VPS são nossos (ver [runbook de deploy](../runbooks/deploy.md)).
- Next.js 16 tem APIs novas: consultar `node_modules/next/dist/docs/` (ver `AGENTS.md`).
