# Validade dos códigos na fila de notificações

A migração 044 vincula notificações ao registro do código em `auth_tokens` e acrescenta o estado `cancelled`. Códigos novos de verificação, recuperação e MFA administrativo passam essa referência internamente. O fornecedor recebe o contrato anterior; não recebe o hash nem o identificador interno do token.

A reserva dos trabalhos cancela notificações pendentes ou em retentativa cujo código foi consumido, substituído ou expirou, ou cuja conta foi suspensa. O código em texto aberto é removido do payload cancelado. Recuperações antigas sem referência ao token também são canceladas; o usuário precisa solicitar novo código. Verificação e MFA legados sem vínculo conservam compatibilidade e ainda precisam de revisão.

O trabalhador revalida o código imediatamente antes da chamada externa. Se a consulta falhar, não envia e agenda retentativa. Se o código já não for utilizável, cancela sem chamar o fornecedor. Respostas tardias de sucesso ou falha não mudam uma notificação cancelada para entregue ou em retentativa.

Validação local: 13 testes de serviço/trabalhador, dois testes selecionados de identidade e cinco testes PostgreSQL aprovados, sem skips. As 44 migrações foram aplicadas na base temporária, removida após a execução. Chamadas externas nos testes são funções simuladas; nenhum teste HTTP ou envio real foi executado.

Emissão atômica da recuperação: o serviço passa o código destinado à mensagem na operação de criação do token. Sob bloqueio da conta, o repositório revalida suspensão, escolhe o contato atual, invalida tokens anteriores, cria o novo token e grava a notificação vinculada na mesma transação. Uma falha em qualquer gravação desfaz a substituição e preserva o código anterior. A reserva de frequência continua consumida em caso de falha, conforme a política de limitação. A fila persistida passa a ser o único caminho de notificação da recuperação; não há uma segunda inclusão via serviço de notificações.

Validação desta etapa: 13 testes de serviço/trabalhador, três testes selecionados de identidade e seis testes PostgreSQL passaram, sem skips, totalizando 22. Falha sintética da fila preservou o token anterior e não deixou token novo órfão. Repetição criou uma mensagem vinculada, e vinte emissões concorrentes deixaram um token ativo e uma mensagem elegível. Conta suspensa durante a emissão não ganhou código nem mensagem. Nenhuma migração nova foi necessária além da 044 já existente.

Verificação e MFA: ambos os fluxos agora passam a mensagem à mesma criação transacional do token, como a recuperação. O serviço de autenticação e seu runtime deixam de fazer uma segunda inclusão via serviço de notificações. A escolha do contato e do canal acontece com a conta bloqueada. Para MFA, o papel administrativo/moderador é revalidado antes da emissão; rejeição ou falha não retorna um desafio utilizável nem cria sessão.

Validação adicional: 14 testes de serviço/trabalhador, três testes selecionados de identidade e sete testes PostgreSQL passaram (24 no total), sem skips. Para verificação e MFA, rollback da fila preservou o código anterior; oito emissões concorrentes deixaram um código ativo por finalidade. E-mail e SMS com contato atual, perda de papel administrativo e falha de emissão foram verificados. As 44 migrações passaram; o banco temporário foi removido. Nenhum teste HTTP ou envio real foi executado.

Cadastro: a operação `createUserWithVerification` reúne conta, registro da declaração de maioridade, código e mensagem vinculada em uma única transação. Falha ao inserir token ou notificação desfaz a conta recém-criada. O cadastro não faz uma segunda emissão após criar a conta. Conflitos dos índices de e-mail/telefone retornam `account_exists`; conflito do hash de verificação não é apresentado como conta já existente.

Validação do cadastro: 14 testes de serviço/trabalhador, dez testes de identidade selecionados explicitamente para excluir HTTP e oito testes PostgreSQL passaram (32 no total), sem skips. Uma falha sintética da fila não deixou conta, token ou mensagem; nova tentativa criou os três. Vinte pedidos simultâneos para o mesmo e-mail criaram uma conta, um código e uma mensagem. Cadastro por telefone/SMS, declaração de maioridade, conflito de telefone e rollback por colisão de hash também foram verificados. As 44 migrações passaram; o banco temporário foi removido.

Verificação da conta agora usa desafio, confirmação transacional e limites concorrentes de tentativas/emissão, conforme `account-verification-challenge.md`.

Reservas agora usam identificação própria, bloqueando respostas de trabalhadores antigos; os códigos em texto aberto são removidos após entrega, uso, expiração ou fim das tentativas. Validação e limites em `notification-claim-retention.md`, que usa a migração 045.

Limites: uma mensagem já em trânsito ao fornecedor pode chegar após substituição do código; a plataforma rejeita o código anterior. Limites globais/administrativos de emissão ainda precisam evoluir. Credenciais, entrega real, retenção dos demais dados e homologação da jornada continuam pendentes. Aplicar as migrações 044/045 e substituir os trabalhadores antes de ativar esta versão.
