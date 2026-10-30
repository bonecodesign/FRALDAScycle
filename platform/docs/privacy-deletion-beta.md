# Solicitação de exclusão de conta — beta

## Escopo comprovado

O titular autenticado pode registrar uma solicitação de exclusão com protocolo, confirmação explícita e repetição idempotente. A solicitação é privada; terceiros não a consultam. Uma pessoa administrativa autorizada pode analisar o pedido de forma independente, com versão, justificativa, foto das pendências e auditoria.

## Limite deliberado

A análise não encerra a conta nem remove dados. As respostas mantêm `closureAllowed: false`, `erasureAllowed: false` e retenção em revisão. Prazos, fundamentos legais, retenção, identidade humana e operação de purga continuam bloqueados.

Quando o prazo de sete dias termina e não existem obrigações operacionais abertas, a manutenção prepara uma única fotografia técnica por solicitação. Ela conta identidade/acesso, endereços, perfis familiares, consentimentos, transações e chamados, separando categorias sem decidir o que deve ser apagado. O inventário permanece `awaiting_legal_review` e `automaticErasureAllowed: false`; nenhuma instrução `DELETE` ou estado fictício de exclusão é introduzido.

## Evidência automatizada

`tests/privacy-deletion-http-postgres.test.mjs` comprova o fluxo privado por HTTP/PostgreSQL, a análise independente, a idempotência, a auditoria e a preservação da conta.
