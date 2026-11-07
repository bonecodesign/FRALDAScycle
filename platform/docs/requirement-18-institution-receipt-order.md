# Requisito formal 18 — ordem de recebimento institucional e revisão do comprovante

**Status: parcial.** O sistema existente permite que o representante verificado de instituição ativa confirme o recebimento de doação e que um administrador independente valide o comprovante. As decisões são auditadas e idempotentes; continuam sem movimentação financeira ou repasse.

## Correção técnica

O fluxo de doações passa a exigir, em ordem:

1. Remessa entregue e comprovante registrado.
2. Aprovação explícita de recebimento pelo representante institucional atualmente verificado.
3. Validação do mesmo comprovante por administrador independente, somente **após** o recebimento institucional.

Antes da etapa 2, a tentativa administrativa responde `409 institution_receipt_approval_pending` e não registra validação. A mesma recusa ocorre quando o comprovante possui uma aprovação atribuída a pessoa diferente do destinatário institucional, mesmo que haja registro de aprovação persistido. Esse controle é aplicado apenas a doações e preserva os comportamentos existentes para vendas e trocas.

A consulta de prontidão operacional também identifica timestamps incoerentes: validação com horário anterior à aprovação adiciona `institution_validation_precedes_approval` e mantém `operationalRequirementsMet: false`. **Prontidão operacional local não significa recebimento físico homologado**: `requirementsMet: false` e `payoutAllowed: false` permanecem invariáveis.

## Evidências

- `tests/institution-receipt-http-postgres.test.mjs`: rejeição de validação antecipada, identidade adulterada do aprovador, confirmação idempotente da instituição, validação independente, ausência de cobranças e repasses.
- `tests/donation-service.test.mjs`: contrato de prontidão rejeita validação anterior à confirmação do recebimento, preservando o bloqueio de liquidação.

## Homologação ainda necessária

Confirmação de identidade e poderes humanos do representante, evidências reais de retirada/entrega institucional e aprovação da operação em ambiente homologado. A etapa não provisiona serviços, não cria pagamentos, não configura fornecedores, não publica externamente e não altera o protótipo.
