# Open Food Facts — referência

Versão no projeto: API v2 (sem SDK) · Verificado em: 2026-11-06
Fontes: https://openfoodfacts.github.io/openfoodfacts-server/api/ · https://world.openfoodfacts.org/data

## O que é (para este projeto)
Base aberta de produtos alimentares por código de barras (EAN). Usamos para obter nome, marca, quantidade, categorias e nutrição por 100 g/ml, que são a base das regras de equivalência ([ADR 0002](../decisions/0002-deterministic-first.md)).

## Conceitos que usamos
- **Produto por EAN:** `GET https://world.openfoodfacts.org/api/v2/product/<ean>.json?fields=product_name,brands,quantity,categories_tags,nutriments` (✅ testado 2026-11-06).
- **Nutrientes:** em `nutriments.<nome>_100g`, ex.: `proteins_100g`, `fat_100g`, `sugars_100g` (✅ formato visto na resposta).
- **Categorias:** `categories_tags` é uma lista hierárquica (`en:...`), com tags sujas misturadas (ex.: `en:Hazelnutx`). Usar só tags da taxonomia oficial.
- **Busca por texto:** `https://pt.openfoodfacts.org/cgi/search.pl?search_terms=...&json=1` (✅ responde 200).

## Como usamos
- Enriquecer os produtos quando aparece um EAN novo (spec de equivalência nutricional, futura), e guardar o resultado no banco. Nunca consultar a API por requisição do usuário.

## Pegadinhas
- Enviar um `User-Agent` identificando a app (pedido da OFF).
- Limites de taxa para leitura e busca: ⚠️ não verificado (os valores exatos estão na doc). Fazer cache agressivo e chamadas em lote no collector.
- A cobertura de marcas próprias portuguesas pode ser incompleta: ⚠️ não verificado. Quando faltar nutrição, o item só entra como "exato".
- Licença dos dados: ODbL (atribuição + compartilhar derivados da base) ⚠️ confirmar antes de abrir ao público.

## Não coberto aqui
Escrita/edição de produtos na OFF, dumps completos (Parquet/CSV), Robotoff.
