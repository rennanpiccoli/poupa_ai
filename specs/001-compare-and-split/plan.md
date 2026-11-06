# Plano 001: Comparar a lista em 3 redes e dividir

Spec: `spec.md` · Decisões novas: [ADR 0003 — preços sob demanda + cache](../../docs/decisions/0003-on-demand-prices.md)

## Abordagem
As 3 redes usam Salesforce Commerce Cloud: a página de busca traz nome, marca e preço, e a página do produto traz o EAN no JSON-LD, exceto no Pingo Doce (detalhes em [fontes](../../docs/references/pt-supermarket-sources.md)). Toda a lógica fica em funções puras testadas com HTML real salvo como fixture: parsers, normalização de tamanho, correspondência, equivalência e Smart Split. O I/O fica numa camada fina: fetch com timeout e uma rede de cada vez por domínio, cache em Postgres.

Chave canônica de produto = `ean` quando conhecido; senão `<rede>:<sku>`. Uma correspondência do Pingo Doce (por regra ou confirmada) grava `match_ean`, e daí em diante o produto entra no Smart Split como qualquer outro.

A lista vive no aparelho (localStorage). O servidor recebe `{itens, modo, maxStops}` e devolve os planos. Não há contas.

## Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/shared/db/schema.ts` + `drizzle/` | Substituir `products`/`prices` (vazios) por `chain_products`, `search_cache`, `product_matches` |
| `src/features/catalog/` | `parse-<rede>.ts` (puro), `size.ts` (tamanho/€ por unidade), `fetch.ts` (HTTP), `search.ts` (cache + orquestração) |
| `src/features/matching/` | Correspondência entre redes: EAN → regra (marca + nome + tamanho) → ambíguo |
| `src/features/equivalence/` | "Aceito parecido" V0: nome-base + tamanho ±10%, mais barato por unidade |
| `src/features/smart-split/` | Já existe; ganha o adaptador lista → `PriceTable` |
| `src/app/api/search`, `src/app/api/compare`, `src/app/api/match` | Route handlers |
| `src/proxy.ts` | Código de acesso (cookie) para `/api/*` e páginas |
| `src/app/page.tsx` + `src/features/shopping-list/` | UI: busca, lista, seletor exato/parecido, paradas, resultado |
| `src/collector/refresh.ts` | Job diário: reconsulta as páginas dos produtos usados nos últimos 30 dias |
| `tests/fixtures/<rede>/` | HTML real reduzido (busca + produto) |

## Riscos
- 🟡 Os sites mudam o HTML → parsers isolados por rede + fixtures. Um teste que falha mostra exatamente o que mudou. Se uma rede falhar, as outras continuam.
- 🟡 Bloqueio por excesso de pedidos → cache de 24 h, 1 pedido de cada vez por rede, User-Agent normal, sem crawl completo.
- 🟡 Correspondência errada no Pingo Doce (produto diferente tomado pelo mesmo) → exige marca igual + tamanho igual + nome-base com alta semelhança. Abaixo disso, o usuário confirma.
- 🟢 Smart Split → já é exato e testado.
- 🟡 VPS exposta → código de acesso + o app só escuta em `127.0.0.1`, atrás do Caddy com HTTPS.

## Testes
- Unitários (fixtures): parser de cada rede extrai nome/marca/preço/sku/url, e EAN onde existir.
- Unitários: `parseSize("6 x 1 L")` → 6000 ml; €/unidade; tokens de nome-base.
- Unitários: o caso Mimosa liga as 3 redes; casos ambíguos devolvem "confirmar".
- Unitários: equivalência troca só com o mesmo nome-base e tamanho ±10%.
- Integração: `search()` com fetch simulado grava no Postgres e a segunda chamada vem do cache.
- Manual: uma compra real com ~20 itens, comparando o preço do app com a prateleira.
