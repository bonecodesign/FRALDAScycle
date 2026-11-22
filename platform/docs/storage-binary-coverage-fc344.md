# FC-344 — Não confundir backup PostgreSQL com backup de arquivos Supabase Storage

**Data:** 22/11/2026. **Escopo:** verificação segura em código, sem novos serviços, custos, credenciais ou execução hospedada. Matriz 48/70 e piloto BH NO-GO.

## Diferença crítica

Segundo a [documentação oficial do Supabase](https://supabase.com/docs/guides/storage/management/download-objects), os metadados dos arquivos ficam nas tabelas `storage.buckets` e `storage.objects`, enquanto os conteúdos binários ficam armazenados **fora** do PostgreSQL. Assim, `pg_dump` e `pg_restore` não bastam para recuperar fotos de anúncios, imagens, comprovantes, anexos ou outras mídias do Storage.

Na inspeção **somente leitura** de 22/11/2026, o Supabase-BR `urbrtnenrsjvgqjhfhdj` estava `ACTIVE_HEALTHY`, com 0 buckets. Isso **não** autoriza pressupor que continuará vazio após ativação.

## Nova proteção FC-344

1. O workflow privado já valida projeto exato, CA privada, SSL verify-full, chaves/credenciais por presença e flags de execução manual.
2. Agora executa `platform/tools/storage-binary-coverage-preflight.mjs` **antes do pg_dump**, usando `psql` PostgreSQL 17 em contêiner com leitura de arquivos somente e credenciais no ambiente, nunca nos argumentos.
3. O SQL consulta somente `EXISTS` de `storage.buckets` e `storage.objects`; não lê nem imprime nomes, dados ou conteúdo de arquivos.
4. Se ambas as tabelas estiverem vazias, imprime `STORAGE_EMPTY_DB_ONLY`, que representa **apenas a condição de Storage vazio no instante da consulta**. Se existir qualquer bucket (mesmo vazio) ou objeto, interrompe todo o backup do banco **sem enviar nada ao Dropbox**, até haver estratégia aprovada de cópia de arquivos.
5. Falhas de conexão, permissões, CA, segredo, respostas inesperadas e falhas no comando interrompem o fluxo. Mensagens de erro ficam genéricas, sem exibir URLs, hostnames, senhas ou registros sensíveis.

**Atenção a race conditions:** mesmo se a consulta mostrar Storage vazio, é possível a criação de um novo arquivo entre o preflight e a exportação. Esse controle é uma barreira inicial para homologação; não substitui uma arquitetura com snapshot consistente, versão do catálogo, bloqueio de gravações ou provas de recuperação antes de uso comercial.

## Para backup completo no futuro

- Projetar exportação **dos bytes de todos os objetos** via API/S3 autenticada do Supabase Storage, idealmente por armazenamento com acesso mínimo, registrando inventário por bucket, nome, versão/ETag, tamanho e hash (sem imprimir nomes pessoais em logs públicos).
- Criptografar esses bytes antes de gravar fora do Supabase; usar somente artefatos de armazenamento privados, evitar exposição de dados infantis, limitar operadores e testar a restauração de um arquivo de cada categoria em conta/projeto isolado.
- Confirmar consistência entre o backup de metadados PostgreSQL e a cópia de objetos (mesma geração/instante ou estratégia versionada), com novas permissões, custos e escopos de OAuth/S3 explicitamente aprovados.
- Verificar retenção imutável 30 dias, RPO <=60min, RTO <=240min, monitoramento e recuperação periódica. Dropbox simples **não equivale** a WORM.
- Não desativar esse bloqueio para realizar o primeiro backup se Storage deixar de estar vazio; resolver a estratégia de objetos antes.

## Evidência da execução segura

`tests/storage-binary-coverage-preflight.test.mjs` usa credenciais e certificados **sintéticos**, simula a saída `psql`, recusa arquivos reais não protegidos, caminhos de erro, dados de Storage presentes e vazamento de segredos. `tests/private-backup-runner.test.mjs` exige que o preflight anteceda `pg_dump`.

**Não foi feita conexão real PostgreSQL pelo runner, dump, upload Dropbox, restauração ou ativação comercial por este pacote.** O teste Supabase read-only do projeto BR, executado via conector, não substitui a prova de TLS do cliente do runner.

Tarefa principal: [FC-339](https://github.com/bonecodesign/FRALDAScycle/issues/339); executor privado: `bonecodesign/fraldacycle-backups-private`.
