# FC-370 — Conciliação financeira antes de efeitos no Premium

## Lacuna concreta
O worker asaas-reconciliation.js calculava evidence.matched, mas executava mudanças de assinatura com base somente em candidateStatus antes de verificar matched. Assim, uma resposta RECEIVED/CONFIRMED com referência ou centavos divergentes podia chegar ao serviço de ativação; OVERDUE/REFUNDED/CHARGEBACK_REQUESTED incompatíveis também podiam provocar efeitos. O ID retornado pelo provedor não era comparado ao ID solicitado antes de selecionar a assinatura.

## Correção
- Verificar provedor e identidade exata do pagamento antes de consultar contexto da assinatura.
- Interromper toda transição Premium se a evidência conciliada não corresponder, inclusive ativação, registro de período, falha inicial e renovação.
- Registrar somente evidência reduzida e motivo de bloqueio; preservar comportamento válido e contagem de efeitos.
- Não mudar tarifas, regras comerciais, standby do requisito 12 ou ativação externa.

## Testes
Dois novos testes no pipeline existente cobrem 45 combinações de estados da assinatura, estados de pagamento e divergências de referência/valor/centavos; mais seis combinações de identidade/provedor divergente para pagamentos com e sem intenção local. Nenhuma chamada real ao Asaas: clientes e repositórios sintéticos. Exigir Platform CI 5/5 na SHA exata antes do merge.

## Limites
Não comprova liquidação externa, transação atômica distribuída, ordem de webhooks ou homologação do fornecedor. Nenhum pagamento, cobrança, repasse ou assinatura real foi acionado. Requisitos 2, 3, 10, 12 mantêm estados oficiais; matriz 48/70, piloto 16/21 NO-GO. R$ 0 de novos gastos. Somente FraldaCycle; PR #333 preservado.
