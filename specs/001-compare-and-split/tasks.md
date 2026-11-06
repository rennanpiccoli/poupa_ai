# Tarefas 001: Comparar a lista em 3 redes e dividir

Cada tarefa: pequena, testável, um commit.

- [x] 1. Fixtures: salvar HTML real (busca + 1 produto) das 3 redes em `tests/fixtures/`, reduzido ao essencial — pronto quando: os arquivos existem e estão documentados no reference card
- [x] 2. `size.ts`: interpretar o tamanho ("1 L", "6 x 1 L", "500 g", "1 kg", "12 un") e calcular €/unidade em cêntimos — pronto quando: testes passam
- [x] 3. Parsers da busca e do produto para Continente, Auchan e Pingo Doce (puros) — pronto quando: os testes com fixtures extraem sku, nome, marca, preço, url, tamanho e EAN (C/A)
- [x] 4. Schema + migration: `chain_products`, `search_cache`, `product_matches` — pronto quando: `make migrate` aplica e `drizzle-kit check` passa
- [x] 5. `fetch.ts` + `search.ts`: busca paralela nas 3 redes, timeout de 8 s, cache de 24 h, falha isolada por rede — pronto quando: teste de integração (fetch simulado + Postgres) mostra a 1ª chamada indo à "rede" e a 2ª vindo do cache
- [x] 6. Matching: EAN → regra (marca + nome-base + tamanho) → ambíguo; enriquecer o EAN pela página do produto quando faltar — pronto quando: o caso Mimosa liga as 3 redes no teste
- [x] 7. Equivalência V0 ("aceito parecido") — pronto quando: os testes mostram troca válida e recusa por tamanho/nome diferente
- [x] 8. API: `GET /api/search`, `POST /api/compare` (lista → planos 1/2/3), `POST /api/match` (confirmar correspondência) — pronto quando: teste de rota com dados semeados devolve o plano esperado
- [ ] 9. UI: busca com resultados, lista no aparelho, seletor exato/parecido, quantidade, paradas 1/2/3, resultado do Smart Split com trocas, links e datas — pronto quando: fluxo completo funciona no celular em `make run` — código pronto (commit), falta conferir no celular
- [ ] 10. Código de acesso (`src/proxy.ts` + `APP_ACCESS_CODE`) — pronto quando: sem cookie → 401 em `/api/*`, `/api/health` livre
- [ ] 11. Job diário `refresh`: reconsulta produtos usados nos últimos 30 dias — pronto quando: `make collect` atualiza o `seen_at` de produtos semeados (fetch simulado)
- [ ] 12. Pôr no ar: VPS + Caddy (HTTPS) + secrets + primeiro deploy, seguindo `docs/runbooks/deploy.md` (com o usuário) — pronto quando: o link HTTPS abre no celular e o `/api/health` dá ok
- [ ] 13. Validação real: uma compra com ~20 itens, conferir ~10 preços na prateleira; registrar o resultado no learnings — pronto quando: a pergunta "preço online = loja?" está respondida
