# Histórico de aceite de termos — beta

## Escopo comprovado

A rota autenticada expõe a versão e o hash do catálogo de termos, registra aceite explícito vinculado à versão exata, preserva uma cópia dos documentos e fornece histórico privado. Repetir o mesmo aceite é idempotente e não duplica a auditoria. Preferências de marketing permanecem em tabelas próprias.

## Limite operacional

O teste de integração injeta documentos sintéticos ativos apenas no processo de teste. Os documentos legais carregados pela aplicação continuam em rascunho; a rota de aceite real responde `409 terms_not_active` até aprovação e ativação. Este teste não constitui aprovação jurídica nem ativa termos de produção.

## Evidência automatizada

`tests/account-terms-http-postgres.test.mjs` valida autenticação, versão/hash exatos, aceite e histórico HTTP/PostgreSQL, snapshot documental, idempotência, privacidade e separação de preferências promocionais.
