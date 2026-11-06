# 0003. Preços sob demanda com cache (não catálogo completo)

Data: 2026-11-06 · Status: aceita

## Contexto
O app precisa de preços das redes online (Continente, Pingo Doce, Auchan) para funcionar já. Há duas formas de os obter: buscar quando o usuário pesquisa, ou baixar o catálogo inteiro todas as noites.

## Opções consideradas
1. **Sob demanda + cache.** A busca do usuário consulta as 3 redes na hora, o resultado é guardado por 24 h e um job diário atualiza só os produtos usados nos últimos 30 dias. Prós: usável já, poucos pedidos aos sites, a base cresce com o que o grupo compra. Contras: a primeira busca de cada termo é mais lenta (~2 s); o autocomplete só conhece o que já foi pesquisado.
2. **Catálogo completo diário.** Prós: autocomplete instantâneo e completo; "parecido" pode olhar a categoria inteira. Contras: dezenas de milhares de páginas por noite (o EAN só aparece na página do produto), coleta de horas, risco de bloqueio muito maior e mais tempo até estabilizar.

## Decisão
Opção 1. Cache em Postgres. Chave canônica de produto = EAN, ou `<rede>:<sku>` quando não há EAN (Pingo Doce, ligado por regra ou por confirmação).

## Consequências
- O collector deixa de ser "baixar tudo" e passa a ser "atualizar o que está em uso" ([arquitetura](../architecture.md)).
- Migrar para catálogo completo depois é aditivo: os mesmos parsers e tabelas servem.
- A equivalência nutricional (spec futura) vai precisar de mais candidatos por categoria. Pode ser preciso um crawl parcial por categoria nessa altura.
