# Composição financeira do frete antes da homologação do provedor

## O que foi implementado

A rota autenticada `GET /v1/transactions/:transactionId/payment-breakdown` consulta a transação do comprador e a cotação de venda vigente, retornando apenas campos comerciais. Não retorna endereço, coordenadas ou tokens. A resposta usa `Cache-Control: no-store`.

Quando houver cotação de entrega, ela precisa estar `confirmed`, ter sido aceita pelo próprio comprador, estar dentro da validade e satisfazer a composição comercial vigente de 5% sobre o custo do parceiro ou entregador. O cálculo mantém separados:

- valor do produto;
- comissão de 8% do marketplace e líquido do vendedor, antes de eventual tarifa externa;
- valor integral do parceiro/entregador;
- comissão logística de 5% da FraldaCycle;
- valor total apresentado ao comprador.

A tarifa de processamento não é inventada: `providerProcessingFeeCents: null`. O resultado declara `externalChargeCreated: false` e `freightCheckoutBlocked: true` quando há frete. **Não cria cobrança, split remoto, repasse nem promessa de entrega.** A contratação e a homologação financeira continuam obrigatórias.

## Proteção contra cobrança incompleta

Até a integração contratual da liquidação, não é permitido criar intenção de pagamento do produto quando a transação possui cotação de entrega ativa, mesmo que o cliente tente enviar `deliveryRequested: false`. O repositório reforça essa condição sob bloqueio transacional, além do serviço. Em direção inversa, cotação nova é recusada se já existe tentativa de pagamento para a transação, inclusive quando ainda não foi paga, evitando acrescentar custo de frete a uma obrigação financeira já iniciada.

Essas restrições não se aplicam às duas pernas específicas de troca, cujas cotações e obrigações permanecem separadas e sujeitas às políticas próprias. Não altera pagamentos de venda que não possuem cotação de frete.

## Como validar

Os testes `payments.test.mjs` cobrem cálculo, autenticação, inconsistências de cotação e prevenção do bypass do cliente. O teste `freight-payment-readiness-postgres.test.mjs` valida em PostgreSQL isolado o total comercial, acesso exclusivo do comprador, bloqueio de cobrança externa e proibição de registrar cotação após iniciar o pagamento.

## O que continua faltando

Processador de pagamentos contratado e configurado; tarifa real; divisão/retenção e conciliação do frete por recebedor; idempotência de liquidação; reversões; entrega homologada e prova operacional. Os itens 2, 9 e 11 da matriz de requisitos continuam parciais até essas evidências existirem. O item 12 (processamento da tarifa financeira do frete) permanece em standby conforme a decisão comercial vigente.
