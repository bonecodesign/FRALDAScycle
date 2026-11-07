# Requisito formal 10 — conferência contábil da diferença na troca

**Status: parcial.** O FraldaCycle já possui o ciclo de diferença de valores, taxa de troca de 2,5% por participante, escolha de pagamento PIX/cartão tokenizado, tentativas, disputa, deliberação em três níveis, notificações, outbox e conciliação/retenção locais. Este complemento apenas detecta **divergências entre os registros**, sem duplicar esses fluxos.

## Conferência administrativa, somente leitura

`GET /v1/admin/freight-settlement-plans/exchanges/:transactionId/difference-accounting`

Exige setor financeiro e acesso interno nível 3 ou superior. A consulta lê uma única visão consistente em PostgreSQL dos valores declarados de cada parte, das duas taxas independentes de 2,5% e, quando existe diferença, da obrigação direcionada **da parte com pacote menos valioso para a parte com pacote mais valioso**.

O validador reprova: número errado de obrigações de taxa, participantes e anúncios incompatíveis, comissão incorreta, valores declarados inconsistentes, diferença ausente, inesperada ou com pagador/recebedor/valor incorretos. Valores iguais são tratados como **ausência legítima de obrigação de diferença**. Quando houver divergência, não apresenta valores combinados como se fossem uma cobrança válida.

Exemplo com dados fictícios:
- Solicitante declara R$ 80: taxa própria R$ 2 + diferença R$ 20 para o proprietário = **R$ 22 de obrigações locais independentes** do solicitante.
- Proprietário declara R$ 100: taxa própria R$ 2,50 e nenhuma diferença a pagar.
- As duas taxas e a diferença não são agrupadas em um checkout executável. O frete de cada perna é **separado**, conforme o requisito 9.

A consulta não retorna endereço, credenciais, dados de cartão, cobranças brutas ou informações bancárias. O retorno inclui `providerProcessingFeeCents:null`, `processingFeeHomologated:false`, `providerReconciled:false`, `externalChargeCreated:false` e `payoutAllowed:false`. O status local `paid`, caso exista em registros históricos, **não substitui evidência externa**. `localConsistent:true` significa somente coincidência contábil entre registros internos.

## Validação

`tests/exchange-difference-accounting.test.mjs` cobre arredondamento, direção da diferença, igualdade de valores, taxas e registros incoerentes, não execução e restrição ao financeiro. O cenário HTTP/PostgreSQL em `tests/exchange-http-postgres.test.mjs` comprova o resultado com uma troca sintética aceita.

As integrações reais com Asaas, contrato da retenção/garantia, taxas do processador, eventos financeiros verificados, reversões e homologação operacional permanecem bloqueadas. Nenhuma alteração do protótipo, contrato de fornecedor, credencial, cobrança ou repasse nesta etapa.
