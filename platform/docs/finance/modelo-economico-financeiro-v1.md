# Modelo Econômico-Financeiro FraldaCycle v1

**Status:** modelo estrutural de planejamento  
**Data-base:** 22/10/2026  
**Base de código:** `fb42d70654b7fcdc0b4bd57e056c75dcd2f43126`

## 1. Objetivo

Consolidar a lógica econômica do FraldaCycle e separar rigorosamente:

1. regras comerciais já aprovadas e implementadas/documentadas;
2. hipóteses usadas para planejamento;
3. variáveis que ainda dependem de homologação, contratação ou dados reais do piloto.

Números simulados neste documento **não são resultados reais, projeções garantidas nem novas regras comerciais**.

## 2. Regras econômicas vigentes

- Venda: comissão FraldaCycle de **8%** sobre o valor do produto.
- Troca: taxa total de **5%**, economicamente dividida em **2,5% por participante** sobre o pacote oferecido por cada lado.
- Logística intermediada: comissão FraldaCycle de **5% sobre o frete**.
- Premium: **R$ 14,90/mês**.
- Plano gratuito: até **3 anúncios** conforme regras vigentes.
- Doação: **sem comissão sobre o produto**; logística segue as regras aplicáveis quando houver entrega.
- Processamento do pagamento do produto: custo do provedor deve ser apresentado no líquido do vendedor conforme a configuração homologada.

Nenhuma alteração dessas taxas é aprovada por este documento.

## 3. Equações do modelo

Receita mensal FraldaCycle:

`Receita FC = Receita vendas + Receita trocas + Receita logística + Receita Premium`

Onde:

- `Receita vendas = GMV produto × 8%`
- `Receita trocas = soma dos valores declarados dos pacotes × 2,5% por participante`
- `Receita logística = GMV fretes × 5%`
- `Receita Premium = assinantes ativos × R$ 14,90`

Estrutura de resultado:

`Receita bruta FC - custos variáveis - custos fixos = resultado operacional`

## 4. Cenário-base de planejamento

O cenário-base usado para testar a estrutura, e não como previsão, considera inicialmente:

- 1.000 usuários ativos/mês;
- crescimento de 6% ao mês;
- 0,25 venda por usuário ativo/mês;
- ticket médio de produto de R$ 70;
- 0,04 troca por usuário ativo/mês;
- valor médio de R$ 70 por pacote em troca;
- logística em 65% das operações;
- ticket médio de frete de R$ 20;
- conversão Premium de 3%;
- orçamento fixo mensal de planejamento de R$ 2.200.

Essas premissas são **editáveis e simuladas**.

## 5. Break-even preliminar

Antes de imposto, CAC e perdas/chargeback, o cenário-base indicou aproximadamente:

- receita bruta: R$ 2,26 por usuário ativo/mês;
- contribuição após referência de processamento: R$ 1,65 por usuário ativo/mês;
- break-even: cerca de **1.332 usuários ativos/mês**;
- aproximadamente **333 vendas/mês**.

Esse break-even é apenas uma referência estrutural.

### Sensibilidade fiscal isolada

Mantidas as demais condições e sem CAC/perdas:

| Alíquota de sensibilidade | Break-even aproximado | Vendas/mês |
|---|---:|---:|
| 0% | 1.332 MAU | 333 |
| 6% | 1.451 MAU | 363 |
| 10% | 1.542 MAU | 386 |
| 15,5% | 1.689 MAU | 422 |

As alíquotas são cenários de sensibilidade. O enquadramento fiscal do FraldaCycle depende de CNAE, objeto social, regime aplicável e validação contábil.

## 6. Sensibilidade da monetização

A regra vigente permanece em 8%. Simulações mostraram que aumentar conversão Premium pode reduzir o break-even sem elevar imediatamente a comissão cobrada do vendedor.

Por isso, a orientação de planejamento é:

> **manter 8% de venda + 5% logística + 5% total na troca + Premium R$14,90 durante a validação inicial, medindo os dados reais antes de qualquer alteração de monetização.**

Percentuais de venda de 9%, 10% ou 12% usados em análise são apenas cenários comparativos e **não estão aprovados**.

## 7. Variáveis ainda não homologadas

Antes de tratar o modelo como orçamento operacional definitivo, substituir hipóteses por dados verificáveis para:

- enquadramento tributário e alíquota efetiva;
- contrato e tarifas reais do gateway;
- comportamento real do split e conciliação;
- CAC por canal;
- conversão e churn Premium;
- perdas, chargeback, fraude e reembolsos;
- custos reais de infraestrutura, backup e monitoramento;
- contabilidade, jurídico, suporte e marketing;
- ticket, frequência e conversão observados no piloto.

## 8. Indicadores obrigatórios do piloto

O acompanhamento financeiro deve registrar, no mínimo:

- usuários ativos mensais (MAU);
- anunciantes e anúncios ativos;
- vendas, trocas e doações concluídas;
- GMV de produto;
- GMV de frete;
- receita por venda, troca, logística e Premium;
- take rate efetiva;
- custos de processamento;
- CAC por canal;
- conversão Premium;
- churn Premium;
- perdas/estornos/chargeback;
- margem de contribuição;
- custos fixos;
- resultado operacional;
- caixa, burn rate e runway;
- recorrência de compradores e vendedores.

## 9. Gates antes de escala

O piloto não deve ser escalado com base apenas em crescimento de usuários. Antes da expansão, revisar:

1. margem de contribuição real positiva ou trajetória demonstrável para ela;
2. CAC compatível com LTV observado;
3. enquadramento fiscal validado;
4. processamento/split/repasses conciliados;
5. perdas e chargebacks dentro da reserva prevista;
6. retenção e recorrência suficientes;
7. custos operacionais reais conhecidos;
8. break-even recalculado com dados do piloto.

## 10. Governança

- Este documento não altera contratos, taxas, código de cobrança ou regras comerciais.
- Simulações devem permanecer identificadas como simulações.
- Alterações de monetização exigem decisão explícita do fundador e atualização dos registros de decisão.
- Custos de fornecedores devem ser homologados antes de serem tratados como custos reais.
- O modelo deve ser atualizado com dados reais do piloto sem apagar o histórico das hipóteses anteriores.
