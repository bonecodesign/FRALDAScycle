# FC-349 — RLS no ensaio de restauração criptografada (somente dados fictícios)

## Problema tratado

O FC-348 comprovou que duas linhas fictícias sobrevivem a `pg_dump`, AES-256-GCM, descriptografia e `pg_restore` em dois PostgreSQL 17 descartáveis. Restaurar linhas **não prova** que as restrições de acesso a elas continuam funcionando.

## Prova adicionada

Em `tests/recovery-postgres-isolated.test.mjs`, a base sintética de origem agora:

1. cria uma tabela, insere as mesmas duas linhas fictícias;
2. habilita RLS e registra política `fc_recovery_ci_deny_all` para `SELECT` com `USING (false)`;
3. exporta e restaura pelo mesmo fluxo cifrado real do FC-348;
4. verifica que as linhas estão intactas para o administrador, que a tabela mantém `relrowsecurity=true` e que a política foi recriada;
5. **somente no destino**, cria papel descartável sem privilégios, concede `SELECT` e confirma que a política de RLS efetivamente devolve **zero linhas** ao papel restrito.

A execução continua exclusiva do CI público de PR com `FC_ISOLATED_RECOVERY_TEST=true`; Docker interno, sem portas públicas, sem Secrets e sem serviços hospedados. Nenhum dado real é gerado, lido ou transferido.

## Verificação e alcance

O passo de CI deve concluir com `FC_ISOLATED_RECOVERY_SUCCEEDED`. Não declarar resultado antes de todos os jobs finalizarem.

**Limites:** esse ensaio prova a restauração de **uma política fictícia** e sua aplicação. Não é auditoria das 166 tabelas reais do Supabase-BR, não exporta/restaura papéis globais, ACLs/grants, credenciais, serviços Supabase Auth, bytes de Storage, configurações, versões, retenção, RPO ou RTO. `--no-owner --no-privileges` permanece inalterado; as permissões no destino são estabelecidas exclusivamente para o teste.

Inspeção somente leitura do Supabase-BR em 22/11/2026: instância ativa em `sa-east-1`; 166 tabelas públicas com RLS; 0 buckets, 0 objetos Storage, 0 usuários Auth. O advisory de RLS sem política nas 166 tabelas (INFO) **não** autoriza criar políticas automaticamente: deve ser avaliado à luz do modelo de acesso via backend e das permissões da API, sem liberar dados por engano.

A matriz **48/70** e a decisão **piloto NO-GO** não mudam. A recuperação integral hospedada continua dependendo dos gates reais da [issue #339](https://github.com/bonecodesign/FRALDAScycle/issues/339).