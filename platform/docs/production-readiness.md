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
- [x] cadastro, login, sessão e logout;
- [x] verificação de e-mail e recuperação;
- [x] limitação de tentativas por identidade;
- [x] fila transacional, worker e contrato seguro de entrega;
- [ ] credenciais e endpoint do provedor externo de e-mail/SMS;
- [ ] autorização por papel e escopo;
- [ ] rate limiting e proteção contra abuso;
- [x] validação de segredos obrigatórios em produção;
- [ ] armazenamento externo de segredos e observabilidade hospedada;

## Regra imutável

A implementação de produção não pode alterar o protótipo para acomodar limitações técnicas. Quando um contrato estiver ausente, a arquitetura deve ser ampliada em `platform/`.

## Corte 2 — marketplace

- [x] anúncios persistidos;
- [x] busca pública e detalhe;
- [x] venda, troca e doação;
- [x] favoritos por usuário;
- [x] referências de mídia independentes do storage;
- [ ] upload assinado para storage externo;
- [ ] geocodificação e busca por distância;
- [ ] conexão integral das telas de publicação e marketplace.
