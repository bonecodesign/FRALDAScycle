# Suspensão temporária e recurso — beta

## Escopo comprovado

Uma pessoa autorizada pode aplicar suspensão temporária e auditada. O titular recebe uma rota privada para contestar a decisão, que cria um protocolo de suporte. A revisão exige uma pessoa diferente tanto do titular quanto de quem tomou a decisão inicial.

Quando a revisão independente reverte a decisão, a suspensão deixa de bloquear novas operações. O registro histórico e o protocolo de suporte permanecem preservados.

## Limite deliberado

Não há banimento definitivo, decisão automatizada, comunicação externa nem garantia de equipe humana disponível. Toda medida continua temporária, versionada e sujeita à revisão operacional.

## Evidência automatizada

`tests/moderation-appeal-http-postgres.test.mjs` comprova por HTTP/PostgreSQL a suspensão, o recurso, a recusa de autorrevisão, a revisão independente, a reversão e a preservação da auditoria.
