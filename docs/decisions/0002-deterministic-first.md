# 0002. Determinístico primeiro; IA só onde não há alternativa

Data: 2026-11-06 · Status: aceita

## Contexto
Economizar tokens é um princípio do produto (custo e previsibilidade). Quase todo o problema (identificar produto, comparar preço, achar equivalente, dividir a lista) pode ser resolvido com dados e regras.

## Opções consideradas
1. **IA como motor central** (o LLM entende a lista, compara e sugere). Prós: rápido de prototipar. Contras: caro por uso, resultados variáveis, difícil de testar.
2. **Determinístico primeiro, com IA de fallback e cache.** Prós: custo ~zero por uso, testável, resultados reproduzíveis. Contras: mais trabalho em dados e regras.

## Decisão
Opção 2. Mapa de onde cada coisa vive:

| Parte | Como | IA? |
|---|---|---|
| Identidade do produto | EAN (código de barras) | não |
| Nutrição/composição | Open Food Facts por EAN ([ref](../references/open-food-facts.md)) | não |
| "Aceito parecido" | Regras: mesma categoria + nutriente-chave/100g dentro de tolerância + menor €/kg | não |
| Smart Split | Força bruta exata sobre combinações de redes (`src/features/smart-split/`) | não |
| Preços | Collectors HTTP + parsing por rede | não |
| Texto livre → produto | Dicionário/sinônimos + busca; IA só se não houver correspondência, e o resultado vai para o dicionário | fallback |
| Foto de lista manuscrita / fatura | OCR (modelo de visão), depois parsing determinístico | sim |

## Consequências
- Cada uso de IA precisa de: justificativa na spec, cache persistente (mesma entrada → zero tokens na segunda vez) e teste com fixture.
- Os dados viram o ativo principal (dicionário, categorias, tolerâncias), e precisam ser versionados e revistos.
