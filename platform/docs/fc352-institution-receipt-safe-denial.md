# FC-352 — Recebimento institucional: negação segura para provas ausentes ou malformadas

**Data:** 23/11/2026. **Escopo exclusivo:** FraldaCycle `bonecodesign/FRALDAScycle`, pacote operacional FC-GATE-OPS, sem operação comercial.

## Problema localizado

O contrato `packages/contracts/institution-receipt-readiness.js` já mantinha doações institucionais fora da liquidação financeira: `requirementsMet=false`, `payoutAllowed=false`, `payoutStatus=not_applicable` e retirada sob responsabilidade da instituição.

Uma evidência incompleta (`null`, `undefined` etc.) podia causar exceção ao consultar `row.kind`. Valores não temporais de aprovação e validação também não eram explicitamente rejeitados (por exemplo, `new Date(0)` é uma data válida, mas o valor numérico `0` não representa evidência temporal de aprovação).

## Proteções adicionadas

- Evidência inexistente ou malformada resulta em **negação explícita**, com `institution_receipt_evidence_unavailable`, sem exceção não tratada e sem promoção de recebimento.
- Aprovação/validação exigem carimbo temporal de texto ou `Date`, válido, não futuro e na ordem correta; valores numéricos, booleanos, objetos e datas inválidas não são aceitos como prova.
- Relógio de referência inválido produz `receipt_clock_unavailable` e nega a operação.
- Permanecem exigidos: transação de doação; representante autorizado; comprovante e estado de entrega compatíveis; transação em trânsito; ausência de caso operacional pendente; aprovação anterior à validação independente.
- Mesmo com todas as provas **sintéticas** preenchidas, a conclusão operacional não autoriza pagamento, repasse, aceitação humana nem ativação: `requirementsMet=false`, `payoutAllowed=false`, `payoutStatus=not_applicable`, `institutional_pickup_pending`.

## Como validar

A suíte `tests/institution-receipt-readiness-fail-closed.test.mjs` comprova os casos positivos fictícios e as negações por dados ausentes, dados de formato incorreto, relógio inválido, aprovação/validação futura ou invertida, autoridade indisponível, estado incompatível e casos pendentes.

A aprovação de CI na SHA exata é obrigatória antes da integração em `main`. Os testes são locais e não acessam instituições, mensagens, pagamentos, provedores, Supabase ou Dropbox.

## Limites que não mudam

Esta alteração não cria representante institucional, operador de suporte, integração de retirada, canal de comunicação ou decisão real. Requisitos 18, 51, 56, 62 e 67, portões OPS-01 a OPS-07 e critérios de acessibilidade/rollback continuam sujeitos a revisão e comprovação humanas. Matriz oficial **48/70 (68,57%)**, piloto BH **NO-GO**. Não afirmar homologação real em razão de testes fictícios.

Referência: [issue operacional #231](https://github.com/bonecodesign/FRALDAScycle/issues/231).
