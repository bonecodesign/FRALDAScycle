# FC-305 — Prévia financeira integrada, sem ativação

**Estado:** exclusivamente simulação local em memória, sem cobrança, repasse, conta de provedor, contrato, credenciais, CNPJ preenchido ou dados pessoais reais. Piloto BH **NO-GO**.

## Regras preservadas

| Operação | Comissão FraldaCycle | Quem assume | Ressalva |
| --- | --- | --- | --- |
| Venda do produto | 8% do valor do produto | Descontada do valor do vendedor | Tarifa do processador do produto é do vendedor e permanece **desconhecida**, nunca presumida zero |
| Frete por parceiro | 5% sobre a base informada por perna | Comprador na venda, participante que recebe na troca | Não confundir base do parceiro com total pago; prestador e repasses exigem homologação |
| Troca | 2,5% do valor declarado do pacote de **cada participante** | Cada participante pela própria obrigação | A diferença entre pacotes é transferência direcional entre participantes, **não** receita da plataforma |
| Doação | Zero comissão comercial | Sem checkout de venda ou frete de marketplace | Somente retirada institucional sujeita a autorização e homologação |

## Prévia numérica (apenas exemplo fictício)

Uma venda de **R$ 100,00** e base de frete de **R$ 20,00** indica: R$ 8,00 de comissão de venda, R$ 1,00 de comissão logística e R$ 21,00 de frete cobrado ao comprador. Total indicativo do comprador: **R$ 121,00**; vendedor antes da tarifa de processamento: **R$ 92,00**; parceiro de entrega: **R$ 20,00**; plataforma: **R$ 9,00**. Tarifa real de processamento e saldo líquido do vendedor: **não determinados**.

Numa troca fictícia de pacotes declarados em R$ 90,00 e R$ 70,00, as comissões individuais são R$ 2,25 e R$ 1,75. Com bases de frete por perna de R$ 12,00 e R$ 20,00, as comissões logísticas são R$ 0,60 e R$ 1,00. A compensação de **R$ 20,00** seria de quem ofereceu o pacote de menor valor para a outra parte; não entra na comissão FraldaCycle. São **quatro obrigações distintas**, mais a eventual diferença, não uma cobrança única presumida.

## Evidência automatizada

- `packages/contracts/finance-preactivation-preview.js`: compõe os contratos monetários já existentes em prévias locais de venda, troca bilateral e doação.
- `tests/finance-preactivation-preview.test.mjs`: conservação de centavos, valores de fronteira, processamento desconhecido, duas pernas de frete, diferenças direcionais, doação sem receita e rejeição de estouro.
- A saída expõe `simulationOnly=true`, `providerReconciled=false`, `externalChargeCreated=false`, `payoutAllowed=false`, `launchAuthorized=false` e bloqueios explícitos.
- Nenhum teste é prova de split, captura, tributação, KYC, antifraude, entrega ou liquidação por provedor real.

## Portões que permanecem humanos/externos

1. Proposta comercial e tabela de tarifas verificadas, incluindo processamento do produto, do frete, chargeback, estorno e split por método.
2. Diligência jurídica/contábil com CNPJ próprio **em branco** até preenchimento autorizado, termos consumeristas e modelo fiscal aprovado.
3. Integrações de homologação com o processador e operadores logísticos, confirmação de webhooks, antifraude, sandbox, reconciliação e idempotência.
4. Duas pernas da troca comprovadas individualmente, com responsabilidade de quem recebe, aceite e compensação de diferença submetidos às regras jurídicas.
5. Responsável e suplente reais para conciliação, incidentes e rollback; evidências externas mantidas fora do Git e sem segredos.

**Não elevar o percentual da matriz de requisitos por testes sintéticos isolados.** O FC-305 prepara componentes de visualização/auditoria, mas não altera a política de liberação do piloto.
