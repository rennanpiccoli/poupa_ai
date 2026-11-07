# Learnings

Só o que foi validado. Curto. Mais recente no topo.
Quando um aprendizado vira regra, ele ganha uma linha em `CLAUDE.md#rules` e continua aqui como histórico.

### 2026-11-07 · Lint passa local e falha no CI com `Cannot find name 'LayoutProps'`
**Sintoma:** `tsc` no CI: `TS2304: Cannot find name 'LayoutProps'` em `src/app/layout.tsx`; na máquina local passava.
**Causa:** `LayoutProps`/`PageProps` são tipos globais gerados pelo Next em `.next/` só durante `next dev`, `next build` ou `next typegen`. Localmente existiam porque o `next dev` tinha rodado; o CI começa de um checkout limpo.
**Fix:** script `lint` roda `next typegen` antes do `tsc --noEmit` (`package.json`). Para reproduzir o CI: checkout limpo (`git worktree add`) + `npm ci` + `npm run lint`.
**Regra?** não

### 2026-11-06 · Scripts tsx não leem o .env sozinhos
**Sintoma:** `make migrate` falhava com `DATABASE_URL` inválido, apesar de o `.env` existir.
**Causa:** o Next.js carrega o `.env` automaticamente; o `tsx` e o `drizzle-kit`, não.
**Fix:** `tsx --env-file-if-exists=.env` nos scripts do `package.json`; `process.loadEnvFile(".env")` em `drizzle.config.ts`.
**Regra?** não

<!--
### YYYY-MM-DD · título curto
**Sintoma:** o que apareceu
**Causa:** por quê
**Fix:** o que resolveu (comando / arquivo)
**Regra?** não | promovida → CLAUDE.md
-->
