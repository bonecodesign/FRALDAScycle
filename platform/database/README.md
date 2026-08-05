# Banco de dados de produção

O destino oficial é PostgreSQL. As migrações são incrementais, imutáveis depois de aplicadas e executadas por ordem numérica.

## Primeiro domínio persistente

A migração `001_initial.sql` cria:

- usuários, papéis e verificação;
- sessões revogáveis com armazenamento apenas do hash do token;
- endereços;
- anúncios de venda, troca e doação;
- transações e reservas;
- trilha de auditoria.

## Segurança

Credenciais não entram no repositório. Use `DATABASE_URL` e um gerenciador de segredos por ambiente. Produção deve exigir TLS, backups automáticos, point-in-time recovery e uma função de aplicação sem privilégios de criação de esquema.

## Backup e teste de restauração

Os comandos exigem as ferramentas oficiais do PostgreSQL instaladas no ambiente operacional.

```powershell
$env:DATABASE_DUMP_PATH="C:\backups\fraldacycle.dump"
npm run db:backup
```

A restauração deve ocorrer primeiro em um banco isolado. Ela exige URL própria e confirmação explícita:

```powershell
$env:RESTORE_DATABASE_URL="postgresql://usuario:senha@host:5432/fraldacycle_restore?sslmode=require"
$env:DATABASE_DUMP_PATH="C:\backups\fraldacycle.dump"
$env:CONFIRM_DATABASE_RESTORE="RESTORE"
npm run db:restore
```

Credenciais são passadas ao cliente PostgreSQL por variáveis de ambiente e nunca aparecem nos argumentos do processo. O arquivo de backup não deve entrar no Git nem ser armazenado sem criptografia.
