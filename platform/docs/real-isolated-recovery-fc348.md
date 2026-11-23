# FC-348 — Ensaio real de backup cifrado e restauração em PostgreSQL descartável

**Escopo:** exercício de infraestrutura local em CI, com **dois bancos PostgreSQL 17 reais**, contêineres temporários, dados exclusivamente fictícios e **sem conexão com o Supabase-BR, Dropbox, ambiente comercial ou GitHub Secrets**.

## O que o novo teste verifica

O arquivo `platform/tests/recovery-postgres-isolated.test.mjs` é executado somente na etapa explícita `FC_ISOLATED_RECOVERY_TEST=true` do job público `listing-postgres`, em uma PR. A suíte geral executada sem essa flag ignora o teste.

1. Cria uma rede Docker temporária **`--internal`**, sem saída externa. Inicializa dois contêineres independentes `postgres:17-alpine`, sem publicar portas no host. Os diretórios de dados PostgreSQL ficam em `tmpfs`; passwords e chave AES são gerados no processo, nunca fornecidos pelo usuário.
2. Cria tabela e duas linhas **sintéticas** apenas no banco de origem. Atesta que o banco de destino ainda não tem essa tabela.
3. Executa o **pg_dump 17 real** com arquivo `.dump` no formato customizado, compressão, `--no-owner --no-privileges`, e confere o índice `pg_restore --list` da tabela e seus dados. Verifica arquivo não vazio e permissão privada `0600`.
4. Calcula SHA-256, executa a implementação real do projeto de **AES-256-GCM**, valida a autenticação do arquivo cifrado, **remove o original em claro**, decripta novamente para um arquivo restrito e confere seu SHA-256.
5. Executa o **pg_restore 17 real**, em outro contêiner isolado, com erro fatal e transação única. Consulta os dados **no destino**, verificando exatamente as duas linhas originais.
6. Remove contêineres, rede, diretório e arquivos mesmo em caso de erro. A rotina não lê `DATABASE_URL`, `RESTORE_DATABASE_URL` ou outros Secrets reais; recusa sua presença explícita no ambiente de teste.

**Evidência observável:** saída `FC_ISOLATED_RECOVERY_SUCCEEDED` mais o status do novo passo no job `listing-postgres`. Nenhum dump, material criptográfico ou senha é publicado como artifact.

## Limites e portões reais preservados

- Este exercício é uma **restauração real de dados fictícios em PostgreSQL descartável**, diferentemente de um mock do comando `pg_restore`. Mas **não é** restauração do backup real do Supabase-BR.
- Não recria a matriz completa de 166 tabelas, `auth`, `storage`, extensions, papéis gerenciados, grants, filas, identidade, objetos binários ou configurações comerciais. `--no-owner --no-privileges` não preserva permissões; um plano separado permanece indispensável.
- `PGSSLMODE=disable` **somente dentro da rede Docker temporária, sem portas externas**. O código de backup remoto continua exigindo `verify-full` com CA real; este teste **não** prova TLS remoto.
- A rede de teste é local e isolada; **não executa** o workflow do repositório privado, não consome franquia de Actions privada, não cobra clientes, não envia conteúdo a nuvens e não constitui autorização de restore hospedado.
- RTO ≤ 240 minutos, RPO ≤ 60 minutos, armazenamento WORM, backups agendados, recuperação integral e prova humana **ainda não comprovados**. A matriz `48/70 (68,57%)`, piloto BH `16/21` e decisão **NO-GO** permanecem intactos.

Referências: issue [FC-339](https://github.com/bonecodesign/FRALDAScycle/issues/339), documentos [FC-345](storage-multi-gate-fc345.md) e [FC-346](runner-offline-rehearsal-fc346.md).