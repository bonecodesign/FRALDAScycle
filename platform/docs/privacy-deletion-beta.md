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

## Plano técnico de retenção — 10/11/2026

Quando o inventário chega a `ready_for_review`, a manutenção prepara também um plano idempotente `FC-CLOSURE-RETENTION-1`. O plano aplica somente os prazos já aprovados: financeiro e aceites por 5 anos; suporte comum e eventos de segurança por 12 meses; marketing por 30 dias; navegação por 90 dias; logs por 30 dias, com IP completo por 7; perfis infantis com expurgo operacional após aprovação e expiração em backups em até 30 dias. Chamados precisam ser classificados entre comuns e financeiros/jurídicos antes de qualquer execução.

O banco força `policy_status=pending_professional_review`, `execution_allowed=false` e `automatic_erasure_allowed=false`. O plano não contém SQL de exclusão, não encerra a conta, não contata fornecedor e exige futuros comprovantes de eliminação externa. Assim, a implementação transforma decisões em instruções classificadas sem alegar aprovação jurídica ou purga real.
