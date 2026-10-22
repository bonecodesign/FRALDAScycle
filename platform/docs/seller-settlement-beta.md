# Consulta de repasse ao vendedor — beta

## Escopo comprovado

Depois de pagamento confirmado, entrega concluída, aprovação do recebedor e validação independente, as partes autorizadas podem consultar a prontidão local do repasse ao vendedor. A consulta informa pendências, o marco de confirmação e o prazo de referência de 72 horas.

## Limite deliberado

A janela de 72 horas é uma referência técnica local, contada a partir da decisão mais tardia; não é SLA prometido por provedor nem prazo de transferência. Silêncio, aprovação ausente ou prazo vencido nunca aprovam recebimento. A consulta retorna sempre `payoutAllowed: false` e `payoutStatus: not_configured`; não expõe identificadores financeiros, valores do vendedor ou referências de fornecedor. Nenhuma transferência, conciliação ou alteração do estado da operação ocorre durante a leitura.

## Evidência automatizada

Em 2026-10-18, `node --test tests/settlement-readiness.test.mjs tests/seller-settlement-http-postgres.test.mjs` passou com 8 testes sem skips. A prova HTTP/PostgreSQL usa aprovações sintéticas de cinco dias atrás para confirmar prazo vencido, confirmação não inferida e ausência de repasse/obrigação; também cobre isolamento, cabeçalhos sem cache e auditoria.

O contrato técnico de prazo e silêncio está concluído. Homologação futura de um SLA externo e qualquer repasse real continuam fora deste requisito e bloqueados por fornecedor/ativação (item 13).
