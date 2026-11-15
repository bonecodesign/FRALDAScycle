# Avisos operacionais obrigatórios — fundação local

Status: implementação técnica ampliada; requisito formal 49 permanece parcial até homologação do canal externo.

## Eventos cobertos

- **Pagamento:** autorizado, confirmado, falho, reembolsado ou em disputa cria aviso interno para comprador e vendedor.
- **Entrega:** atribuição, coleta, trânsito, entrega, falha ou cancelamento cria aviso interno para os participantes da remessa.
- **Aprovação:** confirmação do recebedor e validação independente do comprovante criam avisos internos distintos.
- **Disputa e segurança:** permanecem nos fluxos específicos existentes.

Os avisos são idempotentes, não promocionais e não incluem valores, endereço, contato ou documento.

## Limites de ativação

Esta etapa não envia e-mail, SMS, push ou WhatsApp. Fornecedor, SDK, credenciais, permissão do sistema operacional, dispositivo físico, templates e homologação das categorias continuam pendentes. O aviso interno não comprova entrega externa e não autoriza produção ou piloto.

## Evidência

- `tests/paid-party-contact-http-postgres.test.mjs`: pagamento confirmado gera exatamente um aviso interno para cada parte.
- `tests/logistics.test.mjs`: transição logística gera aviso mínimo dentro da transação do webhook.
- `tests/receipt-records.test.mjs`: aprovação e validação independente geram categorias distintas sem liberar repasse.
- Migração `172_required_operational_notices.sql`: categorias necessárias são explicitamente permitidas pelo banco.
