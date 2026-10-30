# FC-DEC-2026-10-30 — Premium recorrente pelo Asaas

## Decisão aprovada

- A assinatura custa R$ 14,90 por mês e renova mensalmente no cartão tokenizado.
- O Asaas gerencia a recorrência; a FraldaCycle não recebe nem persiste PAN, validade ou CVV.
- A criação da assinatura é idempotente e sua resposta nunca concede benefícios.
- O Premium só é ativado depois que o webhook autenticado é consultado novamente no Asaas e reconciliado por referência, assinatura, valor, estado e período.
- Cancelar interrompe a próxima renovação no provedor e preserva o período já pago.
- Se o primeiro pagamento falhar, nenhum benefício é liberado. O usuário pode fazer uma nova tentativa manual com outro cartão tokenizado; antes disso, a recorrência recusada é encerrada no provedor.
- A recusa inicial é comunicada somente na área Premium do aplicativo. Não é criada mensagem de e-mail, SMS, push ou WhatsApp.
- Falhas de renovação não disparam retentativa automática. Durante a carência de três dias, os benefícios permanecem ativos e o usuário pode regularizar manualmente com outro cartão tokenizado na área Premium.
- Encerrada a carência sem pagamento, a recorrência é cancelada no Asaas e a conta retorna automaticamente ao plano gratuito. Operações em andamento continuam preservadas pelas regras de regularização existentes.

## Segurança de ativação

A integração permanece desligada por padrão. Produção exige simultaneamente `ASAAS_ENABLED=true`, `ASAAS_ENVIRONMENT=production`, credenciais externas e `ASAAS_ACTIVATION_ACKNOWLEDGED=true`. A ativação real ainda depende de contrato, homologação, webhook e tokenização do fornecedor.

## Evidências técnicas

- `apps/api/premium-subscription-service.js`
- `database/premium-subscription-repository.js`
- `database/migrations/098_premium_asaas_subscriptions.sql`
- `workers/asaas-premium-reconciliation.js`
- `tests/premium-subscription.test.mjs`
- `tests/asaas-webhook-pipeline.test.mjs`
