# Requisito 3 — processamento do produto (bloqueado)

O processador financeiro não possui proposta e contrato homologados. A tarifa efetiva não é zero nem pode ser inferida do preço de venda. O vendedor absorve a tarifa de processamento, **separadamente** da comissão de 8% do marketplace. O valor líquido antes dessa tarifa não representa promessa de recebimento.

## Projeção econômica local

`projectProductProcessingCost` calcula apenas cenários em centavos. Sem tarifa comprovada, `providerProcessingFeeCents` e `sellerAfterProcessingFeeCents` são `null`. Um cenário com tarifa explícita é rotulado `simulationOnly` e nunca libera repasse. Um custo superior à parcela bruta do vendedor é bloqueado, sem resultado líquido negativo. O preview de pagamento informa que a tarifa é desconhecida e seria absorvida pelo vendedor; não envia comandos ao fornecedor.

Exemplo sintético: produto de R$ 100,00, comissão FraldaCycle R$ 8,00, parcela do vendedor antes do custo R$ 92,00. **Se** uma tarifa simulada fosse R$ 1,35, o líquido hipotético seria R$ 90,65. Essa tarifa não foi ofertada ou aprovada por nenhum processador.

## Bloqueios externos mantidos

- Proposta contratual com preço, tarifas por método, retenções, estornos, chargebacks e split; definir responsabilidade por tarifas do frete sem misturar com o item 12 em standby.
- Contrato de marketplace/pagamentos, LGPD/PCI, escrow/garantias e destinatários aptos.
- Sandbox, segurança de credenciais, reconciliação assinada de cobranças e webhooks, observabilidade, reversões e homologação com a equipe responsável.
- Aprovação expressa antes de qualquer ativação, cobrança, repasse, provisão paga ou publicação externa.

A preparação existente do Asaas, do gateway genérico, dos webhooks e da tokenização **não** equivale a contratação ou liquidação real. O requisito 3 permanece `bloqueado` até evidência externa.
