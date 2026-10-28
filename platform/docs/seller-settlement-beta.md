# Consulta de repasse ao vendedor — beta

## Escopo comprovado

Depois de pagamento confirmado, entrega concluída, aprovação do recebedor e validação independente, as partes autorizadas podem consultar a prontidão local do repasse ao vendedor. A consulta informa pendências, o marco de confirmação e o prazo de referência de 72 horas. Um administrador autorizado pode preparar uma obrigação local idempotente, preservando valor bruto do produto, comissão da plataforma e líquido do vendedor.

A obrigação nasce como `provider_pending`, sem referência externa e com `payoutAllowed=false`. Preparar não autoriza nem executa transferência. Pagamento divergente, disputa, ocorrência financeira, comprovante, aprovação ou validação ausentes bloqueiam a criação. A integração futura deve reler atomicamente esses estados antes de enviar qualquer ordem ao provedor.

## Limite deliberado

A janela de 72 horas é uma referência técnica local, contada a partir da decisão mais tardia; não é SLA prometido por provedor nem prazo de transferência. Silêncio, aprovação ausente ou prazo vencido nunca aprovam recebimento. A consulta retorna sempre `payoutAllowed: false` e `payoutStatus: not_configured`; não expõe identificadores financeiros, valores do vendedor ou referências de fornecedor. Nenhuma transferência, conciliação ou alteração do estado da operação ocorre durante a leitura.

## Evidência automatizada

Em 2026-10-27, `seller-settlement-http-postgres.test.mjs` comprovou consulta privada, autorização administrativa, idempotência e persistência de R$ 100,00 bruto, R$ 8,00 de plataforma e R$ 92,00 do vendedor, sem referência de provedor ou transferência. A prova usa somente fixtures sintéticas.

O contrato técnico de prazo e silêncio está concluído. Homologação futura de um SLA externo e qualquer repasse real continuam fora deste requisito e bloqueados por fornecedor/ativação (item 13).
