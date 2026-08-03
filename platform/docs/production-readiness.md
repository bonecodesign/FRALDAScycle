# Prontidão para produção

## Estado atual

O produto visual e navegável permanece íntegro. A fundação de produção começa por API, configuração, segurança de credenciais e modelo persistente.

## Corte 1 — fundação

- [x] contrato de configuração por ambiente;
- [x] endpoints de saúde e prontidão;
- [x] cabeçalhos básicos de segurança e CORS restrito;
- [x] hashing de senha com scrypt e comparação resistente a timing;
- [x] tokens de sessão opacos;
- [x] esquema PostgreSQL inicial;
- [x] testes automatizados;
- [x] adaptador PostgreSQL e execução de migrações;
- [ ] cadastro, login, verificação e recuperação;
- [ ] autorização por papel e escopo;
- [ ] rate limiting e proteção contra abuso;
- [ ] observabilidade e gestão de segredos no ambiente hospedado.

## Regra imutável

A implementação de produção não pode alterar o protótipo para acomodar limitações técnicas. Quando um contrato estiver ausente, a arquitetura deve ser ampliada em `platform/`.
