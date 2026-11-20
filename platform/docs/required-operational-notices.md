# Avisos operacionais obrigatórios — fundação local

Status: implementação técnica ampliada; requisito formal 49 permanece parcial até homologação do canal externo.

## Eventos cobertos

- **Pagamento:** autorizado, confirmado, falho, reembolsado ou em disputa cria aviso interno e fila externa para comprador e vendedor.
- **Entrega:** atribuição, coleta, trânsito, entrega, falha ou cancelamento cria aviso interno e fila externa para os participantes da remessa.
- **Aprovação:** confirmação do recebedor e validação independente do comprovante criam avisos internos e filas externas distintas.
- **Disputa e segurança:** permanecem nos fluxos específicos existentes.

Os avisos internos são idempotentes e não promocionais. A fila externa exige e-mail verificado e conta ativa; seu payload contém exclusivamente `channel=email` e um código de evento permitido. Valores, endereço, mensagem livre, contato e documento não atravessam a fronteira do futuro fornecedor.

## Limites de ativação

Esta etapa prepara a fila, mas não envia e-mail, SMS, push ou WhatsApp reais. Fornecedor, SDK, credenciais, templates e homologação das categorias continuam pendentes. A entrega com transporte sintético não comprova entrega externa e não autoriza produção ou piloto.

## Evidência

- `tests/paid-party-contact-http-postgres.test.mjs`: pagamento confirmado gera exatamente um aviso interno para cada parte.
- `tests/logistics.test.mjs`: transição logística gera aviso mínimo dentro da transação do webhook.
- `tests/receipt-records.test.mjs`: aprovação e validação independente geram categorias distintas sem liberar repasse.
- Migração `172_required_operational_notices.sql`: categorias necessárias são explicitamente permitidas pelo banco.
- Migração `176_required_operational_notification_kind.sql`: tipo externo separado para eventos operacionais obrigatórios.
- `tests/notification-reminder-dispatch-postgres.test.mjs`: elegibilidade do e-mail verificado, envelope minimizado e transporte sintético.
