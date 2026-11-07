# Requisito formal 2 — comissão logística

**Status: parcial.** A regra é 5% sobre o custo-base do parceiro/entregador, acrescido ao total do cliente, sem reduzir a remuneração-base do transportador. O cálculo em centavos usa arredondamento determinístico, com conservação de valores. Em uma venda de R$ 100 com frete-base de R$ 20, a comissão de produto é R$ 8 e a comissão de frete é R$ 1: comprador R$ 121, vendedor R$ 92, transportador R$ 20 e plataforma R$ 9 (antes de tarifas financeiras reais).

## Evidências locais

- `commercial-rules.js`: cálculo comercial de 5%, sem tarifa de processador presumida.
- `freight-settlement.js`: snapshot e conciliação local de cotação, pagador e pagamento.
- `freight-payout-link.js`: vínculo com obrigações de repasse; parceiro externo não recebe repasse pelo fluxo de entregador próprio.
- `freight_reconciliation_incidents` e `freight_incident_supervision`: divergências auditáveis e supervisão humana.
- `logistics-commission-conservation.test.mjs`: conservação de valores, arredondamento, bloqueios de repasse e de conciliação externa.

## Condições para concluir o requisito

Homologação contratual do processador e da logística, split/tarifas reais por recebedor, evidência verificável de cobrança e liquidação externa, reversões, reconciliação idempotente e testes operacionais com fornecedor. Nenhum teste sintético substitui essas condições. **Não habilitar cobrança, repasse nem afirmar conciliação externa.** Itens 3 e 12 mantêm seus próprios bloqueios.
