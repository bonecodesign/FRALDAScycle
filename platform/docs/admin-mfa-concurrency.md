# Confirmação administrativa e concorrência

A emissão dos tokens é transacional e bloqueia a conta antes de invalidar os desafios anteriores. Emissões simultâneas para a mesma conta não deixam vários desafios ativos.

A confirmação de MFA agora consome o código e cria a sessão na mesma transação. O limite de tentativas é conferido sob bloqueio por desafio. A conta é bloqueada e seu estado/papel revalidado antes do consumo. Erro ao criar a sessão desfaz o consumo, permitindo repetir a confirmação dentro da validade original.

A emissão também cria o código e sua notificação vinculada na mesma transação, com papel e suspensão revalidados. Falha ao gravar a fila preserva o desafio anterior. Rejeição da emissão não retorna novo desafio utilizável. Validação e limites em `notification-token-binding.md`.

O teste em PostgreSQL temporário cobre emissão concorrente, uso único da confirmação, limite concorrente, rollback e bloqueio por suspensão ou perda do papel elevado. Integração de entrega do código, proteção adicional de recuperação e fluxos antigos de 2FA ainda precisam de homologação; esta etapa não autoriza ativação real.

Validação realizada em PostgreSQL 16: 10 emissões concorrentes deixaram um desafio ativo; 20 confirmações geraram uma sessão; 20 códigos inválidos registraram cinco falhas e bloquearam as 15 tentativas seguintes. A falha sintética ao criar sessão preservou o token para repetir. O executor `npm run test:listing-postgres` também executa essa verificação.

Ocorrência durante a checagem de regressão: o arquivo de identidade incluiu dois testes HTTP locais, executados inadvertidamente apesar do adiamento solicitado. Ambos passaram; isso não constitui homologação HTTP completa.
