# FC-343 — Auditoria de cobertura do arquivo PostgreSQL antes do Dropbox

**Estado:** endurecimento offline do executor, sem dump hospedado, sem Dropbox real, sem credenciais, sem ativação. A matriz formal permanece 48/70 (68,57%) e piloto BH NO-GO.

## Por que esta etapa foi acrescentada

Um `pg_dump` pode encerrar sem erro e ainda omitir objetos essenciais por uma seleção de schema, permissões ou configuração imprevista. O código FC-340/341/342 já comprova cifragem AES-256-GCM, upload, hash e releitura remota **em mocks**; isso não comprova que o conteúdo exportado cobre as tabelas corretas.

## Verificação implementada

1. O runner privado, depois de executar `node database/recovery.js backup`, chama `pg_restore --list` **somente para ler o índice** do arquivo `.dump`, em PostgreSQL 17, contêiner **sem rede**, acesso **somente leitura** ao volume do dump e sem credenciais de banco no comando.
2. O índice TOC é temporariamente gravado em um arquivo privado 0600 no mesmo volume do runner e examinado por `node tools/backup-toc-coverage.mjs`. O índice não contém registros de usuários e não deve ser enviado para nuvem nem publicado em logs.
3. A verificação requer formato CUSTOM e ao menos **166 definições de tabelas em `public`**, inventário de homologação conferido por SELECT no Supabase-BR em 22/11/2026. Quando alguma migração futura reduzir legitimamente o número, o mínimo deve ser revisado e aprovado; **não contornar** a validação automaticamente.
4. Requer tanto a **definição da tabela** quanto a **entrada de conteúdo** no índice do dump para: `public.schema_migrations`, `public.users`, `public.listings`, `public.transactions`, `auth.users`, `storage.buckets` e `storage.objects`.
5. Se algum requisito falhar, o script termina **antes da criptografia e do upload**. Os arquivos temporários são eliminados pela limpeza do runner. Nenhum restore é executado.

## Limitações explícitas

- A presença `TABLE DATA` no índice não garante linhas existentes, restauração válida, RLS/roles equivalentes, Auth funcional, ou integridade do conteúdo dos blobs do Supabase Storage. Mesmo com zero buckets hoje, blobs futuros precisam de estratégia própria de cópia off-site.
- O inventário de 166 tabelas é o mínimo observado e pode ficar desatualizado após migrações. Uma contagem maior não detecta falta de uma tabela não listada nas sete essenciais; essa é uma barreira inicial, não prova de cobertura integral.
- O resultado `BACKUP_TOC_STRUCTURE_PRESENT` é evidência estrutural offline, **não** conclusão de backup hospedado, retenção WORM de 30 dias, recuperação isolada, RPO ≤60min nem RTO ≤240min.
- A primeira execução real requer seis Secrets, chave em cofre independente, avaliação de faturamento do GitHub privado, CA oficial, TLS verify-full e autorização específica do fundador; restauração exigirá autorização distinta.

## Evidências

- `tools/backup-toc-coverage.mjs` e `tests/backup-toc-coverage.test.mjs`: formatos, dados essenciais, contagem, comentários falsos, arquivo privado 0600 e CLI, usando índice TOC totalmente fictício.
- `infra/private-backup-runner/run-private-backup.sh`: passo Docker offline de listagem TOC inserido **entre** backup e criptografia; nenhuma alteração no modelo de acionamento manual e nenhum segredo exposto.
- `tests/private-backup-runner.test.mjs`: prova que o executor exige o passo TOC e não contém comando de restauração.

**Dependência:** atualizar a SHA fixada no repositório privado `bonecodesign/fraldacycle-backups-private` **somente depois do CI e merge do PR público**, como foi feito no FC-342. Não iniciar execução por essa atualização.