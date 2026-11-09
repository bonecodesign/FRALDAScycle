# FC-GATE-FIN — Matriz de reconciliação antes da ativação (09/11/2026)

**Status:** preparo técnico para a [tarefa #230](https://github.com/bonecodesign/FRALDAScycle/issues/230), não homologação de Asaas ou Lalamove. O projeto não está autorizado a contratar, criar conta de provedor, capturar fundos, liberar repasses ou cadastrar credenciais reais nesta etapa. Piloto BH **NO-GO**.

## Invariantes de centavos

Para uma venda fictícia de produto `P` e base de frete `F` (valores positivos inteiros em centavos):

- Comissão de produto: `Cproduto = arredondar(P × 8%)`; cota local do vendedor antes do processamento: `P - Cproduto`.
- Comissão logística: `Cfrete = arredondar(F × 5%)`; total cobrado na simulação: `P + F + Cfrete`.
- Conservação local: `cota_vendedor + cota_entregador/parceiro + Cproduto + Cfrete = total_cobrado`.
- **Processamento do produto**: tarifa não homologada = **desconhecida (`null`)**, jamais `0` por conveniência. Tarifa hipotética de zero não é prova de oferta contratual nem autorização de saque.
- As reconciliações locais dos contratos retornam `providerReconciled=false`, `payoutAllowed=false` e `externalChargeCreated=false` mesmo quando todos os centavos se conservam.

O contrato [`tests/finance-preactivation-reconciliation-matrix.test.mjs`](../../tests/finance-preactivation-reconciliation-matrix.test.mjs) confirma os arredondamentos em **252 combinações** sintéticas de valores de produto e frete. O resultado é prova de cálculo local, não prova de split real no adquirente ou subadquirente.

## Testes negativos exigidos antes da diligência comercial

| Falha ou exceção | Reação que o teste exige | Dependência que continua humana |
| --- | --- | --- |
| Cotação não bloqueada, diferente ou confirmada por outra pessoa | `quote_changed_or_unconfirmed`; repasse não autorizado | Aceite do fluxo de confirmação e do contrato com parceiro |
| Base, total ou taxas fora da cotação e do plano | `plan_allocation_invalid` ou `quote_changed_or_unconfirmed` | Homologação da cotação e validade pelo provedor |
| Pagamento sem captura, sem referência de provedor ou valor divergente | `payment_not_confirmed` / `payment_split_mismatch` | Webhooks verificados, antifraude, titularidade e reconciliação externa |
| Zero ou duas capturas para o mesmo evento | `payment_cardinality_invalid` | Prova real de idempotência e processamento do parceiro |
| Disputa ou investigação financeira ativa | `financial_case_pending` | Área financeira, suporte e regras consumeristas aprovadas |
| Troca com pernas logísticas não liquidadas | `exchange_leg_payment_not_configured` | Definição formal de cobrança e separação de cada perna |
| Doação institucional tratada como venda/frete | `transaction_invalid` | Doação com retirada institucional sem cobrança, frete nem repasse |
| Custo do processador ausente ou artificialmente zero | `processor_fee_unknown` ou `processor_fee_unhomologated` | Tarifas contratadas e prova de atribuição ao vendedor |
| Tentativa de pagamento de entregador parceiro externo como entregador FC | `external_partner_courier_payout_forbidden` | Contratos, evidência de entrega e repasse pelo provedor autorizado |

**Escopo técnico:** os testes são isolados de rede e simulam eventos; não criam intenção real de cobrança, Pix, cartão, entrega ou liquidação. A presença de uma referência sintética de pagamento no teste **não equivale** à confirmação bancária.

## Perguntas objetivas para responsável jurídico, financeiro e contábil

| Portão | Questão pendente | Evidência a anexar fora do Git, quando autorizada |
| --- | --- | --- |
| FIN-01 | Quem recebe, retém, estorna e responde por valores em cada etapa? Como as partes são cadastradas? | Fluxo de fundos e cláusulas contratuais revisadas |
| FIN-02 | Quais tarifas fixas, percentuais, de antecipação, chargeback e estorno valem por método e faixa? | Proposta e tabela oficiais com vigência e assinatura |
| FIN-03 | Qual sinal autentica captura, antifraude, disputa e reconciliação? Há restrições por titularidade e KYC? | Especificação aprovada do provedor e logs autorizados de sandbox |
| FIN-04 | O que acontece com recursos em disputa, cancelamento, parcial e falha de entrega? | Modelo de responsabilidade, reservas, comunicação e prova consumerista |
| FIN-05 | Quem paga processamento do frete? Como tratar as duas pernas da troca e a exceção da doação? | Cláusulas de logística e decisão expressa sobre **requisito 12 (standby)** |
| FIN-06 | Qual entidade fiscal e regime será aplicado ao CNPJ próprio? | Parecer contábil com identificação **fora** do repositório |
| FIN-07 | Quem realiza conciliação, investiga divergência e aprova repasse/rollback? | Rotina, titular e suplente reais, trilha de auditoria, plano de saída |

**Sem ações autorizadas:** continuar com Asaas e Lalamove como candidatos **selecionados para homologação futura**; não indicar tarifas, credenciais ou capacidade externa como comprovadas. O CNPJ próprio permanece em branco.

## Próximo pacote Codex

1. Revisar webhooks, retries e concorrência com *fakes* e testes PostgreSQL controlados, diferenciando `payment initiated`, `paid`, `refunded`, `chargeback` e `financial_case_pending`.
2. Validar quatro campos em cada operação: valor do produto, frete por perna, comissão calculada e tarifa externa desconhecida, sem simular liquidação real.
3. Testar bloqueios de payout quando há diferença entre banco local e evento externo — **sem atribuir capacidade ao fornecedor**.
4. Manter todos os campos contratuais/comerciais pendentes e submeter o pacote FIN-01…07 a revisores reais, com critérios e pareceres versionados antes de qualquer ativação.

**Matriz:** permanece `42 concluídos / 70 = 60%`. Teste sintético aprovado não promove requisitos financeiros.
