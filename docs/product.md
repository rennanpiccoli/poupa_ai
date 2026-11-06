# Poupa.ai — Produto

## Problema
Fazer compras de supermercado em Portugal sem saber onde cada item está mais barato. Os preços variam por rede, e comparar à mão é inviável. Quem aceita trocar a marca por uma equivalente (mesma composição, marca própria) poupa ainda mais, mas não tem como saber qual troca vale a pena.

## Para quem
- Agora: o autor e amigos em Portugal, que fazem compras semanais.
- Depois: público geral em Portugal. O Brasil vem numa fase posterior, com um motor de dados próprio (NFC-e), ver [roadmap](roadmap.md).

## O que é (escopo)
- Lista de compras: digitada, depois por foto de lista manuscrita e por fatura antiga.
- Preço de cada item por rede, com link/fonte e data do preço.
- Por item: **"exatamente este"** ou **"aceito parecido"**. Parecido = mesma categoria, composição/nutrientes equivalentes (ex.: proteína/100g), melhor €/kg.
- **Smart Split:** melhor plano com 1 mercado (conveniência) e com até 2 ou 3 mercados (máxima poupança). O usuário configura o limite.
- Geolocalização: só as redes com loja dentro do raio escolhido entram no cálculo.
- Princípio: tudo determinístico; IA só onde não há alternativa (OCR, texto livre sem correspondência), sempre com cache. Ver [ADR 0002](decisions/0002-deterministic-first.md).

## O que NÃO é (fora de escopo, por agora)
- App nas lojas (App Store/Play). É um PWA instalável pelo navegador.
- Brasil.
- Compra/checkout ou integração com as lojas online.
- Rotas de navegação e custo de deslocação no Smart Split (ideia para depois).
- Preços por loja individual em Portugal: o preço é por rede (premissa a validar).

## Como sabemos que deu certo
- O grupo usa o app em pelo menos 1 compra por semana.
- O Smart Split mostra uma poupança ≥ 5% em relação a comprar tudo num só mercado numa lista típica (~20 itens).
- O preço mostrado bate com o da prateleira na maioria dos itens conferidos (ver `seen_at`).
