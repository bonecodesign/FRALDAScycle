# Histórico de aceite de termos — escopo beta

O mecanismo técnico registra aceite por conta, versão e hash do conteúdo, preserva snapshot dos documentos e horário, evita duplicação em reenvio, audita a primeira gravação e expõe histórico somente à própria conta. A prova HTTP/PostgreSQL usa documento explicitamente sintético.

Validação local em 2026-10-18: `node --test tests/account-terms-http-postgres.test.mjs` — 1 teste aprovado, sem skips. Cobriu sessão obrigatória, consulta da versão, aceite, repetição idempotente, divergência de hash, isolamento entre duas contas, snapshot persistido e auditoria única.

Isto conclui somente o mecanismo de histórico/registro. Os documentos legais atuais continuam rascunhos, não houve aceite de termos reais nem ativação. Revisão e autorização dos documentos permanecem no requisito 46, bloqueado.
