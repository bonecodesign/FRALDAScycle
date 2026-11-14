# Requisito formal 18 — ordem de recebimento institucional e revisão do comprovante

**Status: parcial.** O sistema permite que o representante verificado de instituição ativa confirme o recebimento, que um administrador independente valide o comprovante e que o setor logístico conclua explicitamente a operação. As decisões são auditadas e idempotentes; continuam sem movimentação financeira ou repasse.

## Correção técnica

O fluxo de doações passa a exigir, em ordem:

1. Remessa entregue e comprovante registrado.
2. Aprovação explícita de recebimento pelo representante institucional atualmente verificado.
3. Validação do mesmo comprovante por administrador independente, somente **após** o recebimento institucional.
4. Confirmação administrativa final, com revalidação da autoridade institucional e ausência de ocorrência operacional aberta.

Antes da etapa 2, a tentativa administrativa responde `409 institution_receipt_approval_pending` e não registra validação. A mesma recusa ocorre quando o comprovante possui uma aprovação atribuída a pessoa diferente do destinatário institucional, mesmo que haja registro de aprovação persistido. Esse controle é aplicado apenas a doações e preserva os comportamentos existentes para vendas e trocas.

A consulta de prontidão operacional também identifica timestamps incoerentes: validação com horário anterior à aprovação adiciona `institution_validation_precedes_approval` e mantém `operationalRequirementsMet: false`. **Prontidão operacional local não significa recebimento físico homologado**: `requirementsMet: false` e `payoutAllowed: false` permanecem invariáveis.

A rota `POST /v1/shipments/:id/institutional-completion` exige o setor logístico e confirmação explícita. Ela é idempotente, muda somente a transação para `completed`, preserva a entrega e o comprovante e registra auditoria com `paymentCreated=false`, `payoutCreated=false` e `externalAction=false`. O painel administrativo exibe a ação apenas para doação já validada.

## Evidências

- `tests/institution-receipt-http-postgres.test.mjs`: rejeição de validação/conclusão antecipada, identidade adulterada do aprovador, confirmação idempotente da instituição, validação independente, conclusão idempotente e ausência de cobranças e repasses.
- `tests/donation-service.test.mjs`: contrato de prontidão rejeita validação anterior à confirmação do recebimento, preservando o bloqueio de liquidação.

## Homologação ainda necessária

Confirmação de identidade e poderes humanos do representante, evidências reais de retirada/entrega institucional e aprovação da operação em ambiente homologado. A etapa não provisiona serviços, não cria pagamentos, não configura fornecedores, não publica externamente e não altera o protótipo.
