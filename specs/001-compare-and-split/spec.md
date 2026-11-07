# Spec 001: Comparar a lista em 3 redes e dividir (V0 usável)

## Por quê
Primeira versão que o grupo consegue usar numa compra real: montar a lista, ver quanto custa em cada rede e onde comprar cada item para pagar menos. Ver [produto](../../docs/product.md).

## O que (comportamento esperado)
- **Buscar:** digito "leite proteina". Em ~2 s aparecem os produtos de Continente, Pingo Doce e Auchan, com nome, marca, tamanho, preço, €/L ou €/kg e link. Se alguém buscou o mesmo termo nas últimas 24 h, a resposta é instantânea (vem do cache).
- **Mesmo produto em várias redes:** adiciono "Leite Mimosa Proteína 1 L" do Continente. O app encontra o mesmo produto no Auchan (pelo EAN) e no Pingo Doce (por marca + nome + tamanho) e mostra: Continente 2,49 € · Auchan 1,99 € · Pingo Doce 1,94 €. Quando a correspondência no Pingo Doce não é clara, o app pergunta "É este?" e lembra a resposta para sempre.
- **Exato vs parecido:** cada item da lista tem um seletor. Em **"exato"**, só aquele produto. Em **"aceito parecido"**, o app pode trocar por um produto com o mesmo nome-base e tamanho de outra marca, mais barato, e mostra a troca explicitamente: "Trocado: Mimosa → Continente (–0,40 €)".
- **Smart Split:** escolho até 1, 2 ou 3 mercados. O app mostra o melhor plano para cada número de paradas, a poupança contra o melhor mercado único, e o que comprar em cada um.
- **Rede fora do ar:** se um site não responde, o resultado sai com as outras redes e o aviso "Auchan indisponível agora".
- **Acesso:** o app pede um código de acesso uma vez por aparelho, para a VPS não virar um scraper aberto a qualquer um.

## Critérios de aceite
- [ ] Buscar um termo devolve resultados das 3 redes (ou o aviso de indisponível) em ≤ 5 s sem cache e ≤ 300 ms com cache.
- [ ] Um produto com EAN no Continente/Auchan é ligado automaticamente entre essas redes.
- [ ] Um produto do Pingo Doce é ligado por regra quando há um candidato claro e, quando não há, depois de o usuário confirmar. A confirmação fica guardada.
- [ ] Os itens em "aceito parecido" podem ser trocados, e a troca aparece na tela com a diferença de preço.
- [ ] O Smart Split com 1/2/3 paradas bate com o cálculo manual numa lista de teste (testes unitários).
- [ ] A lista sobrevive a fechar e reabrir o app (fica guardada no aparelho).
- [ ] Os preços mostram a data em que foram vistos e o link da fonte.
- [ ] Um job diário atualiza os preços dos produtos usados nos últimos 30 dias.
- [ ] Sem código de acesso, `/api/*` (exceto `/api/health`) responde 401.
- [ ] No ar na VPS com HTTPS; abre no celular.

## Fora de escopo
- Geolocalização e raio (spec seguinte). Por agora, as 3 redes contam sempre.
- Equivalência nutricional (Open Food Facts). "Parecido" é por nome-base + tamanho nesta versão.
- Lidl, Aldi, Mercadona, faturas e OCR.
- Contas de usuário e listas partilhadas entre aparelhos.
- Promoções condicionadas (cartão de cliente, "leve 3 pague 2"). Usa-se o preço de prateleira mostrado.

## Perguntas em aberto
- O preço online é igual ao da loja física? Validar na primeira compra real, comparando ~10 itens.
- A busca do Pingo Doce mostra só produtos vendidos online (`onlineFlag`)? Confirmar ao implementar o parser.
