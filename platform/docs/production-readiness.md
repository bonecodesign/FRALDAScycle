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
- [x] autorização por papel e escopo nos contratos administrativos;
- [x] trilha persistente para mudanças administrativas críticas;
- [x] diretório real de usuários com suspensão, reativação e revogação de sessões;
- [x] exportação CSV protegida da auditoria;
- [x] gestão e revogação remota de sessões administrativas;
- [x] paginação da trilha de auditoria;
- [x] rate limiting geral em memória e proteção HTTP 429;
- [ ] rate limiting distribuído para múltiplas instâncias;
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
- [x] contrato de upload assinado para storage externo;
- [x] contrato de geocodificação externa;
- [x] busca por distância no banco e ordenação por proximidade;
- [x] conexão das telas de busca, detalhe, favoritos e publicação;
- [x] telas preparadas para upload real de mídia e geocodificação externa;
- [ ] credenciais e endpoints dos provedores de mídia e geocodificação;
