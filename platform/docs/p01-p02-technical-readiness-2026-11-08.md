# Registro de prontidão técnica P-01 / P-02 — 08/11/2026

**Escopo:** fotografia verificável do trabalho preparado na [PR #215](https://github.com/bonecodesign/FRALDAScycle/pull/215), com auxiliares [#219](https://github.com/bonecodesign/FRALDAScycle/pull/219) e [#220](https://github.com/bonecodesign/FRALDAScycle/pull/220). **Não é homologação jurídica, parecer LGPD, autorização de lançamento ou aprovação da implementação para produção.** O piloto BH segue **NO-GO**.

## Estado das branches

- `main` verificada ao produzir este registro: `aa00998cdf7da431b9f065f3b7a60fa21ee2eeaa`. A `main` contém os controles anteriores da [PR #217](https://github.com/bonecodesign/FRALDAScycle/pull/217) (numeração de migrações) e da [PR #218](https://github.com/bonecodesign/FRALDAScycle/pull/218) (recibo explícito do adaptador e testes de API institucional).
- [PR #215](https://github.com/bonecodesign/FRALDAScycle/pull/215): **aberta e draft**, head `c37509f4bf184b4bb0f153964a819fbebc4a596f`. Foi sincronizada com a `main` acima, sem commits atrás na comparação, e mudou somente dez arquivos de `platform/`. **Não foi mesclada à `main`.**
- [PR #219](https://github.com/bonecodesign/FRALDAScycle/pull/219): integrada **somente à branch da PR #215**, head técnico de aprovação `b3ce022779dfe3766a5705fbe0393d801e274224`, merge auxiliar `e64585c0421623511dfe2aa5394522ede5dc262e`.
- [PR #220](https://github.com/bonecodesign/FRALDAScycle/pull/220): integrada **somente à branch da PR #215**, merge auxiliar `cb0ce7dc4103332061b11ab3a89f28517fca6b18`. Migração 150 validada por testes SQL com condições históricas, sem executar serviços externos.

## Evidência técnica confirmada

No head `c37509f4bf184b4bb0f153964a819fbebc4a596f`, o workflow [Platform CI — execução 42498979044](https://github.com/bonecodesign/FRALDAScycle/actions/runs/42498979044) terminou com **4/4 jobs verdes**: `foundation`, `listing-postgres`, `containers`, `browser-postgres`. O `foundation` registrou **1.237 testes (1.221 passaram, 16 pulados e zero falhas)**. Os testes PostgreSQL específicos de P-01 passaram, inclusive retenção legada, purga transacional sintética e acesso restrito pós-baixa.

### P-01 — cópia de certidão de entregador

Preparado **na branch draft**, sem executar armazenamento real:

1. `database/migrations/150_courier_clearance_verification_retention.sql` ajusta o prazo máximo para até 30 dias após a verificação, independente da validade do emissor, e torna os ponteiros de objeto/chave nulos apenas após exclusão registrada. A migração original 060 é preservada.
2. O worker exige confirmação explícita `deleted:true`, correspondência exata da referência opaca do objeto, identificador opaco de comprovante e instante válido. Resposta vazia, sucesso HTTP isolado ou objeto divergente não são comprovantes.
3. A transação PostgreSQL verifica claim e referência esperada, registra comprovante mínimo na auditoria, limpa ambos os ponteiros de armazenamento e conclui a tarefa; divergências bloqueiam a baixa. Nenhum conteúdo da certidão ou chave entra no evento.
4. O preflight de dados legados **falha por segurança** se documento em estado verificado/rejeitado/expirado não tiver decisão histórica datada. Se houver várias decisões, usa a **primeira** para não estender o prazo; não transforma datas já vencidas em datas futuras.
5. Testes `tests/courier-clearance-deletion-postgres.test.mjs` e `tests/courier-clearance-legacy-retention-postgres.test.mjs` usam dados e adaptadores sintéticos, não pessoas ou prestadores reais.

**Não comprovado:** eliminação física no armazenamento do provedor; recuperação e idempotência sob falhas da rede real; retenção de cópias de segurança; identificação e remediação legal de documentos legados sem evidência; aceites jurídicos e de privacidade. Registro de recibo sintético **não é** certificado de remoção física nem aprovação LGPD.

### P-02 — doação institucional

- O fluxo implementado na `main` já restringe doações à retirada combinada pela própria instituição; o chat abre após o aceite institucional e não invoca frete, cobrança, entregador ou repasse externos nesse fluxo.
- A [PR #218](https://github.com/bonecodesign/FRALDAScycle/pull/218) acrescentou regressões para rejeitar valores ou parâmetros de frete, provedor de entrega, comissão logística, pagamento ou repasse nos métodos `create`, `accept` e `pickup` de doação.
- A alteração da redação financeira P-02 está **na PR #215, não na `main`**. O texto econômico de `main` continua histórico e **não** deve ser interpretado como aprovação para cobrar frete em doação. Para a regra proposta, a exceção de retirada direta institucional requer revisão de produto, financeira, consumerista e jurídica e homologação operacional sem ativar serviço externo agora.

## Gates para aprovar e integrar a PR #215

- [ ] Revisão jurídica, consumerista, privacidade/LGPD, segurança e governança por responsáveis humanos reais.
- [ ] Revisão e deliberação para históricos sem `decided_at` com dados reais (preflight atual recusa em segurança).
- [ ] Ensaio controlado **com provedor real homologado** da exclusão do objeto restrito, prova de ausência e tratamento de retries, incidentes e backups; não contratar nem ativar sem autorização posterior.
- [ ] Validação operacional da exceção de retirada institucional sem cobranças, preservando as regras de venda/troca.
- [ ] Se `main` ou head mudar: sincronizar de novo, revalidar o diff e CI **4/4 verde no novo SHA**.
- [ ] Aprovação expressa de merge em `main`, conforme governança aplicável; CI técnico isolado não substitui aceites.

Até concluir os gates, **manter PR #215 draft sem merge**, piloto BH **NO-GO**, nenhum fornecedor ativado, sem credenciais no repositório, sem pagamentos, entregas ou clientes reais. Não implementar orquestração operacional autônoma nesta etapa.

## Matriz oficial

A matriz editável `docs/requirements-matrix.json` permanece com **70 itens: 42 concluídos, 17 parciais, 11 bloqueados (60%)**. Este documento apenas registra evidências técnicas de uma PR **ainda não integrada à `main`**: não promove estados, não aumenta o percentual e não altera a decisão de lançamento.
