# Fontes de preço — supermercados em Portugal

Versão no projeto: n/a (sites externos) · Verificado em: 2026-11-06
Fontes: pesquisa web de 2026-11-06 (links abaixo)

## O que é (para este projeto)
De onde vem o preço de cada rede. Determina quais redes entram automaticamente ([ADR 0003](../decisions/0003-on-demand-prices.md)) e quais dependem de faturas dos usuários.

## Situação por rede
| Rede | Loja online com preços? | Como entra | Estado |
|---|---|---|---|
| Continente | sim | busca sob demanda + refresh | V0 |
| Pingo Doce | sim | busca sob demanda + refresh | V0 |
| Auchan | sim | busca sob demanda + refresh | V0 |
| Intermarché | sim ⚠️ não verificado | busca sob demanda + refresh | próximo |
| Minipreço | sim ⚠️ não verificado | busca sob demanda + refresh | próximo |
| Mercadona | **não** em PT; online só em Espanha ([ESM, 2024](https://www.esmmagazine.com/index.php/retail/mercadona-sees-9-sales-growth-reports-profit-in-portugal-284308)) | faturas dos usuários | próximo |
| Lidl / Aldi | sem catálogo completo com preços ⚠️ não verificado | faturas dos usuários | próximo |

## Como os sites expõem os dados (✅ testado com curl em 2026-11-06)
As 3 redes da V0 usam **Salesforce Commerce Cloud** (URLs `/on/demandware.store/Sites-<site>/...`).

| Rede | Busca | Na busca | Página do produto |
|---|---|---|---|
| Continente | `https://www.continente.pt/pesquisa/?q=<termo>` | tiles `product-tile` com `data-pid` + JSON com `name`, `brand`, `price` | JSON-LD com `gtin13` (EAN) e `price` |
| Auchan | `https://www.auchan.pt/pt/pesquisa?q=<termo>` | tiles com `data-pid` e `data-urls` (productUrl); preço/nome a confirmar no parser | JSON-LD com `gtin` (EAN) e `price` |
| Pingo Doce | `https://www.pingodoce.pt/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?q=<termo>` | tiles com `data-pid`, `<span class="value" content="1.94">`, €/L | JSON-LD **sem EAN** (só `sku`, `name`, `brand`); preço em `.sales .value[content]` |

- Exemplo real (mesmo produto, EAN 5603722522093, Leite Mimosa Proteína 1 L): Continente 2,49 € · Auchan 1,99 € · Pingo Doce 1,94 €.
- O Pingo Doce não expõe o EAN → correspondência por marca + nome-base + tamanho ([spec 001](../../specs/001-compare-and-split/spec.md)).
- Os sites respondem a um `curl` com User-Agent de navegador, sem login nem JS.
- Dados por tile na busca: Continente → `data-product-tile-impression` (JSON: name, id, price, brand, category) + texto "emb. 1 lt"; Auchan → `data-gtm` (JSON: name com tamanho, id, price, brand, category) + `data-urls`; Pingo Doce → `div.product[data-pid]` com `data-gtm-info` (JSON: item_name, item_brand, price, categorias) + texto "1 L | 1,94 €/L" e o preço antigo em promoção.
- Disponibilidade e promoções:
  - Continente: o selo "Indisponível" existe em todos os tiles; só conta quando não tem `d-none`.
  - Pingo Doce: a promoção é fiável (preço riscado em `.strike-through .value[content]` + "Promoção até DD/MM").
  - Auchan: o rótulo "Promoção" aparece em quase todos os tiles (12 de 13 na busca "arroz agulha"); **não** é sinal de promoção e é ignorado.
- Os leitores (`src/features/catalog/parse-<rede>.ts`) foram conferidos ao vivo em 2026-11-06 com "arroz agulha", "ovos", "agua" e "iogurte grego": tamanho e imagem extraídos em ~100% dos produtos.

### Fixtures de teste
`tests/fixtures/<rede>/{search,product}.html` são páginas reais reduzidas (busca "leite proteina" + 1.º produto), e `meta.json` guarda a URL e a data. Para atualizar quando um site mudar: `npm run fixtures` (script `scripts/fetch-fixtures.ts`), depois ajustar o parser até os testes passarem.

## Referências de código aberto (ler para endpoints/parsing; não copiar sem licença)
- [kiko-g/price-lens](https://github.com/kiko-g/price-lens): TS, cobre Continente/Auchan/Pingo Doce e faz match com Open Food Facts. **Sem licença visível**: só como referência.
- [pt-supermarket-scraper (PyPI)](https://pypi.org/project/pt-supermarket-scraper): Python, estado não verificado.
- [nikuscs/continentes](https://awesome.ecosyste.ms/projects/github.com%2Fnikuscs%2Fcontinentes): CLI em Rust para o Continente, MIT.
- Concorrentes: Super Save ([App Store](https://apps.apple.com/app/id1622452340)) e Preço Fresco ([4gnews](https://4gnews.pt/a-app-que-poucos-conhecem-e-compara-preco-de-supermercados-em-portugal/)).

## Pegadinhas
- O preço online pode diferir do preço da loja física; a premissa "preço por rede" está por validar ([product](../product.md)).
- Scraping para uso pessoal é aceitável. **Antes de abrir ao público, rever os termos de uso de cada site.**
- Os sites mudam sem aviso: cada rede fica num módulo isolado, e a falha de uma não para as outras ([arquitetura](../architecture.md)).
