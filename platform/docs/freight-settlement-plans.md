# Preparação e conciliação local do frete — sem movimentação de dinheiro

## Reaproveitamento da base existente

A plataforma já possui `delivery_quotes`, cotação individual em vendas/trocas, a regra de acréscimo de 5%, `payment_intents`, obrigações locais `seller_payout_obligations` e `courier_payout_obligations`, contratos e adaptadores Asaas ainda não homologados. Esta etapa não duplica nem aciona os repasses dessas tabelas.

A migração `139_freight_settlement_plans.sql` cria apenas um snapshot comercial por cotação confirmada. Uma mesma cotação não gera dois planos, inclusive em chamadas simultâneas; o registro preserva pagador, perna de troca quando aplicável, fornecedor, preço-base, comissão e total. Não cria débito, crédito exigível ou garantia e não deve ser apresentado como comprovação de dinheiro recebido.

A regra comercial permanece: **preço-base do parceiro/entregador integral + 5% de comissão da plataforma**, sem descontar a comissão do prestador. Essa composição difere do cálculo legado de obrigações para certos cenários de entregador que exigirá ajuste no momento de vincular cobrança, comprovante e repasse ao contrato financeiro do provedor; nenhum repasse antigo é reativado nesta etapa.

## API administrativa

Somente contas com setor financeiro e nível mínimo 3 (ou fundador devidamente setorizado) podem acessar:

- `POST /v1/admin/freight-settlement-plans` com `{ "quoteId": "<uuid>", "confirmed": true }` cria de maneira idempotente o plano para uma cotação já confirmada pelo pagador correto;
- `GET /v1/admin/freight-settlement-plans/:planId/reconciliation` retorna plano, compatibilidade dos valores do pagamento local e códigos de bloqueio, sem dados de endereço e com `Cache-Control: no-store`.

Consulta pública, entregador, outros setores e funcionários abaixo do nível mínimo não têm acesso.

## Conciliação local e falhas

A avaliação diferencia:
- cotação não confirmada, substituída ou com valores alterados;
- pagamento inexistente, com estado não pago, sem referência ou múltiplos pagamentos confirmados;
- diferença entre o total cobrado e o total devido (produto + frete), comissão do produto, comissão do frete, valor devido ao vendedor e preço-base do prestador;
- disputa ou suporte financeiro pendente;
- fretes de troca por perna: snapshots independentes, cobrança individual ainda indisponível.

O campo `localMatched` indica exclusivamente consistência **local dos registros**, jamais conciliação real no processador. O resultado acrescenta obrigatoriamente `external_reconciliation_not_homologated` aos bloqueios. `providerReconciled`, `payoutAllowed` e `externalChargeCreated` permanecem sempre `false`. Nenhuma chamada a Asaas, banco, entregador ou outro serviço é feita. Não existe botão de liberação, comando de transferência, execução automática nem cobrança.

O cálculo da liquidação externa será construído sobre essas evidências, somente após contrato, tarifa, recebedores, segregação financeira, proteção contra duplicidade, webhooks, reconciliação remota, tratamento de falhas e autorização explícita.

## Validação

- `tests/freight-settlement.test.mjs`: conservação de centavos, regras de comissão, divergências, disputas, permissões e bloqueio de liberação;
- `tests/freight-settlement-postgres.test.mjs`: rotas HTTP, concorrência/idempotência, armazenamento/auditoria, cenário de venda com pagamento fictício, divergência de valor, disputa e duas pernas independentes de troca.

**Matriz preservada:** requisitos 2, 9, 11, 12 e 17 mantêm seu status até integração financeira/logística efetivamente homologada. Não alterar o denominador de 70 requisitos nem marcar a plataforma apta ao piloto.
