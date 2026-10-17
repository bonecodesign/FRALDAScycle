# Solicitação de exclusão de conta — beta

## Escopo comprovado

O titular autenticado pode registrar uma solicitação de exclusão com protocolo, confirmação explícita e repetição idempotente. A solicitação é privada; terceiros não a consultam. Uma pessoa administrativa autorizada pode analisar o pedido de forma independente, com versão, justificativa, foto das pendências e auditoria.

## Limite deliberado

A análise não encerra a conta nem remove dados. As respostas mantêm `closureAllowed: false`, `erasureAllowed: false` e retenção em revisão. Prazos, fundamentos legais, retenção, identidade humana e operação de purga continuam bloqueados.

## Evidência automatizada

`tests/privacy-deletion-http-postgres.test.mjs` comprova o fluxo privado por HTTP/PostgreSQL, a análise independente, a idempotência, a auditoria e a preservação da conta.
