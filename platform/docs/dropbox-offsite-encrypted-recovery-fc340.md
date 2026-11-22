# FC-340 — Criptografia para backups externos do FraldaCycle

**Estado:** preparado em código e testado com arquivos fictícios. Não houve exportação do Supabase-BR, upload ou restauração remota. Piloto continua NO-GO.

## Preservamos o que já existia

- `npm run db:backup`: `pg_dump` privado (.dump + SHA-256), sem sobrescrita, exigindo `sslmode=verify-full` e CA oficial para conexão remota.
- `npm run db:restore`: exige banco diferente e confirmação de destino remoto, podendo apagar objetos. Nunca apontar para o Supabase-BR atual.

## Novo componente FC-340

`database/recovery-archive.js` cifra dumps em streaming com AES-256-GCM, IV aleatório e cabeçalho autenticado. Seu formato versionado é `FCBKUP01` (8 bytes) + IV (12 bytes) + bytes cifrados + tag GCM (16 bytes). O checksum SHA-256 de arquivo cifrado protege a transferência. Não instala dependências, não conecta Supabase, não transfere nada ao Dropbox. O verificador não escreve texto puro e a descriptografia só publica resultado após autenticação completa.

Comandos manuais em `platform/`:

- `npm run db:encrypt:backup` exige `DATABASE_DUMP_PATH` (.dump mais .dump.sha256 já existentes), `RECOVERY_ENCRYPTED_PATH` (terminando em .dump.fcenc), `RECOVERY_ARCHIVE_KEY_B64` (chave aleatória de 32 bytes em Base64 guardada em cofre), `RECOVERY_ARCHIVE_APPROVED=ENCRYPT_OR_VERIFY`.
- `npm run db:verify:encrypted` exige mesma chave, mesmo arquivo cifrado e autorização `ENCRYPT_OR_VERIFY`; verifica checksum e autenticidade sem criar dump aberto.
- `npm run db:decrypt:isolated` exige chave original, caminho do arquivo cifrado, `RECOVERY_DECRYPTED_PATH` terminado em .dump e `RECOVERY_ARCHIVE_APPROVED=ISOLATED_DECRYPT`. Não executa `pg_restore`.

Os comandos recusam NODE_ENV=production. Erros da CLI são genéricos. Arquivos de saída são privados e não sobrescrevem conteúdo existente. A criptografia **não elimina automaticamente o dump original**; esse descarte requer política aprovada. Não armazenar chave, senha, URL com senha, dados infantis ou tokens no Dropbox, GitHub, chat, logs ou repositório. Sem a chave, o backup não poderá ser restaurado; rotação e guarda de chaves antigas precisam de cofre separado.

## Como será usado com Dropbox, após infraestrutura aprovada

1. Backend isolado configura cofre, CA oficial e conexão TLS real aprovada (FC-338/339).
2. Executa pg_dump em volume privado cifrado, com checksum e sem exposição de senha.
3. Executa encrypt e verify com chave independente da senha do banco, gerada e fornecida pelo cofre.
4. Somente os arquivos `.dump.fcenc` e `.dump.fcenc.sha256` serão enviados a `/FRALDA/Backups-Supabase-BR`, seguidos de download de verificação e comparação de hash. O conector Dropbox deste chat exige arquivo de origem fornecido na conversa; não executa pg_dump nem agenda backups.
5. O dump original deve seguir política de retenção e exclusão segura; em SSD a exclusão comum não garante apagamento físico. Preferir volume cifrado.
6. Restauração: baixar arquivo cifrado para máquina isolada, verificar, descriptografar em volume privado, executar restore SOMENTE num banco novo e descartável com revisão independente. Nunca executar `pg_restore --clean` no BR atual.

## Limites ainda não resolvidos

Dropbox é um candidato off-site, não comprova armazenamento imutável por 30 dias, nem backup a cada 60 minutos, monitoramento, RPO <= 60 minutos, RTO <= 240 minutos ou teste hospedado. Ainda faltam cofre, endpoint de backend autorizado, pg_dump real, envio, integridade após download, retenção WORM e ensaio independente.

**Matriz oficial permanece em 48/70 = 68,57%; piloto BH 16/21, NO-GO.**