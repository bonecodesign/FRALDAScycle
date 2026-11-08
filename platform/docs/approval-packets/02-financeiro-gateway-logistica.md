# FC-GATE-FIN — Pacote decisório: pagamento, split, frete e operação financeira

**Situação em 08/11/2026:** prontidão para diligência e contratação **não iniciada**. Sem conta, credencial, preço confirmado, cobrança real, repasse, aprovação contábil ou autorização de sandbox/produção. Valores de simulação não devem ser tratados como tarifas contratuais.

## Premissas oficiais a preservar

- `docs/provider-selection.md` indica **Asaas** (pagamento) e **Lalamove** (logística) como fornecedores escolhidos para **homologação**, não contratados. Alternativas continuam sujeitas ao mesmo portão de diligência.
- As regras locais documentam: venda com comissão de produto de **8%**; troca com **2,5% por participante**; logística intermediada com **5% sobre o frete**; Premium **R$ 14,90/mês**. São regras de projeto, não prova de liquidação ou acordo com operadora.
- Processamento do produto: custo do processamento suportado pelo vendedor conforme a configuração aprovada; custo **desconhecido jamais é zero**. É preciso reconciliar preço, base de comissão, tarifa, split e líquido.
- Doação institucional **não** integra o fluxo de cobrança/frete/entregador da plataforma: a instituição organiza **retirada direta**. Essa exceção P-02 não altera vendas/trocas.
- Processamento do frete — **requisito 12 está em standby/bloqueado**, sem atribuição contratual da tarifa. Não resolver essa decisão implicitamente por código.
- **IDs relacionados:** 2, 3, 9, 10, 11, 12, 17; interface obrigatória com 18 (instituições) e 61 (seguro) quando cabível.
- Referências: `docs/provider-due-diligence.md`, `docs/provider-selection.md`, `docs/card-billing-identity-preactivation.md`, `docs/finance/modelo-economico-financeiro-v1.md`, `tests/logistics-commission-conservation.test.mjs`, `tests/delivery-quote-http-postgres.test.mjs`, `tests/exchange-http-postgres.test.mjs`.

## Decisões a documentar antes de usar um provedor

| Portão | Decisão exigida | Prova e responsável humano |
| --- | --- | --- |
| FIN-01 | Confirmar elegibilidade contratual e regulatória do modelo marketplace/split, titularidade de recebíveis, papel jurídico de cada participante e condições de onboarding/KYC. | Contrato e parecer jurídico/financeiro sobre arranjo aplicável, prestadores e fluxo de fundos |
| FIN-02 | Formalizar tarifas por método, tarifas extras/chargeback, calendário e regras de repartição e repasse sem deixar custos desconhecidos como zero. | Proposta comercial atual, tabela assinada, cenários de centavos/arredondamento, versão e vigência |
| FIN-03 | Homologar Pix e cartão, antifraude/3DS, titularidade, tokenização, idempotência, retries e recusas; igualdade de CPF **não** demonstra titularidade do cartão. | Especificação de integração, cenários negativos e resultado de sandbox **somente após autorização separada** |
| FIN-04 | Definir retenção/liberação, provas de entrega, disputas, estornos, chargebacks, cancelamentos e responsabilidades do provedor vs plataforma. | Matriz de evento → efeito financeiro → razão de bloqueio → reconciliação → responsabilidade |
| FIN-05 | Validar, por operação, cotação, entrega, pagamento do frete, duas pernas de troca, 5% de comissão e reconhecimento do repasse; processamento de frete permanece standby até decisão. | Checklist de conservação, valores sintéticos, trilha auditável e contrato de logística |
| FIN-06 | Definir competência, emissão de documentos fiscais, tributação, responsabilidades contábeis e enquadramento do **CNPJ próprio ainda a preencher**. | Parecer contábil-fiscal e documentação cadastral privada, nunca dados fiscais sensíveis no Git |
| FIN-07 | Aprovar limites de risco, conciliação diária, alertas, reservas para estorno, segregação de funções e plano de saída/portabilidade. | Procedimento de fechamento financeiro, responsável titular/suplente, testes de falha e contratos de saída |

**Referência pública de diligência**, não parecer sobre o enquadramento jurídico da FraldaCycle: o [Banco Central descreve a vinculação contratual de subcredenciadores aos arranjos](https://www.bcb.gov.br/meubc/faqs/p/os-subcredenciadores-sao-regulados-e-fiscalizados-pelo-banco-central). O enquadramento real depende dos contratos, do fluxo de fundos e de avaliação especializada; não presumir que o projeto é ou não instituição regulada.

## O que o Codex pode concluir antes de existir contrato

1. Gerar **tabela de cenários sintéticos**: venda, troca com diferença, entrega por perna, falha de cotação, pagamento duplicado, reversão, payout suspenso e doação institucional sem frete. Conservar centavos e transições; recusar `fee=null` como `fee=0`.
2. Verificar contratos/adaptadores **desligados** para ausência de chamada de rede, segredos e transações reais; testar reentrada/ordem dos webhooks com fakes determinísticos.
3. Inventariar perguntas de diligência e campos **a confirmar pelo Asaas/Lalamove**; não afirmar capacidades reais com base apenas em mocks.
4. Produzir **checklist de reconciliação** (cobrança → taxa → split → saldo → liberação → estorno → conciliação externa) com células de provedor/valor/regra vazias até comprovação profissional.
5. Marcar toda lacuna como `AGUARDA_FORNECEDOR`, `AGUARDA_CONTABIL`, `AGUARDA_JURIDICO` ou `AGUARDA_AUTORIZACAO`; nunca substituir por dados inventados.

## Portão de ativação separado

1. Revisor financeiro, jurídico e contábil aprovam contratos, tarifas e risco. 2. O fundador **autoriza explicitamente** sandbox ou diligência real, sem que a preparação documental seja considerada essa autorização. 3. Segurança valida credenciais em cofre privado, webhook, segregação e antifraude. 4. A homologação sintética/real autorizada é repetida por operação. 5. Só nova decisão autoriza produção. Até lá: zero pagamentos/entregas externos.

**Sem promoção automática:** nenhuma aprovação foi obtida nesta rodada; a porcentagem oficial não muda.
