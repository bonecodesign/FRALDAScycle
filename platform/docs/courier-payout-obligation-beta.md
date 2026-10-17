# Obrigação de repasse ao entregador — beta

## Escopo comprovado

Para uma venda com frete já pago, entrega concluída, comprovante aprovado pelo comprador e validado por pessoa autorizada, a plataforma pode preparar uma obrigação financeira local. A preparação:

- exige confirmação administrativa explícita;
- registra o valor integral do frete;
- calcula 5% de comissão logística e 95% para o entregador;
- mantém uma única obrigação por entrega, mesmo após repetição da requisição;
- registra auditoria sem incluir credenciais ou dados do fornecedor;
- permite consulta somente pelo entregador atribuído ou por revisor autorizado.

## Limite deliberado

O estado inicial é `provider_pending`. Preparar a obrigação não transfere dinheiro, não altera o registro para `paid`, não cria referência de fornecedor e sempre retorna `payoutAllowed: false` na consulta operacional.

Transferência real, KYC do entregador, conta de destino, conciliação, tratamento de falhas e credenciais continuam bloqueados até homologação do fornecedor financeiro e da operação. Este documento não autoriza ativação em produção.

## Evidência automatizada

`tests/courier-payout-http-postgres.test.mjs` executa a rota HTTP contra o esquema PostgreSQL completo e comprova autorização, isolamento, cálculo, persistência, repetição segura, auditoria e ausência de transferência.
