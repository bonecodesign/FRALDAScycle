# Consulta de repasse ao vendedor — beta

## Escopo comprovado

Depois de pagamento confirmado, entrega concluída, aprovação do recebedor e validação independente, as partes autorizadas podem consultar a prontidão local do repasse ao vendedor. A consulta informa pendências, o marco de confirmação e o prazo de referência de 72 horas.

## Limite deliberado

A consulta não libera dinheiro: retorna sempre `payoutAllowed: false` e `payoutStatus: not_configured`. Ela não expõe identificadores financeiros, valores do vendedor ou referências de fornecedor. Nenhuma transferência, conciliação ou alteração do estado da operação ocorre durante a leitura.

## Evidência automatizada

`tests/seller-settlement-http-postgres.test.mjs` executa a rota privada contra PostgreSQL totalmente migrado e comprova isolamento, cabeçalhos sem cache, requisitos de prontidão, auditoria e ausência de qualquer repasse configurado.
