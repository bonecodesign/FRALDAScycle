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
