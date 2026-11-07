# Solicitação de exclusão de conta — beta

## Escopo comprovado

O titular autenticado pode registrar uma solicitação de exclusão com protocolo, confirmação explícita e repetição idempotente. A solicitação é privada; terceiros não a consultam. Uma pessoa administrativa autorizada pode analisar o pedido de forma independente, com versão, justificativa, foto das pendências e auditoria.

## Limite deliberado

A análise não encerra a conta nem remove dados. As respostas mantêm `closureAllowed: false`, `erasureAllowed: false` e retenção em revisão. Prazos, fundamentos legais, retenção, identidade humana e operação de purga continuam bloqueados.

Quando o prazo de sete dias termina e não existem obrigações operacionais abertas, a manutenção prepara uma única fotografia técnica por solicitação. Ela conta identidade/acesso, endereços, perfis familiares, consentimentos, transações e chamados, separando categorias sem decidir o que deve ser apagado. O inventário permanece `awaiting_legal_review` e `automaticErasureAllowed: false`; nenhuma instrução `DELETE` ou estado fictício de exclusão é introduzido.

## Evidência automatizada

`tests/privacy-deletion-http-postgres.test.mjs` comprova o fluxo privado por HTTP/PostgreSQL, a análise independente, a idempotência, a auditoria e a preservação da conta.

## Endurecimento de bloqueios técnicos — 07/11/2026

O inventário para análise jurídica somente pode ser preparado se todas as seis contagens obrigatórias de pendências internas forem **inteiros seguros iguais a zero**: transações ativas, casos de pagamento, disputas operacionais, bloqueios de conteúdo, ações de armazenamento pendentes e disputas familiares. Uma contagem ausente, nula, textual, negativa ou não finita passa a manter o pedido em `awaiting_obligations`, sem inventário e sem autorização de exclusão.

O cálculo informativo do andamento também trata contagens negativas como pendentes. A rotina de manutenção aceita no máximo 50 solicitações por execução (inteiros 1–50), com recusa prévia de valores inválidos. Testes unitários verificam esses bloqueios sem comunicação externa. Permanecem pendentes a revisão jurídica de retenção por categoria, confirmação humana da identidade, capacidade de atendimento e autorização de qualquer purga.

O requisito formal 45 continua **parcial** e `automaticErasureAllowed: false` é preservado.
